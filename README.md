# AudioLens App

Web companion for [AudioLens CLI](https://github.com/Eddiebm/audiolens) — live audio intelligence for macOS.

- **Landing** (`/`) — YC-style problem/solution positioning, pipeline, CLI setup
- **Dashboard** (`/dashboard`) — session history via JSON import (localStorage); honest note that capture stays in the CLI

## Run locally

```bash
cd audiolens-app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm start
```

## Environment

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for metadata, sitemap, robots (default `https://audiolens.app`) |

## Architecture (v1)

| Layer | Where |
|-------|--------|
| System audio capture | macOS CLI + BlackHole (`~/audiolens`) |
| Local STT | faster-whisper in CLI |
| Analysis | Anthropic API (text only) |
| History / marketing | This Next.js app |

Browsers cannot capture macOS system audio without a native helper. Do not fake in-browser recording.

## Related repos

- CLI: [github.com/Eddiebm/audiolens](https://github.com/Eddiebm/audiolens) — `python3 main.py` on macOS
- Skill: `~/.claude/skills/audiolens-yc` — YC checklist, growth hooks, CLI setup

## Deploy

### Vercel (recommended)

```bash
cd audiolens-app
npm install
npx vercel          # preview
npx vercel --prod   # production
```

Or link once: `npx vercel link`, then deploy from the Vercel dashboard.

| Variable | When |
|----------|------|
| `NEXT_PUBLIC_SITE_URL` | Production canonical URL (e.g. `https://audiolens.vercel.app` or your custom domain) |

No server secrets required for v1 (dashboard uses local JSON import).

### Architecture

- **macOS CLI** (`audiolens`): BlackHole capture, local Whisper, Claude on transcript text only
- **This app**: landing, docs, session history UI — not a replacement for system audio capture
