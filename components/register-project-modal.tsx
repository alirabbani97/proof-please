"use client";

/**
 * Register Project modal — first step of the Layer-0 flow.
 *
 * Anyone connected can register a project. First caller wins on the slug
 * (PDA is keyed on it). After registration, the same wallet (or anyone)
 * can fund an escrow against the slug.
 *
 * The form lets the caller pick slug, name, blurb, an emoji-style art
 * marker, and the primary contribution type. Each field is length-
 * checked against the program's max constants.
 */

import { useEffect, useRef, useState } from "react";
import {
  useAnchorWallet,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";

import { registerProject } from "@/lib/indie-pool/client";
import {
  CONTRIBUTION_TYPES,
  type ContributionType,
} from "@/lib/indie-pool/types";
import { explorerTx, truncateSig } from "@/lib/explorer";

type Stage =
  | { kind: "form" }
  | { kind: "submitting" }
  | { kind: "done"; signature: string; projectPda: string }
  | { kind: "error"; message: string };

const ART_PRESETS = ["🎨", "🎮", "🎵", "🎼", "💻", "📝", "🐛", "✨", "🟪", "🌌", "🌊", "⚡"];

export function RegisterProjectModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { connected } = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  const slugRef = useRef<HTMLInputElement | null>(null);

  const [stage, setStage] = useState<Stage>({ kind: "form" });
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [art, setArt] = useState("🎮");
  const [primaryType, setPrimaryType] = useState<ContributionType>("code");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    const t = setTimeout(() => slugRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit() {
    if (!anchorWallet) {
      setStage({ kind: "error", message: "Wallet not ready." });
      return;
    }
    const cleanSlug = slug.trim().toLowerCase().replace(/\s+/g, "-");
    const cleanName = name.trim();
    const cleanBlurb = blurb.trim();
    if (!cleanSlug || !cleanName || !cleanBlurb) {
      setStage({
        kind: "error",
        message: "Slug, name, and blurb are required.",
      });
      return;
    }
    if (cleanSlug.length > 64) {
      setStage({ kind: "error", message: "Slug must be ≤ 64 chars." });
      return;
    }
    if (cleanName.length > 64) {
      setStage({ kind: "error", message: "Name must be ≤ 64 chars." });
      return;
    }
    if (cleanBlurb.length > 256) {
      setStage({ kind: "error", message: "Blurb must be ≤ 256 chars." });
      return;
    }
    setStage({ kind: "submitting" });
    try {
      const { signature, projectPda } = await registerProject(
        {
          projectId: cleanSlug,
          name: cleanName,
          blurb: cleanBlurb,
          art,
          primaryType,
        },
        { connection, wallet: anchorWallet },
      );
      setStage({ kind: "done", signature, projectPda });
      onSuccess();
    } catch (err) {
      // Most common error: "account already in use" → slug taken.
      const msg = err instanceof Error ? err.message : String(err);
      const friendly = /already in use|0x0/.test(msg)
        ? `Slug "${cleanSlug}" is already registered. Pick a different one.`
        : msg;
      setStage({ kind: "error", message: friendly });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Register a new project"
    >
      {/* Backdrop — dim only; click does NOT close. Use Cancel or Esc. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/70 rep-overlay-in"
      />

      <div className="relative max-w-md w-full bg-rep-card border border-white/10 rounded-lg p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto">
        <header className="mb-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-rep-cyan mb-1">
            layer 0 · project registry
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            Register a project
          </h2>
          <p className="text-xs text-rep-muted mt-1 leading-relaxed">
            Anyone can register. First caller wins the slug. Once registered,
            anyone can fund its escrow and submit contributions to it.
          </p>
        </header>

        {!connected ? (
          <p className="text-sm text-rep-muted text-center py-8">
            Connect a wallet to register a project.
          </p>
        ) : stage.kind === "submitting" ? (
          <p className="text-sm text-rep-muted text-center py-8">
            Awaiting wallet signature & confirmation…
          </p>
        ) : stage.kind === "done" ? (
          <div className="py-2 space-y-4">
            <p className="text-sm text-rep-success">✓ Project registered.</p>
            <a
              href={explorerTx(stage.signature)}
              target="_blank"
              rel="noopener noreferrer"
              className="block font-mono text-xs text-rep-cyan hover:underline truncate"
            >
              tx · {truncateSig(stage.signature)} ↗
            </a>
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 border border-white/15 hover:border-rep-fg text-sm transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-4"
          >
            <Field label="Slug" hint="Lowercase, kebab-case. Used as the on-chain key.">
              <input
                ref={slugRef}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                maxLength={64}
                placeholder="my-cool-game"
                required
                className="w-full bg-rep-bg border border-white/10 rounded px-3 py-2.5 font-mono text-sm focus:outline-none focus:border-rep-cyan/60"
              />
            </Field>

            <Field label="Display name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={64}
                placeholder="My Cool Game"
                required
                className="w-full bg-rep-bg border border-white/10 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-rep-cyan/60"
              />
            </Field>

            <Field
              label="Blurb"
              hint={`Short pitch (${blurb.length}/256 chars).`}
            >
              <textarea
                value={blurb}
                onChange={(e) => setBlurb(e.target.value)}
                maxLength={256}
                rows={3}
                placeholder="What's the project? What kind of contributions are you looking for?"
                required
                className="w-full bg-rep-bg border border-white/10 rounded px-3 py-2.5 text-sm focus:outline-none focus:border-rep-cyan/60 resize-y"
              />
            </Field>

            <Field label="Art (emoji)">
              <div className="flex flex-wrap gap-1.5">
                {ART_PRESETS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setArt(emoji)}
                    className={`size-9 grid place-items-center text-lg border rounded transition-colors ${
                      art === emoji
                        ? "border-rep-cyan bg-rep-cyan/10"
                        : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Primary contribution type">
              <div className="grid grid-cols-3 gap-1.5">
                {CONTRIBUTION_TYPES.map((t) => {
                  const active = primaryType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setPrimaryType(t.value)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs transition-colors ${
                        active
                          ? "border-rep-cyan/60 bg-rep-cyan/10 text-rep-cyan"
                          : "border-white/10 bg-rep-bg text-rep-muted hover:text-rep-fg"
                      }`}
                    >
                      <span className="font-mono">{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            {stage.kind === "error" && (
              <p className="text-xs text-rep-danger font-mono leading-relaxed">
                {stage.message}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 border border-white/15 hover:border-rep-fg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 bg-rep-cyan text-black text-sm font-semibold hover:bg-rep-cyan/85 transition-colors"
              >
                Register
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-rep-fg mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-rep-muted mt-1">{hint}</p>}
    </div>
  );
}
