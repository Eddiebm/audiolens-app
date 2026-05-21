export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
};

/** Rough OpenRouter-style pricing (USD per 1M tokens) — disclaimer only */
const INPUT_PER_M = 3;
const OUTPUT_PER_M = 15;

export function estimateCostUsd(usage: TokenUsage): number {
  return (
    (usage.promptTokens / 1_000_000) * INPUT_PER_M +
    (usage.completionTokens / 1_000_000) * OUTPUT_PER_M
  );
}

/** ~4 chars per token for English transcript */
export function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4);
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

export const EMPTY_USAGE: TokenUsage = { promptTokens: 0, completionTokens: 0 };
