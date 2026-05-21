import type { Metadata } from "next";
import { AudioProcessor } from "@/components/audio-processor";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Analyze audio",
  description:
    "Upload, record your mic, or capture tab/screen audio — cloud transcription and AI analysis. No BlackHole required for browser capture.",
};

export default function AnalyzePage() {
  return (
    <main className="mx-auto max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Analyze audio</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {SITE_NAME} runs transcription and analysis on the server. Upload a file, use
          your mic, or capture audio from a browser tab or desktop window — no BlackHole
          install required for the web path.
        </p>
      </div>
      <AudioProcessor />
    </main>
  );
}
