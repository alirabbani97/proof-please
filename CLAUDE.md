# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo state: hour-0 scaffold complete

The repo has a buildable Next.js 16 frontend, an Anchor program drafted in Rust (not yet compiled because Rust/Anchor aren't installed), a smoke-test file, and a stubbed AI scorer route. Nothing is deployed yet. `pnpm build` is green.

Two spec files at the project root: **`paper_please_004.docx`** is the latest (added §4 Token Economic Model) and supersedes `paper please.docx`. Both are binary OOXML — convert before reading:

```bash
libreoffice --headless --convert-to txt --outdir /tmp "paper_please_004.docx"
```

§1–§3 are unchanged from v3; §4 is new and adds the economic-model rationale (no native token, two-layer SBT + SOL design, anti-speculation framing). The §4 anchors are mapped to specific code decisions in the "Why these decisions" subsection below.

The spec is the source of truth for everything except the explicit "Locked implementation decisions" section, which overrides it intentionally.

### Pinned versions (already in lockfile)

| | Pinned | Notes |
|---|---|---|
| Next.js | 16.2.6 | Has its own AGENTS.md warning that APIs differ from training data — read `node_modules/next/dist/docs/` before touching App Router idioms. |
| React | 19.2.4 | |
| Tailwind | 4.3 | v4 uses `@theme inline { ... }` in CSS, **not** `tailwind.config.js`. The cyberpunk palette lives in `app/globals.css`. |
| Anchor (TS + Rust) | 0.32.1 | Newer than the spec's 0.29; matches the latest crates. |
| Solana CLI (target) | 2.x | Install via `https://release.anza.xyz/stable/install` (the old solana.com installer is retired). |
| Rust (target) | stable (≥1.79) | |

### Critical pnpm config — don't remove `.npmrc`

The `.npmrc` sets `node-linker=hoisted` and `public-hoist-pattern[]=*`. **Don't switch back to pnpm's default symlink layout** — it breaks Turbopack on this machine. Why: `pnpm setup` configured a global virtual store at `~/.local/share/pnpm/global/5/.pnpm/`, and pnpm symlinks `node_modules/next` directly there. Turbopack enforces a strict project root and refuses to compile across that symlink. Hoisted layout makes `node_modules/` flat with real packages — fixes Turbopack *and* fixes the Solana wallet-adapter peer-resolution issues that pnpm's isolated layout causes.

If you ever see "We couldn't find the Next.js package (next/package.json) from the project directory: .../app", that's this issue resurfacing. Fix: `rm -rf node_modules pnpm-lock.yaml && pnpm install`.

### Wallet adapter import discipline

Import wallets from their **direct** packages, never from `@solana/wallet-adapter-wallets`:

```ts
// good
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";

// bad — pulls in 30+ adapters including a broken @fractalwagmi one
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
```

The meta-package was already removed from this project for that reason.

## Locked implementation decisions (May 10, 2026)

The spec lists ideals; this section pins what the team is actually shipping. If a section below conflicts with the spec, **this section wins** — it reflects scope-cut choices made after analysis.

- **SBT mechanism:** Token-2022 with the built-in `NonTransferable` mint extension. **No Metaplex, no UMI.** Single global `REP` mint. On `verify_contribution`, program mints `score` REP to the contributor's ATA. Lifetime balance = total reputation.
- **Anchor instructions shipped:** `initialize_oracle`, `submit_contribution`, `verify_contribution`, `mint_reputation`. **`create_project_escrow` and `release_milestone` are NOT implemented** — the Project Pool screen is a UI mock with hardcoded numbers. The spec explicitly allows this (§3.2 "Hour 40-46").
- **AI scorer location:** Vercel serverless route at `/api/score` in the same Next.js app. **Not a standalone `/ai-scorer` Node service** — that part of the spec's directory layout is collapsed into the frontend project.
- **Scorer model:** Claude Sonnet 4.6 (`claude-sonnet-4-6`) with prompt caching on the rubric. The spec's `claude-sonnet-4-20250514` is stale.
- **File handling:** User pastes an IPFS hash; no browser-side upload. The score is computed on metadata + description, so the file content is not actually read by the scorer for the MVP.
- **Oracle:** Single keypair stored as a Vercel secret (`ORACLE_KEYPAIR_JSON`). Pubkey written to program state via `initialize_oracle` once at deploy time. The "decentralized scorer" framing in the spec is aspirational; the README will be honest about this.
- **Identity:** Wallet pubkey only. No DIDs.
- **Repo layout:** Single Next.js app at the root with Anchor program in `programs/indie-pool/`. No separate `app/` directory.

### Why these decisions (validated against v004 §4)

The v004 spec's §4 "Token Economic Model" arrived after these decisions were locked. Reading it back, every technical choice traces to a specific §4 anchor — **don't unwind any of these without consulting §4 first**:

- **Token-2022 NonTransferable mint** ← §4.2 Layer 1: *"Reputation is earned, not purchased… cannot be bought, sold, or transferred."* Soulbound semantics are load-bearing; a transferable token re-enables the plutocratic capture §4.3 explicitly designs against ("preventing whale capture").
- **No native fungible token at MVP** ← §4.2 Layer 2: *"No native speculative token is required at this stage, reducing regulatory exposure and eliminating pump-and-dump risk."* Don't add one without reading §4.4.
- **Score ≥ 60 threshold** ← §4.3: *"Contributors only receive SBTs and escrow payouts for verified, quality work (AI score ≥ 60)."* The threshold is referenced in `lib.rs` (`APPROVAL_THRESHOLD`), `app/api/score/route.ts`, and `lib/indie-pool/types.ts`. Don't drop it.
- **AI scorer instead of committee voting** ← §4.6: *"AI scoring replaces committee governance for small teams, enabling fast iteration."* If a future PR adds DAO/voting infrastructure, that's reverting a deliberate design choice.
- **Single global REP mint, balance = lifetime score** ← §4.2: *"cumulative scores build a cross-project reputation profile."* Per-project mints would break cross-project portability.
- **Mocked escrow on /pool** ← §3.2 "Hour 40-46" allows it explicitly; §4.3 marks staking/governance as Phase 2 (deferred until proven escrow demand).

If a future session is tempted to switch to Metaplex SBTs, add a fungible governance token, drop the score threshold, or replace the AI scorer with committee voting, **read v004 §4 first**. The decisions look arbitrary from code alone but are anchored to specific spec constraints.

## What this project is

**Product name:** *Proof, please!* — public-facing, used in UI copy and pitch.
**Codename:** *Indie Pool* — used in code, repo paths, package names, and the planned GitHub repo `brutalesxyz/indie-pool`.

A Solana dApp that turns creative contributions (code, art, music, 3D, writing, testing) into portable on-chain reputation. Each contribution is AI-scored 0–100 and minted as a **Soulbound Token** (non-transferable NFT) so reputation travels across projects but can't be traded.

**The entire MVP is one demo flow** (mentor scope-down by Adrija, 9 May 2026 — original DAO/multi-role/milestone scope was explicitly cut):

1. Connect Phantom/Solflare wallet
2. Submit contribution metadata + IPFS hash
3. AI scorer (Claude) assigns 0–100 with reasoning
4. Score minted as SBT on Solana **devnet**
5. Dashboard reflects new reputation + history
6. Escrow contract releases milestone funds to verified contributors

Mock what you can't finish — the demo is the product. One flow end-to-end beats five flows half-built.

## Planned architecture

Three loosely-coupled pieces. The Anchor program is the only trusted component; the scorer and frontend are untrusted and communicate across an oracle boundary.

```
React frontend (app/)  ──user tx──▶  Anchor program (programs/indie-pool/)
        │                                    ▲
        │ submits metadata                   │ oracle-signed verify_contribution
        ▼                                    │
  AI scorer (ai-scorer/) ────Claude API──────┘
```

### Anchor program — `programs/indie-pool/src/lib.rs`

Anchor 0.29 on Rust 1.75. Five instructions:

- `submit_contribution(project_id, contribution_type, ipfs_hash)` — contributor-signed; opens a contribution account in `Pending`.
- `verify_contribution(score, reasoning_hash)` — **oracle-only**. The signer must equal an oracle pubkey stored in program state. The whole trust model rides on this check; if you touch this instruction, the signer-equality validation is load-bearing.
- `mint_reputation_sbt` — mints a non-transferable token via Metaplex UMI. **SBT semantics matter:** `is_mutable=false`, `freeze_authority=None`. A transferable token breaks the reputation premise.
- `create_project_escrow` — project creator deposits SOL into a PDA tied to a project ID.
- `release_milestone` — distributes escrow SOL proportionally to verified contributors after `verify_contribution`.

PDAs back contributor accounts and project escrows. The oracle pubkey lives in program state, not hardcoded (spec §3.5 "Oracle trust issue").

### AI scorer — `ai-scorer/scorer.js`

Node ≥18 service. Pipeline: read contribution metadata → prompt Claude with the rubric (originality, completeness, project relevance, technical quality, community value) → parse `{score: 0-100, reasoning: string, approved: boolean}` (approved when score ≥ 60) → sign with the oracle keypair at `ORACLE_KEYPAIR_PATH` → submit `verify_contribution` on-chain.

**Model pinning:** the spec hardcodes `claude-sonnet-4-20250514`. That string was current when the spec was written; check for a newer Sonnet/Opus before pinning. Default to the latest capable model unless the user is reproducing the original demo verbatim.

**Honesty note:** the spec calls this "decentralized" but the implementation is a single Node service signing with one oracle keypair. Fine for MVP; don't repeat the "decentralized" claim in code comments or UI without qualifying it. Spec acknowledges ZK proofs as future work.

### Frontend — `app/`

React 18 + TypeScript + Tailwind + `@solana/web3.js` + `@solana/wallet-adapter`. Five screens drive the demo: Connect Wallet, Submit Contribution, Pending Verification, Reputation Dashboard, Project Pool.

- `app/src/hooks/useIndiePool.ts` wraps Anchor program calls.
- `app/src/utils/anchorClient.ts` owns the Anchor provider/program setup.
- File uploads target IPFS via `web3.storage`.

## Aesthetic — non-negotiable

Brutales XYZ visual identity, from spec §3.6. Part of the brief, not a suggestion:

- Backgrounds: `#0D0D1A` base, `#1A1A2E` cards
- Accents: cyan `#00E5FF` (primary actions), purple `#7C3AED` (secondary)
- Monospace for on-chain data (addresses, hashes, scores); sans-serif for UI prose
- Wallet addresses always truncated head/tail with `…` separator (e.g. `FLEb…gnCd` for a Solana base58 pubkey). Spec v3 used a stale Ethereum-style `0x1234...ABCD` example; v004 corrected it to the base58 form. The `truncateKey()` helper in `components/truncate-key.tsx` already does this — never add a `0x` prefix.
- Glitch CSS animations on loading states
- "No clean corporate vibes" — community tool, decentralized, anti-corporate

## Commands (valid only after scaffolding exists)

```bash
# Bootstrap (Hour 0-4 of the sprint plan)
anchor init indie-pool
npx create-react-app app --template typescript

# Smart contracts
anchor build
anchor test                                       # full suite
anchor test -- --grep "submit_contribution"       # single test
anchor deploy --provider.cluster devnet

# Frontend (cd app/)
npm run dev

# AI scorer (cd ai-scorer/)
ANTHROPIC_API_KEY=<key> node scorer.js
```

**Toolchain pins** (spec §3.5 — version mismatch is the #1 build failure):
- Rust **1.75.0** (`rustup default 1.75.0`)
- Anchor CLI **0.29.0**
- Node ≥ 18
- `solana-cli` (devnet configured, wallet airdropped)

## Environment variables

```
ANTHROPIC_API_KEY=
SOLANA_RPC_URL=https://api.devnet.solana.com
ORACLE_KEYPAIR_PATH=./oracle-keypair.json
NEXT_PUBLIC_PROGRAM_ID=<deployed program id>
NEXT_PUBLIC_NETWORK=devnet
```

## Things in the spec to push back on

The spec was written under hackathon pressure. Before implementing literally:

- **Pinned model** `claude-sonnet-4-20250514` — likely outdated; confirm with the user.
- **"Decentralized scorer"** rhetoric vs. single-oracle-keypair reality — don't propagate the mismatch.
- **Noah AI–generated contracts** — treat as drafts; run `anchor test` and review the signer/PDA logic before shipping.
- **Mocked escrow UI** is explicitly allowed by the spec; don't over-build it at the expense of the contribution → score → SBT path, which is the demo.
