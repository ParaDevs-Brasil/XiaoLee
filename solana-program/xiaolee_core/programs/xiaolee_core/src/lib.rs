use anchor_lang::prelude::*;

declare_id!("Fmmpn79Tij8fzYHg31ekZz4MmK9ArGzN59VogfcwhXiM");

#[program]
pub mod xiaolee_core {
    use super::*;

    pub fn initialize_global(ctx: Context<InitializeGlobal>) -> Result<()> {
        let global_config = &mut ctx.accounts.global_config;
        global_config.admin = ctx.accounts.admin.key();
        global_config.bump = ctx.bumps.global_config;
        
        msg!("Global Config initialized with admin: {}", global_config.admin);
        Ok(())
    }

    pub fn initialize_user(ctx: Context<InitializeUser>, twitter_id: String) -> Result<()> {
        // [VULN FIX 3]: Sanitização de Input
        require!(twitter_id.len() <= 50, ErrorCode::StringTooLong);

        let user_state = &mut ctx.accounts.user_state;
        user_state.twitter_id = twitter_id;
        user_state.swap_count = 0;
        user_state.total_volume = 0;
        user_state.bump = ctx.bumps.user_state;
        
        msg!("User {} initialized successfully!", user_state.twitter_id);
        Ok(())
    }

    pub fn record_swap(ctx: Context<RecordSwap>, volume: u64) -> Result<()> {
        // [VULN FIX 1]: O Anchor constraint #[account(has_one = admin)] garante
        // que o signer desta transação seja exatamente o admin gravado no global_config.
        
        let user_state = &mut ctx.accounts.user_state;
        
        // [VULN FIX 2]: Prevenir Panic por Overflow (unwrap substituido por ok_or)
        user_state.swap_count = user_state.swap_count.checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;
            
        user_state.total_volume = user_state.total_volume.checked_add(volume)
            .ok_or(ErrorCode::MathOverflow)?;
        
        msg!("Recorded swap for {}. New count: {}", user_state.twitter_id, user_state.swap_count);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeGlobal<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + GlobalConfig::INIT_SPACE,
        seeds = [b"global_config"],
        bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(twitter_id: String)]
pub struct InitializeUser<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + UserState::INIT_SPACE,
        seeds = [b"user", twitter_id.as_bytes()],
        bump
    )]
    pub user_state: Account<'info, UserState>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordSwap<'info> {
    #[account(
        seeds = [b"global_config"],
        bump = global_config.bump,
        has_one = admin @ ErrorCode::Unauthorized
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"user", user_state.twitter_id.as_bytes()],
        bump = user_state.bump
    )]
    pub user_state: Account<'info, UserState>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    pub admin: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct UserState {
    #[max_len(50)]
    pub twitter_id: String,
    pub swap_count: u64,
    pub total_volume: u64,
    pub bump: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Math operation overflow")]
    MathOverflow,
    
    #[msg("String length exceeds maximum allowed limit of 50")]
    StringTooLong,

    #[msg("Unauthorized: You are not the protocol admin")]
    Unauthorized,
}
