"use client";

import { useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { WalletGate } from "@/components/wallet-gate";
import { ScoreRing } from "@/components/score-ring";
import { useWalletPubkey } from "@/lib/use-wallet-pubkey";
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
  | { kind: "done"; contribution: Contribution; result: ScoreResult }
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
      const { contribution, signature } = await submitContribution({
        contributor: wallet,
        projectId: project,
        contributionType,
        ipfsHash: ipfsHash.trim() || `bafybei${randomHex(46)}`,
        description: desc,
      });
      setStage({ kind: "pending", contribution, signature });
      const result = await scoreContribution(contribution.pubkey);
      const updated = await applyVerification(contribution.pubkey, result);
      setStage({ kind: "done", contribution: updated, result });
    } catch (err) {
      setStage({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <section className="flex-1 px-4 sm:px-6 py-12 sm:py-16">
      <div className="max-w-2xl mx-auto">
        <Header stage={stage} />

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
            sub="Approve in your wallet — this opens the contribution PDA on devnet."
          />
        )}

        {stage.kind === "pending" && (
          <PendingPanel
            heading="AI scorer is evaluating"
            sub="Claude is reading your submission and assigning a 0-100 reputation score."
            contribution={stage.contribution}
            signature={stage.signature}
          />
        )}

        {stage.kind === "done" && (
          <ResultPanel
            contribution={stage.contribution}
            result={stage.result}
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
        hint="Paste a CID or leave blank — we'll generate a placeholder for the demo."
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
        hint="What did you build? The AI scorer reads this directly."
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
  sub,
  contribution,
  signature,
}: {
  heading: string;
  sub: string;
  contribution?: Contribution;
  signature?: string;
}) {
  return (
    <div className="text-center space-y-8 py-12 px-6 rounded-2xl border border-rep-purple/20 bg-rep-card/40">
      <div className="flex justify-center">
        <Spinner />
      </div>
      <div>
        <p className="rep-glitch font-mono text-xs uppercase tracking-[0.3em] text-rep-cyan mb-3">
          {heading.toLowerCase()}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>
        <p className="text-rep-muted text-sm mt-2 max-w-md mx-auto leading-relaxed">
          {sub}
        </p>
      </div>
      {contribution && (
        <div className="font-mono text-xs space-y-1 max-w-sm mx-auto pt-4 border-t border-white/5">
          <Row k="contribution PDA" v={contribution.pubkey} />
          {signature && <Row k="signature" v={signature} />}
        </div>
      )}
    </div>
  );
}

function ResultPanel({
  contribution,
  result,
  onReset,
}: {
  contribution: Contribution;
  result: ScoreResult;
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
            className={`font-mono text-xs uppercase tracking-[0.3em] mb-2 ${
              verified ? "text-rep-success" : "text-rep-danger"
            }`}
          >
            {verified ? "approved · sbt minted" : "below threshold"}
          </p>
          <p className="text-sm text-rep-muted leading-relaxed">
            {result.reasoning}
          </p>
        </div>
        {verified && (
          <div className="flex items-center gap-3 text-sm font-mono">
            <span className="text-rep-muted">+</span>
            <span className="text-rep-cyan font-semibold text-lg">
              {result.score} REP
            </span>
            <span className="text-rep-muted">minted to your wallet</span>
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
    </div>
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
