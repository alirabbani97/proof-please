/**
 * Solana Explorer URL helpers.
 *
 * Respects `NEXT_PUBLIC_NETWORK` so the same code works whether the dApp
 * is pointing at devnet, testnet, or mainnet. Defaults to devnet.
 *
 * Why explorer.solana.com (and not solscan.io / xray):
 *   - explorer.solana.com is the canonical first-party explorer
 *   - URL scheme is stable
 *   - works for both txs and accounts with the same `?cluster=` param
 */

const NETWORK = process.env.NEXT_PUBLIC_NETWORK ?? "devnet";

// mainnet-beta doesn't need a cluster query param (it's the default).
const CLUSTER_SUFFIX = NETWORK === "mainnet-beta" ? "" : `?cluster=${NETWORK}`;

export function explorerTx(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}${CLUSTER_SUFFIX}`;
}

export function explorerAddr(address: string): string {
  return `https://explorer.solana.com/address/${address}${CLUSTER_SUFFIX}`;
}

/** Truncated head…tail base58, for use as the visible link text. */
export function truncateSig(sig: string, head = 6, tail = 6): string {
  if (sig.length <= head + tail + 1) return sig;
  return `${sig.slice(0, head)}…${sig.slice(-tail)}`;
}
