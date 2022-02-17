use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount};

use spl_token_metadata::{
    state::{Metadata},
};

use anchor_lang::solana_program::{
    pubkey::Pubkey
};

use incubator::{
    state::{ Incubator, UpdateAuthority, DraggosMetadata, Slot, IncubatorError }
};

pub mod state;

use state::DepositAuthority;

declare_id!("2QPGAb8c9gyZvYKg3kPbBLh4dtNWfWQQwjYdfKLCFMJo");

#[program]
pub mod controller {
    use super::*;

    pub fn deposit_controller<'a, 'b, 'c, 'info>(ctx: Context<'a, 'b, 'c, 'info, DepositController<'info>>) -> ProgramResult {
        let incubator = &ctx.accounts.incubator;
        let depositor_draggos_metadata_account = &mut ctx.accounts.draggos_metadata_account;
        let depositor_metaplex_metadata_account = &ctx.accounts.metaplex_metadata_account;
        let remaining_accounts = ctx.remaining_accounts;
        let depositor_mint = &ctx.accounts.mint;
        let deposit_authority = &ctx.accounts.deposit_authority;

        let capacity = incubator.slots.len();
        let slot_accounts_info = &remaining_accounts[..capacity];

        let mut slot_accounts = slot_accounts_info.iter().map(|a| {
            let slot: Account<'info, Slot> = Account::try_from(a).unwrap();
            return slot;
        }).collect::<Vec<_>>();

        slot_accounts.sort_by(|a, b| a.index.cmp(&b.index));

        let next_index = incubator.mints.len();
        let capacity = incubator.slots.len();

        if incubator.mints.contains(&depositor_mint.key()) {
            return Err(IncubatorError::InIncubator.into());
        }

        if next_index < capacity {
            let current_slot = slot_accounts.get(next_index as usize).unwrap();
            
            let deposit_incubator_accounts = incubator::cpi::accounts::DepositIncubator {
                slot: current_slot.to_account_info().clone(),
                mint: depositor_mint.clone(),
                draggos_metadata_account: depositor_draggos_metadata_account.to_account_info().clone(),
                metaplex_metadata_account: depositor_metaplex_metadata_account.clone(),
                incubator: incubator.to_account_info().clone(),
                authority: deposit_authority.to_account_info().clone()
            };

            let authority_seeds = &[&b"incubator_v0"[..], &b"deposit_authority"[..], &[deposit_authority.bump]];
            let signer_seeds = &[&authority_seeds[..]];
            let update_slot_context = CpiContext::new_with_signer(
                ctx.accounts.incubator_program.clone(), deposit_incubator_accounts,
                signer_seeds
            );
            incubator::cpi::deposit_incubator(update_slot_context)?;
        } else {
            return Err(IncubatorError::InvalidAuthority.into());
        }

        Ok(())
    }

    pub fn create_deposit_authority(ctx: Context<CreateDepositAuthority>) -> ProgramResult {
        let deposit_authority = &mut ctx.accounts.deposit_authority;

        deposit_authority.bump = *ctx.bumps.get("deposit_authority").unwrap();
        deposit_authority.authority = *ctx.accounts.authority.key;

        Ok(())
    }
}

#[event]
pub struct HatchEvent {
    #[index]
    pub mint: Pubkey,
}

#[derive(Accounts)]
pub struct DepositController<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut
    )]
    pub incubator: Account<'info, Incubator>,
    pub incubator_program: AccountInfo<'info>,
    #[account(
        mut
    )]
    pub draggos_metadata_account: Account<'info, DraggosMetadata>,
    #[account(
        mut
    )]
    pub metaplex_metadata_account: AccountInfo<'info>,
    #[account(
        seeds = [
            b"incubator_v0".as_ref(),
            b"deposit_authority".as_ref()
        ],
        bump = deposit_authority.bump,
    )]
    pub deposit_authority: Account<'info, DepositAuthority>,
    pub mint: AccountInfo<'info>,
    pub update_authority: Account<'info, UpdateAuthority>,
    #[account(
        constraint = token_account.owner == *authority.key,
        constraint = token_account.mint == mint.key()
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(address = spl_token_metadata::id())]
    pub token_metadata_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct CreateDepositAuthority<'info> {
    pub authority: Signer<'info>,
    #[account(
        init,
        seeds = [
            b"incubator_v0".as_ref(),
            b"deposit_authority".as_ref()
        ],
        bump,
        payer = authority,
        space = 500
    )]
    pub deposit_authority: Account<'info, DepositAuthority>,
    pub system_program: Program<'info, System>
}


