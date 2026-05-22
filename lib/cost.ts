/**
 * OpenRouter cost helpers — actual usage when the API returns `usage`,
 * otherwise char-based token estimates.
 */

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
};

export type CostAccuracy = "actual" | "estimated";

/** Rough OpenRouter-style pricing (USD per 1M tokens) — not a bill. */
export const INPUT_USD_PER_M = 3;
export const OUTPUT_USD_PER_M = 15;

export type OpenRouterUsageRaw = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type SessionCostBreakdown = {
  transcriptTokensEstimate: number;
  transcribeCostUsd: number;
  transcribeAccuracy: CostAccuracy;
  analysisCostUsd: number;
  analysisAccuracy: CostAccuracy;
  sessionTotalUsd: number;
  sessionAccuracy: CostAccuracy;
  analysisUsage: TokenUsage;
  transcribeUsage: TokenUsage;
};

export const EMPTY_USAGE: TokenUsage = { promptTokens: 0, completionTokens: 0 };

/**
 * Parse OpenRouter `usage` from chat completion JSON.
 * Returns null when the field is missing (caller should fall back to estimates).
 */
export function parseOpenRouterUsage(data: {
  usage?: OpenRouterUsageRaw;
}): TokenUsage | null {
  const u = data.usage;
  if (!u) return null;
  const prompt = u.prompt_tokens ?? 0;
  const completion = u.completion_tokens ?? 0;
  if (prompt === 0 && completion === 0 && !u.total_tokens) return null;
  return { promptTokens: prompt, completionTokens: completion };
}

/**
 * Fallback when API omits usage:
 *   tokens ≈ ceil(character_count / 4)  (English-heavy text)
 *   cost  = (promptTokens / 1e6) * INPUT_USD_PER_M
 *         + (completionTokens / 1e6) * OUTPUT_USD_PER_M
 */
export function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateUsageFromText(
  text: string,
  role: "prompt" | "completion"
): TokenUsage {
  const tokens = estimateTokensFromText(text);
  return role === "prompt"
    ? { promptTokens: tokens, completionTokens: 0 }
    : { promptTokens: 0, completionTokens: tokens };
}

export function estimateCostUsd(usage: TokenUsage): number {
  return (
    (usage.promptTokens / 1_000_000) * INPUT_USD_PER_M +
    (usage.completionTokens / 1_000_000) * OUTPUT_USD_PER_M
  );
}

export function formatCostUsd(amount: number): string {
  if (amount < 0.01) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(2)}`;
}

export function mergeUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
  };
}

export function usageWithAccuracy(
  fromApi: TokenUsage | null | undefined,
  fallbackText: string,
  fallbackRole: "prompt" | "completion" = "completion"
): { usage: TokenUsage; accuracy: CostAccuracy } {
  if (fromApi && (fromApi.promptTokens > 0 || fromApi.completionTokens > 0)) {
    return { usage: fromApi, accuracy: "actual" };
  }
  if (fromApi) {
    return { usage: fromApi, accuracy: "actual" };
  }
  return {
    usage: estimateUsageFromText(fallbackText, fallbackRole),
    accuracy: "estimated",
  };
}

export function combineAccuracy(
  parts: CostAccuracy[]
): CostAccuracy {
  return parts.every((p) => p === "actual") ? "actual" : "estimated";
}

export function buildSessionCost(input: {
  transcript: string;
  analysisText: string;
  analysisUsage?: TokenUsage | null;
  transcribeUsage?: TokenUsage | null;
  /** Extra transcribe-side text counted as prompt (e.g. chunk labels) */
  transcribePromptFallback?: string;
}): SessionCostBreakdown {
  const transcriptTokensEstimate = estimateTokensFromText(input.transcript);

  const transcribe = usageWithAccuracy(
    input.transcribeUsage,
    input.transcribePromptFallback?.trim()
      ? `${input.transcribePromptFallback}\n${input.transcript}`
      : input.transcript,
    "prompt"
  );
  const analysis = usageWithAccuracy(
    input.analysisUsage,
    input.analysisText,
    "completion"
  );

  const transcribeCostUsd = estimateCostUsd(transcribe.usage);
  const analysisCostUsd = estimateCostUsd(analysis.usage);
  const sessionAccuracy = combineAccuracy([
    transcribe.accuracy,
    analysis.accuracy,
  ]);

  return {
    transcriptTokensEstimate,
    transcribeCostUsd,
    transcribeAccuracy: transcribe.accuracy,
    analysisCostUsd,
    analysisAccuracy: analysis.accuracy,
    sessionTotalUsd: transcribeCostUsd + analysisCostUsd,
    sessionAccuracy,
    analysisUsage: analysis.usage,
    transcribeUsage: transcribe.usage,
  };
}
