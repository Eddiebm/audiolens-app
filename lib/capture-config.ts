/** Safety cap for tab/mic capture (2 hours) — chunking handles upload size */
export const MAX_RECORD_MS = 2 * 60 * 60 * 1000;

/** RMS below this counts as silence (0–1 float from Analyser) */
export const DEFAULT_SILENCE_RMS_THRESHOLD = 0.008;

/** Continuous silence duration before auto-stop (ms) */
export const DEFAULT_SILENCE_AUTO_STOP_MS = 50_000;

/** Pre-flight test capture duration (ms) */
export const PREFLIGHT_TEST_MS = 5_000;

/** ~10 minutes of speech at ~150 wpm ≈ 9000 chars */
export const SECTION_CHARS = 9_000;
