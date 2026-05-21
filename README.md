# AudioLens App

**Primary product:** cloud web app — upload or record audio, transcribe and analyze on Vercel. **No BlackHole, no local Whisper, no Python CLI on your machine.**

Optional **macOS CLI** (`~/audiolens`) remains the advanced path for **live system audio** capture via BlackHole.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Landing — cloud-first positioning + honest system-audio note |
| `/analyze` | Upload mp3/m4a/wav/webm or record mic → transcript + analysis |
| `/dashboard` | Import session JSON history (CLI bridge) |

## Honest platform limitation

**Full macOS system audio capture cannot run 100% in the browser or on Vercel alone.**

Browsers cannot tap “everything playing on your speakers” without one of:

1. **A local agent** — BlackHole + AudioLens CLI (or future Electron/Tauri helper)
2. **Different input** — file upload, URL/podcast ingest (roadmap), or **browser microphone** (not system audio)
3. **A meeting bot** — joins the call in the cloud (roadmap)

The **upload / mic record** path is intentionally **computer-independent**: processing runs on the server; your laptop only sends a file or mic audio.

## Architecture (cloud path)

```
Browser (any OS)
    │  multipart upload or MediaRecorder webm
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
| Capture (cloud) | User file upload or browser mic |
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

Open [http://localhost:3000/analyze](http://localhost:3000/analyze).

## Build

```bash
npm run build
npm start
```

## macOS CLI (optional, advanced)

Live **system audio** on Mac only:

```bash
cd ~/audiolens
./setup.sh
export OPENROUTER_API_KEY='...'
python3 main.py
```

Keys can live in `~/.audiolens.env` on the Mac; the **web app** uses Vercel env vars only.

## Related repos

- CLI: `~/audiolens` — BlackHole + local faster-whisper + live chunks
- This app: `audiolens-app` — cloud-first companion on Vercel

## Deploy

Push to `main`; Vercel deploys automatically when the repo is linked. Set env vars before expecting `/analyze` to work in production.
