# Proof, please!

**AI-verified, soulbound reputation infrastructure for creators on Solana.**

<<<<<<< HEAD
A contributor submits creative work — code, art, music, 3D, writing, testing. An AI agent (Claude Sonnet 4.6) scores it 0–100 against a calibrated rubric. The score mints as a non-transferable Token-2022 token to the contributor's wallet, and if the project has a funded escrow, real SOL also flows to them — all in a single oracle-signed transaction. Every project, score, token, and payout is a first-class on-chain Solana account.
=======
> Codename: **Indie Pool**
>>>>>>> 797c48a7290d55f670fa3ee81f1dd62e5438b165

> Codename: **Indie Pool**.

---

## Live on devnet

| | |
|---|---|
| Program ID | [`EvgHfdx5xyTNoPnaHwDtySdAtMUYGcMz9nwCiwMLi9sn`](https://explorer.solana.com/address/EvgHfdx5xyTNoPnaHwDtySdAtMUYGcMz9nwCiwMLi9sn?cluster=devnet) |
| Deployed dApp | see repo description |
| Network | Solana devnet |

```
 Layer 0 ─── register_project           on-chain Project PDA (creator, name, blurb, type)
 Layer 1 ─── submit → score → mint      non-transferable REP token = soulbound reputation
 Layer 2 ─── fund_escrow → release       SOL payout gated by the same AI verdict
                                         ─────────────────────────────────────
                                         one signal, two effects, all on-chain
```

---

## Who it's for

- **Indie game studios** that need contributors but can't afford full-time staff or a manual review pipeline. Fund an escrow once; the AI vets and pays out automatically.
- **Indie creators** (coders, artists, musicians, writers, testers) who work across projects and want portable proof of past work. REP follows the wallet, not the platform.
- **Project bounty programs** that want trustless milestone payouts without an admin in the loop.

The problem it solves: creative gig workers start from zero on every new project because their past work isn't verifiable on a shared substrate. LinkedIn endorsements are gameable; GitHub stars are partial; portfolio sites lie. **A reputation that can only be earned and never sold gives indie talent a credential the next project can actually trust.**

---

## A walkthrough (what a user does)

1. **A studio registers a project** — `register_project("supercool-rpg", "Supercool RPG", "Looking for procedural dungeon code", "🎨", "code")`. Anyone signs this; first caller wins the slug. A `Project` PDA is created on-chain.

2. **The studio funds the project's escrow** — `create_project_escrow("supercool-rpg", 1.0 SOL, 100_000 lamports/score)`. SOL is locked in a per-project PDA. Payout rate is set: each verified score point pays 100,000 lamports.

3. **A contributor submits work** — their wallet signs `submit_contribution("supercool-rpg", "code", ipfs_hash, "Implemented BSP procedural generator with biome-aware corridor weaving…")`. A `Contribution` PDA opens in `Pending` status.

4. **The AI scorer reads the description and replies** — Claude Sonnet 4.6 evaluates against a 5-dimension rubric (originality, completeness, project relevance, technical quality, community value) and returns `{ score: 82, reasoning: "Specific deliverable…", approved: true }`.

5. **The oracle settles, automatically** — the `/api/score` route signs three transactions back-to-back with the oracle keypair: `verify_contribution` (writes score on-chain), `mint_reputation` (mints 82 REP tokens to the contributor's ATA), `release_milestone` (transfers 82 × 100,000 = 0.0082 SOL from escrow to contributor).

6. **Everything is verifiable on Solana Explorer** — the submit page returns four tx signatures and the contribution PDA address, all click-through. The contributor's dashboard shows their REP balance read straight from the on-chain Token-2022 ATA.

The whole loop is one click for the contributor after the form submit. ~30 seconds from "Submit" to "+82 REP in wallet and +0.0082 SOL in wallet."

---

## How it works (architecture)

Three loosely-coupled pieces. The Anchor program is the only trusted component.

```
   Browser (Phantom)                          Anchor program (devnet)
   ────────────────                           ────────────────────────
        │                                              ▲
        │ submit_contribution ─────────────────────────┤
        │ (user-signed)                                │
        │                                              │ verify + mint + release
        │ POST /api/score                              │ (oracle-signed)
        ▼                                              │
   /api/score (Vercel function)                        │
   ─────────────────────────                           │
        │                                              │
        ├──▶ Claude API (rubric + metadata)            │
        │                                              │
        ├──▶ oracle keypair signs ─────────────────────┘
        │
        ▼
   ScoreResponse { score, reasoning, verifyTx, mintTx, releaseTx }
```

**Trust model in one sentence:** the program enforces that any state change to a `Contribution` or `ProjectEscrow` must be signed by the oracle pubkey stored in `OracleState` at deploy time. That oracle keypair lives as a Vercel secret. Whoever holds it *is* the oracle.

### Anchor program — 8 instructions, 5 accounts

| Instruction | Caller | Effect |
|---|---|---|
| `initialize_oracle(oracle_pubkey)` | admin (one-shot) | Stores oracle pubkey, creates the Token-2022 NonTransferable REP mint with a PDA authority |
| `register_project(slug, name, blurb, art, type)` | anyone | Opens a `Project` PDA at `[b"project", slug]` |
| `submit_contribution(...)` | any wallet | Opens a `Contribution` PDA in `Pending` |
| `verify_contribution(score, reasoning_hash)` | **oracle only** | Writes score, flips status to `Verified` / `Rejected` |
| `mint_reputation()` | anyone | Mints `score` REP tokens to the contributor's ATA (only when `Verified && !minted`) |
| `create_project_escrow(slug, deposit, rate)` | any wallet | Opens a per-project SOL escrow PDA. **Requires the Project PDA to exist** — no orphan escrows |
| `fund_project_escrow(amount)` | any wallet | Adds SOL to an existing escrow |
| `release_milestone()` | **oracle only** | Transfers `score × rate` lamports from escrow PDA to contributor. Idempotent via `ReleaseReceipt` PDA. |

Accounts: `OracleState`, `Project`, `Contribution`, `ProjectEscrow`, `ReleaseReceipt`. Events fire on every state transition (`ContributionSubmitted`, `ContributionVerified`, `ReputationMinted`, `EscrowCreated`, `EscrowFunded`, `MilestoneReleased`, `ProjectRegistered`) and the homepage subscribes via WebSocket to render a live activity feed.

---

## Verify on-chain in 30 seconds

For judges:

1. The [program](https://explorer.solana.com/address/EvgHfdx5xyTNoPnaHwDtySdAtMUYGcMz9nwCiwMLi9sn?cluster=devnet) is deployed at the address above. Click it on Explorer; you'll see recent transactions.
2. Every successful submission on `/submit` returns 4 click-through Solana Explorer links (submit · verify · mint · release) plus the contribution PDA. Click any → real devnet tx with the oracle's signature.
3. `/projects` lists real `Project` accounts. `/pool` lists real `ProjectEscrow` accounts with their live balances. `/dashboard` reads the contributor's Token-2022 ATA balance directly from chain.
4. Scroll the homepage — the live feed updates in real time as anyone on the app submits a contribution. WebSocket subscription, not polling.

---

## Run it yourself

```bash
pnpm install
pnpm dev                          # http://localhost:3000

# Smart contract — only needed if you want to redeploy:
anchor build
anchor keys sync                  # writes the program ID into declare_id! + Anchor.toml
anchor build
anchor deploy --provider.cluster devnet

# One-shot bootstrap (creates OracleState + REP mint + seeds 9 demo projects):
pnpm init:oracle
pnpm seed:projects

# Tests against the deployed program:
anchor test --provider.cluster devnet
```

### Environment variables

Copy `.env.example` → `.env.local`. The split:

```bash
# Server-only secrets (do NOT prefix with NEXT_PUBLIC_)
ANTHROPIC_API_KEY=sk-ant-...
ORACLE_KEYPAIR_JSON=[12,34,...]                           # from pnpm init:oracle output
SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=...

# Public (inlined into the client bundle at build time)
NEXT_PUBLIC_PROGRAM_ID=EvgHfdx5xyTNoPnaHwDtySdAtMUYGcMz9nwCiwMLi9sn
NEXT_PUBLIC_NETWORK=devnet
NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com/?api-key=...
```

The Helius API key in `NEXT_PUBLIC_RPC_URL` is browser-visible by design — acceptable for a free-tier devnet key, never for paid mainnet.

---

## Tech stack

| Layer | Choice |
|---|---|
| Smart contract | Anchor 0.32, Token-2022 NonTransferable extension, Solana devnet |
| AI scorer | Claude Sonnet 4.6 via `@anthropic-ai/sdk`, prompt-cached rubric, on a Vercel serverless route |
| RPC | Helius free-tier devnet (recommended) |
| Frontend | Next.js 16 App Router, React 19, Tailwind 4, Turbopack |
| Wallet | `@solana/wallet-adapter-react` with Wallet Standard auto-discovery (no explicit Phantom/Solflare registration) |
| Live feed | Browser WebSocket subscription via `program.addEventListener` |

---

## Design decisions worth knowing

- **Soulbound (non-transferable) reputation by construction.** Token-2022 `NonTransferable` mint extension means the chain itself rejects transfers. Reputation can't be bought, sold, or whale-captured.
- **AI scoring instead of committee voting.** Eliminates governance bottlenecks. The rubric is prompt-cached for consistency across submissions; the reasoning is sha256-hashed and stored on-chain so the AI's verdict is permanent.
- **One AI verdict drives both layers.** The same `verify_contribution` call that mints REP also gates the escrow payout. No separate review for "did you earn money" vs "did you earn reputation."
- **No native platform token.** SOL is the only liquid asset; REP is the only signal. Sidesteps the 2025 gaming-token failure mode (90% of launches lost initial value to dump pressure).
- **Strict Project → Escrow coupling.** You can't fund an escrow for a project that hasn't been registered on-chain. Every fundable slug corresponds to a verifiable on-chain entity.

For the full architecture rationale, see [`CLAUDE.md`](./CLAUDE.md). For a current snapshot of what's real vs mocked, see [`STATUS.md`](./STATUS.md).

---

## Roadmap (post-hackathon)

1. **Real IPFS file scoring** — fetch the file at the hash; branch by type (compile + tests for code, CLIP for images, audio analysis for music).
2. **Multi-oracle / threshold-signed scoring** — replace single oracle keypair with M-of-N so no party can rubber-stamp.
3. **Mainnet deploy** — ~2.15 SOL real for program rent; only after Phase 1 product validation.
4. **ZK-proof scoring** — research project: let the model produce a verifiable proof of its scoring decision.

---

## License

MIT.
