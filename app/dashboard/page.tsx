import type { Metadata } from "next";
import Link from "next/link";
import { CostDashboard } from "@/components/cost-dashboard";
import { CostSettings } from "@/components/cost-settings";

export const metadata: Metadata = {
  title: "History",
  description:
    "Session history for AudioLens — transcripts and analyses from your cloud sessions.",
  alternates: { canonical: "/dashboard" },
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

      <section className="mb-10">
        <CostDashboard />
        <p className="mt-2 text-xs text-zinc-500">
          Tracked in this browser. Clear browser data and this resets.
        </p>
      </section>

      <section className="mb-10">
        <CostSettings />
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
        <h2 className="font-semibold text-zinc-200">Session history is coming soon.</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
          Your transcripts and analyses will live here once we ship cloud persistence.
          For now, download your results after each session using the export button on{" "}
          <Link href="/analyze" className="text-cyan-400 hover:underline">
            /analyze
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
