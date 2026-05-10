import { Nav } from "@/components/nav";
import { TruncatedKey } from "@/components/truncate-key";

/**
 * Project Pool screen — UI preview only.
 *
 * Per the locked decisions in CLAUDE.md, escrow logic is NOT implemented
 * on-chain for the MVP. This page renders mocked data so judges/testers
 * can see the intended escrow flow. The banner at the top is honest
 * about what's mocked vs real.
 *
 * When `create_project_escrow` + `release_milestone` are added on-chain,
 * the data plumbing here moves into the indie-pool client; the layout
 * stays.
 */

const PROJECT = {
  name: "Supercool RPG",
  description:
    "Open-world fantasy with procedural dungeons and player-driven economies.",
  creator: "5fJWp5n7sKxpYKZRb1H8xW9Z5J8QqPJxNkDc3LVhV1xT",
  totalEscrow: 12.5,
  paid: 7.25,
  available: 5.25,
  contributors: 7,
};

const MILESTONES: Milestone[] = [
  {
    id: 1,
    title: "Procedural dungeon generator",
    reward: 2.5,
    status: "paid",
    progress: 1.0,
    contributors: 2,
  },
  {
    id: 2,
    title: "Cover art + key visuals",
    reward: 1.75,
    status: "paid",
    progress: 1.0,
    contributors: 1,
  },
  {
    id: 3,
    title: "Soundtrack · first chapter",
    reward: 3.0,
    status: "paid",
    progress: 1.0,
    contributors: 1,
  },
  {
    id: 4,
    title: "Combat AI v2",
    reward: 2.5,
    status: "in_progress",
    progress: 0.66,
    contributors: 3,
  },
  {
    id: 5,
    title: "Multiplayer netcode",
    reward: 2.75,
    status: "locked",
    progress: 0,
    contributors: 0,
  },
];

const RECENT_PAYOUTS = [
  {
    contributor: "9aLLzRrZ3vF8xt2pKeBbGY7D1nQ5cWAVhY9bM4kJfH8s",
    amount: 1.25,
    milestone: "Procedural dungeon generator",
    at: "2h ago",
  },
  {
    contributor: "7kP2rVzN9bFcXmYqRdEWxvHJtL4G6sAUcK1wM3pTn8B",
    amount: 1.75,
    milestone: "Cover art",
    at: "1d ago",
  },
  {
    contributor: "3xT9pN5kBcRYqHhJsW8rAVGLnD4mU2zQ7vKpM6jXyF1",
    amount: 3.0,
    milestone: "Soundtrack",
    at: "3d ago",
  },
];

interface Milestone {
  id: number;
  title: string;
  reward: number;
  status: "paid" | "in_progress" | "locked";
  progress: number;
  contributors: number;
}

export default function PoolPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Nav />
      <section className="flex-1 px-4 sm:px-6 py-10 sm:py-14">
        <div className="max-w-5xl mx-auto space-y-8">
          <PreviewBanner />

          <header>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-rep-purple mb-2">
              project pool · escrow
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              {PROJECT.name}
            </h1>
            <p className="text-rep-muted text-sm mt-3 max-w-xl leading-relaxed">
              {PROJECT.description}
            </p>
            <p className="font-mono text-xs text-rep-muted mt-3">
              creator <TruncatedKey pubkey={PROJECT.creator} />
              <span className="mx-3 opacity-30">|</span>
              {PROJECT.contributors} contributors
            </p>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SolStat
              label="total escrow"
              amount={PROJECT.totalEscrow}
              accent="cyan"
            />
            <SolStat label="paid out" amount={PROJECT.paid} accent="success" />
            <SolStat
              label="available"
              amount={PROJECT.available}
              accent="purple"
            />
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Milestones</h2>
            <div className="space-y-3">
              {MILESTONES.map((m) => (
                <MilestoneRow key={m.id} m={m} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              Recent payouts
            </h2>
            <div className="rounded-xl border border-white/5 bg-rep-card/40 divide-y divide-white/5">
              {RECENT_PAYOUTS.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm truncate">
                      <TruncatedKey
                        pubkey={p.contributor}
                        className="text-rep-fg"
                      />
                    </p>
                    <p className="text-xs text-rep-muted truncate">
                      {p.milestone}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-rep-cyan font-semibold text-sm">
                      +{p.amount} SOL
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-rep-muted">
                      {p.at}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function PreviewBanner() {
  return (
    <div className="px-4 py-4 rounded-lg border border-rep-purple/30 bg-rep-purple/5 space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-rep-purple">
        layer 2 · escrow rewards
      </p>
      <p className="text-xs text-rep-muted leading-relaxed">
        Project creators fund a Solana escrow PDA. The AI scorer&apos;s
        verification of contribution milestones unlocks proportional SOL
        payouts to verified contributors — milestone-gated, trustless,
        auditable on-chain. Reputation (Layer 1) is earned via{" "}
        <span className="text-rep-fg">non-transferable Soulbound Tokens</span>;
        SOL (Layer 2) flows on top of that signal.
      </p>
      <p className="text-[11px] text-rep-muted/70 italic">
        Data on this page is illustrative — escrow state plumbing lands
        post-MVP. The contribution → score → REP flow on /submit and
        /dashboard is real.
      </p>
    </div>
  );
}

function SolStat({
  label,
  amount,
  accent,
}: {
  label: string;
  amount: number;
  accent: "cyan" | "success" | "purple";
}) {
  const color =
    accent === "cyan"
      ? "text-rep-cyan"
      : accent === "success"
      ? "text-rep-success"
      : "text-rep-purple";
  return (
    <div className="rounded-xl border border-white/5 bg-rep-card/40 p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-rep-muted mb-3">
        {label}
      </p>
      <p className="flex items-baseline gap-2">
        <span className={`text-3xl font-semibold ${color}`}>{amount}</span>
        <span className="font-mono text-xs text-rep-muted">SOL</span>
      </p>
    </div>
  );
}

function MilestoneRow({ m }: { m: Milestone }) {
  const statusLabel = {
    paid: "paid",
    in_progress: "in progress",
    locked: "locked",
  }[m.status];
  const statusColor = {
    paid: "text-rep-success bg-rep-success/10 border-rep-success/20",
    in_progress: "text-rep-cyan bg-rep-cyan/10 border-rep-cyan/20",
    locked: "text-rep-muted bg-white/5 border-white/10",
  }[m.status];
  const barColor = {
    paid: "bg-rep-success",
    in_progress: "bg-rep-cyan",
    locked: "bg-white/10",
  }[m.status];

  return (
    <article className="rounded-xl border border-white/5 bg-rep-card/40 p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{m.title}</p>
          <p className="text-xs text-rep-muted mt-0.5 font-mono">
            {m.contributors} contributor{m.contributors === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`font-mono text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded border ${statusColor}`}
          >
            {statusLabel}
          </span>
          <span className="font-mono text-rep-cyan font-semibold text-sm">
            {m.reward} SOL
          </span>
        </div>
      </div>
      <div className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full ${barColor} rep-bar-fill ${m.status === "in_progress" ? "rep-pulse" : ""}`}
          style={{ width: `${Math.round(m.progress * 100)}%` }}
        />
      </div>
    </article>
  );
}
