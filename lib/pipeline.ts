export type PipelineStep = {
  id: string;
  title: string;
  summary: string;
  runtime: "macos" | "local" | "cloud" | "web";
  detail: string;
};

/** Cloud-first path (web app primary product) */
export const CLOUD_PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "upload",
    title: "Upload, mic, or tab capture",
    summary:
      "Send mp3, m4a, wav, webm — record your mic, or capture a Chrome tab / screen with shared audio.",
    runtime: "web",
    detail:
      "No BlackHole for the browser path: use Screen Capture API (getDisplayMedia) and enable Share tab audio or Share system audio in the picker. Best on Chrome/Edge desktop.",
  },
  {
    id: "transcribe",
    title: "Cloud transcription",
    summary: "OpenAI Whisper API (if configured) or OpenRouter multimodal audio.",
    runtime: "cloud",
    detail:
      "Audio is processed on the server (Vercel). Set OPENAI_API_KEY for Whisper, or rely on OPENROUTER_API_KEY with a multimodal model.",
  },
  {
    id: "analyze",
    title: "OpenRouter analysis",
    summary: "Only transcript text is sent to your chosen LLM via OpenRouter.",
    runtime: "cloud",
    detail:
      "OPENROUTER_API_KEY stays server-side on Vercel. Default model: anthropic/claude-sonnet-4 (override with OPENROUTER_MODEL).",
  },
  {
    id: "results",
    title: "Transcript + insights",
    summary: "Side-by-side transcript and analysis panels in the web app.",
    runtime: "web",
    detail: "Optional: export session JSON for the dashboard history view.",
  },
];

/** macOS CLI advanced path */
export const CLI_PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "capture",
    title: "System audio capture",
    summary: "BlackHole routes Mac app audio into a virtual input.",
    runtime: "macos",
    detail:
      "Browsers cannot access macOS system audio without a native helper. The CLI uses BlackHole 2ch plus a Multi-Output Device.",
  },
  {
    id: "record",
    title: "Chunked recording",
    summary: "sounddevice records fixed windows from the virtual device.",
    runtime: "macos",
    detail: "Silence is skipped via RMS threshold so Whisper is not called on empty chunks.",
  },
  {
    id: "transcribe-local",
    title: "Local transcription",
    summary: "faster-whisper on CPU — audio never leaves your Mac.",
    runtime: "local",
    detail: "Default model is base with int8. Optional translate-to-English before analysis.",
  },
  {
    id: "analyze-cli",
    title: "Claude / OpenRouter",
    summary: "Only transcript text is sent to the API from the CLI.",
    runtime: "cloud",
    detail: "Rolling context from the last five chunks for live sessions.",
  },
];

/** @deprecated use CLOUD_PIPELINE_STEPS — kept for imports */
export const PIPELINE_STEPS = CLOUD_PIPELINE_STEPS;

export const BRIDGE_ROADMAP = [
  "Session export from cloud analyze → dashboard history",
  "URL / podcast feed ingest (no upload)",
  "Optional meeting-bot path for calendar-linked capture",
  "macOS menu-bar helper syncing CLI JSON to the web app",
] as const;

export const SYSTEM_AUDIO_LIMITATION = `Browsers cannot silently tap macOS system output like BlackHole does. AudioLens web capture uses the **Screen Capture API**: you pick a **Chrome tab** (YouTube, webinars — enable "Share tab audio") or **window/screen** (VLC, native players — enable "Share system audio" when offered). Safari is limited; Chrome/Edge on desktop work best. For unattended **live** system-audio loops without a picker, use the optional macOS CLI + BlackHole.`;
