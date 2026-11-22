'use strict';
// Server-side validation of the online opt-out form (mirrors the checks in the browser).
const clean = (s, max = 120) => String(s == null ? '' : s).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function fmtDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function malaysiaNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date()).reduce((a, p) => ({ ...a, [p.type]: p.value }), {});
  return { date: `${parts.day}/${parts.month}/${parts.year}`, stamp: `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute} (MYT)`, ymd: `${parts.year}${parts.month}${parts.day}`, iso: `${parts.year}-${parts.month}-${parts.day}` };
}

const PHONE = /^\+?[\d\s-]{8,20}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[A-Za-z]{2,}$/;
const ID = /^[A-Za-z0-9\s/-]{5,20}$/;

function validateOptOut(body) {
  const errors = [];
  const b = body || {};
  const f = {
    lang: b.lang === 'bm' ? 'bm' : 'en',
    fullName: clean(b.fullName, 120),
    idNo: clean(b.idNo, 20).toUpperCase(),
    dob: clean(b.dob, 10),
    mrn: clean(b.mrn, 20).toUpperCase(),
    phone: clean(b.phone, 20),
    email: clean(b.email, 254),
    hospital: ['UMMC', 'HRPZII', 'BOTH'].includes(b.hospital) ? b.hospital : '',
    requestTick: b.requestTick === true,
    onBehalf: b.onBehalf === true,
    repName: clean(b.repName, 120), repId: clean(b.repId, 20).toUpperCase(), repRelationship: clean(b.repRelationship, 60),
    repPhone: clean(b.repPhone, 20),
    repReason: ['under18', 'cannotDecide', 'other'].includes(b.repReason) ? b.repReason : '',
    repReasonOther: clean(b.repReasonOther, 80),
    confirmBy: ['sms', 'email', 'none'].includes(b.confirmBy) ? b.confirmBy : '',
  };
  if (f.fullName.length < 2) errors.push('fullName');
  if (!ID.test(f.idNo)) errors.push('idNo');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.dob)) errors.push('dob');
  else {
    const t = Date.parse(f.dob + 'T00:00:00Z');
    if (Number.isNaN(t) || t > Date.now() || f.dob < '1900-01-01') errors.push('dob');
  }
  if (f.mrn && !/^[A-Z0-9\s/-]{2,20}$/.test(f.mrn)) errors.push('mrn');
  if (!PHONE.test(f.phone) || f.phone.replace(/\D/g, '').length < 8) errors.push('phone');
  if (f.email && !EMAIL.test(f.email)) errors.push('email');
  if (!f.hospital) errors.push('hospital');
  if (!f.requestTick) errors.push('requestTick');
  if (f.onBehalf) {
    if (f.repName.length < 2) errors.push('repName');
    if (!ID.test(f.repId)) errors.push('repId');
    if (f.repRelationship.length < 2) errors.push('repRelationship');
    if (!PHONE.test(f.repPhone) || f.repPhone.replace(/\D/g, '').length < 8) errors.push('repPhone');
    if (!f.repReason) errors.push('repReason');
    if (f.repReason === 'other' && f.repReasonOther.length < 2) errors.push('repReasonOther');
  }
  if (!f.confirmBy) errors.push('confirmBy');
  if (f.confirmBy === 'email' && !f.email) errors.push('email');

  // Signature: PNG data URL drawn on the canvas
  const sig = String(b.signature || '');
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(sig);
  let png = null;
  if (m && m[1].length < 700000) {
    png = Buffer.from(m[1], 'base64');
    if (png.length < 100 || png.readUInt32BE(0) !== 0x89504e47) png = null;
  }
  if (!png) errors.push('signature');
  if (b.blankSignature === true) errors.push('signature');

  const now = malaysiaNow();
  f.signaturePng = png;
  f.dobDisplay = /^\d{4}-\d{2}-\d{2}$/.test(f.dob) ? fmtDate(f.dob) : '';
  f.dateDisplay = now.date;
  f.submittedDisplay = now.stamp;
  f.ymd = now.ymd;
  return { ok: errors.length === 0, errors: [...new Set(errors)], form: f };
}

module.exports = { validateOptOut, malaysiaNow };
