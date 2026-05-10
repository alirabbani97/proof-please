/**
 * Smoke test for the indie-pool Anchor program.
 *
 * Runs against a local validator (`anchor test`) or devnet
 * (`anchor test --provider.cluster devnet`). Exercises the full happy path:
 *
 *   initialize_oracle → submit_contribution → verify_contribution → mint_reputation
 *
 * Before running:
 *   1. anchor build           (generates IDL + program keypair)
 *   2. anchor keys sync       (writes program ID into Anchor.toml + lib.rs)
 *   3. anchor build           (rebuild with the synced ID baked in)
 *   4. anchor test
 */
import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";

import type { IndiePool } from "../target/types/indie_pool";

describe("indie-pool", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.IndiePool as Program<IndiePool>;
  const programId = program.programId;

  // Persistent test actors.
  const admin = (provider.wallet as anchor.Wallet).payer;
  const oracleKp = Keypair.generate();
  const contributor = Keypair.generate();

  // PDAs
  const [oracleStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("oracle")],
    programId,
  );
  const [repMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("rep_mint")],
    programId,
  );
  const [mintAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint_authority")],
    programId,
  );

  before(async () => {
    // Top up the contributor and oracle so they can pay rent / fees.
    for (const target of [contributor.publicKey, oracleKp.publicKey]) {
      const sig = await provider.connection.requestAirdrop(target, 2 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig, "confirmed");
    }
  });

  it("initializes the oracle and creates the REP mint", async () => {
    await program.methods
      .initializeOracle(oracleKp.publicKey)
      .accounts({
        admin: admin.publicKey,
        oracleState: oracleStatePda,
        repMint: repMintPda,
        mintAuthority: mintAuthorityPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    const state = await program.account.oracleState.fetch(oracleStatePda);
    expect(state.admin.toBase58()).to.eq(admin.publicKey.toBase58());
    expect(state.oracle.toBase58()).to.eq(oracleKp.publicKey.toBase58());
    expect(state.repMint.toBase58()).to.eq(repMintPda.toBase58());
    expect(state.totalContributions.toNumber()).to.eq(0);
  });

  let contributionPda: PublicKey;
  const nonce = new BN(Date.now());

  it("contributor submits a contribution in Pending status", async () => {
    [contributionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("contribution"),
        contributor.publicKey.toBuffer(),
        nonce.toArrayLike(Buffer, "le", 8),
      ],
      programId,
    );

    await program.methods
      .submitContribution(
        nonce,
        "supercool-rpg",
        "code",
        "bafybeigdyrztest12345testhash",
        "Implemented procedural dungeon generator with 12 biome variants",
      )
      .accounts({
        contributor: contributor.publicKey,
        oracleState: oracleStatePda,
        contribution: contributionPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([contributor])
      .rpc();

    const c = await program.account.contribution.fetch(contributionPda);
    expect(c.contributor.toBase58()).to.eq(contributor.publicKey.toBase58());
    expect(c.score).to.eq(0);
    expect(JSON.stringify(c.status)).to.contain("pending");
  });

  it("oracle verifies the contribution with a passing score", async () => {
    const reasoningHash = new Uint8Array(32).fill(7);

    await program.methods
      .verifyContribution(82, Array.from(reasoningHash))
      .accounts({
        oracleSigner: oracleKp.publicKey,
        oracleState: oracleStatePda,
        oracle: oracleKp.publicKey,
        contribution: contributionPda,
      } as any)
      .signers([oracleKp])
      .rpc();

    const c = await program.account.contribution.fetch(contributionPda);
    expect(c.score).to.eq(82);
    expect(JSON.stringify(c.status)).to.contain("verified");
  });

  it("rejects a non-oracle signer attempting to verify", async () => {
    // Submit a second contribution to verify against.
    const nonce2 = new BN(Date.now() + 1);
    const [contributionPda2] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("contribution"),
        contributor.publicKey.toBuffer(),
        nonce2.toArrayLike(Buffer, "le", 8),
      ],
      programId,
    );

    await program.methods
      .submitContribution(nonce2, "supercool-rpg", "art", "bafybeitest2", "Cover art")
      .accounts({
        contributor: contributor.publicKey,
        oracleState: oracleStatePda,
        contribution: contributionPda2,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([contributor])
      .rpc();

    const impostor = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(impostor.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig, "confirmed");

    let threw = false;
    try {
      await program.methods
        .verifyContribution(99, Array.from(new Uint8Array(32)))
        .accounts({
          oracleSigner: impostor.publicKey,
          oracleState: oracleStatePda,
          oracle: impostor.publicKey,
          contribution: contributionPda2,
        } as any)
        .signers([impostor])
        .rpc();
    } catch (err) {
      threw = true;
      expect(String(err)).to.match(/UnauthorizedOracle|has_one|ConstraintHasOne/i);
    }
    expect(threw, "non-oracle signer must not pass verify_contribution").to.eq(true);
  });

  it("mints REP tokens equal to the score after verification", async () => {
    const ata = getAssociatedTokenAddressSync(
      repMintPda,
      contributor.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    await program.methods
      .mintReputation()
      .accounts({
        payer: admin.publicKey,
        oracleState: oracleStatePda,
        contribution: contributionPda,
        contributor: contributor.publicKey,
        repMint: repMintPda,
        mintAuthority: mintAuthorityPda,
        contributorTokenAccount: ata,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    const acct = await getAccount(
      provider.connection,
      ata,
      "confirmed",
      TOKEN_2022_PROGRAM_ID,
    );
    expect(Number(acct.amount)).to.eq(82);
  });
});
