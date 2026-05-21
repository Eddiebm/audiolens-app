"use client";

import { useCallback, useRef, useState } from "react";

type ProcessResult = {
  transcript: string;
  language: string;
  analysis: string;
  transcriptionProvider: string;
  processedAt: string;
};

const ACCEPT =
  "audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/m4a,audio/wav,audio/webm,.mp3,.m4a,.wav,.webm";

export function AudioProcessor() {
  const [file, setFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const processFile = useCallback(async (audioFile: File) => {
    setLoading(true);
    setError(null);
    setResult(null);

    const form = new FormData();
    form.append("file", audioFile);

    try {
      const res = await fetch("/api/process-audio", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as ProcessResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const startRecording = async () => {
    setError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const recorded = new File([blob], `recording-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        setFile(recorded);
        void processFile(recorded);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone access denied or unavailable in this browser.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-zinc-100">Upload or record</h2>
        <p className="mt-2 text-sm text-zinc-400">
          mp3, m4a, wav, or webm — processed in the cloud. No BlackHole or local CLI
          required.
        </p>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-5 py-2.5 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20">
            Choose file
            <input
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={onFileChange}
              disabled={loading || recording}
            />
          </label>
          {!recording ? (
            <button
              type="button"
              onClick={() => void startRecording()}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
            >
              Record from mic
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center justify-center rounded-full bg-red-500/90 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400"
            >
              Stop & analyze
            </button>
          )}
          {file && !recording && (
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

        {file && (
          <p className="mt-4 text-xs text-zinc-500">
            Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}
        {recording && (
          <p className="mt-4 flex items-center gap-2 text-sm text-amber-200/90">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-400" />
            Recording — captures your microphone, not system audio.
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

      {loading && (
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
