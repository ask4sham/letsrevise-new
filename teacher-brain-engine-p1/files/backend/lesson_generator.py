"""
Teacher Brain MVP — LLM-driven lesson generator + Mark-it-now marker.
Uses Emergent LLM key via emergentintegrations.

P0.3: accepts an optional `repair_guidance` kwarg used by the auto-regenerate
pipeline. When set, the user message is prefixed with the validation errors
from the previous attempt so the LLM can self-correct.
"""
from __future__ import annotations

import json
import os
import re
import uuid
from typing import Any, Dict, List, Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage

from lesson_engine import DEFAULT_PROFILE

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# ----------------------------------------------------------------------
# Schema — what we ask the model to return
# ----------------------------------------------------------------------

LESSON_SCHEMA_DESC = """
Return a single JSON object (no markdown fences, no commentary) with this exact shape:

{
  "topic": "<the topic the user asked for>",
  "exam_board": "AQA",
  "tier": "Higher",
  "subject": "GCSE Biology",
  "spec_point": "<best-guess AQA spec point reference, e.g. '4.5.2.1'>",
  "objective": "<one sentence learning objective>",
  "blocks": [
    {"key": "objectives",     "title": "REVISION OBJECTIVES", "body_html": "<ul><li>...</li></ul>", "protected": true},
    {"key": "definition",     "title": "DEFINITION",          "body_html": "<p>...</p>",            "protected": true},
    {"key": "coreTeaching",   "title": "CORE LEARNING",       "body_html": "<p>...</p>",            "protected": false},
    {"key": "commonMistake",  "title": "COMMON MISTAKE",      "body_html": "<p>...</p>",            "protected": false},
    {"key": "examTip",        "title": "EXAM TIP",            "body_html": "<h3>Premium Exam Tip</h3><p>...</p>", "protected": false},
    {"key": "workedExample",  "title": "WORKED EXAMPLE",      "body_html": "<p>Question: ... (3 marks)</p><ol><li>...</li></ol>", "protected": false},
    {"key": "summary",        "title": "SUMMARY",             "body_html": "<ul><li>...</li></ul>", "protected": true}
  ]
}

The block keys MUST be exactly: objectives, definition, coreTeaching, commonMistake,
examTip, workedExample, summary. Every block MUST have a non-empty body_html with
real teaching content (>=20 visible characters). NEVER return raw strings,
apology messages, or markdown fences.
"""

EXAMINER_LANGUAGE_V2_APPENDIX = """
EXAMINER LANGUAGE V2 — MANDATORY for the four NON-PROTECTED blocks
(coreTeaching, commonMistake, examTip, workedExample). Do NOT apply this language
upgrade to protected blocks (objectives, definition, summary).

RULE 1 — Replace vague verbs (need, help, make, use, get, do) with scientific verbs:
provides, enables, results in, causes, stimulates, transmits, coordinates, regulates.

RULE 2 — Prefer cause → effect chains.
  Weak:   "Plants need light."
  Strong: "Light provides the energy required for photosynthesis."

RULE 3 — Prefer GCSE-specific nouns over vague wording:
  stimulus, receptor, effector, neurone, synapse, hypothalamus, thermoreceptor,
  diffusion gradient, insulin, glycogen, negative feedback.

RULE 4 — Use examiner connectives: because, therefore, thus, consequently,
as a result, so that, leading to, this means that.

RULE 5 — Worked Example MUST contain:
  - a question stem with mark count (e.g. "Explain how … (3 marks)")
  - 3+ numbered marking points
  - each marking point uses an examiner connective

CORE LEARNING RULE — the coreTeaching block MUST contain at least one examiner
framing line: "Examiners expect…", "Students often write…", "To gain full marks…",
or "A common reason marks are lost is…".

DO NOT include autofix scaffold text like:
  "One sentence that names what … is really about."
  "What happens first." / "What changes as a result."
"""


def _build_system_prompt(profile: Dict[str, Any]) -> str:
    v2 = profile.get("examinerLanguageV2", {})
    contrast = "\n".join(
        f"- Weak: {p['weak']}\n  Strong: {p['strong']}"
        for p in v2.get("contrastPairs", [])
    )
    exam_say = "\n".join(f"- {line}" for line in v2.get("examSayLines", []))
    gcse_terms = ", ".join(v2.get("gcseTerms", []))
    return f"""You are Teacher Brain, an examiner-grade GCSE lesson generator (AQA spec by default).

You produce structured, mark-scheme-aligned revision lessons for UK GCSE students,
teachers and tutors. Your output is rendered by a UI — never return markdown fences.

{LESSON_SCHEMA_DESC}

{EXAMINER_LANGUAGE_V2_APPENDIX}

PROFILE — preferred terminology:
{gcse_terms}

PROFILE — exam-style framing lines to model where natural:
{exam_say}

PROFILE — Weak → Strong contrast pairs to draw on (especially in Common Mistake):
{contrast}

OUTPUT REQUIREMENTS:
- Valid JSON only. No commentary. No code fences.
- body_html must contain clean HTML (<p>, <ul>, <ol>, <li>, <strong>, <em>, <h3>).
- Do NOT include <script>, <style>, or inline event handlers.
- Each block must be self-contained (no cross-references like "see block 3").
- Be precise, exam-board accurate, and concise — readable at GCSE level.
"""


def _extract_json(text: str) -> Dict[str, Any]:
    """Robust JSON extractor — handles fenced or unfenced output."""
    if not text:
        raise ValueError("Empty LLM response")
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    payload = fenced.group(1) if fenced else text
    start = payload.find("{")
    if start < 0:
        raise ValueError("No JSON object found in LLM response")
    depth = 0
    end = -1
    for i, ch in enumerate(payload[start:], start=start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end < 0:
        raise ValueError("Unbalanced JSON in LLM response")
    return json.loads(payload[start:end])


async def generate_lesson(
    topic: str,
    exam_board: str = "AQA",
    tier: str = "Higher",
    *,
    repair_guidance: Optional[List[str]] = None,
    model_provider: str = "anthropic",
    model_name: str = "claude-sonnet-4-5-20250929",
) -> Dict[str, Any]:
    """Generate a structured lesson JSON. Raises ValueError on bad output.

    If `repair_guidance` is provided, the user message is prefixed with the
    validation errors from the previous attempt so the LLM can self-correct.
    """
    if not EMERGENT_LLM_KEY:
        raise RuntimeError("EMERGENT_LLM_KEY missing in environment")

    system_prompt = _build_system_prompt(DEFAULT_PROFILE)
    session_id = f"lesson-{uuid.uuid4()}"

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_prompt,
    ).with_model(model_provider, model_name)

    repair_block = ""
    if repair_guidance:
        bullets = "\n".join(f"- {e}" for e in repair_guidance[:8])
        repair_block = (
            "REPAIR NOTE — the previous attempt failed schema validation with these errors:\n"
            f"{bullets}\n"
            "Re-emit the WHOLE lesson JSON, fixing every error. "
            "Use the exact block keys listed in the schema. Ensure every block has "
            "real teaching content of at least 20 characters.\n\n"
        )

    user = UserMessage(
        text=(
            f"{repair_block}"
            f"Generate the lesson JSON for this topic.\n"
            f"Topic: {topic}\n"
            f"Exam board: {exam_board}\n"
            f"Tier: {tier}\n"
            f"Subject: GCSE Biology\n"
            f"Return JSON only."
        )
    )

    response = await chat.send_message(user)
    text = response if isinstance(response, str) else getattr(response, "content", str(response))
    return _extract_json(text)


# ----------------------------------------------------------------------
# Mark-it-now — examiner-grade marking of a student answer
# ----------------------------------------------------------------------

MARK_SCHEMA_DESC = """
Return a single JSON object (no markdown fences, no commentary):

{
  "marks_awarded": <int 0..marks_possible>,
  "marks_possible": <int>,
  "marking_points": [
    {"point": "<criterion>", "awarded": <bool>, "evidence": "<quote or 'not present'>", "ao": "AO1|AO2|AO3"}
  ],
  "examiner_feedback": "<2-3 sentence feedback in an examiner's voice>",
  "misconception_tags": ["<short tag>", ...],
  "improvement_advice": "<one sentence telling the student what to add for full marks>"
}
"""

MARKER_SYSTEM_PROMPT = f"""You are an experienced UK GCSE examiner (AQA spec by default).
Mark the student answer strictly against the mark scheme. Be fair but rigorous.
Award marks only where the answer demonstrates the required knowledge AND uses
GCSE-grade scientific language.

{MARK_SCHEMA_DESC}

RULES:
- Never award a mark for vague phrasing ("messages travel through nerves").
- Always justify each marking point with a direct evidence quote from the student answer.
- If the answer has zero scientific terminology, award 0.
- examiner_feedback is addressed TO the student (second person, encouraging but precise).
- misconception_tags are short kebab-case strings (e.g. "vague-language", "missing-mechanism").
"""


async def mark_answer(
    question: str,
    marks_possible: int,
    mark_scheme: List[str],
    student_answer: str,
    model_provider: str = "anthropic",
    model_name: str = "claude-sonnet-4-5-20250929",
) -> Dict[str, Any]:
    if not EMERGENT_LLM_KEY:
        raise RuntimeError("EMERGENT_LLM_KEY missing in environment")

    session_id = f"mark-{uuid.uuid4()}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=MARKER_SYSTEM_PROMPT,
    ).with_model(model_provider, model_name)

    scheme_lines = "\n".join(f"- {ms}" for ms in (mark_scheme or []))
    user = UserMessage(
        text=(
            f"Question ({marks_possible} marks): {question}\n\n"
            f"Mark scheme (any acceptable marking points):\n{scheme_lines}\n\n"
            f"Student answer:\n{student_answer}\n\n"
            f"Return JSON only."
        )
    )

    response = await chat.send_message(user)
    text = response if isinstance(response, str) else getattr(response, "content", str(response))
    return _extract_json(text)
