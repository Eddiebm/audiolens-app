export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

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

export const ANALYSIS_SYSTEM_PROMPT = `You are analyzing audio that has been transcribed into text.
Provide concise analysis: key claims, context, tone, anything notable.
Stay under 200 words unless the content demands more.
If the transcript is too short or ambiguous, say so briefly.`;
