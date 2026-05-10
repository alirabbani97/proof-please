"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false },
);

const LINKS = [
  { href: "/submit", label: "Submit" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pool", label: "Pool" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="flex items-center justify-between gap-4 px-4 sm:px-6 py-4 border-b border-white/5 backdrop-blur-md sticky top-0 bg-rep-bg/85 z-30">
      <Link href="/" className="flex items-center gap-3 group">
        <div className="size-8 rounded bg-gradient-to-br from-rep-cyan to-rep-purple grid place-items-center font-mono text-xs text-black font-bold transition-transform group-hover:scale-105">
          PP
        </div>
        <div className="leading-tight">
          <p className="text-sm sm:text-base font-semibold tracking-tight">
            Proof, <span className="text-rep-cyan">please!</span>
          </p>
          <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-rep-muted">
            indie-pool · devnet
          </p>
        </div>
      </Link>

      <nav className="hidden sm:flex items-center gap-1 font-mono text-sm">
        {LINKS.map((l) => {
          const active =
            pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                active
                  ? "text-rep-cyan bg-rep-cyan/10"
                  : "text-rep-muted hover:text-rep-fg hover:bg-white/5"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>

      <WalletMultiButton />
    </header>
  );
}
