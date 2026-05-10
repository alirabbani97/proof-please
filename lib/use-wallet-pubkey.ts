"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useMemo } from "react";

/**
 * Connected wallet pubkey as a base58 string, or null when disconnected.
 * Stable across renders so it can be used as a hook dependency safely.
 */
export function useWalletPubkey(): string | null {
  const { publicKey } = useWallet();
  return useMemo(() => publicKey?.toBase58() ?? null, [publicKey]);
}
