"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AudioLensSession } from "@/lib/types";
import {
  loadSessions,
  saveSessions,
  sessionToMarkdown,
  STORAGE_KEY,
} from "@/lib/session-storage";

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
  const [query, setQuery] = useState("");

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      const hay = [
        s.title,
        s.id,
        s.transcript,
        s.summary,
        s.analysis,
        ...s.chunks.map((c) => c.transcript + c.analysis),
        ...(s.sections?.map((x) => x.title + x.analysis) ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sessions, query]);

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
        (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i
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

  const exportMarkdown = (session: AudioLensSession) => {
    const md = sessionToMarkdown(session);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audiolens-${session.id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-dashed border-cyan-500/30 bg-cyan-500/5 p-5">
        <h2 className="font-semibold text-zinc-100">Import session JSON</h2>
        <p className="mt-1 text-sm text-zinc-400">
          From the macOS CLI (<code className="text-cyan-300/80">--export-session</code>)
          or cloud runs saved automatically after analysis.
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

      {sessions.length > 0 && (
        <input
          type="search"
          placeholder="Search sessions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-sm text-zinc-200"
        />
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {sessions.length === 0
            ? "No sessions yet. Analyze audio or import CLI JSON."
            : "No sessions match your search."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((session) => (
            <li
              key={session.id}
              className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
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
                    {session.chunks.length > 0
                      ? `${session.chunks.length} chunk${session.chunks.length === 1 ? "" : "s"}`
                      : session.transcript
                        ? "cloud session"
                        : "empty"}
                    {session.source ? ` · ${session.source}` : ""}
                  </p>
                </div>
                <span className="text-zinc-500">
                  {expandedId === session.id ? "−" : "+"}
                </span>
              </button>
              {expandedId === session.id && (
                <div className="space-y-4 border-t border-white/10 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => exportMarkdown(session)}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
                  >
                    Export Markdown
                  </button>
                  {session.summary && (
                    <div className="text-sm">
                      <p className="text-xs font-medium text-cyan-400">Summary</p>
                      <p className="mt-1 text-zinc-300">{session.summary}</p>
                    </div>
                  )}
                  {session.sections?.map((sec) => (
                    <div key={sec.title} className="text-sm">
                      <p className="font-medium text-zinc-200">{sec.title}</p>
                      <p className="mt-1 text-zinc-400">{sec.analysis}</p>
                    </div>
                  ))}
                  {session.transcript && session.chunks.length === 0 && (
                    <>
                      <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-100/90">
                        {session.transcript.slice(0, 2000)}
                        {session.transcript.length > 2000 ? "…" : ""}
                      </p>
                      {session.analysis && (
                        <p className="rounded-lg bg-cyan-500/10 p-3 text-sm text-cyan-100/90">
                          {session.analysis}
                        </p>
                      )}
                    </>
                  )}
                  {session.chunks.map((chunk, i) => (
                    <div key={`${session.id}-${i}`} className="space-y-2 text-sm">
                      <p className="text-xs text-zinc-500">
                        {chunk.language} ·{" "}
                        {new Date(chunk.recordedAt).toLocaleTimeString()}
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
