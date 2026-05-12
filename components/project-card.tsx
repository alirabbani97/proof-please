"use client";

/**
 * Single project card on /projects.
 *
 * Flat / sharp aesthetic per brief — no gradients, no glow, sharp borders,
 * solid surface fills. The procedural art block at the top is the only
 * visual variation between cards; everything else is dense data.
 */
import Link from "next/link";
import type { Project } from "@/lib/indie-pool/projects";
import { TYPE_COLOR } from "@/lib/indie-pool/projects";
import {
  CONTRIBUTION_TYPES,
  type ProjectEscrowState,
} from "@/lib/indie-pool/types";
import { ProjectArt } from "./project-art";

const LAMPORTS_PER_SOL = 1_000_000_000;

export function ProjectCard({
  project,
  escrow,
  onSubmit,
  onFund,
}: {
  project: Project;
  /** Real on-chain escrow state, when one exists for this project's slug. */
  escrow: ProjectEscrowState | null;
  onSubmit: (p: Project) => void;
  onFund: (p: Project) => void;
}) {
  const typeMeta = CONTRIBUTION_TYPES.find((t) => t.value === project.primaryType);
  const accentVar = `var(--color-${TYPE_COLOR[project.primaryType]})`;
  const progressPct = Math.round(project.milestoneProgress * 100);
  const escrowBalanceSol = escrow
    ? escrow.balanceLamports / LAMPORTS_PER_SOL
    : 0;

  return (
    <article className="flex flex-col bg-rep-card border border-white/5 hover:border-white/15 transition-colors">
      <ProjectArt project={project} />

      <div className="flex flex-1 flex-col gap-4 p-5">
        <header className="flex items-start gap-3">
          <span
            className="mt-1 size-2 shrink-0"
            style={{ backgroundColor: accentVar }}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold tracking-tight leading-snug">
              {project.name}
            </h3>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-rep-fg/55 mt-1">
              {project.studio}
            </p>
          </div>
        </header>

        <p className="text-sm text-rep-fg/80 leading-relaxed line-clamp-2 min-h-[2.6em]">
          {project.description}
        </p>

        {/* Type badge + min score */}
        <div className="flex items-center justify-between gap-3">
          <span
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] px-2.5 py-1 border font-semibold"
            style={{
              color: accentVar,
              borderColor: accentVar,
              backgroundColor: `color-mix(in srgb, ${accentVar} 10%, transparent)`,
            }}
          >
            <span>{typeMeta?.icon ?? "·"}</span>
            <span>{typeMeta?.label ?? project.primaryType}</span>
          </span>
          <span className="inline-flex items-baseline gap-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-rep-fg/60">
            min score
            <span className="text-rep-cyan font-bold text-sm tabular-nums">
              {project.minScoreThreshold}
            </span>
          </span>
        </div>

        {/* Stats grid — escrow + contributors */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-rep-fg/55 mb-1.5">
              Escrow
            </p>
            <p className="text-xl font-semibold font-mono tabular-nums text-rep-fg">
              {project.escrowSol.toFixed(3)}
              <span className="text-rep-fg/50 text-xs font-sans ml-1.5">
                SOL
              </span>
            </p>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-rep-fg/55 mb-1.5">
              Contributors
            </p>
            <p className="text-xl font-semibold font-mono tabular-nums text-rep-fg">
              {project.contributorCount}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-rep-fg/55">
              Milestones
            </p>
            <p className="font-mono text-sm font-semibold tabular-nums text-rep-fg">
              {progressPct}%
            </p>
          </div>
          <div className="h-1 bg-white/5 overflow-hidden">
            <div
              className="h-full transition-[width] duration-700"
              style={{
                width: `${progressPct}%`,
                backgroundColor: accentVar,
              }}
            />
          </div>
        </div>

        {/* Reward pool status row — now a visible boxed status */}
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border border-white/10 bg-rep-bg/50 rounded">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-rep-fg/70">
            Reward pool
          </span>
          {escrow ? (
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-rep-amber animate-pulse"
              />
              <span className="font-mono text-sm font-semibold text-rep-amber tabular-nums">
                {escrowBalanceSol.toFixed(3)} SOL
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] font-bold text-rep-amber px-2 py-1 border border-rep-amber/50 bg-rep-amber/10 rounded">
              <span aria-hidden className="size-1 rounded-full bg-rep-amber" />
              Not funded
            </span>
          )}
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => onFund(project)}
            className="px-3 py-2.5 border border-rep-amber/40 hover:border-rep-amber hover:bg-rep-amber/10 text-rep-amber text-sm font-medium transition-colors"
          >
            {escrow ? "Top up escrow" : "Fund escrow"}
          </button>
          <button
            onClick={() => onSubmit(project)}
            className="px-3 py-2.5 bg-rep-cyan text-black text-sm font-semibold hover:bg-rep-cyan/85 transition-colors"
          >
            Submit contribution
          </button>
        </div>
        <Link
          href="/pool"
          className="block text-center font-mono text-[10px] uppercase tracking-[0.2em] text-rep-fg/50 hover:text-rep-fg transition-colors -mt-1"
        >
          view all escrows →
        </Link>
      </div>
    </article>
  );
}
