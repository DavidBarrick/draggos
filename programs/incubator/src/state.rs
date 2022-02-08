use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

#[account]
pub struct DraggosMetadata {
    pub mint: Pubkey,
    pub hatched: bool,
    pub hatched_date: i64,
    pub hatched_batch: u64,
    pub bump: u8,
    pub uri: String
}

#[account]
pub struct Incubator {
    pub authority: Pubkey,
    pub next_index: u8,
    pub capacity: u8,
    pub bump: u8,
    pub current_batch: u16,
    pub mints: Vec<Pubkey>
}

#[account]
pub struct UpdateAuthority {
    pub authority: Pubkey,
    pub bump: u8,
}
