"use client";

import { useCallback, useEffect, useState } from "react";
import type { AudioLensSession } from "@/lib/types";

const STORAGE_KEY = "audiolens:sessions";

function loadSessions(): AudioLensSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AudioLensSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: AudioLensSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function isSession(value: unknown): value is AudioLensSession {
  if (!value || typeof value !== "object") return false;
  const s = value as AudioLensSession;
  return (
    typeof s.id === "string" &&
    typeof s.startedAt === "string" &&
    Array.isArray(s.chunks)
  );
}

export function SessionImport() {
  const [sessions, setSessions] = useState<AudioLensSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const importJson = useCallback((text: string) => {
    setError(null);
    try {
      const data = JSON.parse(text) as unknown;
      const list = Array.isArray(data) ? data : [data];
      const valid = list.filter(isSession);
      if (valid.length === 0) {
        setError("JSON must match AudioLens session shape (id, startedAt, chunks).");
        return;
      }
      const merged = [...valid, ...loadSessions()].filter(
        (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i,
      );
      saveSessions(merged);
      setSessions(merged);
    } catch {
      setError("Invalid JSON.");
    }
  }, []);

  const onFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importJson(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const clearAll = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSessions([]);
    setExpandedId(null);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-dashed border-cyan-500/30 bg-cyan-500/5 p-5">
        <h2 className="font-semibold text-zinc-100">Import session JSON</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Browsers cannot capture system audio on macOS. Run the CLI, then paste or
          upload exported session JSON here (local only, stored in your browser).
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="cursor-pointer rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-[#041018] hover:bg-cyan-400">
            Upload JSON
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const sample: AudioLensSession = {
                id: "demo-session",
                title: "Demo — podcast chunk",
                startedAt: new Date().toISOString(),
                chunks: [
                  {
                    transcript:
                      "The central bank held rates steady but signaled cuts later this year.",
                    language: "en",
                    analysis:
                      "Neutral policy tone; market may price in easing. Watch forward guidance in Q3.",
                    recordedAt: new Date().toISOString(),
                  },
                ],
              };
              importJson(JSON.stringify(sample, null, 2));
            }}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5"
          >
            Load demo session
          </button>
          {sessions.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300"
            >
              Clear all
            </button>
          )}
        </div>
        <textarea
          className="mt-4 h-28 w-full rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs text-zinc-300"
          placeholder='{"id":"...","startedAt":"...","chunks":[...]}'
          onBlur={(e) => {
            if (e.target.value.trim()) importJson(e.target.value);
          }}
        />
        {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-zinc-500">No sessions yet. Import JSON or load the demo.</p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03]"
                onClick={() =>
                  setExpandedId(expandedId === session.id ? null : session.id)
                }
              >
                <div>
                  <p className="font-medium text-zinc-100">
                    {session.title ?? session.id}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {new Date(session.startedAt).toLocaleString()} ·{" "}
                    {session.chunks.length} chunk
                    {session.chunks.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="text-zinc-500">{expandedId === session.id ? "−" : "+"}</span>
              </button>
              {expandedId === session.id && (
                <div className="border-t border-white/10 px-4 py-3 space-y-4">
                  {session.chunks.map((chunk, i) => (
                    <div key={`${session.id}-${i}`} className="space-y-2 text-sm">
                      <p className="text-xs text-zinc-500">
                        {chunk.language} · {new Date(chunk.recordedAt).toLocaleTimeString()}
                      </p>
                      <p className="rounded-lg bg-amber-500/10 p-3 text-amber-100/90">
                        {chunk.transcript}
                      </p>
                      <p className="rounded-lg bg-cyan-500/10 p-3 text-cyan-100/90">
                        {chunk.analysis}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
