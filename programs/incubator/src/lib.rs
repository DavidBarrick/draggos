use anchor_lang::prelude::*;

use mpl_token_metadata::{
    instruction::{ 
        update_metadata_accounts_v2 
    },
    state::{ 
        Metadata, 
        DataV2 
    }
};

use anchor_lang::solana_program::{
    self,
    pubkey::Pubkey
};

pub mod state;
use state::{ 
    Incubator, 
    UpdateAuthority, 
    DraggosMetadata, 
    Slot, 
    IncubatorError, 
    IncubatorState 
};

declare_id!("99S2c1t1rWiRN2sw8zEtyuwtbToqj7pZ9zuDha1N83o3");

#[program]
pub mod incubator {
    use super::*;
 
    pub fn create_incubator(ctx: Context<CreateIncubator>) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let update_authority = &mut ctx.accounts.update_authority;
        let deposit_authority = &ctx.accounts.deposit_authority;
        let controller_program = &ctx.accounts.controller_program;

        let (deposit_authority_pda, _) = Pubkey::find_program_address(&[b"incubator_v0".as_ref(), b"deposit_authority".as_ref()], &controller_program.key());

        //Check to make sure the deposit_authority we passed in is the PDA our controller program owns
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

    //Safely reset incubator to receive new deposits
    pub fn reset_incubator<'a, 'b, 'c, 'info>(ctx: Context<'a, 'b, 'c, 'info, ResetIncubator<'info>>) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let authority = &ctx.accounts.authority;

        let capacity = incubator.slots.len();
        let slot_account_infos = &ctx.remaining_accounts[..capacity];

        let slot_accounts = slot_account_infos.iter().map(|a| {
            let slot: Account<'info, Slot> = Account::try_from(a).unwrap();
            slot
        }).collect::<Vec<_>>();

        if incubator.authority != authority.key() {
            return Err(IncubatorError::InvalidAuthority.into());
        } else if incubator.state != IncubatorState::Hatching {
            return Err(IncubatorError::InvalidIncubatorState.into());
        } else if incubator.slots.len() != slot_accounts.len() {
            return Err(IncubatorError::InvalidSlotCountForReset.into());
        }

        let unhatched_slot = slot_accounts.iter().find(|&x| !x.mint.is_none());
        if !unhatched_slot.is_none() {
            return Err(IncubatorError::InvalidResetUnhatchedSlots.into());
        }

        incubator.mints = Vec::new();
        incubator.current_batch += 1;
        incubator.state = IncubatorState::Available;

        Ok(())
    }

    // Just in case we need to pause incubator deposits to fix any issues
    pub fn update_incubator_state(ctx: Context<UpdateIncubatorState>, state: IncubatorState) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let authority = &ctx.accounts.authority;

        if incubator.authority != authority.key() {
            return Err(IncubatorError::InvalidAuthority.into());
        }

        incubator.state = state;

        Ok(())
    }

    //Just in case shit hits the fan, provide a way to update our update_authority from the current PDA to a new PDA
    pub fn update_metadata_update_authority(ctx: Context<UpdateMetadataUpdateAuthority>) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let authority = &ctx.accounts.authority;
        let current_update_authority = &ctx.accounts.current_update_authority;
        let new_update_authority = &ctx.accounts.new_update_authority;
        let token_metadata = &mut ctx.accounts.token_metadata;
        let token_metadata_program = &ctx.accounts.token_metadata_program;

        if incubator.authority != authority.key() {
            return Err(IncubatorError::InvalidAuthority.into());
        }

        // ~4k CUs
        let ix = update_metadata_accounts_v2(
            token_metadata_program.key().clone(),
            token_metadata.key().clone(),
            current_update_authority.key().clone(),
            Some(new_update_authority.key().clone()),
            None,
            None,
            None
        );

        let authority_seeds = &[&b"incubator_v0"[..], &b"update_authority"[..], &[current_update_authority.bump]];
        solana_program::program::invoke_signed(
            &ix,
            &[token_metadata.to_account_info(), current_update_authority.to_account_info()],
            &[&authority_seeds[..]],
        )?;

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
        slot.authority = ctx.accounts.authority.key().clone();
        slot.incubator = incubator.key().clone();
        slot.index = next_index;

        Ok(())
    }

    pub fn create_draggos_metadata(ctx: Context<CreateDraggosMetadata>, uri: String) -> ProgramResult {
        let incubator = &ctx.accounts.incubator;
        let draggos_metadata_account = &mut ctx.accounts.draggos_metadata_account;
        let mint = &ctx.accounts.mint;
        let authority = &ctx.accounts.authority;

        if incubator.authority != authority.key() {
            return Err(IncubatorError::InvalidAuthority.into());
        }

        draggos_metadata_account.bump = *ctx.bumps.get("draggos_metadata_account").unwrap();
        draggos_metadata_account.uri = uri;
        draggos_metadata_account.authority = ctx.accounts.authority.key().clone();
        draggos_metadata_account.mint = mint.key().clone();

        Ok(())
    }

    pub fn deposit_incubator(ctx: Context<DepositIncubator>) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let slot = &mut ctx.accounts.slot;
        let mint = &ctx.accounts.mint;
        let authority = &ctx.accounts.authority;

        if incubator.deposit_authority != authority.key() {
            return Err(IncubatorError::InvalidDepositAuthority.into());
        } else if incubator.mints.len() >= incubator.slots.len() {
            return Err(IncubatorError::IncubatorFull.into());
        } else if incubator.state != IncubatorState::Available {
            return Err(IncubatorError::InvalidIncubatorState.into());
        } else if incubator.mints.contains(&mint.key()) {
            return Err(IncubatorError::InIncubator.into());
        }

        slot.mint = Some(mint.key().clone());
        incubator.mints.push(mint.key().clone());

        if incubator.mints.len() == incubator.slots.len() {
            incubator.state = IncubatorState::Hatching;
        }

        emit!(DepositEvent {
            mint: mint.key().clone(),
            date: Clock::get().unwrap().unix_timestamp
        });

        Ok(())
    }

    pub fn hatch_incubator(ctx: Context<HatchIncubator>) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let draggos_metadata = &mut ctx.accounts.draggos_metadata;
        let token_metadata = &mut ctx.accounts.token_metadata;
        let update_authority = &ctx.accounts.update_authority;
        let token_metadata_program = &ctx.accounts.token_metadata_program;
        let slot = &mut ctx.accounts.slot;
        let authority = &ctx.accounts.authority;

        if draggos_metadata.hatched {
            return Err(IncubatorError::AlreadyHatched.into());
        } else if incubator.authority != authority.key() {
            return Err(IncubatorError::InvalidHatchAuthority.into());
        } else if slot.mint.is_none() {
            return Err(IncubatorError::InvalidSlotMint.into());
        } else if draggos_metadata.mint != slot.mint.unwrap() {
            return Err(IncubatorError::InvalidSlotDraggosMetadata.into());
        }
        
        let hatched_date = Clock::get().unwrap().unix_timestamp;
        let metadata = Metadata::from_account_info(&token_metadata).unwrap();

        // ~200 CUs
        let hatched_data = DataV2 {
            name: metadata.data.name,
            symbol: metadata.data.symbol,
            uri: draggos_metadata.uri.clone(),
            seller_fee_basis_points: metadata.data.seller_fee_basis_points,
            creators: metadata.data.creators,
            collection: None,
            uses: None
        };

        // ~4k CUs
        let ix = update_metadata_accounts_v2(
            token_metadata_program.key().clone(),
            token_metadata.key().clone(),
            update_authority.key().clone(),
            None,
            Some(hatched_data.clone()),
            None,
            None
        );

        let authority_seeds = &[&b"incubator_v0"[..], &b"update_authority"[..], &[update_authority.bump]];
        let signer_seeds = &[&authority_seeds[..]];
        solana_program::program::invoke_signed(
            &ix,
            &[token_metadata.to_account_info(), update_authority.to_account_info()],
            signer_seeds,
        )?;

        draggos_metadata.hatched = true;
        draggos_metadata.hatched_date = hatched_date;
        draggos_metadata.hatched_batch = incubator.current_batch;

        emit!(HatchEvent{
            mint: slot.mint.unwrap().clone(),
            date: hatched_date,
            batch: incubator.current_batch
        });

        //Reset the slot
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

#[derive(Accounts)]
pub struct CreateIncubator<'info> {
    #[account(
        init,
        seeds = [
            b"incubator_v0".as_ref()
        ],
        bump,
        payer = authority,
        //Supports up to 100 slots & mints (6400 bytes) + accessories + safety buffer
        space = 7000,
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
        space = 100, //32 + 1 + safety buffer
    )]
    pub update_authority: Account<'info, UpdateAuthority>,
    //Address verified in function, would love to import from controller program but would cause circular dep
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
    pub incubator: Account<'info, Incubator>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateIncubatorState<'info> {
    #[account(
        mut,
        seeds = [
            b"incubator_v0".as_ref()
        ],
        bump = incubator.bump,
    )]
    pub incubator: Account<'info, Incubator>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateMetadataUpdateAuthority<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [
            b"incubator_v0".as_ref()
        ],
        bump = incubator.bump,
        constraint = incubator.authority == *authority.key
    )]
    pub incubator: Account<'info, Incubator>,
    pub current_update_authority: Account<'info, UpdateAuthority>,
    pub new_update_authority: Account<'info, UpdateAuthority>,
    #[account(mut)]
    pub token_metadata: AccountInfo<'info>,
    #[account(address = mpl_token_metadata::id())]
    pub token_metadata_program: AccountInfo<'info>
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
pub struct CreateDraggosMetadata<'info> {
    pub authority: Signer<'info>,
    #[account(
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
        space = 500
    )]
    pub draggos_metadata_account: Account<'info, DraggosMetadata>,
    pub mint: AccountInfo<'info>,
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
        bump = draggos_metadata.bump,
    )]
    pub draggos_metadata: Account<'info, DraggosMetadata>,
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
    pub token_metadata: AccountInfo<'info>,
    pub mint: AccountInfo<'info>,
}

#[derive(Accounts)]
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
    pub draggos_metadata: Account<'info, DraggosMetadata>,
    #[account(
        mut
    )]
    pub token_metadata: AccountInfo<'info>,
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

