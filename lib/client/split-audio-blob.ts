import {
  CHUNK_TARGET_SECONDS,
  CLIENT_DECODE_MAX_BYTES,
  MAX_CHUNK_RAW_BYTES,
  SINGLE_UPLOAD_MAX_BYTES,
} from "@/lib/chunk-config";
import { audioBufferToWav } from "@/lib/wav-encode";

export type AudioSegment = {
  blob: Blob;
  mimeType: string;
  label: string;
};

/** Group short MediaRecorder slices into upload-sized segments. */
export function groupRecorderSlices(slices: Blob[], mimeType: string): AudioSegment[] {
  if (slices.length === 0) return [];

  const segments: AudioSegment[] = [];
  let batch: Blob[] = [];
  let batchBytes = 0;
  let index = 0;

  const flush = () => {
    if (batch.length === 0) return;
    segments.push({
      blob: new Blob(batch, { type: mimeType }),
      mimeType,
      label: `segment-${index + 1}`,
    });
    index += 1;
    batch = [];
    batchBytes = 0;
  };

  for (const slice of slices) {
    batch.push(slice);
    batchBytes += slice.size;
    if (batchBytes >= MAX_CHUNK_RAW_BYTES) {
      flush();
    }
  }
  flush();
  return segments;
}

/** Timeslice blobs from MediaRecorder (each ~CHUNK_TARGET_SECONDS). */
export function segmentsFromTimesliceBlobs(
  slices: Blob[],
  mimeType: string
): AudioSegment[] {
  return slices
    .filter((s) => s.size > 0)
    .map((blob, i) => ({
      blob,
      mimeType: blob.type || mimeType,
      label: `timeslice-${i + 1}`,
    }));
}

/**
 * Split a file blob into WAV segments via Web Audio (upload path).
 * Only used under CLIENT_DECODE_MAX_BYTES to avoid OOM on very long files.
 */
export async function splitFileBlobIntoSegments(file: Blob): Promise<AudioSegment[]> {
  if (file.size > CLIENT_DECODE_MAX_BYTES) {
    throw new Error(
      `File is too large to split in the browser (${(file.size / 1024 / 1024).toFixed(1)} MB). ` +
        "Use tab capture for long YouTube videos, or upload a shorter clip."
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const sampleRate = decoded.sampleRate;
    const chunkSamples = Math.min(
      CHUNK_TARGET_SECONDS * sampleRate,
      Math.floor((MAX_CHUNK_RAW_BYTES / 2) * (sampleRate / 44100))
    );

    const segments: AudioSegment[] = [];
    for (let offset = 0; offset < decoded.length; offset += chunkSamples) {
      const length = Math.min(chunkSamples, decoded.length - offset);
      const slice = ctx.createBuffer(
        decoded.numberOfChannels,
        length,
        sampleRate
      );
      for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        slice.getChannelData(ch).set(
          decoded.getChannelData(ch).subarray(offset, offset + length)
        );
      }
      const wav = audioBufferToWav(slice);
      segments.push({
        blob: new Blob([wav], { type: "audio/wav" }),
        mimeType: "audio/wav",
        label: `wav-${segments.length + 1}`,
      });
    }
    return segments;
  } finally {
    await ctx.close();
  }
}

export function shouldChunkFile(file: File): boolean {
  return file.size > SINGLE_UPLOAD_MAX_BYTES;
}

export async function buildSegmentsForFile(file: File): Promise<AudioSegment[]> {
  if (!shouldChunkFile(file)) {
    return [{ blob: file, mimeType: file.type || "application/octet-stream", label: file.name }];
  }
  return splitFileBlobIntoSegments(file);
}
