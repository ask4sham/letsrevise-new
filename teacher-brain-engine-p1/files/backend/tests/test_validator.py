"""
Teacher Brain — P0.3 Lesson validator unit tests.

Pure unit tests on validate_lesson_payload. No HTTP, no LLM, no DB.

Run:
    cd backend && python -m pytest tests/test_validator.py -v
"""
import pytest

from lesson_validator import (
    MIN_BLOCK_BODY_CHARS,
    MIN_BLOCKS,
    SUPPORTED_BLOCK_KEYS,
    validate_lesson_payload,
)


def _ok_body(extra: str = "") -> str:
    base = (
        "<p>Examiners expect that electrical impulses are transmitted along "
        "neurones because receptors detect the stimulus and coordinate responses.</p>"
    )
    return base + extra


def _ok_lesson(**overrides):
    base = {
        "topic": "Homeostasis",
        "subject": "GCSE Biology",
        "exam_board": "AQA",
        "tier": "Higher",
        "spec_point": "4.5.1",
        "objective": "Understand homeostasis.",
        "blocks": [
            {
                "key": "objectives",
                "title": "REVISION OBJECTIVES",
                "body_html": "<ul><li>Define homeostasis</li><li>Explain negative feedback</li></ul>",
                "protected": True,
            },
            {
                "key": "definition",
                "title": "DEFINITION",
                "body_html": _ok_body(),
                "protected": True,
            },
            {
                "key": "coreTeaching",
                "title": "CORE LEARNING",
                "body_html": _ok_body(" Negative feedback maintains constant conditions."),
                "protected": False,
            },
            {
                "key": "summary",
                "title": "SUMMARY",
                "body_html": _ok_body(" Remember stimulus-receptor-effector."),
                "protected": True,
            },
        ],
    }
    base.update(overrides)
    return base


# ----------------------------------------------------------------------
# Happy path
# ----------------------------------------------------------------------

def test_valid_payload_passes():
    ok, errors = validate_lesson_payload(_ok_lesson())
    assert ok is True
    assert errors == []


def test_supported_block_keys_includes_current_and_future():
    # Current ones we emit
    for k in ("objectives", "definition", "coreTeaching", "commonMistake",
              "examTip", "workedExample", "summary"):
        assert k in SUPPORTED_BLOCK_KEYS, f"{k} must be supported"
    # Future-friendly ones from spec
    for k in ("hook", "core_teaching", "worked_example", "examiner_tip",
              "misconception", "checkpoint", "memory_rule",
              "image_placeholder", "exam_practice"):
        assert k in SUPPORTED_BLOCK_KEYS, f"{k} must be supported"


# ----------------------------------------------------------------------
# Lesson-level rejects
# ----------------------------------------------------------------------

@pytest.mark.parametrize("garbage", ["not a dict", 42, None, ["a", "list"]])
def test_raw_non_dict_rejected(garbage):
    ok, errors = validate_lesson_payload(garbage)
    assert ok is False
    assert any("payload must be" in e for e in errors)


def test_missing_blocks_field_rejected():
    payload = _ok_lesson()
    del payload["blocks"]
    ok, errors = validate_lesson_payload(payload)
    assert ok is False
    assert any("blocks" in e for e in errors)


def test_empty_blocks_array_rejected():
    payload = _ok_lesson(blocks=[])
    ok, errors = validate_lesson_payload(payload)
    assert ok is False
    assert any("non-empty" in e or "at least" in e or "min_length" in e
               for e in errors)


def test_blocks_not_array_rejected():
    payload = _ok_lesson()
    payload["blocks"] = "this is a string"
    ok, errors = validate_lesson_payload(payload)
    assert ok is False
    assert any("array" in e.lower() or "list" in e.lower() for e in errors)


def test_below_min_blocks_count_rejected():
    payload = _ok_lesson()
    payload["blocks"] = payload["blocks"][:1]  # only 1 block
    assert len(payload["blocks"]) < MIN_BLOCKS
    ok, errors = validate_lesson_payload(payload)
    assert ok is False


def test_missing_required_core_teaching_rejected():
    payload = _ok_lesson()
    payload["blocks"] = [b for b in payload["blocks"] if b["key"] != "coreTeaching"]
    # Still has 3 blocks but no coreTeaching
    while len(payload["blocks"]) < MIN_BLOCKS:
        payload["blocks"].append(
            {"key": "definition", "title": "Extra def", "body_html": _ok_body(), "protected": True}
        )
    ok, errors = validate_lesson_payload(payload)
    assert ok is False
    assert any("coreTeaching" in e for e in errors)


def test_missing_topic_rejected():
    payload = _ok_lesson()
    payload["topic"] = ""
    ok, errors = validate_lesson_payload(payload)
    assert ok is False
    assert any("topic" in e for e in errors)


# ----------------------------------------------------------------------
# Block-level rejects
# ----------------------------------------------------------------------

def test_unsupported_block_key_rejected():
    payload = _ok_lesson()
    payload["blocks"].append(
        {
            "key": "totally_made_up_key",
            "title": "Bogus",
            "body_html": _ok_body(),
            "protected": False,
        }
    )
    ok, errors = validate_lesson_payload(payload)
    assert ok is False
    assert any("unsupported block key" in e for e in errors)


def test_short_body_html_rejected():
    payload = _ok_lesson()
    payload["blocks"][2]["body_html"] = "<p>tiny</p>"  # < MIN_BLOCK_BODY_CHARS
    assert len(payload["blocks"][2]["body_html"]) < MIN_BLOCK_BODY_CHARS
    ok, errors = validate_lesson_payload(payload)
    assert ok is False


def test_block_with_only_html_tags_rejected():
    payload = _ok_lesson()
    payload["blocks"][2]["body_html"] = "<p></p><p>     </p><br/><br/>"
    ok, errors = validate_lesson_payload(payload)
    assert ok is False
    assert any("visible text" in e or "body" in e.lower() for e in errors)


def test_missing_block_title_rejected():
    payload = _ok_lesson()
    payload["blocks"][2]["title"] = ""
    ok, errors = validate_lesson_payload(payload)
    assert ok is False


def test_block_missing_key_rejected():
    payload = _ok_lesson()
    del payload["blocks"][2]["key"]
    ok, errors = validate_lesson_payload(payload)
    assert ok is False


# ----------------------------------------------------------------------
# Error message shape (safe to expose)
# ----------------------------------------------------------------------

def test_error_strings_are_safe_to_expose():
    """Error messages must be flat strings with no raw stack frames or secrets."""
    ok, errors = validate_lesson_payload({"bogus": True})
    assert ok is False
    for e in errors:
        assert isinstance(e, str)
        # No file paths, no stack frames, no secret patterns
        assert "Traceback" not in e
        assert "/app/" not in e
        assert "sk-" not in e
