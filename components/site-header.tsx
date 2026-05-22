import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

const nav = [
  { href: "/youtube", label: "YouTube" },
  { href: "/analyze", label: "Analyze" },
  { href: "/dashboard", label: "History" },
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
        </nav>
      </div>
    </header>
  );
}
