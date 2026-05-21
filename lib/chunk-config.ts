/** ~2 MB raw audio keeps JSON+base64 under Vercel Hobby ~4.5 MB body limit */
export const MAX_CHUNK_RAW_BYTES = 2 * 1024 * 1024;

/** Single-shot upload without client chunking */
export const SINGLE_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;

/** Target segment length when grouping recorder slices or decoding uploads */
export const CHUNK_TARGET_SECONDS = 75;

/** MediaRecorder timeslice for tab/mic — one blob ≈ one upload chunk */
export const RECORDER_TIMESLICE_MS = CHUNK_TARGET_SECONDS * 1000;

/** Skip full-file decode splitting above this (browser memory) */
export const CLIENT_DECODE_MAX_BYTES = 12 * 1024 * 1024;
