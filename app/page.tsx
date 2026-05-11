import Link from "next/link";
import { Nav } from "@/components/nav";
import { GlitchText } from "@/components/glitch-text";
import { LiveFeed } from "@/components/live-feed";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Nav />

      {/* Hero */}
      <section className="flex-1 grid place-items-center px-6 py-20 sm:py-28">
        <div className="max-w-3xl text-center space-y-8">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-rep-cyan">
            decentralized contribution & reputation
          </p>
          <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
            <GlitchText text="Tokenize creative work." durationMs={650} />
            <br />
            <span className="text-rep-purple">
              <GlitchText text="Not just money." durationMs={850} />
            </span>
          </h1>
          <p className="text-lg text-rep-muted max-w-xl mx-auto leading-relaxed">
            Submit code, art, music, or 3D contributions. An AI scorer reads
            them and mints non-transferable reputation as Soulbound Tokens on
            Solana. Your work follows you across every project.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4 flex-wrap">
            <Link
              href="/submit"
              className="px-6 py-3 rounded-md bg-rep-cyan text-black font-medium hover:bg-rep-cyan/85 transition-colors"
            >
              Submit a contribution
            </Link>
            <Link
              href="/dashboard"
              className="px-6 py-3 rounded-md border border-white/10 hover:border-rep-purple/60 transition-colors"
            >
              View dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Live on-chain activity */}
      <LiveFeed />

      {/* How it works */}
      <section className="border-t border-white/5 bg-rep-card/30">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-rep-purple mb-2 text-center">
            how it works
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center mb-12">
            One demo flow, end-to-end on devnet
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <Step
              n={1}
              title="Submit"
              body="Drop in project, type, IPFS hash, and a description. The contributor's wallet signs a Solana transaction that opens a Contribution PDA on devnet."
            />
            <Step
              n={2}
              title="AI score"
              body="Claude reads the metadata, returns a 0-100 score plus reasoning. The oracle keypair signs verify_contribution to write the score on-chain."
            />
            <Step
              n={3}
              title="Mint REP"
              body="A Token-2022 mint with the NonTransferable extension issues `score` REP into the contributor's ATA. Soulbound by construction — can't be sold or moved."
            />
          </div>
        </div>
      </section>

      {/* The design — anchored to spec §4 (token economic model) */}
      <section className="border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-16 sm:py-20">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-10 lg:gap-16 items-start">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-rep-cyan mb-3">
                the design
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-[1.15] mb-5">
                Built against{" "}
                <span className="text-rep-purple">2025&apos;s</span>
                <br className="hidden sm:block" /> failure modes
              </h2>
              <p className="text-sm text-rep-muted leading-relaxed">
                Over 90% of gaming token launches in 2025 lost their initial
                value. Four design constraints — each chosen to dodge a
                specific failure mode of speculative-token economies.
              </p>
            </div>
            <ol className="space-y-7">
              <Pillar
                n="01"
                accent="cyan"
                title="No speculative token"
                body="Anchored to SOL and Soulbound reputation, not a fungible vehicle. No fundraising round, no pump pressure, no regulatory exposure at MVP."
              />
              <Pillar
                n="02"
                accent="purple"
                title="Reputation, not holdings"
                body="REP tokens are earned via verified work, not purchased. One contributor, one voice — non-transferable by construction; whales can't buy in."
              />
              <Pillar
                n="03"
                accent="cyan"
                title="Talent-first funding"
                body="Creative work — code, art, music, 3D — becomes a verifiable on-chain asset. Indie studios fund contributors directly; no VCs, publishers, or gatekeepers."
              />
              <Pillar
                n="04"
                accent="purple"
                title="AI replaces DAOs"
                body="Small indie teams don't need committee governance. AI scoring gives them DAO-grade verification at the speed of solo development."
              />
            </ol>
          </div>
        </div>
      </section>

      <footer className="px-6 py-6 text-center text-xs font-mono text-rep-muted border-t border-white/5">
        brutales xyz · without boundaries of any kind
      </footer>
    </main>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-rep-bg/40 p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="size-8 rounded-md bg-gradient-to-br from-rep-cyan/30 to-rep-purple/30 grid place-items-center font-mono text-sm text-rep-cyan">
          {n}
        </div>
        <p className="font-medium">{title}</p>
      </div>
      <p className="text-sm text-rep-muted leading-relaxed">{body}</p>
    </div>
  );
}

function Pillar({
  n,
  accent,
  title,
  body,
}: {
  n: string;
  accent: "cyan" | "purple";
  title: string;
  body: string;
}) {
  const borderClass =
    accent === "cyan" ? "border-rep-cyan/40" : "border-rep-purple/40";
  const accentClass =
    accent === "cyan" ? "text-rep-cyan" : "text-rep-purple";
  return (
    <li className={`pl-5 border-l-2 ${borderClass}`}>
      <p className="flex items-baseline gap-3 mb-1.5">
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.25em] ${accentClass} tabular-nums`}
        >
          {n}
        </span>
        <span className="font-medium">{title}</span>
      </p>
      <p className="text-sm text-rep-muted leading-relaxed">{body}</p>
    </li>
  );
}
