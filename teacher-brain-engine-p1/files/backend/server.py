"""
Teacher Brain MVP — FastAPI server.

P0.1 + P0.2 + P0.3 + P0.5 hardening:
  - JWT auth on expensive routes
  - Per-user daily + monthly LLM budget cap
  - Server-side schema validation + 1 auto-regenerate retry
  - Explicit LLM timeout + transient-failure envelope + idempotency lock
"""
from __future__ import annotations

import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from pydantic import BaseModel, ConfigDict, EmailStr, Field  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402

from lesson_engine import score_lesson_blocks, V2_TARGET_BLOCK_KEYS, PROTECTED_BLOCK_KEYS  # noqa: E402
from lesson_generator import generate_lesson, mark_answer  # noqa: E402
from lesson_pipeline import (  # noqa: E402
    LLMProviderUnavailable,
    LLMTimeoutError,
    LLM_TIMEOUT_SECONDS,
    InvalidLessonError,
    generate_validated_lesson,
)
from idempotency import GenerationInProgress, InflightRegistry  # noqa: E402
from auth import (  # noqa: E402
    authenticate_user, create_access_token, ensure_indexes,
    get_current_user, public_user, register_user, seed_admin,
)
from usage import (  # noqa: E402
    BudgetExceeded, check_budget, ensure_usage_indexes,
    get_user_usage, record_usage,
)
from visual_explanation import build_visual_explanation  # noqa: E402

MARK_TIMEOUT_SECONDS = 60.0
VISUAL_TIMEOUT_SECONDS = 120.0

# ----------------------------------------------------------------------
# DB
# ----------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("teacher-brain")

# ----------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------

class BlockIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    key: str
    title: str
    body_html: str
    protected: bool = False


class GenerateRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=200)
    exam_board: str = "AQA"
    tier: str = "Higher"


class ScoreRequest(BaseModel):
    blocks: List[BlockIn]


class MarkRequest(BaseModel):
    question: str = Field(min_length=2, max_length=500)
    marks_possible: int = Field(default=3, ge=1, le=20)
    mark_scheme: List[str] = Field(default_factory=list)
    student_answer: str = Field(min_length=1, max_length=4000)


class LessonOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    topic: str
    exam_board: str
    tier: str
    subject: str = "GCSE Biology"
    spec_point: Optional[str] = None
    objective: Optional[str] = None
    blocks: List[Dict[str, Any]]
    scoring: Dict[str, Any]
    created_at: str
    model_used: Optional[str] = None
    owner_id: Optional[str] = None
    generation_attempt: Optional[int] = None


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: Optional[str] = Field(default=None, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


# ----------------------------------------------------------------------
# App
# ----------------------------------------------------------------------
app = FastAPI(title="Teacher Brain MVP", version="0.5.0")
app.state.db = db
app.state.inflight = InflightRegistry()

api = APIRouter(prefix="/api")


# ===== Exception handlers =====

@app.exception_handler(BudgetExceeded)
async def _budget_exception_handler(_request: Request, exc: BudgetExceeded):
    return JSONResponse(status_code=429, content={
        "detail": exc.message, "code": exc.code, "limit_type": exc.limit_type,
    })


@app.exception_handler(InvalidLessonError)
async def _invalid_lesson_handler(_request: Request, exc: InvalidLessonError):
    return JSONResponse(status_code=422, content={
        "detail": "The AI returned a malformed lesson. Please try again.",
        "code": "INVALID_GENERATED_LESSON",
        "validation_errors": exc.errors,
    })


@app.exception_handler(LLMTimeoutError)
async def _llm_timeout_handler(_request: Request, _exc: LLMTimeoutError):
    return JSONResponse(status_code=503, content={
        "detail": "The AI service took too long to respond. Please try again.",
        "code": "LLM_TIMEOUT",
        "retryable": True,
    })


@app.exception_handler(LLMProviderUnavailable)
async def _llm_provider_handler(_request: Request, _exc: LLMProviderUnavailable):
    return JSONResponse(status_code=503, content={
        "detail": "The AI service is temporarily unavailable. Please try again.",
        "code": "LLM_PROVIDER_UNAVAILABLE",
        "retryable": True,
    })


@app.exception_handler(GenerationInProgress)
async def _inflight_handler(_request: Request, _exc: GenerationInProgress):
    return JSONResponse(status_code=409, content={
        "detail": "A generation request is already in progress. Please wait.",
        "code": "GENERATION_ALREADY_IN_PROGRESS",
        "retryable": False,
    })


# ===== Public =====

@api.get("/")
async def root():
    return {
        "service": "teacher-brain",
        "version": "0.5.0",
        "auth": "jwt-bearer",
        "budget_cap": "per-user-daily-monthly",
        "validation": "strict-schema-with-1-retry",
        "llm_timeout_seconds": LLM_TIMEOUT_SECONDS,
        "idempotency": "in-process-lock",
        "target_blocks": V2_TARGET_BLOCK_KEYS,
        "protected_blocks": sorted(PROTECTED_BLOCK_KEYS),
    }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ===== Auth =====

@api.post("/auth/register", response_model=TokenResponse)
async def auth_register(req: RegisterRequest):
    user = await register_user(db, req.email, req.password, req.name)
    token = create_access_token(user["id"], user["email"], user.get("role", "teacher"))
    return TokenResponse(access_token=token, user=public_user(user))


@api.post("/auth/login", response_model=TokenResponse)
async def auth_login(req: LoginRequest):
    user = await authenticate_user(db, req.email, req.password)
    token = create_access_token(user["id"], user["email"], user.get("role", "teacher"))
    return TokenResponse(access_token=token, user=public_user(user))


@api.post("/auth/logout")
async def auth_logout(response: Response, _user=Depends(get_current_user)):
    response.delete_cookie("access_token")
    return {"ok": True}


@api.get("/auth/me")
async def auth_me(user=Depends(get_current_user)):
    return public_user(user)


@api.get("/auth/usage")
async def auth_usage(user=Depends(get_current_user)):
    return await get_user_usage(db, user["id"])


# ===== Lessons =====

@api.post("/lessons/generate", response_model=LessonOut)
async def generate(req: GenerateRequest, user=Depends(get_current_user)):
    """[AUTH + BUDGET + VALIDATE + IDEMPOTENT + TIMEOUT-SAFE]."""
    async with app.state.inflight.lock(user_id=user["id"], topic=req.topic):
        return await generate_validated_lesson(
            db=db,
            user_id=user["id"],
            topic=req.topic,
            exam_board=req.exam_board,
            tier=req.tier,
            llm_fn=generate_lesson,
        )


@api.post("/lessons/score")
async def score(req: ScoreRequest):
    return score_lesson_blocks([b.model_dump() for b in req.blocks])


@api.post("/lessons/{lesson_id}/mark")
async def mark(lesson_id: str, req: MarkRequest, user=Depends(get_current_user)):
    """[AUTH + BUDGET + TIMEOUT-SAFE]."""
    if not req.student_answer.strip():
        raise HTTPException(status_code=400, detail="student_answer is required")

    await check_budget(db, user_id=user["id"], route="lessons.mark")

    try:
        result = await asyncio.wait_for(
            mark_answer(
                question=req.question,
                marks_possible=req.marks_possible,
                mark_scheme=req.mark_scheme,
                student_answer=req.student_answer,
            ),
            timeout=MARK_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        await record_usage(
            db, user_id=user["id"], route="lessons.mark",
            action_type="answer_marking", status="failed",
            error_reason="llm_timeout",
            request_metadata={"lesson_id": lesson_id},
        )
        logger.warning("Mark timeout user=%s lesson=%s", user["id"], lesson_id)
        raise LLMTimeoutError()
    except Exception as e:
        await record_usage(
            db, user_id=user["id"], route="lessons.mark",
            action_type="answer_marking", status="failed",
            error_reason=str(e)[:240],
            request_metadata={"lesson_id": lesson_id},
        )
        logger.exception("mark_answer failed user=%s lesson=%s", user["id"], lesson_id)
        raise LLMProviderUnavailable(str(e)) from e

    attempt = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "lesson_id": lesson_id,
        "question": req.question,
        "marks_possible": req.marks_possible,
        "student_answer": req.student_answer,
        "result": result,
        "created_at": _now_iso(),
    }
    await db.attempts.insert_one({**attempt})

    await record_usage(
        db, user_id=user["id"], route="lessons.mark",
        action_type="answer_marking", status="allowed",
        request_metadata={"lesson_id": lesson_id, "attempt_id": attempt["id"]},
    )
    return attempt


@api.get("/lessons")
async def list_lessons(limit: int = 30):
    limit = max(1, min(100, int(limit)))
    docs = await db.lessons.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [
        {
            "id": d["id"], "topic": d["topic"],
            "exam_board": d.get("exam_board"), "tier": d.get("tier"),
            "spec_point": d.get("spec_point"),
            "overall_score": d.get("scoring", {}).get("overall_score"),
            "pass": d.get("scoring", {}).get("pass"),
            "created_at": d.get("created_at"),
        }
        for d in docs
    ]


@api.get("/lessons/{lesson_id}", response_model=LessonOut)
async def get_lesson(lesson_id: str):
    doc = await db.lessons.find_one({"id": lesson_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return doc


@api.delete("/lessons/{lesson_id}")
async def delete_lesson(lesson_id: str, _user=Depends(get_current_user)):
    res = await db.lessons.delete_one({"id": lesson_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return {"deleted": lesson_id}


# ===== P1.0 — Visual explanations =====

class VisualExplanationRequest(BaseModel):
    topic: str = Field(min_length=2, max_length=200)
    context: Optional[str] = Field(default=None, max_length=600)
    subject: str = "GCSE Biology"
    exam_board: str = "AQA"
    tier: str = "Higher"
    lesson_id: Optional[str] = None
    block_key: Optional[str] = None


@api.post("/visual-explanations/generate")
async def generate_visual_explanation(
    req: VisualExplanationRequest, user=Depends(get_current_user),
):
    await check_budget(db, user_id=user["id"], route="visual_explanations.generate")
    try:
        explanation, image, status = await asyncio.wait_for(
            build_visual_explanation(
                topic=req.topic,
                subject=req.subject,
                exam_board=req.exam_board,
                tier=req.tier,
                context=req.context,
            ),
            timeout=VISUAL_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        await record_usage(
            db, user_id=user["id"], route="visual_explanations.generate",
            action_type="visual_explanation", status="failed",
            error_reason="llm_timeout",
        )
        logger.warning("Visual explanation timeout user=%s topic=%s", user["id"], req.topic[:60])
        raise LLMTimeoutError()
    except ValueError as e:
        await record_usage(
            db, user_id=user["id"], route="visual_explanations.generate",
            action_type="visual_explanation", status="failed",
            error_reason=f"invalid_explanation:{str(e)[:200]}",
        )
        raise HTTPException(status_code=422, detail={
            "code": "INVALID_VISUAL_EXPLANATION",
            "message": "The AI returned a malformed explanation. Please try again.",
        })
    except Exception as e:
        await record_usage(
            db, user_id=user["id"], route="visual_explanations.generate",
            action_type="visual_explanation", status="failed",
            error_reason=str(e)[:240],
        )
        logger.exception("Visual explanation failed user=%s", user["id"])
        raise LLMProviderUnavailable(str(e)) from e

    doc = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "lesson_id": req.lesson_id,
        "block_key": req.block_key,
        "topic": req.topic,
        "subject": req.subject,
        "exam_board": req.exam_board,
        "tier": req.tier,
        "context": req.context,
        "image_prompt": explanation.get("image_prompt"),
        "explanation": {k: v for k, v in explanation.items() if k != "image_prompt"},
        "image_data_url": image["data_url"] if image else None,
        "image_mime_type": image["mime_type"] if image else None,
        "provider_status": status,
        "created_at": _now_iso(),
    }
    # We persist WITHOUT the (potentially large) image_data_url to keep the
    # collection lean. The data URL is returned inline to the client; if you
    # want re-hydration, store images on disk/S3 instead.
    persisted = {k: v for k, v in doc.items() if k != "image_data_url"}
    await db.visual_explanations.insert_one({**persisted})

    await record_usage(
        db, user_id=user["id"], route="visual_explanations.generate",
        action_type="visual_explanation", status="allowed",
        request_metadata={
            "visual_id": doc["id"],
            "lesson_id": req.lesson_id,
            "provider_status": status,
        },
    )

    return {
        "id": doc["id"],
        "lesson_id": doc["lesson_id"],
        "block_key": doc["block_key"],
        "topic": doc["topic"],
        "subject": doc["subject"],
        "exam_board": doc["exam_board"],
        "tier": doc["tier"],
        "explanation": doc["explanation"],
        "image_data_url": doc["image_data_url"],
        "image_mime_type": doc["image_mime_type"],
        "provider_status": doc["provider_status"],
        "created_at": doc["created_at"],
    }


app.include_router(api)

cors_origins = os.environ.get("CORS_ORIGINS", "*")
allow_origins = (
    ["*"] if cors_origins.strip() == "*"
    else [o.strip() for o in cors_origins.split(",") if o.strip()]
)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    try:
        await ensure_indexes(db)
        await ensure_usage_indexes(db)
        await seed_admin(db)
        logger.info(
            "Startup complete — admin seeded, indexes ensured "
            "(users + llm_usage). Budget caps, validation, "
            "LLM timeout (%.0fs), idempotency active.",
            LLM_TIMEOUT_SECONDS,
        )
    except Exception:
        logger.exception("Startup task failed")


@app.on_event("shutdown")
async def shutdown():
    client.close()
