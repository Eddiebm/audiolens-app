import type { Metadata } from "next";
import { AudioProcessor } from "@/components/audio-processor";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Analyze audio",
  description:
    "Upload or record audio — cloud transcription and AI analysis. No BlackHole or Mac CLI required.",
};

export default function AnalyzePage() {
  return (
    <main className="mx-auto max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Analyze audio</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {SITE_NAME} runs transcription and analysis on the server. Works from any device
          with a browser — no install on your computer.
        </p>
      </div>
      <AudioProcessor />
    </main>
  );
}
