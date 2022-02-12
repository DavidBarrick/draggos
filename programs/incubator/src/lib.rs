use anchor_lang::prelude::*;
use solana_program::log::sol_log_compute_units;

use mpl_token_metadata::{
    instruction::{update_metadata_accounts_v2},
    state::{Metadata, DataV2},
};

use anchor_lang::solana_program::{
    self,
    pubkey::Pubkey,
};

use state::{ Incubator, UpdateAuthority, DraggosMetadata, Slot };

pub mod state;

declare_id!("2zmbDv3c8ni15u6LTt4mNDXu9NmQ6RfpgggpZ59DvP3T");

#[program]
pub mod incubator {
    use super::*;
 
    pub fn create_incubator(ctx: Context<CreateIncubator>, capacity: u8, bump: u8, update_authority_bump: u8) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let update_authority = &mut ctx.accounts.update_authority;

        incubator.bump = bump;
        incubator.capacity = capacity;
        incubator.authority = *ctx.accounts.authority.key;

        update_authority.bump = update_authority_bump;
        update_authority.authority = *ctx.accounts.authority.key;

        Ok(())
    }

    pub fn create_slot(ctx: Context<CreateSlot>, _incubator_bump: u8, slot_bump: u8, slot_index: u8) -> ProgramResult {
        let incubator = &ctx.accounts.incubator;
        let slot = &mut ctx.accounts.slot;
        let authority = &ctx.accounts.authority;

        if incubator.authority != authority.key() {
            return Err(IncubatorError::InvalidAuthority.into());
        }

        slot.bump = slot_bump;
        slot.authority = *ctx.accounts.authority.key;
        slot.incubator = incubator.key().clone();
        slot.index = slot_index;

        Ok(())
    }

    pub fn reset_incubator(ctx: Context<ResetIncubator>) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let slot1 = &mut ctx.accounts.slot1;
        let slot2 = &mut ctx.accounts.slot2;
        let slot3 = &mut ctx.accounts.slot3;
        let slot4 = &mut ctx.accounts.slot4;
        let dm1 = &mut ctx.accounts.dm1;
        let dm2 = &mut ctx.accounts.dm2;
        let dm3 = &mut ctx.accounts.dm3;
        let dm4 = &mut ctx.accounts.dm4;

        incubator.mints = Vec::new();
        incubator.next_index = 0;

        slot1.metaplex_metadata = None;
        slot1.draggos_metadata = None;
        slot1.insert_date = 0;

        slot2.metaplex_metadata = None;
        slot2.draggos_metadata = None;
        slot2.insert_date = 0;

        slot3.metaplex_metadata = None;
        slot3.draggos_metadata = None;
        slot3.insert_date = 0;

        slot4.metaplex_metadata = None;
        slot4.draggos_metadata = None;
        slot4.insert_date = 0;

        dm1.hatched = false;
        dm2.hatched = false;
        dm3.hatched = false;
        dm4.hatched = false;

        Ok(())
    }

    pub fn create_draggos_metadata(ctx: Context<CreateDraggosMetadata>, bump: u8, uri: String) -> ProgramResult {
        let draggos_metadata_account = &mut ctx.accounts.draggos_metadata_account;
        let mint = &ctx.accounts.mint;
        let authority = &ctx.accounts.authority;
        let incubator = &ctx.accounts.incubator;

        if incubator.authority != authority.key() {
            return Err(IncubatorError::InvalidAuthority.into());
        }

        draggos_metadata_account.bump = bump;
        draggos_metadata_account.uri = uri;
        draggos_metadata_account.authority = *ctx.accounts.authority.key;
        draggos_metadata_account.mint = mint.key().clone();

        Ok(())
    }

    pub fn deposit_incubator(ctx: Context<DepositIncubator>) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let slot = &mut ctx.accounts.slot;

        let draggos_metadata_account = &ctx.accounts.draggos_metadata_account;
        let metaplex_metadata_account = &ctx.accounts.metaplex_metadata_account;
        let mint = &ctx.accounts.mint;

        slot.mint = mint.key().clone();
        slot.draggos_metadata = Some(draggos_metadata_account.key().clone());
        slot.metaplex_metadata = Some(metaplex_metadata_account.key().clone());
        incubator.mints.push(mint.key().clone());

        Ok(())
    }

    pub fn hatch_incubator(ctx: Context<HatchIncubator>, update_authority_bump: u8, should_reset: bool) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let draggos_metadata_account = &mut ctx.accounts.draggos_metadata_account;
        let metaplex_metadata_account = &mut ctx.accounts.metaplex_metadata_account;
        let update_authority = &ctx.accounts.update_authority;
        let token_metadata_program = &ctx.accounts.token_metadata_program;
        let slot = &mut ctx.accounts.slot;

        if draggos_metadata_account.hatched {
            return Err(IncubatorError::AlreadyHatched.into());
        }
    
        // ~40 CUs
        let metadata = Metadata::from_account_info(&metaplex_metadata_account).unwrap();

        // ~200 CUs
        let hatched_data = DataV2 {
            name: metadata.data.name,
            symbol: metadata.data.symbol,
            uri: draggos_metadata_account.uri.clone(),
            seller_fee_basis_points: metadata.data.seller_fee_basis_points,
            creators: metadata.data.creators,
            collection: None,
            uses: None
        };

        /*emit!(MetadataUpdateEvent {
            uri: hatched_metadata_data.uri.clone()
        });*/

        // ~4k CUs
        let ix = update_metadata_accounts_v2(
            token_metadata_program.key().clone(),
            metaplex_metadata_account.key().clone(),
            update_authority.key().clone(),
            None,
            Some(hatched_data.clone()),
            None,
            None
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

        slot.metaplex_metadata = None;
        slot.draggos_metadata = None;

        if should_reset {
            incubator.mints = Vec::new();
            incubator.current_batch += 1;
        }
    
        Ok(())
    }
}

#[event]
pub struct MetadataUpdateEvent {
    #[index]
    pub uri: String,
}


#[derive(Accounts)]
#[instruction(capacity: u8, bump: u8, update_authority_bump: u8)]
pub struct CreateIncubator<'info> {
    #[account(
        init_if_needed,
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
    pub incubator: Box<Account<'info, Incubator>>,
    #[account(
        mut,
        seeds = [
            b"incubator_v0".as_ref(),
            b"slot".as_ref(),
            &[slot1.index]
        ],
        bump = slot1.bump,

    )]
    pub slot1: Box<Account<'info, Slot>>,
    #[account(
        mut,
        seeds = [
            b"incubator_v0".as_ref(),
            b"slot".as_ref(),
            &[slot2.index]
        ],
        bump = slot2.bump,
    )]
    pub slot2: Box<Account<'info, Slot>>,
    #[account(
        mut,
        seeds = [
            b"incubator_v0".as_ref(),
            b"slot".as_ref(),
            &[slot3.index]
        ],
        bump = slot3.bump,
    )]
    pub slot3: Box<Account<'info, Slot>>,
    #[account(
        mut,
        seeds = [
            b"incubator_v0".as_ref(),
            b"slot".as_ref(),
            &[slot4.index]
        ],
        bump = slot4.bump,
    )]
    pub slot4: Box<Account<'info, Slot>>,
    #[account(
        mut,
        seeds = [
            b"incubator_v0".as_ref(),
            b"metadata".as_ref(),
            dm1.mint.as_ref()
        ],
        bump = dm1.bump,
    )]
    pub dm1: Box<Account<'info, DraggosMetadata>>,
    #[account(
        mut,
        seeds = [
            b"incubator_v0".as_ref(),
            b"metadata".as_ref(),
            dm2.mint.as_ref()
        ],
        bump = dm2.bump,
    )]
    pub dm2: Box<Account<'info, DraggosMetadata>>,
    #[account(
        mut,
        seeds = [
            b"incubator_v0".as_ref(),
            b"metadata".as_ref(),
            dm3.mint.as_ref()
        ],
        bump = dm3.bump,
    )]
    pub dm3: Box<Account<'info, DraggosMetadata>>,
    #[account(
        mut,
        seeds = [
            b"incubator_v0".as_ref(),
            b"metadata".as_ref(),
            dm4.mint.as_ref()
        ],
        bump = dm4.bump,
    )]
    pub dm4: Box<Account<'info, DraggosMetadata>>,
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
        bump = incubator.bump,
    )]
    pub incubator: Account<'info, Incubator>,
    #[account(
        init_if_needed,
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
pub struct DepositIncubator<'info> {
    #[account(
        mut,
        seeds = [
            b"incubator_v0".as_ref()
        ],
        bump = incubator.bump
    )]
    pub incubator: Account<'info, Incubator>,
    #[account(
        seeds = [
            b"incubator_v0".as_ref(),
            b"metadata".as_ref(),
            mint.key().as_ref()
        ],
        bump = draggos_metadata_account.bump,
    )]
    pub draggos_metadata_account: Account<'info, DraggosMetadata>,
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
    pub metaplex_metadata_account: AccountInfo<'info>,
    pub mint: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(update_authority_bump: u8)]
pub struct HatchIncubator<'info> {
    #[account(
        seeds = [
            b"incubator_v0".as_ref()
        ],
        bump = incubator.bump
    )]
    pub incubator: Account<'info, Incubator>,
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
    #[account(address = mpl_token_metadata::id())]
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
        init_if_needed,
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
    InvalidUpdateAuthority,
    #[msg("Invalid authority")]
    InvalidAuthority
}