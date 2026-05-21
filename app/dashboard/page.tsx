import type { Metadata } from "next";
import Link from "next/link";
import { PipelineFlow } from "@/components/pipeline-flow";
import { SessionImport } from "@/components/session-import";
import { BRIDGE_ROADMAP } from "@/lib/pipeline";

export const metadata: Metadata = {
  title: "History",
  description:
    "Import AudioLens session JSON from the macOS CLI or future cloud exports.",
};

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Session history</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Import JSON from the{" "}
          <Link href="/#mac-cli" className="text-cyan-400 hover:underline">
            macOS CLI
          </Link>{" "}
          (when export is enabled). For new analysis, use{" "}
          <Link href="/analyze" className="text-cyan-400 hover:underline">
            Analyze audio
          </Link>
          .
        </p>
      </div>

      <section className="mb-10 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4 text-sm text-cyan-100/90">
        <strong className="font-medium">Primary product:</strong> cloud upload at{" "}
        <Link href="/analyze" className="underline">
          /analyze
        </Link>{" "}
        — no local install required.
      </section>

      <section className="mb-12">
        <SessionImport />
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-zinc-500">
          Cloud pipeline
        </h2>
        <PipelineFlow compact />
      </section>

      <section className="rounded-xl border border-white/10 p-5 text-sm text-zinc-400">
        <h2 className="font-semibold text-zinc-200">Roadmap</h2>
        <ul className="mt-3 list-inside list-disc space-y-1">
          {BRIDGE_ROADMAP.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-zinc-500">
          Session JSON shape:{" "}
          <code className="text-cyan-300/80">
            {"{ id, startedAt, chunks: [{ transcript, language, analysis, recordedAt }] }"}
          </code>
        </p>
      </section>
    </main>
  );
}
