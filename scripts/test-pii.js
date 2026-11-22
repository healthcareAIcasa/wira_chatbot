'use strict';
// Personal-details screen: must block 100% of identifier patterns (Answer Bank sec. 9)
const { screenPersonal } = require('../public/js/textguard');
const MUST_BLOCK = [
  'My IC is 800101-14-XXXX, please remove me', 'IC saya 800101-14-5566 keluarkan saya', '800101145566',
  'my ic 800101 14 5566', 'My MRN is RN123456', 'MRN saya RN123456', 'medical record no 12345678',
  'no rekod perubatan 567890', 'Call me at 012-XXX XXXX', 'hubungi saya 012-345 6789', '+60123456789',
  '0193456789 call me', 'my number is 03-7949 1234', 'email me at ali.abu@gmail.com', 'ali@yahoo.com.my',
  'I am Ahmad bin Ali with diabetes, opt me out', 'Saya Ahmad bin Ali menghidap diabetes, keluarkan saya',
  'siti binti abdullah nak tarik diri', 'Raju a/l Muthu opt out', 'my name is Jason Tan', 'nama saya Mei Ling',
  'passport A12345678', 'my passport is AB1234567', 'i am Mr Lim, remove my data'
];
const MUST_PASS = [
  'How do I opt out?', 'what data from 2023 to 2025 is used', 'is my IC number used?', 'what is the MREC ref 2026831-17263',
  'research office phone number', 'can I opt out for my mother', 'saya tak nak data saya diguna', 'bila kajian tamat 2029',
  'nombor telefon 014-7072858 tu pejabat ke', 'is my name used in the study', 'what does the AI do', 'I have 2 kids in ward 14u'
];
let fail = 0;
for (const t of MUST_BLOCK) if (!screenPersonal(t)) { fail++; console.log('NOT BLOCKED:', t); }
for (const t of MUST_PASS) if (screenPersonal(t)) { fail++; console.log('WRONGLY BLOCKED:', t); }
console.log(`personal-details screen: blocked ${MUST_BLOCK.length - MUST_BLOCK.filter((t) => !screenPersonal(t)).length}/${MUST_BLOCK.length}; ` +
  `false alarms ${MUST_PASS.filter(screenPersonal).length}/${MUST_PASS.length}`);
process.exitCode = fail ? 1 : 0;
