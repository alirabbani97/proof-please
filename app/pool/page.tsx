"use client";

/**
 * Project Pool — Layer 2 escrows.
 *
 * Reads real on-chain ProjectEscrow accounts via the indie-pool client.
 * Aggregates total-funded / total-released across all escrows for the
 * headline stats. Each escrow card joins on-chain state with the
 * project metadata from `lib/indie-pool/projects.ts` so the visuals
 * stay consistent with /projects.
 *
 * When no escrows have been created yet, falls back to a clean empty
 * state pointing users to /projects to fund the first one.
 *
 * The "recent payouts" tile is intentionally NOT shown here — that data
 * lives in `ReleaseReceipt` PDAs and the homepage `LiveFeed` already
 * streams those events in real time. Duplicating it here would be noise.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";

import { Nav } from "@/components/nav";
import { TruncatedKey } from "@/components/truncate-key";
import { FundEscrowModal } from "@/components/fund-escrow-modal";
import { listEscrows, listProjects } from "@/lib/indie-pool/client";
import type { OnChainProject } from "@/lib/indie-pool/client";
import { projectFromOnChain, TYPE_COLOR } from "@/lib/indie-pool/projects";
import type { Project } from "@/lib/indie-pool/projects";
import type { ProjectEscrowState } from "@/lib/indie-pool/types";
import { explorerAddr } from "@/lib/explorer";

const LAMPORTS_PER_SOL = 1_000_000_000;

export default function PoolPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Nav />
      <section className="flex-1 px-4 sm:px-6 py-10 sm:py-14">
        <div className="max-w-5xl mx-auto space-y-8">
          <Pool />
        </div>
      </section>
    </main>
  );
}

function Pool() {
  const { connection } = useConnection();
  const [escrows, setEscrows] = useState<ProjectEscrowState[]>([]);
  const [projectsBySlug, setProjectsBySlug] = useState<
    Record<string, OnChainProject>
  >({});
  const [loaded, setLoaded] = useState(false);
  const [fundingProject, setFundingProject] = useState<Project | null>(null);

  const refresh = useCallback(async () => {
    const [escrowList, projectList] = await Promise.all([
      listEscrows({ connection }),
      listProjects({ connection }),
    ]);
    setEscrows(escrowList);
    const map: Record<string, OnChainProject> = {};
    for (const p of projectList) map[p.projectId] = p;
    setProjectsBySlug(map);
    setLoaded(true);
  }, [connection]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalFunded = escrows.reduce((s, e) => s + e.totalFunded, 0);
  const totalReleased = escrows.reduce((s, e) => s + e.totalReleased, 0);
  const totalLocked = escrows.reduce((s, e) => s + e.balanceLamports, 0);

  return (
    <>
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-rep-purple mb-2">
          project escrows
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          On-chain reward pools
        </h1>
        <p className="text-rep-fg/75 text-sm mt-3 max-w-xl leading-relaxed">
          Anyone can fund an escrow for any project. The AI scorer
          automatically releases SOL to verified contributors when a scored
          contribution matches a funded project.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SolStat
          label="total locked"
          lamports={totalLocked}
          accent="cyan"
        />
        <SolStat
          label="total released"
          lamports={totalReleased}
          accent="success"
        />
        <SolStat
          label="total funded (cum.)"
          lamports={totalFunded}
          accent="purple"
        />
      </div>

      {!loaded ? (
        <EmptyState
          line="Reading escrows from devnet…"
        />
      ) : escrows.length === 0 ? (
        <EmptyState
          line="No escrows created yet. Head to /projects to fund the first one."
          cta={{ label: "Browse projects", href: "/projects" }}
        />
      ) : (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Active escrows
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {escrows.map((e) => {
              const oc = projectsBySlug[e.projectId];
              const project = oc ? projectFromOnChain(oc, e) : undefined;
              return (
                <EscrowCard
                  key={e.pubkey}
                  escrow={e}
                  project={project}
                  onFund={() => {
                    if (project) setFundingProject(project);
                  }}
                />
              );
            })}
          </div>
        </section>
      )}

      {fundingProject && (
        <FundEscrowModal
          key={fundingProject.id}
          projectId={fundingProject.slug}
          projectName={fundingProject.name}
          existing={
            escrows.find((e) => e.projectId === fundingProject.slug) ?? null
          }
          onClose={() => setFundingProject(null)}
          onSuccess={() => {
            void refresh();
          }}
        />
      )}
    </>
  );
}

// Note: `project` here is the lightweight UI Project translated from on-chain.
// May be undefined if the escrow's project_id has no matching Project (which
// after the strict-coupling upgrade shouldn't happen, but defensive guard).

function SolStat({
  label,
  lamports,
  accent,
}: {
  label: string;
  lamports: number;
  accent: "cyan" | "success" | "purple";
}) {
  const sol = lamports / LAMPORTS_PER_SOL;
  const color =
    accent === "cyan"
      ? "text-rep-cyan"
      : accent === "success"
      ? "text-rep-success"
      : "text-rep-purple";
  return (
    <div className="rounded-xl border border-white/5 bg-rep-card/40 p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-rep-fg/65 mb-3 font-semibold">
        {label}
      </p>
      <p className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold tabular-nums ${color}`}>
          {sol.toFixed(3)}
        </span>
        <span className="font-mono text-sm text-rep-fg/55 font-medium">SOL</span>
      </p>
    </div>
  );
}

function EscrowCard({
  escrow,
  project,
  onFund,
}: {
  escrow: ProjectEscrowState;
  project?: Project;
  onFund: () => void;
}) {
  const balanceSol = escrow.balanceLamports / LAMPORTS_PER_SOL;
  const releasedSol = escrow.totalReleased / LAMPORTS_PER_SOL;
  const projectName = project?.name ?? escrow.projectId;
  const accentVar = project
    ? `var(--color-${TYPE_COLOR[project.primaryType]})`
    : "var(--color-rep-cyan)";

  return (
    <article className="rounded-xl border border-white/5 bg-rep-card/40 p-5 space-y-3">
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1.5 size-2 shrink-0"
          style={{ backgroundColor: accentVar }}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold tracking-tight truncate text-base">
            {projectName}
          </h3>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-rep-fg/55 mt-0.5">
            {project?.studio ?? "external project"}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Cell label="Balance" v={`${balanceSol.toFixed(3)}`} suffix="SOL" highlight="amber" />
        <Cell label="Released" v={`${releasedSol.toFixed(3)}`} suffix="SOL" highlight="success" />
        <Cell
          label="Rate"
          v={escrow.lamportsPerScore.toLocaleString()}
          suffix="lpp"
        />
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <a
          href={explorerAddr(escrow.pubkey)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] text-rep-cyan hover:underline transition-colors truncate"
        >
          <TruncatedKey pubkey={escrow.pubkey} /> ↗
        </a>
        <button
          onClick={onFund}
          disabled={!project}
          className="font-mono text-[10px] uppercase tracking-[0.18em] font-semibold px-3 py-1.5 border border-rep-amber/50 text-rep-amber hover:bg-rep-amber/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Top up
        </button>
      </div>
    </article>
  );
}

function Cell({
  label,
  v,
  suffix,
  highlight,
}: {
  label: string;
  v: string;
  suffix?: string;
  highlight?: "amber" | "success";
}) {
  const valueColor =
    highlight === "amber"
      ? "text-rep-amber"
      : highlight === "success"
      ? "text-rep-success"
      : "text-rep-fg";
  return (
    <div className="bg-rep-bg/60 border border-white/5 rounded px-2.5 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-rep-fg/55 font-semibold">
        {label}
      </div>
      <div className={`text-sm mt-0.5 tabular-nums font-mono font-semibold ${valueColor}`}>
        {v}
        {suffix && (
          <span className="text-rep-fg/45 text-[10px] ml-1 font-normal">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  line,
  cta,
}: {
  line: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="border border-dashed border-white/10 bg-rep-card/30 px-6 py-14 text-center space-y-4">
      <p className="text-sm text-rep-muted max-w-sm mx-auto leading-relaxed">
        {line}
      </p>
      {cta && (
        <Link
          href={cta.href}
          className="inline-block px-4 py-2 border border-white/15 hover:border-rep-fg text-sm transition-colors"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
