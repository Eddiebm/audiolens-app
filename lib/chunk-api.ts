export type ProcessAudioChunkRequest = {
  sessionId: string;
  chunkIndex: number;
  totalChunks: number;
  audioBase64: string;
  mimeType: string;
  filename?: string;
};

export type ProcessAudioChunkResponse = {
  transcript: string;
  language: string;
  chunkIndex: number;
  transcriptionProvider: string;
};

export type AnalyzeTextRequest = {
  transcript: string;
  language?: string;
  presetId?: string;
  instruction?: string;
};

export type AnalyzeTextResponse = {
  analysis: string;
  language: string;
  processedAt: string;
  usage?: { promptTokens: number; completionTokens: number };
};

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
