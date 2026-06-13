"""
Teacher Brain — P1.0 Visual Explanation tests.

Cheap, deterministic checks only. The LLM-calling generator itself is
exercised live via the demo UI; these tests verify the shape contract,
the auth gate, and the input validation — i.e. anything that doesn't
require burning LLM budget.

Run with:
    cd backend && python -m pytest tests/test_visual_explanation.py -v
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
import requests

# Reuse the portable env discovery pattern from test_usage.py
HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parent.parent))  # so backend/ is importable


def _find_repo_file(*candidates):
    for parent in [HERE.parent, *HERE.parents]:
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
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or _read_env_file(
    _FRONTEND_ENV, "REACT_APP_BACKEND_URL"
)
assert BASE_URL, "REACT_APP_BACKEND_URL not configured"
API = BASE_URL.rstrip("/") + "/api"


# ----------------------------------------------------------------------
# Auth + validation gates (no LLM cost)
# ----------------------------------------------------------------------

def test_visual_explanation_requires_auth():
    """Anonymous request must return 401, not 422 or 500."""
    r = requests.post(
        f"{API}/visual-explanations/generate",
        json={"topic": "The eye"},
        timeout=10,
    )
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_visual_explanation_rejects_invalid_bearer():
    r = requests.post(
        f"{API}/visual-explanations/generate",
        json={"topic": "The eye"},
        headers={"Authorization": "Bearer obviously-broken"},
        timeout=10,
    )
    assert r.status_code == 401


def test_visual_explanation_rejects_empty_topic():
    """422 from Pydantic validation must fire for empty topic, BEFORE any LLM call."""
    # Login first so we get past the 401 gate.
    _ADMIN_ENV = _find_repo_file("backend/.env", ".env", "../.env")
    email = os.environ.get("ADMIN_EMAIL") or _read_env_file(_ADMIN_ENV, "ADMIN_EMAIL")
    password = os.environ.get("ADMIN_PASSWORD") or _read_env_file(_ADMIN_ENV, "ADMIN_PASSWORD")
    if not (email and password):
        pytest.skip("admin creds not available")
    tok = requests.post(
        f"{API}/auth/login", json={"email": email, "password": password}, timeout=10
    )
    if tok.status_code != 200:
        pytest.skip(f"admin login failed: {tok.status_code}")
    bearer = tok.json()["access_token"]

    r = requests.post(
        f"{API}/visual-explanations/generate",
        json={"topic": "", "exam_board": "AQA", "tier": "Higher"},
        headers={"Authorization": f"Bearer {bearer}"},
        timeout=10,
    )
    assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text[:200]}"


# ----------------------------------------------------------------------
# Module-level sanity (no LLM cost)
# ----------------------------------------------------------------------

def test_visual_explanation_module_importable():
    import visual_explanation  # noqa: F401
    assert hasattr(visual_explanation, "build_visual_explanation")
    assert hasattr(visual_explanation, "generate_explanation_and_prompt")
    assert hasattr(visual_explanation, "generate_image_from_prompt")
    assert visual_explanation.NANO_BANANA_MODEL == "gemini-3.1-flash-image-preview"


def test_explanation_schema_doc_lists_required_fields():
    """Sanity check: the schema description includes every required field
    we'll later validate against in generate_explanation_and_prompt."""
    from visual_explanation import EXPLAIN_SCHEMA_DESC
    for key in (
        "what_image_shows", "key_parts", "step_by_step", "why_it_matters_gcse",
        "common_mistake", "exam_tip", "exam_question", "model_answer", "image_prompt",
    ):
        assert key in EXPLAIN_SCHEMA_DESC, f"{key} missing from schema doc"
