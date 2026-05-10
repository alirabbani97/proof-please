/**
 * Shared types between UI and the (currently mocked) on-chain client.
 * These mirror the on-chain `Contribution` account in
 * programs/indie-pool/src/lib.rs and the `/api/score` response shape.
 */

export type ContributionStatus = "Pending" | "Verified" | "Rejected";

export type ContributionType =
  | "code"
  | "art"
  | "music"
  | "3d"
  | "writing"
  | "testing";

export const CONTRIBUTION_TYPES: { value: ContributionType; label: string; icon: string }[] = [
  { value: "code", label: "Code", icon: "</>" },
  { value: "art", label: "Art", icon: "✦" },
  { value: "music", label: "Music", icon: "♫" },
  { value: "3d", label: "3D Model", icon: "▣" },
  { value: "writing", label: "Writing", icon: "✎" },
  { value: "testing", label: "Testing", icon: "✓" },
];

/** Threshold on-chain: score >= 60 → Verified. */
export const APPROVAL_THRESHOLD = 60;

export interface Contribution {
  /** Base58 pubkey of the contribution PDA. */
  pubkey: string;
  /** Contributor wallet, base58. */
  contributor: string;
  /** u64 nonce (string for BigInt safety) used in PDA seeds. */
  nonce: string;
  projectId: string;
  contributionType: ContributionType;
  ipfsHash: string;
  description: string;
  status: ContributionStatus;
  /** 0-100; meaningful only after status !== Pending. */
  score: number;
  /** Plain-text reasoning from the AI scorer. Stored client-side only. */
  reasoning?: string;
  /** Unix seconds. */
  submittedAt: number;
  verifiedAt?: number;
  /** Whether REP has been minted on-chain for this contribution. */
  minted: boolean;
}

export interface ScoreResult {
  score: number;
  reasoning: string;
  approved: boolean;
}
