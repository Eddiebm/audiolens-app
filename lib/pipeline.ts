export type PipelineStep = {
  id: string;
  title: string;
  summary: string;
  runtime: "macos" | "local" | "cloud" | "web";
  detail: string;
};

export const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "capture",
    title: "System audio capture",
    summary: "BlackHole routes Mac app audio into a virtual input.",
    runtime: "macos",
    detail:
      "Browsers cannot access system audio on macOS. AudioLens uses BlackHole 2ch plus a Multi-Output Device so you hear audio and capture it at the same time.",
  },
  {
    id: "record",
    title: "Chunked recording",
    summary: "sounddevice records fixed windows (default 8s) from the virtual device.",
    runtime: "macos",
    detail:
      "Silence is skipped via RMS threshold so Whisper is not called on empty chunks.",
  },
  {
    id: "transcribe",
    title: "Local transcription",
    summary: "faster-whisper on CPU — audio never leaves your machine.",
    runtime: "local",
    detail:
      "Default model is base with int8. Optional translate-to-English task before analysis.",
  },
  {
    id: "analyze",
    title: "Claude analysis",
    summary: "Only transcript text is sent to the Anthropic API.",
    runtime: "cloud",
    detail:
      "Rolling context from the last five chunks keeps analysis coherent across a live session.",
  },
  {
    id: "surface",
    title: "Web dashboard (v1)",
    summary: "History, setup docs, and session import — capture stays in the CLI.",
    runtime: "web",
    detail:
      "v1 bridge: export or paste session JSON from the CLI into the dashboard. Native sync and menu-bar app are on the roadmap.",
  },
];

export const BRIDGE_ROADMAP = [
  "CLI flag to append chunks to a local JSON file",
  "Menu-bar helper that watches the export file",
  "Optional Electron/Tauri shell wrapping the same Python core",
] as const;
