/* MyWIRA chatbot – text guard (shared by browser and server).
 * 1) screenPersonal(text): rule-based personal-details screen (IC/NRIC, passport, MRN,
 *    phone, email, names). Runs BEFORE any matching. If it fires, the text is discarded.
 * 2) normalize(text): converts to plain ASCII and expands common BM/EN SMS shorthand,
 *    so the matcher sees clean text.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TextGuard = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ALLOWED_NUMBERS = [/2026831\s*-\s*17263/g, /03\s*-\s*7949\s*3209/g, /09\s*-\s*745\s*2636/g, /014\s*-?\s*7072858/g];

  var PERSONAL_PATTERNS = [
    // NRIC: 800101-14-1234, 800101141234, masked 800101-14-XXXX
    /\b\d{6}\s*-?\s*\d{2}\s*-?\s*[\dXx*]{4}\b/,
    // passport: A12345678 / AB1234567
    /\b[A-Za-z]{1,2}\s?\d{7,9}\b/,
    // medical record number keywords followed by an id
    /\b(?:m\.?r\.?n|rn|no\.?\s*rekod|rekod\s*perubatan|medical\s*record)\s*(?:no\.?|number|nombor)?\s*[:#.-]?\s*[A-Za-z]{0,3}\d{4,}/i,
    // Malaysian mobile / landline (allow masked digits): 012-345 6789, +6012..., 03-7949 1234
    /(?:\+?6?0)1\d\s*-?\s*[\dXx*]{3,4}\s*-?\s*[\dXx*]{4}\b/,
    /\b0[3-9]\s*-?\s*\d{3,4}\s*-?\s*\d{4}\b/,
    // any long run of digits (7+), ignoring spaces / dashes inside
    /\d(?:[\s-]?\d){6,}/,
    // email
    /[A-Za-z0-9._%+-]+\s*@\s*[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
    // Malay / Indian naming patterns: "Ahmad bin Ali", "Siti binti ...", "Raju a/l Muthu"
    /\b[A-Za-z]{2,}\s+(?:bin|binti|bt|bte|b\.|a\/l|a\/p|al|ap|anak)\s+[A-Za-z]{2,}/i,
    // "my name is X", "nama saya X", "I am Ahmad" followed by a capitalised word
    /\b(?:my\s+name\s+is|nama\s+(?:saya|aku|sy)\s+(?:ialah\s+|adalah\s+)?)\s*[A-Za-z]{2,}/i,
    /\b(?:i\s+am|i'm|saya|aku)\s+(?:mr\.?|mrs\.?|ms\.?|dr\.?|encik|puan|cik|tuan)\s+[A-Za-z]{2,}/i
  ];

  function screenPersonal(text) {
    var t = String(text || '');
    ALLOWED_NUMBERS.forEach(function (re) { t = t.replace(re, ' '); });
    for (var i = 0; i < PERSONAL_PATTERNS.length; i++) {
      if (PERSONAL_PATTERNS[i].test(t)) return true;
    }
    return false;
  }

  var SHORTHAND = {
    yg: 'yang', x: 'tak', tk: 'tak', tak: 'tak', xnak: 'tak nak', nk: 'nak', sy: 'saya', sye: 'saya',
    aq: 'aku', dgn: 'dengan', utk: 'untuk', mcm: 'macam', camne: 'macam mana', cmne: 'macam mana',
    camana: 'macam mana', mcmana: 'macam mana', mne: 'mana', blh: 'boleh', bole: 'boleh', leh: 'boleh',
    brp: 'berapa', knp: 'kenapa', napa: 'kenapa', sbb: 'sebab', dlm: 'dalam', pd: 'pada', org: 'orang',
    tgk: 'tengok', dpt: 'dapat', jgn: 'jangan', sgt: 'sangat', bg: 'bagi', kt: 'kat', hosp: 'hospital',
    ape: 'apa', pe: 'apa', ni: 'ini', tu: 'itu', dah: 'sudah', da: 'sudah', bkn: 'bukan', klu: 'kalau',
    kalo: 'kalau', klau: 'kalau', mmg: 'memang', sape: 'siapa', spe: 'siapa', bila2: 'bila-bila',
    maklumat2: 'maklumat', u: 'you', ur: 'your', r: 'are', abt: 'about', pls: 'please', plz: 'please',
    info: 'information', wat: 'what', wht: 'what', hw: 'how', y: 'why', dont: "don't", cant: "can't",
    im: "I'm", tq: 'thank you', thx: 'thanks', ok: 'okay'
  };

  var CHAR_MAP = [
    [/[‘’‚‛′`´]/g, "'"],
    [/[“”„‟″]/g, '"'],
    [/[‐-―−]/g, '-'],
    [/…/g, '...'],
    [/[  -​  　]/g, ' ']
  ];

  function toAscii(text) {
    var t = String(text || '');
    CHAR_MAP.forEach(function (p) { t = t.replace(p[0], p[1]); });
    if (t.normalize) t = t.normalize('NFKD').replace(/[̀-ͯ]/g, '');
    t = t.replace(/[^\x20-\x7E]/g, ' ');
    return t.replace(/\s+/g, ' ').trim();
  }

  function normalize(text) {
    var t = toAscii(text).slice(0, 300);
    t = t.replace(/(\w)\1{2,}/g, '$1$1'); // "pleaseeee" -> "pleasee"
    return t.split(' ').map(function (w) {
      var m = /^([^A-Za-z0-9]*)([A-Za-z0-9']+)([^A-Za-z0-9]*)$/.exec(w);
      if (!m) return w;
      var key = m[2].toLowerCase();
      return Object.prototype.hasOwnProperty.call(SHORTHAND, key) ? m[1] + SHORTHAND[key] + m[3] : w;
    }).join(' ');
  }

  return { screenPersonal: screenPersonal, normalize: normalize, toAscii: toAscii };
});
