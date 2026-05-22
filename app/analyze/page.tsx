import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AudioProcessor } from "@/components/audio-processor";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Analyze audio",
  description:
    "Upload, record your mic, or capture tab/screen audio — cloud transcription and AI analysis.",
  alternates: { canonical: "/analyze" },
};

type Props = {
  searchParams: Promise<{ mode?: string }>;
};

export default async function AnalyzePage({ searchParams }: Props) {
  const params = await searchParams;
  const mode = params.mode?.toLowerCase();

  if (mode === "youtube" || mode === "yt") {
    redirect("/youtube");
  }

  const youtubeDefault = process.env.NEXT_PUBLIC_DEFAULT_ANALYZE_MODE === "youtube";

  if (youtubeDefault && !params.mode) {
    redirect("/youtube");
  }

  return (
    <main className="mx-auto max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Analyze audio</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {SITE_NAME} runs transcription and analysis on the server. For YouTube-first
          capture, use{" "}
          <a href="/youtube" className="text-violet-400 hover:underline">
            YouTube mode
          </a>
          .
        </p>
      </div>
      <AudioProcessor mode="full" />
    </main>
  );
}
