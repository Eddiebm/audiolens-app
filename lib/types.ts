export type TranscriptChunk = {
  transcript: string;
  language: string;
  analysis: string;
  recordedAt: string;
};

export type AudioLensSession = {
  id: string;
  title?: string;
  startedAt: string;
  chunks: TranscriptChunk[];
};
