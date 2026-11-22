'use strict';
// Draws the MyWIRA Patient Opt-Out Form (A4) and fills it with an online submission.
// With data = null it draws the blank paper form (used to regenerate the paper forms).
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { META, T } = require('./formText');
const { toAscii } = require('../public/js/textguard');

const A4 = [595.28, 841.89];
const M = 50;                       // page margin
const W = A4[0] - 2 * M;            // content width
const GRID = rgb(0.55, 0.55, 0.55);
const HEAD_BG = rgb(0.85, 0.85, 0.85);
const LABEL_BG = rgb(0.95, 0.95, 0.95);
const INK = rgb(0, 0, 0);
const FILL = rgb(0.05, 0.15, 0.45); // patient entries in dark blue, like pen on paper
const LINK = rgb(0.02, 0.27, 0.75);
const C4 = [112, 166, 107, 110];    // 4-column row widths (label, value, label, value)

function pdfSafe(s) { return toAscii(String(s == null ? '' : s)); }

function wrap(text, font, size, width) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (font.widthOfTextAtSize(t, size) <= width || !line) line = t;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

async function drawForm(data, lang, K) {
  const L = T[lang] || T.en;
  const doc = await PDFDocument.create();
  doc.setTitle(L.title.replace(/\s+\|\s+/, ' - '));
  doc.setAuthor('MyWIRA Research Office');
  doc.setSubject(`MyWIRA Patient Opt-Out Form ${META.version}`);
  doc.setCreator('wira_chatbot');
  const page = doc.addPage(A4);
  const f = {
    reg: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    ital: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  let y = A4[1] - 42;

  const text = (s, x, yy, { font = f.reg, size = 9, color = INK } = {}) => page.drawText(pdfSafe(s), { x, y: yy, size, font, color });
  const para = (s, { font = f.reg, size = 9 * K, x = M, width = W, lead = 1.25, color = INK } = {}) => {
    for (const ln of wrap(pdfSafe(s), font, size, width)) { y -= size * lead; text(ln, x, y, { font, size, color }); }
  };
  const box = (x, yy, w, h, fill) => page.drawRectangle({ x, y: yy, width: w, height: h, color: fill, borderColor: GRID, borderWidth: 0.6 });
  const tick = (x, yy, on) => {
    page.drawRectangle({ x, y: yy, width: 8, height: 8, borderColor: INK, borderWidth: 0.8 });
    if (on) {
      page.drawLine({ start: { x: x + 1.5, y: yy + 4 }, end: { x: x + 3.5, y: yy + 1.5 }, thickness: 1.4, color: FILL });
      page.drawLine({ start: { x: x + 3.5, y: yy + 1.5 }, end: { x: x + 7.5, y: yy + 7.5 }, thickness: 1.4, color: FILL });
    }
  };
  const header = (s) => {
    y -= 8;
    const h = Math.round(16 * Math.min(1, K + 0.05));
    box(M, y - h, W, h, HEAD_BG);
    text(s, M + 5, y - h + 5, { font: f.bold, size: 8.6 });
    y -= h;
  };
  // A table row: cells = [{label} | {value, ticks, image}] with widths
  const row = (cells, widths, minH = 22) => {
    minH = Math.round(minH * K);
    const size = 8.6 * Math.min(1, K + 0.08);
    const heights = cells.map((c, i) => {
      if (c.label) return wrap(pdfSafe(c.label), f.reg, size, widths[i] - 8).length * 10.5 + 8;
      if (c.value) return wrap(pdfSafe(c.value), f.reg, 9.5, widths[i] - 8).length * 11.5 + 8;
      return 0;
    });
    const h = Math.max(minH, ...heights);
    let x = M;
    cells.forEach((c, i) => {
      const w = widths[i];
      box(x, y - h, w, h, c.label ? LABEL_BG : undefined);
      if (c.label) {
        const lines = wrap(pdfSafe(c.label), f.reg, size, w - 8);
        let ty = y - (h - lines.length * 10.5) / 2 - 8;
        lines.forEach((ln) => { text(ln, x + 4, ty, { size }); ty -= 10.5; });
      } else if (c.value) {
        const lines = wrap(pdfSafe(c.value), f.reg, 9.5, w - 8);
        let ty = y - (h - lines.length * 11.5) / 2 - 8.5;
        lines.forEach((ln) => { text(ln, x + 4, ty, { size: 9.5, color: FILL }); ty -= 11.5; });
      } else if (c.ticks) {
        let tx = x + 5;
        const ty = y - h / 2 - 4;
        const avail = w - 10, n = c.ticks.length;
        let ts = 8.6;
        const need = (sz) => c.ticks.reduce((a, [lab, , after]) => a + 11 + f.reg.widthOfTextAtSize(pdfSafe(lab), sz) + (after != null ? 74 : 0), 0) + (n - 1) * 8;
        while (ts > 6.6 && need(ts) > avail) ts -= 0.2;
        const gap = Math.max(5, Math.min(14, (avail - need(ts) + (n - 1) * 8) / Math.max(1, n - 1)));
        c.ticks.forEach(([lab, on, after]) => {
          tick(tx, ty, on);
          text(lab, tx + 11, ty + 1, { size: ts });
          tx += 11 + f.reg.widthOfTextAtSize(pdfSafe(lab), ts) + 4;
          if (after != null) {
            const aw = Math.max(70, x + w - tx - 6);
            if (after) text(after, tx, ty + 1, { size: 9.5, color: FILL });
            page.drawLine({ start: { x: tx, y: ty - 1 }, end: { x: tx + aw, y: ty - 1 }, thickness: 0.5, color: GRID });
            tx += aw;
          }
          tx += gap - 4;
        });
      } else if (c.image) {
        const pad = 3;
        const maxW = w - 2 * pad, maxH = h - 2 * pad;
        const s = Math.min(maxW / c.image.width, maxH / c.image.height);
        page.drawImage(c.image, { x: x + pad, y: y - h + pad + (maxH - c.image.height * s) / 2, width: c.image.width * s, height: c.image.height * s });
      }
      x += w;
    });
    y -= h;
  };

  const d = data || {};
  const v = (s) => (data ? s : '');
  const on = (cond) => !!data && !!cond;

  // Title
  const tw = f.bold.widthOfTextAtSize(L.title, lang === 'bm' ? 13 : 15);
  text(L.title, (A4[0] - tw) / 2, y, { font: f.bold, size: lang === 'bm' ? 13 : 15 });
  y -= 13;
  const sub = L.subtitle(META.version, META.versionDate[lang]);
  const sw = f.reg.widthOfTextAtSize(sub, 7.6);
  text(sub, (A4[0] - sw) / 2, y, { size: 7.6, color: rgb(0.25, 0.25, 0.25) });
  y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.6, color: GRID });
  y -= 2;
  para(L.intro, { size: 8.6 * Math.min(1, K + 0.06) });
  y -= 2;

  // Section A
  header(L.secA);
  row([{ label: L.fullName }, { value: v((d.fullName || '').toUpperCase()) }], [C4[0], W - C4[0]], 30);
  row([{ label: L.idNo }, { value: v(d.idNo) }, { label: L.dob }, { value: v(d.dobDisplay) }], C4);
  row([{ label: L.mrn }, { value: v(d.mrn) }, { label: L.phone }, { value: v(d.phone) }], C4, 30);
  row([{ label: L.email }, { value: v(d.email) }, { label: L.hospital },
    { ticks: [[L.hosp.UMMC, on(d.hospital === 'UMMC')], [L.hosp.HRPZII, on(d.hospital === 'HRPZII')], [L.hosp.BOTH, on(d.hospital === 'BOTH')]] }],
  [C4[0], C4[1] - 26, C4[2] - 12, C4[3] + 38]);

  // Section B
  y -= 8 * K;
  header(L.secB);
  y -= 14;
  tick(M, y - 1, on(d.requestTick));
  const reqLines = wrap(pdfSafe(L.request), f.bold, 8.8, W - 14);
  reqLines.forEach((ln, i) => text(ln, M + 13, y - i * 11, { font: f.bold, size: 8.8 }));
  y -= (reqLines.length - 1) * 11 + 3;
  para(L.understand, { size: 8.6 * Math.min(1, K + 0.06) });
  for (const b of L.bullets) {
    const bs = 8.6 * Math.min(1, K + 0.06);
    const lines = wrap(pdfSafe(b), f.reg, bs, W - 26);
    lines.forEach((ln, i) => {
      y -= 10.6 * Math.min(1, K + 0.06);
      if (i === 0) page.drawCircle({ x: M + 11, y: y + 3, size: 1.5, color: INK });
      text(ln, M + 22, y, { size: bs });
    });
  }

  // Section C
  y -= 10 * K;
  header(L.secC);
  const rep = on(d.onBehalf);
  row([{ label: L.repName }, { value: rep ? (d.repName || '').toUpperCase() : '' }, { label: L.repId }, { value: rep ? d.repId : '' }], C4);
  row([{ label: L.repRel }, { value: rep ? d.repRelationship : '' }, { label: L.repPhone }, { value: rep ? d.repPhone : '' }], C4);
  row([{ label: L.repReason }, {
    ticks: [[L.reasons.under18, rep && d.repReason === 'under18'], [L.reasons.cannotDecide, rep && d.repReason === 'cannotDecide'],
      [L.reasons.other, rep && d.repReason === 'other', rep && d.repReason === 'other' ? d.repReasonOther : '']],
  }], [C4[0], W - C4[0]], 30);

  // Section D
  y -= 8 * K;
  header(L.secD);
  row([{ label: L.confirmBy }, {
    ticks: [[L.confirm.sms, on(d.confirmBy === 'sms')], [L.confirm.email, on(d.confirmBy === 'email')], [L.confirm.none, on(d.confirmBy === 'none')]],
  }], [C4[0], W - C4[0]]);
  let sigImg = null;
  if (data && d.signaturePng) sigImg = await doc.embedPng(d.signaturePng);
  row([{ label: L.signature }, sigImg ? { image: sigImg } : {}, { label: L.date }, { value: v(d.dateDisplay) }], C4, 40);

  // How to submit / contacts / privacy
  y -= 6;
  const labelled = (bold, rest, color = INK) => {
    const size = 8.6 * Math.min(1, K + 0.06);
    const all = wrap(pdfSafe(bold + ' ' + rest), f.reg, size, W);
    let first = true;
    for (const ln of all) {
      y -= size * 1.28;
      if (first) {
        text(bold, M, y, { font: f.bold, size });
        text(ln.slice(pdfSafe(bold).length), M + f.bold.widthOfTextAtSize(pdfSafe(bold), size) + f.reg.widthOfTextAtSize(' ', size), y, { size, color });
        first = false;
      } else text(ln, M, y, { size, color });
    }
  };
  labelled(L.howTitle, L.how);
  labelled(L.qTitle, L.q);
  y -= 3;
  labelled(L.rightsTitle, L.rights);
  y -= 6;
  para(L.privacy, { font: f.ital, size: 8.2 * Math.min(1, K + 0.06), color: rgb(0.3, 0.3, 0.3) });

  // Office use
  y -= 8 * K;
  header(L.office);
  L.officeRows.forEach((pair, i) => {
    const right = i === 1 ? { ticks: L.channels.map((c, k) => [c, on(k === 2)]) } : i === 0 && data ? {} : {};
    const left = i === 2 ? { ticks: L.yesNo.map((c) => [c, false]) } : i === 0 && data ? { value: d.dateDisplay } : {};
    row([{ label: pair[0] }, left, { label: pair[1] }, right], [C4[0], C4[1] - 30, C4[2], C4[3] + 30], 20);
  });

  // Online submission stamp + footer
  if (data && d.ref) {
    const s = L.online(d.ref, d.submittedDisplay);
    const w = f.bold.widthOfTextAtSize(pdfSafe(s), 7.8);
    page.drawRectangle({ x: (A4[0] - w) / 2 - 6, y: 40, width: w + 12, height: 14, color: rgb(0.92, 0.96, 1), borderColor: LINK, borderWidth: 0.6 });
    text(s, (A4[0] - w) / 2, 44.5, { font: f.bold, size: 7.8, color: LINK });
  }
  const foot = L.footer(META.version);
  text(foot, (A4[0] - f.reg.widthOfTextAtSize(foot, 7)) / 2, 24, { size: 7, color: rgb(0.35, 0.35, 0.35) });

  if (process.env.PDF_DEBUG) console.log('pdf bottom y', Math.round(y));
  if (y < 58) { const e = new Error('form layout overflow: y=' + Math.round(y)); e.overflow = true; throw e; }
  return Buffer.from(await doc.save());
}

// Draw at normal size; if the text does not fit one A4 page, redraw in compact mode.
async function buildFormPdf(data, lang = 'en') {
  for (const K of [1, 0.9, 0.82]) {
    try { return await drawForm(data, lang, K); } catch (e) { if (!e.overflow || K === 0.82) throw e; }
  }
}

module.exports = { buildFormPdf };
