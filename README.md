# AudioLens App

**Primary product:** cloud web app — upload audio, record your mic, or **capture tab/screen audio** from a video playing on your desktop. Transcribe and analyze on Vercel. **No BlackHole required** for the browser capture path.

Optional **macOS CLI** (`~/audiolens`) remains the advanced path for **unattended live system audio** via BlackHole.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Landing — cloud-first positioning + tab/screen capture |
| `/youtube` | **Tab-only** capture for YouTube / in-browser video (no mic, no upload); optional **Fast listen** (1.5×–2× playback tip, single-pass analysis) |
| `/analyze` | Upload, mic, or desktop/tab capture → transcript + analysis |
| `/dashboard` | Import session JSON history (CLI bridge) |

## Features

- **Read aloud** — after analysis on `/analyze` and `/youtube`, use **Read summary**, **Read full analysis**, or **Read transcript** (browser Web Speech API; pause/stop and speed 0.9×–1.1×). macOS CLI users can also `say -f exported.txt` on saved text.

## Capture paths

| Path | Best for | BlackHole? |
|------|----------|--------------|
| **Browser — file upload** | Recordings, exports, podcasts already saved | No |
| **Browser — microphone** | Voice notes, in-room audio | No |
| **Browser — tab/screen capture** | YouTube, webinars, VLC/QuickTime while playing | No — uses Screen Capture API (`getDisplayMedia`) |
| **macOS CLI** | Live, hands-free system audio loop | Yes — virtual device + Python CLI |

### YouTube / isolated tab capture (`/youtube`)

**Goal:** only the selected browser tab’s audio — no microphone, no room noise, no Entire Screen / Window system-audio mix.

1. Open the video in a **Chrome or Edge tab**.
2. Click **Test tab audio (5s)** or **Capture YouTube tab**.
3. In the picker, choose **Chrome tab** (this tab) and enable **Share tab audio**.
4. **Do not** pick **Entire screen** or **Window** — AudioLens checks `displaySurface` on the capture track and **rejects** non-tab shares with an error (other apps and system sounds are included in those modes).
5. `preferCurrentTab: true` is requested when supported (Chrome `CaptureController`); the picker may still list screen options — wrong choices are rejected after selection, not silently accepted.

**Limitation:** browsers cannot hide screen/window options in the OS picker; enforcement is post-selection via `MediaStreamTrack.getSettings().displaySurface === 'browser'`.

### Browser tab / screen capture (`/analyze`)

1. Click **Capture desktop / tab audio**.
2. In the browser picker, choose:
   - **Chrome tab** — best for YouTube and in-browser video; enable **Share tab audio**.
   - **Window or entire screen** — for VLC, native players; enable **Share system audio** when offered (platform-dependent).
3. Play your video, then click **Stop & analyze** when done.
4. Audio is recorded in **~75s segments**, each sent to `POST /api/process-audio-chunk`, then the combined transcript goes to `POST /api/analyze-text` (text only — avoids oversized requests).

**Browser notes:** Chrome and Edge on desktop are most reliable. Safari has limited display-audio support. If no audio track is shared, the app prompts you to re-share with audio enabled. Cancelling the picker shows a friendly message (`NotAllowedError`).

### macOS CLI (optional, advanced)

Live **system audio** without a browser picker — BlackHole routes everything on the Mac:

```bash
cd ~/audiolens
./setup.sh
export OPENROUTER_API_KEY='...'
python3 main.py
```

## Honest platform limitation

Browsers cannot silently mirror macOS system output like BlackHole. The **web capture path** requires you to pick a tab/window and explicitly share audio in the OS/browser dialog. For always-on live capture of all system audio, use the CLI + BlackHole path above.

## Architecture (cloud path)

```
Browser (any OS)
    │  small file → multipart POST /api/process-audio (≤3 MB)
    │  long capture / large file → split client-side (~75s or ≤2 MB raw per chunk)
    ▼
Vercel — POST /api/process-audio-chunk  (per segment, maxDuration 60s)
    │  transcribe: OpenAI Whisper API (if OPENAI_API_KEY)
    │           or OpenRouter multimodal (OPENROUTER_API_KEY)
    ▼
Client accumulates transcript text
    ▼
Vercel — POST /api/analyze-text  (full transcript, text-only JSON)
    │  analyze: OpenRouter chat
    ▼
JSON { transcript, language, analysis }
```

### Long audio / Vercel Hobby limits

| Constraint | Hobby (typical) | Notes |
|------------|-----------------|-------|
| Request body | ~4.5 MB | Chunks capped at **2 MB raw** (~2.7 MB base64 JSON) |
| Function duration | 60s default (`maxDuration` on API routes) | One ~75s chunk per invocation |
| Practical length | **~30–60 min** tab capture | ~24–48 sequential chunk requests; slower but avoids 413 / JSON parse errors |
| Large file upload | Up to **~12 MB** in-browser split | Bigger files: use tab capture or trim first |
| Analysis | 120k chars max transcript | Very dense speech may need shorter clips |

**Pro:** raise `maxDuration` to 300 on chunk routes in `app/api/process-audio-chunk/route.ts` if your plan allows longer serverless runs.

| Layer | Where |
|-------|--------|
| Capture (cloud) | File upload, browser mic, or tab/screen audio via Screen Capture API |
| Transcription | OpenAI `whisper-1` **or** OpenRouter audio model (server) |
| Analysis | OpenRouter LLM on transcript text only |
| API keys | **Server-only** Vercel env vars — never exposed to the client |

## Environment variables (Vercel)

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENROUTER_API_KEY` | **Yes** | Analysis (and transcription fallback via multimodal model) |
| `OPENROUTER_MODEL` | No | Analysis model (default `anthropic/claude-sonnet-4`) |
| `OPENROUTER_TRANSCRIBE_MODEL` | No | Multimodal transcribe model if no OpenAI key (default `google/gemini-2.5-flash`) |
| `OPENAI_API_KEY` | No | Preferred transcription via OpenAI Whisper API |
| `NEXT_PUBLIC_SITE_URL` | No | Canonical URL for metadata (default `https://audiolens-app.vercel.app`) |

### Vercel setup

1. Link project: `vercel link` (or import `Eddiebm/audiolens-app` in the dashboard).
2. **Settings → Environment Variables** → add `OPENROUTER_API_KEY` for Production (and Preview if desired).
3. Optional: add `OPENAI_API_KEY` for higher-quality Whisper transcription.
4. Redeploy after changing env vars.

Do **not** commit API keys. Do not use `NEXT_PUBLIC_` for secrets.

## Run locally

```bash
cd audiolens-app
npm install
export OPENROUTER_API_KEY='your-key'
# optional: export OPENAI_API_KEY='your-key'
npm run dev
```

Open [http://localhost:3000/analyze](http://localhost:3000/analyze). Tab capture requires **localhost or HTTPS** and a supporting browser (Chrome/Edge recommended).

## Build

```bash
npm run build
npm start
```

## Related repos

- CLI: `~/audiolens` — BlackHole + local faster-whisper + live chunks
- This app: `audiolens-app` — cloud-first companion on Vercel

## Production URL

**Live app:** [https://audiolens-app.vercel.app/analyze](https://audiolens-app.vercel.app/analyze)

`audiolens.app` is not wired to Vercel yet (DNS does not resolve). To use a custom domain after you own it:

1. Vercel → **audiolens-app** → **Settings → Domains** → add `audiolens.app` (and `www` if needed).
2. At your registrar, point nameservers to Vercel or add the DNS records Vercel shows (apex often needs Vercel DNS or A `76.76.21.21`).
3. Set `NEXT_PUBLIC_SITE_URL=https://audiolens.app` in Vercel env vars and redeploy.

## Deploy

Push to `main`; Vercel deploys automatically when the repo is linked. Set env vars before expecting `/analyze` to work in production.

```bash
npx vercel --prod --yes --scope eddiebms-projects
```
