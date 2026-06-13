"""
Teacher Brain — P0.2 Per-user LLM budget cap tests.

Pattern: live HTTP via `requests` (same as backend_test.py) + direct pymongo
for pre-seeding `llm_usage` rows. The over-limit tests never hit the LLM
provider, so they are FREE to run. The under-limit test verifies the budget
LOGIC via /api/auth/usage and does NOT call the expensive endpoint.

Run with:
    cd backend && python -m pytest tests/test_usage.py -v
"""
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pymongo
import pytest
import requests


# ----------------------------------------------------------------------
# Config — env-first, with relative .env fallback (repo-agnostic).
# Set these in your shell, CI, or pytest env before running:
#   REACT_APP_BACKEND_URL, MONGO_URL, DB_NAME,
#   ADMIN_EMAIL, ADMIN_PASSWORD,
#   TEACHER_BRAIN_DAILY_LLM_LIMIT, TEACHER_BRAIN_MONTHLY_LLM_LIMIT
# Otherwise the helper below walks up from this test file to locate
# `backend/.env` and `frontend/.env`.
# ----------------------------------------------------------------------

def _find_repo_file(*candidates):
    """Walk up from this file looking for any of the candidate relative paths."""
    here = Path(__file__).resolve()
    for parent in [here.parent, *here.parents]:
        for rel in candidates:
            p = parent / rel
            if p.is_file():
                return p
    return None


def _read_env_file(path, key):
    if path is None:
        return None
    try:
        with open(path) as f:
            for line in f:
                if line.startswith(f"{key}="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except FileNotFoundError:
        return None
    return None


_FRONTEND_ENV = _find_repo_file("frontend/.env", "../frontend/.env")
_BACKEND_ENV = _find_repo_file("backend/.env", ".env", "../.env")


def _cfg(key, default=None, env_file=_BACKEND_ENV):
    return os.environ.get(key) or _read_env_file(env_file, key) or default


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or _read_env_file(
    _FRONTEND_ENV, "REACT_APP_BACKEND_URL"
)
assert BASE_URL, (
    "REACT_APP_BACKEND_URL not configured. "
    "Set it in env or in <repo>/frontend/.env."
)
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = _cfg("MONGO_URL")
DB_NAME = _cfg("DB_NAME")
assert MONGO_URL and DB_NAME, (
    "MONGO_URL / DB_NAME not configured. "
    "Set them in env or in <repo>/backend/.env."
)

ADMIN_EMAIL = _cfg("ADMIN_EMAIL", "teacher@letsrevise.dev")
ADMIN_PASSWORD = _cfg("ADMIN_PASSWORD", "LetsRevise!2026")

DAILY_LIMIT = int(_cfg("TEACHER_BRAIN_DAILY_LLM_LIMIT", "10"))
MONTHLY_LIMIT = int(_cfg("TEACHER_BRAIN_MONTHLY_LLM_LIMIT", "100"))


# ----------------------------------------------------------------------
# Fixtures
# ----------------------------------------------------------------------

@pytest.fixture(scope="session")
def mongo():
    client = pymongo.MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    db = client[DB_NAME]
    yield db
    client.close()


@pytest.fixture(scope="session")
def token():
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def user_id(token):
    r = requests.get(
        f"{API}/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()["id"]


@pytest.fixture(autouse=True)
def clean_usage(mongo, user_id):
    """Wipe the test user's llm_usage rows BEFORE each test only.
    Lessons/attempts are untouched (won't grow during over-limit tests because
    LLM is rejected before the provider call)."""
    mongo.llm_usage.delete_many({"user_id": user_id})
    yield
    # Best-effort tidy
    mongo.llm_usage.delete_many({"user_id": user_id})


def _seed_allowed(db, user_id, count, when="today"):
    """Insert `count` rows simulating allowed LLM calls for today or this month."""
    now = datetime.now(timezone.utc)
    day = now.strftime("%Y-%m-%d")
    month = now.strftime("%Y-%m")
    docs = []
    for _ in range(count):
        docs.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "route": "lessons.generate",
            "action_type": "lesson_generation",
            "provider": "anthropic",
            "status": "allowed",
            "estimated_cost_units": 1.0,
            # day_key today, month_key always current month
            "day_key": day if when == "today" else "1999-01-01",
            "month_key": month,
            "created_at": now.isoformat(),
            "request_metadata": {"seeded": True},
            "error_reason": None,
        })
    if docs:
        db.llm_usage.insert_many(docs)


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ----------------------------------------------------------------------
# Tests
# ----------------------------------------------------------------------

def test_usage_endpoint_zero_baseline(token, user_id, mongo):
    """Authenticated user with no usage rows sees a zero baseline."""
    r = requests.get(f"{API}/auth/usage", headers=_auth_headers(token), timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["daily_used"] == 0
    assert data["monthly_used"] == 0
    assert data["daily_limit"] == DAILY_LIMIT
    assert data["monthly_limit"] == MONTHLY_LIMIT
    assert data["daily_remaining"] == DAILY_LIMIT
    assert data["monthly_remaining"] == MONTHLY_LIMIT


def test_anonymous_generate_is_401_not_429(mongo, user_id):
    """Anonymous user hits 401 BEFORE budget logic — no usage row recorded."""
    pre = mongo.llm_usage.count_documents({"user_id": user_id})
    r = requests.post(
        f"{API}/lessons/generate",
        json={"topic": "Photosynthesis"},
        headers={"Content-Type": "application/json"},
        timeout=15,
    )
    assert r.status_code == 401, r.text
    post = mongo.llm_usage.count_documents({"user_id": user_id})
    assert post == pre, "Anonymous request must not create an llm_usage row"


def test_over_daily_limit_returns_429(token, user_id, mongo):
    """Pre-seed daily limit; expect 429 with exact spec shape; provider not called."""
    _seed_allowed(mongo, user_id, DAILY_LIMIT, when="today")
    lessons_before = mongo.lessons.count_documents({"owner_id": user_id})

    r = requests.post(
        f"{API}/lessons/generate",
        json={"topic": "Cell biology"},
        headers=_auth_headers(token),
        timeout=15,
    )

    assert r.status_code == 429, r.text
    body = r.json()
    assert body["limit_type"] == "daily"
    assert body["code"] == "DAILY_LLM_LIMIT_REACHED"
    assert "Daily AI usage limit" in body["detail"]

    # Provider NOT called → no new lesson document
    lessons_after = mongo.lessons.count_documents({"owner_id": user_id})
    assert lessons_after == lessons_before, "LLM must not be called on rejected budget"

    # A rejected audit row was inserted
    rejected = mongo.llm_usage.count_documents(
        {"user_id": user_id, "status": "rejected", "error_reason": "daily_limit_reached"}
    )
    assert rejected >= 1


def test_over_monthly_limit_returns_429(token, user_id, mongo):
    """Pre-seed monthly limit on a different day_key; expect 429 monthly."""
    _seed_allowed(mongo, user_id, MONTHLY_LIMIT, when="this_month_diff_day")
    lessons_before = mongo.lessons.count_documents({"owner_id": user_id})

    r = requests.post(
        f"{API}/lessons/generate",
        json={"topic": "Cell biology"},
        headers=_auth_headers(token),
        timeout=15,
    )

    assert r.status_code == 429, r.text
    body = r.json()
    assert body["limit_type"] == "monthly"
    assert body["code"] == "MONTHLY_LLM_LIMIT_REACHED"
    assert "Monthly AI usage limit" in body["detail"]

    lessons_after = mongo.lessons.count_documents({"owner_id": user_id})
    assert lessons_after == lessons_before, "LLM must not be called on rejected budget"

    rejected = mongo.llm_usage.count_documents(
        {"user_id": user_id, "status": "rejected", "error_reason": "monthly_limit_reached"}
    )
    assert rejected >= 1


def test_over_daily_limit_blocks_mark_endpoint_too(token, user_id, mongo):
    """The mark endpoint must respect the same daily cap."""
    _seed_allowed(mongo, user_id, DAILY_LIMIT, when="today")

    # Use the existing seed lesson id (publicly readable)
    r = requests.post(
        f"{API}/lessons/30e99d36-35af-4d88-a9fe-003549a325b1/mark",
        json={
            "question": "Explain how impulses travel.",
            "marks_possible": 3,
            "mark_scheme": [],
            "student_answer": "Receptors detect the stimulus.",
        },
        headers=_auth_headers(token),
        timeout=15,
    )
    assert r.status_code == 429, r.text
    body = r.json()
    assert body["code"] == "DAILY_LLM_LIMIT_REACHED"


def test_public_lessons_read_still_works():
    """GET /api/lessons stays public even after budget logic landed."""
    r = requests.get(f"{API}/lessons?limit=3", timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_seed_lesson_still_readable_anonymously():
    """Acceptance: the existing seed lesson must remain anonymously viewable."""
    r = requests.get(
        f"{API}/lessons/30e99d36-35af-4d88-a9fe-003549a325b1", timeout=10
    )
    assert r.status_code == 200
    assert r.json().get("topic") == "Homeostasis"


def test_usage_endpoint_reflects_seeded_allowed_rows(token, user_id, mongo):
    """Seeding 3 allowed rows today should make daily_used=3 via /usage."""
    _seed_allowed(mongo, user_id, 3, when="today")
    r = requests.get(f"{API}/auth/usage", headers=_auth_headers(token), timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["daily_used"] == 3
    assert data["daily_remaining"] == DAILY_LIMIT - 3
