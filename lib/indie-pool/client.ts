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
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TokenAccountNotFoundError,
} from "@solana/spl-token";

import idl from "@/lib/idl/indie_pool.json";
import type { IndiePool } from "@/lib/idl/indie_pool";

import type {
  Contribution,
  ContributionType,
  ProjectEscrowState,
  ScoreResult,
} from "./types";
import { APPROVAL_THRESHOLD } from "./types";
import { loadStore, saveStore } from "./store";

const PLACEHOLDER_PROGRAM_ID = "11111111111111111111111111111111";
const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Bundle of browser-side chain resources. Caller obtains these via
 * `useConnection()` + `useAnchorWallet()`. When absent (no wallet, or env
 * not configured) the client functions fall back to localStorage so the
 * demo flow never breaks offline.
 */
export interface ChainCtx {
  connection: Connection;
  wallet: AnchorWallet;
}

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
 * Submits a contribution.
 *
 * Tries the real on-chain path first when `chain` is provided AND
 * NEXT_PUBLIC_PROGRAM_ID points to a real deployed program. Falls back to a
 * localStorage mock otherwise so the demo still runs offline / without env.
 *
 * On-chain path:
 *   1. Derives the contribution PDA from [b"contribution", wallet, nonce].
 *   2. Calls submit_contribution(nonce, projectId, type, ipfsHash, desc).
 *   3. Phantom popup → user signs → tx broadcast → confirmation.
 *   4. Mirrors the PDA into localStorage as an optimistic cache so the
 *      dashboard updates instantly without re-fetching.
 */
export async function submitContribution(
  p: SubmitParams,
  chain?: ChainCtx,
): Promise<SubmitResult> {
  const programIdStr = process.env.NEXT_PUBLIC_PROGRAM_ID;
  if (chain && programIdStr && programIdStr !== PLACEHOLDER_PROGRAM_ID) {
    return submitOnChain(p, chain, programIdStr);
  }
  return submitMock(p);
}

async function submitOnChain(
  p: SubmitParams,
  { connection, wallet }: ChainCtx,
  programIdStr: string,
): Promise<SubmitResult> {
  const programId = new PublicKey(programIdStr);
  const contributorPk = wallet.publicKey;

  // Sanity: the wallet's pubkey must match the one we're recording. The UI
  // passes the same value through, but defending against a stale prop.
  if (contributorPk.toBase58() !== p.contributor) {
    throw new Error(
      `submitContribution: wallet pubkey (${contributorPk
        .toBase58()
        .slice(0, 8)}…) does not match the contributor passed to the form.`,
    );
  }

  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const program = new Program<IndiePool>(idl as IndiePool, provider);

  const nonceBN = new BN(Date.now());
  const nonceLeBytes = nonceBN.toArrayLike(Buffer, "le", 8);

  const [contributionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("contribution"), contributorPk.toBuffer(), nonceLeBytes],
    programId,
  );
  const [oracleStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle")],
    programId,
  );

  const signature = await program.methods
    .submitContribution(
      nonceBN,
      p.projectId,
      p.contributionType,
      p.ipfsHash,
      p.description,
    )
    .accounts({
      contributor: contributorPk,
      oracleState: oracleStatePda,
      contribution: contributionPda,
      systemProgram: SystemProgram.programId,
    } as never)
    .rpc();

  const c: Contribution = {
    pubkey: contributionPda.toBase58(),
    contributor: p.contributor,
    nonce: nonceBN.toString(),
    projectId: p.projectId,
    contributionType: p.contributionType,
    ipfsHash: p.ipfsHash,
    description: p.description,
    status: "Pending",
    score: 0,
    submittedAt: Math.floor(Date.now() / 1000),
    minted: false,
  };

  // Optimistic cache: dashboard reads localStorage first; the real chain
  // values reconcile on next refresh. Keeps the UI snappy.
  const store = loadStore();
  store.contributions.unshift(c);
  saveStore(store);

  return { contribution: c, signature };
}

async function submitMock(p: SubmitParams): Promise<SubmitResult> {
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
 * Lists a contributor's contributions.
 *
 * Tries on-chain first via `program.account.contribution.all` filtered by
 * the contributor pubkey at memcmp offset 8 (right after the discriminator).
 * Falls back to localStorage on any failure (RPC throttle, no program ID
 * configured, deserialization issue).
 *
 * The on-chain Contribution account doesn't store reasoning text — only
 * its sha256 hash — so reasoning is merged in from localStorage if we have
 * it. The score and status come straight from chain.
 */
export async function listContributions(
  contributor: string,
  chain?: Pick<ChainCtx, "connection">,
): Promise<Contribution[]> {
  if (chain) {
    const onChain = await tryListContributionsOnChain(
      contributor,
      chain.connection,
    );
    if (onChain !== null) return onChain;
  }
  return loadStore()
    .contributions.filter((c) => c.contributor === contributor)
    .sort((a, b) => b.submittedAt - a.submittedAt);
}

async function tryListContributionsOnChain(
  contributor: string,
  connection: Connection,
): Promise<Contribution[] | null> {
  if (!programIdAvailable()) return null;
  try {
    const program = buildReadOnlyProgram(connection);
    // memcmp at offset 8: skip Anchor's 8-byte discriminator, then 32 bytes
    // of `contributor: Pubkey`. Filter is base58-encoded.
    const accounts = await program.account.contribution.all([
      { memcmp: { offset: 8, bytes: contributor } },
    ]);

    const localStore = loadStore();
    const result: Contribution[] = accounts.map(({ publicKey, account }) => {
      const pubkey = publicKey.toBase58();
      const local = localStore.contributions.find((c) => c.pubkey === pubkey);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const acct: any = account;
      return {
        pubkey,
        contributor: (acct.contributor as PublicKey).toBase58(),
        nonce: acct.nonce.toString(),
        projectId: acct.projectId as string,
        contributionType: acct.contributionType as ContributionType,
        ipfsHash: acct.ipfsHash as string,
        description: acct.description as string,
        status: anchorStatusToString(acct.status),
        score: Number(acct.score),
        // Reasoning is server-side / localStorage only — on-chain has just
        // its sha256 hash, which isn't human-readable.
        reasoning: local?.reasoning,
        submittedAt: Number(acct.submittedAt),
        verifiedAt:
          Number(acct.verifiedAt) > 0 ? Number(acct.verifiedAt) : undefined,
        minted: Boolean(acct.minted),
      };
    });
    return result.sort((a, b) => b.submittedAt - a.submittedAt);
  } catch (err) {
    console.warn("[listContributions] on-chain read failed:", err);
    return null;
  }
}

function anchorStatusToString(
  status: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Contribution["status"] {
  const s = status as Record<string, unknown> | null | undefined;
  if (s && "verified" in s) return "Verified";
  if (s && "rejected" in s) return "Rejected";
  return "Pending";
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
// Layer 2 — project escrows
// ---------------------------------------------------------------------------

export interface CreateEscrowParams {
  projectId: string;
  initialDepositSol: number;
  /** Lamports paid out per score point on each milestone release. */
  lamportsPerScore: number;
}

/**
 * Creates a project escrow PDA on-chain. The Project must already be
 * registered (`register_project`); otherwise the instruction fails with
 * `AccountNotInitialized` at the `project` account constraint.
 */
export async function createProjectEscrow(
  params: CreateEscrowParams,
  chain: ChainCtx,
): Promise<{ escrowPda: string; signature: string }> {
  const programId = programIdOrThrow();
  const program = buildProgram(chain);

  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), Buffer.from(params.projectId)],
    programId,
  );
  const [projectPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("project"), Buffer.from(params.projectId)],
    programId,
  );
  const [oracleStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle")],
    programId,
  );

  const lamports = Math.floor(params.initialDepositSol * LAMPORTS_PER_SOL);

  const signature = await program.methods
    .createProjectEscrow(
      params.projectId,
      new BN(lamports),
      new BN(params.lamportsPerScore),
    )
    .accounts({
      creator: chain.wallet.publicKey,
      oracleState: oracleStatePda,
      project: projectPda,
      escrow: escrowPda,
      systemProgram: SystemProgram.programId,
    } as never)
    .rpc();

  return { escrowPda: escrowPda.toBase58(), signature };
}

// ---------------------------------------------------------------------------
// Layer 0 — projects (on-chain registry)
// ---------------------------------------------------------------------------

export interface RegisterProjectParams {
  projectId: string;
  name: string;
  blurb: string;
  /** Emoji or single-char visual marker; UI falls back to procedural art. */
  art: string;
  primaryType: ContributionType;
}

export interface OnChainProject {
  pubkey: string;
  creator: string;
  projectId: string;
  name: string;
  blurb: string;
  art: string;
  primaryType: ContributionType;
  createdAt: number;
}

/**
 * Registers a project on-chain. Anyone can call; first caller wins on the
 * slug (PDA seed = [b"project", project_id]). A second call with the same
 * slug fails with "account already in use".
 */
export async function registerProject(
  params: RegisterProjectParams,
  chain: ChainCtx,
): Promise<{ projectPda: string; signature: string }> {
  const programId = programIdOrThrow();
  const program = buildProgram(chain);

  const [projectPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("project"), Buffer.from(params.projectId)],
    programId,
  );

  const signature = await program.methods
    .registerProject(
      params.projectId,
      params.name,
      params.blurb,
      params.art,
      params.primaryType,
    )
    .accounts({
      creator: chain.wallet.publicKey,
      project: projectPda,
      systemProgram: SystemProgram.programId,
    } as never)
    .rpc();

  return { projectPda: projectPda.toBase58(), signature };
}

/** Reads a single project from chain. Returns null if not registered. */
export async function fetchProject(
  projectId: string,
  chain: Pick<ChainCtx, "connection">,
): Promise<OnChainProject | null> {
  if (!programIdAvailable()) return null;
  const programId = programIdOrThrow();
  const [projectPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("project"), Buffer.from(projectId)],
    programId,
  );
  const info = await chain.connection.getAccountInfo(projectPda, "confirmed");
  if (!info) return null;
  try {
    const program = buildReadOnlyProgram(chain.connection);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const acct: any = await program.account.project.fetch(projectPda);
    return mapProjectAccount(projectPda, acct);
  } catch {
    return null;
  }
}

/** Lists every registered project. Falls back to empty array on any error. */
export async function listProjects(
  chain: Pick<ChainCtx, "connection">,
): Promise<OnChainProject[]> {
  if (!programIdAvailable()) return [];
  try {
    const program = buildReadOnlyProgram(chain.connection);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all: { publicKey: PublicKey; account: any }[] =
      await program.account.project.all();
    return all
      .map(({ publicKey, account }) => mapProjectAccount(publicKey, account))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.warn("[listProjects] failed:", err);
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProjectAccount(pubkey: PublicKey, acct: any): OnChainProject {
  return {
    pubkey: pubkey.toBase58(),
    creator: (acct.creator as PublicKey).toBase58(),
    projectId: acct.projectId as string,
    name: acct.name as string,
    blurb: acct.blurb as string,
    art: acct.art as string,
    primaryType: (acct.primaryType as string) as ContributionType,
    createdAt: Number(acct.createdAt),
  };
}

/** Adds lamports to an existing escrow. Anyone can fund. */
export async function fundProjectEscrow(
  projectId: string,
  amountSol: number,
  chain: ChainCtx,
): Promise<{ signature: string }> {
  const programId = programIdOrThrow();
  const program = buildProgram(chain);

  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), Buffer.from(projectId)],
    programId,
  );

  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  const signature = await program.methods
    .fundProjectEscrow(new BN(lamports))
    .accounts({
      funder: chain.wallet.publicKey,
      escrow: escrowPda,
      systemProgram: SystemProgram.programId,
    } as never)
    .rpc();

  return { signature };
}

/**
 * Reads a single project's escrow state from chain. Returns null if no
 * escrow has been created for this project_id.
 */
export async function fetchEscrow(
  projectId: string,
  chain: Pick<ChainCtx, "connection">,
): Promise<ProjectEscrowState | null> {
  const programId = programIdOrThrow();

  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), Buffer.from(projectId)],
    programId,
  );

  // Read raw account first so we can tell "doesn't exist" vs "deserialize failed".
  const acct = await chain.connection.getAccountInfo(escrowPda, "confirmed");
  if (!acct) return null;

  // Read-only Program — no wallet needed.
  const program = buildReadOnlyProgram(chain.connection);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const escrow: any = await program.account.projectEscrow.fetch(escrowPda);
    return {
      pubkey: escrowPda.toBase58(),
      creator: (escrow.creator as PublicKey).toBase58(),
      oracle: (escrow.oracle as PublicKey).toBase58(),
      projectId: escrow.projectId as string,
      lamportsPerScore: Number(escrow.lamportsPerScore),
      totalFunded: Number(escrow.totalFunded),
      totalReleased: Number(escrow.totalReleased),
      balanceLamports: acct.lamports,
    };
  } catch (err) {
    console.warn("[fetchEscrow] failed to deserialize", err);
    return null;
  }
}

/**
 * Lists all escrows known to the program. Used by /pool to render the
 * project-pool grid from real chain state. Falls back to empty array on
 * any failure so the page renders rather than dead-ending.
 */
export async function listEscrows(
  chain: Pick<ChainCtx, "connection">,
): Promise<ProjectEscrowState[]> {
  if (!programIdAvailable()) return [];
  try {
    const program = buildReadOnlyProgram(chain.connection);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all: { publicKey: PublicKey; account: any }[] =
      await program.account.projectEscrow.all();
    const result: ProjectEscrowState[] = [];
    for (const e of all) {
      const balance = await chain.connection.getBalance(e.publicKey, "confirmed");
      result.push({
        pubkey: e.publicKey.toBase58(),
        creator: (e.account.creator as PublicKey).toBase58(),
        oracle: (e.account.oracle as PublicKey).toBase58(),
        projectId: e.account.projectId as string,
        lamportsPerScore: Number(e.account.lamportsPerScore),
        totalFunded: Number(e.account.totalFunded),
        totalReleased: Number(e.account.totalReleased),
        balanceLamports: balance,
      });
    }
    return result;
  } catch (err) {
    console.warn("[listEscrows] failed:", err);
    return [];
  }
}

// --- helpers ----------------------------------------------------------------

function programIdAvailable(): boolean {
  const id = process.env.NEXT_PUBLIC_PROGRAM_ID;
  return Boolean(id && id !== PLACEHOLDER_PROGRAM_ID);
}

function programIdOrThrow(): PublicKey {
  const id = process.env.NEXT_PUBLIC_PROGRAM_ID;
  if (!id || id === PLACEHOLDER_PROGRAM_ID) {
    throw new Error(
      "NEXT_PUBLIC_PROGRAM_ID is not set — escrow operations require a deployed program.",
    );
  }
  return new PublicKey(id);
}

function buildProgram(chain: ChainCtx): Program<IndiePool> {
  const provider = new AnchorProvider(chain.connection, chain.wallet, {
    commitment: "confirmed",
  });
  return new Program<IndiePool>(idl as IndiePool, provider);
}

function buildReadOnlyProgram(connection: Connection): Program<IndiePool> {
  // Read-only ops don't sign; we use a dummy wallet that throws if anyone
  // accidentally tries to sign with this Program instance.
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async <T,>(): Promise<T> => {
      throw new Error("buildReadOnlyProgram: cannot sign");
    },
    signAllTransactions: async <T,>(): Promise<T[]> => {
      throw new Error("buildReadOnlyProgram: cannot sign");
    },
  };
  const provider = new AnchorProvider(
    connection,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dummyWallet as any,
    { commitment: "confirmed" },
  );
  return new Program<IndiePool>(idl as IndiePool, provider);
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
