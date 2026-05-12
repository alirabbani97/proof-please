//! Indie Pool — on-chain contribution + reputation program.
//!
//! See ../../../CLAUDE.md and ../../../paper please.docx for the full spec.
//!
//! Trust model: a single off-chain oracle keypair signs `verify_contribution`.
//! The oracle pubkey lives in `OracleState` and is checked via Anchor's
//! `has_one = oracle` constraint. Every other instruction is callable by
//! anyone who pays rent.
//!
//! Reputation token: a Token-2022 mint with the NonTransferable extension.
//! Mint authority is a program-derived PDA (`[b"mint_authority"]`), so only
//! this program can issue REP. The mint is created during `initialize_oracle`
//! via raw CPIs in the instruction body. anchor-spl 0.32 has NonTransferable
//! support in codegen but its parser does NOT accept
//! `extensions::non_transferable` (verified in
//! `anchor-syn-0.32.1/src/parser/accounts/constraints.rs`), so we
//! (1) `system_program::create_account` with extension-aware size,
//! (2) `non_transferable_mint_initialize`, then
//! (3) `initialize_mint2`. Order matters — extensions must be initialized
//! before the base mint.
//!
//! After your first `anchor build`, run `anchor keys sync` — that rewrites
//! `declare_id!` below AND the placeholders in Anchor.toml with the real
//! program pubkey.

use anchor_lang::prelude::*;
use anchor_lang::system_program::{create_account, transfer, CreateAccount, Transfer};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_2022::{initialize_mint2, spl_token_2022, InitializeMint2, Token2022},
    token_interface::{
        mint_to, non_transferable_mint_initialize, Mint, MintTo,
        NonTransferableMintInitialize, TokenAccount,
    },
};

declare_id!("EvgHfdx5xyTNoPnaHwDtySdAtMUYGcMz9nwCiwMLi9sn");

// --- Sizing constants. Loosen carefully; bigger accounts = more rent. ---
pub const MAX_PROJECT_ID: usize = 64;
pub const MAX_TYPE: usize = 32;
pub const MAX_IPFS_HASH: usize = 128;
pub const MAX_DESCRIPTION: usize = 512;
pub const MAX_PROJECT_NAME: usize = 64;
pub const MAX_PROJECT_BLURB: usize = 256;
pub const MAX_PROJECT_ART: usize = 64;
pub const APPROVAL_THRESHOLD: u8 = 60;
/// Sanity cap on escrow payout rate (0.1 SOL per score point). Prevents a
/// fat-finger like "fund 1 SOL escrow with 10 SOL/point rate" from instantly
/// draining on a single high-score submission.
pub const MAX_LAMPORTS_PER_SCORE: u64 = 100_000_000;

#[program]
pub mod indie_pool {
    use super::*;

    /// One-shot init by the deployer. Stores the oracle pubkey and the REP
    /// mint, and creates the mint as a Token-2022 NonTransferable mint with a
    /// PDA mint authority. Idempotent guard: PDA seed `[b"oracle"]` so a
    /// second call fails with `account already in use`.
    pub fn initialize_oracle(
        ctx: Context<InitializeOracle>,
        oracle_pubkey: Pubkey,
    ) -> Result<()> {
        // --- Manually create + init the Token-2022 REP mint with NonTransferable. ---
        // anchor-spl 0.32's declarative `extensions::non_transferable` doesn't
        // parse, so we drive create_account → non_transferable_mint_initialize
        // → initialize_mint2 ourselves. Order is enforced by Token-2022:
        // extensions must be initialized BEFORE the base mint.
        let space = spl_token_2022::extension::ExtensionType::try_calculate_account_len::<
            spl_token_2022::state::Mint,
        >(&[spl_token_2022::extension::ExtensionType::NonTransferable])?;
        let lamports = Rent::get()?.minimum_balance(space);

        let rep_mint_bump = ctx.bumps.rep_mint;
        let rep_mint_seeds: &[&[&[u8]]] = &[&[b"rep_mint", &[rep_mint_bump]]];

        create_account(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                CreateAccount {
                    from: ctx.accounts.admin.to_account_info(),
                    to: ctx.accounts.rep_mint.to_account_info(),
                },
                rep_mint_seeds,
            ),
            lamports,
            space as u64,
            &ctx.accounts.token_program.key(),
        )?;

        non_transferable_mint_initialize(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            NonTransferableMintInitialize {
                token_program_id: ctx.accounts.token_program.to_account_info(),
                mint: ctx.accounts.rep_mint.to_account_info(),
            },
        ))?;

        initialize_mint2(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                InitializeMint2 {
                    mint: ctx.accounts.rep_mint.to_account_info(),
                },
            ),
            0,                                    // decimals
            &ctx.accounts.mint_authority.key(),   // mint authority = PDA
            None,                                 // no freeze authority
        )?;

        // --- Now record the oracle state. ---
        let state = &mut ctx.accounts.oracle_state;
        state.admin = ctx.accounts.admin.key();
        state.oracle = oracle_pubkey;
        state.rep_mint = ctx.accounts.rep_mint.key();
        state.total_contributions = 0;
        state.bump = ctx.bumps.oracle_state;
        state.mint_authority_bump = ctx.bumps.mint_authority;
        Ok(())
    }

    /// Contributor opens a new contribution PDA. `nonce` lets the same
    /// contributor submit multiple times (the frontend uses `Date.now()`).
    pub fn submit_contribution(
        ctx: Context<SubmitContribution>,
        nonce: u64,
        project_id: String,
        contribution_type: String,
        ipfs_hash: String,
        description: String,
    ) -> Result<()> {
        require!(project_id.len() <= MAX_PROJECT_ID, IndiePoolError::FieldTooLong);
        require!(contribution_type.len() <= MAX_TYPE, IndiePoolError::FieldTooLong);
        require!(ipfs_hash.len() <= MAX_IPFS_HASH, IndiePoolError::FieldTooLong);
        require!(description.len() <= MAX_DESCRIPTION, IndiePoolError::FieldTooLong);

        let c = &mut ctx.accounts.contribution;
        c.contributor = ctx.accounts.contributor.key();
        c.nonce = nonce;
        c.project_id = project_id;
        c.contribution_type = contribution_type;
        c.ipfs_hash = ipfs_hash;
        c.description = description;
        c.status = ContributionStatus::Pending;
        c.score = 0;
        c.reasoning_hash = [0u8; 32];
        c.submitted_at = Clock::get()?.unix_timestamp;
        c.verified_at = 0;
        c.minted = false;
        c.bump = ctx.bumps.contribution;

        let oracle = &mut ctx.accounts.oracle_state;
        oracle.total_contributions = oracle.total_contributions.saturating_add(1);

        emit!(ContributionSubmitted {
            contribution: c.key(),
            contributor: c.contributor,
            nonce,
        });
        Ok(())
    }

    /// Oracle-only: writes the AI score and flips status. The signer-equality
    /// check is enforced by `has_one = oracle` on `OracleState`.
    pub fn verify_contribution(
        ctx: Context<VerifyContribution>,
        score: u8,
        reasoning_hash: [u8; 32],
    ) -> Result<()> {
        require!(score <= 100, IndiePoolError::InvalidScore);

        let c = &mut ctx.accounts.contribution;
        require!(
            matches!(c.status, ContributionStatus::Pending),
            IndiePoolError::AlreadyVerified
        );

        c.score = score;
        c.reasoning_hash = reasoning_hash;
        c.status = if score >= APPROVAL_THRESHOLD {
            ContributionStatus::Verified
        } else {
            ContributionStatus::Rejected
        };
        c.verified_at = Clock::get()?.unix_timestamp;

        emit!(ContributionVerified {
            contribution: c.key(),
            score,
            approved: score >= APPROVAL_THRESHOLD,
        });
        Ok(())
    }

    /// Anyone can settle the mint after verification (callable by contributor
    /// or by the oracle service). Mints `score` REP into the contributor's
    /// associated token account on the NonTransferable mint.
    pub fn mint_reputation(ctx: Context<MintReputation>) -> Result<()> {
        // 1) Validate + snapshot. Scoped block ends the immutable borrow
        //    so we can reborrow `contribution` mutably below.
        let (score, contributor, contribution_key) = {
            let c = &ctx.accounts.contribution;
            require!(
                matches!(c.status, ContributionStatus::Verified),
                IndiePoolError::NotVerified
            );
            require!(!c.minted, IndiePoolError::AlreadyMinted);
            (c.score, c.contributor, c.key())
        };

        // 2) CPI: mint `score` REP via the PDA mint authority.
        let bump = ctx.accounts.oracle_state.mint_authority_bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"mint_authority", &[bump]]];
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.rep_mint.to_account_info(),
                    to: ctx.accounts.contributor_token_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer_seeds,
            ),
            score as u64,
        )?;

        // 3) Persist `minted = true` so this contribution can't be re-minted.
        ctx.accounts.contribution.minted = true;

        emit!(ReputationMinted {
            contribution: contribution_key,
            contributor,
            amount: score as u64,
        });
        Ok(())
    }

    // ------------------------------------------------------------------------
    // Projects (Layer 0): on-chain registry of all projects in the pool
    //
    // Before anyone can fund an escrow for a project_id, the project itself
    // must exist as an on-chain `Project` PDA at seed [b"project", project_id].
    // First caller wins on the slug. Anyone can register (no creator gating
    // at this stage). Metadata (name, description, art) lives on-chain so
    // the UI can render /projects from real data.
    // ------------------------------------------------------------------------

    pub fn register_project(
        ctx: Context<RegisterProject>,
        project_id: String,
        name: String,
        blurb: String,
        art: String,
        primary_type: String,
    ) -> Result<()> {
        require!(project_id.len() <= MAX_PROJECT_ID, IndiePoolError::FieldTooLong);
        require!(name.len() <= MAX_PROJECT_NAME, IndiePoolError::FieldTooLong);
        require!(blurb.len() <= MAX_PROJECT_BLURB, IndiePoolError::FieldTooLong);
        require!(art.len() <= MAX_PROJECT_ART, IndiePoolError::FieldTooLong);
        require!(primary_type.len() <= MAX_TYPE, IndiePoolError::FieldTooLong);

        let project_bump = ctx.bumps.project;
        let project_key = ctx.accounts.project.key();
        let creator_key = ctx.accounts.creator.key();
        let now = Clock::get()?.unix_timestamp;

        let project = &mut ctx.accounts.project;
        project.creator = creator_key;
        project.project_id = project_id.clone();
        project.name = name.clone();
        project.blurb = blurb;
        project.art = art;
        project.primary_type = primary_type;
        project.created_at = now;
        project.bump = project_bump;

        emit!(ProjectRegistered {
            project: project_key,
            creator: creator_key,
            project_id,
            name,
        });
        Ok(())
    }

    // ------------------------------------------------------------------------
    // Layer 2: project escrow
    //
    // Project creators fund a per-project escrow PDA with SOL. When a
    // contribution scores >= APPROVAL_THRESHOLD and matches the escrow's
    // project_id, the oracle releases `score * lamports_per_score` from the
    // escrow to the contributor. Same trust model as verify_contribution:
    // oracle signature is the only thing that authorizes payout.
    //
    // Escrow creation requires the matching `Project` PDA to exist — strict
    // coupling so every escrow corresponds to a real registered project.
    // ------------------------------------------------------------------------

    /// Anyone can create an escrow for any `project_id`; first caller wins
    /// (PDA seed = [b"escrow", project_id]). The creator can optionally seed
    /// the escrow with `initial_deposit` lamports in the same tx.
    ///
    /// `lamports_per_score` is the per-score-point payout rate stored on
    /// the escrow. Subsequent `release_milestone` calls multiply this by
    /// the contribution's score to determine the payout amount.
    pub fn create_project_escrow(
        ctx: Context<CreateProjectEscrow>,
        project_id: String,
        initial_deposit: u64,
        lamports_per_score: u64,
    ) -> Result<()> {
        require!(project_id.len() <= MAX_PROJECT_ID, IndiePoolError::FieldTooLong);
        require!(
            lamports_per_score > 0 && lamports_per_score <= MAX_LAMPORTS_PER_SCORE,
            IndiePoolError::InvalidPayoutRate,
        );

        // Snapshot for use after the transfer (which immutably borrows ctx.accounts).
        let escrow_bump = ctx.bumps.escrow;
        let escrow_key = ctx.accounts.escrow.key();
        let creator_key = ctx.accounts.creator.key();
        let oracle = ctx.accounts.oracle_state.oracle;

        // Transfer first; subsequently take the mutable borrow on escrow to
        // write state. Doing it the other way trips the borrow checker.
        if initial_deposit > 0 {
            transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.creator.to_account_info(),
                        to: ctx.accounts.escrow.to_account_info(),
                    },
                ),
                initial_deposit,
            )?;
        }

        let escrow = &mut ctx.accounts.escrow;
        escrow.creator = creator_key;
        escrow.oracle = oracle;
        escrow.project_id = project_id.clone();
        escrow.lamports_per_score = lamports_per_score;
        escrow.total_funded = initial_deposit;
        escrow.total_released = 0;
        escrow.bump = escrow_bump;

        emit!(EscrowCreated {
            escrow: escrow_key,
            creator: creator_key,
            project_id,
            initial_deposit,
            lamports_per_score,
        });
        Ok(())
    }

    /// Add more lamports to an existing escrow. Anyone can fund any escrow.
    pub fn fund_project_escrow(
        ctx: Context<FundProjectEscrow>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, IndiePoolError::InvalidAmount);

        let escrow_key = ctx.accounts.escrow.key();
        let funder = ctx.accounts.funder.key();

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.funder.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                },
            ),
            amount,
        )?;

        let escrow = &mut ctx.accounts.escrow;
        escrow.total_funded = escrow.total_funded.saturating_add(amount);
        let total_funded = escrow.total_funded;

        emit!(EscrowFunded {
            escrow: escrow_key,
            funder,
            amount,
            total_funded,
        });
        Ok(())
    }

    /// Oracle-signed: releases `contribution.score * escrow.lamports_per_score`
    /// from the escrow PDA to the contributor wallet. Idempotency is enforced
    /// by setting `contribution.released = true` (a separate flag from
    /// `minted` so REP and SOL payouts are independently trackable).
    pub fn release_milestone(ctx: Context<ReleaseMilestone>) -> Result<()> {
        // Snapshot + validate. The mutable lamport mutation below conflicts
        // with holding any other borrow on `escrow`, so compute everything
        // we need from immutable borrows first.
        let (amount, contribution_key, contributor_key, escrow_key) = {
            let c = &ctx.accounts.contribution;
            require!(
                matches!(c.status, ContributionStatus::Verified),
                IndiePoolError::NotVerified,
            );

            let escrow = &ctx.accounts.escrow;
            require!(
                c.project_id == escrow.project_id,
                IndiePoolError::EscrowProjectMismatch,
            );

            let amount = (c.score as u64).saturating_mul(escrow.lamports_per_score);
            require!(amount > 0, IndiePoolError::InvalidAmount);

            let escrow_info = ctx.accounts.escrow.to_account_info();
            let rent_minimum = Rent::get()?.minimum_balance(escrow_info.data_len());
            let available = escrow_info.lamports().saturating_sub(rent_minimum);
            require!(amount <= available, IndiePoolError::EscrowInsufficientFunds);

            (amount, c.key(), c.contributor, escrow.key())
        };

        // Direct lamport transfer from PDA. The program owns the PDA so it
        // can mutate `lamports` directly without a system-program CPI.
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx
            .accounts
            .contributor
            .to_account_info()
            .try_borrow_mut_lamports()? += amount;

        // Persist accounting on the escrow.
        let escrow = &mut ctx.accounts.escrow;
        escrow.total_released = escrow.total_released.saturating_add(amount);
        let total_released = escrow.total_released;

        // Stamp the receipt — its existence is the idempotency guarantee.
        let receipt_bump = ctx.bumps.release_receipt;
        let receipt = &mut ctx.accounts.release_receipt;
        receipt.contribution = contribution_key;
        receipt.escrow = escrow_key;
        receipt.contributor = contributor_key;
        receipt.amount = amount;
        receipt.released_at = Clock::get()?.unix_timestamp;
        receipt.bump = receipt_bump;

        emit!(MilestoneReleased {
            escrow: escrow_key,
            contribution: contribution_key,
            contributor: contributor_key,
            amount,
            total_released,
        });
        Ok(())
    }
}

// ============================================================================
// Account contexts
// ============================================================================

#[derive(Accounts)]
pub struct InitializeOracle<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + OracleState::INIT_SPACE,
        seeds = [b"oracle"],
        bump,
    )]
    pub oracle_state: Account<'info, OracleState>,

    /// CHECK: REP mint PDA. Initialized in the instruction body as a
    /// Token-2022 mint with the NonTransferable extension and decimals = 0
    /// (whole-number reputation points). Anchor's declarative `init` can't
    /// express NonTransferable in 0.32 (parser limitation), so we create
    /// the account + init extension + init mint manually. Other instructions
    /// re-bind this PDA as `InterfaceAccount<'info, Mint>` for type safety.
    #[account(
        mut,
        seeds = [b"rep_mint"],
        bump,
    )]
    pub rep_mint: UncheckedAccount<'info>,

    /// CHECK: PDA used as the mint authority for `rep_mint`.
    #[account(
        seeds = [b"mint_authority"],
        bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct SubmitContribution<'info> {
    #[account(mut)]
    pub contributor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"oracle"],
        bump = oracle_state.bump,
    )]
    pub oracle_state: Account<'info, OracleState>,

    #[account(
        init,
        payer = contributor,
        space = 8 + Contribution::INIT_SPACE,
        seeds = [b"contribution", contributor.key().as_ref(), &nonce.to_le_bytes()],
        bump,
    )]
    pub contribution: Account<'info, Contribution>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyContribution<'info> {
    /// Must equal `oracle_state.oracle`. Enforced by `has_one`.
    pub oracle_signer: Signer<'info>,

    #[account(
        seeds = [b"oracle"],
        bump = oracle_state.bump,
        has_one = oracle @ IndiePoolError::UnauthorizedOracle,
    )]
    pub oracle_state: Account<'info, OracleState>,

    /// CHECK: This is just the oracle pubkey for the has_one check.
    pub oracle: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [
            b"contribution",
            contribution.contributor.as_ref(),
            &contribution.nonce.to_le_bytes(),
        ],
        bump = contribution.bump,
    )]
    pub contribution: Account<'info, Contribution>,
}

#[derive(Accounts)]
pub struct MintReputation<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [b"oracle"],
        bump = oracle_state.bump,
    )]
    pub oracle_state: Account<'info, OracleState>,

    #[account(
        mut,
        seeds = [
            b"contribution",
            contribution.contributor.as_ref(),
            &contribution.nonce.to_le_bytes(),
        ],
        bump = contribution.bump,
    )]
    pub contribution: Account<'info, Contribution>,

    /// CHECK: The contributor's wallet — destination owner for the ATA.
    /// Validated indirectly via `contribution.contributor`.
    #[account(address = contribution.contributor)]
    pub contributor: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"rep_mint"],
        bump,
        mint::token_program = token_program,
    )]
    pub rep_mint: InterfaceAccount<'info, Mint>,

    /// CHECK: PDA mint authority, signs via seeds.
    #[account(seeds = [b"mint_authority"], bump = oracle_state.mint_authority_bump)]
    pub mint_authority: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = rep_mint,
        associated_token::authority = contributor,
        associated_token::token_program = token_program,
    )]
    pub contributor_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(project_id: String)]
pub struct RegisterProject<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + Project::INIT_SPACE,
        seeds = [b"project", project_id.as_bytes()],
        bump,
    )]
    pub project: Account<'info, Project>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(project_id: String)]
pub struct CreateProjectEscrow<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        seeds = [b"oracle"],
        bump = oracle_state.bump,
    )]
    pub oracle_state: Account<'info, OracleState>,

    /// Required: the project must already be registered. If you typo the
    /// slug or it hasn't been registered yet, this fails with
    /// `AccountNotInitialized` — pointing the user at /projects/register
    /// before they can fund the escrow.
    #[account(
        seeds = [b"project", project_id.as_bytes()],
        bump = project.bump,
    )]
    pub project: Account<'info, Project>,

    #[account(
        init,
        payer = creator,
        space = 8 + ProjectEscrow::INIT_SPACE,
        seeds = [b"escrow", project_id.as_bytes()],
        bump,
    )]
    pub escrow: Account<'info, ProjectEscrow>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundProjectEscrow<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.project_id.as_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, ProjectEscrow>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseMilestone<'info> {
    /// Must equal `oracle_state.oracle`. Enforced by `has_one`. Also pays
    /// rent for the release_receipt PDA below.
    #[account(mut)]
    pub oracle_signer: Signer<'info>,

    #[account(
        seeds = [b"oracle"],
        bump = oracle_state.bump,
        has_one = oracle @ IndiePoolError::UnauthorizedOracle,
    )]
    pub oracle_state: Account<'info, OracleState>,

    /// CHECK: Just the oracle pubkey for the has_one check.
    pub oracle: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.project_id.as_bytes()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, ProjectEscrow>,

    #[account(
        seeds = [
            b"contribution",
            contribution.contributor.as_ref(),
            &contribution.nonce.to_le_bytes(),
        ],
        bump = contribution.bump,
    )]
    pub contribution: Account<'info, Contribution>,

    /// `init` on the receipt PDA enforces single-release-per-contribution.
    /// Second call → "account already in use" → instruction aborts.
    #[account(
        init,
        payer = oracle_signer,
        space = 8 + ReleaseReceipt::INIT_SPACE,
        seeds = [b"release", contribution.key().as_ref()],
        bump,
    )]
    pub release_receipt: Account<'info, ReleaseReceipt>,

    /// CHECK: SOL destination. Must equal `contribution.contributor`; not
    /// deserialized as it's a regular wallet.
    #[account(mut, address = contribution.contributor)]
    pub contributor: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

// ============================================================================
// State
// ============================================================================

#[account]
#[derive(InitSpace)]
pub struct OracleState {
    pub admin: Pubkey,
    pub oracle: Pubkey,
    pub rep_mint: Pubkey,
    pub total_contributions: u64,
    pub bump: u8,
    pub mint_authority_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Contribution {
    pub contributor: Pubkey,
    pub nonce: u64,
    #[max_len(MAX_PROJECT_ID)]
    pub project_id: String,
    #[max_len(MAX_TYPE)]
    pub contribution_type: String,
    #[max_len(MAX_IPFS_HASH)]
    pub ipfs_hash: String,
    #[max_len(MAX_DESCRIPTION)]
    pub description: String,
    pub status: ContributionStatus,
    pub score: u8,
    pub reasoning_hash: [u8; 32],
    pub submitted_at: i64,
    pub verified_at: i64,
    pub minted: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ContributionStatus {
    Pending,
    Verified,
    Rejected,
}

#[account]
#[derive(InitSpace)]
pub struct Project {
    /// Whoever first registered this slug. Informational at MVP; could
    /// gate `close_project` or `update_project` in a future iteration.
    pub creator: Pubkey,
    #[max_len(MAX_PROJECT_ID)]
    pub project_id: String,
    #[max_len(MAX_PROJECT_NAME)]
    pub name: String,
    /// Short pitch / blurb shown on /projects cards.
    #[max_len(MAX_PROJECT_BLURB)]
    pub blurb: String,
    /// Visual art ref — usually an emoji or single-char (Brutalist UI uses
    /// a procedural fallback if empty). Could also hold an IPFS hash for
    /// a real image once pinning is wired.
    #[max_len(MAX_PROJECT_ART)]
    pub art: String,
    #[max_len(MAX_TYPE)]
    pub primary_type: String,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ProjectEscrow {
    /// Whoever called `create_project_escrow`. Currently informational —
    /// no instruction is gated on this. Could become the authority for
    /// "close_escrow" in a future iteration.
    pub creator: Pubkey,
    /// Snapshot of `oracle_state.oracle` at creation time. Used to gate
    /// `release_milestone` even if the oracle is rotated later.
    pub oracle: Pubkey,
    #[max_len(MAX_PROJECT_ID)]
    pub project_id: String,
    /// Payout rate: SOL released per score point on `release_milestone`.
    pub lamports_per_score: u64,
    pub total_funded: u64,
    pub total_released: u64,
    pub bump: u8,
}

/// Idempotency marker for `release_milestone`. The PDA's existence proves
/// the contribution's milestone has already been paid out — a second
/// `release_milestone` call hits `init` on this account and fails with
/// "account already in use". Cleaner than adding a `released` flag to
/// the existing `Contribution` struct (which would break deserialization
/// of contributions submitted before this upgrade).
#[account]
#[derive(InitSpace)]
pub struct ReleaseReceipt {
    pub contribution: Pubkey,
    pub escrow: Pubkey,
    pub contributor: Pubkey,
    pub amount: u64,
    pub released_at: i64,
    pub bump: u8,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct ContributionSubmitted {
    pub contribution: Pubkey,
    pub contributor: Pubkey,
    pub nonce: u64,
}

#[event]
pub struct ContributionVerified {
    pub contribution: Pubkey,
    pub score: u8,
    pub approved: bool,
}

#[event]
pub struct ReputationMinted {
    pub contribution: Pubkey,
    pub contributor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowCreated {
    pub escrow: Pubkey,
    pub creator: Pubkey,
    pub project_id: String,
    pub initial_deposit: u64,
    pub lamports_per_score: u64,
}

#[event]
pub struct EscrowFunded {
    pub escrow: Pubkey,
    pub funder: Pubkey,
    pub amount: u64,
    pub total_funded: u64,
}

#[event]
pub struct MilestoneReleased {
    pub escrow: Pubkey,
    pub contribution: Pubkey,
    pub contributor: Pubkey,
    pub amount: u64,
    pub total_released: u64,
}

#[event]
pub struct ProjectRegistered {
    pub project: Pubkey,
    pub creator: Pubkey,
    pub project_id: String,
    pub name: String,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum IndiePoolError {
    #[msg("Submitted field exceeds maximum length")]
    FieldTooLong,
    #[msg("Score must be between 0 and 100")]
    InvalidScore,
    #[msg("Contribution already verified")]
    AlreadyVerified,
    #[msg("Contribution must be verified before minting")]
    NotVerified,
    #[msg("Reputation already minted for this contribution")]
    AlreadyMinted,
    #[msg("Signer is not the registered oracle")]
    UnauthorizedOracle,
    #[msg("Payout rate must be > 0 and <= 100_000_000 lamports per score point")]
    InvalidPayoutRate,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Escrow has insufficient SOL above rent-exempt minimum for this milestone")]
    EscrowInsufficientFunds,
    #[msg("Contribution project_id does not match escrow project_id")]
    EscrowProjectMismatch,
}
