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

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
    }

    if (!isAcceptedFile(file)) {
      return NextResponse.json(
        { error: "Unsupported format. Use mp3, m4a, wav, or webm." },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB).` },
        { status: 400 }
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
