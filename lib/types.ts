import type { CostAccuracy, SessionCostBreakdown } from "@/lib/cost";

export type TranscriptChunk = {
  transcript: string;
  language: string;
  analysis: string;
  recordedAt: string;
};

export type SectionAnalysis = {
  title: string;
  analysis: string;
};

export type AudioLensSession = {
  id: string;
  title?: string;
  startedAt: string;
  chunks: TranscriptChunk[];
  /** Full merged transcript (web cloud sessions) */
  transcript?: string;
  /** Holistic or single-shot analysis */
  analysis?: string;
  summary?: string;
  sections?: SectionAnalysis[];
  language?: string;
  source?: "web" | "cli";
  costUsd?: number;
  costAccuracy?: CostAccuracy;
};

export type ProcessResult = {
  transcript: string;
  language: string;
  analysis: string;
  summary?: string;
  sections?: SectionAnalysis[];
  transcriptionProvider: string;
  processedAt: string;
  /** @deprecated Use cost.sessionTotalUsd */
  estimatedCostUsd?: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
  };
  cost?: SessionCostBreakdown;
};
