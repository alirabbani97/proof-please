"use client";

/**
 * Solana wallet + connection providers.
 *
 * Marked "use client" because @solana/wallet-adapter touches `window` and
 * crypto immediately. If you ever see an SSR hydration error, wrap this
 * import in `next/dynamic` with `ssr: false` from a server component.
 *
 * IMPORTANT: do NOT register Phantom or Solflare explicitly. Both auto-register
 * via the Wallet Standard (`window.navigator.wallets`); registering them again
 * via PhantomWalletAdapter / SolflareWalletAdapter causes duplicate entries
 * and breaks .connect() with "WalletConnectionError: Unexpected error".
 * The `wallets` array below should only hold *legacy* adapters that don't
 * yet ship Wallet Standard support. As of mid-2024 that's basically nothing.
 */
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { useMemo } from "react";
import type { Adapter } from "@solana/wallet-adapter-base";

import "@solana/wallet-adapter-react-ui/styles.css";

const DEFAULT_RPC = "https://api.devnet.solana.com";

export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = process.env.NEXT_PUBLIC_RPC_URL ?? DEFAULT_RPC;
  const wallets = useMemo<Adapter[]>(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
