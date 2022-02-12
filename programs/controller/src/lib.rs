use anchor_lang::prelude::*;
use anchor_spl::token::{TokenAccount};

use spl_token_metadata::{
    state::{Metadata},
};

use anchor_lang::solana_program::{
    pubkey::Pubkey,
    log::sol_log_compute_units
};

use incubator::{
    state::{ Incubator, UpdateAuthority, DraggosMetadata, Slot }
};

declare_id!("2QPGAb8c9gyZvYKg3kPbBLh4dtNWfWQQwjYdfKLCFMJo");

#[program]
pub mod controller {
    use super::*;

    pub fn deposit_controller<'a, 'b, 'c, 'info>(ctx: Context<'a, 'b, 'c, 'info, DepositController<'info>>, update_authority_bump: u8) -> ProgramResult {
        let incubator = &ctx.accounts.incubator;
        let depositor_draggos_metadata_account = &mut ctx.accounts.draggos_metadata_account;
        let depositor_metaplex_metadata_account = &ctx.accounts.metaplex_metadata_account;
        let remaining_accounts = ctx.remaining_accounts;
        let depositor_mint = &ctx.accounts.mint;
        let update_authority = &ctx.accounts.update_authority;
        let token_metadata_program = &ctx.accounts.token_metadata_program;

        let slot_accounts_info = &remaining_accounts[..(incubator.capacity as usize)];

        /*let mut slot_accounts = slot_accounts_info.iter().map(|a| {
            let slot: Account<'info, Slot> = Account::try_from(a).unwrap();
            return slot;
        }).collect::<Vec<_>>();
        sol_log_compute_units();

        slot_accounts.sort_by(|a, b| a.index.cmp(&b.index));
        sol_log_compute_units();*/

        let next_index = incubator.mints.len() as u8;

        if next_index < (incubator.capacity - 1) {
            let current_slot = &mut slot_accounts_info.get(next_index as usize).unwrap();

            let deposit_incubator_accounts = incubator::cpi::accounts::DepositIncubator {
                slot: current_slot.to_account_info().clone(),
                mint: depositor_mint.clone(),
                draggos_metadata_account: depositor_draggos_metadata_account.to_account_info().clone(),
                metaplex_metadata_account: depositor_metaplex_metadata_account.clone(),
                incubator: incubator.to_account_info().clone()
            };

            let update_slot_context = CpiContext::new(ctx.accounts.incubator_program.clone(), deposit_incubator_accounts);
            incubator::cpi::deposit_incubator(update_slot_context)?;
        }

        if incubator.capacity == (next_index + 1) {
            let metaplex_metadata_accounts_start_index = incubator.capacity as usize;
            let metaplex_metadata_accounts_end_index = (incubator.capacity as usize) + incubator.mints.len();
            let draggos_metadata_accounts_end_index = metaplex_metadata_accounts_end_index + incubator.mints.len();

            let metaplex_metadata_accounts_info = &remaining_accounts[metaplex_metadata_accounts_start_index..metaplex_metadata_accounts_end_index];
            let draggos_metadata_accounts_info = &remaining_accounts[metaplex_metadata_accounts_end_index..draggos_metadata_accounts_end_index];

            /*let draggos_metadata_accounts = draggos_metadata_accounts_info.iter().map(|a| {
                let ac: Account<'info, DraggosMetadata> = Account::try_from(a).unwrap();
                return ac;
            }).collect::<Vec<_>>();
            sol_log_compute_units();*/

            for (i, slot) in slot_accounts_info.iter().enumerate() {
                /*emit!(HatchEvent {
                    mint: slot.key(),
                });*/

                let is_last_slot = i == (next_index as usize);

                let metaplex_metadata_account_slot = if is_last_slot { depositor_metaplex_metadata_account } else { &metaplex_metadata_accounts_info[i] };
                let draggos_metadata_account_slot = if is_last_slot {
                    depositor_draggos_metadata_account.to_account_info().clone()
                } else { draggos_metadata_accounts_info[i].clone() };

                /*if !is_last_slot  {
                    if slot.metaplex_metadata == None {
                        return Err(ControllerError::InvalidSlotMetaplexMetadata.into());
                    } else if slot.draggos_metadata == None {
                        return Err(ControllerError::InvalidSlotDraggosMetadata.into());
                    } else if slot.mint != draggos_metadata_account_slot.mint {
                        return Err(ControllerError::InvalidSlotMint.into());
                    }
                }*/
                
                let hatch_accounts = incubator::cpi::accounts::HatchIncubator {
                    incubator: incubator.to_account_info().clone(),
                    update_authority: update_authority.to_account_info().clone(),
                    token_metadata_program: token_metadata_program.clone(),
                    draggos_metadata_account: draggos_metadata_account_slot.to_account_info().clone(),
                    metaplex_metadata_account: metaplex_metadata_account_slot.clone(),
                    slot: slot.to_account_info().clone()
                };

                let hatch_context = CpiContext::new(ctx.accounts.incubator_program.clone(), hatch_accounts);
                incubator::cpi::hatch_incubator(hatch_context, update_authority_bump, is_last_slot)?;
            }
        }

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
#[instruction(metadata: Metadata, update_authority_bump: u8)]
pub struct HatchEgg<'info> {
    pub authority: Signer<'info>,
    #[account(
        seeds = [
            b"incubator_v0".as_ref()
        ],
        bump = incubator.bump
    )]
    pub incubator: Account<'info, Incubator>,
    pub draggos_metadata_account: Account<'info, DraggosMetadata>,
    pub metaplex_metadata_account: AccountInfo<'info>,
    #[account(
        seeds = [
            b"incubator_v0".as_ref(),
            b"update_authority".as_ref()
        ],
        bump = update_authority.bump,
    )]
    pub update_authority: Account<'info, UpdateAuthority>,
    #[account(
        mut,
        seeds = [
            b"incubator_v0".as_ref(),
            b"slot".as_ref(),
            &[slot.index]
        ],
        bump = slot.bump,
    )]
    pub slot: Account<'info, Slot>,
    #[account(address = spl_token_metadata::id())]
    pub token_metadata_program: AccountInfo<'info>
}

#[error]
pub enum ControllerError {
    #[msg("Invalid mint on slot")]
    InvalidSlotMint,
    #[msg("Invalid metaplex metadata on slot")]
    InvalidSlotMetaplexMetadata,
    #[msg("Invalid draggos metadata on slot")]
    InvalidSlotDraggosMetadata
}