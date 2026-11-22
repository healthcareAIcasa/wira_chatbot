'use strict';
// Sends the completed opt-out form to the Research Office through Brevo's transactional email API.
// https://developers.brevo.com/reference/sendtransacemail
const BREVO_URL = process.env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email'; // override only for local testing

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function summaryRows(f) {
  const hosp = { UMMC: 'UMMC', HRPZII: 'HRPZ II', BOTH: 'Both / Kedua-duanya' }[f.hospital];
  const conf = { sms: 'Telephone / SMS', email: 'Email', none: 'No confirmation needed' }[f.confirmBy];
  const reason = { under18: 'Under 18', cannotDecide: 'Cannot decide for themselves', other: 'Other: ' + (f.repReasonOther || '') }[f.repReason];
  const rows = [
    ['Submission ref', f.ref], ['Submitted', f.submittedDisplay], ['Form language', f.lang === 'bm' ? 'Bahasa Malaysia' : 'English'],
    ['Full name', (f.fullName || '').toUpperCase()], ['IC / passport no.', f.idNo], ['Date of birth', f.dobDisplay],
    ['Medical record no.', f.mrn || '-'], ['Telephone', f.phone], ['Email', f.email || '-'], ['Hospital(s) attended', hosp],
    ['Section B request ticked', f.requestTick ? 'Yes' : 'No'],
    ['Completed on behalf of patient', f.onBehalf ? 'Yes' : 'No'],
  ];
  if (f.onBehalf) {
    rows.push(['Representative name', (f.repName || '').toUpperCase()], ['Representative IC / passport', f.repId],
      ['Relationship to patient', f.repRelationship], ['Representative telephone', f.repPhone], ['Reason patient cannot complete', reason]);
  }
  rows.push(['Send confirmation by', conf], ['Signature', 'Drawn on screen - see attached PDF']);
  return rows;
}

async function sendOptOutEmail(form, pdfBuffer) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) { const e = new Error('BREVO_API_KEY not set'); e.code = 'EMAIL_NOT_CONFIGURED'; throw e; }
  const to = process.env.OPTOUT_TO_EMAIL || 'ummc.wira@gmail.com';
  const from = process.env.SENDER_EMAIL || 'ummc.wira@gmail.com';
  const rows = summaryRows(form);
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
<p><b>MyWIRA Patient Opt-Out Form (online)</b> - new request received.</p>
<p>The completed and signed form is attached as a PDF. Please verify identity, apply the opt-out flag,
and send confirmation within 5 working days (method chosen by the patient is shown below).</p>
<table cellpadding="6" style="border-collapse:collapse;border:1px solid #bbb">${rows.map(([k, v]) =>
    `<tr><td style="border:1px solid #bbb;background:#f2f2f2"><b>${esc(k)}</b></td><td style="border:1px solid #bbb">${esc(v)}</td></tr>`).join('')}</table>
<p style="color:#666;font-size:12px">Sent automatically by wira_chatbot. This submission was not processed by AI and is not stored by the chatbot server.
MREC Ref 2026831-17263.</p></div>`;
  const textBody = 'MyWIRA Patient Opt-Out Form (online)\n\n' + rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
    '\n\nThe completed and signed form is attached as a PDF.';

  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'MyWIRA Opt-Out Form', email: from },
      to: [{ email: to, name: 'MyWIRA Research Office' }],
      subject: `MyWIRA opt-out request ${form.ref}`,
      htmlContent: html,
      textContent: textBody,
      attachment: [{ name: `MyWIRA_OptOut_${form.ref}.pdf`, content: pdfBuffer.toString('base64') }],
      tags: ['mywira-optout'],
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).code || ''; } catch (_) { /* ignore */ }
    const e = new Error(`Brevo responded ${res.status} ${detail}`);
    e.code = 'EMAIL_FAILED';
    throw e;
  }
  return true;
}

module.exports = { sendOptOutEmail, summaryRows };
