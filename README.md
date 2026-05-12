# Proof, please!

**AI-verified, soulbound reputation infrastructure for creators on Solana.**

> Hackathon MVP · May 2026 · by Brutales XYZ
> Codename: **Indie Pool**

Submit creative work — code, art, music, 3D, writing — get it AI-scored by Claude, and earn non-transferable on-chain reputation as Soulbound Tokens. When a project funds an escrow, verified contributions also unlock real SOL payouts. **Two layers, one signal.**

```
Layer 1 — Reputation (soulbound)    score → REP token (Token-2022 NonTransferable)
Layer 2 — Rewards (fungible SOL)    score → escrow payout (PDA-held SOL)
```

Both layers settle in a single oracle-signed transaction off the AI verdict.

---

## Live deployment

| | Address |
|---|---|
| **Anchor program (devnet)** | [`EvgHfdx5xyTNoPnaHwDtySdAtMUYGcMz9nwCiwMLi9sn`](https://explorer.solana.com/address/EvgHfdx5xyTNoPnaHwDtySdAtMUYGcMz9nwCiwMLi9sn?cluster=devnet) |
| **Frontend** | Deployed on Vercel — see project URL in repo description |

Open the dApp, scroll past the hero, and you'll see a **live activity feed** subscribed via WebSocket to the program's `ContributionVerified` and `ReputationMinted` events. Submit a contribution and your event will appear in real time.

Every score-result page on `/submit` includes 5 click-through links to Solana Explorer (submit tx, verify tx, mint tx, release tx, contribution PDA) so anyone can verify on-chain authenticity in seconds.

---

## Demo flow (end-to-end on devnet)

1. **Connect Phantom or Solflare** on Solana devnet. (Wallet error banner shows actionable hints if the connect fails.)
2. **Submit a contribution** — project ID, type, IPFS hash, description. Phantom prompts you to sign a real `submit_contribution` transaction; the contribution PDA gets created on devnet.
3. **AI scorer** at `/api/score` prompts Claude Sonnet 4.6 with the rubric + your metadata. Claude returns `{score, reasoning, approved}` as structured JSON.
4. **Oracle settles on-chain:** signs `verify_contribution(score, reasoning_hash)` writing the score to chain, then `mint_reputation` minting `score` REP tokens to your wallet, then `release_milestone` paying out SOL from the project's escrow (if one exists).
5. **Dashboard** reads your on-chain Token-2022 ATA balance + your contribution history (via `getProgramAccounts` decoded by the IDL).
6. **Pool screen** lists every active project escrow with real `total_funded` / `total_released` numbers and click-through Explorer links.

All five transactions appear on Solana Explorer with the same wallet's signature. The judge can trace every claim end-to-end.

---

## What's real vs. mocked

| Layer | State |
|---|---|
| Anchor program (deployed to devnet) | ✅ real — 7 instructions, 4 accounts, 6 events |
| `submit_contribution` from browser | ✅ real Phantom-signed tx |
| Claude scoring at `/api/score` | ✅ real Sonnet 4.6 with prompt caching |
| `verify_contribution` + `mint_reputation` settlement | ✅ real, oracle-signed in the API route |
| `create_project_escrow` + `fund_project_escrow` + `release_milestone` | ✅ real, fired automatically when a project escrow exists |
| Dashboard REP balance | ✅ real on-chain Token-2022 ATA read |
| Dashboard contribution history | ✅ real `getProgramAccounts` with memcmp filter |
| Live activity feed | ✅ real WebSocket subscription to program events |
| Project list at `/projects` | ⚠️ static demo set in `lib/indie-pool/projects.ts` (any of them can have a real escrow funded) |
| IPFS file contents | ⚠️ scorer reads description text only; the hash is a tamper-proof bookmark |

Graceful fallbacks: when env vars are missing, the dApp degrades to localStorage + deterministic-formula scoring with clear "settlement mocked" labels in the UI. Never dead-ends.

---

## Repo layout

```
proof-please/
├── app/
│   ├── page.tsx                  Landing with live activity feed
│   ├── submit/page.tsx           Contribution form + on-chain settlement UI
│   ├── dashboard/page.tsx        REP balance + history (on-chain reads)
│   ├── projects/page.tsx         Browse projects + open submit / fund modals
│   ├── pool/page.tsx             Layer 2 escrows — real aggregates from chain
│   ├── api/score/route.ts        Claude scorer + oracle settlement
│   └── providers.tsx             Wallet + connection + error-surface providers
├── components/
│   ├── live-feed.tsx             Homepage on-chain activity ticker
│   ├── fund-escrow-modal.tsx     Create + top up project escrows
│   ├── submit-slideover.tsx      Per-project submission slide-over
│   ├── wallet-error-banner.tsx   Translates wallet errors into actionable UI
│   ├── project-card.tsx          Project cards with live escrow status
│   └── ...
├── lib/
│   ├── indie-pool/
│   │   ├── client.ts             Anchor + Phantom seam; chain-first w/ localStorage fallback
│   │   ├── types.ts              UI ↔ on-chain types
│   │   └── projects.ts           Static project list for the demo
│   ├── idl/
│   │   ├── indie_pool.json       IDL committed for Vercel access (target/ is gitignored)
│   │   └── indie_pool.ts         Generated TS types
│   └── explorer.ts               URL helpers for Solana Explorer (cluster-aware)
├── programs/indie-pool/
│   └── src/lib.rs                Anchor 0.32 program (7 instructions, see below)
├── scripts/
│   └── init-oracle.ts            One-shot bootstrap: creates OracleState + REP mint
├── tests/indie-pool.ts           Mocha + chai end-to-end happy path
├── STATUS.md                     Living team snapshot (what's real vs mocked)
├── CLAUDE.md                     Architecture + decisions, read before editing
└── paper_please_004.docx         Hackathon spec (source of truth, §4 = economic model)
```

---

## Anchor program

**7 instructions**, all PDA-derived:

| Instruction | Caller | Purpose |
|---|---|---|
| `initialize_oracle(oracle_pubkey)` | Admin (one-shot) | Stores oracle pubkey; creates Token-2022 NonTransferable REP mint with PDA authority |
| `submit_contribution(...)` | Any wallet | Opens a contribution PDA in `Pending` |
| `verify_contribution(score, hash)` | **Oracle only** | Writes score; flips status to `Verified` / `Rejected` |
| `mint_reputation()` | Any wallet | Mints `score` REP into contributor's ATA (gated on `Verified && !minted`) |
| `create_project_escrow(project_id, deposit, rate)` | Any wallet | Creates a per-project SOL escrow PDA |
| `fund_project_escrow(amount)` | Any wallet | Adds SOL to an existing escrow |
| `release_milestone()` | **Oracle only** | Pays `score × rate` from escrow PDA to contributor; idempotent via `ReleaseReceipt` PDA |

**Trust model:** the entire system rides on the `has_one = oracle` check on `OracleState`. Anyone holding the oracle keypair can write scores and release SOL. The oracle keypair lives as a Vercel secret (`ORACLE_KEYPAIR_JSON`) and signs every `verify_contribution` and `release_milestone` from the `/api/score` route.

**Events emitted:** `ContributionSubmitted`, `ContributionVerified`, `ReputationMinted`, `EscrowCreated`, `EscrowFunded`, `MilestoneReleased`. The homepage `LiveFeed` component subscribes to the last two for real-time UI.

---

## Quick start

### 1. Install JS deps and run the frontend

```bash
pnpm install
pnpm dev                 # → http://localhost:3000
```

`.npmrc` pins `node-linker=hoisted` (don't switch back to pnpm's isolated layout — it breaks Turbopack on this machine).

### 2. Install the Solana toolchain

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable

# Solana CLI (Anza installer, 2.x)
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Anchor via avm (matches Anchor.toml's pinned 0.32.1)
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install 0.32.1 && avm use 0.32.1
```

### 3. Build and deploy the program

```bash
anchor build
anchor keys sync               # writes declare_id! into lib.rs + Anchor.toml
anchor build                   # rebuild with the synced ID
anchor deploy --provider.cluster devnet
```

### 4. Initialize the oracle (one-shot bootstrap)

```bash
pnpm init:oracle
```

This script:
1. Generates an oracle keypair (or reuses `./oracle-keypair.json` if present)
2. Calls `initialize_oracle` to register the oracle pubkey + create the REP mint
3. Prints the `.env.local` block to paste into Vercel

### 5. Configure environment variables

Copy `.env.example` to `.env.local` and fill:

```bash
ANTHROPIC_API_KEY=sk-ant-...                                  # server-only
ORACLE_KEYPAIR_JSON=[12,34,...]                               # server-only (from init:oracle output)
SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=...     # server-only

NEXT_PUBLIC_PROGRAM_ID=EvgHfdx5xyTNoPnaHwDtySdAtMUYGcMz9nwCiwMLi9sn
NEXT_PUBLIC_NETWORK=devnet
NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com/?api-key=...
```

**Only `NEXT_PUBLIC_*` vars reach the browser.** Server secrets stay on the server. The Helius API key in `NEXT_PUBLIC_RPC_URL` is browser-visible by design — fine for a free-tier devnet key, NEVER for paid mainnet.

### 6. Run tests

```bash
anchor test                                            # local validator
anchor test --provider.cluster devnet                  # against deployed devnet program
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, Tailwind 4 |
| Wallet | `@solana/wallet-adapter-react` (Wallet Standard auto-discovery — no explicit Phantom/Solflare registration) |
| Smart contracts | Anchor 0.32 on Solana 2.x, Token-2022 NonTransferable extension |
| AI scorer | Claude Sonnet 4.6 via `@anthropic-ai/sdk` with prompt-cached rubric, on a Vercel serverless route |
| RPC | Helius free-tier devnet (recommended) or public `api.devnet.solana.com` |
| Live feed | WebSocket subscription to program events via `program.addEventListener` |
| Storage | IPFS hash field (paste-only for MVP) |
| Deployment | Vercel (frontend + scorer) + Solana devnet (program) |

---

## Economic model

Proof, please! is built on a deliberate two-layer separation that keeps reputation **non-financial** and rewards **stablecoin-denominated**. This is informed by the failure modes of 2025's gaming-token economy — over 90% of token launches that year lost their initial value. Each design decision below dodges a specific failure mode (full rationale in `paper_please_004.docx` §4).

### Two layers

| Layer | Asset | Transferable? | Purpose |
|---|---|---|---|
| **Layer 1 — Reputation** | REP (Token-2022, `NonTransferable`) | No (soulbound) | Verifiable creative identity & merit score; cumulative across projects |
| **Layer 2 — Rewards** | SOL (in escrow PDA, milestone-gated) | Yes | Compensation for verified contributions; trustless on-chain release |
| **Phase 2 — Governance** | TBD fungible token | Yes (with vesting) | Platform staking/governance; deferred until proven escrow demand |

No native platform token launches at MVP. SOL serves as the liquid economic rail; REP serves as the non-financial signal.

### Failure modes this dodges

| Failure mode (2025) | How we avoid it |
|---|---|
| Pump-and-dump tokens | No native token at launch — SOL is the only liquid asset on the platform |
| Plutocratic governance (whale capture) | REP is non-transferable; one contributor, one voice |
| DAO overhead (slow committees) | AI scoring replaces committee voting for small teams |
| Pay-to-play access | Reputation is earned via verified work (score ≥ 60), never bought |

---

## How to verify on-chain (in 30 seconds)

For judges or anyone curious:

1. **Program is deployed:** [`EvgHfdx5xyTNoPnaHwDtySdAtMUYGcMz9nwCiwMLi9sn`](https://explorer.solana.com/address/EvgHfdx5xyTNoPnaHwDtySdAtMUYGcMz9nwCiwMLi9sn?cluster=devnet) shows recent transactions on devnet.
2. **REP mint is real Token-2022 with NonTransferable:** the mint PDA at seed `[b"rep_mint"]` shows the `NonTransferable` extension in its account data.
3. **Each submission produces 5 inspectable artifacts:** submit tx, verify tx, mint tx, release tx (if escrow exists), and the contribution PDA itself. All linked from `/submit`'s success state.
4. **Live feed proves freshness:** the homepage ticker subscribes via WebSocket — if your submission appears in the feed within 1-2s, the chain is real.

---

## Roadmap (post-hackathon)

In order of value:

1. **Project registration on-chain** — replace the static `lib/indie-pool/projects.ts` with a real `Project` account type registered by creators.
2. **Real IPFS file scoring** — fetch the file at the hash; branch by type (compile + tests for code, CLIP for images, audio analysis for music).
3. **Multi-oracle / threshold-signed scoring** — replace single oracle with M-of-N signature so no party can rubber-stamp.
4. **Mainnet deploy** — ~2.15 SOL of real SOL for program rent. Worthwhile only after Phase 1 product validation.
5. **ZK-proof scoring** — research project; let the model produce a verifiable proof of its scoring decision.

---

## Status

This is a hackathon MVP. The full architecture and locked design decisions are in [`CLAUDE.md`](./CLAUDE.md); the current snapshot of what's real vs mocked lives in [`STATUS.md`](./STATUS.md). Original spec: `paper_please_004.docx`.

---

## License

MIT.
