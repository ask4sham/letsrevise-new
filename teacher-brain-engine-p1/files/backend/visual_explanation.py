"""
Teacher Brain — P1.0 GCSE Visual Explanation generator.

Two-stage generation:
  1. Claude Sonnet 4.5 — produces the structured 8-section GCSE explanation
     + a tight image-generation prompt for Nano Banana.
  2. Gemini Nano Banana (gemini-3.1-flash-image-preview) — produces a clean
     GCSE-style labelled diagram from that prompt.

The image step is best-effort — if it fails (provider/budget/timeout), the
explanation is still returned and the frontend shows a clean fallback panel.
"""
from __future__ import annotations

import base64
import json
import logging
import os
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger("teacher-brain.visual")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# ----------------------------------------------------------------------
# Step 1 — explanation + image prompt (Claude Sonnet 4.5)
# ----------------------------------------------------------------------

EXPLAIN_SCHEMA_DESC = """
Return a SINGLE JSON object (no markdown fences, no commentary):

{
  "what_image_shows": "<one sentence — what the diagram depicts>",
  "key_parts": [
    {"label": "<part>", "what": "<one line — what it does>"}
  ],
  "step_by_step": [
    "<step 1 in plain GCSE language>",
    "<step 2 …>",
    "<step 3 …>"
  ],
  "why_it_matters_gcse": "<one short paragraph — why this is examined at GCSE>",
  "common_mistake": "<one sentence — the classic wrong answer students give>",
  "exam_tip": "<one sentence — examiner language that wins the mark>",
  "exam_question": "<a typical GCSE exam question, with mark allocation in brackets>",
  "model_answer": "<a full-mark model answer using GCSE-grade scientific terminology>",
  "image_prompt": "<the exact prompt you want passed to the image model — see rules below>"
}
"""

EXPLAIN_SYSTEM_PROMPT = f"""You are a senior UK GCSE science examiner and lesson designer.
Your job is to produce a single, deep, visual-explanation package for ONE topic.

{EXPLAIN_SCHEMA_DESC}

RULES for the eight explanation fields:
- Use AQA-style GCSE terminology by default.
- Use plain student-friendly English in step_by_step.
- key_parts: at least 4, at most 10 labelled items. Each label must be a single
  scientific noun or two-word phrase (e.g. "Cornea", "Optic nerve").
- common_mistake must name the wrong answer students give (e.g. "saying the
  pupil focuses light instead of the lens").
- exam_tip must reference the language that wins the mark (e.g. "use the word
  'refraction' and name BOTH the cornea AND the lens").
- exam_question must include explicit mark allocation in brackets e.g. (4 marks).
- model_answer must score full marks against that allocation, with proper
  examiner phrasing.

RULES for the image_prompt field — this is critical, the image model is
Gemini Nano Banana and will follow your prompt literally:
- Describe a CLEAN GCSE-style educational diagram on a WHITE background.
- Specify "labelled diagram", "large readable sans-serif text", "clear
  black arrows pointing to each labelled part", "no decoration", "no shading
  beyond what's needed", "exam textbook style".
- List EVERY label name to be drawn (must match key_parts exactly).
- Forbid clutter, branding, watermarks, photographic realism, comic style.
- Aim for the look of a clean AQA / Edexcel / OCR revision-guide diagram.
- Maximum two sentences — concise, declarative, label-led.

Return JSON only. No prose, no markdown fences.
"""


_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json(text: str) -> Dict[str, Any]:
    if not text:
        raise ValueError("Empty LLM response")
    match = _JSON_RE.search(text)
    if not match:
        raise ValueError("No JSON object found in LLM response")
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM returned invalid JSON: {e}") from e


async def generate_explanation_and_prompt(
    topic: str,
    subject: str = "GCSE Biology",
    exam_board: str = "AQA",
    tier: str = "Higher",
    context: Optional[str] = None,
    model_provider: str = "anthropic",
    model_name: str = "claude-sonnet-4-5-20250929",
) -> Dict[str, Any]:
    """Generate the 8-section GCSE explanation + a clean image prompt."""
    if not EMERGENT_LLM_KEY:
        raise RuntimeError("EMERGENT_LLM_KEY missing in environment")

    session_id = f"visual-explain-{uuid.uuid4()}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=EXPLAIN_SYSTEM_PROMPT,
    ).with_model(model_provider, model_name)

    ctx_block = f"\nExtra context from the lesson: {context}\n" if context else ""
    user = UserMessage(
        text=(
            f"Generate the GCSE visual-explanation JSON for this topic.\n"
            f"Topic: {topic}\n"
            f"Subject: {subject}\n"
            f"Exam board: {exam_board}\n"
            f"Tier: {tier}{ctx_block}\n"
            f"Return JSON only."
        )
    )

    response = await chat.send_message(user)
    text = response if isinstance(response, str) else getattr(response, "content", str(response))
    data = _extract_json(text)

    required = (
        "what_image_shows", "key_parts", "step_by_step", "why_it_matters_gcse",
        "common_mistake", "exam_tip", "exam_question", "model_answer", "image_prompt",
    )
    missing = [k for k in required if not data.get(k)]
    if missing:
        raise ValueError(f"Explanation missing required fields: {missing}")
    if not isinstance(data["key_parts"], list) or len(data["key_parts"]) < 3:
        raise ValueError("key_parts must have at least 3 labelled items")
    return data


# ----------------------------------------------------------------------
# Step 2 — image generation (Gemini Nano Banana)
# ----------------------------------------------------------------------

NANO_BANANA_MODEL = "gemini-3.1-flash-image-preview"


async def generate_image_from_prompt(image_prompt: str) -> Optional[Dict[str, str]]:
    """Generate one GCSE-style image. Returns {data_url, mime_type} or None on failure.

    Never raises — image is best-effort. Caller decides what to do with None.
    """
    if not EMERGENT_LLM_KEY:
        logger.warning("Image gen skipped — EMERGENT_LLM_KEY missing")
        return None

    if not image_prompt or len(image_prompt.strip()) < 10:
        logger.warning("Image gen skipped — prompt too short")
        return None

    session_id = f"visual-image-{uuid.uuid4()}"
    try:
        chat = (
            LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=session_id,
                system_message=(
                    "You generate clean GCSE textbook-style labelled diagrams. "
                    "Always white background, large readable text, clear arrows."
                ),
            )
            .with_model("gemini", NANO_BANANA_MODEL)
            .with_params(modalities=["image", "text"])
        )

        msg = UserMessage(text=image_prompt)
        _text, images = await chat.send_message_multimodal_response(msg)
        if not images:
            logger.warning("Image gen returned 0 images (prompt_len=%d)", len(image_prompt))
            return None
        first = images[0]
        b64 = first.get("data")
        mime = first.get("mime_type", "image/png")
        if not b64:
            return None
        # Validate it actually decodes
        try:
            base64.b64decode(b64, validate=True)
        except Exception:
            logger.warning("Image gen returned invalid base64")
            return None
        return {"data_url": f"data:{mime};base64,{b64}", "mime_type": mime}
    except Exception as e:
        logger.warning("Image gen failed: %s", str(e)[:200])
        return None


# ----------------------------------------------------------------------
# Public façade
# ----------------------------------------------------------------------

async def build_visual_explanation(
    topic: str,
    *,
    subject: str = "GCSE Biology",
    exam_board: str = "AQA",
    tier: str = "Higher",
    context: Optional[str] = None,
) -> Tuple[Dict[str, Any], Optional[Dict[str, str]], str]:
    """Returns (explanation_dict, image_dict_or_None, provider_status_string).

    provider_status is one of:
      - "image_generated"           — full success
      - "image_provider_unavailable" — explanation OK, image failed
    """
    explanation = await generate_explanation_and_prompt(
        topic=topic,
        subject=subject,
        exam_board=exam_board,
        tier=tier,
        context=context,
    )
    image = await generate_image_from_prompt(explanation["image_prompt"])
    status = "image_generated" if image else "image_provider_unavailable"
    return explanation, image, status
