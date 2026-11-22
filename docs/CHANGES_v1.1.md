# MyWIRA chatbot – changes from v1.0 (for the MREC amendment)

Prepared 20 November 2026 with the wira_chatbot build. Every change to patient-facing wording needs MREC approval before the app is used with patients (Answer Bank v1.0, section 10, change control).

## 1. Answer bank v1.0 → v1.1 (answers whose wording changed)

What changed: research email ummc.mina → **ummc.wira@gmail.com**; Research Office phone **014-7072858** added; confirmation time **5 working days** (it was 7 in F02, 5 in section 8); a leftover "[MREC contact]" placeholder removed from English G02. All other answers are unchanged from v1.0, word for word.

### F01 (English)

- **v1.0:** You can: (1) fill in the paper Opt-Out Form at the research counter, (2) email the form to ummc.mina@gmail.com, or (3) use the online Opt-Out Form linked below. A research assistant at the counter can help you. You do not need to give a reason.
- **v1.1:** You can: (1) fill in the paper Opt-Out Form at the research counter, (2) email the form to ummc.wira@gmail.com, or (3) use the online Opt-Out Form linked below. A research assistant at the counter can help you. You do not need to give a reason.

### F01 (Bahasa Malaysia)

- **v1.0:** Anda boleh (1) mengisi Borang Pilihan Keluar di kaunter penyelidikan, (2) menghantar borang melalui e-mel ke ummc.mina@gmail.com, atau (3) menggunakan borang dalam talian melalui pautan di bawah. Pembantu penyelidik di kaunter boleh membantu anda. Anda tidak perlu memberikan sebab.
- **v1.1:** Anda boleh (1) mengisi Borang Pilihan Keluar di kaunter penyelidikan, (2) menghantar borang melalui e-mel ke ummc.wira@gmail.com, atau (3) menggunakan borang dalam talian melalui pautan di bawah. Pembantu penyelidik di kaunter boleh membantu anda. Anda tidak perlu memberikan sebab.

### F02 (English)

- **v1.0:** Information from your hospital visits will be removed from the research data from the date your request is processed. The system will not make bed suggestions for you; staff use the normal process. You will receive SMS confirmation within 7 working days.
- **v1.1:** Information from your hospital visits will be removed from the research data from the date your request is processed. The system will not make bed suggestions for you; staff use the normal process. You will receive SMS confirmation within 5 working days.

### F02 (Bahasa Malaysia)

- **v1.0:** Maklumat lawatan hospital anda dikecualikan daripada data penyelidikan mulai tarikh permohonan diproses. Sistem tidak akan mencadangkan katil untuk anda; kakitangan menggunakan prosedur biasa. Anda akan menerima pengesahan SMS dalam tempoh tujuh hari bekerja.
- **v1.1:** Maklumat lawatan hospital anda dikecualikan daripada data penyelidikan mulai tarikh permohonan diproses. Sistem tidak akan mencadangkan katil untuk anda; kakitangan menggunakan prosedur biasa. Anda akan menerima pengesahan SMS dalam tempoh lima hari bekerja.

### G01 (English)

- **v1.0:** MyWIRA Research Office: [phone], ummc.mina@gmail.com, reception/ward 9am-5pm MON-FRI. The same contacts serve UMMC and HRPZ II. A research assistant at the counter can answer your questions in person.
- **v1.1:** MyWIRA Research Office: 014-7072858, ummc.wira@gmail.com, reception/ward 9am-5pm MON-FRI. The same contacts serve UMMC and HRPZ II. A research assistant at the counter can answer your questions in person.

### G01 (Bahasa Malaysia)

- **v1.0:** Pejabat Penyelidikan MyWIRA: [telefon], ummc.mina@gmail.com, kaunter pendaftaran/wad, 9 pagi hingga 5 petang, Isnin–Jumaat. Maklumat hubungan yang sama digunakan untuk PPUM dan HRPZ II. Pembantu penyelidik di kaunter boleh menjawab soalan anda secara bersemuka.
- **v1.1:** Pejabat Penyelidikan MyWIRA: 014-7072858, ummc.wira@gmail.com, kaunter pendaftaran/wad, 9 pagi hingga 5 petang, Isnin–Jumaat. Maklumat hubungan yang sama digunakan untuk PPUM dan HRPZ II. Pembantu penyelidik di kaunter boleh menjawab soalan anda secara bersemuka.

### G02 (English)

- **v1.0:** If you have a concern about this study or your rights, you may contact the Medical Research and Ethics Committee at 03-7949 3209 / 8473 / 4656; ummc-mrec@ummc.edu.my; or Pusat Penyelidikan Klinikal HRPZ II (CRC): 09-745 2636; crckelantan@gmail.com [MREC contact]. Both are independent of the research team.
- **v1.1:** If you have a concern about this study or your rights, you may contact the Medical Research and Ethics Committee at 03-7949 3209 / 8473 / 4656; ummc-mrec@ummc.edu.my; or Pusat Penyelidikan Klinikal HRPZ II (CRC): 09-745 2636; crckelantan@gmail.com. Both are independent of the research team.

## 2. Opt-Out Form v1.0 → v1.1 (EN and BM)

- "How to submit" and "If there are questions" now give **ummc.wira@gmail.com**, and the questions line adds **014-7072858**.
- Version line: "Form v1.1, 20 November 2026".
- The online form uses the same wording as the paper form, section by section. The PDF the Research Office receives carries an "Submitted online via the MyWIRA chatbot | Submission ref …" stamp, and "Online" is pre-ticked under Channel.
- Blank v1.1 paper forms are in `forms/`.

## 3. Points found in the v1.0 documents (not changed – for the investigators to decide)

1. **50-word limit:** English E01 has 64 words; English A05 has 51.
2. **English C05 grammar:** "does not processed by AI" should be "is not processed by AI".
3. **E02 meaning differs:** English says the study "is approved"; BM says "dinyatakan sebagai diluluskan" (stated as approved).
4. **F02 says "SMS confirmation"**, but the form lets the patient choose telephone/SMS, email or no confirmation.
5. **Section 7 of the answer bank** says "What is logged: Nothing" but then describes aggregate counts. This app logs nothing about questions or forms.
6. **Mock-up welcome text** ("Your participation helps us…", "timing … only") is not in the answer bank and conflicts with the neutral-wording rule and with B01. The app uses the approved greeting S06 instead.

## 4. Governance items for the DPO (online form collects identifiers)

- Form submissions go from the app → **Brevo** (email service, EU-based) → the **Gmail** inbox ummc.wira@gmail.com. Neither is a hospital-controlled server, and both process identifiers (name, IC, phone, signature) outside Malaysia. Answer bank section 8 says hosting the online form needs DPO approval.
- The app runs on **Render, Singapore region** (the answer bank prefers a Malaysian data region).
- The chatbot server stores nothing: no database, no cookies, no logs of typed text or form contents. A rate limiter keeps a hashed IP address in memory for up to one hour.
