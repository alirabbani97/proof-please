"use client";

/**
 * Solana wallet + connection providers + error-surfacing.
 *
 * Marked "use client" because @solana/wallet-adapter touches `window` and
 * crypto immediately. If you ever see an SSR hydration error, wrap this
 * import in `next/dynamic` with `ssr: false` from a server component.
 *
 * Wallet registration:
 *   Do NOT register Phantom or Solflare explicitly. Both auto-register via
 *   the Wallet Standard (`window.navigator.wallets`); registering them again
 *   via PhantomWalletAdapter / SolflareWalletAdapter causes duplicate entries
 *   and breaks .connect() with "WalletConnectionError: Unexpected error".
 *   The `wallets` array below should hold ONLY legacy adapters that don't
 *   ship Wallet Standard support — practically nothing as of mid-2024.
 *
 * Error surfacing:
 *   The wallet-adapter default swallows errors into the console. We wrap the
 *   tree in WalletNoticeProvider and pipe WalletProvider.onError into it so
 *   silent failures (most commonly: extension installed but no wallet inside)
 *   produce a visible, dismissible banner instead of dead air.
 */

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { useMemo, type ReactNode } from "react";
import type { Adapter, WalletError } from "@solana/wallet-adapter-base";

import "@solana/wallet-adapter-react-ui/styles.css";

import {
  WalletNoticeProvider,
  useWalletNoticeReporter,
} from "@/components/wallet-error-banner";

const DEFAULT_RPC = "https://api.devnet.solana.com";

/**
 * Returns a valid http(s) URL; falls back to DEFAULT_RPC if the env var is
 * unset, empty, or missing a protocol. `??` alone would let `""` through;
 * the SDK then throws "Endpoint URL must start with `http:` or `https:`"
 * and breaks SSR. This is the belt-and-braces version.
 */
function resolveRpcEndpoint(): string {
  const raw = process.env.NEXT_PUBLIC_RPC_URL;
  if (raw && (raw.startsWith("https://") || raw.startsWith("http://"))) {
    return raw;
  }
  return DEFAULT_RPC;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WalletNoticeProvider>
      <InnerProviders>{children}</InnerProviders>
    </WalletNoticeProvider>
  );
}

function InnerProviders({ children }: { children: ReactNode }) {
  const endpoint = resolveRpcEndpoint();
  const wallets = useMemo<Adapter[]>(() => [], []);
  const reportError = useWalletNoticeReporter();

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider
        wallets={wallets}
        autoConnect
        onError={(err: WalletError) => reportError(err)}
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
