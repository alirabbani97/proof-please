"use client";

/**
 * Local-storage backing for the demo. Once the Anchor program is deployed
 * and the AI scorer is real, this becomes a thin cache in front of
 * `getProgramAccounts(...)` rather than a source of truth.
 */
import type { Contribution } from "./types";

interface Store {
  contributions: Contribution[];
  /** contributor pubkey -> total REP. */
  repBalance: Record<string, number>;
}

const KEY = "indie-pool:demo:v1";
const empty = (): Store => ({ contributions: [], repBalance: {} });

export function loadStore(): Store {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Store>;
    if (!parsed || !Array.isArray(parsed.contributions)) return empty();
    return {
      contributions: parsed.contributions,
      repBalance: parsed.repBalance ?? {},
    };
  } catch {
    return empty();
  }
}

export function saveStore(store: Store): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota exceeded / disabled — demo continues from in-memory */
  }
}

export function clearStore(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
