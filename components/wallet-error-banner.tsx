"use client";

/**
 * Wallet error / notice surface.
 *
 * Bridges `WalletProvider.onError` to a visible UI banner. The wallet-adapter
 * default swallows errors into the browser console — fine for engineers,
 * invisible for users. This component makes the most common onboarding
 * failures (Phantom installed but no wallet inside, popup closed mid-flow,
 * extension missing) impossible to miss.
 *
 * Architecture:
 *   WalletNoticeProvider (state owner + auto-dismiss timer)
 *     ↳ WalletErrorBanner (renders the alert)
 *     ↳ children (the rest of the app — and the actual wallet providers,
 *        wired via useWalletNoticeReporter to push errors back up)
 *
 * Why a context instead of a global event emitter or zustand:
 *   - state lifetime is tied to the React tree
 *   - server-rendered HTML stays empty (no hydration mismatch)
 *   - one file, two exports, no new dep
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface WalletNotice {
  message: string;
  detail?: string;
  /** Monotonic id; lets identical messages re-trigger auto-dismiss. */
  id: number;
}

interface WalletNoticeContextValue {
  notice: WalletNotice | null;
  pushNotice: (n: Omit<WalletNotice, "id">) => void;
  clearNotice: () => void;
}

const WalletNoticeContext = createContext<WalletNoticeContextValue>({
  notice: null,
  pushNotice: () => {},
  clearNotice: () => {},
});

const AUTO_DISMISS_MS = 10_000;

/**
 * Call from inside the Providers tree to report a wallet error. Returns a
 * stable callback you can pass to `WalletProvider.onError` directly.
 */
export function useWalletNoticeReporter() {
  const { pushNotice } = useContext(WalletNoticeContext);
  return useCallback(
    (err: unknown) => {
      // Still log to console so devs can inspect the raw error; the banner
      // is the user-facing surface, the log is the developer surface.
      console.error("[wallet]", err);
      pushNotice(translateWalletError(err));
    },
    [pushNotice],
  );
}

export function WalletNoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<WalletNotice | null>(null);

  const pushNotice = useCallback((n: Omit<WalletNotice, "id">) => {
    setNotice({ ...n, id: Date.now() });
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  // Auto-dismiss after AUTO_DISMISS_MS, but only if the same notice is still
  // showing — a newer notice replaces this one and gets its own timer.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => {
      setNotice((current) => (current?.id === notice.id ? null : current));
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [notice]);

  const value = useMemo(
    () => ({ notice, pushNotice, clearNotice }),
    [notice, pushNotice, clearNotice],
  );

  return (
    <WalletNoticeContext.Provider value={value}>
      <WalletErrorBanner />
      {children}
    </WalletNoticeContext.Provider>
  );
}

function WalletErrorBanner() {
  const { notice, clearNotice } = useContext(WalletNoticeContext);
  if (!notice) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[60] bg-rep-card/95 backdrop-blur-md border-b border-rep-amber/60 px-4 sm:px-6 py-3 sm:py-4 shadow-[0_12px_32px_-16px_rgba(245,158,11,0.5)]"
    >
      <div className="max-w-5xl mx-auto flex items-start gap-3 sm:gap-5">
        <span
          aria-hidden
          className="hidden sm:inline-block mt-1.5 size-2 rounded-full bg-rep-amber animate-pulse shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-rep-amber mb-1">
            wallet · couldn&apos;t connect
          </div>
          <p className="text-sm sm:text-[15px] text-rep-fg leading-relaxed">
            {notice.message}
          </p>
          {notice.detail && (
            <details className="mt-2">
              <summary className="font-mono text-[10px] uppercase tracking-wider text-rep-muted cursor-pointer hover:text-rep-fg transition-colors select-none w-fit">
                technical detail
              </summary>
              <pre className="mt-2 text-[10px] font-mono text-rep-muted whitespace-pre-wrap break-all leading-relaxed max-h-32 overflow-auto">
                {notice.detail}
              </pre>
            </details>
          )}
        </div>
        <button
          type="button"
          onClick={clearNotice}
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 border border-rep-cyan/40 text-rep-cyan hover:bg-rep-cyan/10 hover:border-rep-cyan transition-colors rounded"
          aria-label="Dismiss wallet error"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

/**
 * Pure translator: takes whatever was thrown and returns a user-facing
 * message plus optional technical detail. We match on `name` (the
 * wallet-adapter `WalletError` subclass) first, then on substrings in the
 * message because Phantom's specific error shape has been unstable across
 * versions. The fallback always returns *something* the user can read.
 */
function translateWalletError(err: unknown): {
  message: string;
  detail?: string;
} {
  const e = err as { name?: string; message?: string };
  const name = typeof e?.name === "string" ? e.name : "";
  const rawMessage =
    typeof e?.message === "string" && e.message.length > 0
      ? e.message
      : String(err);
  const detail = `${name || "Error"}: ${rawMessage}`;

  // No extension installed at all.
  if (
    name === "WalletNotReadyError" ||
    /not.{0,5}installed|not.{0,5}detected/i.test(rawMessage)
  ) {
    return {
      message:
        "No wallet extension detected in this browser. Install Phantom (phantom.app) or Solflare (solflare.com), refresh this page, then click Connect.",
      detail,
    };
  }

  // User canceled the popup or browser blocked it.
  if (
    name === "WalletWindowClosedError" ||
    name === "WalletWindowBlockedError" ||
    /user rejected|user denied|wallet window|popup blocked/i.test(rawMessage)
  ) {
    return {
      message:
        "Wallet popup was closed before connection finished. Click Connect to try again — make sure popups aren't blocked for this site.",
      detail,
    };
  }

  // Mid-session signing failed.
  if (
    name === "WalletSignTransactionError" ||
    name === "WalletSignMessageError"
  ) {
    return {
      message:
        "Wallet refused to sign. Open your wallet extension to check for a stuck approval dialog, then retry.",
      detail,
    };
  }

  // Disconnected mid-session.
  if (name === "WalletDisconnectedError") {
    return {
      message: "Your wallet disconnected. Click Connect to reconnect.",
      detail,
    };
  }

  // The headline case: extension installed but no usable account inside.
  // Phantom throws WalletConnectionError with message "Unexpected error"
  // here; Solflare's path is different but the user fix is the same.
  // We match generously because the underlying shapes are inconsistent.
  if (
    name === "WalletConnectionError" ||
    name === "WalletNotConnectedError" ||
    name === "WalletAccountError" ||
    /no accounts|unexpected error|no public key/i.test(rawMessage)
  ) {
    return {
      message:
        "Couldn't connect to your wallet. If your wallet extension is installed: open it, make sure you've created or imported a wallet (and that it's unlocked + set to Devnet), then click Connect again.",
      detail,
    };
  }

  // Unknown shape — surface what we have rather than silently dropping it.
  return {
    message: `Wallet error: ${rawMessage}`,
    detail: name || undefined,
  };
}
