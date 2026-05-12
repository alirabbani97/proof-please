/**
 * AI Scorer endpoint.
 *
 * Receives a contribution metadata payload, prompts Claude to evaluate it
 * against the indie-pool rubric, and returns a {score, reasoning, approved}
 * verdict. When ORACLE_KEYPAIR_JSON and a real NEXT_PUBLIC_PROGRAM_ID are
 * set, also performs on-chain settlement (verify_contribution +
 * mint_reputation). Wiring to the real Anchor calls activates once
 * `anchor build` emits the IDL — the seam is documented inline.
 *
 * Defaults to Claude Sonnet 4.6 to match the locked-decision cost budget;
 * set SCORER_MODEL=claude-opus-4-7 to upgrade for higher-stakes scoring.
 */
import Anthropic from "@anthropic-ai/sdk";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import idl from "@/lib/idl/indie_pool.json";
import type { IndiePool } from "@/lib/idl/indie_pool";

export const runtime = "nodejs"; // Solana SDKs need Node crypto.
export const dynamic = "force-dynamic";

const SCORER_MODEL = process.env.SCORER_MODEL ?? "claude-sonnet-4-6";

const APPROVAL_THRESHOLD = 60;

// The rubric is sent as the cached system prompt. It's intentionally long and
// example-rich so that (a) scoring is consistent across submissions and
// (b) the prefix crosses Sonnet 4.6's 2048-token caching threshold so repeat
// calls within 5 min pay ~10% input cost instead of full.
const RUBRIC = `You are the AI scorer oracle for Indie Pool — a Solana-based reputation system for indie game development contributions. You read contribution metadata (project, type, IPFS hash, description) and assign a 0-100 reputation score that, if at or above the approval threshold of ${APPROVAL_THRESHOLD}, is minted on-chain as a Soulbound Token (Token-2022 with the NonTransferable extension). Your output is binding. Overscoring debases the reputation system. Underscoring discourages contributors. Be strict, fair, and concrete.

# Rubric

Score is the sum of 5 dimensions, 0-20 points each. Always evaluate every dimension; do not collapse them.

## 1. Originality (0-20)

How original is the work itself, judged from the description and project context?

- 18-20: Genuinely novel — a new system, technique, asset, or composition. Not a tutorial reimplementation, not a template clone, not a remix of an existing public asset.
- 12-17: Meaningfully customizes or extends standard patterns with project-specific decisions.
- 6-11: Mostly boilerplate, scaffolding, or asset-pack adaptation, with some local tweaks.
- 0-5: Generic. Could come from any project. No discernible authorial input.

## 2. Completeness (0-20)

How thoroughly does the description characterize what was actually delivered?

- 18-20: Names specific subsystems, design decisions, tradeoffs, and edge cases. The description alone makes it clear what the artifact is and how it behaves.
- 12-17: Clear summary with most specifics. Minor details missing.
- 6-11: Vague. "Implemented feature X" without saying what X does or how.
- 0-5: Stub-level. Nothing concrete to verify.

## 3. Project relevance (0-20)

Does this contribution clearly advance the stated project's milestones or fix a stated problem?

- 18-20: Direct connection to a named milestone, system, or pain point in the project.
- 12-17: On-topic for the project, even if not pinned to a specific milestone.
- 6-11: Tangentially related (e.g., a code utility that the project might use someday).
- 0-5: Could belong to any project. No project-specific signal.

## 4. Technical quality (0-20)

Does the description suggest competent execution? Adapt the lens to the contribution type:

- For \`code\`: design choices, tradeoffs, performance considerations, edge case handling, fit with existing architecture.
- For \`art\` / \`3d\`: production polish, technique, scope, consistency with project art direction.
- For \`music\`: composition, mix quality, instrumentation choices, fit with game tone.
- For \`writing\`: structure, prose quality, factual specificity, consistency with established lore.
- For \`testing\`: coverage thinking, regression catches, test design.

Bands:
- 18-20: Senior-level execution.
- 12-17: Solid mid-level work.
- 6-11: Functional but rough; would need editing or refactoring to ship.
- 0-5: Inexperienced or sloppy.

## 5. Community value (0-20)

Beyond this specific project, would other indie game devs benefit from or be inspired by this work being verified and visible?

- 18-20: Reusable, reference-quality. Others would clearly benefit.
- 12-17: Useful within this project's contributor pool; weak external signal.
- 6-11: Niche utility, low spillover.
- 0-5: Low signal. Unlikely to influence other projects.

# Worked examples

Use these as calibration anchors. The score is *not* a token count of the description — a short description of substantial work scores high; a long description of trivial work scores low.

## Example A — Score 89

Project: \`solpunk-rpg\`. Type: \`code\`. Description: "Implemented procedural dungeon generator using BSP with biome-aware corridor weaving. Replaces the static lookup table; reduces level designer hours from ~6h to ~30min per dungeon. Hand-tuned the room-size distribution against the pacing curve in design doc §4.2."

- Originality 18 (BSP+biome weaving is a real design choice, not a clone).
- Completeness 18 (names the algorithm, the tradeoff, the metric, the doc reference).
- Project relevance 19 (cites a specific design doc section).
- Technical quality 17 (suggests senior-level thinking; one mark off because we can't verify without reading code).
- Community value 17 (BSP dungeon generators are reusable across projects).

## Example B — Score 64

Project: \`supercool-rpg\`. Type: \`art\`. Description: "Cover art for the main menu. Watercolor style, 4K, transparent background. Matches the moodboard the team shared on Discord."

- Originality 12 (one cover art is original, but no description of motif or composition).
- Completeness 14 (we know format and reference, not subject).
- Project relevance 16 (clearly menu art).
- Technical quality 12 (4K + watercolor is reasonable; we can't see polish).
- Community value 10 (single asset, low reuse outside the project).

## Example C — Score 38

Project: \`my-game\`. Type: \`code\`. Description: "Added README badges and reformatted the docs."

- Originality 4 (boilerplate maintenance).
- Completeness 8 (description matches scope).
- Project relevance 8 (touches the project but not a milestone).
- Technical quality 8 (no visible decisions).
- Community value 10 (badges are universally fine).

## Example D — Score 12

Project: \`x\`. Type: \`code\`. Description: "fixed bug".

- Originality 2.
- Completeness 2.
- Project relevance 4 (something in the project changed).
- Technical quality 2.
- Community value 2.

# Output format

Return JSON only, with these exact keys and types:

{
  "score": <integer 0-100>,
  "reasoning": "<2-3 sentences calling out the strongest and weakest dimensions, with a one-line guidance for the contributor>",
  "approved": <true if score >= ${APPROVAL_THRESHOLD}, else false>
}

Notes:
- "approved" must be derived from "score" and the threshold. Do not set it independently.
- If the description is empty, missing, or appears to be placeholder text ("test", "asdf", "lorem ipsum"), score the contribution under 30 and say so plainly in the reasoning.
- If the contribution_type does not match the description (e.g., type=music but description discusses code), penalize Project relevance and Technical quality and note the mismatch in reasoning.
- When in doubt, prefer giving honest, specific feedback in reasoning over inflating the score.`;

const SCORE_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer" },
    reasoning: { type: "string" },
    approved: { type: "boolean" },
  },
  required: ["score", "reasoning", "approved"],
  additionalProperties: false,
} as const;

export interface ScoreRequest {
  contributionPubkey: string;
  contributor: string;
  projectId: string;
  contributionType: string;
  ipfsHash: string;
  description: string;
}

export interface ScoreResponse {
  score: number;
  reasoning: string;
  approved: boolean;
  /** Tx signature of verify_contribution, present when on-chain settled. */
  verifyTx?: string;
  /** Tx signature of mint_reputation, present when approved AND on-chain settled. */
  mintTx?: string;
  /**
   * Tx signature of release_milestone (Layer 2 SOL payout). Present only
   * when (a) approved, (b) an escrow exists for the project_id, (c) escrow
   * has sufficient funds, and (d) the milestone hasn't already been released.
   */
  releaseMilestoneTx?: string;
  /** Lamports paid out, if release_milestone fired. */
  releaseAmountLamports?: number;
}

interface ErrorResponse {
  error: string;
}

export async function POST(
  req: Request,
): Promise<NextResponse<ScoreResponse | ErrorResponse>> {
  // 1. Validate input.
  let body: Partial<ScoreRequest>;
  try {
    body = (await req.json()) as Partial<ScoreRequest>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const required: (keyof ScoreRequest)[] = [
    "contributionPubkey",
    "contributor",
    "projectId",
    "contributionType",
    "ipfsHash",
    "description",
  ];
  for (const k of required) {
    if (typeof body[k] !== "string" || (body[k] as string).length === 0) {
      return NextResponse.json(
        { error: `Missing or empty field: ${k}` },
        { status: 400 },
      );
    }
  }
  const validated = body as ScoreRequest;

  // 2. Score with Claude.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on the server" },
      { status: 500 },
    );
  }

  let scored: { score: number; reasoning: string; approved: boolean };
  try {
    scored = await scoreWithClaude(validated, apiKey);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Scorer is rate-limited; try again shortly." },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Scorer API error ${err.status}: ${err.message}` },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  // 3. Optional on-chain settlement. Only attempted when both env pieces
  // are wired AND the program ID isn't the placeholder. Failures here do
  // not fail the request — the score still returns.
  let verifyTx: string | undefined;
  let mintTx: string | undefined;
  let releaseMilestoneTx: string | undefined;
  let releaseAmountLamports: number | undefined;
  const oracleKp = loadOracleKeypair();
  const programId = process.env.NEXT_PUBLIC_PROGRAM_ID;
  if (
    oracleKp &&
    programId &&
    programId !== "11111111111111111111111111111111"
  ) {
    try {
      const settled = await performOnChainSettlement({
        oracleKp,
        programId,
        contributionPubkey: validated.contributionPubkey,
        contributor: validated.contributor,
        projectId: validated.projectId,
        score: scored.score,
        reasoning: scored.reasoning,
        approved: scored.approved,
      });
      verifyTx = settled.verifyTx;
      mintTx = settled.mintTx;
      releaseMilestoneTx = settled.releaseMilestoneTx;
      releaseAmountLamports = settled.releaseAmountLamports;
    } catch (err) {
      console.error("[scorer] on-chain settlement failed:", err);
      // Score still returns; UI can flag "scored, awaiting on-chain confirm".
    }
  }

  return NextResponse.json({
    ...scored,
    verifyTx,
    mintTx,
    releaseMilestoneTx,
    releaseAmountLamports,
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    name: "indie-pool/ai-scorer",
    status: "live",
    method: "POST /api/score",
    model: SCORER_MODEL,
    onChainSettlement:
      loadOracleKeypair() &&
      process.env.NEXT_PUBLIC_PROGRAM_ID &&
      process.env.NEXT_PUBLIC_PROGRAM_ID !== "11111111111111111111111111111111"
        ? "active (settles verify_contribution + mint_reputation on devnet)"
        : "scoring only (set ORACLE_KEYPAIR_JSON + a real NEXT_PUBLIC_PROGRAM_ID to enable)",
  });
}

// ---------------------------------------------------------------------------
// Claude scoring
// ---------------------------------------------------------------------------

async function scoreWithClaude(
  req: ScoreRequest,
  apiKey: string,
): Promise<{ score: number; reasoning: string; approved: boolean }> {
  const client = new Anthropic({ apiKey });

  const userPrompt = [
    `Evaluate this contribution.`,
    ``,
    `Project: ${req.projectId}`,
    `Contribution type: ${req.contributionType}`,
    `IPFS hash: ${req.ipfsHash}`,
    `Description:`,
    req.description,
  ].join("\n");

  const response = await client.messages.create({
    model: SCORER_MODEL,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: RUBRIC,
        // 5-min ephemeral cache. Prefix-match: ~10% input cost on hits.
        // If this rubric is below the model's caching threshold (2048 tokens
        // on Sonnet 4.6), the marker is silently ignored — no harm done.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
    output_config: {
      format: {
        type: "json_schema",
        schema: SCORE_SCHEMA,
      },
    },
  });

  // Find the text block (structured-output responses come back as a single
  // text block whose content is the JSON object).
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Scorer returned no text content");
  }

  let parsed: { score?: unknown; reasoning?: unknown; approved?: unknown };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error(
      `Scorer returned non-JSON content: ${textBlock.text.slice(0, 200)}`,
    );
  }

  const rawScore = Number(parsed.score);
  const score = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(100, Math.round(rawScore)))
    : 0;
  const reasoning =
    typeof parsed.reasoning === "string" && parsed.reasoning.length > 0
      ? parsed.reasoning
      : "(scorer returned no reasoning)";
  // Always derive approval from the threshold — don't trust the model's
  // boolean if it conflicts with its own score.
  const approved = score >= APPROVAL_THRESHOLD;

  return { score, reasoning, approved };
}

// ---------------------------------------------------------------------------
// On-chain settlement (oracle-signed)
// ---------------------------------------------------------------------------

function loadOracleKeypair(): Keypair | null {
  const raw = process.env.ORACLE_KEYPAIR_JSON;
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr) || arr.length !== 64) return null;
    if (!arr.every((n) => typeof n === "number" && n >= 0 && n <= 255)) {
      return null;
    }
    return Keypair.fromSecretKey(new Uint8Array(arr as number[]));
  } catch {
    return null;
  }
}

interface SettlementArgs {
  oracleKp: Keypair;
  programId: string;
  contributionPubkey: string;
  contributor: string;
  projectId: string;
  score: number;
  reasoning: string;
  approved: boolean;
}

interface SettlementResult {
  verifyTx?: string;
  mintTx?: string;
  releaseMilestoneTx?: string;
  releaseAmountLamports?: number;
}

async function performOnChainSettlement(
  args: SettlementArgs,
): Promise<SettlementResult> {
  // The reasoning hash is what goes on-chain — full reasoning text would be
  // too expensive in account space. The program's verify_contribution
  // expects 32 bytes.
  const reasoningHash = createHash("sha256").update(args.reasoning).digest();

  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new AnchorProvider(
    connection,
    new Wallet(args.oracleKp),
    { commitment: "confirmed" },
  );
  const program = new Program<IndiePool>(idl as IndiePool, provider);

  // Derive all PDAs the program expects. Matches the seeds in
  // programs/indie-pool/src/lib.rs.
  const programId = new PublicKey(args.programId);
  const [oracleStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle")],
    programId,
  );
  const [repMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("rep_mint")],
    programId,
  );
  const [mintAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint_authority")],
    programId,
  );
  const contributionPubkey = new PublicKey(args.contributionPubkey);
  const contributorPubkey = new PublicKey(args.contributor);

  // 1) verify_contribution — oracle-signed. The has_one = oracle constraint
  // on OracleState is what gates trust; any other signer fails here.
  const verifyTx = await program.methods
    .verifyContribution(args.score, Array.from(reasoningHash))
    .accounts({
      oracleSigner: args.oracleKp.publicKey,
      oracleState: oracleStatePda,
      oracle: args.oracleKp.publicKey,
      contribution: contributionPubkey,
    } as never)
    .rpc();

  // 2) mint_reputation — only when approved. Anyone can call it; the program
  // enforces status == Verified && !minted internally.
  let mintTx: string | undefined;
  if (args.approved) {
    const contributorAta = getAssociatedTokenAddressSync(
      repMintPda,
      contributorPubkey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    mintTx = await program.methods
      .mintReputation()
      .accounts({
        payer: args.oracleKp.publicKey,
        oracleState: oracleStatePda,
        contribution: contributionPubkey,
        contributor: contributorPubkey,
        repMint: repMintPda,
        mintAuthority: mintAuthorityPda,
        contributorTokenAccount: contributorAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as never)
      .rpc();
  }

  // 3) release_milestone — Layer 2 SOL payout. Best-effort: only fires when
  //    approved + an escrow exists for this project_id + escrow has funds +
  //    not already released. All failure modes are non-fatal — the score
  //    + REP still return. Each branch logs to Vercel so it's debuggable.
  let releaseMilestoneTx: string | undefined;
  let releaseAmountLamports: number | undefined;
  if (args.approved) {
    try {
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), Buffer.from(args.projectId)],
        programId,
      );
      const [releaseReceiptPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("release"), contributionPubkey.toBuffer()],
        programId,
      );

      const escrowInfo = await connection.getAccountInfo(
        escrowPda,
        "confirmed",
      );
      if (escrowInfo) {
        const releaseTx = await program.methods
          .releaseMilestone()
          .accounts({
            oracleSigner: args.oracleKp.publicKey,
            oracleState: oracleStatePda,
            oracle: args.oracleKp.publicKey,
            escrow: escrowPda,
            contribution: contributionPubkey,
            releaseReceipt: releaseReceiptPda,
            contributor: contributorPubkey,
            systemProgram: SystemProgram.programId,
          } as never)
          .rpc();
        releaseMilestoneTx = releaseTx;
        // Compute amount from on-chain escrow state (single source of truth).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const escrow: any = await program.account.projectEscrow.fetch(
          escrowPda,
        );
        releaseAmountLamports =
          args.score * Number(escrow.lamportsPerScore);
        console.log("[scorer] released milestone", {
          tx: releaseTx,
          amountLamports: releaseAmountLamports,
          escrow: escrowPda.toBase58(),
        });
      } else {
        console.log("[scorer] no escrow for project — skipping release", {
          projectId: args.projectId,
        });
      }
    } catch (err) {
      // Common cases: receipt already exists (already released),
      // insufficient escrow funds, project_id mismatch. All non-fatal.
      console.warn("[scorer] release_milestone skipped:", err);
    }
  }

  return { verifyTx, mintTx, releaseMilestoneTx, releaseAmountLamports };
}
