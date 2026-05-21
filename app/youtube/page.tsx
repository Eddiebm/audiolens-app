import type { Metadata } from "next";
import { AudioProcessor } from "@/components/audio-processor";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "YouTube capture",
  description:
    "Capture a Chrome tab playing YouTube (or any video), transcribe in chunks, and get section summaries plus an executive summary.",
};

export default function YoutubePage() {
  return (
    <main className="mx-auto max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">YouTube & long video</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {SITE_NAME} — one-click tab capture for lectures, podcasts, and streams.
        </p>
      </div>
      <AudioProcessor mode="youtube" />
    </main>
  );
}
