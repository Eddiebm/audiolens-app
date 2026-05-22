import {
  OPENROUTER_BASE_URL,
  OPENROUTER_FAST_MODEL,
  OPENROUTER_MODEL_DEFAULT,
} from "@/lib/constants";
import { parseOpenRouterUsage, type TokenUsage } from "@/lib/cost";
import { openRouterApiKey } from "@/lib/env";
import { presetById } from "@/lib/prompt-presets";
import { SITE_URL } from "@/lib/site";

export type AnalyzeResult = {
  analysis: string;
  usage: TokenUsage;
};

/** Fast listen: one short pass — podcast-style takeaways, no per-section loop. */
export const FAST_LISTEN_SYSTEM_PROMPT = `You are helping someone learn from a podcast or long-form talk they listened to at higher playback speed.

Reply in plain text (no markdown headings). Keep the full response under 300 words.

Structure exactly:
1) Five bullet takeaways (one line each, most important ideas only).
2) Three concrete actions they can take this week (numbered 1–3, specific and doable).

Skip long quotes, timestamps, and section-by-section recap.`;

export async function analyzeTranscript(
  transcript: string,
  language: string,
  options?: { presetId?: string; instruction?: string; fastMode?: boolean }
): Promise<AnalyzeResult> {
  const apiKey = openRouterApiKey();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const fastMode = options?.fastMode === true;
  const preset = presetById(options?.presetId);
  const system = fastMode
    ? FAST_LISTEN_SYSTEM_PROMPT
    : options?.instruction?.trim() || preset.systemPrompt;

  const userMsg = options?.instruction && !fastMode
    ? `${options.instruction}\n\n[Language: ${language}]\n\nTranscript:\n${transcript}`
    : `[Language: ${language}]\n\nTranscript:\n${transcript}`;

  const model = fastMode ? OPENROUTER_FAST_MODEL : OPENROUTER_MODEL_DEFAULT;
  const maxTokens = fastMode ? 1024 : 2048;

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": SITE_URL,
      "X-Title": "AudioLens",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
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
  return {
    analysis: content,
    usage: parseOpenRouterUsage(data) ?? { promptTokens: 0, completionTokens: 0 },
  };
}

export const SECTION_ANALYSIS_INSTRUCTION =
  "Analyze only this section of a longer recording. Focus on this segment's key points; do not repeat a full-recording summary.";

export const HOLISTIC_SUMMARY_INSTRUCTION =
  "Provide a holistic executive summary of the entire recording below. Synthesize themes across all sections in under 250 words.";
