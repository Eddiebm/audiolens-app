/**
 * Parse POST /api/process-audio responses without throwing on plain-text Vercel errors (e.g. 413).
 */
export async function parseProcessAudioResponse<T extends { error?: string }>(
  res: Response
): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (!contentType.includes("application/json")) {
    const trimmed = text.trim();
    if (
      res.status === 413 ||
      /request entity too large/i.test(trimmed)
    ) {
      throw new Error(
        "Upload failed (payload too large). Long captures are split automatically on the Analyze page — retry or use shorter segments."
      );
    }
    const preview = trimmed.slice(0, 120);
    throw new Error(
      preview || `Server returned an unexpected response (${res.status}).`
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from server (${res.status}).`);
  }
}
