use anchor_lang::prelude::*;

pub const INCUBATOR_SEED: &[u8] = b"incubator_v0";
pub const UPDATE_AUTHORITY_SEED: &[u8] = b"update_authority";
pub const DEPOSIT_AUTHORITY_SEED: &[u8] = b"deposit_authority";
pub const METADATA_SEED: &[u8] = b"metadata";
pub const SLOT_SEED: &[u8] = b"slot";

#[account]
pub struct Incubator {
    pub authority: Pubkey,
    pub deposit_authority: Pubkey,
    pub bump: u8,
    pub current_batch: u16,
    pub hatched_total: u16,
    pub state: IncubatorState,
    pub mints: Vec<Pubkey>,
    pub slots: Vec<Pubkey>
}

#[account]
pub struct DraggosMetadata {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub bump: u8,
    pub hatched: bool,
    pub hatched_date: i64,
    pub hatched_batch: u16,
    pub uri: String,
}

#[account]
pub struct Slot {
    pub authority: Pubkey,
    pub incubator: Pubkey,
    pub bump: u8,
    pub index: u8,
    pub mint: Option<Pubkey>,
}

#[account]
pub struct UpdateAuthority {
    pub authority: Pubkey,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum IncubatorState {
    Available,
    Hatching,
    Paused
}

#[error]
pub enum IncubatorError {
    #[msg("This incubator is full")]
    IncubatorFull,
    #[msg("Invalid metadata account")]
    MetadataAccountNotFound,
    #[msg("Invalid draggos metadata account")]
    DraggosMetadataAccountNotFound,
    #[msg("Draggo has already hatched")]
    AlreadyHatched,
    #[msg("Invalid mint on slot")]
    InvalidSlotMint,
    #[msg("Invalid update authority")]
    InvalidUpdateAuthority,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Invalid metaplex metadata on slot")]
    InvalidSlotMetaplexMetadata,
    #[msg("Invalid draggos metadata on slot")]
    InvalidSlotDraggosMetadata,
    #[msg("Already in incubator")]
    InIncubator,
    #[msg("Invalid deposit authority")]
    InvalidDepositAuthority,
    #[msg("Invalid slot index")]
    InvalidSlotIndex,
    #[msg("Invalid hatch authority")]
    InvalidHatchAuthority,
    #[msg("Invalid incubator state")]
    InvalidIncubatorState,
    #[msg("Invalid slot count for reset")]
    InvalidSlotCountForReset,
    #[msg("Cannot reset incubator when slot(s) have not hatched")]
    InvalidResetUnhatchedSlots
}