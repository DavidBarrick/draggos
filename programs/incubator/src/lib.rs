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
        incubator.eggs = Vec::new();
        incubator.authority = *ctx.accounts.authority.key;

        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, _metadata_account_bump: u8, draggos_metadata_account_bump: u8) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator.clone();
        let draggos_metadata_account = &mut ctx.accounts.draggos_metadata_account;
        draggos_metadata_account.bump = draggos_metadata_account_bump;

        if draggos_metadata_account.hatched {
            return Err(IncubatorError::AlreadyHatched.into());
        }

        if incubator.eggs.len() >= incubator.capacity as usize {
            return Err(IncubatorError::IncubatorFull.into());
        } else {
            //deposit egg
            let egg = Egg {
                owner: *ctx.accounts.authority.to_account_info().key,
                //mint_account: ctx.accounts.mint_account.key().clone(),
                //metadata_account: *ctx.accounts.metadata_account.to_account_info(),
                draggos_metadata_account: ctx.accounts.draggos_metadata_account.key().clone()
            };

            incubator.eggs.push(egg);
        }

        if incubator.eggs.len() == incubator.capacity as usize {
            //hatch eggs    
            //reset counter
            for egg in incubator.eggs.iter() {

                let (_, nonce) = Pubkey::find_program_address(
                    &[
                        b"incubator",
                        incubator.to_account_info().key.as_ref(),
                    ],
                    ctx.accounts.controller_program.key,
                );

                controller::cpi::hatch(
                    ctx.accounts.into_hatch(0),
                    nonce,
                )?;
            }

            incubator.eggs = Vec::new();
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
    pub draggos_metadata_account: Account<'info, DraggosMetadata>,
    pub controller_program: AccountInfo<'info>,
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

#[account]
pub struct Incubator {
    pub authority: Pubkey,
    pub next_index: u8,
    pub capacity: u8,
    pub eggs: Vec<Egg>,
    pub bump: u8,
    pub current_batch: u16
}

#[account]
pub struct DraggosMetadata {
    pub mint: Pubkey,
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