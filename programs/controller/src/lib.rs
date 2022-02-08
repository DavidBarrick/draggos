use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

use incubator::{
    state::{ DraggosMetadata, Incubator, UpdateAuthority },
    program::Incubator as IncubatorProgram
};


use spl_token_metadata::{
    instruction::{update_metadata_accounts},
    state::{Metadata},
};

use anchor_lang::solana_program::{
    self,
    pubkey::Pubkey,
    system_program
};

declare_id!("2Y2MREyEZpwavdqSpAzCpn27R3pfZuunotjTEnGaSEty");

#[program]
pub mod controller {
    use super::*;
    
    pub fn deposit(ctx: Context<Deposit>) -> ProgramResult {
        let incubator = ctx.accounts.incubator;
        let (update_authority, nonce) = Pubkey::find_program_address(
            &[
                b"incubator_v0".as_ref(),
                b"update_authority".as_ref()
            ],
            ctx.accounts.incubator_program.key,
        );

        if incubator.mints.len() >= (incubator.capacity - 1) as usize {
            for mint in incubator.mints.iter() {
                let (metadata, metadata_bump) = Pubkey::find_program_address(
                    &[
                        b"metaplex".as_ref(),
                        b"update_authority".as_ref(),
                        &mint.as_ref()
                    ],
                    ctx.accounts.incubator_program.key,
                );

                let (draggos_metadata_account, draggos_metadata_bump) = Pubkey::find_program_address(
                    &[
                        b"incubator_v0".as_ref(),
                        b"metadata".as_ref(),
                        &mint.as_ref()
                    ],
                    ctx.accounts.incubator_program.key,
                );

                let program = ctx.accounts.incubator_program.clone();
                let accounts = incubator::cpi::accounts::HatchEgg {
                    authority: ctx.accounts.authority.to_account_info(),
                    incubator: ctx.accounts.incubator.to_account_info(),
                    draggos_metadata_account: draggos_metadata_account.to_account_info(),
                    mint: AccountInfo::new(mint, false, false, &mut 0, &mut [], &program.key(), false, 0),
                    update_authority: AccountInfo::new(&update_authority, false, false, &mut 0, &mut [], &program.key(), false, 0),
                };

                let context = CpiContext::new(program.to_account_info(), accounts);
                incubator::cpi::hatch(
                    context,
                    0,
                    nonce,
                    false
                )?;
            }
        } else if incubator.mints.len() < incubator.capacity as usize {
            incubator::cpi::deposit(
                ctx.accounts.into_deposit()
            )?;
        }



        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(draggos_metadata_bump: u8, update_authority_bump: u8)]
pub struct Deposit<'info> {
    //No need to validate here as our incubator will validate
    pub authority: Signer<'info>,
    pub incubator: Account<'info, Incubator>,
    pub incubator_program: AccountInfo<'info>,
    pub draggos_metadata_account: Account<'info, DraggosMetadata>,
    #[account(mut)]
    pub metadata: AccountInfo<'info>,
    pub mint: AccountInfo<'info>,
    pub update_authority: Account<'info, UpdateAuthority>,
    #[account(address = spl_token_metadata::id())]
    pub token_metadata_program: AccountInfo<'info>,
    pub token_account: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

impl<'info> Deposit<'info> {
    fn into_deposit(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, incubator::cpi::accounts::DepositEgg<'info>> {
        let program = self.incubator_program.clone();
        let accounts = incubator::cpi::accounts::DepositEgg {
            authority: self.authority.to_account_info(),
            incubator: self.incubator.to_account_info(),
            draggos_metadata_account: self.draggos_metadata_account.to_account_info(),
            mint: self.mint.to_account_info()
        };
        CpiContext::new(program.to_account_info(), accounts)
    }
}