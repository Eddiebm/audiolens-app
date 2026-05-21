import { openRouterApiKey } from "@/lib/env";
import { MAX_CHUNK_RAW_BYTES } from "@/lib/chunk-config";
import type { ProcessAudioChunkRequest } from "@/lib/chunk-api";
import { transcribeAudio } from "@/lib/transcribe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
/** Hobby: 60s max; Pro can raise via vercel.json / route segment */
export const maxDuration = 60;

function estimateDecodedBytes(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

export async function POST(request: Request) {
  try {
    if (!openRouterApiKey() && !process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json(
        {
          error:
            "Server misconfiguration: OPENROUTER_API_KEY or OPENAI_API_KEY required.",
        },
        { status: 503 }
      );
    }

    let body: ProcessAudioChunkRequest;
    try {
      body = (await request.json()) as ProcessAudioChunkRequest;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const {
      sessionId,
      chunkIndex,
      totalChunks,
      audioBase64,
      mimeType,
      filename,
    } = body;

    if (!sessionId?.trim()) {
      return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
    }
    if (typeof chunkIndex !== "number" || chunkIndex < 0) {
      return NextResponse.json({ error: "Invalid chunkIndex." }, { status: 400 });
    }
    if (typeof totalChunks !== "number" || totalChunks < 1) {
      return NextResponse.json({ error: "Invalid totalChunks." }, { status: 400 });
    }
    if (!audioBase64?.trim()) {
      return NextResponse.json({ error: "Missing audioBase64." }, { status: 400 });
    }

    const decodedSize = estimateDecodedBytes(audioBase64);
    if (decodedSize > MAX_CHUNK_RAW_BYTES) {
      return NextResponse.json(
        {
          error: `Chunk too large (${(decodedSize / 1024 / 1024).toFixed(1)} MB). Split into smaller segments.`,
        },
        { status: 413 }
      );
    }

    const bytes = Buffer.from(audioBase64, "base64");
    if (bytes.byteLength === 0) {
      return NextResponse.json({ error: "Empty audio chunk." }, { status: 400 });
    }

    const name =
      filename?.trim() ||
      `chunk-${chunkIndex + 1}-of-${totalChunks}.${mimeType.includes("wav") ? "wav" : "webm"}`;

    const { transcript, language, provider } = await transcribeAudio(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      mimeType || "application/octet-stream",
      name
    );

    return NextResponse.json({
      transcript,
      language,
      chunkIndex,
      transcriptionProvider: provider,
      sessionId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chunk transcription failed.";
    console.error("[process-audio-chunk]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
