"use client";

import { useEffect, useMemo } from "react";
import {
  useReadAloud,
  type ReadAloudRate,
  type ReadAloudSegment,
} from "@/lib/client/read-aloud";
import type { ProcessResult } from "@/lib/types";

const RATES: ReadAloudRate[] = [0.9, 1, 1.1];

function segmentsFromResult(
  result: ProcessResult,
  mode: "summary" | "full" | "transcript"
): ReadAloudSegment[] {
  if (mode === "transcript") {
    return [{ label: "Transcript", text: result.transcript }];
  }
  if (mode === "summary") {
    const text = result.summary?.trim() || result.analysis?.trim() || "";
    return text ? [{ label: "Executive summary", text }] : [];
  }
  const out: ReadAloudSegment[] = [];
  const summary = result.summary?.trim();
  if (summary) {
    out.push({ label: "Executive summary", text: summary });
  }
  if (result.sections?.length) {
    for (const sec of result.sections) {
      const body = sec.analysis?.trim();
      if (body) out.push({ label: sec.title, text: body });
    }
  } else {
    const analysis = result.analysis?.trim();
    if (analysis && analysis !== summary) {
      out.push({ label: "Analysis", text: analysis });
    } else if (!summary && analysis) {
      out.push({ label: "Analysis", text: analysis });
    }
  }
  return out;
}

type Props = {
  result: ProcessResult;
};

export function ReadAloudControls({ result }: Props) {
  const readAloud = useReadAloud();
  const transcriptChars = result.transcript?.length ?? 0;
  const transcriptLong = transcriptChars > 8000;

  const hasSummary = Boolean(
    result.summary?.trim() || result.analysis?.trim()
  );
  const hasFull = useMemo(() => {
    if (result.sections?.length) return true;
    return Boolean(result.analysis?.trim());
  }, [result]);

  useEffect(() => {
    readAloud.stop();
  }, [result.processedAt, readAloud.stop]);

  if (!readAloud.supported) {
    return (
      <p className="text-center text-xs text-zinc-500">
        Read aloud is not supported in this browser.
      </p>
    );
  }

  const speak = (mode: "summary" | "full" | "transcript") => {
    if (mode === "transcript" && transcriptLong) {
      const ok = window.confirm(
        `The transcript is about ${Math.round(transcriptChars / 1000)}k characters and may take several minutes to read. Continue?`
      );
      if (!ok) return;
    }
    readAloud.start(segmentsFromResult(result, mode));
  };

  const statusLabel = readAloud.speaking
    ? readAloud.paused
      ? "Paused"
      : "Speaking…"
    : null;

  return (
    <div
      className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4"
      role="region"
      aria-label="Read aloud"
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        {hasSummary && (
          <button
            type="button"
            onClick={() => speak("summary")}
            disabled={readAloud.speaking && !readAloud.paused}
            className="rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-sm font-medium text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-50"
          >
            Read summary
          </button>
        )}
        {hasFull && (
          <button
            type="button"
            onClick={() => speak("full")}
            disabled={readAloud.speaking && !readAloud.paused}
            className="rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-1.5 text-sm font-medium text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-50"
          >
            Read full analysis
          </button>
        )}
        {result.transcript?.trim() && (
          <button
            type="button"
            onClick={() => speak("transcript")}
            disabled={readAloud.speaking && !readAloud.paused}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
            title={
              transcriptLong
                ? "Long transcript — you will be asked to confirm"
                : undefined
            }
          >
            Read transcript
            {transcriptLong ? " (long)" : ""}
          </button>
        )}
        {readAloud.speaking && (
          <>
            <button
              type="button"
              onClick={readAloud.togglePause}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10"
            >
              {readAloud.paused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={readAloud.stop}
              className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-200 hover:bg-red-500/20"
            >
              Stop
            </button>
          </>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-500">
        <span>Speed</span>
        {RATES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => readAloud.setRate(r)}
            className={`rounded px-2 py-0.5 ${
              readAloud.rate === r
                ? "bg-violet-500/30 text-violet-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            aria-pressed={readAloud.rate === r}
          >
            {r}×
          </button>
        ))}
        {statusLabel && (
          <span
            className="font-medium text-violet-300"
            aria-live="polite"
          >
            {statusLabel}
          </span>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-zinc-600">
        Uses your browser voice (Chrome recommended). macOS CLI: export text
        and run{" "}
        <code className="text-zinc-500">say -f analysis.txt</code>
      </p>
    </div>
  );
}
