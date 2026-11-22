'use strict';
// Regenerates the blank paper Opt-Out Forms (EN and BM) from the same wording the online form uses.
const fs = require('fs');
const path = require('path');
const { buildFormPdf } = require('../lib/pdfForm');
const { META } = require('../lib/formText');
const out = path.join(__dirname, '..', 'forms');
fs.mkdirSync(out, { recursive: true });
(async () => {
  fs.writeFileSync(path.join(out, `MyWIRA_Patient_Opt-Out_Form_${META.version}_EN.pdf`), await buildFormPdf(null, 'en'));
  fs.writeFileSync(path.join(out, `MyWIRA_Borang_Penarikan_Diri_Pesakit_${META.version}_BM.pdf`), await buildFormPdf(null, 'bm'));
  console.log('paper forms written to', out);
})();
