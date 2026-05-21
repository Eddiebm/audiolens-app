export type FetchRetryOptions = {
  maxAttempts?: number;
  retryStatuses?: number[];
  baseDelayMs?: number;
};

const DEFAULT_RETRY = [413, 429, 502, 503, 504];

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: FetchRetryOptions = {}
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? 3;
  const retryStatuses = options.retryStatuses ?? DEFAULT_RETRY;
  const baseDelayMs = options.baseDelayMs ?? 800;

  let lastRes: Response | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(input, init);
    lastRes = res;
    if (res.ok || !retryStatuses.includes(res.status)) {
      return res;
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((r) =>
        setTimeout(r, baseDelayMs * Math.pow(2, attempt))
      );
    }
  }
  return lastRes!;
}
