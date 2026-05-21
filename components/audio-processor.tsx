"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildSegmentsForFile,
  segmentsFromTimesliceBlobs,
  shouldChunkFile,
} from "@/lib/client/split-audio-blob";
import { RECORDER_TIMESLICE_MS } from "@/lib/chunk-config";
import { blobToBase64 } from "@/lib/chunk-api";
import type { AudioSegment } from "@/lib/client/split-audio-blob";

type ProcessResult = {
  transcript: string;
  language: string;
  analysis: string;
  transcriptionProvider: string;
  processedAt: string;
};

type ProgressState = {
  phase: "transcribing" | "analyzing";
  chunkIndex: number;
  totalChunks: number;
};

type CaptureKind = "mic" | "display" | null;

const ACCEPT =
  "audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/m4a,audio/wav,audio/webm,.mp3,.m4a,.wav,.webm";

function isSafariBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/i.test(ua);
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function parseJsonError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export function AudioProcessor() {
  const [file, setFile] = useState<File | null>(null);
  const [captureKind, setCaptureKind] = useState<CaptureKind>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recorderMimeRef = useRef<string>("audio/webm");
  const activeStreamRef = useRef<MediaStream | null>(null);
  const captureStartedAtRef = useRef<number | null>(null);

  const isCapturing = captureKind !== null;
  const isBusy = loading || isCapturing;

  const processChunked = useCallback(async (segments: AudioSegment[]) => {
    const sessionId = crypto.randomUUID();
    const totalChunks = segments.length;
    const transcriptParts: string[] = [];
    let language = "unknown";
    let transcriptionProvider = "openrouter";

    setProgress({ phase: "transcribing", chunkIndex: 0, totalChunks });

    for (let i = 0; i < segments.length; i++) {
      setProgress({ phase: "transcribing", chunkIndex: i + 1, totalChunks });

      const seg = segments[i];
      const audioBase64 = await blobToBase64(seg.blob);

      const res = await fetch("/api/process-audio-chunk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          chunkIndex: i,
          totalChunks,
          audioBase64,
          mimeType: seg.mimeType,
          filename: seg.label,
        }),
      });

      if (!res.ok) {
        throw new Error(
          `Chunk ${i + 1}/${totalChunks} failed: ${await parseJsonError(res)}`
        );
      }

      const data = (await res.json()) as {
        transcript: string;
        language: string;
        transcriptionProvider: string;
      };

      if (data.transcript?.trim()) {
        transcriptParts.push(data.transcript.trim());
      }
      if (data.language && data.language !== "unknown") {
        language = data.language;
      }
      transcriptionProvider = data.transcriptionProvider;
    }

    const transcript = transcriptParts.join("\n\n").trim();
    if (!transcript) {
      throw new Error("No speech detected across all chunks.");
    }

    setProgress({ phase: "analyzing", chunkIndex: totalChunks, totalChunks });

    const analyzeRes = await fetch("/api/analyze-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, language }),
    });

    if (!analyzeRes.ok) {
      throw new Error(await parseJsonError(analyzeRes));
    }

    const analyzed = (await analyzeRes.json()) as {
      analysis: string;
      language: string;
      processedAt: string;
    };

    setResult({
      transcript,
      language: analyzed.language || language,
      analysis: analyzed.analysis,
      transcriptionProvider,
      processedAt: analyzed.processedAt,
    });
  }, []);

  const processFile = useCallback(
    async (audioFile: File) => {
      setLoading(true);
      setError(null);
      setResult(null);
      setProgress(null);

      try {
        if (!shouldChunkFile(audioFile)) {
          const form = new FormData();
          form.append("file", audioFile);
          const res = await fetch("/api/process-audio", {
            method: "POST",
            body: form,
          });
          const data = (await res.json()) as ProcessResult & { error?: string };
          if (!res.ok) {
            throw new Error(data.error ?? `Request failed (${res.status})`);
          }
          setResult(data);
          return;
        }

        const segments = await buildSegmentsForFile(audioFile);
        await processChunked(segments);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setLoading(false);
        setProgress(null);
      }
    },
    [processChunked]
  );

  const stopActiveStream = useCallback(() => {
    activeStreamRef.current?.getTracks().forEach((t) => t.stop());
    activeStreamRef.current = null;
  }, []);

  const finishCapture = useCallback(
    (mimeType: string) => {
      stopActiveStream();
      setCaptureKind(null);
      captureStartedAtRef.current = null;

      const slices = chunksRef.current.filter((s) => s.size > 0);
      if (slices.length === 0) {
        setError("No audio was captured. Share a tab with audio enabled and try again.");
        return;
      }

      const segments = segmentsFromTimesliceBlobs(slices, mimeType);
      const recorded = new File(
        [new Blob(slices, { type: mimeType })],
        `capture-${Date.now()}.webm`,
        { type: mimeType }
      );
      setFile(recorded);

      setLoading(true);
      setError(null);
      setResult(null);
      void processChunked(segments).catch((e) => {
        setError(e instanceof Error ? e.message : "Processing failed.");
      }).finally(() => {
        setLoading(false);
        setProgress(null);
      });
    },
    [processChunked, stopActiveStream]
  );

  const startMediaRecorder = useCallback(
    (stream: MediaStream, kind: CaptureKind) => {
      const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "video/webm;codecs=vp9,opus",
        "video/webm",
      ];
      const mimeType =
        mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      const resolvedMime = recorder.mimeType || mimeType || "audio/webm";
      recorderMimeRef.current = resolvedMime;
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        finishCapture(resolvedMime);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(RECORDER_TIMESLICE_MS);
      captureStartedAtRef.current = Date.now();
      setCaptureKind(kind);
      setElapsedSec(0);
      setError(null);
      setResult(null);
    },
    [finishCapture]
  );

  useEffect(() => {
    if (!isCapturing || captureStartedAtRef.current === null) return;
    const tick = () => {
      setElapsedSec(
        Math.floor((Date.now() - captureStartedAtRef.current!) / 1000)
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [isCapturing]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) {
      setFile(picked);
      setResult(null);
      setError(null);
    }
  };

  const onSubmit = () => {
    if (file) void processFile(file);
  };

  const startMicRecording = async () => {
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreamRef.current = stream;
      startMediaRecorder(stream, "mic");
    } catch {
      setError("Microphone access denied or unavailable in this browser.");
    }
  };

  const startDisplayCapture = async () => {
    setError(null);
    setResult(null);

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError(
        "Screen capture is not supported in this browser. Try Chrome or Edge on desktop."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 44100,
        },
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        setError(
          'No audio was shared. When prompted, pick the tab or window where your video plays and enable "Share tab audio" (Chrome) or "Share system audio" (Windows/macOS screen share).'
        );
        return;
      }

      stream.getVideoTracks().forEach((t) => t.stop());

      const audioOnly = new MediaStream(audioTracks);
      activeStreamRef.current = audioOnly;

      audioTracks[0]?.addEventListener("ended", () => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      });

      startMediaRecorder(audioOnly, "display");
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        setError("Capture cancelled — pick a tab or window and allow audio sharing.");
        return;
      }
      setError(
        e instanceof Error ? e.message : "Could not start tab/screen capture."
      );
    }
  };

  const stopCapture = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    } else {
      stopActiveStream();
      setCaptureKind(null);
      captureStartedAtRef.current = null;
    }
  };

  const safari = isSafariBrowser();
  const progressPercent =
    progress && progress.totalChunks > 0
      ? progress.phase === "analyzing"
        ? 100
        : Math.round((progress.chunkIndex / progress.totalChunks) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-zinc-100">Upload or record</h2>
        <p className="mt-2 text-sm text-zinc-400">
          mp3, m4a, wav, or webm — processed in the cloud. Long YouTube-style captures
          are split into ~75s chunks automatically (no single huge upload).
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-5 py-2.5 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20">
            Choose file
            <input
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={onFileChange}
              disabled={isBusy}
            />
          </label>
          {!isCapturing ? (
            <>
              <button
                type="button"
                onClick={() => void startMicRecording()}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
              >
                Record from mic
              </button>
              <button
                type="button"
                onClick={() => void startDisplayCapture()}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-50"
              >
                Capture desktop / tab audio
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={stopCapture}
              className="inline-flex items-center justify-center rounded-full bg-red-500/90 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400"
            >
              Stop & analyze
            </button>
          )}
          {file && !isCapturing && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-full bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-[#041018] transition hover:bg-cyan-400 disabled:opacity-50"
            >
              {loading ? "Processing…" : "Transcribe & analyze"}
            </button>
          )}
        </div>

        <div className="mt-5 rounded-lg border border-violet-500/20 bg-violet-500/5 p-4 text-sm text-zinc-300">
          <p className="font-medium text-violet-100">
            Long videos supported — processing in chunks
          </p>
          <p className="mt-2 text-xs text-zinc-400">
            Tab capture records in ~75 second segments. After you stop, each segment is
            transcribed in order, then the full transcript is analyzed. A 30-minute
            video typically means about 24 chunks and takes several minutes on the free
            tier.
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-zinc-400">
            <li>
              <strong className="text-zinc-300">Chrome tab</strong> — best for YouTube;
              enable &quot;Share tab audio&quot; in the picker.
            </li>
            <li>
              <strong className="text-zinc-300">Window or entire screen</strong> — VLC,
              QuickTime; enable system audio when offered.
            </li>
            <li>Only the audio track is uploaded — not your screen video.</li>
          </ul>
          {safari && (
            <p className="mt-3 text-xs text-amber-200/90">
              Safari has limited display-audio support. For reliable tab capture, use
              Chrome or Edge on desktop.
            </p>
          )}
        </div>

        {file && (
          <p className="mt-4 text-xs text-zinc-500">
            Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            {shouldChunkFile(file) && " — will be split client-side before upload"}
          </p>
        )}
        {captureKind === "mic" && (
          <p className="mt-4 flex items-center gap-2 text-sm text-amber-200/90">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-400" />
            Mic recording {formatElapsed(elapsedSec)} — microphone only, not system
            audio.
          </p>
        )}
        {captureKind === "display" && (
          <p className="mt-4 flex items-center gap-2 text-sm text-violet-200/90">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-violet-400" />
            Capturing tab/screen audio {formatElapsed(elapsedSec)} — long videos OK;
            stop when finished.
          </p>
        )}
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100"
        >
          {error}
        </div>
      )}

      {loading && progress && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
          <div className="flex items-center justify-between gap-2 text-sm text-zinc-300">
            <span>
              {progress.phase === "transcribing"
                ? `Transcribing chunk ${progress.chunkIndex} of ${progress.totalChunks}…`
                : "Analyzing full transcript…"}
            </span>
            <span className="text-xs text-zinc-500">{progressPercent}%</span>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-cyan-400 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {loading && !progress && (
        <p className="text-center text-sm text-zinc-400">
          Transcribing and analyzing in the cloud…
        </p>
      )}

      {result && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-white/10 bg-black/30 p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-semibold text-zinc-100">Transcript</h3>
              <span className="text-xs text-zinc-500">
                {result.language} · {result.transcriptionProvider}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
              {result.transcript}
            </p>
          </section>
          <section className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
            <h3 className="mb-3 font-semibold text-cyan-100">Analysis</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
              {result.analysis}
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
