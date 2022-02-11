use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

use spl_token_metadata::{
    state::{Metadata},
};

use anchor_lang::solana_program::{
    pubkey::Pubkey,
};

use incubator::{
    state::{ Incubator, UpdateAuthority, DraggosMetadata, Slot },
    program::Incubator as IncubatorProgram
};

declare_id!("8kwMagr5CdrKA3aEUYpZ8xzY6Zb8mX98db3YrKHjWidC");

#[program]
pub mod controller {
    use super::*;

    pub fn deposit<'a, 'b, 'c, 'info>(ctx: Context<'a, 'b, 'c, 'info, DepositEgg<'info>>, update_authority_bump: u8) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let draggos_metadata_account = &mut ctx.accounts.draggos_metadata_account;
        let metaplex_metadata_account = &ctx.accounts.metaplex_metadata_account;
        let remaining_accounts = ctx.remaining_accounts;
        let mint = &ctx.accounts.mint;
        let update_authority = &ctx.accounts.update_authority;
        let system_program = &ctx.accounts.system_program;

        let depositor_metaplex_metadata = Metadata::from_account_info(metaplex_metadata_account).unwrap();

        if draggos_metadata_account.hatched {
            return Err(ControllerError::AlreadyHatched.into());
        } else if depositor_metaplex_metadata.update_authority != update_authority.key() {
            return Err(ControllerError::InvalidUpdateAuthority.into());
        }

        incubator.mints.push(ctx.accounts.mint.key().clone());

        let slot_accounts_info = &remaining_accounts[..(incubator.capacity as usize)];
        let mut slot_accounts = slot_accounts_info.iter().map(|a| {
            let slot: Account<'info, Slot> = Account::try_from(a).unwrap();
            return slot;
        }).collect::<Vec<_>>();

        slot_accounts.sort_by(|a, b| a.index.cmp(&b.index));

        if incubator.next_index >= (incubator.capacity - 1) {
            let metaplex_metadata_accounts_start_index = incubator.capacity as usize;
            let metaplex_metadata_accounts_end_index = (incubator.capacity as usize) + incubator.mints.len();
            let draggos_metadata_accounts_end_index = metaplex_metadata_accounts_end_index + incubator.mints.len();

            let metaplex_metadata_accounts_info = &remaining_accounts[metaplex_metadata_accounts_start_index..metaplex_metadata_accounts_end_index];
            let draggos_metadata_accounts_info = &remaining_accounts[metaplex_metadata_accounts_end_index..draggos_metadata_accounts_end_index];

            let metaplex_metadata_structs = metaplex_metadata_accounts_info.iter().map(|a| {
                let ac = Metadata::from_account_info(&a).unwrap();
                return ac;
            }).collect::<Vec<_>>();

            let draggos_metadata_accounts = draggos_metadata_accounts_info.iter().map(|a| {
                let ac: Account<'info, DraggosMetadata> = Account::try_from(a).unwrap();
                return ac;
            }).collect::<Vec<_>>();

            for slot in slot_accounts.iter() {
                let metaplex_metadata_account_slot = &metaplex_metadata_accounts_info[slot.index as usize];
                let draggos_metadata_account_slot = &draggos_metadata_accounts[slot.index as usize];

                if slot.mint != metaplex_metadata_account_slot.key()  {
                    return Err(ControllerError::InvalidSlotMint.into());
                }

                let mut hatch_accounts = HatchEgg {
                    incubator: incubator.clone(),
                    authority: ctx.accounts.authority.clone(),
                    update_authority: ctx.accounts.update_authority.clone(),
                    token_metadata_program: ctx.accounts.token_metadata_program.clone(),
                    draggos_metadata_account: draggos_metadata_account_slot.clone(),
                    metaplex_metadata_account: metaplex_metadata_account_slot.clone(),
                    slot: slot.clone()
                };

                let hatch_context = Context::new(ctx.program_id, &mut hatch_accounts, &[]);
                //hatch(hatch_context, metaplex_metadata_structs[slot.index as usize].clone(), update_authority_bump)?;
            }

            incubator.next_index = 0;
            incubator.mints = Vec::new();
            incubator.current_batch += 1;
        } else {
            let current_slot = slot_accounts.get(incubator.next_index as usize).unwrap();

            let update_slot_accounts = incubator::cpi::accounts::UpdateSlot {
                slot: current_slot.to_account_info().clone(),
                mint: mint.clone(),
                draggos_metadata_account: draggos_metadata_account.to_account_info().clone(),
                metaplex_metadata_account: metaplex_metadata_account.clone(),
                system_program: system_program.to_account_info().clone()
            };

            let update_slot_context = CpiContext::new(ctx.accounts.incubator_program.clone(), update_slot_accounts);
            incubator::cpi::update_slot(update_slot_context)?;

            incubator.next_index += 1;
        }

        Ok(())
    }
}



#[derive(Accounts)]
pub struct DepositEgg<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [
            b"incubator_v0".as_ref()
        ],
        bump = incubator.bump
    )]
    pub incubator: Account<'info, Incubator>,
    pub incubator_program: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [
            b"incubator_v0".as_ref(),
            b"metadata".as_ref(),
            mint.key().as_ref()
        ],
        bump = draggos_metadata_account.bump,
    )]
    pub draggos_metadata_account: Account<'info, DraggosMetadata>,
    pub metaplex_metadata_account: AccountInfo<'info>,
    pub mint: AccountInfo<'info>,
    #[account(
        seeds = [
            b"incubator_v0".as_ref(),
            b"update_authority".as_ref()
        ],
        bump = update_authority.bump,
    )]
    pub update_authority: Account<'info, UpdateAuthority>,
    #[account(
        constraint = token_account.owner == *authority.key,
        constraint = token_account.mint == mint.key()
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(address = spl_token_metadata::id())]
    pub token_metadata_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
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
    #[msg("This incubator is full")]
    IncubatorFull,
    #[msg("Invalid metadata account")]
    MetadataAccountNotFound,
    #[msg("Invalid draggos metadata account")]
    DraggosMetadataAccountNotFound,
    #[msg("Draggo has already hatched")]
    AlreadyHatched,
    #[msg("Invalid mint on slot")]
    InvalidSlotMint,
    #[msg("Invalid update authority")]
    InvalidUpdateAuthority
}