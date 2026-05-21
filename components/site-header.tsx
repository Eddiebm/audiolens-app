import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

const nav = [
  { href: "/analyze", label: "Analyze" },
  { href: "/dashboard", label: "History" },
  { href: "/#how-it-works", label: "How it works" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-[#070b12]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-cyan-500/20 text-sm text-cyan-300">
            AL
          </span>
          {SITE_NAME}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-zinc-400">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition hover:text-zinc-100"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/analyze"
            className="rounded-full bg-cyan-500 px-3 py-1.5 text-xs font-medium text-[#041018] transition hover:bg-cyan-400"
          >
            Open app
          </Link>
        </nav>
      </div>
    </header>
  );
}
