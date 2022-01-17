use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, SetAuthority, TokenAccount, Transfer};

declare_id!("4UcHv3jGHFd2maREf949QssbVUFUcn5wHqaEWqhx1N8b");
pub const METAPLEX_PROGRAM_ID: &'static str = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

#[program]
pub mod incubator {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, capacity: u8, bump: u8) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;
        incubator.bump = bump;
        incubator.capacity = capacity;
        incubator.eggs = Vec::new();
        incubator.owner = ctx.accounts.owner.to_account_info().key();
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>) -> ProgramResult {
        let incubator = &mut ctx.accounts.incubator;

        if incubator.eggs.len() >= incubator.capacity as usize {
            // error
            return Err(ProgramError::InvalidInstructionData);
        } else if incubator.eggs.len() == (incubator.capacity - 1) as usize {
            //hatch eggs    
            //reset counter
            for egg in incubator.eggs.iter() {
                //println!("{}", egg);
            }
            incubator.eggs = Vec::new();
        } else {
            //deposit egg
            let egg = Egg {
                owner: ctx.accounts.token.owner.key().clone(),
                mint_account: ctx.accounts.mint_account.to_account_info().key().clone(),
                update_authority: ctx.accounts.update_authority.to_account_info().key().clone(),
                metadata_account: ctx.accounts.metadata_account.to_account_info().key().clone()
            };

            incubator.eggs.push(egg);
        }

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(metadata_account_bump: u8)]
pub struct Deposit<'info> {
    #[account(
        mut
    )]
    pub incubator: Account<'info, Incubator>,
    pub owner: Signer<'info>,
    #[account(
        has_one = owner
    )]
    pub token: Account<'info, TokenAccount>,
    #[account(
        seeds = [
            b"metadata",
            METAPLEX_PROGRAM_ID.as_bytes(),
            mint_account.key().as_ref()
        ],
        bump = metadata_account_bump,
    )]
    pub metadata_account: AccountInfo<'info>,
    pub mint_account: AccountInfo<'info>,
    pub update_authority: AccountInfo<'info>,
    pub system_program: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(capacity: u8, bump: u8)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [
            b"incubator"
        ],
        bump = bump,
        payer = owner,
        space = 10000,
    )]
    pub incubator: Account<'info, Incubator>,
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Incubator {
    pub owner: Pubkey,
    pub next_index: u8,
    pub capacity: u8,
    pub eggs: Vec<Egg>,
    pub bump: u8,
    pub metadata_account: Pubkey,
}

#[zero_copy]
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct Egg {
    pub owner: Pubkey,
    pub metadata_account: Pubkey,
    pub mint_account: Pubkey,
    pub update_authority: Pubkey,
}