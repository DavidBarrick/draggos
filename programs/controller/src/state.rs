use anchor_lang::prelude::*;

#[account]
pub struct DepositAuthority {
    pub authority: Pubkey,
    pub bump: u8,
}

#[error]
pub enum ControllerError {
    #[msg("[Controller] This incubator is full")]
    IncubatorFull = 6000,
}