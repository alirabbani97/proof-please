"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { WalletGate } from "@/components/wallet-gate";
import { ContributionCard } from "@/components/contribution-card";
import { RepBalance } from "@/components/rep-balance";
import { TruncatedKey } from "@/components/truncate-key";
import { useWalletPubkey } from "@/lib/use-wallet-pubkey";
import { listContributions, getRepBalance } from "@/lib/indie-pool/client";
import { clearStore } from "@/lib/indie-pool/store";
import type { Contribution } from "@/lib/indie-pool/types";

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Nav />
      <WalletGate prompt="Connect a wallet to view your reputation">
        <Dashboard />
      </WalletGate>
    </main>
  );
}

function Dashboard() {
  const wallet = useWalletPubkey();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [rep, setRep] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);

  // The store is localStorage-backed (only readable on the client); we
  // deliberately set state inside the effect so server-rendered HTML shows
  // an empty dashboard and the client hydrates with real data. Replace
  // with useSyncExternalStore once the data source becomes a real Solana
  // RPC subscription.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!wallet) return;
    setContributions(listContributions(wallet));
    // getRepBalance is async — it tries the on-chain ATA first, then falls
    // back to localStorage. Guard against the wallet flipping mid-flight so
    // we don't write a stale value into state.
    let cancelled = false;
    getRepBalance(wallet)
      .then((bal) => {
        if (!cancelled) setRep(bal);
      })
      .catch(() => {
        if (!cancelled) setRep(0);
      });
    return () => {
      cancelled = true;
    };
  }, [wallet, refreshNonce]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!wallet) return null;

  const verified = contributions.filter((c) => c.status === "Verified");
  const pending = contributions.filter((c) => c.status === "Pending");
  const rejected = contributions.filter((c) => c.status === "Rejected");

  return (
    <section className="flex-1 px-4 sm:px-6 py-12 sm:py-16">
      <div className="max-w-4xl mx-auto space-y-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-rep-cyan mb-2 flex items-center gap-2">
            <span>wallet ·</span>
            <TruncatedKey pubkey={wallet} className="text-rep-fg" />
          </p>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Reputation dashboard
            </h1>
            <Link
              href="/submit"
              className="px-5 py-2.5 rounded-md bg-rep-cyan text-black font-medium hover:bg-rep-cyan/85 transition-colors text-sm"
            >
              + New contribution
            </Link>
          </div>
        </div>

        <RepBalance amount={rep} contributionCount={verified.length} />

        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Stat label="verified" value={verified.length} accent="success" />
          <Stat label="pending" value={pending.length} accent="cyan" />
          <Stat label="rejected" value={rejected.length} accent="danger" />
        </div>

        <div>
          <h2 className="text-lg font-semibold tracking-tight mb-4">
            Contribution history
          </h2>
          {contributions.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {contributions.map((c) => (
                <ContributionCard key={c.pubkey} c={c} />
              ))}
            </div>
          )}
        </div>

        {contributions.length > 0 && (
          <div className="text-center pt-6 border-t border-white/5">
            <button
              onClick={() => {
                clearStore();
                setRefreshNonce((n) => n + 1);
              }}
              className="font-mono text-xs uppercase tracking-[0.2em] text-rep-muted hover:text-rep-danger transition-colors"
              title="Wipes the local-storage demo cache. Real on-chain data is unaffected."
            >
              ↺ clear demo data
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "success" | "cyan" | "danger";
}) {
  const color =
    accent === "success"
      ? "text-rep-success"
      : accent === "cyan"
      ? "text-rep-cyan"
      : "text-rep-danger";
  return (
    <div className="rounded-xl border border-white/5 bg-rep-card/40 p-4 sm:p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-rep-muted mb-2">
        {label}
      </p>
      <p className={`text-2xl sm:text-3xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-14 px-6 rounded-2xl border border-dashed border-white/10 bg-rep-card/20">
      <p className="text-rep-muted text-sm mb-5 max-w-sm mx-auto leading-relaxed">
        Nothing on chain yet. Submit your first contribution and the AI scorer
        will mint your first REP.
      </p>
      <Link
        href="/submit"
        className="inline-block px-6 py-3 rounded-md bg-rep-cyan text-black font-medium hover:bg-rep-cyan/85 transition-colors"
      >
        Submit your first contribution
      </Link>
    </div>
  );
}
