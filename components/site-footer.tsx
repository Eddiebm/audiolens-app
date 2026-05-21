import { SITE_NAME } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/10 py-8 text-center text-sm text-zinc-500">
      <p>
        {SITE_NAME} — macOS CLI for capture, local Whisper, Claude analysis. Web app
        for history and setup (v1).
      </p>
    </footer>
  );
}
