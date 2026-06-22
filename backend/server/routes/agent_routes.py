"""
agent_routes.py — Rotas do loop agêntico de campanhas.

POST /v1/agent/run-campaign          → Dispara o agente (background task)
GET  /v1/agent/run-campaign/{run_id}/status → Consulta status do run
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database.database import get_db_session
from database.repository import DatabaseRepository
from server.integrations.arc_client import ArcClient
from server.settings import settings

# Imports pesados em lazy para não quebrar testes unitários que importam este módulo
# via cadeia server/__init__ → app.py → agent_routes.py → ai/__init__ → mcp_tools → web3
def _lazy_tools():
    from ai.agents.creator_pay_tools import CREATOR_PAY_TOOLS, make_tool_executors  # noqa
    return CREATOR_PAY_TOOLS, make_tool_executors

def _lazy_engine():
    from claude_agent import ClaudeAgentEngine  # noqa
    return ClaudeAgentEngine

LOG = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/agent", tags=["agent"])

# ---------------------------------------------------------------------------
# In-memory run registry (keyed by run_id)
# Replaced by DB persistence in D4 when restart resilience is needed.
# ---------------------------------------------------------------------------
_RUNS: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class RunCampaignRequest(BaseModel):
    campaign_id: int
    budget_usdc: float
    criteria: dict = {}
    reward_per_creator_usdc: float = 5.0


class RunCampaignResponse(BaseModel):
    agent_run_id: str
    campaign_id: int
    budget_usdc: float
    status: str
    message: str


class AgentStatusResponse(BaseModel):
    agent_run_id: str
    campaign_id: int
    status: str
    steps_count: int
    payments_count: int
    total_paid_usdc: float
    payments: list[dict]
    steps: list[dict]
    final_message: str
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Background task
# ---------------------------------------------------------------------------


async def _run_agent_task(
    run_id: str,
    campaign_id: int,
    budget_usdc: float,
    reward_per_creator: float,
    db_session_factory,
) -> None:
    """Executa o loop agêntico em background e atualiza _RUNS."""
    _RUNS[run_id]["status"] = "running"

    try:
        async with db_session_factory() as session:
            repo = DatabaseRepository(session)

            arc = ArcClient(
                api_key=settings.circle_api_key,
                wallet_id=settings.circle_wallet_id,
                sandbox=settings.arc_sandbox,
            )

            CREATOR_PAY_TOOLS, make_tool_executors = _lazy_tools()
            ClaudeAgentEngine = _lazy_engine()

            executors = make_tool_executors(
                repo=repo,
                arc_client=arc,
                campaign_id=campaign_id,
                budget_usdc=budget_usdc,
                reward_per_creator=reward_per_creator,
            )

            engine = ClaudeAgentEngine(
                tools=CREATOR_PAY_TOOLS,
                executors=executors,
                max_steps=settings.agent_max_steps,
                api_key=settings.anthropic_api_key,
                model=settings.claude_model,
            )

            system_prompt = (
                f"You are XiaoLee Agent, an autonomous marketing AI managing campaign #{campaign_id}.\n"
                f"Available budget: ${budget_usdc:.2f} USDC | Reward per creator: ${reward_per_creator:.2f} USDC.\n\n"
                "Your mission:\n"
                f"1. Call discover_creators with campaign_id={campaign_id} to find enrolled participants.\n"
                "2. For each creator, call evaluate_creator to check eligibility (score >= 50).\n"
                "3. Before each payment, call check_budget to verify remaining funds.\n"
                "4. For eligible creators with sufficient budget, call pay_creator_nanopayment.\n"
                "   - Generate a fresh UUID v4 for intent_id each time.\n"
                "5. Stop when check_budget returns can_pay=false OR no more eligible creators.\n\n"
                "RULES:\n"
                "- Never pay a creator marked as already_paid=true.\n"
                "- Always generate a new UUID v4 for each intent_id.\n"
                "- If budget_exhausted=true is returned, stop immediately.\n"
                "- After processing all creators, summarize: how many paid, total USDC spent."
            )

            result = await engine.run(system_prompt, context={"campaign_id": campaign_id})

        _RUNS[run_id].update(
            {
                "status": result.status,
                "steps": [
                    {
                        "step": s.step,
                        "tool_name": s.tool_name,
                        "tool_input": s.tool_input,
                        "tool_result": s.tool_result,
                    }
                    for s in result.steps
                ],
                "payments": result.payments,
                "total_paid_usdc": result.total_paid_usdc,
                "final_message": result.final_message,
                "error": result.error,
            }
        )
        LOG.info(
            "[agent_routes] run_id=%s finished status=%s payments=%d total_usdc=%.4f",
            run_id,
            result.status,
            len(result.payments),
            result.total_paid_usdc,
        )

    except Exception as exc:
        LOG.exception("[agent_routes] run_id=%s crashed: %s", run_id, exc)
        _RUNS[run_id].update({"status": "failed", "error": str(exc)})


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/run-campaign", response_model=RunCampaignResponse)
async def run_campaign(
    payload: RunCampaignRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Dispara o agente de campanha em background.
    Retorna imediatamente com agent_run_id para polling de status.
    """
    if payload.budget_usdc <= 0:
        raise HTTPException(status_code=400, detail="budget_usdc must be positive")
    if payload.campaign_id <= 0:
        raise HTTPException(status_code=400, detail="campaign_id must be positive")

    from database.database import SessionLocal  # lazy to avoid circular
    import uuid as _uuid

    run_id = str(_uuid.uuid4())
    _RUNS[run_id] = {
        "status": "pending",
        "campaign_id": payload.campaign_id,
        "budget_usdc": payload.budget_usdc,
        "steps": [],
        "payments": [],
        "total_paid_usdc": 0.0,
        "final_message": "",
        "error": None,
    }

    background_tasks.add_task(
        _run_agent_task,
        run_id=run_id,
        campaign_id=payload.campaign_id,
        budget_usdc=payload.budget_usdc,
        reward_per_creator=payload.reward_per_creator_usdc,
        db_session_factory=SessionLocal,
    )

    LOG.info(
        "[agent_routes] queued run_id=%s campaign=%d budget=%.2f",
        run_id,
        payload.campaign_id,
        payload.budget_usdc,
    )

    return RunCampaignResponse(
        agent_run_id=run_id,
        campaign_id=payload.campaign_id,
        budget_usdc=payload.budget_usdc,
        status="pending",
        message=f"Agent started for campaign #{payload.campaign_id}. Poll /v1/agent/run-campaign/{run_id}/status for progress.",
    )


@router.get("/run-campaign/{run_id}/status", response_model=AgentStatusResponse)
async def get_run_status(run_id: str):
    """Consulta o status de um run do agente."""
    run = _RUNS.get(run_id)
    if not run:
        raise HTTPException(
            status_code=404,
            detail=f"Agent run {run_id} not found. Runs are stored in-memory and reset on server restart.",
        )

    return AgentStatusResponse(
        agent_run_id=run_id,
        campaign_id=run.get("campaign_id", 0),
        status=run.get("status", "unknown"),
        steps_count=len(run.get("steps", [])),
        payments_count=len(run.get("payments", [])),
        total_paid_usdc=run.get("total_paid_usdc", 0.0),
        payments=run.get("payments", []),
        steps=run.get("steps", []),
        final_message=run.get("final_message", ""),
        error=run.get("error"),
    )


@router.get("/runs")
async def list_runs():
    """Lista todos os runs ativos (debug)."""
    return {
        "runs": [
            {
                "run_id": run_id,
                "campaign_id": data.get("campaign_id"),
                "status": data.get("status"),
                "payments_count": len(data.get("payments", [])),
                "total_paid_usdc": data.get("total_paid_usdc", 0.0),
            }
            for run_id, data in _RUNS.items()
        ]
    }
