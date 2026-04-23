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
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.database import get_db_session
from database.models import AuthToken, Campaign as CampaignModel, CampaignParticipant, User, WebSession
from fastapi import Depends

router = APIRouter(tags=["campaigns"])

DEFAULT_CAMPAIGNS = [
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


def _campaign_to_dict(campaign: CampaignModel, completed_participants: int = 0) -> dict:
    created_at = campaign.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    return {
        "id": campaign.id,
        "name": campaign.name,
        "description": campaign.description,
        "campaign_type": campaign.campaign_type,
        "completed_participants": completed_participants,
        "created_at": created_at.isoformat(),
        "creator_twitter_user_id": campaign.creator_twitter_user_id,
        "max_participants": campaign.max_participants,
        "profile_to_follow": campaign.profile_to_follow,
        "reward_per_participant": float(campaign.reward_per_participant),
        "reward_pool": float(campaign.reward_pool),
        "reward_token": campaign.reward_token,
        "status": campaign.status,
        "tweet_id_to_engage": campaign.tweet_id_to_engage,
    }


def _participant_status(participant: CampaignParticipant) -> str:
    if participant.status == "paid":
        return "paid"
    if participant.status == "tasks_verified":
        return "tasks_verified"
    return "enrolled"


async def _resolve_user(db: AsyncSession, authorization: Optional[str]) -> User:
    token = _get_user_id_from_token(authorization)
    now = datetime.now(timezone.utc)
    twitter_user_id = token
    twitter_handle = token

    auth_stmt = select(AuthToken).where(AuthToken.token == token)
    auth_res = await db.execute(auth_stmt)
    auth_token = auth_res.scalars().first()
    if auth_token:
        if auth_token.expires_at.tzinfo is None:
            auth_expires = auth_token.expires_at.replace(tzinfo=timezone.utc)
        else:
            auth_expires = auth_token.expires_at

        if auth_expires < now:
            raise HTTPException(status_code=401, detail="Authorization expired")
        twitter_user_id = auth_token.twitter_user_id or token
        twitter_handle = auth_token.twitter_handle or twitter_user_id

    web_stmt = select(WebSession).where(WebSession.session_id == token)
    web_res = await db.execute(web_stmt)
    web_session = web_res.scalars().first()
    if web_session:
        if web_session.expires_at.tzinfo is None:
            session_expires = web_session.expires_at.replace(tzinfo=timezone.utc)
        else:
            session_expires = web_session.expires_at

        if session_expires < now:
            raise HTTPException(status_code=401, detail="Authorization expired")
        twitter_user_id = web_session.twitter_user_id
        twitter_handle = web_session.twitter_user_id

    user_stmt = select(User).where(User.twitter_user_id == twitter_user_id)
    user_res = await db.execute(user_stmt)
    user = user_res.scalars().first()
    if user:
        if twitter_handle and user.twitter_handle != twitter_handle:
            user.twitter_handle = twitter_handle
        return user

    user = User(twitter_user_id=twitter_user_id, twitter_handle=twitter_handle)
    db.add(user)
    await db.flush()
    return user


async def _seed_default_campaigns(db: AsyncSession) -> None:
    count_res = await db.execute(select(func.count()).select_from(CampaignModel))
    existing_count = count_res.scalar() or 0
    if existing_count > 0:
        return

    for campaign_data in DEFAULT_CAMPAIGNS:
        db.add(
            CampaignModel(
                id=campaign_data["id"],
                creator_twitter_user_id=campaign_data["creator_twitter_user_id"],
                name=campaign_data["name"],
                description=campaign_data["description"],
                campaign_type=campaign_data["campaign_type"],
                reward_token=campaign_data["reward_token"],
                reward_per_participant=campaign_data["reward_per_participant"],
                max_participants=campaign_data["max_participants"],
                reward_pool=campaign_data["reward_pool"],
                status=campaign_data["status"],
                profile_to_follow=campaign_data["profile_to_follow"],
                tweet_id_to_engage=campaign_data["tweet_id_to_engage"],
            )
        )

    await db.commit()


async def _get_campaign_or_404(db: AsyncSession, campaign_id: int) -> CampaignModel:
    stmt = select(CampaignModel).where(CampaignModel.id == campaign_id)
    result = await db.execute(stmt)
    campaign = result.scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found")
    return campaign


# ---------------------------------------------------------------------------
# Auth status stub (evita 404 no useAuth)
# ---------------------------------------------------------------------------

@router.get("/auth/status/{token}")
async def auth_status(token: str, db: AsyncSession = Depends(get_db_session)):
    """Auth status endpoint backed by persisted token/session records."""
    if not token or token.strip() == "":
        return {"status": "expired"}

    now = datetime.now(timezone.utc)
    raw_token = token.strip()

    try:
        auth_stmt = select(AuthToken).where(AuthToken.token == raw_token)
        auth_res = await db.execute(auth_stmt)
        auth_token = auth_res.scalars().first()

        if auth_token:
            expires_at = auth_token.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)

            if auth_token.status == "active" and expires_at > now:
                return {
                    "status": "active",
                    "session_id": raw_token,
                    "twitter_user_id": auth_token.twitter_user_id,
                }

            if auth_token.status == "pending" and expires_at > now:
                return {"status": "pending", "session_id": raw_token}

            return {"status": "expired"}

        web_stmt = select(WebSession).where(WebSession.session_id == raw_token)
        web_res = await db.execute(web_stmt)
        web_session = web_res.scalars().first()

        if web_session:
            expires_at = web_session.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)

            if expires_at > now:
                return {
                    "status": "active",
                    "session_id": raw_token,
                    "twitter_user_id": web_session.twitter_user_id,
                }
            return {"status": "expired"}

        # Unknown token keeps the same UX flow while avoiding false "active" states.
        return {"status": "pending", "session_id": raw_token}
    except Exception:
        # Safe fallback to avoid breaking login UX in environments with partial DB state.
        return {"status": "pending", "session_id": raw_token}


# ---------------------------------------------------------------------------
# User endpoints
# ---------------------------------------------------------------------------

@router.get("/user/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, db: AsyncSession = Depends(get_db_session)):
    if not user_id or user_id.strip() == "":
        raise HTTPException(status_code=400, detail="user_id is required")

    await _seed_default_campaigns(db)

    user_stmt = select(User).where(User.twitter_user_id == user_id)
    user_res = await db.execute(user_stmt)
    user = user_res.scalars().first()

    if not user:
        user = User(twitter_user_id=user_id, twitter_handle=f"user_{user_id[:8]}")
        db.add(user)
        await db.commit()

    participant_stmt = select(CampaignParticipant.campaign_id).where(CampaignParticipant.user_id == user.id)
    participant_res = await db.execute(participant_stmt)
    joined = list(participant_res.scalars().all())

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
async def list_campaigns(db: AsyncSession = Depends(get_db_session)):
    await _seed_default_campaigns(db)

    campaigns_res = await db.execute(select(CampaignModel).where(CampaignModel.status == "active").order_by(CampaignModel.id.asc()))
    campaigns = campaigns_res.scalars().all()

    participant_counts_res = await db.execute(
        select(CampaignParticipant.campaign_id, func.count(CampaignParticipant.id))
        .group_by(CampaignParticipant.campaign_id)
    )
    participant_counts = {campaign_id: count for campaign_id, count in participant_counts_res.all()}

    return CampaignsResponse(
        success=True,
        campaigns=[Campaign(**_campaign_to_dict(c, participant_counts.get(c.id, 0))) for c in campaigns],
    )


@router.get("/campaigns/user", response_model=UserCampaignsResponse)
async def get_user_campaigns(
    db: AsyncSession = Depends(get_db_session),
    authorization: Optional[str] = Header(default=None),
):
    """Retorna as campanhas em que o usuario participa."""
    await _seed_default_campaigns(db)

    try:
        user = await _resolve_user(db, authorization)
    except HTTPException:
        return UserCampaignsResponse(success=True, campaigns=[])

    participant_stmt = (
        select(CampaignParticipant, CampaignModel)
        .join(CampaignModel, CampaignModel.id == CampaignParticipant.campaign_id)
        .where(CampaignParticipant.user_id == user.id)
        .order_by(CampaignParticipant.joined_at.asc())
    )
    participant_res = await db.execute(participant_stmt)

    result = []
    for participant, campaign in participant_res.all():
        participation_status = _participant_status(participant)
        verified_at = participant.tasks_verified_at
        if verified_at and verified_at.tzinfo is None:
            verified_at = verified_at.replace(tzinfo=timezone.utc)

        result.append(
            UserCampaignParticipation(
                id=campaign.id,
                name=campaign.name,
                description=campaign.description,
                reward_token=campaign.reward_token,
                reward_per_participant=float(campaign.reward_per_participant),
                campaign_type=campaign.campaign_type,
                participation_status=participation_status,
                status=participation_status,
                tasks_verified_at=verified_at.isoformat() if verified_at else None,
                tasks_claimed=participant.status == "paid",
            )
        )
    return UserCampaignsResponse(success=True, campaigns=result)


@router.post("/campaigns/create")
async def create_campaign(
    payload: CreateCampaignRequest,
    db: AsyncSession = Depends(get_db_session),
    authorization: Optional[str] = Header(default=None),
):
    await _seed_default_campaigns(db)
    user = await _resolve_user(db, authorization)

    new_campaign = CampaignModel(
        creator_twitter_user_id=user.twitter_user_id,
        name=payload.title,
        description=payload.description,
        campaign_type=payload.campaign_type,
        reward_token=payload.reward_token,
        reward_per_participant=payload.reward_per_participant,
        max_participants=payload.max_participants,
        reward_pool=payload.reward_per_participant * payload.max_participants,
        status="active",
        profile_to_follow=payload.profile_to_follow,
        tweet_id_to_engage=payload.tweet_id_to_engage,
    )
    db.add(new_campaign)
    await db.commit()
    await db.refresh(new_campaign)

    return {"success": True, "message": "Campaign created successfully!", "campaign": _campaign_to_dict(new_campaign)}


@router.post("/campaigns/join")
async def join_campaign(
    payload: CampaignActionRequest,
    db: AsyncSession = Depends(get_db_session),
    authorization: Optional[str] = Header(default=None),
):
    await _seed_default_campaigns(db)
    user = await _resolve_user(db, authorization)
    campaign_id = int(payload.campaign_identifier)
    campaign = await _get_campaign_or_404(db, campaign_id)

    existing_stmt = select(CampaignParticipant).where(
        CampaignParticipant.campaign_id == campaign_id,
        CampaignParticipant.user_id == user.id,
    )
    existing_res = await db.execute(existing_stmt)
    existing = existing_res.scalars().first()
    if existing:
        return {"success": False, "error": "You have already joined this campaign"}

    participant_count_stmt = select(func.count()).select_from(CampaignParticipant).where(CampaignParticipant.campaign_id == campaign_id)
    participant_count_res = await db.execute(participant_count_stmt)
    participant_count = participant_count_res.scalar() or 0
    if participant_count >= campaign.max_participants:
        return {"success": False, "error": "This campaign is full"}

    db.add(
        CampaignParticipant(
            campaign_id=campaign.id,
            user_id=user.id,
            status="enrolled",
        )
    )
    await db.commit()

    return {
        "success": True,
        "message": f"Successfully joined '{campaign.name}'! Complete the tasks to earn {float(campaign.reward_per_participant)} {campaign.reward_token}.",
    }


@router.post("/campaigns/verify")
async def verify_tasks(
    payload: CampaignActionRequest,
    db: AsyncSession = Depends(get_db_session),
    authorization: Optional[str] = Header(default=None),
):
    await _seed_default_campaigns(db)
    user = await _resolve_user(db, authorization)
    campaign_id = int(payload.campaign_identifier)
    await _get_campaign_or_404(db, campaign_id)

    participant_stmt = select(CampaignParticipant).where(
        CampaignParticipant.campaign_id == campaign_id,
        CampaignParticipant.user_id == user.id,
    )
    participant_res = await db.execute(participant_stmt)
    participant = participant_res.scalars().first()
    if not participant:
        return {"success": False, "message": "You need to join this campaign first"}

    if participant.status in {"tasks_verified", "paid"}:
        return {"success": True, "message": "Tasks already verified! You can now claim your reward.", "all_tasks_completed": True}

    participant.status = "tasks_verified"
    participant.tasks_verified_at = datetime.now(timezone.utc)
    await db.commit()
    return {
        "success": True,
        "message": "All tasks verified successfully! You are eligible to claim your reward.",
        "all_tasks_completed": True,
    }


@router.post("/campaigns/claim")
async def claim_reward(
    payload: CampaignActionRequest,
    db: AsyncSession = Depends(get_db_session),
    authorization: Optional[str] = Header(default=None),
):
    await _seed_default_campaigns(db)
    user = await _resolve_user(db, authorization)
    campaign_id = int(payload.campaign_identifier)
    campaign = await _get_campaign_or_404(db, campaign_id)

    participant_stmt = select(CampaignParticipant).where(
        CampaignParticipant.campaign_id == campaign_id,
        CampaignParticipant.user_id == user.id,
    )
    participant_res = await db.execute(participant_stmt)
    participant = participant_res.scalars().first()
    if not participant or participant.status not in {"tasks_verified", "paid"}:
        return {"success": False, "error": "Complete and verify all tasks before claiming"}

    if participant.status == "paid":
        return {"success": False, "error": "Reward already claimed for this campaign"}

    participant.status = "paid"
    await db.commit()
    tx_id = str(uuid.uuid4())[:16]
    return {
        "success": True,
        "message": f"{float(campaign.reward_per_participant)} {campaign.reward_token} claimed successfully!",
        "transaction_id": tx_id,
        "reward_amount": float(campaign.reward_per_participant),
        "reward_token": campaign.reward_token,
    }
