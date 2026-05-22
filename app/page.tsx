import Link from "next/link";
import { PipelineFlow } from "@/components/pipeline-flow";
import {
  BRIDGE_ROADMAP,
  CLI_PIPELINE_STEPS,
  CLOUD_PIPELINE_STEPS,
  SYSTEM_AUDIO_LIMITATION,
} from "@/lib/pipeline";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export default function Home() {
  return (
    <main>
      <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(34,211,238,0.25), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-cyan-400/90">
            Live intelligence for what you&apos;re listening to
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl sm:leading-[1.1]">
            Lectures, YouTube, and meetings —{" "}
            <span className="text-cyan-300">structured notes in minutes</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-zinc-400">
            {SITE_NAME} captures what you&apos;re hearing (browser tab or Mac system
            audio), transcribes it, and returns structured notes — not another generic file
            uploader. Built for long-form listening: courses, investor calls, sermons, and
            deep YouTube sessions.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/youtube"
              className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-full bg-violet-500 px-6 text-sm font-semibold text-white transition hover:bg-violet-400"
            >
              Capture YouTube tab
            </Link>
            <Link
              href="/analyze"
              className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-full bg-cyan-500 px-6 text-sm font-semibold text-[#041018] transition hover:bg-cyan-400"
            >
              Upload or advanced
            </Link>
            <a
              href="#mac-cli"
              className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-full border border-white/15 px-6 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
            >
              macOS system audio (CLI)
            </a>
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            {SITE_TAGLINE}. API keys stay on the server (Vercel env vars).
          </p>
        </div>
      </section>

      <section
        id="problem"
        className="border-y border-white/10 bg-white/[0.02] px-4 py-16 sm:px-6"
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-sm font-medium uppercase tracking-widest text-zinc-500">
            The problem
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-xl text-zinc-200">
            You have a recording, webinar, or voice memo — and you want meaning, not just
            raw text.
          </p>
          <ul className="mx-auto mt-10 grid max-w-3xl gap-4 text-sm text-zinc-400 sm:grid-cols-3">
            <li className="rounded-lg border border-white/10 p-4">
              Installing BlackHole and a Python CLI blocks non-Mac users entirely.
            </li>
            <li className="rounded-lg border border-white/10 p-4">
              Local Whisper is great for privacy but heavy to set up on every device.
            </li>
            <li className="rounded-lg border border-white/10 p-4">
              Transcripts without analysis leave you scrolling instead of deciding.
            </li>
          </ul>
        </div>
      </section>

      <section id="solution" className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-sm font-medium uppercase tracking-widest text-zinc-500">
            Cloud path (primary)
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-xl text-zinc-200">
            Upload mp3, m4a, wav, or webm — record your mic — or capture a tab/screen while
            a video plays (enable shared audio in the browser picker). We transcribe in the
            cloud and analyze with OpenRouter.
          </p>
          <div className="mt-10">
            <PipelineFlow steps={CLOUD_PIPELINE_STEPS} />
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-t border-white/10 px-4 py-16 sm:px-6"
      >
        <div className="mx-auto max-w-3xl">
          <h2 className="text-lg font-semibold text-zinc-100">
            Honest limitation: system audio
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {SYSTEM_AUDIO_LIMITATION}
          </p>
          <ul className="mt-6 space-y-2 text-sm text-zinc-500">
            {BRIDGE_ROADMAP.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-cyan-500">→</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="mac-cli"
        className="border-t border-white/10 bg-white/[0.02] px-4 py-16 sm:px-6"
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="text-lg font-semibold text-zinc-100">
            Advanced: macOS live system audio (CLI)
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Optional path for power users who want{" "}
            <strong className="text-zinc-200">live</strong> capture of everything playing
            on the Mac — BlackHole, local faster-whisper, terminal output. Repo:{" "}
            <code className="text-cyan-300/80">~/audiolens</code>.
          </p>
          <div className="mt-8">
            <PipelineFlow steps={CLI_PIPELINE_STEPS} compact />
          </div>
          <pre className="mt-6 overflow-x-auto rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-xs text-cyan-100/90">
{`cd ~/audiolens
./setup.sh
export OPENROUTER_API_KEY='...'   # or ANTHROPIC_API_KEY
python3 main.py`}
          </pre>
        </div>
      </section>
    </main>
  );
}
