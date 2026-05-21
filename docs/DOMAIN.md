# Custom domain: audiolens.app

This guide wires **audiolens.app** (or your domain) to the Vercel project for `audiolens-app`. AudioLens does not purchase domains for you.

## Prerequisites

- Vercel project linked to this repo (`audiolens-app`)
- DNS access at your registrar (or Cloudflare, etc.)
- Production env var set after the domain is live

## 1. Add domain in Vercel

1. Open [Vercel Dashboard](https://vercel.com) → your **audiolens-app** project.
2. **Settings** → **Domains**.
3. Add `audiolens.app` and `www.audiolens.app` (recommended).
4. Vercel shows required DNS records (usually one of):
   - **A** record → `76.76.21.21`
   - **CNAME** for `www` → `cname.vercel-dns.com`

Follow the exact values Vercel displays for your account.

## 2. Configure DNS at registrar

| Host | Type | Value |
|------|------|--------|
| `@` | A | `76.76.21.21` (or Vercel’s current apex IP) |
| `www` | CNAME | `cname.vercel-dns.com` |

If using Cloudflare, set proxy status per your preference (orange cloud is fine for Next.js).

Wait for propagation (minutes to 48h). Vercel shows **Valid** when ready.

## 3. Redirect www → apex (optional)

In Vercel **Domains**, set primary domain to `audiolens.app` and redirect `www` to apex (or the reverse — pick one canonical URL).

## 4. Environment variables

In Vercel **Settings** → **Environment Variables** (Production):

```bash
NEXT_PUBLIC_SITE_URL=https://audiolens.app
```

Redeploy after changing this so metadata, sitemap, and OpenRouter `HTTP-Referer` use the correct origin.

Other required vars (unchanged):

- `OPENROUTER_API_KEY` — required for cloud transcription/analysis
- `OPENAI_API_KEY` — optional; Whisper API if set

Pull locally for dev:

```bash
vercel env pull .env.local
```

## 5. Verify

```bash
curl -sI https://audiolens.app | head -5
```

Open `/youtube` and `/dashboard` on the live domain.

## 6. SSL

Vercel provisions Let’s Encrypt automatically once DNS validates. No manual cert step.

## Troubleshooting

- **Invalid configuration** — DNS not propagated; use `dig audiolens.app` / Vercel’s DNS checker.
- **Wrong sitemap URLs** — confirm `NEXT_PUBLIC_SITE_URL` and redeploy.
- **OpenRouter 403** — referer must match a URL allowed in your OpenRouter app settings; add `https://audiolens.app`.
