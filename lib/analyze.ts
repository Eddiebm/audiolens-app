import {
  OPENROUTER_BASE_URL,
  OPENROUTER_MODEL_DEFAULT,
} from "@/lib/constants";
import type { TokenUsage } from "@/lib/cost-estimate";
import { openRouterApiKey } from "@/lib/env";
import { presetById } from "@/lib/prompt-presets";
import { SITE_URL } from "@/lib/site";

export type AnalyzeResult = {
  analysis: string;
  usage: TokenUsage;
};

function parseUsage(data: {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}): TokenUsage {
  const u = data.usage;
  return {
    promptTokens: u?.prompt_tokens ?? 0,
    completionTokens: u?.completion_tokens ?? 0,
  };
}

export async function analyzeTranscript(
  transcript: string,
  language: string,
  options?: { presetId?: string; instruction?: string }
): Promise<AnalyzeResult> {
  const apiKey = openRouterApiKey();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const preset = presetById(options?.presetId);
  const system = options?.instruction?.trim() || preset.systemPrompt;

  const userMsg = options?.instruction
    ? `${options.instruction}\n\n[Language: ${language}]\n\nTranscript:\n${transcript}`
    : `[Language: ${language}]\n\nTranscript:\n${transcript}`;

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": SITE_URL,
      "X-Title": "AudioLens",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL_DEFAULT,
      max_tokens: 2048,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `OpenRouter analysis failed (${response.status}): ${detail.slice(0, 400)}`
    );
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenRouter returned empty analysis.");
  }
  return { analysis: content, usage: parseUsage(data) };
}

export const SECTION_ANALYSIS_INSTRUCTION =
  "Analyze only this section of a longer recording. Focus on this segment's key points; do not repeat a full-recording summary.";

export const HOLISTIC_SUMMARY_INSTRUCTION =
  "Provide a holistic executive summary of the entire recording below. Synthesize themes across all sections in under 250 words.";
