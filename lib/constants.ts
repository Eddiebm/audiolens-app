import { SINGLE_UPLOAD_MAX_BYTES } from "@/lib/chunk-config";

/** Single-shot multipart upload; larger files use client chunking + JSON routes */
export const MAX_UPLOAD_BYTES = SINGLE_UPLOAD_MAX_BYTES;

export const ACCEPTED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/webm",
  "audio/x-wav",
]);

export const ACCEPTED_EXTENSIONS = [".mp3", ".m4a", ".wav", ".webm", ".mpeg", ".mp4"];

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const OPENROUTER_MODEL_DEFAULT =
  process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4";

export const OPENROUTER_TRANSCRIBE_MODEL =
  process.env.OPENROUTER_TRANSCRIBE_MODEL ?? "google/gemini-2.5-flash";

import { ANALYSIS_PRESETS } from "@/lib/prompt-presets";

export const ANALYSIS_SYSTEM_PROMPT = ANALYSIS_PRESETS[0].systemPrompt;
