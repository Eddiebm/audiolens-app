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
import {
  MAX_RECORD_MS,
  PREFLIGHT_TEST_MS,
  DEFAULT_SILENCE_RMS_THRESHOLD,
} from "@/lib/capture-config";
import {
  EMPTY_USAGE,
  estimateCostUsd,
  estimateTokensFromText,
  formatCostUsd,
  mergeUsage,
  type TokenUsage,
} from "@/lib/cost-estimate";
import { fetchWithRetry } from "@/lib/fetch-retry";
import {
  HOLISTIC_SUMMARY_INSTRUCTION,
  SECTION_ANALYSIS_INSTRUCTION,
} from "@/lib/analyze";
import { ANALYSIS_PRESETS, type AnalysisPresetId } from "@/lib/prompt-presets";
import { splitTranscriptSections } from "@/lib/section-split";
import {
  sessionTitleFromTranscript,
  upsertSession,
} from "@/lib/session-storage";
import { createSilenceMonitor, measureStreamRms } from "@/lib/silence-monitor";
import {
  multipleAudioTracksWarning,
  requestTabDisplayMedia,
  stopMediaStream,
  TAB_ONLY_REJECT_MESSAGE,
  validateBrowserTabSurface,
} from "@/lib/client/tab-capture";
import type { ProcessResult, SectionAnalysis } from "@/lib/types";

type ProgressState = {
  phase: "transcribing" | "analyzing-sections" | "analyzing-summary";
  chunkIndex: number;
  totalChunks: number;
  sectionIndex?: number;
  totalSections?: number;
};

type CaptureKind = "mic" | "display" | null;

type PreflightState = "idle" | "testing" | "ok" | "fail";

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

function estimateChunkCountFromElapsed(sec: number): number {
  return Math.max(1, Math.ceil(sec / 75));
}

async function parseJsonError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

type AudioProcessorProps = {
  mode?: "full" | "youtube";
};

export function AudioProcessor({ mode = "full" }: AudioProcessorProps) {
  const youtubeMode = mode === "youtube";
  const [file, setFile] = useState<File | null>(null);
  const [captureKind, setCaptureKind] = useState<CaptureKind>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<AnalysisPresetId>("default");
  const [showAdvanced] = useState(!youtubeMode);
  const [preflight, setPreflight] = useState<PreflightState>("idle");
  const [silenceThreshold, setSilenceThreshold] = useState(
    DEFAULT_SILENCE_RMS_THRESHOLD
  );
  const [autoStopReason, setAutoStopReason] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recorderMimeRef = useRef<string>("audio/webm");
  const activeStreamRef = useRef<MediaStream | null>(null);
  const captureStartedAtRef = useRef<number | null>(null);
  const silenceCleanupRef = useRef<(() => void) | null>(null);
  const maxRecordTimerRef = useRef<number | null>(null);

  const isCapturing = captureKind !== null;
  const isBusy = loading || isCapturing || preflight === "testing";

  const persistSession = useCallback((payload: ProcessResult) => {
    const id = crypto.randomUUID();
    upsertSession({
      id,
      title: sessionTitleFromTranscript(payload.transcript),
      startedAt: payload.processedAt,
      chunks: [],
      transcript: payload.transcript,
      analysis: payload.analysis,
      summary: payload.summary,
      sections: payload.sections,
      language: payload.language,
      source: "web",
    });
  }, []);

  const analyzeLongTranscript = useCallback(
    async (
      transcript: string,
      language: string,
      preset: AnalysisPresetId
    ): Promise<{
      sections: SectionAnalysis[];
      summary: string;
      analysis: string;
      usage: TokenUsage;
    }> => {
      const parts = splitTranscriptSections(transcript);
      let usage = EMPTY_USAGE;
      const sections: SectionAnalysis[] = [];

      if (parts.length <= 1) {
        const res = await fetchWithRetry("/api/analyze-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript, language, presetId: preset }),
        });
        if (!res.ok) throw new Error(await parseJsonError(res));
        const data = (await res.json()) as {
          analysis: string;
          usage?: TokenUsage;
        };
        if (data.usage) usage = mergeUsage(usage, data.usage);
        return {
          sections: [],
          summary: data.analysis,
          analysis: data.analysis,
          usage,
        };
      }

      setProgress({
        phase: "analyzing-sections",
        chunkIndex: 0,
        totalChunks: 0,
        sectionIndex: 0,
        totalSections: parts.length,
      });

      for (let i = 0; i < parts.length; i++) {
        setProgress({
          phase: "analyzing-sections",
          chunkIndex: 0,
          totalChunks: 0,
          sectionIndex: i + 1,
          totalSections: parts.length,
        });

        const res = await fetchWithRetry("/api/analyze-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: parts[i].text,
            language,
            presetId: preset,
            instruction: `${SECTION_ANALYSIS_INSTRUCTION}\n\nSection: ${parts[i].title}`,
          }),
        });
        if (!res.ok) throw new Error(await parseJsonError(res));
        const data = (await res.json()) as {
          analysis: string;
          usage?: { promptTokens: number; completionTokens: number };
        };
        if (data.usage) usage = mergeUsage(usage, data.usage);
        sections.push({ title: parts[i].title, analysis: data.analysis });
      }

      setProgress({
        phase: "analyzing-summary",
        chunkIndex: 0,
        totalChunks: 0,
      });

      const summaryRes = await fetchWithRetry("/api/analyze-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          language,
          presetId: preset,
          instruction: HOLISTIC_SUMMARY_INSTRUCTION,
        }),
      });
      if (!summaryRes.ok) throw new Error(await parseJsonError(summaryRes));
      const summaryData = (await summaryRes.json()) as {
        analysis: string;
        usage?: { promptTokens: number; completionTokens: number };
      };
      if (summaryData.usage) usage = mergeUsage(usage, summaryData.usage);

      return {
        sections,
        summary: summaryData.analysis,
        analysis: summaryData.analysis,
        usage,
      };
    },
    []
  );

  const processChunked = useCallback(
    async (segments: AudioSegment[], preset: AnalysisPresetId) => {
      const sessionId = crypto.randomUUID();
      const totalChunks = segments.length;
      const transcriptParts: string[] = [];
      let language = "unknown";
      let transcriptionProvider = "openrouter";
      let usage = EMPTY_USAGE;

      if (totalChunks === 1) {
        setWarning(
          "Only 1 chunk was captured — if you expected a longer video, check that tab audio was shared and the source kept playing."
        );
      }

      setProgress({ phase: "transcribing", chunkIndex: 0, totalChunks });

      for (let i = 0; i < segments.length; i++) {
        setProgress({
          phase: "transcribing",
          chunkIndex: i + 1,
          totalChunks,
        });

        const seg = segments[i];
        const audioBase64 = await blobToBase64(seg.blob);

        const res = await fetchWithRetry(
          "/api/process-audio-chunk",
          {
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
          },
          { maxAttempts: 3 }
        );

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
        usage = mergeUsage(usage, {
          promptTokens: estimateTokensFromText(seg.label),
          completionTokens: estimateTokensFromText(data.transcript ?? ""),
        });
      }

      const transcript = transcriptParts.join("\n\n").trim();
      if (!transcript) {
        throw new Error("No speech detected across all chunks.");
      }

      const long = await analyzeLongTranscript(transcript, language, preset);
      usage = mergeUsage(usage, long.usage);

      const processed: ProcessResult = {
        transcript,
        language,
        analysis: long.analysis,
        summary: long.summary,
        sections: long.sections.length ? long.sections : undefined,
        transcriptionProvider,
        processedAt: new Date().toISOString(),
        tokenUsage: usage,
        estimatedCostUsd: estimateCostUsd(usage),
      };

      setResult(processed);
      persistSession(processed);
    },
    [analyzeLongTranscript, persistSession]
  );

  const processFile = useCallback(
    async (audioFile: File, preset: AnalysisPresetId) => {
      setLoading(true);
      setError(null);
      setWarning(null);
      setResult(null);
      setProgress(null);
      setAutoStopReason(null);

      try {
        if (!shouldChunkFile(audioFile)) {
          const form = new FormData();
          form.append("file", audioFile);
          const res = await fetchWithRetry("/api/process-audio", {
            method: "POST",
            body: form,
          });
          const data = (await res.json()) as ProcessResult & { error?: string };
          if (!res.ok) {
            throw new Error(data.error ?? `Request failed (${res.status})`);
          }
          const usage = data.tokenUsage ?? {
            promptTokens: estimateTokensFromText(data.transcript),
            completionTokens: estimateTokensFromText(data.analysis),
          };
          const processed: ProcessResult = {
            ...data,
            tokenUsage: usage,
            estimatedCostUsd: estimateCostUsd(usage),
          };
          setResult(processed);
          persistSession(processed);
          return;
        }

        const segments = await buildSegmentsForFile(audioFile);
        await processChunked(segments, preset);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setLoading(false);
        setProgress(null);
      }
    },
    [processChunked, persistSession]
  );

  const stopActiveStream = useCallback(() => {
    silenceCleanupRef.current?.();
    silenceCleanupRef.current = null;
    if (maxRecordTimerRef.current) {
      window.clearTimeout(maxRecordTimerRef.current);
      maxRecordTimerRef.current = null;
    }
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
        setError(
          "No audio was captured. Share a tab with audio enabled and try again."
        );
        return;
      }

      if (slices.length === 1) {
        setWarning(
          "Only 1 chunk recorded (~75s). For longer videos, keep the tab playing until you stop manually."
        );
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
      void processChunked(segments, presetId)
        .catch((e) => {
          setError(e instanceof Error ? e.message : "Processing failed.");
        })
        .finally(() => {
          setLoading(false);
          setProgress(null);
        });
    },
    [processChunked, presetId, stopActiveStream]
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
      setAutoStopReason(null);

      if (kind === "display") {
        silenceCleanupRef.current = createSilenceMonitor(stream, {
          rmsThreshold: silenceThreshold,
          onSilenceAutoStop: () => {
            setAutoStopReason("Audio ended (silence detected) — processing…");
            if (mediaRecorderRef.current?.state === "recording") {
              mediaRecorderRef.current.stop();
            }
          },
        });
      }

      maxRecordTimerRef.current = window.setTimeout(() => {
        setAutoStopReason("Maximum recording length (2 hours) reached.");
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, MAX_RECORD_MS);
    },
    [finishCapture, silenceThreshold]
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

  useEffect(() => () => stopActiveStream(), [stopActiveStream]);

  const rejectNonTabSurface = (stream: MediaStream): boolean => {
    const check = validateBrowserTabSurface(stream);
    if (!check.ok) {
      stopMediaStream(stream);
      setError(TAB_ONLY_REJECT_MESSAGE);
      return true;
    }
    return false;
  };

  const runYoutubePreflightTest = async () => {
    setPreflight("testing");
    setError(null);
    setWarning(null);
    try {
      const stream = await requestTabDisplayMedia();
      try {
        if (rejectNonTabSurface(stream)) {
          setPreflight("fail");
          return;
        }

        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          stopMediaStream(stream);
          setPreflight("fail");
          setError('No tab audio — enable "Share tab audio" in the picker.');
          return;
        }

        const multiWarn = multipleAudioTracksWarning(stream);
        if (multiWarn) setWarning(multiWarn);

        const audioOnly = new MediaStream(audioTracks);
        const peak = await measureStreamRms(audioOnly, PREFLIGHT_TEST_MS);
        audioOnly.getTracks().forEach((t) => t.stop());

        if (rejectNonTabSurface(stream)) {
          setPreflight("fail");
          return;
        }

        setPreflight(peak >= silenceThreshold ? "ok" : "fail");
        if (peak < silenceThreshold) {
          setError(
            "Low audio level during test. Start playback in the tab, then test again."
          );
        }
      } finally {
        stopMediaStream(stream);
      }
    } catch (e) {
      setPreflight("fail");
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        setError("Preflight cancelled — pick a tab and allow audio.");
        return;
      }
      setError(
        e instanceof Error ? e.message : "Preflight cancelled or failed."
      );
    }
  };

  const runPreflightTest = async () => {
    if (youtubeMode) {
      await runYoutubePreflightTest();
      return;
    }
    setPreflight("testing");
    setError(null);
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setPreflight("fail");
        setError("Display capture not supported in this browser.");
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: false, noiseSuppression: false },
      });
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        setPreflight("fail");
        setError('No tab audio — enable "Share tab audio" in the picker.');
        return;
      }
      stream.getVideoTracks().forEach((t) => t.stop());
      const audioOnly = new MediaStream(audioTracks);
      const peak = await measureStreamRms(audioOnly, PREFLIGHT_TEST_MS);
      audioOnly.getTracks().forEach((t) => t.stop());
      setPreflight(peak >= silenceThreshold ? "ok" : "fail");
      if (peak < silenceThreshold) {
        setError(
          "Low audio level during test. Start playback in the tab, then test again."
        );
      }
    } catch {
      setPreflight("fail");
      setError("Preflight cancelled or failed.");
    }
  };

  const startYoutubeTabCapture = async () => {
    setError(null);
    setResult(null);
    setWarning(null);

    try {
      const stream = await requestTabDisplayMedia();

      if (rejectNonTabSurface(stream)) return;

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stopMediaStream(stream);
        setError(
          'No audio shared. Pick the playing tab and enable "Share tab audio".'
        );
        return;
      }

      const multiWarn = multipleAudioTracksWarning(stream);
      if (multiWarn) setWarning(multiWarn);

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
        setError("Capture cancelled — pick a tab and allow audio.");
        return;
      }
      setError(
        e instanceof Error ? e.message : "Could not start tab capture."
      );
    }
  };

  const startDisplayCapture = async () => {
    if (youtubeMode) {
      await startYoutubeTabCapture();
      return;
    }
    setError(null);
    setResult(null);
    setWarning(null);

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError(
        "Screen capture is not supported. Use Chrome or Edge on desktop."
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
          'No audio shared. Pick the playing tab and enable "Share tab audio".'
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
        setError("Capture cancelled — pick a tab and allow audio.");
        return;
      }
      setError(
        e instanceof Error ? e.message : "Could not start tab/screen capture."
      );
    }
  };

  const startMicRecording = async () => {
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreamRef.current = stream;
      startMediaRecorder(stream, "mic");
    } catch {
      setError("Microphone access denied or unavailable.");
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
  const estChunks = isCapturing ? estimateChunkCountFromElapsed(elapsedSec) : 0;

  const progressLabel = (() => {
    if (!progress) return null;
    if (progress.phase === "transcribing") {
      return `Transcribing ${progress.chunkIndex}/${progress.totalChunks}`;
    }
    if (progress.phase === "analyzing-sections") {
      return `Analyzing section ${progress.sectionIndex}/${progress.totalSections}`;
    }
    if (progress.phase === "analyzing-summary") {
      return "Writing executive summary…";
    }
    return "Processing…";
  })();

  const progressPercent = (() => {
    if (!progress) return 0;
    if (progress.phase === "transcribing" && progress.totalChunks > 0) {
      return Math.round((progress.chunkIndex / progress.totalChunks) * 70);
    }
    if (progress.phase === "analyzing-sections" && progress.totalSections) {
      return (
        70 +
        Math.round(
          ((progress.sectionIndex ?? 0) / progress.totalSections) * 20
        )
      );
    }
    if (progress.phase === "analyzing-summary") return 95;
    return 50;
  })();

  return (
    <div className="space-y-8">
      {youtubeMode ? (
        <section className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-8">
          <h2 className="text-center text-xl font-semibold text-violet-100">
            Capture YouTube tab audio
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-center text-sm font-semibold text-zinc-100">
            <strong>Isolated capture:</strong> only audio from the tab you
            select. Room noise and other apps are <strong>NOT</strong> recorded.
          </p>
          <ol className="mx-auto mt-4 max-w-md list-decimal space-y-2 pl-6 text-sm text-zinc-300">
            <li>
              Open your video in a <strong>YouTube tab</strong> (Chrome or Edge)
            </li>
            <li>
              Click below and share <strong>THIS tab</strong> — enable{" "}
              <strong>Share tab audio</strong>
            </li>
            <li>
              Never pick <strong>Entire screen</strong> or a{" "}
              <strong>Window</strong> — those include other sounds
            </li>
          </ol>
          <p className="mx-auto mt-4 max-w-lg text-center text-xs text-zinc-500">
            The browser picker may still show screen options — we reject Entire
            Screen and Window after you choose. Recording auto-stops when the
            video ends (silence ~50s) or when you stop. Up to 2 hours.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            {!isCapturing ? (
              <>
                <button
                  type="button"
                  onClick={() => void runPreflightTest()}
                  disabled={isBusy}
                  className="text-sm text-zinc-400 underline hover:text-zinc-200 disabled:opacity-50"
                >
                  {preflight === "testing"
                    ? "Testing tab audio (5s)…"
                    : "Test tab audio (5s)"}
                </button>
                {preflight === "ok" && (
                  <p className="text-sm text-emerald-400">
                    Tab-only capture verified — audio detected
                  </p>
                )}
                {preflight === "fail" && (
                  <p className="text-sm text-rose-400">
                    Test failed — check tab selection and playback
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void startDisplayCapture()}
                  disabled={loading}
                  className="inline-flex min-h-14 min-w-[280px] items-center justify-center rounded-full bg-violet-500 px-8 text-base font-semibold text-white transition hover:bg-violet-400 disabled:opacity-50"
                >
                  Capture YouTube tab
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={stopCapture}
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-red-500 px-8 text-base font-semibold text-white hover:bg-red-400"
              >
                Stop & analyze
              </button>
            )}
          </div>
          {isCapturing && (
            <p className="mt-6 text-center font-mono text-2xl tabular-nums text-cyan-300">
              {formatElapsed(elapsedSec)}
            </p>
          )}
          {isCapturing && (
            <p className="mt-2 text-center text-xs text-zinc-500">
              ~{estChunks} chunk{estChunks === 1 ? "" : "s"} expected at this
              length
            </p>
          )}
        </section>
      ) : null}

      {(showAdvanced || !youtubeMode) && (
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          {!youtubeMode && (
            <>
              <h2 className="text-lg font-semibold text-zinc-100">
                Upload or record
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                mp3, m4a, wav, or webm — long captures split into ~75s chunks.
              </p>
            </>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-zinc-400">Analysis style</label>
            <select
              value={presetId}
              onChange={(e) =>
                setPresetId(e.target.value as AnalysisPresetId)
              }
              disabled={isBusy}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-zinc-200"
            >
              {ANALYSIS_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-5 py-2.5 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20">
              Choose file
              <input
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const picked = e.target.files?.[0];
                  if (picked) {
                    setFile(picked);
                    setResult(null);
                    setError(null);
                  }
                }}
                disabled={isBusy}
              />
            </label>
            {!isCapturing && (
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
                  onClick={() => void runPreflightTest()}
                  disabled={isBusy}
                  className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-sm text-zinc-400 hover:bg-white/5 disabled:opacity-50"
                >
                  Test tab audio (5s)
                </button>
                <button
                  type="button"
                  onClick={() => void startDisplayCapture()}
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-2.5 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-50"
                >
                  Capture tab / screen audio
                </button>
              </>
            )}
            {isCapturing && (
              <button
                type="button"
                onClick={stopCapture}
                className="inline-flex items-center justify-center rounded-full bg-red-500/90 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-400"
              >
                Stop & analyze
              </button>
            )}
            {file && !isCapturing && (
              <button
                type="button"
                onClick={() => void processFile(file, presetId)}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-[#041018] hover:bg-cyan-400 disabled:opacity-50"
              >
                {loading ? "Processing…" : "Transcribe & analyze"}
              </button>
            )}
          </div>

          {!youtubeMode && (
            <div className="mt-5 rounded-lg border border-violet-500/20 bg-violet-500/5 p-4 text-sm text-zinc-300">
              <p className="font-medium text-violet-100">
                Long videos — chunked pipeline
              </p>
              <p className="mt-2 text-xs text-zinc-400">
                Auto-stops after ~50s silence when the video ends. Safety cap: 2
                hours. Retries on transient server errors (413/504).
              </p>
            </div>
          )}

          {preflight === "ok" && (
            <p className="mt-3 text-sm text-emerald-400">Preflight: tab audio OK</p>
          )}
          {preflight === "fail" && (
            <p className="mt-3 text-sm text-rose-400">Preflight: no audio detected</p>
          )}

          {file && (
            <p className="mt-4 text-xs text-zinc-500">
              Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
          {captureKind === "display" && (
            <p className="mt-4 flex items-center gap-2 text-sm text-violet-200/90">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-violet-400" />
              Recording {formatElapsed(elapsedSec)} · ~{estChunks} chunks ·
              auto-stop on silence
            </p>
          )}
          {captureKind === "mic" && (
            <p className="mt-4 text-sm text-amber-200/90">
              Mic {formatElapsed(elapsedSec)} — not system audio
            </p>
          )}
          {autoStopReason && (
            <p className="mt-2 text-sm text-amber-200">{autoStopReason}</p>
          )}
          {safari && (
            <p className="mt-3 text-xs text-amber-200/90">
              Safari has limited tab audio — use Chrome or Edge.
            </p>
          )}

          <details className="mt-4 text-xs text-zinc-500">
            <summary className="cursor-pointer hover:text-zinc-300">
              Silence auto-stop threshold
            </summary>
            <label className="mt-2 flex items-center gap-2">
              RMS ({silenceThreshold.toFixed(4)})
              <input
                type="range"
                min={0.002}
                max={0.03}
                step={0.001}
                value={silenceThreshold}
                onChange={(e) =>
                  setSilenceThreshold(Number(e.target.value))
                }
                disabled={isCapturing}
              />
            </label>
          </details>
        </section>
      )}

      {warning && (
        <div
          role="status"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100"
        >
          {warning}
        </div>
      )}

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
            <span>{progressLabel}</span>
            <span className="font-mono text-xs text-zinc-500">
              {progressPercent}%
            </span>
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
        <p className="text-center text-sm text-zinc-400">Processing…</p>
      )}

      {result && (
        <div className="space-y-6">
          {result.estimatedCostUsd !== undefined && (
            <p className="text-center text-xs text-zinc-500">
              Estimated API cost:{" "}
              <span className="text-zinc-300">
                {formatCostUsd(result.estimatedCostUsd)} est.
              </span>
              {result.tokenUsage &&
                ` (${result.tokenUsage.promptTokens + result.tokenUsage.completionTokens} tokens)`}{" "}
              — rough estimate, not a bill.
            </p>
          )}

          {result.summary && result.sections?.length ? (
            <section className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
              <h3 className="font-semibold text-cyan-100">Executive summary</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-200">
                {result.summary}
              </p>
            </section>
          ) : null}

          {result.sections?.map((sec) => (
            <section
              key={sec.title}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-5"
            >
              <h3 className="font-semibold text-zinc-100">{sec.title}</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-300">
                {sec.analysis}
              </p>
            </section>
          ))}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-white/10 bg-black/30 p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-semibold text-zinc-100">Transcript</h3>
                <span className="text-xs text-zinc-500">
                  {result.language} · {result.transcriptionProvider}
                </span>
              </div>
              <p className="max-h-[480px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                {result.transcript}
              </p>
            </section>
            <section className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
              <h3 className="mb-3 font-semibold text-cyan-100">
                {result.sections?.length ? "Latest analysis" : "Analysis"}
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                {result.analysis}
              </p>
            </section>
          </div>
          <p className="text-center text-xs text-zinc-500">
            Saved to{" "}
            <a href="/dashboard" className="text-cyan-400 hover:underline">
              session history
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
