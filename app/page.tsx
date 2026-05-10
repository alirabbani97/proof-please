"use client";

import dynamic from "next/dynamic";

// Wallet button is dynamically imported with SSR disabled — wallet-adapter
// reads `window` synchronously on import.
const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false },
);

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded bg-gradient-to-br from-rep-cyan to-rep-purple grid place-items-center font-mono text-xs text-black font-bold">
            PP
          </div>
          <div className="leading-tight">
            <p className="text-base font-semibold tracking-tight">
              Proof, <span className="text-rep-cyan">please!</span>
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-rep-muted">
              indie-pool · devnet
            </p>
          </div>
        </div>
        <WalletMultiButton />
      </header>

      {/* Hero */}
      <section className="flex-1 grid place-items-center px-6 py-24">
        <div className="max-w-3xl text-center space-y-8">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-rep-cyan">
            decentralized contribution & reputation
          </p>
          <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
            Tokenize creative work.
            <br />
            <span className="text-rep-purple">Not just money.</span>
          </h1>
          <p className="text-lg text-rep-muted max-w-xl mx-auto">
            Submit code, art, music, or 3D contributions. An AI scorer reads
            them, mints non-transferable reputation as Soulbound Tokens on
            Solana. Your work follows you across every project.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <a
              href="#"
              className="px-6 py-3 rounded-md bg-rep-cyan text-black font-medium hover:bg-rep-cyan/85 transition-colors"
            >
              Submit a contribution
            </a>
            <a
              href="https://github.com/brutalesxyz/indie-pool"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 rounded-md border border-white/10 hover:border-rep-purple/60 transition-colors"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Hand-off panel — visible to teammates picking up the project. */}
      <section className="border-t border-white/5 bg-rep-card/40">
        <div className="max-w-5xl mx-auto px-6 py-10 grid sm:grid-cols-3 gap-6 font-mono text-sm">
          <div>
            <p className="text-rep-cyan text-xs uppercase tracking-[0.2em] mb-2">
              hour 0 status
            </p>
            <p className="text-rep-muted leading-relaxed">
              Scaffolded. Next.js + Tailwind 4 + Solana wallet adapter wired.
              Anchor program written but not yet built.
            </p>
          </div>
          <div>
            <p className="text-rep-purple text-xs uppercase tracking-[0.2em] mb-2">
              next steps
            </p>
            <ol className="text-rep-muted leading-relaxed space-y-1 list-decimal list-inside marker:text-rep-purple/60">
              <li>install rust + anchor + solana cli</li>
              <li>anchor build && anchor keys sync</li>
              <li>implement /api/score (hour 14-18)</li>
            </ol>
          </div>
          <div>
            <p className="text-rep-cyan text-xs uppercase tracking-[0.2em] mb-2">
              docs
            </p>
            <p className="text-rep-muted leading-relaxed">
              See <span className="text-rep-fg">CLAUDE.md</span> for locked
              architecture and the 48h plan. Spec lives in{" "}
              <span className="text-rep-fg">paper please.docx</span>.
            </p>
          </div>
        </div>
      </section>

      <footer className="px-6 py-4 text-center text-xs font-mono text-rep-muted">
        brutales xyz · without boundaries of any kind
      </footer>
    </main>
  );
}
