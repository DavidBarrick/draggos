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

use state::{ Incubator, UpdateAuthority, DraggosMetadata };

pub mod state;

declare_id!("HaqhGG52nEhqX2B7gbQhw239pB5ZHiLr8tNP7qrPnYES");

#[program]
pub mod incubator {
    use super::*;
 
    pub fn initialize(ctx: Context<Initialize>, capacity: u8, bump: u8, update_authority_bump: u8) -> ProgramResult {
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

    pub fn create_metadata_account(ctx: Context<CreateDraggosMetadata>, bump: u8, uri: String) -> ProgramResult {
        let draggos_metadata_account = &mut ctx.accounts.draggos_metadata_account;
        draggos_metadata_account.bump = bump;
        draggos_metadata_account.uri = uri;

        Ok(())
    }

    pub fn deposit(ctx: Context<DepositEgg>) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let draggos_metadata_account = &mut ctx.accounts.draggos_metadata_account;

        if draggos_metadata_account.hatched {
            return Err(IncubatorError::AlreadyHatched.into());
        }

        incubator.mints.push(*ctx.accounts.mint.to_account_info().key);

        incubator.next_index += 1;

        Ok(())
    }

    pub fn hatch(ctx: Context<HatchEgg>, _draggos_metadata_bump: u8, update_authority_bump: u8, should_reset: bool) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let draggos_metadata_account = &mut ctx.accounts.draggos_metadata_account;

        if draggos_metadata_account.hatched {
            return Err(IncubatorError::AlreadyHatched.into());
        }

        draggos_metadata_account.hatched = true;
        draggos_metadata_account.hatched_date = Clock::get().unwrap().unix_timestamp;
        draggos_metadata_account.hatched_batch = 5;

        let metdata_account = Metadata::from_account_info(&ctx.accounts.metadata)?;
        
        let hatched_metadata_data = &mut metdata_account.data.clone();
        hatched_metadata_data.uri = draggos_metadata_account.uri.clone();

        let ix = update_metadata_accounts(
            ctx.accounts.token_metadata_program.key(),
            ctx.accounts.metadata.key(),
            ctx.accounts.update_authority.key(),
            None,
            Some(hatched_metadata_data.clone()),
            None,
        );
        
        let authority_seeds = &[&b"incubator_v0"[..], &b"update_authority"[..], &[update_authority_bump]];
        solana_program::program::invoke_signed(
            &ix,
            &[ctx.accounts.metadata.to_account_info(), ctx.accounts.update_authority.to_account_info()],
            &[&authority_seeds[..]],
        )?;

        if should_reset {
            incubator.next_index = 0;
            incubator.mints = Vec::new();
        }

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(draggos_metadata_bump: u8, update_authority_bump: u8)]
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
        bump = draggos_metadata_bump,
    )]
    pub draggos_metadata_account: Account<'info, DraggosMetadata>,
    pub mint: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(draggos_metadata_bump: u8, update_authority_bump: u8)]
pub struct HatchEgg<'info> {
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
        bump = draggos_metadata_bump,
    )]
    pub draggos_metadata_account: Account<'info, DraggosMetadata>,
    #[account(mut)]
    pub metadata: AccountInfo<'info>,
    pub mint: AccountInfo<'info>,
    #[account(
        seeds = [
            b"incubator_v0".as_ref(),
            b"update_authority".as_ref()
        ],
        bump = update_authority_bump,
    )]
    pub update_authority: Account<'info, UpdateAuthority>,
    #[account(address = spl_token_metadata::id())]
    pub token_metadata_program: AccountInfo<'info>,
    #[account(
        constraint = token_account.owner == *authority.key,
        constraint = token_account.mint == mint.key()
    )]
    pub token_account: Account<'info, TokenAccount>,
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

#[derive(Accounts)]
#[instruction(capacity: u8, bump: u8, update_authority_bump: u8)]
pub struct Initialize<'info> {
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

#[error]
pub enum IncubatorError {
    #[msg("This incubator is full")]
    IncubatorFull,
    #[msg("Invalid metadata account")]
    MetadataAccountNotFound,
    #[msg("Invalid draggos metadata account")]
    DraggosMetadataAccountNotFound,
    #[msg("Draggo has already hatched")]
    AlreadyHatched
}