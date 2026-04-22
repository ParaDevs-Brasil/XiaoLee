"""
Router de Campanhas e Usuarios — endpoints consumidos pelo frontend Next.js.

O schema de Campaign retornado aqui espelha exatamente a interface TypeScript
Campaign definida em frontend/src/interfaces/campaign.ts.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["campaigns"])

# ---------------------------------------------------------------------------
# In-memory store para o MVP
# ---------------------------------------------------------------------------

_CAMPAIGNS: list[dict] = [
    {
        "id": 1,
        "name": "XiaoLee Genesis Campaign",
        "description": "Be among the first to interact with XiaoLee and earn $XLEE tokens! Follow our account, retweet our launch post and send a message to our bot.",
        "campaign_type": "social",
        "completed_participants": 0,
        "created_at": "2026-04-21T00:00:00Z",
        "creator_twitter_user_id": "XiaoLeeProtocol",
        "max_participants": 1000,
        "profile_to_follow": "XiaoLeeProtocol",
        "reward_per_participant": 50,
        "reward_pool": 50000,
        "reward_token": "$XLEE",
        "status": "active",
        "tweet_id_to_engage": None,
    },
    {
        "id": 2,
        "name": "Swap Challenge",
        "description": "Execute your first swap via XiaoLee AI assistant and earn bonus $XLEE tokens. Just ask XiaoLee to help you swap any token on Solana!",
        "campaign_type": "trading",
        "completed_participants": 0,
        "created_at": "2026-04-21T00:00:00Z",
        "creator_twitter_user_id": "XiaoLeeProtocol",
        "max_participants": 500,
        "profile_to_follow": None,
        "reward_per_participant": 100,
        "reward_pool": 50000,
        "reward_token": "$XLEE",
        "status": "active",
        "tweet_id_to_engage": None,
    },
    {
        "id": 3,
        "name": "Community Builder",
        "description": "Invite 3 friends to join XiaoLee and earn community rewards. Share your referral link and help grow the XiaoLee ecosystem.",
        "campaign_type": "referral",
        "completed_participants": 0,
        "created_at": "2026-04-21T00:00:00Z",
        "creator_twitter_user_id": "XiaoLeeProtocol",
        "max_participants": 200,
        "profile_to_follow": "XiaoLeeProtocol",
        "reward_per_participant": 250,
        "reward_pool": 50000,
        "reward_token": "$XLEE",
        "status": "active",
        "tweet_id_to_engage": None,
    },
]

# user_id -> set of joined campaign ids
_USER_CAMPAIGNS: dict[str, set[int]] = {}
# user_id -> set of verified campaign ids
_USER_VERIFIED: dict[str, set[int]] = {}
# user_id -> set of claimed campaign ids
_USER_CLAIMED: dict[str, set[int]] = {}
# user_id -> list of created campaigns
_CREATED_CAMPAIGNS: list[dict] = []
_NEXT_ID = 4


# ---------------------------------------------------------------------------
# Schemas (espelham exatamente as interfaces TypeScript do frontend)
# ---------------------------------------------------------------------------

class Campaign(BaseModel):
    id: int
    name: str
    description: str
    campaign_type: str
    completed_participants: int
    created_at: str
    creator_twitter_user_id: str
    max_participants: int
    profile_to_follow: Optional[str] = None
    reward_per_participant: float
    reward_pool: float
    reward_token: str
    status: str
    tweet_id_to_engage: Optional[str] = None


class CampaignsResponse(BaseModel):
    success: bool
    campaigns: List[Campaign]


class UserCampaignParticipation(BaseModel):
    id: int
    name: str
    description: str
    reward_token: str
    reward_per_participant: float
    campaign_type: str
    participation_status: str
    tasks_verified_at: Optional[str] = None
    tasks_claimed: bool = False
    status: Optional[str] = None


class UserCampaignsResponse(BaseModel):
    success: bool
    campaigns: List[UserCampaignParticipation]


class UserResponse(BaseModel):
    id: str
    username: Optional[str] = None
    platform: Optional[str] = None
    swap_count: int = 0
    total_volume: float = 0.0
    campaigns_joined: List[int] = []
    dossier: Optional[dict] = None


class CampaignActionRequest(BaseModel):
    campaign_identifier: str


class CreateCampaignRequest(BaseModel):
    title: str
    description: str
    campaign_type: str
    profile_to_follow: Optional[str] = None
    tweet_id_to_engage: Optional[str] = None
    reward_token: str
    reward_per_participant: float
    max_participants: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_user_id_from_token(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header required")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Token is empty")
    return token


def _campaign_by_id(campaign_id: int) -> dict:
    all_campaigns = _CAMPAIGNS + _CREATED_CAMPAIGNS
    for c in all_campaigns:
        if c["id"] == campaign_id:
            return c
    raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found")


# ---------------------------------------------------------------------------
# Auth status stub (evita 404 no useAuth)
# ---------------------------------------------------------------------------

@router.get("/auth/status/{token}")
async def auth_status(token: str):
    """Stub de auth — em producao valida o token real."""
    if not token or token.strip() == "":
        return {"status": "expired"}
    # MVP: qualquer token nao-vazio retorna pending (nao logado por padrao)
    return {"status": "pending", "session_id": token}


# ---------------------------------------------------------------------------
# User endpoints
# ---------------------------------------------------------------------------

@router.get("/user/{user_id}", response_model=UserResponse)
async def get_user(user_id: str):
    if not user_id or user_id.strip() == "":
        raise HTTPException(status_code=400, detail="user_id is required")

    joined = list(_USER_CAMPAIGNS.get(user_id, set()))
    return UserResponse(
        id=user_id,
        username=f"user_{user_id[:8]}",
        swap_count=0,
        total_volume=0.0,
        campaigns_joined=joined,
        dossier={
            "id": user_id,
            "username": f"user_{user_id[:8]}",
            "swap_count": 0,
            "total_volume": 0.0,
        },
    )


# ---------------------------------------------------------------------------
# Campaign endpoints
# ---------------------------------------------------------------------------

@router.get("/campaigns", response_model=CampaignsResponse)
async def list_campaigns():
    all_campaigns = _CAMPAIGNS + _CREATED_CAMPAIGNS
    active = [c for c in all_campaigns if c.get("status") == "active"]
    return CampaignsResponse(success=True, campaigns=[Campaign(**c) for c in active])


@router.get("/campaigns/user", response_model=UserCampaignsResponse)
async def get_user_campaigns(
    authorization: Optional[str] = Header(default=None),
):
    """Retorna as campanhas em que o usuario participa."""
    try:
        user_id = _get_user_id_from_token(authorization)
    except HTTPException:
        return UserCampaignsResponse(success=True, campaigns=[])

    joined = _USER_CAMPAIGNS.get(user_id, set())
    verified = _USER_VERIFIED.get(user_id, set())
    claimed = _USER_CLAIMED.get(user_id, set())

    result = []
    all_campaigns = _CAMPAIGNS + _CREATED_CAMPAIGNS
    for c in all_campaigns:
        if c["id"] in joined:
            if c["id"] in claimed:
                p_status = "paid"
            elif c["id"] in verified:
                p_status = "tasks_verified"
            else:
                p_status = "enrolled"

            result.append(
                UserCampaignParticipation(
                    id=c["id"],
                    name=c["name"],
                    description=c["description"],
                    reward_token=c["reward_token"],
                    reward_per_participant=c["reward_per_participant"],
                    campaign_type=c["campaign_type"],
                    participation_status=p_status,
                    status=p_status,
                    tasks_verified_at="2026-04-21T00:00:00Z" if c["id"] in verified else None,
                    tasks_claimed=c["id"] in claimed,
                )
            )
    return UserCampaignsResponse(success=True, campaigns=result)


@router.post("/campaigns/create")
async def create_campaign(
    payload: CreateCampaignRequest,
    authorization: Optional[str] = Header(default=None),
):
    global _NEXT_ID
    user_id = _get_user_id_from_token(authorization)
    new_campaign = {
        "id": _NEXT_ID,
        "name": payload.title,
        "description": payload.description,
        "campaign_type": payload.campaign_type,
        "completed_participants": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "creator_twitter_user_id": user_id,
        "max_participants": payload.max_participants,
        "profile_to_follow": payload.profile_to_follow,
        "reward_per_participant": payload.reward_per_participant,
        "reward_pool": payload.reward_per_participant * payload.max_participants,
        "reward_token": payload.reward_token,
        "status": "active",
        "tweet_id_to_engage": payload.tweet_id_to_engage,
    }
    _CREATED_CAMPAIGNS.append(new_campaign)
    _NEXT_ID += 1
    return {"success": True, "message": "Campaign created successfully!", "campaign": new_campaign}


@router.post("/campaigns/join")
async def join_campaign(
    payload: CampaignActionRequest,
    authorization: Optional[str] = Header(default=None),
):
    user_id = _get_user_id_from_token(authorization)
    campaign_id = int(payload.campaign_identifier)
    campaign = _campaign_by_id(campaign_id)

    joined = _USER_CAMPAIGNS.setdefault(user_id, set())
    if campaign_id in joined:
        return {"success": False, "error": "You have already joined this campaign"}
    if campaign["completed_participants"] >= campaign["max_participants"]:
        return {"success": False, "error": "This campaign is full"}

    joined.add(campaign_id)
    campaign["completed_participants"] = campaign.get("completed_participants", 0) + 1

    return {
        "success": True,
        "message": f"Successfully joined '{campaign['name']}'! Complete the tasks to earn {campaign['reward_per_participant']} {campaign['reward_token']}.",
    }


@router.post("/campaigns/verify")
async def verify_tasks(
    payload: CampaignActionRequest,
    authorization: Optional[str] = Header(default=None),
):
    user_id = _get_user_id_from_token(authorization)
    campaign_id = int(payload.campaign_identifier)
    _campaign_by_id(campaign_id)

    joined = _USER_CAMPAIGNS.get(user_id, set())
    if campaign_id not in joined:
        return {"success": False, "message": "You need to join this campaign first"}

    verified = _USER_VERIFIED.setdefault(user_id, set())
    if campaign_id in verified:
        return {"success": True, "message": "Tasks already verified! You can now claim your reward.", "all_tasks_completed": True}

    verified.add(campaign_id)
    return {
        "success": True,
        "message": "All tasks verified successfully! You are eligible to claim your reward.",
        "all_tasks_completed": True,
    }


@router.post("/campaigns/claim")
async def claim_reward(
    payload: CampaignActionRequest,
    authorization: Optional[str] = Header(default=None),
):
    user_id = _get_user_id_from_token(authorization)
    campaign_id = int(payload.campaign_identifier)
    campaign = _campaign_by_id(campaign_id)

    verified = _USER_VERIFIED.get(user_id, set())
    if campaign_id not in verified:
        return {"success": False, "error": "Complete and verify all tasks before claiming"}

    claimed = _USER_CLAIMED.setdefault(user_id, set())
    if campaign_id in claimed:
        return {"success": False, "error": "Reward already claimed for this campaign"}

    claimed.add(campaign_id)
    tx_id = str(uuid.uuid4())[:16]
    return {
        "success": True,
        "message": f"{campaign['reward_per_participant']} {campaign['reward_token']} claimed successfully!",
        "transaction_id": tx_id,
        "reward_amount": campaign["reward_per_participant"],
        "reward_token": campaign["reward_token"],
    }
