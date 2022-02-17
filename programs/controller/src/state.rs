use anchor_lang::prelude::*;

#[account]
pub struct DepositAuthority {
    pub authority: Pubkey,
    pub bump: u8,
}