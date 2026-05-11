"use client";

/**
 * Live on-chain activity feed.
 *
 * Subscribes to the indie-pool program's `ContributionVerified` and
 * `ReputationMinted` events via WebSocket and renders incoming events as
 * they happen. On mount, also seeds the feed with the most recent
 * verified contributions read directly from chain so the panel isn't
 * empty for first-time visitors.
 *
 * No backend, no webhook, no KV — pure browser WebSocket subscription
 * to the program ID. Works with any Solana RPC that supports the
 * standard `logsSubscribe` method (Helius, public devnet, etc.). Helius
 * is recommended because the public RPC throttles WS reconnects.
 *
 * Falls back to a friendly placeholder when:
 *   - NEXT_PUBLIC_PROGRAM_ID is unset or placeholder
 *   - The RPC doesn't support subscriptions
 *   - Any connection error happens
 */

import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useMemo, useRef, useState } from "react";

import idl from "@/lib/idl/indie_pool.json";
import type { IndiePool } from "@/lib/idl/indie_pool";
import { explorerAddr, explorerTx, truncateSig } from "@/lib/explorer";

const PLACEHOLDER_PROGRAM_ID = "11111111111111111111111111111111";
const MAX_ITEMS = 6;
const HISTORY_LIMIT = 5;

type FeedItem =
  | {
      kind: "verified";
      id: string;
      ts: number;
      contributionPda: string;
      score: number;
      approved: boolean;
      signature?: string;
    }
  | {
      kind: "minted";
      id: string;
      ts: number;
      contributionPda: string;
      contributor: string;
      amount: number;
      signature?: string;
    };

export function LiveFeed() {
  // Don't touch wallet-adapter or Solana SDK code during SSR — it constructs
  // Connections eagerly and prerendering fails. Render a shell until the
  // client has mounted, then swap in the live subscription.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <FeedShell />;
  return <LiveFeedClient />;
}

function FeedShell() {
  return (
    <section className="border-t border-white/5 bg-rep-card/20">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-rep-cyan mb-1 flex items-center gap-2">
              <PulseDot active={false} />
              <span>live feed · devnet</span>
            </p>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
              On-chain activity
            </h2>
          </div>
        </div>
        <div className="px-4 py-6 bg-rep-card/30 border border-dashed border-white/10 rounded text-sm text-rep-muted text-center">
          Connecting to the chain…
        </div>
      </div>
    </section>
  );
}

function LiveFeedClient() {
  const { connection } = useConnection();
  const programIdStr = process.env.NEXT_PUBLIC_PROGRAM_ID;
  const enabled = Boolean(
    programIdStr && programIdStr !== PLACEHOLDER_PROGRAM_ID,
  );

  const [items, setItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<
    "idle" | "watching" | "history-failed" | "disabled"
  >(enabled ? "watching" : "disabled");

  // Stable program instance for both history fetch and subscriptions.
  const program = useMemo(() => {
    if (!enabled) return null;
    try {
      // Read-only operations — no wallet, no signing. AnchorProvider needs a
      // Wallet-shaped object, so we hand it a dummy whose signers always
      // throw. Subscribing never signs anything.
      const dummyWallet = {
        publicKey: PublicKey.default,
        signTransaction: async <T,>(): Promise<T> => {
          throw new Error("LiveFeed: read-only wallet cannot sign");
        },
        signAllTransactions: async <T,>(): Promise<T[]> => {
          throw new Error("LiveFeed: read-only wallet cannot sign");
        },
      };
      const provider = new AnchorProvider(
        connection,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dummyWallet as any,
        { commitment: "confirmed" },
      );
      return new Program<IndiePool>(idl as IndiePool, provider);
    } catch (err) {
      console.error("[LiveFeed] failed to instantiate Program:", err);
      return null;
    }
  }, [connection, enabled]);

  // Seed with recent verified contributions on mount so the feed isn't empty.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!program || seededRef.current) return;
    seededRef.current = true;
    void seedHistory(program).then((seed) => {
      if (seed.length === 0) return;
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        const fresh = seed.filter((i) => !seen.has(i.id));
        return [...prev, ...fresh].slice(0, MAX_ITEMS);
      });
    }).catch((err) => {
      console.warn("[LiveFeed] history seed failed:", err);
      setStatus("history-failed");
    });
  }, [program]);

  // Subscribe to live events.
  useEffect(() => {
    if (!program) return;

    const verifiedListener = program.addEventListener(
      "contributionVerified",
      (event, _slot, signature) => {
        const item: FeedItem = {
          kind: "verified",
          id: `${signature}:verified`,
          ts: Date.now(),
          contributionPda: event.contribution.toBase58(),
          score: event.score,
          approved: event.approved,
          signature,
        };
        setItems((prev) => dedupe([item, ...prev]).slice(0, MAX_ITEMS));
      },
    );

    const mintedListener = program.addEventListener(
      "reputationMinted",
      (event, _slot, signature) => {
        const item: FeedItem = {
          kind: "minted",
          id: `${signature}:minted`,
          ts: Date.now(),
          contributionPda: event.contribution.toBase58(),
          contributor: event.contributor.toBase58(),
          amount: Number(event.amount),
          signature,
        };
        setItems((prev) => dedupe([item, ...prev]).slice(0, MAX_ITEMS));
      },
    );

    return () => {
      void program.removeEventListener(verifiedListener);
      void program.removeEventListener(mintedListener);
    };
  }, [program]);

  return (
    <section className="border-t border-white/5 bg-rep-card/20">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-rep-cyan mb-1 flex items-center gap-2">
              <PulseDot active={status === "watching"} />
              <span>
                {status === "disabled"
                  ? "live feed · paused"
                  : "live feed · devnet"}
              </span>
            </p>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
              On-chain activity
            </h2>
          </div>
          <p className="hidden sm:block font-mono text-[10px] uppercase tracking-[0.2em] text-rep-muted">
            {items.length > 0
              ? `last ${items.length} event${items.length === 1 ? "" : "s"}`
              : "watching the chain…"}
          </p>
        </div>

        {!enabled ? (
          <EmptyState
            line="Live feed activates once NEXT_PUBLIC_PROGRAM_ID is set to the deployed program."
          />
        ) : items.length === 0 ? (
          <EmptyState
            line={
              status === "history-failed"
                ? "Couldn't reach the RPC for historical events. New events will still stream in here."
                : "No activity yet — submit a contribution to see real-time events appear here."
            }
          />
        ) : (
          <ol className="space-y-2">
            {items.map((it) => (
              <FeedRow key={it.id} item={it} />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function FeedRow({ item }: { item: FeedItem }) {
  const ago = useRelativeTime(item.ts);
  const label =
    item.kind === "verified"
      ? item.approved
        ? "verified ✓"
        : "rejected ✗"
      : "minted ◆";
  const labelColor =
    item.kind === "verified"
      ? item.approved
        ? "text-rep-success"
        : "text-rep-danger"
      : "text-rep-cyan";

  return (
    <li className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 bg-rep-card/40 border border-white/5 rounded font-mono text-xs hover:border-rep-cyan/20 transition-colors">
      <span
        className={`shrink-0 uppercase tracking-[0.15em] text-[10px] ${labelColor}`}
      >
        {label}
      </span>

      {item.kind === "verified" ? (
        <span className="flex-1 min-w-0 truncate text-rep-fg">
          score{" "}
          <span className="text-rep-cyan font-semibold">{item.score}</span>{" "}
          <span className="text-rep-muted">on</span>{" "}
          <ContribLink pda={item.contributionPda} />
        </span>
      ) : (
        <span className="flex-1 min-w-0 truncate text-rep-fg">
          <span className="text-rep-cyan font-semibold">+{item.amount}</span>{" "}
          <span className="text-rep-muted">REP →</span>{" "}
          <ContribLink pda={item.contributor} />
        </span>
      )}

      <span className="shrink-0 text-rep-muted hidden sm:inline tabular-nums">
        {ago}
      </span>

      {item.signature && (
        <a
          href={explorerTx(item.signature)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-rep-cyan/70 hover:text-rep-cyan transition-colors text-[10px] uppercase tracking-[0.15em]"
          aria-label="View on Solana Explorer"
        >
          {truncateSig(item.signature, 4, 4)} ↗
        </a>
      )}
    </li>
  );
}

function ContribLink({ pda }: { pda: string }) {
  return (
    <a
      href={explorerAddr(pda)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-rep-fg hover:text-rep-cyan transition-colors underline-offset-2 hover:underline"
    >
      {truncateSig(pda, 4, 4)}
    </a>
  );
}

function EmptyState({ line }: { line: string }) {
  return (
    <div className="px-4 py-6 bg-rep-card/30 border border-dashed border-white/10 rounded text-sm text-rep-muted text-center">
      {line}
    </div>
  );
}

function PulseDot({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-1.5 rounded-full ${
        active ? "bg-rep-cyan animate-pulse" : "bg-rep-muted"
      }`}
    />
  );
}

function dedupe(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  const out: FeedItem[] = [];
  for (const it of items) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

/**
 * Polls a relative timestamp string ("12s ago", "2m ago") for a moment in
 * time. Re-renders every 5s so the feed feels alive without burning
 * battery on a per-second tick.
 */
function useRelativeTime(ts: number): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  const delta = Math.max(0, Math.floor((now - ts) / 1000));
  if (delta < 5) return "just now";
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  return `${Math.floor(delta / 3600)}h ago`;
}

/**
 * Fetches the most recent Contribution accounts that have been verified
 * or minted and turns them into FeedItems. We use the account state (not
 * the event log) for history because account scans are a single RPC call
 * vs N getTransaction calls per signature.
 *
 * Items synthesized from account state get `signature: undefined` — they
 * still render, just without the Explorer tx link. Live items captured
 * via subscription will have signatures.
 */
async function seedHistory(
  program: Program<IndiePool>,
): Promise<FeedItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: { publicKey: PublicKey; account: any }[] =
    await program.account.contribution.all();

  const verified = all.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a) => (a.account.status as any)?.verified !== undefined,
  );
  verified.sort(
    (a, b) =>
      Number(b.account.verifiedAt ?? 0) - Number(a.account.verifiedAt ?? 0),
  );
  const recent = verified.slice(0, HISTORY_LIMIT);

  return recent.map((a) => {
    const ts = Number(a.account.verifiedAt) * 1000;
    if (a.account.minted) {
      return {
        kind: "minted" as const,
        id: `seed:${a.publicKey.toBase58()}:minted`,
        ts,
        contributionPda: a.publicKey.toBase58(),
        contributor: (a.account.contributor as PublicKey).toBase58(),
        amount: Number(a.account.score ?? 0),
      };
    }
    return {
      kind: "verified" as const,
      id: `seed:${a.publicKey.toBase58()}:verified`,
      ts,
      contributionPda: a.publicKey.toBase58(),
      score: Number(a.account.score ?? 0),
      approved: true,
    };
  });
}
