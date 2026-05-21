import { analyzeTranscript } from "@/lib/analyze";
import { openRouterApiKey } from "@/lib/env";
import {
  ACCEPTED_AUDIO_TYPES,
  ACCEPTED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
} from "@/lib/constants";
import { transcribeAudio } from "@/lib/transcribe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_AUDIO_TYPES.has(file.type)) return true;
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const contentLength = request.headers.get("content-length");
    if (contentLength) {
      const bytes = Number(contentLength);
      if (Number.isFinite(bytes) && bytes > MAX_UPLOAD_BYTES) {
        return jsonError(
          `Upload too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB on this deployment).`,
          413
        );
      }
    }

    if (!openRouterApiKey()) {
      return jsonError(
        "Server misconfiguration: OPENROUTER_API_KEY is required on Vercel.",
        503
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonError(
        `Could not read upload (max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB).`,
        413
      );
    }

    const file = form.get("file");

    if (!(file instanceof File)) {
      return jsonError("Missing audio file.", 400);
    }

    if (!isAcceptedFile(file)) {
      return jsonError("Unsupported format. Use mp3, m4a, wav, or webm.", 400);
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return jsonError(
        `File too large for single upload (max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB). Use the Analyze page — files over 3 MB are split automatically in the browser.`,
        413
      );
    }

    const bytes = await file.arrayBuffer();
    const mimeType = file.type || "application/octet-stream";

    const { transcript, language, provider } = await transcribeAudio(
      bytes,
      mimeType,
      file.name
    );

    const analysis = await analyzeTranscript(transcript, language);

    return NextResponse.json({
      transcript,
      language,
      analysis,
      transcriptionProvider: provider,
      processedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed.";
    console.error("[process-audio]", message);
    return jsonError(message, 500);
  }
}
