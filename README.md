# wira_chatbot – MyWIRA patient information chatbot and online opt-out form

A web page patients open by scanning a QR code at UMMC or HRPZ II. Nothing is installed: it is not an Android or iOS app. The layout adjusts to the screen of any phone, tablet or computer.

- **Chatbot:** shows the MREC-approved answers (Answer Bank v1.1, English and Bahasa Malaysia) word for word. Patients can tap the 7 preset questions, browse all 30 questions, or type their own.
- **Online Opt-Out Form:** has the same sections as the paper form (A–D) and a finger-drawn signature. On **Submit**, the server fills in the v1.1 form as a PDF and emails it to **ummc.wira@gmail.com** through Brevo.

## How it works

| Step | What happens |
|---|---|
| Patient types a question | **Personal-details screen** runs in the phone's browser first (IC/NRIC, passport, MRN, phone, email, names). If it finds any, the text is thrown away, never sent, and answer **S02** is shown. |
| Clean text | Sent to the server, which runs the check again, then the **matcher** picks an Answer ID (AID). |
| Matcher | Small sentence model (multilingual-e5-small, trimmed, 52 MB, runs inside the app) + a tiny classifier trained on the approved example questions. It **only chooses an AID; it cannot write text**. Out-of-scope questions → S01; unsure → "Did you mean…" (up to 3 approved questions); urgent words → S04; greetings → S06. |
| Answer shown | Looked up from `data/answers.json` verbatim, with the label `MyWIRA | MREC Ref 2026831-17263 | Answer Bank v1.1 | <AID> <version>`. |
| Opt-out form | Checked in the browser and again on the server → PDF made in memory → emailed via Brevo → patient sees a submission reference. Nothing is stored on the server. |

Memory use on the server is about 310 MB, under the 512 MB of Render's free plan.

## Deploy (Claude Code → GitHub → Render)

### 1. Brevo (email)
1. Sign up at brevo.com with **ummc.wira@gmail.com**. The free plan allows 300 emails a day.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: `ummc.wira@gmail.com`, then click the verification link Brevo emails you.
3. **SMTP & API → API Keys → Generate a new API key**. Copy it; you will paste it into Render. Never put it in the code or in GitHub.

### 2. GitHub
Create a **private** repository named `wira_chatbot` and push this folder. From Claude Code on your computer, in this folder:
```
git init && git add . && git commit -m "wira_chatbot v1.1"
git branch -M main
git remote add origin https://github.com/<your-account>/wira_chatbot.git
git push -u origin main
```
The model file `models/wira-e5-small-ascii/onnx/model_quantized.onnx` is 52 MB. GitHub shows a "large file" warning for files over 50 MB but accepts them; no Git LFS is needed.

### 3. Render
1. **New → Blueprint**, pick the `wira_chatbot` repo. Render reads `render.yaml`: free plan, Singapore region, `npm ci`, `npm start`, health check `/healthz`.
2. When asked, paste the Brevo key into **BREVO_API_KEY**.
3. Deploy. Your address will be something like `https://wira-chatbot.onrender.com`.

(Manual alternative: **New → Web Service**, runtime Node, build `npm ci`, start `npm start`, then add the environment variables listed below.)

### 4. Check it, then make the QR codes
1. Open the address on your phone. Ask a few questions, then send a **test** opt-out form.
2. Check ummc.wira@gmail.com, **including Spam**. Because the email is sent through Brevo "from" a Gmail address, Gmail may file it as spam the first time. If so, mark it **Not spam** and add a filter: *from: ummc.wira@gmail.com, subject: "MyWIRA opt-out request"* → **Never send to spam**.
3. Make the QR codes: `npm install && npm run qr -- https://<your address>`. This writes PNG and SVG files to `qr/`: a BM poster code, an EN poster code, and a code that opens the opt-out form directly.

## Settings (Render → Environment)

| Variable | Default | Purpose |
|---|---|---|
| `BREVO_API_KEY` | – | Brevo API key (required for the form) |
| `SENDER_EMAIL` | ummc.wira@gmail.com | Verified sender in Brevo |
| `OPTOUT_TO_EMAIL` | ummc.wira@gmail.com | Where completed forms go |
| `CHATBOT_ENABLED` | true | **Kill switch.** `false` = page shows only the approved notice and contacts |
| `FREE_TEXT_ENABLED` | true | `false` = buttons and full question menu only (fail-safe mode) |
| `OPTOUT_FORM_ENABLED` | true | `false` = online form hidden; paper and email routes still shown |

If the matcher cannot load, the page automatically falls back to buttons only.

## Changing an answer (after MREC approval)
1. Edit the text in `data/answers.json` and update `version` for that AID and `meta.bankVersion`.
2. `npm run build`: re-embeds the example questions and retrains the classifier into `data/embeddings.json`.
3. `npm test`: must pass.
4. Commit and push; Render redeploys automatically.

`data/match_config.json` holds extra configuration example questions and keywords for matching. It is never shown to patients.

## Tests (`npm test`)

| Test | Result | Target (Answer Bank sec. 9) |
|---|---|---|
| Personal-details screen | 24/24 blocked, 0/12 false alarms | 100% blocked |
| Matching, test set 1 (204 new EN/BM phrasings) | 96.6% correct top match; 0% wrong answer shown directly; 98.5% reach the right answer directly or with one tap | ≥ 90% |
| Matching, test set 2 (102 fresh phrasings incl. typos and mixed EN/BM) | 91.2% correct top match; 1% wrong answer shown directly; 94.1% reach the right answer | ≥ 90% |
| Off-topic questions | 19/20 → fallback or "other hospital matters"; 1 → "Did you mean" | – |

These sets were written by the developer. Formal acceptance needs at least 10 new phrasings per answer from people who did not build the system (sec. 9).

## Privacy and logging
- No login, no cookies, no local storage, no database.
- Typed questions and form contents are never written to logs or disk. The server log only records start-up and error types.
- The form PDF is created in memory, emailed, and discarded.
- The rate limiter keeps a hashed IP in memory for up to an hour (abuse protection).
- See `docs/CHANGES_v1.1.md` for DPO points: Brevo (EU) and Gmail process the form data.

## Model provenance
`models/wira-e5-small-ascii` is **intfloat/multilingual-e5-small** (MIT licence), in the quantized ONNX version by **Xenova/multilingual-e5-small**. Its vocabulary is trimmed by `scripts/trim_model.py` to the 83,008 pieces made of printable ASCII characters. For English and Malay typed in the Latin alphabet the output is identical to the original model, and memory falls from ~480 MB to ~280 MB.

The source file used here was obtained from an npm mirror package (Hugging Face was not reachable from the build environment), SHA-256 `f80102d3…c193`; see `MODEL_CARD.json`. To confirm it, on a computer with internet access:
```
pip install onnx numpy huggingface_hub
huggingface-cli download Xenova/multilingual-e5-small config.json tokenizer.json tokenizer_config.json special_tokens_map.json onnx/model_quantized.onnx --local-dir src_model
sha256sum src_model/onnx/model_quantized.onnx   # compare with source_sha256 in MODEL_CARD.json
python3 scripts/trim_model.py src_model models/wira-e5-small-ascii
```
If the hashes match, nothing changes. If they differ, run `npm run build && npm test` and commit the result.

## Render free plan notes
- The service sleeps after about 15 minutes without visitors. The first scan after that takes roughly 30–60 seconds to load; after that it is instant. A paid instance (Starter) stays awake.
- Typing becomes available a few seconds after the page loads while the model warms up. Until then the buttons work.
