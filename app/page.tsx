import Link from "next/link";
import { PipelineFlow } from "@/components/pipeline-flow";
import { BRIDGE_ROADMAP } from "@/lib/pipeline";
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
            macOS · local Whisper · live analysis
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl sm:leading-[1.1]">
            Understand any audio playing on your Mac —{" "}
            <span className="text-cyan-300">as it happens</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-zinc-400">
            {SITE_NAME} is a meeting and media copilot for macOS power users: capture{" "}
            <strong className="font-medium text-zinc-200">system audio</strong> (not just
            your mic), transcribe on-device, and get concise Claude analysis in the
            terminal — without sending raw audio to the cloud.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-full bg-cyan-500 px-6 text-sm font-semibold text-[#041018] transition hover:bg-cyan-400"
            >
              Open dashboard
            </Link>
            <a
              href="#setup"
              className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-full border border-white/15 px-6 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
            >
              CLI setup
            </a>
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            No install in the browser — capture requires the macOS CLI + BlackHole.
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
            You are listening to a podcast, webinar, or foreign-language stream — and you
            want <em>meaning</em> in real time, not a transcript dump after the fact.
          </p>
          <ul className="mx-auto mt-10 grid max-w-3xl gap-4 text-sm text-zinc-400 sm:grid-cols-3">
            <li className="rounded-lg border border-white/10 p-4">
              Cloud meeting bots need calendar invites and send audio off-device.
            </li>
            <li className="rounded-lg border border-white/10 p-4">
              Mic-based tools miss what is actually playing on your speakers.
            </li>
            <li className="rounded-lg border border-white/10 p-4">
              Raw STT without analysis leaves you scrolling instead of deciding.
            </li>
          </ul>
        </div>
      </section>

      <section id="solution" className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-sm font-medium uppercase tracking-widest text-zinc-500">
            The solution
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-xl text-zinc-200">
            {SITE_TAGLINE}: BlackHole capture, local faster-whisper, Claude on text only.
          </p>
          <div className="mt-10">
            <PipelineFlow />
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="border-t border-white/10 px-4 py-16 sm:px-6"
      >
        <div className="mx-auto max-w-3xl">
          <h2 className="text-lg font-semibold text-zinc-100">Honest platform split</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Safari and Chrome cannot tap macOS system audio without a native helper. v1
            keeps capture in the Python CLI; this web app is your setup guide, pipeline
            map, and transcript history surface.
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
        id="setup"
        className="border-t border-white/10 bg-white/[0.02] px-4 py-16 sm:px-6"
      >
        <div className="mx-auto max-w-3xl">
          <h2 className="text-lg font-semibold text-zinc-100">Quick CLI setup</h2>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-xs text-cyan-100/90">
{`cd ~/audiolens
./setup.sh
brew install blackhole-2ch   # if needed
export ANTHROPIC_API_KEY='...'
python3 main.py`}
          </pre>
          <p className="mt-4 text-sm text-zinc-500">
            Configure a Multi-Output Device in Audio MIDI Setup so you hear audio and
            route it to BlackHole. See the CLI README for device flags and Whisper sizes.
          </p>
        </div>
      </section>
    </main>
  );
}
