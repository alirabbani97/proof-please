"use client";

/**
 * Submit slide-over panel — opens from the right when a user clicks
 * "Submit contribution" on a project card. Reuses the same client.ts
 * mock chain as /submit, so contributions persisted here also show up
 * on /dashboard.
 *
 * Per the brief: contribution type selector, description, IPFS hash,
 * submit button with ≥2s "AI scoring in progress..." loading state,
 * then a success state with a score badge.
 */
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useAnchorWallet,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import {
  CONTRIBUTION_TYPES,
  APPROVAL_THRESHOLD,
  type ContributionType,
  type ScoreResult,
  type Contribution,
} from "@/lib/indie-pool/types";
import {
  submitContribution,
  scoreContribution,
  applyVerification,
} from "@/lib/indie-pool/client";
import type { Project } from "@/lib/indie-pool/projects";
import { TYPE_COLOR } from "@/lib/indie-pool/projects";
import { explorerAddr, explorerTx, truncateSig } from "@/lib/explorer";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false },
);

const MIN_SCORING_MS = 2000;

type Stage =
  | { kind: "form" }
  | { kind: "scoring" }
  | {
      kind: "done";
      contribution: Contribution;
      result: ScoreResult;
      submitSig: string;
    }
  | { kind: "error"; message: string };

interface SubmitSlideoverProps {
  project: Project | null;
  onClose: () => void;
}

export function SubmitSlideover({ project, onClose }: SubmitSlideoverProps) {
  const { connected, publicKey } = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const wallet = publicKey?.toBase58() ?? null;
  const firstFieldRef = useRef<HTMLTextAreaElement | null>(null);

  const [stage, setStage] = useState<Stage>({ kind: "form" });
  // Lazy-init from the current project. The parent keys this component
  // by project.id, so a different project unmounts/remounts this — state
  // resets naturally without a separate effect.
  const [contributionType, setContributionType] = useState<ContributionType>(
    () => project?.primaryType ?? "code",
  );
  const [description, setDescription] = useState("");
  const [ipfsHash, setIpfsHash] = useState("");

  // Esc to close + body scroll lock while open.
  useEffect(() => {
    if (!project) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [project, onClose]);

  // Focus the first interactive field once the panel mounts.
  useEffect(() => {
    if (project && stage.kind === "form" && firstFieldRef.current) {
      const t = setTimeout(() => firstFieldRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [project, stage.kind]);

  if (!project) return null;

  const accentVar = `var(--color-${TYPE_COLOR[project.primaryType]})`;

  async function handleSubmit() {
    if (!project) return;
    if (!wallet) return;
    const desc = description.trim();
    if (!desc) {
      setStage({
        kind: "error",
        message: "Description is required.",
      });
      return;
    }
    setStage({ kind: "scoring" });
    const start = Date.now();
    try {
      const chain = anchorWallet
        ? { connection, wallet: anchorWallet }
        : undefined;
      const { contribution, signature } = await submitContribution(
        {
          contributor: wallet,
          projectId: project.slug,
          contributionType,
          ipfsHash: ipfsHash.trim() || `bafybei${randomHex(46)}`,
          description: desc,
        },
        chain,
      );
      const result = await scoreContribution(contribution.pubkey);
      const updated = await applyVerification(contribution.pubkey, result);
      // Hold the "scoring" UI for at least MIN_SCORING_MS so the moment
      // of suspense reads — even if the mock client returned faster.
      const elapsed = Date.now() - start;
      if (elapsed < MIN_SCORING_MS) {
        await new Promise((r) => setTimeout(r, MIN_SCORING_MS - elapsed));
      }
      setStage({
        kind: "done",
        contribution: updated,
        result,
        submitSig: signature,
      });
    } catch (err) {
      setStage({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`Submit a contribution to ${project.name}`}
    >
      {/* Backdrop */}
      <button
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 rep-overlay-in"
      />

      {/* Panel */}
      <aside className="absolute inset-y-0 right-0 w-full sm:w-[460px] bg-rep-card border-l border-white/10 flex flex-col rep-slide-in shadow-2xl">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-white/10">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-rep-muted">
              submit to
            </p>
            <h2 className="text-lg font-semibold tracking-tight truncate mt-0.5">
              {project.name}
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-rep-muted mt-1">
              <span style={{ color: accentVar }}>{project.studio}</span>
              <span className="mx-2 opacity-40">·</span>
              min. score{" "}
              <span className="text-rep-fg">{project.minScoreThreshold}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="size-8 grid place-items-center text-rep-muted hover:text-rep-fg hover:bg-white/5 transition-colors"
          >
            <CloseIcon className="size-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {!connected ? (
            <ConnectGate />
          ) : stage.kind === "scoring" ? (
            <ScoringState />
          ) : stage.kind === "done" ? (
            <ResultState
              result={stage.result}
              contributionPda={stage.contribution.pubkey}
              submitSig={stage.submitSig}
              onSubmitAnother={() => setStage({ kind: "form" })}
              minScore={project.minScoreThreshold}
            />
          ) : (
            <FormStage
              firstFieldRef={firstFieldRef}
              contributionType={contributionType}
              setContributionType={setContributionType}
              description={description}
              setDescription={setDescription}
              ipfsHash={ipfsHash}
              setIpfsHash={setIpfsHash}
              error={stage.kind === "error" ? stage.message : null}
            />
          )}
        </div>

        {/* Footer with submit button — only shown in form state */}
        {connected &&
          (stage.kind === "form" || stage.kind === "error") && (
            <footer className="px-6 py-4 border-t border-white/10">
              <button
                onClick={handleSubmit}
                disabled={!description.trim()}
                className="w-full px-6 py-3 bg-rep-cyan text-black font-medium hover:bg-rep-cyan/85 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Submit & request AI score
              </button>
            </footer>
          )}
      </aside>
    </div>
  );
}

function ConnectGate() {
  return (
    <div className="px-6 py-12 text-center space-y-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-rep-purple">
        wallet required
      </p>
      <h3 className="text-base font-semibold">
        Connect a wallet to submit a contribution
      </h3>
      <p className="text-xs text-rep-muted leading-relaxed max-w-xs mx-auto">
        The contribution PDA is signed by your wallet. Phantom or Solflare
        on devnet — grab faucet SOL if your wallet is empty.
      </p>
      <div className="pt-2">
        <WalletMultiButton />
      </div>
    </div>
  );
}

function FormStage({
  firstFieldRef,
  contributionType,
  setContributionType,
  description,
  setDescription,
  ipfsHash,
  setIpfsHash,
  error,
}: {
  firstFieldRef: React.RefObject<HTMLTextAreaElement | null>;
  contributionType: ContributionType;
  setContributionType: (t: ContributionType) => void;
  description: string;
  setDescription: (s: string) => void;
  ipfsHash: string;
  setIpfsHash: (s: string) => void;
  error: string | null;
}) {
  return (
    <div className="px-6 py-6 space-y-6">
      {/* Type selector */}
      <Field label="Contribution type">
        <div className="grid grid-cols-3 gap-1.5">
          {CONTRIBUTION_TYPES.map((t) => {
            const active = contributionType === t.value;
            const accent = `var(--color-${TYPE_COLOR[t.value]})`;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setContributionType(t.value)}
                className={`flex items-center justify-center gap-1.5 px-2 py-2.5 border text-xs transition-colors ${
                  active
                    ? "border-current bg-white/[0.04]"
                    : "border-white/10 text-rep-muted hover:text-rep-fg hover:border-white/25"
                }`}
                style={active ? { color: accent } : undefined}
              >
                <span className="font-mono">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field
        label="Description"
        hint="The AI scorer reads this directly. Be specific about what you built."
      >
        <textarea
          ref={firstFieldRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          maxLength={512}
          required
          placeholder="Procedural dungeon generator using BSP with biome-aware corridor weaving. Replaces the static lookup table; cuts level designer hours from ~6h to ~30min per dungeon."
          className="w-full bg-rep-bg border border-white/10 px-3 py-2.5 text-sm focus:outline-none focus:border-rep-cyan/60 resize-y"
        />
        <p className="text-[10px] text-rep-muted mt-1 font-mono text-right tabular-nums">
          {description.length}/512
        </p>
      </Field>

      <Field
        label="IPFS hash"
        optional
        hint="Paste a CID or leave blank — we'll generate a placeholder for the demo."
      >
        <input
          value={ipfsHash}
          onChange={(e) => setIpfsHash(e.target.value)}
          maxLength={128}
          placeholder="bafybeigdyrz…"
          className="w-full bg-rep-bg border border-white/10 px-3 py-2.5 text-xs font-mono focus:outline-none focus:border-rep-cyan/60"
        />
      </Field>

      {error && (
        <div className="px-3 py-2 border border-rep-danger/40 bg-rep-danger/5 text-xs text-rep-danger">
          {error}
        </div>
      )}
    </div>
  );
}

function ScoringState() {
  return (
    <div className="px-6 py-12 flex flex-col items-center text-center gap-5">
      <Spinner />
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-rep-cyan rep-glitch mb-2">
          ai scoring in progress
        </p>
        <p className="text-sm text-rep-muted leading-relaxed max-w-xs">
          Claude is reading your submission and assigning a 0-100 reputation
          score. Hold tight.
        </p>
      </div>
    </div>
  );
}

function ResultState({
  result,
  contributionPda,
  submitSig,
  onSubmitAnother,
  minScore,
}: {
  result: ScoreResult;
  contributionPda: string;
  submitSig: string;
  onSubmitAnother: () => void;
  minScore: number;
}) {
  const passed = result.score >= APPROVAL_THRESHOLD;
  const meetsMin = result.score >= minScore;
  const accent = passed ? "var(--color-rep-success)" : "var(--color-rep-danger)";
  const realChain = Boolean(result.verifyTx);

  return (
    <div className="px-6 py-8 space-y-6">
      {/* Score badge */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div
          className="flex items-baseline gap-3 px-5 py-3 border-2"
          style={{ borderColor: accent, color: accent }}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.25em]">
            score
          </span>
          <span className="text-4xl font-semibold font-mono tabular-nums">
            {result.score}
          </span>
          <span className="font-mono text-sm">
            {passed ? "✓ Approved" : "✗ Rejected"}
          </span>
        </div>
        {!meetsMin && passed && (
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-rep-amber">
            below project min ({minScore}) — submission verified, project
            access pending
          </p>
        )}
      </div>

      {/* Reasoning */}
      <div className="border border-white/5 bg-rep-bg p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-rep-muted mb-2">
          ai reasoning
        </p>
        <p className="text-sm leading-relaxed">{result.reasoning}</p>
      </div>

      {/* On-chain artifacts */}
      <div className="border border-white/5 bg-rep-bg p-4 space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-rep-cyan">
            on-chain artifacts
          </p>
          <p
            className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
              realChain ? "text-rep-success" : "text-rep-muted"
            }`}
          >
            {realChain ? "devnet · live" : "settlement mocked"}
          </p>
        </div>
        <SlideoverArtifactRow label="submit tx" sig={submitSig} kind="tx" />
        <SlideoverArtifactRow
          label="verify tx"
          sig={result.verifyTx}
          kind="tx"
          missingHint="(set ANTHROPIC_API_KEY + ORACLE_KEYPAIR_JSON)"
        />
        <SlideoverArtifactRow
          label="mint tx"
          sig={result.mintTx}
          kind="tx"
          missingHint={
            !passed
              ? "(below threshold — no SBT)"
              : "(awaiting on-chain mint)"
          }
        />
        <SlideoverArtifactRow
          label="contribution pda"
          sig={contributionPda}
          kind="addr"
        />
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <button
          onClick={onSubmitAnother}
          className="px-4 py-2.5 border border-white/15 hover:border-rep-fg text-sm transition-colors"
        >
          Submit another
        </button>
        <Link
          href="/dashboard"
          className="text-center px-4 py-2.5 bg-rep-cyan text-black text-sm font-medium hover:bg-rep-cyan/85 transition-colors"
        >
          View dashboard
        </Link>
      </div>
    </div>
  );
}

function SlideoverArtifactRow({
  label,
  sig,
  kind,
  missingHint,
}: {
  label: string;
  sig?: string;
  kind: "tx" | "addr";
  missingHint?: string;
}) {
  if (!sig) {
    return (
      <div className="flex items-baseline justify-between gap-3 font-mono text-[11px]">
        <span className="text-rep-muted uppercase tracking-[0.15em] text-[10px] shrink-0">
          {label}
        </span>
        <span className="text-rep-muted italic text-right truncate">
          {missingHint ?? "—"}
        </span>
      </div>
    );
  }
  const href = kind === "tx" ? explorerTx(sig) : explorerAddr(sig);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-baseline justify-between gap-3 font-mono text-[11px] hover:bg-rep-cyan/5 -mx-1.5 px-1.5 py-0.5 rounded transition-colors group"
    >
      <span className="text-rep-muted uppercase tracking-[0.15em] text-[10px] shrink-0">
        {label}
      </span>
      <span className="text-rep-cyan group-hover:underline truncate text-right">
        {truncateSig(sig)}{" "}
        <span className="text-rep-cyan/60" aria-hidden>
          ↗
        </span>
      </span>
    </a>
  );
}

function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-baseline justify-between mb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-rep-fg">
          {label}
        </span>
        {optional && (
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-rep-muted">
            optional
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] text-rep-muted mt-1.5 leading-relaxed">
          {hint}
        </p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="relative size-12">
      <div className="absolute inset-0 border-2 border-white/10" />
      <div className="absolute inset-0 border-2 border-transparent border-t-rep-cyan border-r-rep-cyan animate-spin" />
    </div>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 3l10 10M13 3 3 13" strokeLinecap="round" />
    </svg>
  );
}

function randomHex(n: number): string {
  const chars = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
