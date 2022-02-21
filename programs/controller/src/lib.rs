use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount};

use anchor_lang::solana_program::{
    pubkey::Pubkey
};

use incubator::{
    state::{ Incubator, UpdateAuthority, DraggosMetadata, Slot, INCUBATOR_SEED, DEPOSIT_AUTHORITY_SEED }
};

pub mod state;

use state::{
    DepositAuthority,
    ControllerError
};

declare_id!("4fLNdQ1L55KeCFS1Z82kLr2UkvxnDGQgs9jp7fQua7yR");

#[program]
pub mod controller {
    use super::*;

    pub fn deposit_controller<'a, 'b, 'c, 'info>(ctx: Context<'a, 'b, 'c, 'info, DepositController<'info>>) -> ProgramResult {
        let draggos_metadata = &mut ctx.accounts.draggos_metadata;
        let deposit_authority = &ctx.accounts.deposit_authority;
        let token_metadata = &ctx.accounts.token_metadata;
        let remaining_accounts = ctx.remaining_accounts;
        let incubator = &ctx.accounts.incubator;
        let depositor_mint = &ctx.accounts.mint;

        let capacity = incubator.slots.len();
        let slot_accounts_info = &remaining_accounts[..capacity];

        let slot_accounts = slot_accounts_info.iter().map(|a| {
            let slot: Account<'info, Slot> = Account::try_from(a).unwrap();
            slot
        }).collect::<Vec<_>>();

        let next_index = incubator.mints.len();
        if next_index < capacity {
            let current_slot = slot_accounts.iter().find(|&x| x.index == (next_index as u8)).unwrap();
            
            let deposit_incubator_accounts = incubator::cpi::accounts::DepositIncubator {
                slot: current_slot.to_account_info().clone(),
                mint: depositor_mint.clone(),
                draggos_metadata: draggos_metadata.to_account_info().clone(),
                token_metadata: token_metadata.clone(),
                incubator: incubator.to_account_info().clone(),
                authority: deposit_authority.to_account_info().clone()
            };

            let authority_seeds = &[&INCUBATOR_SEED[..], &DEPOSIT_AUTHORITY_SEED[..], &[deposit_authority.bump]];
            let signer_seeds = &[&authority_seeds[..]];
            let deposit_cpi_context = CpiContext::new_with_signer(
                ctx.accounts.incubator_program.clone(), deposit_incubator_accounts,
                signer_seeds
            );
            incubator::cpi::deposit_incubator(deposit_cpi_context)?;
        } else {
            return Err(ControllerError::IncubatorFull.into());
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

#[derive(Accounts)]
pub struct DepositController<'info> {
    pub authority: Signer<'info>,
    //Validated in incubator program
    #[account(mut)]
    pub incubator: Account<'info, Incubator>,
    pub incubator_program: AccountInfo<'info>,
    //Validated in incubator program
    #[account(mut)]
    pub draggos_metadata: Account<'info, DraggosMetadata>,
    //Validated in incubator program
    #[account(mut)]
    pub token_metadata: AccountInfo<'info>,
    #[account(
        seeds = [
            INCUBATOR_SEED,
            DEPOSIT_AUTHORITY_SEED
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
            INCUBATOR_SEED,
            DEPOSIT_AUTHORITY_SEED
        ],
        bump,
        payer = authority,
        space = 100 // 32 + 1 + safety room
    )]
    pub deposit_authority: Account<'info, DepositAuthority>,
    pub system_program: Program<'info, System>
}


