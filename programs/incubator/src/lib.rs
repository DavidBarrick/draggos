use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

use spl_token_metadata::{
    instruction::{update_metadata_accounts},
    state::{Metadata},
};

use anchor_lang::solana_program::{
    self,
    pubkey::Pubkey,
};

use state::{ Incubator, UpdateAuthority, DraggosMetadata, Slot };

pub mod state;

declare_id!("GJ285g95ZVgCKLhQUA6LYDzwqzQbgq3cR2GpsA5N1ChZ");

#[program]
pub mod incubator {
    use super::*;
 
    pub fn create_incubator(ctx: Context<CreateIncubator>, capacity: u8, bump: u8, update_authority_bump: u8) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let update_authority = &mut ctx.accounts.update_authority;

        incubator.bump = bump;
        incubator.capacity = capacity;
        incubator.authority = *ctx.accounts.authority.key;
        incubator.next_index = 0;

        update_authority.bump = update_authority_bump;
        update_authority.authority = *ctx.accounts.authority.key;

        Ok(())
    }

    pub fn create_slot(ctx: Context<CreateSlot>, _incubator_bump: u8, slot_bump: u8, slot_index: u8) -> ProgramResult {
        let incubator = &ctx.accounts.incubator;
        let slot = &mut ctx.accounts.slot;

        slot.bump = slot_bump;
        slot.authority = *ctx.accounts.authority.key;
        slot.incubator = incubator.key().clone();
        slot.index = slot_index;

        Ok(())
    }

    pub fn reset_incubator(ctx: Context<ResetIncubator>) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;

        incubator.mints = Vec::new();
        incubator.next_index = 0;

        Ok(())
    }

    pub fn create_draggos_metadata(ctx: Context<CreateDraggosMetadata>, bump: u8, uri: String) -> ProgramResult {
        let draggos_metadata_account = &mut ctx.accounts.draggos_metadata_account;
        let mint = &ctx.accounts.mint;

        draggos_metadata_account.bump = bump;
        draggos_metadata_account.uri = uri;
        draggos_metadata_account.authority = *ctx.accounts.authority.key;
        draggos_metadata_account.mint = mint.key().clone();

        Ok(())
    }

    pub fn deposit<'a, 'b, 'c, 'info>(ctx: Context<'a, 'b, 'c, 'info, DepositEgg<'info>>, update_authority_bump: u8) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let draggos_metadata_account = &mut ctx.accounts.draggos_metadata_account;
        let metaplex_metadata_account = &ctx.accounts.metaplex_metadata_account;
        let remaining_accounts = ctx.remaining_accounts;
        let mint = &ctx.accounts.mint;
        let update_authority = &ctx.accounts.update_authority;

        let depositor_metaplex_metadata = Metadata::from_account_info(metaplex_metadata_account).unwrap();

        if draggos_metadata_account.hatched {
            return Err(IncubatorError::AlreadyHatched.into());
        } else if depositor_metaplex_metadata.update_authority != update_authority.key() {
            return Err(IncubatorError::InvalidUpdateAuthority.into());
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

                if slot.mint.unwrap() != metaplex_metadata_account_slot.key()  {
                    return Err(IncubatorError::InvalidSlotMint.into());
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
                hatch(hatch_context, metaplex_metadata_structs[slot.index as usize].clone(), update_authority_bump)?;
            }

            incubator.next_index = 0;
            incubator.mints = Vec::new();
            incubator.current_batch += 1;
        } else {
            let current_slot = ctx.remaining_accounts.get(incubator.next_index as usize).unwrap();
            let mut slot: Account<'info, Slot> = Account::try_from(current_slot).unwrap();

            slot.mint = Some(mint.key().clone());
            slot.draggos_metadata = Some(draggos_metadata_account.key().clone());
            slot.metaplex_metadata = Some(metaplex_metadata_account.key().clone());

            incubator.next_index += 1;
        }

        Ok(())
    }
}

fn hatch(ctx: Context<HatchEgg>, metadata: Metadata, update_authority_bump: u8) -> ProgramResult {
    let incubator = &ctx.accounts.incubator;
    let draggos_metadata_account = &mut ctx.accounts.draggos_metadata_account;
    let metaplex_metadata_account = &mut ctx.accounts.metaplex_metadata_account;
    let update_authority = &ctx.accounts.update_authority;
    let token_metadata_program = &ctx.accounts.token_metadata_program;
    let slot = &mut ctx.accounts.slot;

    if draggos_metadata_account.hatched {
        return Err(IncubatorError::AlreadyHatched.into());
    }

    let hatched_metadata_data = &mut metadata.data.clone();
    hatched_metadata_data.uri = draggos_metadata_account.uri.clone();

    let ix = update_metadata_accounts(
        token_metadata_program.key().clone(),
        metaplex_metadata_account.key().clone(),
        update_authority.key().clone(),
        None,
        Some(hatched_metadata_data.clone()),
        None,
    );
    
    let authority_seeds = &[&b"incubator_v0"[..], &b"update_authority"[..], &[update_authority_bump]];
    solana_program::program::invoke_signed(
        &ix,
        &[metaplex_metadata_account.to_account_info(), update_authority.to_account_info()],
        &[&authority_seeds[..]],
    )?;

    draggos_metadata_account.hatched = true;
    draggos_metadata_account.hatched_date = Clock::get().unwrap().unix_timestamp;
    draggos_metadata_account.hatched_batch = incubator.current_batch;

    slot.mint = None;
    slot.metaplex_metadata = None;
    slot.draggos_metadata = None;

    Ok(())
}

#[derive(Accounts)]
#[instruction(capacity: u8, bump: u8, update_authority_bump: u8)]
pub struct CreateIncubator<'info> {
    #[account(
        init,
        seeds = [
            b"incubator_v0".as_ref()
        ],
        bump = bump,
        payer = authority,
        space = 10000,
    )]
    pub incubator: Account<'info, Incubator>,
    #[account(
        init,
        seeds = [
            b"incubator_v0".as_ref(),
            b"update_authority".as_ref()
        ],
        bump = update_authority_bump,
        payer = authority,
        space = 1000,
    )]
    pub update_authority: Account<'info, UpdateAuthority>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResetIncubator<'info> {
    #[account(
        mut,
        seeds = [
            b"incubator_v0".as_ref()
        ],
        bump = incubator.bump,
        constraint = incubator.authority == *authority.key
    )]
    pub incubator: Account<'info, Incubator>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(incubator_bump: u8, slot_bump: u8, slot_index: u8)]
pub struct CreateSlot<'info> {
    #[account(
        seeds = [
            b"incubator_v0".as_ref()
        ],
        bump = incubator_bump,
    )]
    pub incubator: Account<'info, Incubator>,
    #[account(
        init,
        seeds = [
            b"incubator_v0".as_ref(),
            b"slot".as_ref(),
            &[slot_index]
        ],
        bump = slot_bump,
        payer = authority,
        space = 500,
    )]
    pub slot: Account<'info, Slot>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
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

#[derive(Accounts)]
#[instruction(draggos_metadata_bump: u8, uri: String)]
pub struct CreateDraggosMetadata<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [
            b"incubator_v0".as_ref()
        ],
        bump = incubator.bump
    )]
    pub incubator: Account<'info, Incubator>,
    #[account(
        init,
        seeds = [
            b"incubator_v0".as_ref(),
            b"metadata".as_ref(),
            &mint.key.to_bytes()
        ],
        bump = draggos_metadata_bump,
        payer = authority,
        space = 1000
    )]
    pub draggos_metadata_account: Account<'info, DraggosMetadata>,
    pub mint: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}


#[error]
pub enum IncubatorError {
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