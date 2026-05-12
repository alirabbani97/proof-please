"use client";

/**
 * Fund Escrow modal.
 *
 * Opens from a project card. If the project has no on-chain escrow yet,
 * the form lets the caller create one (deposit + payout rate). If an
 * escrow already exists, the form simplifies to a top-up flow (deposit
 * only — payout rate is fixed at creation time).
 *
 * The caller (project listing) passes in the project's slug as the
 * escrow's `project_id` seed. Anyone connected can create or fund;
 * there's no creator gating on the on-chain program.
 */

import { useEffect, useRef, useState } from "react";
import {
  useAnchorWallet,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";

import type { ProjectEscrowState } from "@/lib/indie-pool/types";
import {
  createProjectEscrow,
  fundProjectEscrow,
} from "@/lib/indie-pool/client";
import { explorerTx, truncateSig } from "@/lib/explorer";

const LAMPORTS_PER_SOL = 1_000_000_000;
const DEFAULT_LAMPORTS_PER_SCORE = 100_000; // 0.0001 SOL per score point

type Stage =
  | { kind: "form" }
  | { kind: "submitting" }
  | { kind: "done"; signature: string }
  | { kind: "error"; message: string };

interface FundEscrowModalProps {
  projectId: string;
  projectName: string;
  existing: ProjectEscrowState | null;
  onClose: () => void;
  /** Called after a successful create/fund so the parent can refresh state. */
  onSuccess: () => void;
}

export function FundEscrowModal({
  projectId,
  projectName,
  existing,
  onClose,
  onSuccess,
}: FundEscrowModalProps) {
  const { connected } = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const isCreate = existing === null;

  const [stage, setStage] = useState<Stage>({ kind: "form" });
  const [amountSol, setAmountSol] = useState(isCreate ? "0.5" : "0.1");
  const [lamportsPerScore, setLamportsPerScore] = useState(
    String(DEFAULT_LAMPORTS_PER_SCORE),
  );
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  // Esc to close + body scroll lock.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    const t = setTimeout(() => firstFieldRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit() {
    if (!anchorWallet) {
      setStage({ kind: "error", message: "Wallet not ready." });
      return;
    }
    const amount = Number(amountSol);
    if (!Number.isFinite(amount) || amount <= 0) {
      setStage({ kind: "error", message: "Enter a positive SOL amount." });
      return;
    }
    setStage({ kind: "submitting" });
    try {
      if (isCreate) {
        const rate = Number(lamportsPerScore);
        if (!Number.isFinite(rate) || rate <= 0) {
          throw new Error("Payout rate must be a positive integer.");
        }
        if (rate > 100_000_000) {
          throw new Error("Payout rate caps at 100M lamports per score point.");
        }
        const { signature } = await createProjectEscrow(
          {
            projectId,
            initialDepositSol: amount,
            lamportsPerScore: Math.floor(rate),
          },
          { connection, wallet: anchorWallet },
        );
        setStage({ kind: "done", signature });
      } else {
        const { signature } = await fundProjectEscrow(projectId, amount, {
          connection,
          wallet: anchorWallet,
        });
        setStage({ kind: "done", signature });
      }
      onSuccess();
    } catch (err) {
      setStage({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const existingBalanceSol = existing
    ? existing.balanceLamports / LAMPORTS_PER_SOL
    : 0;
  const existingReleasedSol = existing
    ? existing.totalReleased / LAMPORTS_PER_SOL
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Fund escrow for ${projectName}`}
    >
      {/* Backdrop — dim only; click does NOT close. Use Cancel or Esc. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/70 rep-overlay-in"
      />

      <div className="relative max-w-md w-full bg-rep-card border border-white/10 rounded-lg p-6 sm:p-7 shadow-2xl">
        <header className="mb-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-rep-amber mb-1">
            project · reward pool
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            {isCreate ? "Fund a new escrow" : "Top up escrow"}
          </h2>
          <p className="text-sm text-rep-muted mt-1">
            for <span className="text-rep-fg">{projectName}</span>
          </p>
        </header>

        {existing && (
          <div className="mb-5 grid grid-cols-3 gap-2 font-mono text-[10px] uppercase tracking-[0.15em]">
            <Stat label="balance" v={`${existingBalanceSol.toFixed(3)} SOL`} />
            <Stat label="released" v={`${existingReleasedSol.toFixed(3)} SOL`} />
            <Stat
              label="rate"
              v={`${existing.lamportsPerScore.toLocaleString()} lpp`}
            />
          </div>
        )}

        {!connected ? (
          <p className="text-sm text-rep-muted text-center py-8">
            Connect a wallet to fund an escrow.
          </p>
        ) : stage.kind === "submitting" ? (
          <p className="text-sm text-rep-muted text-center py-8">
            Awaiting wallet signature & confirmation…
          </p>
        ) : stage.kind === "done" ? (
          <div className="py-2 space-y-4">
            <p className="text-sm text-rep-success">
              ✓ {isCreate ? "Escrow created." : "Escrow topped up."}
            </p>
            <a
              href={explorerTx(stage.signature)}
              target="_blank"
              rel="noopener noreferrer"
              className="block font-mono text-xs text-rep-cyan hover:underline truncate"
            >
              tx · {truncateSig(stage.signature)} ↗
            </a>
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 border border-white/15 hover:border-rep-fg text-sm transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-4"
          >
            <FormField
              label="Deposit amount"
              suffix="SOL"
              hint={
                isCreate
                  ? "Initial SOL to lock in the escrow PDA."
                  : "Additional SOL to add to the existing escrow."
              }
            >
              <input
                ref={firstFieldRef}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amountSol}
                onChange={(e) => setAmountSol(e.target.value)}
                required
                className="w-full bg-rep-bg border border-white/10 rounded px-3 py-2.5 font-mono text-sm focus:outline-none focus:border-rep-cyan/60"
              />
            </FormField>

            {isCreate && (
              <FormField
                label="Payout rate"
                suffix="lamports / score point"
                hint={`At ${Number(lamportsPerScore).toLocaleString()}, a score of 80 pays out ${(
                  (Number(lamportsPerScore) * 80) /
                  LAMPORTS_PER_SOL
                ).toFixed(5)} SOL.`}
              >
                <input
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="1"
                  value={lamportsPerScore}
                  onChange={(e) => setLamportsPerScore(e.target.value)}
                  required
                  className="w-full bg-rep-bg border border-white/10 rounded px-3 py-2.5 font-mono text-sm focus:outline-none focus:border-rep-cyan/60"
                />
              </FormField>
            )}

            {stage.kind === "error" && (
              <p className="text-xs text-rep-danger font-mono">
                {stage.message}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 border border-white/15 hover:border-rep-fg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 bg-rep-amber text-black text-sm font-semibold hover:bg-rep-amber/85 transition-colors"
              >
                {isCreate ? "Create + fund" : "Top up"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div className="bg-rep-bg/60 border border-white/5 rounded px-2.5 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-rep-fg/60 font-semibold">
        {label}
      </div>
      <div className="text-rep-fg text-sm mt-1 font-mono font-semibold tabular-nums">
        {v}
      </div>
    </div>
  );
}

function FormField({
  label,
  suffix,
  hint,
  children,
}: {
  label: string;
  suffix?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-baseline justify-between mb-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-rep-fg">
          {label}
        </span>
        {suffix && (
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-rep-muted">
            {suffix}
          </span>
        )}
      </label>
      {children}
      {hint && <p className="text-[10px] text-rep-muted mt-1">{hint}</p>}
    </div>
  );
}
