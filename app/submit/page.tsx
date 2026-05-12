"use client";

import { useState } from "react";
import Link from "next/link";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { Nav } from "@/components/nav";
import { WalletGate } from "@/components/wallet-gate";
import { ScoreRing } from "@/components/score-ring";
import { RotatingText } from "@/components/rotating-text";
import { useWalletPubkey } from "@/lib/use-wallet-pubkey";
import { explorerAddr, explorerTx, truncateSig } from "@/lib/explorer";

const SUBMITTING_PHRASES = [
  "Awaiting wallet signature…",
  "Building submit_contribution instruction…",
  "Broadcasting to devnet validators…",
  "Waiting for confirmation…",
];

const SCORING_PHRASES = [
  "Confirming transaction on devnet…",
  "Reading contribution metadata…",
  "Cross-referencing project context…",
  "Evaluating originality and completeness…",
  "Weighing technical quality…",
  "Computing reputation impact…",
  "Almost there…",
];
import {
  CONTRIBUTION_TYPES,
  type Contribution,
  type ContributionType,
  type ScoreResult,
} from "@/lib/indie-pool/types";
import {
  submitContribution,
  scoreContribution,
  applyVerification,
} from "@/lib/indie-pool/client";

type Stage =
  | { kind: "form" }
  | { kind: "submitting" }
  | { kind: "pending"; contribution: Contribution; signature: string }
  | {
      kind: "done";
      contribution: Contribution;
      result: ScoreResult;
      submitSig: string;
    }
  | { kind: "error"; message: string };

export default function SubmitPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Nav />
      <WalletGate prompt="Connect a wallet to submit a contribution">
        <SubmitFlow />
      </WalletGate>
    </main>
  );
}

function SubmitFlow() {
  const wallet = useWalletPubkey();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const [stage, setStage] = useState<Stage>({ kind: "form" });

  // Form state.
  const [projectId, setProjectId] = useState("supercool-rpg");
  const [contributionType, setContributionType] =
    useState<ContributionType>("code");
  const [ipfsHash, setIpfsHash] = useState("");
  const [description, setDescription] = useState("");

  async function handleSubmit() {
    if (!wallet) return;
    const project = projectId.trim();
    const desc = description.trim();
    if (!project || !desc) {
      setStage({
        kind: "error",
        message: "Project ID and description are required.",
      });
      return;
    }
    setStage({ kind: "submitting" });
    try {
      // When the wallet exposes Anchor-compatible signing, the real on-chain
      // path runs; otherwise submitContribution falls back to localStorage.
      const chain = anchorWallet
        ? { connection, wallet: anchorWallet }
        : undefined;
      const { contribution, signature } = await submitContribution(
        {
          contributor: wallet,
          projectId: project,
          contributionType,
          ipfsHash: ipfsHash.trim() || `bafybei${randomHex(46)}`,
          description: desc,
        },
        chain,
      );
      setStage({ kind: "pending", contribution, signature });
      const result = await scoreContribution(contribution.pubkey);
      const updated = await applyVerification(contribution.pubkey, result);
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

  const mockMode = !chainConfigured();

  return (
    <section className="flex-1 px-4 sm:px-6 py-12 sm:py-16">
      <div className="max-w-2xl mx-auto">
        <Header stage={stage} />

        {mockMode && stage.kind === "form" && <MockModeBanner />}

        {/* `key` re-mounts on stage change; rep-fade-in animates each
         * stage in. Keeps the demo feeling like a single fluid story. */}
        <div key={stage.kind} className="rep-fade-in">
          {stage.kind === "form" && (
            <Form
              projectId={projectId}
              setProjectId={setProjectId}
              contributionType={contributionType}
              setContributionType={setContributionType}
              ipfsHash={ipfsHash}
              setIpfsHash={setIpfsHash}
              description={description}
              setDescription={setDescription}
              onSubmit={handleSubmit}
            />
          )}

          {stage.kind === "submitting" && (
            <PendingPanel
              heading="Signing transaction"
              cycle={SUBMITTING_PHRASES}
            />
          )}

          {stage.kind === "pending" && (
            <PendingPanel
              heading="AI scorer is evaluating"
              cycle={SCORING_PHRASES}
              contribution={stage.contribution}
              signature={stage.signature}
            />
          )}

          {stage.kind === "done" && (
            <ResultPanel
              contribution={stage.contribution}
              result={stage.result}
              submitSig={stage.submitSig}
              onReset={() => setStage({ kind: "form" })}
            />
          )}

          {stage.kind === "error" && (
            <ErrorPanel
              message={stage.message}
              onReset={() => setStage({ kind: "form" })}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function Header({ stage }: { stage: Stage }) {
  const titles: Record<Stage["kind"], string> = {
    form: "Submit a contribution",
    submitting: "Submitting…",
    pending: "Awaiting verification",
    done: "Verification complete",
    error: "Something went wrong",
  };
  return (
    <div className="mb-8">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-rep-cyan mb-2">
        step · indie pool
      </p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
        {titles[stage.kind]}
      </h1>
    </div>
  );
}

function Form(props: {
  projectId: string;
  setProjectId: (s: string) => void;
  contributionType: ContributionType;
  setContributionType: (t: ContributionType) => void;
  ipfsHash: string;
  setIpfsHash: (s: string) => void;
  description: string;
  setDescription: (s: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
      className="space-y-7"
    >
      <Field label="Project ID" hint="The game/project this contribution is for.">
        <input
          value={props.projectId}
          onChange={(e) => props.setProjectId(e.target.value)}
          maxLength={64}
          required
          className="w-full bg-rep-card/60 border border-white/10 rounded-md px-4 py-3 font-mono text-sm focus:outline-none focus:border-rep-cyan/60"
          placeholder="my-game"
        />
      </Field>

      <Field label="Contribution type">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CONTRIBUTION_TYPES.map((t) => {
            const active = props.contributionType === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => props.setContributionType(t.value)}
                className={`flex items-center gap-2 px-3 py-3 rounded-md border text-sm transition-colors ${
                  active
                    ? "border-rep-cyan/60 bg-rep-cyan/10 text-rep-cyan"
                    : "border-white/10 bg-rep-card/40 text-rep-muted hover:text-rep-fg hover:border-white/20"
                }`}
              >
                <span className="font-mono text-base">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field
        label="IPFS hash"
        optional
        hint="Tamper-proof link to your file. The AI scorer does NOT read the file content — only your description below."
      >
        <input
          value={props.ipfsHash}
          onChange={(e) => props.setIpfsHash(e.target.value)}
          maxLength={128}
          className="w-full bg-rep-card/60 border border-white/10 rounded-md px-4 py-3 font-mono text-xs focus:outline-none focus:border-rep-cyan/60"
          placeholder="bafybeigdyrztest…"
        />
      </Field>

      <Field
        label="Description"
        hint="What did you build? Be specific — this is the ONLY thing the AI scorer reads."
      >
        <textarea
          value={props.description}
          onChange={(e) => props.setDescription(e.target.value)}
          rows={5}
          maxLength={512}
          required
          className="w-full bg-rep-card/60 border border-white/10 rounded-md px-4 py-3 text-sm focus:outline-none focus:border-rep-cyan/60 resize-y"
          placeholder="Implemented procedural dungeon generator with 12 biome variants. Replaces the static lookup table; reduces level designer hours from ~6h to ~30min per dungeon."
        />
        <p className="text-[11px] text-rep-muted mt-1 font-mono text-right">
          {props.description.length}/512
        </p>
      </Field>

      <button
        type="submit"
        className="w-full px-6 py-4 rounded-md bg-rep-cyan text-black font-medium hover:bg-rep-cyan/85 transition-colors"
      >
        Submit & request AI score
      </button>
    </form>
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
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-rep-fg">
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

function PendingPanel({
  heading,
  cycle,
  contribution,
  signature,
}: {
  heading: string;
  cycle: string[];
  contribution?: Contribution;
  signature?: string;
}) {
  return (
    <div className="text-center space-y-8 py-12 px-6 rounded-2xl border border-rep-purple/20 bg-rep-card/40 relative overflow-hidden">
      {/* Subtle scanning gradient — suggests "the AI is reading right now" */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div
          className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-rep-cyan to-transparent"
          style={{
            animation: "rep-bar-fill 2.4s ease-in-out infinite",
            top: "0%",
          }}
        />
      </div>

      <div className="flex justify-center relative">
        <Spinner />
      </div>
      <div className="relative">
        <p className="rep-glitch font-mono text-xs uppercase tracking-[0.3em] text-rep-cyan mb-3">
          {heading.toLowerCase()}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>
        <p className="text-rep-muted text-sm mt-3 max-w-md mx-auto leading-relaxed min-h-[1.5em]">
          <RotatingText phrases={cycle} intervalMs={850} />
        </p>
      </div>
      {contribution && (
        <div className="font-mono text-xs space-y-1 max-w-sm mx-auto pt-4 border-t border-white/5 relative">
          <Row k="contribution PDA" v={contribution.pubkey} />
          {signature && <Row k="signature" v={signature} />}
          <div className="flex items-center justify-center gap-2 pt-3 text-[10px] uppercase tracking-[0.2em] text-rep-success">
            <span className="size-1.5 rounded-full bg-rep-success rep-pulse" />
            <span>devnet · oracle online</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultPanel({
  contribution,
  result,
  submitSig,
  onReset,
}: {
  contribution: Contribution;
  result: ScoreResult;
  submitSig: string;
  onReset: () => void;
}) {
  const verified = result.approved;
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-6 py-8 px-6 rounded-2xl border border-white/5 bg-rep-card/40">
        <ScoreRing
          score={result.score}
          size={160}
          label={verified ? "verified" : "rejected"}
        />
        <div className="text-center max-w-md">
          <p
            className={`font-mono text-xs uppercase tracking-[0.3em] mb-3 font-bold ${
              verified ? "text-rep-success" : "text-rep-danger"
            }`}
          >
            {verified ? "approved · sbt minted" : "below threshold"}
          </p>
          <p className="text-[15px] text-rep-fg/90 leading-relaxed">
            {result.reasoning}
          </p>
        </div>
        {verified && (
          <div className="flex items-center gap-2 sm:gap-3 font-mono px-4 py-2 border border-rep-cyan/30 bg-rep-cyan/5 rounded">
            <span className="text-rep-cyan/70 text-lg font-bold">+</span>
            <span className="text-rep-cyan font-bold text-xl tabular-nums">
              {result.score} REP
            </span>
            <span className="text-rep-fg/70 text-xs uppercase tracking-[0.15em]">
              minted to your wallet
            </span>
          </div>
        )}
      </div>

      <div className="font-mono text-xs space-y-1 px-2">
        <Row k="contribution" v={contribution.pubkey} />
        <Row
          k="status"
          v={contribution.status}
          highlight={verified ? "success" : "danger"}
        />
        <Row k="score" v={`${contribution.score} / 100`} />
        <Row k="approved at" v={fmtTime(contribution.verifiedAt)} />
      </div>

      <OnChainArtifacts
        contributionPda={contribution.pubkey}
        submitSig={submitSig}
        verifyTx={result.verifyTx}
        mintTx={result.mintTx}
        releaseTx={result.releaseMilestoneTx}
        releaseAmountLamports={result.releaseAmountLamports}
        approved={verified}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/dashboard"
          className="flex-1 text-center px-6 py-3 rounded-md bg-rep-cyan text-black font-medium hover:bg-rep-cyan/85 transition-colors"
        >
          View dashboard
        </Link>
        <button
          onClick={onReset}
          className="flex-1 px-6 py-3 rounded-md border border-white/10 hover:border-rep-purple/60 transition-colors"
        >
          Submit another
        </button>
      </div>

      {verified && (
        <ShareRow
          score={result.score}
          projectId={contribution.projectId}
          contributionPda={contribution.pubkey}
        />
      )}
    </div>
  );
}

function ShareRow({
  score,
  projectId,
  contributionPda,
}: {
  score: number;
  projectId: string;
  contributionPda: string;
}) {
  const tweetText = `Just earned ${score} REP on @ProofPleaseSol for my ${projectId} contribution. AI-scored, soulbound, on-chain on @solana devnet.

Verified ↗ https://explorer.solana.com/address/${contributionPda}?cluster=devnet`;
  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetText,
  )}`;

  return (
    <div className="border-t border-white/5 pt-4 flex flex-col sm:flex-row gap-2 items-stretch">
      <a
        href={tweetHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 text-center px-4 py-2.5 rounded-md border border-rep-cyan/30 hover:border-rep-cyan text-rep-cyan text-sm transition-colors font-mono uppercase tracking-[0.15em]"
      >
        Share on X
      </a>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(tweetText);
        }}
        className="flex-1 px-4 py-2.5 rounded-md border border-white/15 hover:border-rep-fg text-sm transition-colors font-mono uppercase tracking-[0.15em] text-rep-muted hover:text-rep-fg"
      >
        Copy summary
      </button>
    </div>
  );
}

/**
 * "Click through and verify" surface. Each row links to Solana Explorer.
 * Distinguishes the *real* on-chain case (submitSig + verifyTx + mintTx
 * are all real devnet sigs) from the *mock* case (no verifyTx — the
 * scorer fell back to local) so judges always know what they're seeing.
 */
function OnChainArtifacts({
  contributionPda,
  submitSig,
  verifyTx,
  mintTx,
  releaseTx,
  releaseAmountLamports,
  approved,
}: {
  contributionPda: string;
  submitSig: string;
  verifyTx?: string;
  mintTx?: string;
  releaseTx?: string;
  releaseAmountLamports?: number;
  approved: boolean;
}) {
  const realChain = Boolean(verifyTx);
  const releaseSol =
    releaseAmountLamports !== undefined
      ? releaseAmountLamports / 1_000_000_000
      : undefined;
  return (
    <div className="rounded-2xl border border-white/5 bg-rep-card/30 p-5 space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-rep-cyan">
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
      <div className="space-y-1.5">
        <ExplorerRow
          k="submit tx"
          sig={submitSig}
          href={explorerTx(submitSig)}
        />
        <ExplorerRow
          k="verify tx"
          sig={verifyTx}
          href={verifyTx ? explorerTx(verifyTx) : undefined}
          missingHint="(scorer in mock mode — set ANTHROPIC_API_KEY + ORACLE_KEYPAIR_JSON on Vercel)"
        />
        <ExplorerRow
          k="REP mint tx"
          sig={mintTx}
          href={mintTx ? explorerTx(mintTx) : undefined}
          missingHint={
            !approved
              ? "(score below threshold — no REP minted)"
              : "(awaiting on-chain mint)"
          }
        />
        <ExplorerRow
          k={
            releaseSol !== undefined
              ? `SOL payout tx (+${releaseSol.toFixed(4)} SOL)`
              : "SOL payout tx"
          }
          sig={releaseTx}
          href={releaseTx ? explorerTx(releaseTx) : undefined}
          missingHint={
            !approved
              ? "(score below threshold — no SOL paid)"
              : "(no escrow funded for this project)"
          }
        />
        <ExplorerRow
          k="contribution pda"
          sig={contributionPda}
          href={explorerAddr(contributionPda)}
        />
      </div>
    </div>
  );
}

function ExplorerRow({
  k,
  sig,
  href,
  missingHint,
}: {
  k: string;
  sig?: string;
  href?: string;
  missingHint?: string;
}) {
  if (!sig || !href) {
    return (
      <div className="flex items-baseline justify-between gap-4 font-mono py-1">
        <span className="uppercase tracking-[0.15em] text-[11px] text-rep-fg/70 font-semibold shrink-0">
          {k}
        </span>
        <span className="text-rep-amber/90 text-right text-[11px] font-medium">
          {missingHint ?? "—"}
        </span>
      </div>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-baseline justify-between gap-4 font-mono hover:bg-rep-cyan/5 -mx-2 px-2 py-1 rounded transition-colors group"
    >
      <span className="uppercase tracking-[0.15em] text-[11px] text-rep-fg/70 font-semibold shrink-0">
        {k}
      </span>
      <span className="text-rep-cyan group-hover:underline truncate text-right text-sm font-semibold">
        {truncateSig(sig)}{" "}
        <span className="text-rep-cyan/70" aria-hidden>
          ↗
        </span>
      </span>
    </a>
  );
}

function ErrorPanel({
  message,
  onReset,
}: {
  message: string;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6 py-8 px-6 rounded-2xl border border-rep-danger/30 bg-rep-danger/5">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-rep-danger">
        error
      </p>
      <p className="text-sm">{message}</p>
      <button
        onClick={onReset}
        className="px-6 py-3 rounded-md border border-white/10 hover:border-rep-purple/60 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

function Row({
  k,
  v,
  highlight,
}: {
  k: string;
  v: string;
  highlight?: "success" | "danger";
}) {
  const color =
    highlight === "success"
      ? "text-rep-success"
      : highlight === "danger"
      ? "text-rep-danger"
      : "text-rep-fg";
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-rep-muted uppercase tracking-[0.15em] text-[10px] shrink-0">
        {k}
      </span>
      <span className={`${color} truncate text-right`} title={v}>
        {v}
      </span>
    </div>
  );
}

function Spinner() {
  return (
    <div className="relative size-16">
      <div className="absolute inset-0 rounded-full border-2 border-white/10" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-rep-cyan border-r-rep-cyan animate-spin" />
      <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-rep-purple border-l-rep-purple animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
    </div>
  );
}

function fmtTime(unix?: number): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleTimeString();
}

function randomHex(n: number): string {
  const chars = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < n; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

function chainConfigured(): boolean {
  const id = process.env.NEXT_PUBLIC_PROGRAM_ID;
  return Boolean(id && id !== "11111111111111111111111111111111");
}

function MockModeBanner() {
  return (
    <div className="mb-6 px-4 py-3 border border-rep-amber/30 bg-rep-amber/5 rounded-lg">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-rep-amber mb-1">
        mock mode · no chain interaction
      </p>
      <p className="text-xs text-rep-muted leading-relaxed">
        <code className="font-mono text-rep-fg">NEXT_PUBLIC_PROGRAM_ID</code>{" "}
        isn&apos;t configured. Submissions will use a deterministic local
        scorer and write to localStorage — useful for demos when offline,
        but no on-chain transactions will fire.
      </p>
    </div>
  );
}
