'use strict';
// Makes print-ready QR codes for the posters:  npm run qr -- https://your-service.onrender.com
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const base = (process.argv[2] || '').replace(/\/+$/, '');
if (!/^https:\/\//.test(base)) { console.error('Usage: npm run qr -- https://<your official address>'); process.exit(1); }
const out = path.join(__dirname, '..', 'qr');
fs.mkdirSync(out, { recursive: true });
const targets = { 'MyWIRA_QR_BM': base + '/?lang=bm', 'MyWIRA_QR_EN': base + '/?lang=en', 'MyWIRA_QR_OptOutForm': base + '/?lang=bm#optout' };
(async () => {
  for (const [name, url] of Object.entries(targets)) {
    await QRCode.toFile(path.join(out, name + '.png'), url, { errorCorrectionLevel: 'M', width: 1200, margin: 4 });
    await QRCode.toFile(path.join(out, name + '.svg'), url, { type: 'svg', errorCorrectionLevel: 'M', margin: 4 });
    console.log(name, '->', url);
  }
  console.log('saved in', out);
})();
