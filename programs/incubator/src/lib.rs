use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, SetAuthority, TokenAccount, Transfer};
use controller::program::Controller;

declare_id!("6nc6StbnJGQYZaCtJPtsJd7fvuFfJyXdLitpoufY6V86");
pub const METAPLEX_PROGRAM_ID: &'static str = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

#[program]
pub mod incubator {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, capacity: u8, bump: u8) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        incubator.bump = bump;
        incubator.capacity = capacity;
        incubator.authority = *ctx.accounts.authority.key;
        incubator.next_index = 0;
        Ok(())
    }

    pub fn create_metadata_account(ctx: Context<CreateDraggosMetadata>, bump: u8, uri: String) -> ProgramResult {
        let draggos_metadata_account = &mut ctx.accounts.draggos_metadata_account;
        draggos_metadata_account.bump = bump;
        draggos_metadata_account.uri = uri;

        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, draggos_metadata_account_bump: u8) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        let draggos_metadata_account = &mut ctx.accounts.draggos_metadata_account;

        if draggos_metadata_account.hatched {
            return Err(IncubatorError::AlreadyHatched.into());
        }

        incubator.next_index += 1;
        draggos_metadata_account.hatched = true;
        draggos_metadata_account.hatch_date = Clock::get().unwrap().unix_timestamp;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(draggos_metadata_account_bump: u8)]
pub struct Deposit<'info> {
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
            b"metadata".as_ref()
        ],
        bump = draggos_metadata_account_bump,
        payer = authority,
        space = 1000
    )]
    pub draggos_metadata_account: Account<'info, DraggosMetadata>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(draggos_metadata_account_bump: u8)]
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
            b"metadata".as_ref()
        ],
        bump = draggos_metadata_account_bump,
        payer = authority,
        space = 1000
    )]
    pub draggos_metadata_account: Account<'info, DraggosMetadata>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(capacity: u8, bump: u8)]
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
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Incubator {
    pub authority: Pubkey,
    pub next_index: u8,
    pub capacity: u8,
    pub bump: u8,
    pub current_batch: u16
}

#[account]
pub struct DraggosMetadata {
    pub mint: Pubkey,
    pub hatched: bool,
    pub hatch_date: i64,
    pub hatch_batch: u64,
    pub bump: u8,
    pub uri: String
}


/* 
#[account]
pub struct Metadata {
    pub key: Pubkey,
    pub update_authority: Pubkey,
    pub mint: Pubkey,
    pub data: Data,
    pub primary_sale_happened: bool,
    pub is_mutable: bool,
    pub edition_nonce: Option<u8>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Egg {
    pub owner: Pubkey,
    //pub metadata_account: Metadata,
    pub draggos_metadata_account: Pubkey,
    //pub mint_account: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Data {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub seller_fee_basis_points: u16,
    pub creators: Option<Vec<Creator>>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Creator {
    pub address: Pubkey,
    pub verified: bool,
    // In percentages, NOT basis points ;) Watch out!
    pub share: u8,
}

impl<'info> Deposit<'info> {
    fn into_hatch(
        &self,
        index: usize
    ) -> CpiContext<'_, '_, '_, 'info, controller::cpi::accounts::Hatch<'info>> {
        let program = self.controller_program.clone();
        let accounts = controller::cpi::accounts::Hatch {
            token_program: self.controller_program.to_account_info(),
            metadata_account: self.controller_program.to_account_info(),
            draggos_metadata_account: self.controller_program.to_account_info()
        };
        CpiContext::new(program.to_account_info(), accounts)
    }
}
*/
#[error]
pub enum IncubatorError {
    #[msg("This list is full")]
    IncubatorFull,
    #[msg("Invalid metadata account")]
    MetadataAccountNotFound,
    #[msg("Invalid draggos metadata account")]
    DraggosMetadataAccountNotFound,
    #[msg("Draggo has already hatched")]
    AlreadyHatched
}