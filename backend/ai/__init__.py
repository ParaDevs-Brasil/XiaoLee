"""
Xiao Lee AI Module - Phase 4: AI + MCP Tools Integration

This module provides:
- LLM integration (OpenAI/Ollama)
- Multiple MCP tools for crypto operations, campaigns, and user interaction
- Waifu personality prompts
- Complete response generation pipeline
"""

from .llm_client import LLMClient
from .mcp_tools import (MCPToolsManager, get_mcp_tools_manager, create_wallet_impl,
                        check_balance_impl, internal_swap_impl,
                        withdraw_asset_impl, request_authentication_impl,
                        verify_authentication_token_impl, get_transaction_history_impl,
                        get_pending_transfers_impl, claim_pending_transfers_impl,
                        login_user_impl, mcp_server, get_mcp_tools)
from .prompts import XiaoLeePrompts
from .response_generator import XiaoLeeResponseGenerator, generate_ai_response

__all__ = [
    # Main classes
    'LLMClient',
    'XiaoLeePrompts',
    'XiaoLeeResponseGenerator',

    # MCP Tools Manager
    'MCPToolsManager',
    'get_mcp_tools_manager',
    'get_mcp_tools',

    # MCP Tools (backward compatibility)
    'create_wallet_impl',
    'check_balance_impl',
    'internal_swap_impl',
    'withdraw_asset_impl',
    'request_authentication_impl',
    'verify_authentication_token_impl',
    'get_transaction_history_impl',
    'get_pending_transfers_impl',
    'claim_pending_transfers_impl',
    'login_user_impl',
    'mcp_server',

    # Convenience function
    'generate_ai_response'
]
