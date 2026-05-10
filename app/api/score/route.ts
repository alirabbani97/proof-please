/**
 * AI Scorer endpoint — STUB.
 *
 * The hour 14-18 build hooks this up to:
 *   1. Receive the contribution PDA + metadata from the frontend.
 *   2. Prompt Claude (Sonnet 4.6) with the rubric (cached as a system prompt).
 *   3. Parse the JSON `{score, reasoning, approved}` response.
 *   4. Load the oracle keypair from `process.env.ORACLE_KEYPAIR_JSON`.
 *   5. Build a `verify_contribution` tx, sign with the oracle, send to devnet.
 *   6. Optionally also build & send `mint_reputation` if `approved`.
 *
 * For now, returns 501 with a documented shape so the frontend can wire
 * against the contract.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // Solana SDKs need Node crypto.
export const dynamic = "force-dynamic";

export interface ScoreRequest {
  /** Base58 pubkey of the Contribution PDA the frontend just created. */
  contributionPubkey: string;
  /** Base58 pubkey of the contributor's wallet. */
  contributor: string;
  /** Same fields the on-chain Contribution stores. */
  projectId: string;
  contributionType: string;
  ipfsHash: string;
  description: string;
}

export interface ScoreResponse {
  /** 0-100. */
  score: number;
  /** Plain-language explanation, shown in the UI. */
  reasoning: string;
  /** True iff score >= 60. */
  approved: boolean;
  /** Tx signature of the verify_contribution call, if performed. */
  verifyTx?: string;
  /** Tx signature of the mint_reputation call, if performed. */
  mintTx?: string;
}

export async function POST(req: Request): Promise<NextResponse<ScoreResponse | { error: string }>> {
  const body = (await req.json()) as Partial<ScoreRequest>;
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
      return NextResponse.json({ error: `Missing or empty field: ${k}` }, { status: 400 });
    }
  }

  // TODO(scorer): replace the stub below with the real Claude + oracle flow.
  return NextResponse.json(
    {
      score: 0,
      reasoning:
        "scorer not yet implemented — see CLAUDE.md, plan block 'Hour 14–18'",
      approved: false,
    },
    { status: 501 },
  );
}

export async function GET() {
  return NextResponse.json({
    name: "indie-pool/ai-scorer",
    status: "stub",
    method: "POST /api/score",
    requestSchema: {
      contributionPubkey: "string (base58)",
      contributor: "string (base58)",
      projectId: "string",
      contributionType: "string",
      ipfsHash: "string",
      description: "string",
    },
    responseSchema: {
      score: "number 0-100",
      reasoning: "string",
      approved: "boolean",
      verifyTx: "string | undefined",
      mintTx: "string | undefined",
    },
  });
}
