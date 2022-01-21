use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, SetAuthority, TokenAccount, Transfer};

declare_id!("6nc6StbnJGQYZaCtJPtsJd7fvuFfJyXdLitpoufY6V86");
pub const METAPLEX_PROGRAM_ID: &'static str = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

#[program]
pub mod incubator {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, capacity: u8, bump: u8) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        incubator.bump = bump;
        incubator.capacity = capacity;
        incubator.eggs = Vec::new();
        incubator.authority = *ctx.accounts.authority.key;
        //incubator.owner = ctx.accounts.owner.to_account_info().key();
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, metadata_account_bump: u8, draggos_metadata_account_bump: u8) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        //let draggos_metadata_account = &mut ctx.accounts.draggos_metadata_account;
        //draggos_metadata_account.bump = draggos_metadata_account_bump;

        /*if draggos_metadata_account.hatched {
            return Err(IncubatorError::AlreadyHatched.into());
        }*/


        if incubator.eggs.len() >= incubator.capacity as usize {
            // error
            return Err(IncubatorError::IncubatorFull.into());
        } else if incubator.eggs.len() == (incubator.capacity - 1) as usize {
            //hatch eggs    
            //reset counter
            for egg in incubator.eggs.iter() {
                //draggos_metadata_account.hatched = true;
            }

            //incubator.eggs = Vec::new();
        } else {
            //deposit egg
            let egg = Egg {
                owner: *ctx.accounts.authority.to_account_info().key,
                //mint_account: ctx.accounts.mint_account.key().clone(),
                metadata_account: *ctx.accounts.metadata_account.to_account_info().key,
                //draggos_metadata_account: ctx.accounts.draggos_metadata_account.key().clone()
            };

            incubator.eggs.push(egg);
        }

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(bumps: Vec<u8>, addresses: Vec<Pubkey>)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [
            b"incubator_v0".as_ref()
        ],
        bump = incubator.bump
    )]
    pub incubator: Account<'info, Incubator>,
    pub authority: Signer<'info>,
    //pub token_account: Account<'info, TokenAccount>,
    pub metadata_account: AccountInfo<'info>,
    pub draggos_metadata_account_0: Account<'info, DraggosMetadata>,
    pub draggos_metadata_account_1: Account<'info, DraggosMetadata>,
    pub draggos_metadata_account_2: Account<'info, DraggosMetadata>,
    pub draggos_metadata_account_3: Account<'info, DraggosMetadata>,
    pub draggos_metadata_account_4: Account<'info, DraggosMetadata>,
    pub draggos_metadata_account_5: Account<'info, DraggosMetadata>,
    pub draggos_metadata_account_6: Account<'info, DraggosMetadata>,
    pub draggos_metadata_account_7: Account<'info, DraggosMetadata>,
    pub draggos_metadata_account_8: Account<'info, DraggosMetadata>,
    pub draggos_metadata_account_9: Account<'info, DraggosMetadata>,

    //pub mint_account: Account<'info, Mint>,
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

#[derive(Accounts)]
#[instruction(index: u8, bump: u8)]
pub struct InitializeMetadata<'info> {
    #[account(
        init,
        seeds = [
            b"incubator_v0".as_ref(),
            &[index]
        ],
        bump = bump,
        payer = authority,
        space = 10000,
    )]
    pub metadata: Account<'info, DraggosMetadata>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Incubator {
    pub authority: Pubkey,
    pub next_index: u8,
    pub capacity: u8,
    pub eggs: Vec<Egg>,
    pub bump: u8,
    pub current_batch: u16
}

#[account(zero)]
pub struct DraggosMetadata {
    pub owner: Pubkey,
    pub hatched: bool,
    pub hatch_date: u64,
    pub hatch_batch: u64,
    pub bump: u8
}

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
    pub metadata_account: Pubkey,
    //pub draggos_metadata_account: Pubkey,
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