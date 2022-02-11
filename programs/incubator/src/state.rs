use anchor_lang::prelude::*;

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
pub struct DraggosMetadata {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub hatched: bool,
    pub hatched_date: i64,
    pub hatched_batch: u16,
    pub bump: u8,
    pub uri: String,
}

#[account]
pub struct Slot {
    pub authority: Pubkey,
    pub incubator: Pubkey,
    pub bump: u8,
    pub index: u8,
    pub mint: Pubkey,
    pub metaplex_metadata: Option<Pubkey>,
    pub draggos_metadata: Option<Pubkey>,
}

#[account]
pub struct UpdateAuthority {
    pub authority: Pubkey,
    pub bump: u8,
}
