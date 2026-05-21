import {
  ANALYSIS_SYSTEM_PROMPT,
  OPENROUTER_BASE_URL,
  OPENROUTER_MODEL_DEFAULT,
} from "@/lib/constants";
import { openRouterApiKey } from "@/lib/env";

export async function analyzeTranscript(
  transcript: string,
  language: string
): Promise<string> {
  const apiKey = openRouterApiKey();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const userMsg = `[Language: ${language}]\n\nTranscript:\n${transcript}`;

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://audiolens.app",
      "X-Title": "AudioLens",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL_DEFAULT,
      max_tokens: 768,
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
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
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenRouter returned empty analysis.");
  }
  return content;
}
