"use client";

/**
 * Solana wallet + connection providers.
 *
 * Marked "use client" because @solana/wallet-adapter touches `window` and
 * crypto immediately. If you ever see an SSR hydration error, wrap this
 * import in `next/dynamic` with `ssr: false` from a server component.
 */
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { useMemo } from "react";

import "@solana/wallet-adapter-react-ui/styles.css";

const DEFAULT_RPC = "https://api.devnet.solana.com";

export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = process.env.NEXT_PUBLIC_RPC_URL ?? DEFAULT_RPC;
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
