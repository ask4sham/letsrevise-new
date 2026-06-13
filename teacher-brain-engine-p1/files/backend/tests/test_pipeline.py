"""
Teacher Brain — P0.3 + P0.5 pipeline integration tests (mock LLM, no provider cost).

Run:
    cd backend && python -m pytest tests/test_pipeline.py -v
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import pytest
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from lesson_pipeline import (  # noqa: E402
    LLMProviderUnavailable,
    LLMTimeoutError,
    InvalidLessonError,
    generate_validated_lesson,
)
import lesson_pipeline as pipeline_mod  # noqa: E402
from usage import BudgetExceeded, daily_limit  # noqa: E402
from idempotency import InflightRegistry, GenerationInProgress  # noqa: E402

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


def _good_body(extra: str = "") -> str:
    return (
        "<p>Examiners expect that electrical impulses are transmitted along "
        "neurones because receptors detect the stimulus and coordinate responses; "
        "therefore homeostasis is maintained.</p>" + extra
    )


def _good_payload(topic: str = "Homeostasis") -> Dict[str, Any]:
    return {
        "topic": topic, "subject": "GCSE Biology", "exam_board": "AQA",
        "tier": "Higher", "spec_point": "4.5.1",
        "objective": "Understand homeostasis.",
        "blocks": [
            {"key": "objectives", "title": "OBJECTIVES",
             "body_html": "<ul><li>Define homeostasis here</li><li>Negative feedback explained</li></ul>",
             "protected": True},
            {"key": "definition", "title": "DEFINITION",
             "body_html": _good_body(), "protected": True},
            {"key": "coreTeaching", "title": "CORE LEARNING",
             "body_html": (
                 "<p>Examiners expect students to explain that the hypothalamus "
                 "detects a change in core temperature and coordinates effectors "
                 "because negative feedback restores set point.</p>"
             ),
             "protected": False},
            {"key": "commonMistake", "title": "COMMON MISTAKE",
             "body_html": (
                 "<p>Students often write 'messages travel through nerves'. "
                 "Examiners expect: 'electrical impulses transmitted along neurones'.</p>"
             ),
             "protected": False},
            {"key": "examTip", "title": "EXAM TIP",
             "body_html": (
                 "<p>To gain full marks, link stimulus → receptor → coordination "
                 "centre → effector because each earns a credit.</p>"
             ),
             "protected": False},
            {"key": "workedExample", "title": "WORKED EXAMPLE",
             "body_html": (
                 "<p>Question: Explain how the body responds to a rise in core "
                 "temperature (3 marks).</p><ol>"
                 "<li>1. Thermoreceptors detect the rise because specialised cells.</li>"
                 "<li>2. Impulses travel along neurones to the hypothalamus, therefore informed.</li>"
                 "<li>3. Effectors increase sweat production so that heat is lost as a result.</li>"
                 "</ol>"
             ),
             "protected": False},
            {"key": "summary", "title": "SUMMARY",
             "body_html": _good_body(" Negative feedback maintains constant conditions."),
             "protected": True},
        ],
    }


class MockLlm:
    def __init__(self, responses: List[Any]):
        self.responses = list(responses)
        self.calls: List[Dict[str, Any]] = []

    async def __call__(self, topic, **kwargs):
        self.calls.append({"topic": topic, "kwargs": kwargs})
        if not self.responses:
            raise AssertionError("Mock LLM ran out of scripted responses")
        nxt = self.responses.pop(0)
        if isinstance(nxt, Exception):
            raise nxt
        if asyncio.iscoroutine(nxt):
            return await nxt
        return nxt


def _run(coro):
    return asyncio.run(coro)


def _new_test_user_id() -> str:
    return "test-pipeline-" + uuid.uuid4().hex


async def _setup():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    user_id = _new_test_user_id()
    await db.llm_usage.delete_many({"user_id": user_id})
    await db.lessons.delete_many({"owner_id": user_id})
    return client, db, user_id


async def _teardown(client, db, user_id):
    await db.llm_usage.delete_many({"user_id": user_id})
    await db.lessons.delete_many({"owner_id": user_id})
    client.close()


# ----------------------------------------------------------------------
# P0.3 path tests (regression)
# ----------------------------------------------------------------------

def test_valid_payload_saves_once_on_first_attempt():
    async def body():
        client, db, user_id = await _setup()
        try:
            llm = MockLlm([_good_payload()])
            result = await generate_validated_lesson(
                db=db, user_id=user_id, topic="Homeostasis",
                exam_board="AQA", tier="Higher", llm_fn=llm)
            assert result["generation_attempt"] == 1
            assert len(llm.calls) == 1
            assert await db.lessons.count_documents({"owner_id": user_id}) == 1
        finally:
            await _teardown(client, db, user_id)
    _run(body())


def test_invalid_then_valid_saves_once_with_two_usage_rows():
    async def body():
        client, db, user_id = await _setup()
        try:
            llm = MockLlm([{"topic": "X"}, _good_payload()])  # first invalid
            result = await generate_validated_lesson(
                db=db, user_id=user_id, topic="Homeostasis",
                exam_board="AQA", tier="Higher", llm_fn=llm)
            assert result["generation_attempt"] == 2
            assert len(llm.calls) == 2
            assert "repair_guidance" in llm.calls[1]["kwargs"]
            assert await db.lessons.count_documents({"owner_id": user_id}) == 1
        finally:
            await _teardown(client, db, user_id)
    _run(body())


def test_invalid_twice_raises_422_and_saves_no_lesson():
    async def body():
        client, db, user_id = await _setup()
        try:
            llm = MockLlm(["raw string", {"missing": "blocks"}])
            with pytest.raises(InvalidLessonError):
                await generate_validated_lesson(
                    db=db, user_id=user_id, topic="Homeostasis",
                    exam_board="AQA", tier="Higher", llm_fn=llm)
            assert await db.lessons.count_documents({"owner_id": user_id}) == 0
            assert len(llm.calls) == 2  # hard ceiling
        finally:
            await _teardown(client, db, user_id)
    _run(body())


def test_budget_exceeded_before_first_attempt_no_llm_call():
    async def body():
        client, db, user_id = await _setup()
        try:
            now = datetime.now(timezone.utc)
            day = now.strftime("%Y-%m-%d"); month = now.strftime("%Y-%m")
            rows = [{
                "id": str(uuid.uuid4()), "user_id": user_id,
                "route": "lessons.generate", "action_type": "first_generation_attempt",
                "provider": "anthropic", "status": "allowed",
                "estimated_cost_units": 1.0, "day_key": day, "month_key": month,
                "created_at": now.isoformat(),
                "request_metadata": {"seeded": True}, "error_reason": None,
            } for _ in range(daily_limit())]
            await db.llm_usage.insert_many(rows)
            llm = MockLlm([_good_payload()])
            with pytest.raises(BudgetExceeded):
                await generate_validated_lesson(
                    db=db, user_id=user_id, topic="Homeostasis",
                    exam_board="AQA", tier="Higher", llm_fn=llm)
            assert len(llm.calls) == 0
            assert await db.lessons.count_documents({"owner_id": user_id}) == 0
        finally:
            await _teardown(client, db, user_id)
    _run(body())


# ----------------------------------------------------------------------
# P0.5 new tests
# ----------------------------------------------------------------------

def test_llm_timeout_returns_503_envelope_and_no_lesson():
    """LLM call exceeding LLM_TIMEOUT_SECONDS raises LLMTimeoutError, no lesson saved."""
    async def body():
        client, db, user_id = await _setup()
        try:
            # Temporarily shrink the timeout so the test is fast
            orig = pipeline_mod.LLM_TIMEOUT_SECONDS
            pipeline_mod.LLM_TIMEOUT_SECONDS = 0.2

            async def slow_llm(topic, **kwargs):
                await asyncio.sleep(2.0)  # > 0.2
                return _good_payload()

            try:
                with pytest.raises(LLMTimeoutError):
                    await generate_validated_lesson(
                        db=db, user_id=user_id, topic="Homeostasis",
                        exam_board="AQA", tier="Higher", llm_fn=slow_llm)
            finally:
                pipeline_mod.LLM_TIMEOUT_SECONDS = orig

            # No lesson saved
            assert await db.lessons.count_documents({"owner_id": user_id}) == 0
            # One usage row with status=failed, error_reason=llm_timeout (doesn't count against quota)
            rows = await db.llm_usage.find({"user_id": user_id}).to_list(10)
            assert len(rows) == 1
            assert rows[0]["status"] == "failed"
            assert rows[0]["error_reason"] == "llm_timeout"
        finally:
            await _teardown(client, db, user_id)
    _run(body())


def test_llm_provider_exception_returns_503_and_no_lesson():
    async def body():
        client, db, user_id = await _setup()
        try:
            llm = MockLlm([RuntimeError("upstream 503 from Anthropic")])
            with pytest.raises(LLMProviderUnavailable) as exc_info:
                await generate_validated_lesson(
                    db=db, user_id=user_id, topic="Homeostasis",
                    exam_board="AQA", tier="Higher", llm_fn=llm)
            # Sensitive provider text is captured internally but truncated
            assert "Anthropic" in exc_info.value.reason
            # No lesson saved
            assert await db.lessons.count_documents({"owner_id": user_id}) == 0
            # One failed usage row
            rows = await db.llm_usage.find({"user_id": user_id}).to_list(10)
            assert len(rows) == 1 and rows[0]["status"] == "failed"
        finally:
            await _teardown(client, db, user_id)
    _run(body())


def test_idempotency_lock_blocks_concurrent_duplicate():
    """Second concurrent request for same (user, topic) hits 409 — no LLM call, no duplicate."""
    async def body():
        registry = InflightRegistry()
        client, db, user_id = await _setup()
        try:
            llm = MockLlm([_good_payload(), _good_payload()])

            async def one():
                async with registry.lock(user_id=user_id, topic="Homeostasis"):
                    return await generate_validated_lesson(
                        db=db, user_id=user_id, topic="Homeostasis",
                        exam_board="AQA", tier="Higher", llm_fn=llm)

            async def two():
                # Tiny delay so `one` enters first
                await asyncio.sleep(0.01)
                async with registry.lock(user_id=user_id, topic="Homeostasis"):
                    return await generate_validated_lesson(
                        db=db, user_id=user_id, topic="Homeostasis",
                        exam_board="AQA", tier="Higher", llm_fn=llm)

            # Make `one` slow enough that `two` races into the lock check
            async def slow_llm(topic, **kwargs):
                await asyncio.sleep(0.2)
                return _good_payload()
            llm = MockLlm([])  # not used; we shadow llm_fn
            # Override via fresh MockLlm scripted with slow call
            slow = MockLlm([])
            async def slow_call(topic, **kwargs):
                slow.calls.append({"topic": topic, "kwargs": kwargs})
                await asyncio.sleep(0.2)
                return _good_payload()

            async def one_slow():
                async with registry.lock(user_id=user_id, topic="Homeostasis"):
                    return await generate_validated_lesson(
                        db=db, user_id=user_id, topic="Homeostasis",
                        exam_board="AQA", tier="Higher", llm_fn=slow_call)

            async def two_slow():
                await asyncio.sleep(0.05)
                async with registry.lock(user_id=user_id, topic="Homeostasis"):
                    return await generate_validated_lesson(
                        db=db, user_id=user_id, topic="Homeostasis",
                        exam_board="AQA", tier="Higher", llm_fn=slow_call)

            results = await asyncio.gather(one_slow(), two_slow(), return_exceptions=True)
            successes = [r for r in results if isinstance(r, dict)]
            blocks = [r for r in results if isinstance(r, GenerationInProgress)]
            assert len(successes) == 1, f"expected exactly one success, got {results}"
            assert len(blocks) == 1, f"expected exactly one 409, got {results}"
            # Exactly one lesson saved
            assert await db.lessons.count_documents({"owner_id": user_id}) == 1
            # LLM called exactly once (the blocked request never invoked it)
            assert len(slow.calls) == 1
        finally:
            await _teardown(client, db, user_id)
    _run(body())


def test_inflight_lock_released_after_failure():
    """After a failure, the lock must be released so a retry can proceed."""
    async def body():
        registry = InflightRegistry()
        client, db, user_id = await _setup()
        try:
            with pytest.raises(LLMProviderUnavailable):
                async with registry.lock(user_id=user_id, topic="Homeostasis"):
                    await generate_validated_lesson(
                        db=db, user_id=user_id, topic="Homeostasis",
                        exam_board="AQA", tier="Higher",
                        llm_fn=MockLlm([RuntimeError("upstream")]))
            # Lock should be released — second attempt allowed
            async with registry.lock(user_id=user_id, topic="Homeostasis"):
                result = await generate_validated_lesson(
                    db=db, user_id=user_id, topic="Homeostasis",
                    exam_board="AQA", tier="Higher", llm_fn=MockLlm([_good_payload()]))
            assert result["id"]
        finally:
            await _teardown(client, db, user_id)
    _run(body())
