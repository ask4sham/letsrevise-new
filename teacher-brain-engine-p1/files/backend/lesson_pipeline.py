"""
Teacher Brain — P0.3 + P0.5 Lesson generation pipeline.

Orchestrates: budget → LLM (with timeout) → validate → [retry once] → score → save.

Public surface:
- generate_validated_lesson(...)
- InvalidLessonError       (server.py maps to 422)
- LLMProviderUnavailable   (server.py maps to 503)
- LLMTimeoutError          (server.py maps to 503 with code LLM_TIMEOUT)
- LLM_TIMEOUT_SECONDS
- MAX_ATTEMPTS             (hard ceiling = 2)
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, List

from motor.motor_asyncio import AsyncIOMotorDatabase

from lesson_engine import score_lesson_blocks
from lesson_validator import validate_lesson_payload
from usage import record_usage, check_budget

logger = logging.getLogger("teacher-brain.pipeline")

MAX_ATTEMPTS = 2
LLM_TIMEOUT_SECONDS = 90.0  # per provider call

ACTION_FIRST = "first_generation_attempt"
ACTION_RETRY = "auto_regeneration_attempt"


class InvalidLessonError(Exception):
    """Both LLM attempts produced an invalid payload. Mapped to HTTP 422."""

    def __init__(self, errors: List[str]):
        self.errors = list(errors)[:10]
        super().__init__("Invalid generated lesson")


class LLMProviderUnavailable(Exception):
    """LLM provider raised an exception (network, 5xx, malformed). Mapped to HTTP 503."""

    def __init__(self, reason: str):
        # Truncate; never echoed to client in any case
        self.reason = (reason or "")[:240]
        super().__init__(self.reason)


class LLMTimeoutError(Exception):
    """LLM provider exceeded LLM_TIMEOUT_SECONDS. Mapped to HTTP 503 with code LLM_TIMEOUT."""

    def __init__(self, timeout_seconds: float = LLM_TIMEOUT_SECONDS):
        self.timeout_seconds = timeout_seconds
        super().__init__(f"LLM timed out after {timeout_seconds:.0f}s")


LlmFn = Callable[..., Awaitable[Dict[str, Any]]]


async def _call_llm_with_timeout(llm_fn: LlmFn, topic: str, **kwargs) -> Dict[str, Any]:
    try:
        return await asyncio.wait_for(llm_fn(topic, **kwargs), timeout=LLM_TIMEOUT_SECONDS)
    except asyncio.TimeoutError as e:
        raise LLMTimeoutError() from e


async def generate_validated_lesson(
    *,
    db: AsyncIOMotorDatabase,
    user_id: str,
    topic: str,
    exam_board: str,
    tier: str,
    llm_fn: LlmFn,
) -> Dict[str, Any]:
    """
    Returns a freshly-saved lesson dict.

    Raises:
        BudgetExceeded          → server maps to HTTP 429
        InvalidLessonError      → server maps to HTTP 422
        LLMTimeoutError         → server maps to HTTP 503 (code LLM_TIMEOUT)
        LLMProviderUnavailable  → server maps to HTTP 503 (code LLM_PROVIDER_UNAVAILABLE)
    """
    last_errors: List[str] = []

    for attempt in (1, 2):
        action_type = ACTION_FIRST if attempt == 1 else ACTION_RETRY

        # 1. Budget check BEFORE each expensive provider call.
        await check_budget(db, user_id=user_id, route="lessons.generate")

        # 2. LLM call with timeout.
        try:
            kwargs: Dict[str, Any] = {"exam_board": exam_board, "tier": tier}
            if attempt == 2 and last_errors:
                kwargs["repair_guidance"] = last_errors
            raw = await _call_llm_with_timeout(llm_fn, topic, **kwargs)
        except LLMTimeoutError:
            await record_usage(
                db, user_id=user_id, route="lessons.generate",
                action_type=action_type, status="failed",
                error_reason="llm_timeout",
                request_metadata={"attempt": attempt, "topic": topic},
            )
            logger.warning("LLM timeout user=%s attempt=%d topic=%s", user_id, attempt, topic)
            raise
        except LLMProviderUnavailable:
            raise  # already shaped
        except Exception as e:
            await record_usage(
                db, user_id=user_id, route="lessons.generate",
                action_type=action_type, status="failed",
                error_reason=str(e)[:240],
                request_metadata={"attempt": attempt, "topic": topic},
            )
            logger.exception("LLM provider failed user=%s attempt=%d", user_id, attempt)
            raise LLMProviderUnavailable(str(e)) from e

        # 3. Structural validation.
        valid, errors = validate_lesson_payload(raw)

        if not valid:
            await record_usage(
                db, user_id=user_id, route="lessons.generate",
                action_type=action_type, status="allowed",
                error_reason="validation_failed",
                request_metadata={
                    "attempt": attempt, "validation": "failed",
                    "errors": errors[:5], "topic": topic,
                },
            )
            logger.warning(
                "Validation failed user=%s attempt=%d errors=%s",
                user_id, attempt, errors[:5],
            )
            last_errors = errors
            continue

        # 4. Score.
        blocks = raw["blocks"]
        scoring = score_lesson_blocks(blocks)
        per_block = scoring.get("per_block", {})
        for b in blocks:
            pb = per_block.get(b.get("key"))
            if pb:
                b["score"] = pb["score"]
                b["violations"] = pb["violations"]

        # 5. Refuse to save a zero-score lesson (defensive backstop).
        overall = scoring.get("overall_score", 0) or 0
        if overall <= 0:
            await record_usage(
                db, user_id=user_id, route="lessons.generate",
                action_type=action_type, status="allowed",
                error_reason="overall_score_zero",
                request_metadata={"attempt": attempt, "validation": "failed", "topic": topic},
            )
            last_errors = ["overall_score is zero — lesson appears empty"]
            continue

        # 6. Save exactly once.
        lesson_id = str(uuid.uuid4())
        doc: Dict[str, Any] = {
            "id": lesson_id,
            "owner_id": user_id,
            "topic": raw.get("topic") or topic,
            "exam_board": raw.get("exam_board") or exam_board,
            "tier": raw.get("tier") or tier,
            "subject": raw.get("subject") or "GCSE Biology",
            "spec_point": raw.get("spec_point"),
            "objective": raw.get("objective"),
            "blocks": blocks,
            "scoring": scoring,
            "model_used": "anthropic/claude-sonnet-4-5",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "generation_attempt": attempt,
        }
        await db.lessons.insert_one({**doc})

        await record_usage(
            db, user_id=user_id, route="lessons.generate",
            action_type=action_type, status="allowed",
            request_metadata={
                "attempt": attempt, "validation": "passed",
                "lesson_id": lesson_id, "topic": topic,
            },
        )
        doc.pop("_id", None)
        return doc

    raise InvalidLessonError(last_errors or ["validation failed"])


__all__ = [
    "MAX_ATTEMPTS",
    "LLM_TIMEOUT_SECONDS",
    "InvalidLessonError",
    "LLMProviderUnavailable",
    "LLMTimeoutError",
    "generate_validated_lesson",
]
