import type { AudioLensSession } from "@/lib/types";

export const STORAGE_KEY = "audiolens:sessions";

export function loadSessions(): AudioLensSession[] {
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

export function saveSessions(sessions: AudioLensSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function upsertSession(session: AudioLensSession) {
  const existing = loadSessions();
  const idx = existing.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    existing[idx] = session;
  } else {
    existing.unshift(session);
  }
  saveSessions(existing.slice(0, 50));
}

export function sessionTitleFromTranscript(transcript: string): string {
  const line = transcript.split(/\n/).find((l) => l.trim().length > 20);
  const snippet = (line ?? transcript).trim().slice(0, 72);
  return snippet.length < transcript.trim().length ? `${snippet}…` : snippet;
}

export function sessionToMarkdown(session: AudioLensSession): string {
  const lines = [
    `# ${session.title ?? session.id}`,
    ``,
    `_Started ${new Date(session.startedAt).toLocaleString()}_`,
    ``,
  ];
  if (session.summary?.trim()) {
    lines.push(`## Summary`, ``, session.summary.trim(), ``);
  }
  if (session.chunks.length) {
    for (let i = 0; i < session.chunks.length; i++) {
      const c = session.chunks[i];
      lines.push(
        `## Chunk ${i + 1} (${c.language})`,
        ``,
        `### Transcript`,
        ``,
        c.transcript,
        ``,
        `### Analysis`,
        ``,
        c.analysis,
        ``
      );
    }
  } else if (session.transcript?.trim()) {
    lines.push(`## Transcript`, ``, session.transcript.trim(), ``);
    if (session.analysis?.trim()) {
      lines.push(`## Analysis`, ``, session.analysis.trim(), ``);
    }
  }
  if (session.sections?.length) {
    lines.push(`## Sections`, ``);
    for (const sec of session.sections) {
      lines.push(`### ${sec.title}`, ``, sec.analysis, ``);
    }
  }
  return lines.join("\n");
}
