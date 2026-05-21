# AudioLens App

**Primary product:** cloud web app — upload audio, record your mic, or **capture tab/screen audio** from a video playing on your desktop. Transcribe and analyze on Vercel. **No BlackHole required** for the browser capture path.

Optional **macOS CLI** (`~/audiolens`) remains the advanced path for **unattended live system audio** via BlackHole.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Landing — cloud-first positioning + tab/screen capture |
| `/analyze` | Upload, mic, or desktop/tab capture → transcript + analysis |
| `/dashboard` | Import session JSON history (CLI bridge) |

## Capture paths

| Path | Best for | BlackHole? |
|------|----------|--------------|
| **Browser — file upload** | Recordings, exports, podcasts already saved | No |
| **Browser — microphone** | Voice notes, in-room audio | No |
| **Browser — tab/screen capture** | YouTube, webinars, VLC/QuickTime while playing | No — uses Screen Capture API (`getDisplayMedia`) |
| **macOS CLI** | Live, hands-free system audio loop | Yes — virtual device + Python CLI |

### Browser tab / screen capture (`/analyze`)

1. Click **Capture desktop / tab audio**.
2. In the browser picker, choose:
   - **Chrome tab** — best for YouTube and in-browser video; enable **Share tab audio**.
   - **Window or entire screen** — for VLC, native players; enable **Share system audio** when offered (platform-dependent).
3. Play your video, then click **Stop & analyze** when done.
4. Audio is sent to `POST /api/process-audio` as webm (same pipeline as upload/mic).

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
    │  multipart upload · MediaRecorder (mic) · getDisplayMedia → webm
    ▼
Vercel — POST /api/process-audio
    │  transcribe: OpenAI Whisper API (if OPENAI_API_KEY)
    │           or OpenRouter multimodal (OPENROUTER_API_KEY)
    │  analyze: OpenRouter chat (text only)
    ▼
JSON { transcript, language, analysis }
```

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
| `NEXT_PUBLIC_SITE_URL` | No | Canonical URL for metadata (default `https://audiolens.app`) |

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

## Deploy

Push to `main`; Vercel deploys automatically when the repo is linked. Set env vars before expecting `/analyze` to work in production.

```bash
npx vercel --prod --yes --scope eddiebms-projects
```
