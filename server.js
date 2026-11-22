'use strict';
// wira_chatbot — MyWIRA patient information chatbot + online opt-out form.
// No login, no cookies, no database. Typed chat text and form contents are never stored or logged.
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { Matcher } = require('./lib/matcher');
const { screenPersonal } = require('./public/js/textguard');
const { validateOptOut } = require('./lib/validate');
const { buildFormPdf } = require('./lib/pdfForm');
const { sendOptOutEmail } = require('./lib/email');
const bank = require('./data/answers.json');
const { META: FORM_META, T: FORM_TEXT } = require('./lib/formText');

// Form wording for the browser (strings only, from the paper form)
function formStrings(L) {
  const out = {};
  for (const [k, v] of Object.entries(L)) if (typeof v !== 'function') out[k] = v;
  out.subtitle = L.subtitle(FORM_META.version, FORM_META.versionDate.en);
  return out;
}
const FORM_STRINGS = { en: formStrings(FORM_TEXT.en), bm: formStrings(FORM_TEXT.bm) };

const PORT = process.env.PORT || 3000;
const flag = (name, dflt) => (process.env[name] == null ? dflt : !/^(0|false|no|off)$/i.test(process.env[name]));
const CHATBOT_ENABLED = flag('CHATBOT_ENABLED', true);   // kill switch for the chatbot (static notice instead)
const FREE_TEXT_ENABLED = flag('FREE_TEXT_ENABLED', true); // false = buttons and question menu only
const OPTOUT_FORM_ENABLED = flag('OPTOUT_FORM_ENABLED', true);
const BANK_VERSION = process.env.ANSWER_BANK_VERSION || bank.meta.bankVersion;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Render terminates TLS in front of the app

// ---- security headers
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; " +
      "font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'Strict-Transport-Security': 'max-age=31536000',
    'Cross-Origin-Opener-Policy': 'same-origin',
  });
  next();
});

// ---- tiny in-memory rate limiter (IP held in memory for a short window only; never logged)
const buckets = new Map();
function limit(name, max, windowMs) {
  return (req, res, next) => {
    const key = name + ':' + crypto.createHash('sha256').update(String(req.ip)).digest('hex').slice(0, 16);
    const now = Date.now();
    const b = buckets.get(key) || { n: 0, reset: now + windowMs };
    if (now > b.reset) { b.n = 0; b.reset = now + windowMs; }
    b.n++;
    buckets.set(key, b);
    if (b.n > max) return res.status(429).json({ error: 'rate_limited' });
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k); }, 60000).unref();

// ---- matcher (loads in the background; until ready the page offers buttons only)
const matcher = new Matcher();
let matcherError = null;
if (CHATBOT_ENABLED && FREE_TEXT_ENABLED) {
  matcher.init()
    .then(() => console.log('matcher ready'))
    .catch((e) => { matcherError = e.message; console.error('matcher failed to load; free text disabled:', e.message); });
}

// ---- public answer bank (approved text only; example questions are not sent to the browser)
function publicBank() {
  const answers = {};
  for (const [aid, a] of Object.entries(bank.answers)) {
    answers[aid] = { v: a.version, en: { t: a.en.title, a: a.en.answer }, bm: { t: a.bm.title, a: a.bm.answer } };
  }
  return { buttons: bank.buttons, quick: bank.quick, categories: bank.categories, answers };
}
const PUBLIC_BANK = publicBank();

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.get('/api/config', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    chatbotEnabled: CHATBOT_ENABLED,
    optOutFormEnabled: OPTOUT_FORM_ENABLED,
    freeText: CHATBOT_ENABLED && FREE_TEXT_ENABLED && matcher.ready,
    freeTextLoading: CHATBOT_ENABLED && FREE_TEXT_ENABLED && !matcher.ready && !matcherError,
    label: `MyWIRA | MREC Ref ${bank.meta.mrecRef} | Answer Bank ${BANK_VERSION}`,
    bank: PUBLIC_BANK,
    form: FORM_STRINGS,
  });
});

app.post('/api/match', limit('match', 40, 60000), express.json({ limit: '4kb' }), async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!CHATBOT_ENABLED || !FREE_TEXT_ENABLED || !matcher.ready) return res.status(503).json({ error: 'free_text_unavailable' });
  const text = typeof (req.body && req.body.text) === 'string' ? req.body.text.slice(0, 500) : '';
  try {
    // Second line of defence: the browser already screens for personal details before sending.
    if (screenPersonal(text)) return res.json({ kind: 'answer', aid: 'S02' });
    const d = await matcher.decide(text);
    return res.json({ kind: d.kind, aid: d.aid, suggestions: d.suggestions });
  } catch (e) {
    console.error('match error', e.name);
    return res.status(500).json({ error: 'match_failed' });
  }
});

app.post('/api/optout', limit('optout', 6, 60 * 60000), express.json({ limit: '800kb' }), async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!OPTOUT_FORM_ENABLED) return res.status(503).json({ error: 'form_disabled' });
  const body = req.body || {};
  if (body.website) return res.json({ ok: true, ref: 'WIRA-0' }); // honeypot: silently ignore bots
  const v = validateOptOut(body);
  if (!v.ok) return res.status(400).json({ error: 'invalid', fields: v.errors });
  const form = v.form;
  form.ref = `WIRA-${form.ymd}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  try {
    const pdf = await buildFormPdf(form, form.lang);
    await sendOptOutEmail(form, pdf);
    return res.json({ ok: true, ref: form.ref });
  } catch (e) {
    console.error('optout send failed:', e.code || e.name, e.code ? '' : e.message.slice(0, 80)); // no form contents
    return res.status(502).json({ error: e.code === 'EMAIL_NOT_CONFIGURED' ? 'email_not_configured' : 'send_failed' });
  } finally {
    form.signaturePng = null;
  }
});

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`wira_chatbot listening on ${PORT} (chatbot ${CHATBOT_ENABLED ? 'on' : 'OFF'}, free text ${FREE_TEXT_ENABLED ? 'on' : 'off'})`));
