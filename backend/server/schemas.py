from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class InboundMessage(BaseModel):
    platform: str = Field(description="telegram | x")
    user_id: str
    username: Optional[str] = None
    text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class IntentRequest(BaseModel):
    user_id: str
    text: str


class IntentResponse(BaseModel):
    action: str
    confidence: float
    entities: Dict[str, Any] = Field(default_factory=dict)


class OrchestrationResponse(BaseModel):
    platform: str
    user_id: str
    intent: IntentResponse
    reply_text: str
    execution: Dict[str, Any] = Field(default_factory=dict)


class SwapPrepareRequest(BaseModel):
    user_public_key: str
    input_mint: str
    output_mint: str
    amount_raw: int
    slippage_bps: int = 50


class SwapPrepareResponse(BaseModel):
    cluster: str
    quote: Dict[str, Any]
    swap_transaction_base64: str
    last_valid_block_height: Optional[int] = None
    disclaimer: str
