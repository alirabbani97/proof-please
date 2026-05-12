"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

import { explorerAddr } from "@/lib/explorer";

// Use our own button (always visible, browser-portable). The
// `WalletMultiButton` from wallet-adapter-react-ui renders as `transparent`
// on Edge when no wallet is detected, which makes it invisible on the dark
// nav. Same modal + UX underneath; just guaranteed-visible chrome.
const ConnectWalletButton = dynamic(
  () =>
    import("@/components/connect-wallet-button").then(
      (m) => m.ConnectWalletButton,
    ),
  { ssr: false },
);

const LINKS = [
  { href: "/projects", label: "Projects" },
  { href: "/submit", label: "Submit" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pool", label: "Pool" },
];

const PLACEHOLDER_PROGRAM_ID = "11111111111111111111111111111111";

export function Nav() {
  const pathname = usePathname();
  const programId = process.env.NEXT_PUBLIC_PROGRAM_ID;
  const network = process.env.NEXT_PUBLIC_NETWORK ?? "devnet";
  const deployed =
    programId && programId !== PLACEHOLDER_PROGRAM_ID ? programId : null;
  return (
    <header className="flex items-center justify-between gap-4 px-4 sm:px-6 py-4 border-b border-white/5 backdrop-blur-md sticky top-0 bg-rep-bg/85 z-30">
      <Link href="/" className="flex items-center gap-3 group">
        <Image
          src="/indie-pool-logo.png"
          alt="Proof, please! logo"
          width={1536}
          height={1024}
          priority
          className="h-9 w-auto object-contain transition-transform group-hover:scale-105"
        />
        <div className="leading-tight">
          <p className="text-sm sm:text-base font-semibold tracking-tight">
            Proof, <span className="text-rep-cyan">please!</span>
          </p>
          <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-rep-muted">
            indie-pool · {network}
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

      <div className="flex items-center gap-2 sm:gap-3">
        {deployed && (
          <a
            href={explorerAddr(deployed)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Program: ${deployed}`}
            className="hidden md:inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1.5 border border-rep-success/30 text-rep-success hover:bg-rep-success/10 transition-colors"
          >
            <span className="size-1.5 rounded-full bg-rep-success animate-pulse" />
            <span>live · {network}</span>
            <span className="text-rep-success/60">↗</span>
          </a>
        )}
        <ConnectWalletButton />
      </div>
    </header>
  );
}
