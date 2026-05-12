"use client";

/**
 * Custom Connect Wallet button.
 *
 * Replaces `WalletMultiButton` from @solana/wallet-adapter-react-ui because
 * that component's "no-wallet" state renders with `background-color: transparent`
 * on some browsers (Edge in particular — Brave + Chrome are fine). Result on
 * a dark nav: invisible button. A judge arriving in incognito without an
 * extension sees nothing to click.
 *
 * This component is always visible, uses our Tailwind palette, and drives
 * the same wallet modal via `useWalletModal()` — install links work the
 * same way.
 */

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

import { truncateSig } from "@/lib/explorer";

export function ConnectWalletButton() {
  const { connected, publicKey, disconnect, connecting, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const [menuOpen, setMenuOpen] = useState(false);

  // Connecting state — show a transient busy label.
  if (connecting) {
    return (
      <div className="font-mono text-xs uppercase tracking-[0.15em] px-3 sm:px-4 py-2 sm:py-2.5 bg-rep-cyan/30 text-rep-cyan border border-rep-cyan/60 rounded">
        Connecting…
      </div>
    );
  }

  // Connected — show pubkey + dropdown for disconnect.
  if (connected && publicKey) {
    const addr = publicKey.toBase58();
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="font-mono text-xs uppercase tracking-[0.15em] px-3 sm:px-4 py-2 sm:py-2.5 bg-rep-card border border-rep-cyan/40 text-rep-cyan hover:bg-rep-cyan/10 hover:border-rep-cyan transition-colors rounded inline-flex items-center gap-2"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          {wallet?.adapter?.icon && (
            <span
              aria-hidden
              className="inline-block size-4 rounded-sm bg-cover bg-center shrink-0"
              style={{ backgroundImage: `url(${wallet.adapter.icon})` }}
            />
          )}
          <span>{truncateSig(addr, 4, 4)}</span>
          <span aria-hidden className="text-rep-cyan/60 text-[10px]">
            ▾
          </span>
        </button>
        {menuOpen && (
          <>
            {/* Backdrop to close the menu on outside click */}
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-30 cursor-default"
            />
            <ul
              role="menu"
              className="absolute right-0 top-full mt-1 z-40 min-w-[180px] bg-rep-card border border-white/10 rounded shadow-lg overflow-hidden"
            >
              <li>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(addr);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left font-mono text-xs px-3 py-2.5 hover:bg-white/5 transition-colors"
                  role="menuitem"
                >
                  Copy address
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setVisible(true);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left font-mono text-xs px-3 py-2.5 hover:bg-white/5 transition-colors"
                  role="menuitem"
                >
                  Change wallet
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    void disconnect();
                    setMenuOpen(false);
                  }}
                  className="w-full text-left font-mono text-xs px-3 py-2.5 text-rep-danger hover:bg-rep-danger/10 transition-colors border-t border-white/5"
                  role="menuitem"
                >
                  Disconnect
                </button>
              </li>
            </ul>
          </>
        )}
      </div>
    );
  }

  // Not connected — the always-visible "Connect Wallet" CTA. Cyan-on-black
  // so it pops on the dark nav even when no wallet is installed.
  return (
    <button
      type="button"
      onClick={() => setVisible(true)}
      className="font-mono text-xs uppercase tracking-[0.15em] font-semibold px-4 py-2.5 bg-rep-cyan text-black hover:bg-rep-cyan/85 transition-colors rounded"
    >
      Connect wallet
    </button>
  );
}
