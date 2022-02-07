use anchor_lang::prelude::*;

#[account]
pub struct DraggosMetadata {
    pub mint: Pubkey,
    pub hatched: bool,
    pub hatched_date: i64,
    pub hatched_batch: u64,
    pub bump: u8,
    pub uri: String
}