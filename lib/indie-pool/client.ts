"use client";

/**
 * Client seam between UI and the (currently mocked) on-chain program.
 *
 * Each function below has a documented "REAL IMPL:" line describing the
 * Anchor / Solana call it stands in for. When `anchor build` runs and the
 * IDL is generated, those calls drop in here without any UI changes.
 *
 * The mock implementation persists to localStorage so the demo flow works
 * end-to-end without devnet, and also calls /api/score with a graceful
 * fallback to a deterministic local score (so the demo never dead-ends
 * on a missing API key).
 */
import { Connection, PublicKey } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TokenAccountNotFoundError,
} from "@solana/spl-token";

import type {
  Contribution,
  ContributionType,
  ScoreResult,
} from "./types";
import { APPROVAL_THRESHOLD } from "./types";
import { loadStore, saveStore } from "./store";

const PLACEHOLDER_PROGRAM_ID = "11111111111111111111111111111111";

export interface SubmitParams {
  contributor: string; // base58 wallet pubkey
  projectId: string;
  contributionType: ContributionType;
  ipfsHash: string;
  description: string;
}

export interface SubmitResult {
  contribution: Contribution;
  /** Devnet tx signature. Mock returns a base58-shaped placeholder. */
  signature: string;
}

/**
 * REAL IMPL: build a `submit_contribution(nonce, projectId, type, hash, desc)`
 * instruction with the contributor's wallet as signer, send via the connected
 * wallet, await confirmation, fetch the resulting Contribution PDA.
 */
export async function submitContribution(p: SubmitParams): Promise<SubmitResult> {
  await delay(1200); // simulate signature + confirmation
  const nonce = String(Date.now());
  const c: Contribution = {
    pubkey: pseudoPubkey(`contrib:${p.contributor}:${nonce}`),
    contributor: p.contributor,
    nonce,
    projectId: p.projectId,
    contributionType: p.contributionType,
    ipfsHash: p.ipfsHash,
    description: p.description,
    status: "Pending",
    score: 0,
    submittedAt: Math.floor(Date.now() / 1000),
    minted: false,
  };
  const store = loadStore();
  store.contributions.unshift(c);
  saveStore(store);
  return { contribution: c, signature: pseudoSignature() };
}

/**
 * REAL IMPL: POST to /api/score, which calls Claude with the cached rubric,
 * signs `verify_contribution` with the oracle keypair, and submits it to
 * devnet. Returns score + reasoning extracted from Claude's JSON response.
 */
export async function scoreContribution(contributionPubkey: string): Promise<ScoreResult> {
  const c = findContribution(contributionPubkey);
  if (!c) throw new Error(`contribution not found: ${contributionPubkey}`);

  // Try the real endpoint first.
  try {
    const res = await fetch("/api/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contributionPubkey,
        contributor: c.contributor,
        projectId: c.projectId,
        contributionType: c.contributionType,
        ipfsHash: c.ipfsHash,
        description: c.description,
      }),
    });
    if (res.ok) {
      return (await res.json()) as ScoreResult;
    }
    // 501 from the stub — fall through to the local mock.
  } catch {
    /* network error — fall through */
  }

  await delay(1800); // simulate scorer thinking
  const score = mockScoreFor(c);
  return {
    score,
    reasoning: mockReasoningFor(c, score),
    approved: score >= APPROVAL_THRESHOLD,
  };
}

/**
 * REAL IMPL: when the scorer endpoint is fully wired, `verify_contribution`
 * and `mint_reputation` happen inside it (oracle-signed). The frontend just
 * polls until status flips. This function then becomes a no-op refresh.
 *
 * Mock behaviour: persist score + reasoning, mark as minted if approved.
 */
export async function applyVerification(
  contributionPubkey: string,
  result: ScoreResult,
): Promise<Contribution> {
  await delay(700);
  const store = loadStore();
  const idx = store.contributions.findIndex((c) => c.pubkey === contributionPubkey);
  if (idx < 0) throw new Error(`contribution not found: ${contributionPubkey}`);
  const c = { ...store.contributions[idx] };
  c.score = result.score;
  c.reasoning = result.reasoning;
  c.status = result.approved ? "Verified" : "Rejected";
  c.verifiedAt = Math.floor(Date.now() / 1000);
  if (c.status === "Verified") {
    c.minted = true; // mock: mint happens automatically
    store.repBalance[c.contributor] =
      (store.repBalance[c.contributor] ?? 0) + result.score;
  }
  store.contributions[idx] = c;
  saveStore(store);
  return c;
}

/**
 * REAL IMPL: `getProgramAccounts(programId, { filters: [...contributor] })`
 * decoded via the Anchor IDL. For now reads localStorage.
 */
export function listContributions(contributor: string): Contribution[] {
  return loadStore()
    .contributions.filter((c) => c.contributor === contributor)
    .sort((a, b) => b.submittedAt - a.submittedAt);
}

/**
 * Reads the contributor's REP balance.
 *
 * Tries the Token-2022 ATA on-chain first when NEXT_PUBLIC_PROGRAM_ID and
 * NEXT_PUBLIC_RPC_URL are configured to non-placeholder values. Falls back
 * to localStorage on any failure (network, missing env, malformed pubkey,
 * etc.) so the dashboard never goes blank during demos or offline runs.
 *
 * The localStorage map is still written by `applyVerification`, so it acts
 * as both an offline fallback and a faster optimistic cache.
 */
export async function getRepBalance(contributor: string): Promise<number> {
  const onChain = await tryReadOnChainRep(contributor);
  if (onChain !== null) return onChain;
  return loadStore().repBalance[contributor] ?? 0;
}

async function tryReadOnChainRep(contributor: string): Promise<number | null> {
  const programIdStr = process.env.NEXT_PUBLIC_PROGRAM_ID;
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
  if (
    !programIdStr ||
    programIdStr === PLACEHOLDER_PROGRAM_ID ||
    !rpcUrl
  ) {
    return null;
  }

  try {
    const programId = new PublicKey(programIdStr);
    const [repMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("rep_mint")],
      programId,
    );
    const contributorPk = new PublicKey(contributor);
    const ata = getAssociatedTokenAddressSync(
      repMintPda,
      contributorPk,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const connection = new Connection(rpcUrl, "confirmed");
    const account = await getAccount(
      connection,
      ata,
      "confirmed",
      TOKEN_2022_PROGRAM_ID,
    );
    return Number(account.amount);
  } catch (err) {
    // ATA not yet minted to → that's a balance of 0, not an error.
    if (err instanceof TokenAccountNotFoundError) return 0;
    console.warn(
      "[getRepBalance] on-chain read failed; falling back to localStorage",
      err,
    );
    return null;
  }
}

export function findContribution(pubkey: string): Contribution | undefined {
  return loadStore().contributions.find((c) => c.pubkey === pubkey);
}

// ---------------------------------------------------------------------------
// Mock helpers — leave in place for offline demos even after real wiring.
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const BASE58 =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function pseudoPubkey(seed: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let out = "";
  for (let i = 0; i < 44; i++) {
    h = Math.imul(h, 1103515245) + 12345;
    h = h >>> 0;
    out += BASE58[h % BASE58.length];
  }
  return out;
}

function pseudoSignature(): string {
  return pseudoPubkey(`sig:${Date.now()}:${Math.random()}`).repeat(2).slice(0, 88);
}

function mockScoreFor(c: Contribution): number {
  // Deterministic-feeling "AI" score from description quality + type weight.
  const lenScore = Math.min(35, Math.floor(c.description.length / 12));
  const typeWeight: Record<ContributionType, number> = {
    code: 30,
    art: 28,
    music: 26,
    "3d": 28,
    writing: 22,
    testing: 24,
  };
  const tw = typeWeight[c.contributionType] ?? 25;
  const ipfsBonus = c.ipfsHash.length > 30 ? 10 : 0;
  const projectBonus = c.projectId.trim().length > 4 ? 8 : 0;
  return Math.max(0, Math.min(100, lenScore + tw + ipfsBonus + projectBonus));
}

function mockReasoningFor(c: Contribution, score: number): string {
  if (score >= 80) {
    return `Strong contribution. The ${c.contributionType} submission shows technical depth and clear project relevance. IPFS-hashed artifact reduces fraud risk. Recommended for verification with high confidence.`;
  }
  if (score >= APPROVAL_THRESHOLD) {
    return `Acceptable contribution. The submission is on-topic and verifiable. More detail in the description and a clearer connection to the project's milestones would push the score higher.`;
  }
  return `Below threshold. The contribution lacks the depth or specificity expected for ${c.contributionType} work. Consider adding context about how this advances the project before resubmitting.`;
}
