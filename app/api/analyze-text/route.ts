import { analyzeTranscript } from "@/lib/analyze";
import { openRouterApiKey } from "@/lib/env";
import type { AnalyzeTextRequest } from "@/lib/chunk-api";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TRANSCRIPT_CHARS = 120_000;

export async function POST(request: Request) {
  try {
    if (!openRouterApiKey()) {
      return NextResponse.json(
        {
          error:
            "Server misconfiguration: OPENROUTER_API_KEY is required on Vercel.",
        },
        { status: 503 }
      );
    }

    let body: AnalyzeTextRequest;
    try {
      body = (await request.json()) as AnalyzeTextRequest;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const transcript = body.transcript?.trim();
    if (!transcript) {
      return NextResponse.json({ error: "Missing transcript." }, { status: 400 });
    }

    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
      return NextResponse.json(
        {
          error: `Transcript too long for analysis (${transcript.length} chars). Try a shorter recording.`,
        },
        { status: 413 }
      );
    }

    const language = body.language?.trim() || "unknown";
    const { analysis, usage } = await analyzeTranscript(transcript, language, {
      presetId: body.presetId,
      instruction: body.instruction,
    });

    return NextResponse.json({
      analysis,
      language,
      processedAt: new Date().toISOString(),
      usage: {
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed.";
    console.error("[analyze-text]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
