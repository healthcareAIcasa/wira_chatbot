'use strict';
// Picks the nearest APPROVED answer ID (AID) for a patient's typed question.
// It never writes text: it returns an AID (or a short list of AIDs) and the server
// looks up the approved answer verbatim from data/answers.json.
//
// Method (all local, deterministic once built):
//  1. Embed the question with the sentence model (wira-e5-small-ascii).
//  2. Scope gate: cosine similarity to the closest approved example question.
//     Too far from every example -> S01 fallback (off-topic / unclear).
//  3. Choice: a small linear classifier (softmax regression, 384 x N weights) trained at
//     build time on the approved example questions + configuration examples.
//  4. Safety rule: urgent-help keywords always route to S04.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalize } = require('../public/js/textguard');
const embedder = require('./embedder');

const DATA = path.join(__dirname, '..', 'data');
const ANSWERS_PATH = path.join(DATA, 'answers.json');
const EMB_PATH = path.join(DATA, 'embeddings.json');
const CONFIG_PATH = path.join(DATA, 'match_config.json');

// Rule-triggered system responses are never matched by similarity.
const NOT_MATCHABLE = new Set(['S01', 'S02']);
// Greeting-only messages -> S06 (deterministic).
const GREETING = /^(?:hi+|hello+|hai+|helo+|hey|hye|salam|assalamualaikum|good\s+(?:morning|afternoon|evening)|selamat\s+(?:pagi|petang|tengah\s+hari|malam|sejahtera))(?:\s+(?:there|doc|doktor|bot|chatbot|mywira))?[\s!.?]*$/i;

const CFG = {
  simLow: Number(process.env.MATCH_SIM_LOW || 0.865),  // below -> S01 fallback (out of scope)
  pWeak: 0.25, simWeak: 0.89,  // weak choice AND only moderately in scope -> S01
  pHigh: Number(process.env.MATCH_P_HIGH || 0.55),     // classifier probability to answer directly...
  pMargin: Number(process.env.MATCH_P_MARGIN || 0.20), // ...when this far ahead of the 2nd choice
  simDirect: Number(process.env.MATCH_SIM_DIRECT || 0.83), // and the question is clearly in scope
  kwLogit: Number(process.env.MATCH_KW_LOGIT || 0.5), // keyword match adds this to the answer's score (log scale)
  pSuggest: 0.05,      // minimum probability for a "Did you mean" option
  pUrgent: 0.25,       // S04 shown if its probability reaches this (safer to over-show)
  lr: { lambda: 1e-3, temp: 0.1, epochs: 600, step: 0.5 },
};

function loadJson(p, dflt) { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : dflt; }

function bankTexts() {
  const bank = loadJson(ANSWERS_PATH);
  const cfg = loadJson(CONFIG_PATH, { extraExamples: {}, keywords: {} });
  const items = [];
  for (const [aid, a] of Object.entries(bank.answers)) {
    if (NOT_MATCHABLE.has(aid)) continue;
    for (const L of ['en', 'bm']) {
      for (const ex of a[L].examples) items.push({ aid, text: normalize(ex) });
      if (!aid.startsWith('S')) items.push({ aid, text: normalize(a[L].title) });
    }
    for (const ex of (cfg.extraExamples[aid] || [])) items.push({ aid, text: normalize(ex) });
  }
  return items;
}

function textsHash(items) {
  return crypto.createHash('sha256').update(JSON.stringify(CFG.lr) + JSON.stringify(items.map((i) => [i.aid, i.text]))).digest('hex').slice(0, 16);
}

function keywordRules() {
  const cfg = loadJson(CONFIG_PATH, { keywords: {} });
  const esc = (k) => k.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  // Malay affixes allowed around a keyword: di-jual, padam-kan, aduan-nya
  return Object.entries(cfg.keywords || {}).filter(([aid]) => aid !== 'S04').map(([aid, kws]) => ({
    aid, re: new RegExp('(?:^|[^a-z0-9])(?:di|ter|ber|me|mem|men|meng|pe|pem|pen|peng)?(?:' + kws.map(esc).join('|') + ')(?:kan|nya|an|i)?(?![a-z0-9])', 'i'),
  }));
}

function urgentRule() {
  const cfg = loadJson(CONFIG_PATH, { keywords: {} });
  const kws = (cfg.keywords && cfg.keywords.S04) || [];
  if (!kws.length) return null;
  const esc = (k) => k.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp('(?:^|[^a-z0-9])(?:' + kws.map(esc).join('|') + ')', 'i');
}

function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }

// Softmax regression trained by full-batch gradient descent (deterministic: zero init, fixed order).
function trainClassifier(vecs, labelIdx, nClass, { lambda, temp, epochs, step }) {
  const n = vecs.length, d = vecs[0].length;
  const W = new Float64Array(d * nClass), b = new Float64Array(nClass);
  const X = vecs.map((v) => Float64Array.from(v, (x) => x / temp));
  const P = new Float64Array(nClass), gW = new Float64Array(d * nClass), gb = new Float64Array(nClass);
  for (let ep = 0; ep < epochs; ep++) {
    gW.fill(0); gb.fill(0);
    for (let i = 0; i < n; i++) {
      const x = X[i];
      let mx = -Infinity;
      for (let c = 0; c < nClass; c++) {
        let z = b[c];
        for (let k = 0; k < d; k++) z += x[k] * W[k * nClass + c];
        P[c] = z; if (z > mx) mx = z;
      }
      let sum = 0;
      for (let c = 0; c < nClass; c++) { P[c] = Math.exp(P[c] - mx); sum += P[c]; }
      for (let c = 0; c < nClass; c++) {
        const g = P[c] / sum - (c === labelIdx[i] ? 1 : 0);
        gb[c] += g;
        for (let k = 0; k < d; k++) gW[k * nClass + c] += g * x[k];
      }
    }
    for (let j = 0; j < W.length; j++) W[j] -= step * (gW[j] / n + lambda * W[j]);
    for (let c = 0; c < nClass; c++) b[c] -= step * (gb[c] / n);
  }
  return { W: Array.from(W, (x) => +x.toFixed(6)), b: Array.from(b, (x) => +x.toFixed(6)), d, nClass };
}

const f32ToB64 = (v) => Buffer.from(new Float32Array(v).buffer).toString('base64');
function b64ToArr(b64) {
  const buf = Buffer.from(b64, 'base64'); // may be a slice of Node's shared pool: copy using offset
  return Array.from(new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));
}

class Matcher {
  constructor() { this.ready = false; }

  async init() {
    const items = bankTexts();
    const hash = textsHash(items);
    const saved = loadJson(EMB_PATH, null);
    if (!saved || saved.hash !== hash) throw new Error('data/embeddings.json missing or out of date: run "npm run build"');
    await embedder.load();
    this.items = items.map((it, k) => ({ ...it, vec: b64ToArr(saved.vectors[k]) }));
    this.labels = saved.classifier.labels;
    this.W = saved.classifier.W; this.b = saved.classifier.b; this.d = saved.classifier.d;
    this.temp = CFG.lr.temp;
    this.urgent = urgentRule();
    this.rules = keywordRules();
    this.hash = hash;
    this.ready = true;
    return this;
  }

  static async build() {
    const items = bankTexts();
    const vecs = await embedder.embed(items.map((i) => i.text));
    const labels = [...new Set(items.map((i) => i.aid))].sort();
    const idx = items.map((i) => labels.indexOf(i.aid));
    const clf = trainClassifier(vecs, idx, labels.length, CFG.lr);
    fs.writeFileSync(EMB_PATH, JSON.stringify({
      model: 'wira-e5-small-ascii', hash: textsHash(items), count: items.length,
      vectors: vecs.map(f32ToB64), classifier: { labels, ...clf },
    }));
    return { texts: items.length, classes: labels.length };
  }

  async analyse(rawText) {
    const text = normalize(rawText);
    if (!text || !/[a-z]/i.test(text)) return null;
    const [q] = await embedder.embed([text]);
    let sim = -1;
    for (const it of this.items) { const s = dot(q, it.vec); if (s > sim) sim = s; }
    const C = this.labels.length, z = new Float64Array(C);
    let mx = -Infinity;
    for (let c = 0; c < C; c++) {
      let v = this.b[c];
      for (let k = 0; k < this.d; k++) v += (q[k] / this.temp) * this.W[k * C + c];
      z[c] = v;
    }
    const low = ' ' + text.toLowerCase() + ' ';
    for (const r of this.rules) {
      const c = this.labels.indexOf(r.aid);
      if (c >= 0 && r.re.test(low)) z[c] += CFG.kwLogit;
    }
    for (let c = 0; c < C; c++) if (z[c] > mx) mx = z[c];
    let sum = 0; for (let c = 0; c < C; c++) { z[c] = Math.exp(z[c] - mx); sum += z[c]; }
    const ranked = this.labels.map((aid, c) => ({ aid, p: z[c] / sum })).sort((a, b) => b.p - a.p);
    return { text, sim, ranked };
  }

  // Decision: { kind: 'answer'|'suggest'|'fallback', aid?, suggestions?[], top? }
  async decide(rawText) {
    const r = await this.analyse(rawText);
    if (!r) return { kind: 'fallback', aid: 'S01' };
    const { sim, ranked, text } = r;
    const [t1, t2] = ranked;
    const top = { aid: t1.aid, p: +t1.p.toFixed(3), sim: +sim.toFixed(3) };
    if (this.urgent && this.urgent.test(text)) return { kind: 'answer', aid: 'S04', top };
    if (GREETING.test(text)) return { kind: 'answer', aid: 'S06', top };
    if (sim < CFG.simLow) return { kind: 'fallback', aid: 'S01', top };
    if (t1.p < CFG.pWeak && sim < CFG.simWeak) return { kind: 'fallback', aid: 'S01', top };
    const s04 = ranked.find((x) => x.aid === 'S04');
    if (s04 && s04.p >= CFG.pUrgent) return { kind: 'answer', aid: 'S04', top };
    if (t1.p >= CFG.pHigh && t1.p - t2.p >= CFG.pMargin && sim >= CFG.simDirect) return { kind: 'answer', aid: t1.aid, top };
    const sugg = ranked.filter((x) => x.p >= CFG.pSuggest && !x.aid.startsWith('S')).slice(0, 3).map((x) => x.aid);
    if (t1.aid.startsWith('S') && t1.p >= 0.4) return { kind: 'answer', aid: t1.aid, top };
    if (sugg.length) return { kind: 'suggest', suggestions: sugg, top };
    return { kind: 'fallback', aid: 'S01', top };
  }
}

module.exports = { Matcher, CFG, normalize };
