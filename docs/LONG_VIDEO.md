# Long video pipeline

AudioLens handles long captures (YouTube, lectures) without a single huge upload.

## Client

- **Tab capture**: `MediaRecorder` with ~75s timeslices → one blob per chunk.
- **Upload**: Each chunk POSTs to `/api/process-audio-chunk` as base64 JSON (under ~2 MB raw per chunk).
- **Retries**: `fetchWithRetry` retries 413, 429, 502, 503, 504 with backoff.
- **Auto-stop**: Web Audio RMS silence ~50s ends capture when the video finishes.
- **Safety cap**: 2 hours max recording (`MAX_RECORD_MS`).

## Server (Vercel Hobby)

- Route `maxDuration = 60` seconds per chunk/analysis request.
- Body limit: keep chunks under `MAX_CHUNK_RAW_BYTES` (2 MB).

## Analysis

1. Transcribe all chunks in order.
2. Merge transcript.
3. Split into ~10 min sections (`SECTION_CHARS`).
4. Per-section analysis via `/api/analyze-text`.
5. Holistic executive summary on full transcript.

## Pro / scale options

If a single request still times out:

1. **Vercel Pro** — raise `maxDuration` in `vercel.json` or per-route `export const maxDuration = 300`.
2. **Vercel Blob** — optional path for very large raw uploads (not required when chunking works).
3. **Queue** — move chunk transcription to a background job (Inngest, Workflow DevKit) for 2h+ live streams.

Current production path prioritizes **chunk robustness** over Blob upload.
