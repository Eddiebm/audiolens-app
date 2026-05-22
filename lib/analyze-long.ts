import {
  analyzeTranscript,
  HOLISTIC_SUMMARY_INSTRUCTION,
  SECTION_ANALYSIS_INSTRUCTION,
} from "@/lib/analyze";
import { EMPTY_USAGE, mergeUsage, type TokenUsage } from "@/lib/cost";
import type { AnalysisPresetId } from "@/lib/prompt-presets";
import { splitTranscriptSections } from "@/lib/section-split";
import type { SectionAnalysis } from "@/lib/types";

export type LongAnalysisResult = {
  sections: SectionAnalysis[];
  summary: string;
  analysis: string;
  usage: TokenUsage;
};

/** Server-side long transcript analysis (mirrors client analyzeLongTranscript). */
export async function runLongAnalysis(
  transcript: string,
  language: string,
  presetId: AnalysisPresetId,
  fastMode: boolean
): Promise<LongAnalysisResult> {
  let usage = EMPTY_USAGE;

  if (fastMode) {
    const { analysis, usage: u } = await analyzeTranscript(transcript, language, {
      presetId,
      fastMode: true,
    });
    if (u) usage = mergeUsage(usage, u);
    return {
      sections: [],
      summary: analysis,
      analysis,
      usage,
    };
  }

  const parts = splitTranscriptSections(transcript);
  const sections: SectionAnalysis[] = [];

  if (parts.length <= 1) {
    const { analysis, usage: u } = await analyzeTranscript(transcript, language, {
      presetId,
    });
    if (u) usage = mergeUsage(usage, u);
    return {
      sections: [],
      summary: analysis,
      analysis,
      usage,
    };
  }

  for (const part of parts) {
    const { analysis, usage: u } = await analyzeTranscript(part.text, language, {
      presetId,
      instruction: `${SECTION_ANALYSIS_INSTRUCTION}\n\nSection: ${part.title}`,
    });
    if (u) usage = mergeUsage(usage, u);
    sections.push({ title: part.title, analysis });
  }

  const { analysis: summary, usage: summaryUsage } = await analyzeTranscript(
    transcript,
    language,
    {
      presetId,
      instruction: HOLISTIC_SUMMARY_INSTRUCTION,
    }
  );
  if (summaryUsage) usage = mergeUsage(usage, summaryUsage);

  return {
    sections,
    summary,
    analysis: summary,
    usage,
  };
}
