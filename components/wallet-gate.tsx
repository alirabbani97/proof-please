"use client";

import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import type { ReactNode } from "react";

const ConnectWalletButton = dynamic(
  () =>
    import("@/components/connect-wallet-button").then(
      (m) => m.ConnectWalletButton,
    ),
  { ssr: false },
);

/**
 * Render `children` only when a wallet is connected; otherwise show a
 * connect prompt with a `ConnectWalletButton`.
 */
export function WalletGate({
  children,
  prompt,
}: {
  children: ReactNode;
  prompt?: string;
}) {
  const { connected, publicKey } = useWallet();
  if (connected && publicKey) return <>{children}</>;

  return (
    <div className="grid place-items-center py-24 px-6">
      <div className="max-w-md text-center space-y-6 p-8 sm:p-10 rounded-2xl border border-rep-purple/20 bg-rep-card/50 backdrop-blur-sm">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-rep-purple">
          wallet required
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">
          {prompt ?? "Connect a wallet to continue"}
        </h2>
        <p className="text-rep-fg/70 text-sm leading-relaxed">
          Indie Pool runs on Solana devnet. Install Phantom or Solflare if you
          don&apos;t have one, then come back and click below.
        </p>
        <div className="flex justify-center">
          <ConnectWalletButton />
        </div>
      </div>
    </div>
  );
}
