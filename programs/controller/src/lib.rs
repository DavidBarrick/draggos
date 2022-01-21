use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, SetAuthority, TokenAccount, Transfer};

declare_id!("BPiHhMNtjKkowiC6Yjr9Uf2js1ycCXE3F2SnWcAzNc8a");
pub const METAPLEX_PROGRAM_ID: &'static str = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

#[program]
pub mod controller {
    use super::*;


    #[access_control(Hatch::accounts(&ctx, nonce))]
    pub fn hatch(
        ctx: Context<Hatch>,
        nonce: u8,
    ) -> ProgramResult {
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Hatch<'info> {
    token_program: AccountInfo<'info>,
    metadata_account: AccountInfo<'info>,
    draggos_metadata_account: AccountInfo<'info>,
}

impl<'info> Hatch<'info> {
    fn accounts(ctx: &Context<Hatch>, nonce: u8) -> ProgramResult {
        /*let vendor_signer = Pubkey::create_program_address(
            &[
                ctx.accounts.registrar.to_account_info().key.as_ref(),
                ctx.accounts.vendor.to_account_info().key.as_ref(),
                &[nonce],
            ],
            ctx.program_id,
        )
        .map_err(|_| ErrorCode::InvalidNonce)?;
        if vendor_signer != ctx.accounts.vendor_vault.owner {
            return Err(ErrorCode::InvalidVaultOwner.into());
        }*/

        Ok(())
    }
}