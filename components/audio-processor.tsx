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
  buildSessionCost,
  EMPTY_USAGE,
  mergeUsage,
  type TokenUsage,
} from "@/lib/cost";
import { recordSessionCost } from "@/lib/cost-storage";
import { SessionCostDisplay } from "@/components/session-cost-display";
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
import { ReadAloudControls } from "@/components/read-aloud-controls";
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

const PRESET_LABELS: Record<AnalysisPresetId, string> = {
  default: "Default",
  lecture: "Lecture",
  investor: "Investor call",
  sermon: "Sermon / talk",
};

const PRESET_DESCRIPTIONS: Record<AnalysisPresetId, string> = {
  default: "General summary and key points",
  lecture: "Concepts, definitions, and study notes",
  investor: "Signals, risks, and commitments",
  sermon: "Theme, scripture references, and takeaways",
};

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
  const [fastListen, setFastListen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [showAdvanced] = useState(!youtubeMode);
  const [preflight, setPreflight] = useState<PreflightState>("idle");
  const [silenceStopSec, setSilenceStopSec] = useState<10 | 30 | 60 | 0>(30);
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

  const publishResult = useCallback((payload: ProcessResult) => {
    if (payload.cost) {
      recordSessionCost(
        payload.cost.sessionTotalUsd,
        sessionTitleFromTranscript(payload.transcript)
      );
      window.dispatchEvent(new Event("audiolens:cost-updated"));
    }
    setResult(payload);
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
      costUsd: payload.cost?.sessionTotalUsd,
      costAccuracy: payload.cost?.sessionAccuracy,
    });
  }, []);

  const analyzeLongTranscript = useCallback(
    async (
      transcript: string,
      language: string,
      preset: AnalysisPresetId,
      fastMode: boolean
    ): Promise<{
      sections: SectionAnalysis[];
      summary: string;
      analysis: string;
      usage: TokenUsage;
    }> => {
      let usage = EMPTY_USAGE;

      if (fastMode) {
        setProgress({
          phase: "analyzing-summary",
          chunkIndex: 0,
          totalChunks: 0,
        });

        const res = await fetchWithRetry("/api/analyze-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            language,
            presetId: preset,
            fastMode: true,
          }),
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

      const parts = splitTranscriptSections(transcript);
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
    async (
      segments: AudioSegment[],
      preset: AnalysisPresetId,
      fastMode: boolean
    ) => {
      const sessionId = crypto.randomUUID();
      const totalChunks = segments.length;
      const transcriptParts: string[] = [];
      let language = "unknown";
      let transcriptionProvider = "openrouter";
      let transcribeUsage: TokenUsage | null = null;
      let chunksWithApiUsage = 0;

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
              fastMode: fastMode || undefined,
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
          usage?: TokenUsage;
        };

        if (data.transcript?.trim()) {
          transcriptParts.push(data.transcript.trim());
        }
        if (data.language && data.language !== "unknown") {
          language = data.language;
        }
        transcriptionProvider = data.transcriptionProvider;
        if (data.usage) {
          chunksWithApiUsage += 1;
          transcribeUsage = mergeUsage(
            transcribeUsage ?? EMPTY_USAGE,
            data.usage
          );
        }
      }

      const transcribeUsageForCost =
        chunksWithApiUsage === segments.length ? transcribeUsage : null;

      const transcript = transcriptParts.join("\n\n").trim();
      if (!transcript) {
        throw new Error("No speech detected across all chunks.");
      }

      const long = await analyzeLongTranscript(
        transcript,
        language,
        preset,
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
        transcribeUsage: transcribeUsageForCost,
        transcribePromptFallback: segments.map((s) => s.label).join(" "),
      });
      const tokenUsage = mergeUsage(cost.transcribeUsage, cost.analysisUsage);

      publishResult({
        transcript,
        language,
        analysis: long.analysis,
        summary: long.summary,
        sections: long.sections.length ? long.sections : undefined,
        fastListen: fastMode || undefined,
        transcriptionProvider,
        processedAt: new Date().toISOString(),
        tokenUsage,
        estimatedCostUsd: cost.sessionTotalUsd,
        cost,
      });
    },
    [analyzeLongTranscript, publishResult]
  );

  const analyzeYoutubeUrl = useCallback(async () => {
    const url = youtubeUrl.trim();
    if (!url) {
      setError("Paste a YouTube link first.");
      return;
    }

    setLoading(true);
    setError(null);
    setWarning(null);
    setResult(null);
    setProgress(null);
    setAutoStopReason(null);

    try {
      const res = await fetchWithRetry("/api/youtube-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          presetId,
          fastMode: fastListen,
        }),
      });
      const data = (await res.json()) as ProcessResult & {
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        const detail = data.hint
          ? `${data.error ?? "Request failed"} — ${data.hint}`
          : (data.error ?? `Request failed (${res.status})`);
        throw new Error(detail);
      }
      publishResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [fastListen, presetId, publishResult, youtubeUrl]);

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
          const data = (await res.json()) as ProcessResult & {
            error?: string;
            usage?: TokenUsage;
            transcribeUsage?: TokenUsage;
          };
          if (!res.ok) {
            throw new Error(data.error ?? `Request failed (${res.status})`);
          }
          const analysisUsage =
            data.usage ?? data.tokenUsage ?? undefined;
          const cost = buildSessionCost({
            transcript: data.transcript,
            analysisText: data.analysis,
            analysisUsage,
            transcribeUsage: data.transcribeUsage,
          });
          const tokenUsage = mergeUsage(
            cost.transcribeUsage,
            cost.analysisUsage
          );
          publishResult({
            ...data,
            tokenUsage,
            estimatedCostUsd: cost.sessionTotalUsd,
            cost,
          });
          return;
        }

        const segments = await buildSegmentsForFile(audioFile);
        await processChunked(segments, preset, fastListen);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setLoading(false);
        setProgress(null);
      }
    },
    [fastListen, processChunked, publishResult]
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
      void processChunked(segments, presetId, fastListen)
        .catch((e) => {
          setError(e instanceof Error ? e.message : "Processing failed.");
        })
        .finally(() => {
          setLoading(false);
          setProgress(null);
        });
    },
    [fastListen, processChunked, presetId, stopActiveStream]
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

      if (kind === "display" && silenceStopSec > 0) {
        silenceCleanupRef.current = createSilenceMonitor(stream, {
          rmsThreshold: DEFAULT_SILENCE_RMS_THRESHOLD,
          silenceDurationMs: silenceStopSec * 1000,
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
    [finishCapture, silenceStopSec]
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

        setPreflight(peak >= DEFAULT_SILENCE_RMS_THRESHOLD ? "ok" : "fail");
        if (peak < DEFAULT_SILENCE_RMS_THRESHOLD) {
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
      setPreflight(peak >= DEFAULT_SILENCE_RMS_THRESHOLD ? "ok" : "fail");
      if (peak < DEFAULT_SILENCE_RMS_THRESHOLD) {
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
        <section className="border border-white/[0.07] p-6">
          <h2 className="text-sm font-medium text-zinc-300">Paste YouTube URL</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Uses YouTube captions when available (instant). For videos without captions, use
            tab capture below.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              disabled={isBusy}
              className="min-w-0 flex-1 rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-700 focus:border-white/25 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isBusy) void analyzeYoutubeUrl();
              }}
            />
            <button
              type="button"
              onClick={() => void analyzeYoutubeUrl()}
              disabled={isBusy || !youtubeUrl.trim()}
              className="inline-flex shrink-0 items-center justify-center rounded bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-zinc-100 disabled:opacity-30"
            >
              Analyze
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-700">
            Analysis only — no Whisper chunks. Private or live streams may fail if captions
            are not public.
          </p>
        </section>
      ) : null}

      {youtubeMode ? (
        <section className="border border-white/[0.07] p-6">
          <h2 className="text-sm font-medium text-zinc-300">
            Capture YouTube tab audio
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            Isolated capture — only audio from the tab you select. Room noise and other apps
            are not recorded.
          </p>
          <ol className="mt-4 space-y-1 text-xs text-zinc-600 list-decimal pl-4">
            <li>Open your video in a YouTube tab (Chrome or Edge)</li>
            <li>Click below and share that tab — enable Share tab audio</li>
            <li>Never pick Entire screen or a Window</li>
          </ol>
          <p className="mx-auto mt-4 max-w-lg text-center text-xs text-zinc-500">
            The browser picker may still show screen options — we reject Entire
            Screen and Window after you choose. Recording auto-stops when the
            video ends (silence detected) or when you stop. Up to 2 hours.
          </p>
          <p className="mx-auto mt-3 max-w-lg text-center text-xs text-zinc-500">
            Not YouTube?{" "}
            <a href="/analyze" className="text-zinc-400 underline hover:text-zinc-200">
              Use Analyze audio
            </a>{" "}
            for any other source.
          </p>
          <div className="mt-5 flex items-center gap-3 border-t border-white/[0.07] pt-5">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={fastListen}
                onChange={(e) => setFastListen(e.target.checked)}
                disabled={isBusy}
                className="h-3.5 w-3.5 rounded-sm border-white/20 bg-black accent-white"
              />
              Transcript only
            </label>
            <span className="text-xs text-zinc-700">
              {fastListen ? "Play at 1.5×–2× for faster capture" : "Skip AI analysis — faster and cheaper"}
            </span>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {!isCapturing ? (
              <>
                <button
                  type="button"
                  onClick={() => void startDisplayCapture()}
                  disabled={loading}
                  className="inline-flex h-10 items-center justify-center rounded bg-white px-6 text-sm font-semibold text-black transition hover:bg-zinc-100 disabled:opacity-30"
                >
                  Capture YouTube tab
                </button>
                <button
                  type="button"
                  onClick={() => void runPreflightTest()}
                  disabled={isBusy}
                  className="inline-flex h-10 items-center rounded border border-white/10 px-4 text-sm text-zinc-600 hover:border-white/20 hover:text-zinc-400 disabled:opacity-30"
                >
                  {preflight === "testing" ? "Testing (5s)…" : "Test audio (5s)"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={stopCapture}
                className="inline-flex h-10 items-center justify-center rounded bg-red-600 px-6 text-sm font-semibold text-white hover:bg-red-500"
              >
                Stop & analyze
              </button>
            )}
            {preflight === "ok" && <span className="text-xs text-zinc-400">Audio OK</span>}
            {preflight === "fail" && <span className="text-xs text-zinc-600">Test failed</span>}
          </div>
          {isCapturing && (
            <p className="mt-4 font-mono text-xl tabular-nums text-white">
              {formatElapsed(elapsedSec)}
              <span className="ml-3 text-xs font-sans text-zinc-600">~{estChunks} chunk{estChunks === 1 ? "" : "s"}</span>
            </p>
          )}
        </section>
      ) : null}

      {(showAdvanced || !youtubeMode) && (
        <section className="border border-white/[0.07] p-6">
          {!youtubeMode && (
            <p className="mb-6 text-xs text-zinc-600">
              mp3, m4a, wav, or webm — long captures split into ~75s chunks.
            </p>
          )}

          <div className="mb-6">
            <div className="flex border-b border-white/[0.08]">
              {ANALYSIS_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPresetId(p.id as AnalysisPresetId)}
                  disabled={isBusy}
                  className={[
                    "-mb-px border-b-2 px-4 py-2.5 text-sm transition disabled:opacity-30",
                    presetId === p.id
                      ? "border-white font-medium text-white"
                      : "border-transparent text-zinc-600 hover:text-zinc-400",
                  ].join(" ")}
                >
                  {PRESET_LABELS[p.id as AnalysisPresetId]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-600">
              {PRESET_DESCRIPTIONS[presetId]}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="inline-flex cursor-pointer items-center justify-center rounded border border-white/15 px-5 py-2 text-sm font-medium text-zinc-300 transition hover:border-white/30 hover:text-white">
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
                  className="inline-flex items-center justify-center rounded border border-white/15 px-5 py-2 text-sm font-medium text-zinc-400 transition hover:border-white/30 hover:text-zinc-200 disabled:opacity-30"
                >
                  Record from mic
                </button>
                <button
                  type="button"
                  onClick={() => void runPreflightTest()}
                  disabled={isBusy}
                  className="inline-flex items-center justify-center rounded border border-white/10 px-5 py-2 text-sm text-zinc-600 hover:border-white/20 hover:text-zinc-400 disabled:opacity-30"
                >
                  Test tab audio (5s)
                </button>
                <button
                  type="button"
                  onClick={() => void startDisplayCapture()}
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded border border-white/20 px-5 py-2 text-sm font-medium text-zinc-200 transition hover:border-white/40 hover:text-white disabled:opacity-30"
                >
                  Capture tab / screen audio
                </button>
              </>
            )}
            {!isCapturing && (
              <p className="w-full text-xs text-zinc-500">
                Analyzing a YouTube video?{" "}
                <a href="/youtube" className="text-zinc-400 underline hover:text-zinc-200">
                  Use YouTube mode
                </a>{" "}
                for caption-based instant analysis.
              </p>
            )}
            {isCapturing && (
              <button
                type="button"
                onClick={stopCapture}
                className="inline-flex items-center justify-center rounded bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500"
              >
                Stop & analyze
              </button>
            )}
            {file && !isCapturing && (
              <button
                type="button"
                onClick={() => void processFile(file, presetId)}
                disabled={loading}
                className="inline-flex items-center justify-center rounded bg-white px-6 py-2 text-sm font-semibold text-black hover:bg-zinc-100 disabled:opacity-30"
              >
                {loading ? "Processing…" : "Transcribe & analyze"}
              </button>
            )}
          </div>

          {!youtubeMode && (
            <p className="mt-5 text-xs text-zinc-600">
              Auto-stops after silence when the video ends. Safety cap: 2 hours.
              Retries on server errors.
            </p>
          )}

          {preflight === "ok" && (
            <p className="mt-3 text-sm text-zinc-400">Preflight: tab audio OK</p>
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
            <p className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white/60" />
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

          <div className="mt-4 flex items-center gap-3 text-xs text-zinc-500">
            <label htmlFor="silence-stop" className="shrink-0">
              Stop recording after silence:
            </label>
            <select
              id="silence-stop"
              value={silenceStopSec}
              onChange={(e) =>
                setSilenceStopSec(Number(e.target.value) as 10 | 30 | 60 | 0)
              }
              disabled={isCapturing}
              className="rounded border border-white/15 bg-black/40 px-2 py-1 text-zinc-300"
            >
              <option value={10}>10 seconds</option>
              <option value={30}>30 seconds (default)</option>
              <option value={60}>60 seconds</option>
              <option value={0}>Never</option>
            </select>
          </div>
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
        <div className="border border-white/[0.07] p-5">
          <div className="flex items-center justify-between gap-2 text-sm text-zinc-400">
            <span>{progressLabel}</span>
            <span className="font-mono text-xs text-zinc-600">{progressPercent}%</span>
          </div>
          <div
            className="mt-3 h-px overflow-hidden bg-white/10"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-white transition-all duration-300"
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
          {result.fastListen ? (
            <p className="text-center">
              <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200">
                Transcript only
              </span>
            </p>
          ) : null}
          {result.cost && <SessionCostDisplay cost={result.cost} />}

          <ReadAloudControls result={result} />

          {result.summary && result.sections?.length ? (
            <section className="border border-white/[0.07] p-5">
              <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Executive summary</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                {result.summary}
              </p>
            </section>
          ) : null}

          {result.sections?.map((sec) => (
            <section
              key={sec.title}
              className="border border-white/[0.07] p-5"
            >
              <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">{sec.title}</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
                {sec.analysis}
              </p>
            </section>
          ))}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="border border-white/[0.07] p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Transcript</h3>
                <span className="text-xs text-zinc-700">
                  {result.language} · {result.transcriptionProvider}
                </span>
              </div>
              <p className="max-h-[480px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-zinc-500">
                {result.transcript}
              </p>
            </section>
            <section className="border border-white/[0.07] p-5">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                {result.sections?.length ? "Latest analysis" : "Analysis"}
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                {result.analysis}
              </p>
            </section>
          </div>
          <p className="text-center text-xs text-zinc-500">
            Saved to{" "}
            <a href="/dashboard" className="text-zinc-400 underline hover:text-zinc-200">
              session history
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
