import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

const nav = [
  { href: "/youtube", label: "YouTube" },
  { href: "/analyze", label: "Analyze" },
  { href: "/dashboard", label: "History" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-white/8 bg-black/90 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="font-semibold tracking-tight text-white">
          {SITE_NAME}
        </Link>
        <nav className="flex items-center gap-6 text-sm text-zinc-500">
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
