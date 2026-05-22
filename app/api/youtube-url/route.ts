import { runLongAnalysis } from "@/lib/analyze-long";
import { buildSessionCost, EMPTY_USAGE } from "@/lib/cost";
import { openRouterApiKey } from "@/lib/env";
import type { YoutubeUrlRequest } from "@/lib/chunk-api";
import { presetById } from "@/lib/prompt-presets";
import type { AnalysisPresetId } from "@/lib/prompt-presets";
import {
  fetchYoutubeCaptions,
  YoutubeCaptionsUnavailableError,
} from "@/lib/youtube-captions";
import { validateYoutubeUrl } from "@/lib/youtube-url";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    let body: YoutubeUrlRequest;
    try {
      body = (await request.json()) as YoutubeUrlRequest;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const url = body.url?.trim();
    if (!url) {
      return NextResponse.json({ error: "Missing url." }, { status: 400 });
    }

    const validated = validateYoutubeUrl(url);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const presetId = (body.presetId?.trim() || "default") as AnalysisPresetId;
    presetById(presetId);
    const fastMode = body.fastMode === true;

    let captions;
    try {
      captions = await fetchYoutubeCaptions(url);
    } catch (err) {
      if (err instanceof YoutubeCaptionsUnavailableError) {
        return NextResponse.json(
          {
            error: err.message,
            hint: err.hint,
            code: "no_captions",
          },
          { status: 422 }
        );
      }
      throw err;
    }

    const { transcript, language } = captions;
    const long = await runLongAnalysis(
      transcript,
      language,
      presetId,
      fastMode
    );

    const analysisText = fastMode
      ? long.analysis
      : [
          long.analysis,
          long.summary !== long.analysis ? long.summary : "",
          ...long.sections.map((s) => s.analysis),
        ]
          .filter(Boolean)
          .join("\n");

    const cost = buildSessionCost({
      transcript,
      analysisText,
      analysisUsage: long.usage,
      transcribeUsage: EMPTY_USAGE,
    });

    return NextResponse.json({
      transcript,
      language,
      analysis: long.analysis,
      summary: long.summary,
      sections: long.sections.length ? long.sections : undefined,
      fastListen: fastMode || undefined,
      transcriptionProvider: "youtube-captions",
      processedAt: new Date().toISOString(),
      tokenUsage: long.usage,
      estimatedCostUsd: cost.sessionTotalUsd,
      cost,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "YouTube URL analysis failed.";
    console.error("[youtube-url]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
