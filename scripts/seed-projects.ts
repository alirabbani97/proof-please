/**
 * One-shot script to register the demo projects on-chain.
 *
 * Run AFTER `anchor deploy` lands the program upgrade with the
 * `register_project` instruction:
 *
 *   pnpm dlx tsx scripts/seed-projects.ts
 *
 * Pays rent (~0.003 SOL per project) from the deployer wallet at
 * $ANCHOR_WALLET or ~/.config/solana/id.json. Idempotent: skips any
 * project that's already registered (PDA already exists).
 *
 * The same wallet that funded `init-oracle` should fund this — it has
 * the SOL and is the natural "platform admin" actor for seeding.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { IndiePool } from "../lib/idl/indie_pool";
import { DEMO_SEED } from "../lib/indie-pool/projects";

const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const ADMIN_KEYPAIR_PATH =
  process.env.ANCHOR_WALLET ?? path.join(os.homedir(), ".config/solana/id.json");
const IDL_PATH = path.resolve(process.cwd(), "lib/idl/indie_pool.json");

function loadKeypairFile(p: string): Keypair {
  const raw = fs.readFileSync(p, "utf8");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

async function main() {
  if (!fs.existsSync(IDL_PATH)) {
    throw new Error(
      `IDL not found at ${IDL_PATH}. Run \`anchor build\` and copy target/idl to lib/idl first.`,
    );
  }

  const connection = new Connection(RPC_URL, "confirmed");
  const adminKp = loadKeypairFile(ADMIN_KEYPAIR_PATH);
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(adminKp),
    { commitment: "confirmed" },
  );
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
  const program = new Program(idl, provider) as Program<IndiePool>;
  const programId = program.programId;

  console.log("");
  console.log("=== Indie Pool — project seed ===");
  console.log("RPC                :", RPC_URL);
  console.log("Program ID         :", programId.toBase58());
  console.log("Admin (creator)    :", adminKp.publicKey.toBase58());
  console.log("Projects to seed   :", DEMO_SEED.length);
  console.log("");

  let registered = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of DEMO_SEED) {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("project"), Buffer.from(p.slug)],
      programId,
    );

    const existing = await connection.getAccountInfo(pda, "confirmed");
    if (existing) {
      console.log(`⚠  ${p.slug.padEnd(28)} already registered — skipping`);
      skipped++;
      continue;
    }

    try {
      const sig = await program.methods
        .registerProject(p.slug, p.name, p.blurb, p.art, p.primaryType)
        .accounts({
          creator: adminKp.publicKey,
          project: pda,
          systemProgram: SystemProgram.programId,
        } as never)
        .rpc();
      console.log(`✓  ${p.slug.padEnd(28)} → ${pda.toBase58().slice(0, 8)}…  tx ${sig.slice(0, 8)}…`);
      registered++;
    } catch (err) {
      console.error(`✗  ${p.slug.padEnd(28)} failed:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log("");
  console.log(`Done: ${registered} registered, ${skipped} skipped, ${failed} failed.`);
  console.log("");
  console.log("Verify on-chain:");
  console.log(`  https://explorer.solana.com/address/${programId.toBase58()}?cluster=devnet`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
