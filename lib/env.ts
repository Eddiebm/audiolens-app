/** Normalize OPENROUTER_API_KEY — Vercel must be sk-or-v1-… only; guards pasted .env lines. */
export function openRouterApiKey(): string {
  const raw = process.env.OPENROUTER_API_KEY;
  if (!raw) return "";

  let key = raw.trim();
  const exportPrefix = /^export\s+OPENROUTER_API_KEY\s*=\s*/i;
  if (exportPrefix.test(key)) {
    key = key.replace(exportPrefix, "");
  }

  key = key.split(/\r?\n/)[0]?.trim() ?? "";

  const secondExport = key.search(/\s+export\s+/i);
  if (secondExport > 0) {
    key = key.slice(0, secondExport).trim();
  }

  if (
    (key.startsWith("'") && key.endsWith("'")) ||
    (key.startsWith('"') && key.endsWith('"'))
  ) {
    key = key.slice(1, -1);
  }

  return key.trim();
}
