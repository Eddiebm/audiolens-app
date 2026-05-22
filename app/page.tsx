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
      <section className="px-4 pb-20 pt-20 sm:px-6 sm:pt-28">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl sm:leading-[1.1]">
            Lectures, YouTube, and meetings —{" "}
            structured notes in minutes
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-500">
            Captures what you&apos;re hearing, transcribes it, and returns structured notes.
            Built for long-form listening: courses, investor calls, sermons, and deep YouTube
            sessions.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/analyze"
              className="inline-flex h-10 items-center rounded bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-100"
            >
              Start analyzing
            </Link>
            <Link
              href="/youtube"
              className="inline-flex h-10 items-center rounded border border-white/15 px-5 text-sm font-medium text-zinc-300 transition hover:border-white/30 hover:text-white"
            >
              YouTube mode
            </Link>
            <a
              href="#mac-cli"
              className="inline-flex h-10 items-center px-5 text-sm font-medium text-zinc-600 transition hover:text-zinc-400"
            >
              macOS CLI →
            </a>
          </div>
        </div>
      </section>

      <section
        id="problem"
        className="border-t border-white/[0.07] px-4 py-16 sm:px-6"
      >
        <div className="mx-auto max-w-5xl">
          <p className="max-w-2xl text-base text-zinc-500">
            You have a recording, webinar, or voice memo — and you want meaning, not just
            raw text.
          </p>
          <ul className="mt-8 grid max-w-3xl gap-px border border-white/[0.07] text-sm text-zinc-500 sm:grid-cols-3">
            <li className="bg-black p-5">
              Installing BlackHole and a Python CLI blocks non-Mac users entirely.
            </li>
            <li className="border-t border-white/[0.07] bg-black p-5 sm:border-l sm:border-t-0">
              Local Whisper is great for privacy but heavy to set up on every device.
            </li>
            <li className="border-t border-white/[0.07] bg-black p-5 sm:border-l sm:border-t-0">
              Transcripts without analysis leave you scrolling instead of deciding.
            </li>
          </ul>
        </div>
      </section>

      <section id="solution" className="border-t border-white/[0.07] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <p className="max-w-2xl text-sm text-zinc-600">
            Upload mp3, m4a, wav, or webm — record your mic — or capture a tab/screen while
            a video plays. Transcribed in the cloud, analyzed with OpenRouter.
          </p>
          <div className="mt-10">
            <PipelineFlow steps={CLOUD_PIPELINE_STEPS} />
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-t border-white/[0.07] px-4 py-16 sm:px-6"
      >
        <div className="mx-auto max-w-3xl">
          <h2 className="text-sm font-medium text-zinc-400">
            Honest limitation: system audio
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            {SYSTEM_AUDIO_LIMITATION}
          </p>
          <ul className="mt-4 space-y-1 text-sm text-zinc-600">
            {BRIDGE_ROADMAP.map((item) => (
              <li key={item} className="flex gap-2">
                <span>→</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="mac-cli"
        className="border-t border-white/[0.07] px-4 py-16 sm:px-6"
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="text-sm font-medium text-zinc-400">
            macOS live system audio (CLI)
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Optional path for power users who want live capture of everything playing on the
            Mac — BlackHole, local faster-whisper, terminal output. Repo:{" "}
            <code className="font-mono text-zinc-400">~/audiolens</code>.
          </p>
          <div className="mt-8">
            <PipelineFlow steps={CLI_PIPELINE_STEPS} compact />
          </div>
          <pre className="mt-6 overflow-x-auto border border-white/[0.07] bg-white/[0.02] p-4 font-mono text-xs text-zinc-400">
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
