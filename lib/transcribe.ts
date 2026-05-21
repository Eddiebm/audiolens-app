import {
  OPENROUTER_BASE_URL,
  OPENROUTER_TRANSCRIBE_MODEL,
} from "@/lib/constants";
import { openRouterApiKey } from "@/lib/env";
import { SITE_URL } from "@/lib/site";

export type TranscriptionResult = {
  transcript: string;
  language: string;
  provider: "openai-whisper" | "openrouter";
};

function extensionFromMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("m4a") || mime.includes("mp4")) return "m4a";
  return "mp3";
}

export async function transcribeAudio(
  bytes: ArrayBuffer,
  mimeType: string,
  filename: string
): Promise<TranscriptionResult> {
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return transcribeWithOpenAI(bytes, mimeType, filename, openAiKey);
  }

  const openRouterKey = openRouterApiKey();
  if (!openRouterKey) {
    throw new Error(
      "Set OPENROUTER_API_KEY on Vercel (and optionally OPENAI_API_KEY for Whisper API transcription)."
    );
  }

  return transcribeWithOpenRouter(bytes, mimeType, openRouterKey);
}

async function transcribeWithOpenAI(
  bytes: ArrayBuffer,
  mimeType: string,
  filename: string,
  apiKey: string
): Promise<TranscriptionResult> {
  const blob = new Blob([bytes], { type: mimeType || "application/octet-stream" });
  const form = new FormData();
  form.append("file", blob, filename || `audio.${extensionFromMime(mimeType)}`);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Whisper API failed (${response.status}): ${detail.slice(0, 400)}`);
  }

  const data = (await response.json()) as {
    text?: string;
    language?: string;
  };

  const transcript = (data.text ?? "").trim();
  if (!transcript) {
    throw new Error("Whisper returned an empty transcript.");
  }

  return {
    transcript,
    language: data.language ?? "unknown",
    provider: "openai-whisper",
  };
}

async function transcribeWithOpenRouter(
  bytes: ArrayBuffer,
  mimeType: string,
  apiKey: string
): Promise<TranscriptionResult> {
  const base64 = Buffer.from(bytes).toString("base64");
  const format = extensionFromMime(mimeType);

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": SITE_URL,
      "X-Title": "AudioLens",
    },
    body: JSON.stringify({
      model: OPENROUTER_TRANSCRIBE_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcribe this audio verbatim. Reply with JSON only: {\"transcript\": string, \"language\": string (ISO code or unknown)}. No markdown.",
            },
            {
              type: "input_audio",
              input_audio: { data: base64, format },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `OpenRouter transcription failed (${response.status}): ${detail.slice(0, 400)}`
    );
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
  const parsed = parseTranscriptJson(raw);

  if (!parsed.transcript) {
    throw new Error("OpenRouter returned an empty transcript.");
  }

  return {
    transcript: parsed.transcript,
    language: parsed.language,
    provider: "openrouter",
  };
}

function parseTranscriptJson(raw: string): { transcript: string; language: string } {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? raw).trim();
  try {
    const obj = JSON.parse(candidate) as { transcript?: string; language?: string };
    return {
      transcript: (obj.transcript ?? "").trim(),
      language: (obj.language ?? "unknown").trim() || "unknown",
    };
  } catch {
    return { transcript: raw.trim(), language: "unknown" };
  }
}
