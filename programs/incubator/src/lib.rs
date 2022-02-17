use anchor_lang::prelude::*;

use mpl_token_metadata::{
    instruction::{update_metadata_accounts_v2},
    state::{Metadata, DataV2},
};

use anchor_lang::solana_program::{
    self,
    pubkey::Pubkey,
};

use state::{ Incubator, UpdateAuthority, DraggosMetadata, Slot, IncubatorError, DepositAuthority };

pub mod state;

declare_id!("2zmbDv3c8ni15u6LTt4mNDXu9NmQ6RfpgggpZ59DvP3T");

#[program]
pub mod incubator {
    use super::*;
 
    pub fn create_incubator(ctx: Context<CreateIncubator>) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let update_authority = &mut ctx.accounts.update_authority;
        let deposit_authority = &ctx.accounts.deposit_authority;
        let controller_program = &ctx.accounts.controller_program;

        let (deposit_authority_pda, _) = Pubkey::find_program_address(&[b"incubator_v0".as_ref(), b"deposit_authority".as_ref()], &controller_program.key());

        if deposit_authority_pda != deposit_authority.key() {
            return Err(IncubatorError::InvalidDepositAuthority.into());
        }

        incubator.bump = *ctx.bumps.get("incubator").unwrap();
        incubator.authority = *ctx.accounts.authority.key;
        incubator.deposit_authority = ctx.accounts.deposit_authority.key().clone();

        update_authority.bump = *ctx.bumps.get("update_authority").unwrap();
        update_authority.authority = *ctx.accounts.authority.key;

        Ok(())
    }

    pub fn create_slot(ctx: Context<CreateSlot>, index: u8) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let slot = &mut ctx.accounts.slot;
        let authority = &ctx.accounts.authority;
        let next_index = incubator.slots.len() as u8;

        if incubator.authority != authority.key() {
            return Err(IncubatorError::InvalidAuthority.into());
        } else if index != next_index {
            return Err(IncubatorError::InvalidSlotIndex.into());
        }

        incubator.slots.push(slot.key().clone());

        slot.bump = *ctx.bumps.get("slot").unwrap();
        slot.authority = *ctx.accounts.authority.key;
        slot.incubator = incubator.key().clone();
        slot.index = next_index;

        Ok(())
    }

    pub fn reset_incubator(ctx: Context<ResetIncubator>) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let authority = &ctx.accounts.authority;
        let slot1 = &mut ctx.accounts.slot1;
        let slot2 = &mut ctx.accounts.slot2;
        let slot3 = &mut ctx.accounts.slot3;
        let slot4 = &mut ctx.accounts.slot4;

        if incubator.authority != authority.key() {
            return Err(IncubatorError::InvalidAuthority.into());
        }

        incubator.mints = Vec::new();

        Ok(())
    }

    pub fn create_draggos_metadata(ctx: Context<CreateDraggosMetadata>, uri: String) -> ProgramResult {
        let draggos_metadata_account = &mut ctx.accounts.draggos_metadata_account;
        let mint = &ctx.accounts.mint;
        let authority = &ctx.accounts.authority;
        let incubator = &ctx.accounts.incubator;

        if incubator.authority != authority.key() {
            return Err(IncubatorError::InvalidAuthority.into());
        }

        draggos_metadata_account.bump = *ctx.bumps.get("draggos_metadata_account").unwrap();
        draggos_metadata_account.uri = uri;
        draggos_metadata_account.authority = *ctx.accounts.authority.key;
        draggos_metadata_account.mint = mint.key().clone();

        Ok(())
    }

    pub fn deposit_incubator(ctx: Context<DepositIncubator>) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let slot = &mut ctx.accounts.slot;
        let mint = &ctx.accounts.mint;
        let authority = &ctx.accounts.authority;

        if authority.key() != incubator.deposit_authority {
            return Err(IncubatorError::InvalidDepositAuthority.into());
        }

        slot.mint = Some(mint.key().clone());
        incubator.mints.push(mint.key().clone());

        emit!(DepositEvent {
            mint: mint.key().clone(),
            date: Clock::get().unwrap().unix_timestamp
        });

        Ok(())
    }

    pub fn hatch_incubator(ctx: Context<HatchIncubator>) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let draggos_metadata_account = &mut ctx.accounts.draggos_metadata_account;
        let metaplex_metadata_account = &mut ctx.accounts.metaplex_metadata_account;
        let update_authority = &ctx.accounts.update_authority;
        let token_metadata_program = &ctx.accounts.token_metadata_program;
        let slot = &mut ctx.accounts.slot;
        let authority = &ctx.accounts.authority;

        if draggos_metadata_account.hatched {
            return Err(IncubatorError::AlreadyHatched.into());
        }
        
        let hatched_date = Clock::get().unwrap().unix_timestamp;
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

        let authority_seeds = &[&b"incubator_v0"[..], &b"update_authority"[..], &[update_authority.bump]];
        solana_program::program::invoke_signed(
            &ix,
            &[metaplex_metadata_account.to_account_info(), update_authority.to_account_info()],
            &[&authority_seeds[..]],
        )?;

        draggos_metadata_account.hatched = true;
        draggos_metadata_account.hatched_date = hatched_date;
        draggos_metadata_account.hatched_batch = incubator.current_batch;

        emit!(HatchEvent{
            mint: slot.mint.unwrap().clone(),
            date: hatched_date,
            batch: incubator.current_batch
        });

        slot.mint = None;
    
        Ok(())
    }
}

#[event]
pub struct DepositEvent {
    #[index]
    pub mint: Pubkey,
    pub date: i64
}

#[event]
pub struct HatchEvent {
    #[index]
    pub mint: Pubkey,
    pub date: i64,
    pub batch: u16
}

// Asserts the IDO starts in the future.
fn deposit_auth(ctx: &Context<DepositIncubator>) -> ProgramResult {
    if ctx.accounts.incubator.deposit_authority != ctx.accounts.authority.key() {
        return Err(IncubatorError::InvalidDepositAuthority.into());
    }

    Ok(())
}

#[derive(Accounts)]
pub struct CreateIncubator<'info> {
    #[account(
        init,
        seeds = [
            b"incubator_v0".as_ref()
        ],
        bump,
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
        bump,
        payer = authority,
        space = 1000,
    )]
    pub update_authority: Account<'info, UpdateAuthority>,
    pub deposit_authority: AccountInfo<'info>,
    pub controller_program: AccountInfo<'info>,
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
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(slot_index: u8)]
pub struct CreateSlot<'info> {
    #[account(
        mut,
        seeds = [
            b"incubator_v0".as_ref()
        ],
        bump = incubator.bump,
    )]
    pub incubator: Account<'info, Incubator>,
    #[account(
        init,
        seeds = [
            b"incubator_v0".as_ref(),
            b"slot".as_ref(),
            &[slot_index]
        ],
        bump,
        payer = authority,
        space = 500,
    )]
    pub slot: Account<'info, Slot>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositIncubator<'info> {
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
#[instruction(uri: String)]
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
        bump,
        payer = authority,
        space = 1000
    )]
    pub draggos_metadata_account: Account<'info, DraggosMetadata>,
    pub mint: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}
