import { SECTION_CHARS } from "@/lib/capture-config";

export type TranscriptSection = {
  title: string;
  text: string;
};

/** Split transcript into ~10-minute sections by character count */
export function splitTranscriptSections(
  transcript: string,
  charsPerSection = SECTION_CHARS
): TranscriptSection[] {
  const trimmed = transcript.trim();
  if (!trimmed) return [];

  if (trimmed.length <= charsPerSection) {
    return [{ title: "Full recording", text: trimmed }];
  }

  const paragraphs = trimmed.split(/\n\n+/);
  const sections: TranscriptSection[] = [];
  let buffer = "";
  let part = 1;

  const flush = () => {
    if (!buffer.trim()) return;
    const mins = Math.round((part - 1) * (charsPerSection / 900) + 1);
    sections.push({
      title: `Part ${part} (~${mins} min)`,
      text: buffer.trim(),
    });
    part += 1;
    buffer = "";
  };

  for (const para of paragraphs) {
    const next = buffer ? `${buffer}\n\n${para}` : para;
    if (next.length > charsPerSection && buffer) {
      flush();
      buffer = para;
    } else {
      buffer = next;
    }
  }
  flush();

  return sections.length ? sections : [{ title: "Full recording", text: trimmed }];
}
