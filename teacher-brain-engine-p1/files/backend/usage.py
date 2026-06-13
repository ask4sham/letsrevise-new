"""
Teacher Brain — P0.2 Per-user LLM budget cap.

Pure data layer. No FastAPI imports of routes — only the building blocks:
- BudgetExceeded exception (mapped to 429 in server.py)
- check_budget(db, user_id)  — call BEFORE the provider request
- record_usage(db, ...)       — call AFTER (status=allowed|failed) or on reject
- get_user_usage(db, user_id) — read-only summary for /api/auth/usage

Counting rule:
- Only status="allowed" counts against daily/monthly caps.
- status="failed" is logged but does NOT count — users are not punished for
  upstream provider outages.
- status="rejected" is logged for audit; it never reaches the provider.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger("teacher-brain.usage")

DEFAULT_DAILY_LIMIT = 10
DEFAULT_MONTHLY_LIMIT = 100

ALLOWED_STATUSES = ("allowed", "rejected", "failed")
ALLOWED_PROVIDERS = ("anthropic", "openai", "google", "unknown")


def _safe_int(name: str, fallback: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return fallback
    try:
        v = int(raw)
        return v if v > 0 else fallback
    except ValueError:
        return fallback


def daily_limit() -> int:
    return _safe_int("TEACHER_BRAIN_DAILY_LLM_LIMIT", DEFAULT_DAILY_LIMIT)


def monthly_limit() -> int:
    return _safe_int("TEACHER_BRAIN_MONTHLY_LLM_LIMIT", DEFAULT_MONTHLY_LIMIT)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def day_key(now: Optional[datetime] = None) -> str:
    return (now or _now()).strftime("%Y-%m-%d")


def month_key(now: Optional[datetime] = None) -> str:
    return (now or _now()).strftime("%Y-%m")


# ---------------------------------------------------------------------------
# Exception (mapped to HTTP 429 by an exception handler in server.py)
# ---------------------------------------------------------------------------

class BudgetExceeded(Exception):
    """Raised by check_budget; server.py's handler converts to a 429 JSON response."""

    _MESSAGES = {
        "daily": "Daily AI usage limit reached. Please try again tomorrow.",
        "monthly": "Monthly AI usage limit reached.",
    }
    _CODES = {
        "daily": "DAILY_LLM_LIMIT_REACHED",
        "monthly": "MONTHLY_LLM_LIMIT_REACHED",
    }

    def __init__(self, limit_type: str, used: int, limit: int):
        if limit_type not in self._MESSAGES:
            raise ValueError(f"Unknown limit_type: {limit_type}")
        self.limit_type = limit_type
        self.used = used
        self.limit = limit
        self.message = self._MESSAGES[limit_type]
        self.code = self._CODES[limit_type]
        super().__init__(self.message)


# ---------------------------------------------------------------------------
# Indexes
# ---------------------------------------------------------------------------

async def ensure_usage_indexes(db: AsyncIOMotorDatabase) -> None:
    await db.llm_usage.create_index([("user_id", 1), ("day_key", 1), ("status", 1)])
    await db.llm_usage.create_index([("user_id", 1), ("month_key", 1), ("status", 1)])
    await db.llm_usage.create_index("created_at")


# ---------------------------------------------------------------------------
# Read-only summary (for /api/auth/usage — never exposes provider/cost detail)
# ---------------------------------------------------------------------------

async def get_user_usage(db: AsyncIOMotorDatabase, user_id: str) -> dict:
    today = day_key()
    month = month_key()
    daily_used = await db.llm_usage.count_documents(
        {"user_id": user_id, "day_key": today, "status": "allowed"}
    )
    monthly_used = await db.llm_usage.count_documents(
        {"user_id": user_id, "month_key": month, "status": "allowed"}
    )
    d_lim = daily_limit()
    m_lim = monthly_limit()
    return {
        "daily_used": daily_used,
        "daily_limit": d_lim,
        "daily_remaining": max(0, d_lim - daily_used),
        "monthly_used": monthly_used,
        "monthly_limit": m_lim,
        "monthly_remaining": max(0, m_lim - monthly_used),
        "day_key": today,
        "month_key": month,
    }


# ---------------------------------------------------------------------------
# Enforcement
# ---------------------------------------------------------------------------

async def check_budget(db: AsyncIOMotorDatabase, *, user_id: str, route: str) -> dict:
    """
    Call BEFORE any LLM provider request.
    Raises BudgetExceeded on cap violation (writes a 'rejected' audit row first).
    Returns the current usage summary on success.
    """
    usage = await get_user_usage(db, user_id)

    if usage["daily_used"] >= usage["daily_limit"]:
        await record_usage(
            db,
            user_id=user_id,
            route=route,
            action_type="budget_check",
            status="rejected",
            error_reason="daily_limit_reached",
        )
        raise BudgetExceeded("daily", usage["daily_used"], usage["daily_limit"])

    if usage["monthly_used"] >= usage["monthly_limit"]:
        await record_usage(
            db,
            user_id=user_id,
            route=route,
            action_type="budget_check",
            status="rejected",
            error_reason="monthly_limit_reached",
        )
        raise BudgetExceeded("monthly", usage["monthly_used"], usage["monthly_limit"])

    return usage


# ---------------------------------------------------------------------------
# Audit insert (single source of truth for llm_usage)
# ---------------------------------------------------------------------------

async def record_usage(
    db: AsyncIOMotorDatabase,
    *,
    user_id: str,
    route: str,
    action_type: str,
    status: str,
    provider: str = "anthropic",
    estimated_cost_units: float = 1.0,
    request_metadata: Optional[dict] = None,
    error_reason: Optional[str] = None,
) -> str:
    if status not in ALLOWED_STATUSES:
        status = "failed"
    if provider not in ALLOWED_PROVIDERS:
        provider = "unknown"

    now = _now()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "route": route,
        "action_type": action_type,
        "provider": provider,
        "status": status,
        "estimated_cost_units": float(estimated_cost_units),
        "day_key": day_key(now),
        "month_key": month_key(now),
        "created_at": now.isoformat(),
        "request_metadata": request_metadata or {},
        "error_reason": error_reason,
    }
    await db.llm_usage.insert_one(doc)

    if status == "rejected":
        logger.warning(
            "Budget rejected user=%s route=%s reason=%s", user_id, route, error_reason
        )
    elif status == "failed":
        logger.info(
            "LLM call failed user=%s route=%s reason=%s", user_id, route, error_reason
        )
    return doc["id"]
