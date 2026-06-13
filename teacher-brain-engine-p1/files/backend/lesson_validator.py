"""
Teacher Brain — P0.3 Lesson payload validator.

Read-only Pydantic v2 schema applied between LLM output and database save.
Pure module — no I/O, no DB, no LLM. Easy to unit-test.

Public surface:
- SUPPORTED_BLOCK_KEYS
- REQUIRED_BLOCK_KEYS
- MIN_BLOCK_BODY_CHARS, MIN_BLOCKS
- validate_lesson_payload(data) -> (bool, list[str])
"""
from __future__ import annotations

from typing import Any, List, Optional, Tuple

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

# ---------------------------------------------------------------------------
# Supported block vocabulary
# ---------------------------------------------------------------------------

# Keys our current LLM emits (kept stable to avoid breaking the generator):
_CURRENT_BLOCK_KEYS = {
    "objectives",
    "definition",
    "coreTeaching",
    "commonMistake",
    "examTip",
    "workedExample",
    "summary",
}

# Forward-compatible types listed in the P0.3 spec (accepted but not required):
_FUTURE_BLOCK_KEYS = {
    "hook",
    "core_teaching",
    "worked_example",
    "examiner_tip",
    "misconception",
    "checkpoint",
    "memory_rule",
    "image_placeholder",
    "exam_practice",
}

SUPPORTED_BLOCK_KEYS = _CURRENT_BLOCK_KEYS | _FUTURE_BLOCK_KEYS

# Minimum required block keys for a lesson to be considered teachable.
# coreTeaching is the wedge — if it's missing the lesson has no value.
REQUIRED_BLOCK_KEYS = {"coreTeaching"}

MIN_BLOCK_BODY_CHARS = 20
MIN_BLOCKS = 3
MAX_BLOCKS = 30


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class BlockSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    key: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    body_html: str = Field(min_length=MIN_BLOCK_BODY_CHARS, max_length=20000)
    protected: bool = False

    @field_validator("key")
    @classmethod
    def _key_must_be_supported(cls, v: str) -> str:
        if v not in SUPPORTED_BLOCK_KEYS:
            raise ValueError(
                f"unsupported block key {v!r}; allowed: {sorted(SUPPORTED_BLOCK_KEYS)[:6]}…"
            )
        return v

    @field_validator("body_html")
    @classmethod
    def _body_not_only_whitespace(cls, v: str) -> str:
        # Strip simple HTML wrappers + collapse whitespace to check real content
        plain = (
            v.replace("<p>", " ")
            .replace("</p>", " ")
            .replace("<br>", " ")
            .replace("<br/>", " ")
            .replace("<br />", " ")
        )
        # Crude tag strip
        depth = 0
        out = []
        for ch in plain:
            if ch == "<":
                depth += 1
            elif ch == ">":
                depth = max(0, depth - 1)
            elif depth == 0:
                out.append(ch)
        text = "".join(out).strip()
        if len(text) < 10:
            raise ValueError("block body has no visible text content")
        return v


class LessonSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    topic: str = Field(min_length=1, max_length=200)
    subject: Optional[str] = Field(default="GCSE Biology", max_length=80)
    exam_board: Optional[str] = Field(default="AQA", max_length=40)
    tier: Optional[str] = Field(default="Higher", max_length=40)
    spec_point: Optional[str] = Field(default=None, max_length=80)
    objective: Optional[str] = Field(default=None, max_length=400)
    blocks: List[BlockSchema] = Field(min_length=MIN_BLOCKS, max_length=MAX_BLOCKS)

    @field_validator("blocks")
    @classmethod
    def _required_blocks_present(cls, v: List[BlockSchema]) -> List[BlockSchema]:
        keys = {b.key for b in v}
        missing = REQUIRED_BLOCK_KEYS - keys
        if missing:
            raise ValueError(
                f"required block(s) missing: {sorted(missing)}"
            )
        return v


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def validate_lesson_payload(data: Any) -> Tuple[bool, List[str]]:
    """
    Validate a lesson payload returned by the LLM.

    Returns:
        (True, []) on success
        (False, ["loc: msg", ...]) on failure — strings safe to expose to the client.
    """
    # Hard reject non-objects (e.g. raw strings, lists, None)
    if not isinstance(data, dict):
        return (
            False,
            [
                f"payload must be a JSON object, got {type(data).__name__}",
            ],
        )

    # Mandatory keys present at lesson level
    if "blocks" not in data:
        return (False, ["lesson.blocks is missing"])
    if not isinstance(data.get("blocks"), list):
        return (False, ["lesson.blocks must be an array"])
    if len(data["blocks"]) == 0:
        return (False, ["lesson.blocks must be a non-empty array"])

    try:
        LessonSchema.model_validate(data)
    except ValidationError as e:
        return (False, _format_errors(e))

    return (True, [])


def _format_errors(exc: ValidationError) -> List[str]:
    out: List[str] = []
    for err in exc.errors():
        loc = ".".join(str(p) for p in err.get("loc", ())) or "lesson"
        msg = err.get("msg", "invalid")
        out.append(f"{loc}: {msg}")
    # Cap the list — we never want to dump huge stack-trace-style noise
    return out[:20]


__all__ = [
    "SUPPORTED_BLOCK_KEYS",
    "REQUIRED_BLOCK_KEYS",
    "MIN_BLOCK_BODY_CHARS",
    "MIN_BLOCKS",
    "MAX_BLOCKS",
    "BlockSchema",
    "LessonSchema",
    "validate_lesson_payload",
]
