# Proof, please! — project status

A snapshot for the team and anyone you share the repo with. Last updated **May 12, 2026** — Layer 2 escrow is now live on devnet. If this disagrees with `CLAUDE.md`, `CLAUDE.md` wins (it's the live source of truth); if both disagree with the actual code, the code wins.

---

## 1. The elevator pitch

**Public name:** *Proof, please!* — the user-facing brand on the dApp and in pitch material.
**Codename:** *Indie Pool* — used everywhere a developer sees text (program name, repo paths, GitHub `brutalesxyz/indie-pool`).

A Solana dApp that turns creative contributions (code, art, music, 3D, writing, testing) into **portable on-chain reputation**. A contributor submits a description + IPFS hash, an AI agent scores it 0–100, the score becomes a **Soulbound Token** (Token-2022 with the NonTransferable mint extension) that follows them across projects and **cannot be sold**. A second layer — escrow — pays real SOL on top of that reputation signal once milestones are AI-verified.

> **Two layers, one signal.** Reputation (Layer 1) is non-transferable proof of work. SOL payouts (Layer 2) flow on top, gated by the same AI verdict.

---

## 2. Where the project stands today

| Piece | State | Notes |
|---|---|---|
| Anchor program on Solana devnet | ✅ **deployed** (7 instructions, 4 accounts) | Program ID `EvgHfdx5xyTNoPnaHwDtySdAtMUYGcMz9nwCiwMLi9sn` |
| Frontend on Vercel | ✅ **deployed** | `/`, `/submit`, `/dashboard`, `/pool`, `/projects` — push to redeploy after this batch |
| `/api/score` route | ✅ **wired end-to-end** | Real Sonnet 4.6 + auto-settles verify_contribution + mint_reputation + release_milestone in one oracle-signed flow |
| `OracleState` PDA + REP mint | ✅ **initialized** | `pnpm init:oracle` ran; oracle keypair in Vercel as `ORACLE_KEYPAIR_JSON` |
| Real Claude scoring | ✅ **live** | Sonnet 4.6 with prompt-cached rubric. Mock fallback only if `ANTHROPIC_API_KEY` missing |
| On-chain `verify_contribution` | ✅ **live** | Oracle-signed from `/api/score`; tx sig surfaced in result panel |
| On-chain `mint_reputation` | ✅ **live** | Token-2022 NonTransferable REP minted to contributor's ATA |
| Browser-side `submit_contribution` | ✅ **live** | Real Phantom-signed tx; ~0.003 SOL rent for contribution PDA |
| Dashboard REP balance | ✅ **on-chain** | Reads Token-2022 ATA; localStorage is just offline fallback |
| Dashboard contribution history | ✅ **on-chain** | `getProgramAccounts` with memcmp filter at offset 8 |
| Phantom + Solflare wallet connect | ✅ **works** | Wallet Standard auto-discovery. Errors surface in a top banner with actionable hints. |
| **Layer 2: `create_project_escrow`** | ✅ **live** | New instruction. PDA at `[b"escrow", project_id]` holds SOL |
| **Layer 2: `fund_project_escrow`** | ✅ **live** | Anyone can top up any escrow |
| **Layer 2: `release_milestone`** | ✅ **live** | Oracle-signed; pays `score × lamports_per_score` to contributor. Idempotent via `ReleaseReceipt` PDA |
| `/pool` page real data | ✅ **on-chain** | Aggregate stats + per-escrow grid via `program.account.projectEscrow.all()` |
| Fund-escrow UI from `/projects` | ✅ **live** | Modal opens from each card; supports both create and top-up |
| Homepage live activity feed | ✅ **live** | WebSocket subscription to `ContributionVerified` + `ReputationMinted` |
| **Layer 0: `register_project`** | ✅ **live** | Project PDA at `[b"project", project_id]`; 9 demo projects seeded on devnet via `pnpm seed:projects` |
| `/projects` page | ✅ **on-chain** | Reads `program.account.project.all()`. "Register project" button opens a real on-chain register flow. |
| Project registry coupling | ✅ **strict** | `create_project_escrow` requires the Project PDA to exist — no orphan escrows |
| IPFS file contents | ⚠️ description-only scoring | Spec design; future work fetches the file for content-specific evaluators |

**Bottom line: every layer of the product is real on-chain.** Layer 0 (project registry), Layer 1 (REP soulbound tokens), and Layer 2 (escrow SOL payouts) are all on-chain accounts you can verify on Solana Explorer. Project → Escrow coupling is strict — you can't fund an escrow for a slug that hasn't been registered.

---

## 3. Architecture in one diagram

```
              ┌─────────────────────┐                   ┌──────────────────────┐
              │  Anchor program     │                   │  Frontend            │
              │  on Solana devnet   │ ◀── browser tx ── │  (Next.js + React)   │
              │  (TRUSTED)          │                   │  on Vercel           │
              │                     │                   │  (UNTRUSTED)         │
              │  Instructions:      │                   └──────────────────────┘
              │  - initialize_oracle│                              ▲
              │  - submit_contrib   │                              │ POST /api/score
              │  - verify_contrib   │ ◀── oracle-signed ────┐      │
              │  - mint_reputation  │                       │      ▼
              └─────────────────────┘                       │  ┌──────────────────────┐
                       ▲                                    │  │  Vercel serverless   │
                       │                                    └──│  /api/score route    │
                       │ stored in OracleState PDA             │  (UNTRUSTED, except  │
                       │ at deploy time                        │   for oracle keypair)│
                       │                                       │                      │
                       │           ORACLE_KEYPAIR_JSON ────────│  ▶ Claude API        │
                       └───────────────────────────────────────┘                      │
                                                               └──────────────────────┘
```

**The trust model in one sentence:** the only on-chain check that gates a score from being written is *"is the signer of `verify_contribution` the same pubkey we wrote into `OracleState` at deploy time?"* Every other piece — the Vercel route, the frontend, the RPC nodes, even Claude itself — is untrusted. Whoever holds the oracle keypair *is* the oracle.

---

## 4. Architectural decisions vs. the original spec

The spec was scoped down by mentor Adrija on May 9, 2026 from a full DAO + multi-role + milestones platform to a single demo flow. We made further scope-cuts during build to keep the demo robust under hackathon time pressure. Each row below documents the deviation and why.

| Spec said | We shipped | Why |
|---|---|---|
| Decentralized AI scorer | **Single off-chain Node service** with one oracle keypair | True decentralized scoring needs ZK proofs or threshold signatures — months of work. Spec aspires to this; we ship the centralized version honestly and label it as such. |
| SBT via Metaplex UMI with `is_mutable=false`, `freeze_authority=None` | **Token-2022 with the `NonTransferable` mint extension** | Metaplex UMI's tooling churns hard; declarative `extensions::non_transferable` doesn't actually parse in anchor-spl 0.32 (verified in source — codegen has it, parser doesn't). Token-2022 NonTransferable gives the same soulbound semantics with no Metaplex dependency. |
| `claude-sonnet-4-20250514` | **`claude-sonnet-4-6`** (latest as of May 2026) | Spec model is from May 2025 and is stale. Sonnet 4.6 is faster, cheaper, and better at the rubric. |
| Anchor 0.29 + Rust 1.75 | **Anchor 0.32.1 + Rust ≥1.79** | Newer toolchain has fewer foot-guns and better Token-2022 wrappers. The CLAUDE.md `Pinned versions` table calls out the upgrade. |
| Five instructions including `create_project_escrow` and `release_milestone` | **Four instructions: `initialize_oracle`, `submit_contribution`, `verify_contribution`, `mint_reputation`** | Spec §3.2 explicitly greenlights mocking the escrow UI. We did. |
| Browser-side IPFS upload via web3.storage | **Paste-an-IPFS-hash field** | Browser-side IPFS = auth + chunking + CORS. The score is computed on metadata + description, so file content isn't actually needed for the MVP. |
| DIDs (Decentralized Identifiers) | **Wallet pubkey only** | Wallet pubkey is already a decentralized identifier. DIDs are a layer the demo doesn't consume. |
| Standalone `/ai-scorer` Node service | **`/api/score` Vercel route inside the Next.js app** | One deploy target, one set of env vars, one URL. Oracle keypair stays as a Vercel secret, never touches the browser. |
| Noah AI to generate the Anchor program | **Hand-written, with Claude assist** | Unproven dependency on a hackathon clock. Writing Anchor by hand is known-time; debugging Noah-AI bugs is unbounded. |

The repo's `CLAUDE.md` "Locked implementation decisions" section is the operational version of this table.

---

## 5. The AI + Anchor flow, step by step

### What happens when a contributor clicks "Submit"

```
┌─────────────────┐   1. submit_contribution(...)        ┌──────────────────────┐
│ Browser         │ ─────────────────────────────────▶   │  Anchor program      │
│ + Phantom       │   contribution PDA → Pending         │  on devnet           │
└─────────────────┘                                       └──────────────────────┘
        │
        │ 2. POST /api/score with the same metadata
        ▼
┌─────────────────────────────────┐
│ Vercel /api/score               │
│   ├─ system: RUBRIC (cached)    │  3. Claude returns
│   ├─ user: contribution data    │     {score, reasoning, approved}
│   ▼                             │
│   Claude Sonnet 4.6  ◀──────────│
│   ├─ JSON-schema response       │
│   ▼                             │
│  oracleKeypair.sign(...)        │  4. Submit verify_contribution
│   ▼                             │     to Anchor program (ORACLE-SIGNED)
└─────┬───────────────────────────┘
      │
      ▼
┌──────────────────────┐
│ Anchor program       │
│  - has_one check ✓   │  5. Status flips: Pending → Verified (or Rejected if <60)
│  - score written     │
│  - emit event        │
└──────────────────────┘
      │
      │ 6. (if approved) mint_reputation
      ▼
┌──────────────────────┐
│ Anchor program       │
│  - PDA mint authority signs
│  - mints `score` REP tokens to contributor's ATA
│  - Token-2022 NonTransferable: tokens cannot be transferred
│  - sets contribution.minted = true
└──────────────────────┘
      │
      ▼
┌──────────────────────┐
│ Browser: dashboard   │
│  refreshes          │
│  REP balance updates │
└──────────────────────┘
```

### What the AI is actually evaluating (be honest about this)

Claude reads **the description + type + project name + IPFS hash *as text*** — not the file at the IPFS hash. The IPFS hash is a tamper-proof bookmark; anyone can later inspect the file at that hash and see whether the contributor was telling the truth. During scoring, only the form text is evaluated.

So when a contributor writes *"Implemented procedural dungeon generator with 12 biome variants"*, Claude is judging:

- Is this specific or vague?
- Does it sound technically plausible?
- Is it project-relevant?
- Is it the kind of thing a real game-dev contribution looks like?

Not: *did the code actually compile and produce 12 biomes*. That's future work — fetch the file, run a content-specific model (compile + tests for code, CLIP/aesthetic models for art, audio analysis for music), score the artifact itself.

What protects against vague garbage scoring high:
1. The rubric (5 dimensions × 0–20 each) tells Claude to penalize handwave language and reward specificity. The rubric includes worked examples for calibration.
2. The reasoning is hashed (SHA-256) and stored on-chain as `reasoning_hash`. Even though the file isn't audited, the AI's reasoning is permanent and inspectable.
3. The output is constrained by JSON schema; the model can't return free-form prose.

### What the Anchor program enforces

Five instructions plus four account contexts. Every state transition is gated by an explicit check:

| Instruction | Who can call | What it does | Trust check |
|---|---|---|---|
| `initialize_oracle(oracle_pubkey)` | Anyone (one-shot — PDA seed `[b"oracle"]`, second call fails) | Stores oracle pubkey, creates Token-2022 NonTransferable REP mint (manually, via 3 CPIs in instruction body) | None — first caller wins, but they can't change it later without a fresh deploy |
| `submit_contribution(...)` | Anyone | Writes a contribution PDA in `Pending` status | Field length validation only |
| `verify_contribution(score, reasoning_hash)` | **Oracle only** | Writes the score; flips status to `Verified` or `Rejected` | `has_one = oracle` constraint on `OracleState` |
| `mint_reputation` | Anyone (typically the contributor or oracle service) | Mints `score` REP tokens to the contributor's ATA | Requires `contribution.status == Verified` AND `!contribution.minted` |

The whole trust model rides on the `has_one = oracle` check on `verify_contribution`. If that constraint is wrong or missing, the entire reputation premise collapses — anyone could write any score.

---

## 6. What's working today vs. what's mocked

### Real, on-chain, devnet-callable

- The program (`EvgHfdx5...i9sn`) is deployed and accepts transactions.
- `submit_contribution` works from the browser via Phantom.
- The REP mint is a real Token-2022 mint with NonTransferable extension (after `pnpm init:oracle` lands).
- The oracle-signer check is real.
- Wallet connect works via Phantom + Solflare (auto-discovered via Wallet Standard).

### Mocked client-side, falls back gracefully

The function in `lib/indie-pool/client.ts:69` (`scoreContribution`) tries `/api/score` first, and if that fails (network error OR non-200 response), it silently falls back to a deterministic local formula:

```
score = clamp(0, 100,
  min(35, floor(description.length / 12))   // length contribution
  + typeWeight                              // 22-30 by type
  + (ipfsHash.length > 30 ? 10 : 0)         // IPFS hash bonus
  + (projectId.length > 4 ? 8 : 0)          // project name bonus
)
```

The reasoning is one of three canned templates with the type interpolated. The 1.8-second delay simulates "scorer thinking."

**This is intentional** — it lets the demo run offline / without API keys. But it can fool you into thinking Claude is wired when it isn't. The way to tell from the outside: **real Claude reasoning is varied and specific; mock reasoning is one of three exact strings.** Look at the reasoning text.

### Things that are NOT on-chain yet, even with a real Claude key

The `/api/score` route's on-chain settlement is a **TODO block** at `app/api/score/route.ts:405-453`. The Anchor calls (`verify_contribution` + `mint_reputation`) are documented inline but commented out. The route currently logs the intent to Vercel logs and returns the score without sending any transaction.

Result: even with a real Anthropic key, **no `verify_contribution` tx, no SBT mint** happens automatically. The score appears in the UI, but nothing changes on-chain.

To flip this on:
1. Copy `target/idl/indie_pool.json` to a non-gitignored location (e.g., `lib/idl/indie_pool.json`) at build time. Add a `prebuild` npm script: `"prebuild": "anchor build && cp target/idl/indie_pool.json lib/idl/"`.
2. Uncomment the block at `app/api/score/route.ts:405-453`. Adjust the import to use the new IDL location.
3. Make sure Vercel has `ORACLE_KEYPAIR_JSON`, `NEXT_PUBLIC_PROGRAM_ID`, and `SOLANA_RPC_URL` set. Redeploy.

After that, every successful score will produce two real transactions on devnet, and the contributor's REP balance reflects on-chain truth.

### Dashboard REP balance

Currently reads from `localStorage`. To make real:
1. Once mint_reputation runs on-chain for a wallet, derive the contributor's Token-2022 ATA: `getAssociatedTokenAddressSync(repMintPda, contributor, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)`.
2. Read the balance via `getAccount(connection, ata, "confirmed", TOKEN_2022_PROGRAM_ID)`.
3. Replace `getRepBalance` in `lib/indie-pool/client.ts` with that read. Keep the localStorage read as a fallback for offline demo.

---

## 7. Things flagged that bear watching

These are gotchas we hit during build that will recur if you forget them.

### Toolchain

- **Anchor 0.32.1 + Rust ≥1.79.** Mismatched toolchain is the #1 hackathon build failure on Solana.
- **`anchor build` warnings** about `unexpected cfg condition value: anchor-debug / custom-heap / custom-panic` are spurious noise from anchor-syn vs. recent cargo's strict cfg checking. Ignore — they appear in every Anchor 0.32 + rustc-1.79+ project.
- **`anchor-spl 0.32`'s declarative `extensions::non_transferable` doesn't parse.** Verified in source (`anchor-syn-0.32.1/src/parser/accounts/constraints.rs`). The codegen has the case but the parser never produces it. We work around with manual CPIs. This is documented inline at `programs/indie-pool/src/lib.rs:13-20`.
- **`anchor keys sync`** must run after the first `anchor build` to write the real program ID into `declare_id!()` and `Anchor.toml`.

### pnpm / Next.js

- **Don't remove `.npmrc`.** It pins `node-linker=hoisted` and `public-hoist-pattern[]=*`. The default isolated layout breaks Turbopack on this machine and breaks Solana wallet-adapter peer resolution. If you ever see *"We couldn't find the Next.js package (next/package.json)"*, run `rm -rf node_modules pnpm-lock.yaml && pnpm install`.
- **Don't import wallet adapters from `@solana/wallet-adapter-wallets`.** Pulls in 30+ broken adapters. Always import from the direct package (e.g., `@solana/wallet-adapter-phantom`).
- **Phantom and Solflare are now Wallet-Standard wallets.** Don't register them via `new PhantomWalletAdapter()` — that creates a duplicate entry and breaks `connect()` with `WalletConnectionError: Unexpected error`. Pass `wallets={[]}` to `WalletProvider`.

### Vercel

- **Only `NEXT_PUBLIC_*` vars are sent to the browser.** Server-only secrets (`ANTHROPIC_API_KEY`, `ORACLE_KEYPAIR_JSON`, `SOLANA_RPC_URL`) stay on the server.
- **`NEXT_PUBLIC_*` is build-time inlined.** Change one → must redeploy. Server-side vars are runtime.
- **`target/` is gitignored everywhere.** Anything that imports from `target/types/` or `target/idl/` won't have it on Vercel. The IDL must be copied to a non-gitignored path before any Vercel-bound code can import it. (`scripts/` is excluded from Next's typecheck for this reason.)

### Wallets

There are **two wallets** in this project. Don't mix them up:

| Wallet | Pubkey | Where the keypair lives | Used for |
|---|---|---|---|
| **CLI / deployer / admin** | `G5SvT6c8…WsZ9` | `~/.config/solana/id.json` | `anchor deploy`, `pnpm init:oracle`, server-side admin |
| **Browser (Phantom)** | yours | Phantom extension | Signing user-side txs in the dApp; what judges connect with |
| **Oracle** | (generated by `init:oracle`) | `oracle-keypair.json` (gitignored) → `ORACLE_KEYPAIR_JSON` env var on Vercel | Signing `verify_contribution` from the `/api/score` route |

The Phantom wallet you create as a user is **not** the same address as the CLI wallet. Airdrop SOL to each separately.

### Phantom setup gotcha

If you install Phantom but never create or import a wallet inside the extension, `WalletConnectionError: Unexpected error` is what you'll see — there's no key for the dApp to receive. **Open Phantom → Create new wallet → set password → switch to Devnet (Settings → Developer Settings → Testnet Mode → ON).**

### RPC reliability for demo day

The public devnet RPC (`api.devnet.solana.com`) throttles when multiple users hit it concurrently. For demo day, get a Helius free-tier devnet RPC (5-min signup at helius.dev) and set:

```
NEXT_PUBLIC_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
```

The key in `NEXT_PUBLIC_*` is browser-visible — fine for a free-tier hackathon key, not for production.

---

## 8. Costs (real cash)

| Item | Cost | Notes |
|---|---|---|
| Solana devnet | $0 | Airdrops are free (rate-limited; web faucet workaround) |
| Anthropic API | ~$1–3 for the entire hackathon | Sonnet 4.6 with prompt-cached rubric. Expect ~$0.003 per scoring call. |
| Vercel | $0 | Hobby tier, unlimited deploys, 100 GB bandwidth |
| `web3.storage` IPFS | $0 | 5 GB free tier; not consumed in MVP |
| GitHub | $0 | Public repo |
| Domain (optional) | $0 or ~$12 | `*.vercel.app` is fine |
| **Total realistic** | **~$2–5** | Round to $10 of Anthropic credits, $0 everything else |

Mainnet program rent is ~2.15 SOL ≈ $300–500 of *real* SOL. Stay on devnet for the hackathon.

---

## 9. Locked implementation decisions

(Mirrors `CLAUDE.md` § "Locked implementation decisions". These intentionally override the spec.)

- **SBT mechanism:** Token-2022 with `NonTransferable`. No Metaplex.
- **Anchor instructions shipped:** `initialize_oracle`, `submit_contribution`, `verify_contribution`, `mint_reputation`. **No** `create_project_escrow`, **no** `release_milestone` — `/pool` is a UI mock.
- **AI scorer location:** Vercel `/api/score` route. **Not** a standalone `/ai-scorer` Node service.
- **Scorer model:** `claude-sonnet-4-6` with prompt caching.
- **File handling:** Paste IPFS hash. No browser-side upload.
- **Oracle:** Single keypair. Pubkey written to program state via `initialize_oracle` once at deploy.
- **Identity:** Wallet pubkey only. No DIDs.
- **Repo layout:** Single Next.js app at root + `programs/indie-pool/`. No separate `app/` directory.

---

## 10. Demo-day checklist

In order. Each box should be green by the time judges show up.

- [ ] `anchor build` is clean. (13 spurious cfg warnings are noise; ignore.)
- [ ] Program deployed to devnet. Verify: `solana program show EvgHfdx5xyTNoPnaHwDtySdAtMUYGcMz9nwCiwMLi9sn --url devnet` returns metadata.
- [ ] `pnpm init:oracle` ran successfully. `OracleState` PDA exists on-chain. `oracle-keypair.json` saved locally.
- [ ] `ORACLE_KEYPAIR_JSON` set on Vercel (paste the array from the script's output).
- [ ] `ANTHROPIC_API_KEY` set on Vercel — **a real one, not a placeholder**.
- [ ] `NEXT_PUBLIC_PROGRAM_ID=EvgHfdx5xyTNoPnaHwDtySdAtMUYGcMz9nwCiwMLi9sn` set on Vercel.
- [ ] `NEXT_PUBLIC_RPC_URL` set to a Helius devnet URL (better demo reliability).
- [ ] Latest commit deployed to Vercel (`pnpm build` is green locally; `git push` ran).
- [ ] Test the flow on a fresh Phantom wallet (incognito): connect → submit → see real Claude reasoning → see SBT minted on Solana Explorer → dashboard reflects new REP balance.
- [ ] Backup demo video recorded (Loom or OBS), in case live demo dies.
- [ ] README has the deployed Vercel URL, the program ID, and a link to the demo video.

---

## 11. Path from MVP to production

What it would take to make every line real, in order of effort:

1. **Real Claude scoring** — set `ANTHROPIC_API_KEY` on Vercel. Done. *(Effort: 2 minutes)*
2. **Real on-chain settlement from `/api/score`** — uncomment the TODO block at `app/api/score/route.ts:405-453`, copy IDL to `lib/idl/`, redeploy. *(Effort: 30 minutes)*
3. **Dashboard reads on-chain REP balance** — swap `getRepBalance` to query the Token-2022 ATA. *(Effort: 30 minutes)*
4. **Real escrow program** — implement `create_project_escrow` and `release_milestone` in the Anchor program; wire the `/pool` page to real data. *(Effort: 1–2 days)*
5. **Real file-content scoring** — fetch the IPFS file in the scorer, branch by `contribution_type`, run a content-specific model (compile + tests for code, CLIP for images, audio analysis for music). *(Effort: 1–2 weeks)*
6. **Multi-oracle / threshold-signed scoring** — replace single oracle keypair with a multi-sig or threshold-signature scheme so no single party can rubber-stamp. *(Effort: 1–2 months)*
7. **ZK-proof-backed scoring** — let the model produce a verifiable proof of its scoring; on-chain accepts only verified proofs. *(Effort: 6+ months — this is genuinely a research project.)*

The hackathon target is items 1–3 plus a polished UI. Items 4+ are post-hackathon roadmap.

---

## 12. The honesty layer

Things to surface explicitly when pitching, so the parts that *are* real get full credit:

- ✅ The Anchor program is real, deployed, and any judge can poke it via Solana Explorer.
- ✅ The Token-2022 NonTransferable REP mint is a real on-chain artifact.
- ✅ The wallet flow is real Phantom + Solflare integration.
- ✅ The AI scoring rubric, prompt cache, and JSON-schema response constraints are production-quality.
- ⚠️ The single-oracle setup is a centralized scorer. We label it as such; it's not "decentralized AI" yet.
- ⚠️ The escrow / Layer 2 page is a UI mock. We label it on the page; the math is hardcoded.
- ⚠️ The MVP scorer evaluates the description, not the file content. The IPFS hash is a tamper-proof anchor for *future* content audit.

These caveats are exactly the kind of thing that earns trust from technical judges. Don't hide them; surface them.

---

*Last updated: May 10, 2026. Living doc — update as flows flip from mocked to real.*
