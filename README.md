# Proof, please!

**Decentralized contribution & reputation infrastructure for indie game ecosystems.**
Built on Solana. Powered by AI scoring. Web3-native.

> Hackathon MVP · May 2026 · by Brutales XYZ
> Codename: **Indie Pool**

Submit creative work — code, art, music, 3D, writing — get it AI-scored, and earn non-transferable on-chain reputation as Soulbound Tokens. Reputation travels with you across every Indie Pool project.

---

## Demo flow (the entire MVP)

1. Connect Phantom or Solflare on Solana **devnet**.
2. Submit a contribution: project ID, type, IPFS hash, description.
3. AI scorer (Claude Sonnet 4.6) reads the metadata and assigns a 0-100 score.
4. Score is minted as **REP** — a Token-2022 token with the `NonTransferable` extension. Lifetime balance = total reputation.
5. Dashboard shows the new score, reasoning, and contribution history.
6. Project Pool screen previews how Escrow milestone funds would unlock for verified contributors (mocked for the MVP).

---

## Repo layout

```
proof-please/
├── app/                       Next.js 16 App Router (Tailwind 4, TS, Turbopack)
│   ├── page.tsx               Landing screen with wallet connect
│   ├── providers.tsx          Solana wallet adapter providers (client component)
│   ├── globals.css            Cyberpunk palette + glitch keyframes
│   └── api/score/route.ts     AI scorer endpoint (currently stubbed)
├── programs/indie-pool/       Anchor 0.32 program (Token-2022 NonTransferable SBT)
│   └── src/lib.rs             4 instructions: initialize_oracle, submit_contribution,
│                              verify_contribution, mint_reputation
├── tests/indie-pool.ts        Mocha + chai end-to-end happy path
├── Anchor.toml                Anchor workspace config
├── Cargo.toml                 Rust workspace
├── CLAUDE.md                  Architecture + decisions, read this first
├── paper please.docx          Original hackathon spec (source of truth)
└── .env.example               Required environment variables
```

---

## Quick start

### 1. Install JS deps and run the frontend

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

### 2. Install the Solana toolchain (required for the Anchor program)

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup default stable

# Solana CLI (Solana 2.x)
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
solana config set --url https://api.devnet.solana.com
solana-keygen new --no-bip39-passphrase
solana airdrop 5

# Anchor via avm (matches the version pinned in Anchor.toml)
cargo install --git https://github.com/coral-xyz/anchor avm --force
avm install 0.32.1
avm use 0.32.1
```

### 3. Build & deploy the program to devnet

```bash
anchor build
anchor keys sync                 # writes the real program ID into Anchor.toml + lib.rs
anchor build                     # rebuild with the synced ID
anchor deploy --provider.cluster devnet
anchor test --provider.cluster devnet
```

After `anchor deploy`, copy the program ID into `.env.local`:

```
NEXT_PUBLIC_PROGRAM_ID=<the deployed program id>
```

### 4. Wire the AI scorer

Generate the oracle keypair and store it as a single-line JSON array in your env:

```bash
solana-keygen new -o oracle-keypair.json --no-bip39-passphrase
cat oracle-keypair.json | jq -c .
```

Paste that into `.env.local` as `ORACLE_KEYPAIR_JSON`. Add `ANTHROPIC_API_KEY` (Sonnet 4.6 access). Then implement `app/api/score/route.ts` per the inline TODOs.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, Tailwind 4 |
| Wallet | `@solana/wallet-adapter-react` + Phantom/Solflare adapters |
| Smart contracts | Anchor 0.32 on Solana 2.x, Token-2022 NonTransferable extension |
| AI scorer | Claude Sonnet 4.6 via `@anthropic-ai/sdk`, runs as a Vercel serverless route |
| Storage | IPFS hash field (paste-only for MVP); web3.storage planned |
| Deployment | Vercel (frontend + scorer) + Solana devnet (program) |

---

## Deployment

Frontend + scorer ship together on Vercel; the Anchor program is deployed separately to devnet.

### Vercel

1. `gh repo create brutalesxyz/indie-pool --public --source=. --push`
2. In Vercel: New Project → import the GitHub repo → framework auto-detected as Next.js.
3. Set environment variables in the Vercel dashboard (matches `.env.example`).
4. Deploy. Subsequent pushes auto-deploy.

### Solana program

```bash
anchor deploy --provider.cluster devnet
```

The program lives on devnet; the frontend reads its ID from `NEXT_PUBLIC_PROGRAM_ID`. **Do not deploy to mainnet** — this is a hackathon MVP.

---

## Status (May 10, 2026)

- ✅ Repo + scaffolding (Next + Anchor + tests)
- ✅ Anchor program drafted (4 instructions, Token-2022 NonTransferable)
- ✅ Wallet adapter wired, cyberpunk landing page live
- ⚠️ AI scorer is stubbed (returns 501); see `app/api/score/route.ts`
- ⚠️ Submit / Verify / Dashboard screens not yet built
- ⚠️ Anchor program needs Rust + Anchor CLI installed locally to build
- ⏳ Devnet deploy pending

For the full plan and decisions, read [`CLAUDE.md`](./CLAUDE.md). Original spec: `paper please.docx`.

---

## License

MIT.
