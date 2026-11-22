/* MyWIRA chatbot — browser logic.
 * Every answer shown is looked up by its Answer ID from the approved answer bank, word for word.
 * Typed text is screened for personal details in the browser before anything is sent.
 * No cookies, no local storage.
 */
(function () {
  'use strict';

  var UI = {
    en: {
      title: 'Chatbot – Project MyWIRA', home: 'Main menu', size: 'Text size', send: 'Send',
      placeholder: 'Type your question…',
      qLabel: 'Type your question',
      note: 'Do not type your name, IC, medical record number or health details. Your messages are not saved.',
      loading: 'Typing will be ready in a moment. Please use the buttons meanwhile.',
      offline: 'Typing is not available right now. Please choose a question from the buttons.',
      chooseLang: 'Choose language:', presets: 'Choose a question:', allQ: 'See all questions', menu: 'Main menu',
      didYouMean: 'Did you mean:', none: 'None of these', openForm: 'Open the online Opt-Out Form',
      allTitle: 'All questions', loadErr: 'Sorry, the chatbot could not load. Please refresh the page, or contact the MyWIRA Research Office: 014-7072858, ummc.wira@gmail.com.',
      off: 'The MyWIRA chatbot is temporarily unavailable. The information below is the approved study information.',
      back: 'Back to chatbot', onBehalf: 'I am completing this form on behalf of the patient',
      sigHint: 'Sign with your finger (or mouse) in the box below.', clear: 'Clear', submit: 'Submit opt-out request',
      sending: 'Sending…',
      errFields: 'Please check the highlighted items.',
      errSend: 'Sorry, your form could not be sent. Please try again, or hand a paper form to the research assistant, or email it to ummc.wira@gmail.com.',
      errRate: 'Too many attempts. Please wait a while and try again, or use the paper form.',
      required: 'Required', invalid: 'Please check this entry', sigRequired: 'Please sign in the box',
      emailNeeded: 'Email is needed if you choose confirmation by email',
      doneTitle: 'Your opt-out request has been sent',
      doneBody: 'The MyWIRA Research Office has received your form. If you asked for confirmation, you will receive it within 5 working days.',
      refLabel: 'Submission reference:', doneBack: 'Back to chatbot', formClosed: 'The online form is not available at the moment. Please use the paper form at the research counter, or email ummc.wira@gmail.com.'
    },
    bm: {
      title: 'Chatbot – Projek MyWIRA', home: 'Menu utama', size: 'Saiz teks', send: 'Hantar',
      placeholder: 'Taip soalan anda…',
      qLabel: 'Taip soalan anda',
      note: 'Jangan taip nama, no. IC, no. rekod perubatan atau butiran kesihatan. Mesej anda tidak disimpan.',
      loading: 'Ruangan menaip akan sedia sebentar lagi. Sila gunakan butang dahulu.',
      offline: 'Ruangan menaip tidak tersedia buat masa ini. Sila pilih soalan daripada butang.',
      chooseLang: 'Pilih bahasa:', presets: 'Pilih soalan:', allQ: 'Lihat semua soalan', menu: 'Menu utama',
      didYouMean: 'Adakah maksud anda:', none: 'Tiada yang berkenaan', openForm: 'Buka Borang Pilihan Keluar dalam talian',
      allTitle: 'Semua soalan', loadErr: 'Maaf, chatbot tidak dapat dimuatkan. Sila muat semula halaman, atau hubungi Pejabat Penyelidikan MyWIRA: 014-7072858, ummc.wira@gmail.com.',
      off: 'Chatbot MyWIRA tidak tersedia buat sementara waktu. Maklumat di bawah ialah maklumat kajian yang diluluskan.',
      back: 'Kembali ke chatbot', onBehalf: 'Saya mengisi borang ini bagi pihak pesakit',
      sigHint: 'Tandatangan dengan jari (atau tetikus) di dalam kotak di bawah.', clear: 'Padam', submit: 'Hantar permohonan',
      sending: 'Sedang menghantar…',
      errFields: 'Sila semak ruangan yang ditandakan.',
      errSend: 'Maaf, borang anda tidak dapat dihantar. Sila cuba lagi, atau serahkan borang kertas kepada pembantu penyelidik, atau e-melkan kepada ummc.wira@gmail.com.',
      errRate: 'Terlalu banyak cubaan. Sila tunggu sebentar dan cuba lagi, atau gunakan borang kertas.',
      required: 'Wajib diisi', invalid: 'Sila semak maklumat ini', sigRequired: 'Sila tandatangan di dalam kotak',
      emailNeeded: 'E-mel diperlukan jika anda memilih pengesahan melalui e-mel',
      doneTitle: 'Permohonan anda telah dihantar',
      doneBody: 'Pejabat Penyelidikan MyWIRA telah menerima borang anda. Jika anda memilih untuk menerima pengesahan, anda akan menerimanya dalam tempoh 5 hari bekerja.',
      refLabel: 'Rujukan penghantaran:', doneBack: 'Kembali ke chatbot', formClosed: 'Borang dalam talian tidak tersedia buat masa ini. Sila gunakan borang kertas di kaunter penyelidikan, atau e-mel ke ummc.wira@gmail.com.'
    }
  };

  // Answers that point the patient to the online form get a button to open it.
  var FORM_LINK_AIDS = { F01: 1, F04: 1, F05: 1, S02: 1 };

  var state = { lang: 'bm', cfg: null, sizeStep: 0, busy: false };
  var $ = function (id) { return document.getElementById(id); };
  var chat = $('chat');

  // ---------- language
  function initialLang() {
    var p = new URLSearchParams(location.search).get('lang');
    if (p === 'en' || p === 'bm') return p;
    var n = (navigator.language || '').toLowerCase();
    return /^(ms|id)/.test(n) ? 'bm' : 'en';
  }
  function t(k) { return UI[state.lang][k]; }

  function applyLang() {
    document.documentElement.lang = state.lang === 'bm' ? 'ms' : 'en';
    document.title = t('title');
    $('app-title').textContent = t('title');
    $('btn-home').setAttribute('aria-label', t('home'));
    $('btn-size').setAttribute('aria-label', t('size'));
    $('send').setAttribute('aria-label', t('send'));
    $('q').placeholder = t('placeholder');
    $('q-label').textContent = t('qLabel');
    document.querySelectorAll('.lang-btn').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)); });
    updateComposer();
    if (state.cfg) renderFormText();
  }

  // ---------- helpers to build DOM safely (no innerHTML with data)
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  // Turn emails and full phone numbers into links without changing the approved text.
  function linkify(text) {
    var frag = document.createDocumentFragment();
    var re = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|(\b0\d{1,2}-\d{3,4}\s?\d{4}\b|\b01\d-\d{7,8}\b)|(\b999\b)/g;
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = el('a', null, m[0]);
      a.href = m[1] ? 'mailto:' + m[1] : 'tel:' + m[0].replace(/\D/g, '');
      frag.appendChild(a);
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }
  function scrollDown() { requestAnimationFrame(function () { chat.scrollTop = chat.scrollHeight; }); }
  // Bring a message to the top of the chat area so long answers are read from the start.
  function scrollToEl(node) {
    requestAnimationFrame(function () {
      var top = node.offsetTop - chat.offsetTop - 10;
      if (chat.scrollHeight - top > chat.clientHeight) chat.scrollTop = top; else chat.scrollTop = chat.scrollHeight;
    });
  }
  function add(node) { chat.appendChild(node); return node; }

  function botText(text, extraCls) {
    var m = el('div', 'msg bot' + (extraCls ? ' ' + extraCls : ''));
    m.appendChild(el('p', null, text));
    add(m); scrollToEl(m);
    return m;
  }
  var lastUser = null;
  function userText(text) { lastUser = add(el('div', 'msg user', text)); return lastUser; }

  function qButton(label, onClick, cls) {
    var b = el('button', 'qbtn' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  // ---------- answers (verbatim lookup)
  function answer(aid, opts) {
    opts = opts || {};
    var a = state.cfg.bank.answers[aid];
    if (!a) return;
    var L = a[state.lang];
    var m = el('div', 'msg bot' + (aid === 'S04' ? ' alert' : aid === 'S02' ? ' notice' : ''));
    m.setAttribute('data-aid', aid);
    if (!/^S0[1-6]$/.test(aid)) m.appendChild(el('h3', null, L.t));
    var p = el('p'); p.appendChild(linkify(L.a)); m.appendChild(p);
    m.appendChild(el('div', 'label', state.cfg.label + ' | ' + aid + ' ' + a.v));
    add(m);
    if (!opts.quiet) scrollToEl(lastUser && lastUser.nextSibling === m ? lastUser : m);
    lastUser = null;
    if (FORM_LINK_AIDS[aid] && state.cfg.optOutFormEnabled) {
      var blk = el('div', 'choices-block');
      blk.appendChild(qButton(t('openForm'), openForm, 'primary'));
      add(blk);
    }
    if (!opts.noMenu) afterAnswerMenu();
  }

  function askPreset(aid, label) {
    userText(label);
    answer(aid);
  }

  function afterAnswerMenu() {
    var blk = el('div', 'choices-block');
    var chips = el('div', 'chips');
    state.cfg.bank.quick[state.lang].forEach(function (q) {
      chips.appendChild(qButton(q.label, function () { askPreset(q.aid, q.label); }, 'small'));
    });
    chips.appendChild(qButton(t('allQ'), showAll, 'small'));
    blk.appendChild(chips);
    add(blk);
  }

  function logos() {
    var d = el('div', 'logos');
    var a = el('img', 'logo-um'); a.src = '/img/ummc_ppum_logo.jpg'; a.alt = 'Universiti Malaya – Pusat Perubatan Universiti Malaya';
    var b = el('img', 'logo-hrpz'); b.src = '/img/hrpz_logo.jpg'; b.alt = 'Hospital Raja Perempuan Zainab II';
    d.appendChild(a); d.appendChild(b);
    return d;
  }

  // append = true: add the greeting menu below the conversation (after a fallback) instead of starting over
  function greeting(append) {
    var cfg = state.cfg;
    if (!append) { chat.innerHTML = ''; add(logos()); }
    if (!cfg.chatbotEnabled) {
      add(el('div', 'msg bot notice', t('off')));
      ['A01', 'F01', 'G01', 'G02'].forEach(function (aid) { answer(aid, { noMenu: true, quiet: true }); });
      chat.scrollTop = 0;
      return;
    }
    answer('S06', { noMenu: true, quiet: true });
    var s06 = chat.lastChild;
    var lp = el('div', 'choices-block' + (append ? ' hidden' : ''));
    lp.appendChild(el('p', 'choices-title', t('chooseLang')));
    var g = el('div', 'lang-pick');
    g.appendChild(qButton('Bahasa Malaysia', function () { setLang('bm'); }, state.lang === 'bm' ? 'primary' : ''));
    g.appendChild(qButton('English', function () { setLang('en'); }, state.lang === 'en' ? 'primary' : ''));
    lp.appendChild(g);
    add(lp);
    var blk = el('div', 'choices-block');
    blk.appendChild(el('p', 'choices-title', t('presets')));
    cfg.bank.buttons[state.lang].forEach(function (b) {
      blk.appendChild(qButton(b.label, function () { askPreset(b.aid, b.label); }));
    });
    blk.appendChild(qButton(t('allQ'), showAll, 'small'));
    add(blk);
    if (append) scrollToEl(s06.previousSibling || s06); else requestAnimationFrame(function () { chat.scrollTop = 0; });
  }

  function showAll() {
    var blk = el('div', 'choices-block');
    var h = el('p', 'choices-title', t('allTitle'));
    blk.appendChild(h);
    var cats = state.cfg.bank.categories;
    Object.keys(cats).forEach(function (c) {
      var d = el('details', 'cat');
      d.appendChild(el('summary', null, cats[c][state.lang]));
      var list = el('div', 'list');
      Object.keys(state.cfg.bank.answers).filter(function (aid) { return aid.charAt(0) === c; }).forEach(function (aid) {
        var label = state.cfg.bank.answers[aid][state.lang].t;
        list.appendChild(qButton(label, function () { askPreset(aid, label); }, 'small'));
      });
      d.appendChild(list);
      blk.appendChild(d);
    });
    add(blk); scrollToEl(blk);
  }

  function suggestions(aids) {
    var m = el('div', 'choices-block');
    m.appendChild(el('p', 'choices-title', t('didYouMean')));
    aids.forEach(function (aid) {
      var label = state.cfg.bank.answers[aid][state.lang].t;
      m.appendChild(qButton(label, function () { answer(aid); }));
    });
    m.appendChild(qButton(t('none'), function () { answer('S01', { noMenu: true }); greeting(true); }, 'small'));
    add(m); scrollToEl(lastUser || m); lastUser = null;
  }

  // ---------- free text
  function updateComposer() {
    var cfg = state.cfg, q = $('q'), note = $('composer-note');
    var on = !!(cfg && cfg.chatbotEnabled && cfg.freeText);
    q.disabled = !on || state.busy; $('send').disabled = !on || state.busy;
    $('composer').classList.toggle('hidden', !!(cfg && !cfg.chatbotEnabled));
    note.classList.toggle('hidden', !!(cfg && !cfg.chatbotEnabled));
    note.textContent = !cfg ? '' : on ? t('note') : cfg.freeTextLoading ? t('loading') : t('offline');
  }

  function typing() {
    var d = el('div', 'typing'); d.setAttribute('aria-hidden', 'true');
    d.appendChild(el('i')); d.appendChild(el('i')); d.appendChild(el('i'));
    return add(d);
  }

  function submitQuestion(e) {
    e.preventDefault();
    var q = $('q');
    var text = q.value.trim();
    if (!text || state.busy) return;
    q.value = ''; autoGrow();
    // Personal-details screen BEFORE anything leaves the phone. The text is discarded and not shown.
    if (window.TextGuard.screenPersonal(text)) { answer('S02'); return; }
    userText(text);
    state.busy = true; updateComposer();
    var dots = typing(); scrollDown();
    fetch('/api/match', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: text, lang: state.lang }) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        dots.remove();
        if (d.kind === 'answer') answer(d.aid);
        else if (d.kind === 'suggest') suggestions(d.suggestions);
        else { answer('S01', { noMenu: true }); greeting(true); }
      })
      .catch(function () {
        dots.remove();
        state.cfg.freeText = false;
        botText(t('offline'), 'notice');
        afterAnswerMenu();
      })
      .then(function () { state.busy = false; updateComposer(); if (state.cfg.freeText) q.focus(); });
  }

  function autoGrow() { var q = $('q'); q.style.height = 'auto'; q.style.height = Math.min(q.scrollHeight, 128) + 'px'; }

  // ---------- opt-out form
  var sigPad = null;
  function get(obj, path) { return path.split('.').reduce(function (o, k) { return o && o[k]; }, obj); }

  function renderFormText() {
    var F = state.cfg.form[state.lang];
    $('form-title').textContent = F.title.replace(/\s*\|\s*/, ' – ');
    $('form-sub').textContent = F.subtitle;
    $('form-intro').textContent = F.intro;
    ['secA', 'secB', 'secC', 'secD'].forEach(function (k) { $(k).textContent = F[k]; });
    document.querySelectorAll('[data-t]').forEach(function (n) { var v = get(F, n.getAttribute('data-t')); if (typeof v === 'string') n.textContent = v; });
    var ul = $('bullets'); ul.innerHTML = '';
    F.bullets.forEach(function (b) { ul.appendChild(el('li', null, b)); });
    $('onBehalf-label').textContent = t('onBehalf');
    $('sig-hint').textContent = t('sigHint');
    $('sig-clear').textContent = t('clear');
    $('submit').textContent = t('submit');
    $('back-label').textContent = t('back');
    $('done-back').textContent = t('doneBack');
    $('done-title').textContent = t('doneTitle');
    $('done-body').textContent = t('doneBody');
    $('done-ref-label').textContent = t('refLabel');
    var now = new Date();
    $('today').textContent = now.toLocaleDateString(state.lang === 'bm' ? 'ms-MY' : 'en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' });
    $('dob').max = new Date(now.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
  }

  function showView(name) {
    $('view-chat').classList.toggle('hidden', name !== 'chat');
    $('view-form').classList.toggle('hidden', name !== 'form');
    if (name === 'form') {
      if (!sigPad) {
        sigPad = new window.SignaturePad($('sig'));
        $('sig-clear').addEventListener('click', function () { sigPad.clear(); });
      }
      requestAnimationFrame(function () { sigPad.resize(); });
      $('view-form').scrollTop = 0;
      $('form-title').focus && $('form-title').setAttribute('tabindex', '-1');
    }
  }
  function openForm() {
    if (!state.cfg.optOutFormEnabled) { botText(t('formClosed'), 'notice'); return; }
    if (location.hash !== '#optout') history.pushState(null, '', '#optout');
    showView('form');
  }
  function route() { showView(location.hash === '#optout' || location.pathname === '/optout' ? 'form' : 'chat'); }

  function clearErrors() {
    document.querySelectorAll('#optout .err').forEach(function (n) { n.remove(); });
    document.querySelectorAll('#optout .invalid').forEach(function (n) { n.classList.remove('invalid'); });
    document.querySelectorAll('#optout [aria-invalid]').forEach(function (n) { n.removeAttribute('aria-invalid'); });
    $('form-error').classList.add('hidden');
  }
  function markError(name, msg) {
    var target = $('grp-' + name) || ($(name) && $(name).closest('.field')) || $(name);
    if (!target) return null;
    target.classList.add('invalid');
    var input = $(name); if (input) input.setAttribute('aria-invalid', 'true');
    var p = el('p', 'err', msg); p.id = 'err-' + name;
    target.appendChild(p);
    if (input) input.setAttribute('aria-describedby', p.id);
    return target;
  }

  function collect() {
    var f = $('optout');
    var val = function (n) { return (f.elements[n] && f.elements[n].value || '').trim(); };
    var radio = function (n) { var c = f.querySelector('input[name="' + n + '"]:checked'); return c ? c.value : ''; };
    return {
      lang: state.lang, website: val('website'),
      fullName: val('fullName'), idNo: val('idNo'), dob: val('dob'), mrn: val('mrn'), phone: val('phone'), email: val('email'),
      hospital: radio('hospital'), requestTick: $('requestTick').checked, onBehalf: $('onBehalf').checked,
      repName: val('repName'), repId: val('repId'), repRelationship: val('repRelationship'), repPhone: val('repPhone'),
      repReason: radio('repReason'), repReasonOther: val('repReasonOther'), confirmBy: radio('confirmBy')
    };
  }

  function validate(d) {
    var errs = {};
    var phoneOk = function (s) { return /^\+?[\d\s-]{8,20}$/.test(s) && s.replace(/\D/g, '').length >= 8; };
    var idOk = function (s) { return /^[A-Za-z0-9\s/-]{5,20}$/.test(s); };
    if (d.fullName.length < 2) errs.fullName = t('required');
    if (!idOk(d.idNo)) errs.idNo = d.idNo ? t('invalid') : t('required');
    if (!d.dob) errs.dob = t('required');
    if (!phoneOk(d.phone)) errs.phone = d.phone ? t('invalid') : t('required');
    if (d.email && !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(d.email)) errs.email = t('invalid');
    if (!d.hospital) errs.hospital = t('required');
    if (!d.requestTick) errs.requestTick = t('required');
    if (d.onBehalf) {
      if (d.repName.length < 2) errs.repName = t('required');
      if (!idOk(d.repId)) errs.repId = d.repId ? t('invalid') : t('required');
      if (d.repRelationship.length < 2) errs.repRelationship = t('required');
      if (!phoneOk(d.repPhone)) errs.repPhone = d.repPhone ? t('invalid') : t('required');
      if (!d.repReason) errs.repReason = t('required');
      if (d.repReason === 'other' && d.repReasonOther.length < 2) errs.repReason = t('required');
    }
    if (!d.confirmBy) errs.confirmBy = t('required');
    if (d.confirmBy === 'email' && !d.email) errs.email = t('emailNeeded');
    if (!sigPad || sigPad.isEmpty()) errs.signature = t('sigRequired');
    return errs;
  }

  function showErrors(errs) {
    var first = null;
    Object.keys(errs).forEach(function (k) { var n = markError(k, errs[k]); if (n && !first) first = n; });
    var box = $('form-error'); box.textContent = t('errFields'); box.classList.remove('hidden');
    if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); var i = first.querySelector('input,canvas'); if (i && i.focus) setTimeout(function () { i.focus({ preventScroll: true }); }, 300); }
  }

  function submitForm(e) {
    e.preventDefault();
    clearErrors();
    var d = collect();
    var errs = validate(d);
    if (Object.keys(errs).length) { showErrors(errs); return; }
    d.signature = sigPad.toPNG();
    var btn = $('submit'); btn.disabled = true; btn.textContent = t('sending');
    fetch('/api/optout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (res) {
        if (res.status === 200 && res.body.ok) {
          $('optout').classList.add('hidden');
          $('done-ref').textContent = res.body.ref;
          $('done').classList.remove('hidden');
          $('view-form').scrollTop = 0;
          $('done').focus({ preventScroll: true });
          $('optout').reset(); sigPad.clear(); $('rep').classList.add('hidden');
        } else if (res.status === 400 && res.body.fields) {
          var errs2 = {}; res.body.fields.forEach(function (f) { errs2[f] = f === 'signature' ? t('sigRequired') : t('invalid'); });
          showErrors(errs2);
        } else {
          var box = $('form-error'); box.textContent = res.status === 429 ? t('errRate') : t('errSend'); box.classList.remove('hidden');
          box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      })
      .catch(function () { var box = $('form-error'); box.textContent = t('errSend'); box.classList.remove('hidden'); })
      .then(function () { btn.disabled = false; btn.textContent = t('submit'); });
  }

  // ---------- wiring
  function setLang(l) {
    if (l === state.lang) return;
    state.lang = l; applyLang();
    if ($('view-chat').classList.contains('hidden')) return;
    greeting();
  }

  function init() {
    state.lang = initialLang();
    applyLang();
    document.querySelectorAll('.lang-btn').forEach(function (b) { b.addEventListener('click', function () { setLang(b.dataset.lang); }); });
    $('btn-home').addEventListener('click', function () { if (location.hash) history.pushState(null, '', location.pathname.replace('/optout', '/') + location.search); showView('chat'); greeting(); });
    $('btn-size').addEventListener('click', function () {
      state.sizeStep = (state.sizeStep + 1) % 3;
      document.documentElement.className = state.sizeStep ? 'fs-' + state.sizeStep : '';
      if (sigPad) sigPad.resize();
    });
    $('composer').addEventListener('submit', submitQuestion);
    $('q').addEventListener('input', autoGrow);
    $('q').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('composer').requestSubmit ? $('composer').requestSubmit() : submitQuestion(e); } });
    $('btn-back').addEventListener('click', function () { history.pushState(null, '', location.pathname.replace('/optout', '/') + location.search); showView('chat'); });
    $('done-back').addEventListener('click', function () { $('done').classList.add('hidden'); $('optout').classList.remove('hidden'); history.pushState(null, '', '/' + location.search); showView('chat'); scrollDown(); });
    $('onBehalf').addEventListener('change', function () { $('rep').classList.toggle('hidden', !this.checked); });
    document.querySelectorAll('input[name="repReason"]').forEach(function (r) {
      r.addEventListener('change', function () { $('repReasonOther').classList.toggle('hidden', r.value !== 'other' || !r.checked); });
    });
    $('optout').addEventListener('submit', submitForm);
    // Clear an error as soon as the patient fixes that item
    function clearFor(node) {
      var g = node && node.closest('.invalid');
      if (!g) return;
      g.classList.remove('invalid');
      g.querySelectorAll('.err').forEach(function (e) { e.remove(); });
      g.querySelectorAll('[aria-invalid]').forEach(function (e) { e.removeAttribute('aria-invalid'); });
      if (!document.querySelector('#optout .invalid')) $('form-error').classList.add('hidden');
    }
    $('optout').addEventListener('input', function (e) { clearFor(e.target); });
    $('optout').addEventListener('change', function (e) { clearFor(e.target); });
    $('sig').addEventListener('signature-change', function () { clearFor($('sig')); });
    window.addEventListener('popstate', route);

    fetch('/api/config').then(function (r) { return r.json(); }).then(function (cfg) {
      state.cfg = cfg;
      applyLang();
      greeting();
      route();
      if (cfg.freeTextLoading) pollReady(0);
    }).catch(function () { botText(UI[state.lang].loadErr, 'alert'); });
  }

  function pollReady(n) {
    if (n > 30) return;
    setTimeout(function () {
      fetch('/api/config').then(function (r) { return r.json(); }).then(function (cfg) {
        state.cfg.freeText = cfg.freeText; state.cfg.freeTextLoading = cfg.freeTextLoading;
        updateComposer();
        if (cfg.freeTextLoading) pollReady(n + 1);
      }).catch(function () { pollReady(n + 1); });
    }, 4000);
  }

  init();
})();
