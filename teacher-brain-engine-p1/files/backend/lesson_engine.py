"""
Teacher Brain MVP — Examiner Language V2 scoring engine (Python port).

Faithful port of /app/teacher-brain-engine/examinerLanguageV2Engine.js
Same target-block scope, same regex signal model, same violation set.
Read-only. No mutation. No autofix.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

# ----------------------------------------------------------------------
# Constants — kept in lock-step with the JS engine
# ----------------------------------------------------------------------

V2_TARGET_BLOCK_KEYS: List[str] = [
    "coreTeaching",
    "commonMistake",
    "examTip",          # renamed from examTechnique — single source of truth
    "workedExample",
]

PROTECTED_BLOCK_KEYS: Set[str] = {
    "objectives", "priorKnowledge", "definition", "scenario", "whyItMatters",
    "coreModel", "keyExamples", "examVocabulary", "checkpoint",
    "summary", "keywords", "examPractice",
    "equipment", "method", "variables", "variablesMatch",
}

EXAMINER_CONNECTIVES = re.compile(
    r"\b(because|therefore|thus|as a result|leading to|resulting in|"
    r"consequently|so that|this means that|indicating|indicates)\b",
    re.IGNORECASE,
)

SCIENTIFIC_VERBS = re.compile(
    r"\b(provides|enables|results in|causes|stimulates|transmits?|transmitted|"
    r"coordinates?|coordinated|regulates?|controls?|increases?|decreases?|"
    r"activates?|detects?|detected|releases?|maintains?|produces?|removes?|"
    r"returns?|refracts?|converges?|evaporates?)\b",
    re.IGNORECASE,
)

VAGUE_VERBS = re.compile(r"\b(needs?|helps?|makes?|uses?|gets?|does)\b", re.IGNORECASE)
VAGUE_NOUNS = re.compile(r"\b(signals?|messages?)\b", re.IGNORECASE)

SCIENTIFIC_NOUNS = re.compile(
    r"\b(electrical impulses?|neural transmission|neurones?|receptors?|effectors?|"
    r"coordination centre|hypothalamus|synapses?|thermoreceptors?|chloroplasts?|"
    r"enzymes?|diffusion gradients?|stimulus|accommodation|retina|cornea|"
    r"insulin|glycogen|negative feedback)\b",
    re.IGNORECASE,
)

EXAMINER_FRAMING = re.compile(
    r"\b(students often write|examiners expect|do not say|creditworthy answer|"
    r"to gain full marks|a common reason marks are lost|weak:|correct:|"
    r"full[- ]mark)\b",
    re.IGNORECASE,
)

WORKED_CAUSAL_MARKERS = re.compile(
    r"\b(because|therefore|so that|this means that|consequently|"
    r"as a result|leads to|enables|allows)\b",
    re.IGNORECASE,
)

CORE_TEACHING_SCAFFOLD_PATTERNS = [
    re.compile(r"one sentence that names what .+ is really about", re.IGNORECASE),
    re.compile(r"what happens first\.", re.IGNORECASE),
    re.compile(r"what changes as a result\.", re.IGNORECASE),
    re.compile(r"let's build this step by step in clear classroom language", re.IGNORECASE),
    re.compile(r"reward comes from explaining why, not only naming", re.IGNORECASE),
]

_HTML_TAG = re.compile(r"<[^>]+>")


def strip_html(text: str) -> str:
    return _HTML_TAG.sub(" ", text or "")


# ----------------------------------------------------------------------
# Default GCSE Biology profile (data, not code)
# In production this comes from teachingQualityProfiles.js
# ----------------------------------------------------------------------

DEFAULT_PROFILE: Dict[str, Any] = {
    "taxonomyKey": "aqa-gcse-biology:default",
    "workedReasoning": {"minSteps": 3},
    "examinerLanguageV2": {
        "studentsOftenWrite": "Messages travel through nerves.",
        "examinersExpect": "Electrical impulses are transmitted along sensory and motor neurones.",
        "doNotSay": "Cells send signals.",
        "creditworthyAnswer": "Electrical impulses travel along neurones because they are specialised conducting cells.",
        "fullMarksGuidance": "Link the stimulus to the receptor, to the coordination centre, to the effector.",
        "markLosingReason": "Failing to name the structure or the mechanism.",
        "gcseTerms": [
            "stimulus", "receptor", "coordination centre", "effector",
            "electrical impulse", "neurone", "synapse", "hypothalamus",
            "thermoreceptor", "negative feedback",
        ],
        "examSayLines": [
            "Examiners expect named GCSE structures and a clear cause → effect chain.",
            "In the exam, link stimulus → receptor → coordination centre → effector.",
        ],
        "contrastPairs": [
            {"weak": "Messages travel through nerves.",
             "strong": "Electrical impulses are transmitted along neurones."},
            {"weak": "The body keeps things steady.",
             "strong": "Homeostasis maintains a constant internal environment by negative feedback."},
            {"weak": "Cells send signals.",
             "strong": "Receptors detect a stimulus and electrical impulses are generated."},
        ],
        "modelAnswerExample": (
            "Question: Explain how impulses travel from receptors to effectors. (3 marks)\n"
            "1. Receptors detect the stimulus and generate electrical impulses because they are specialised cells.\n"
            "2. Impulses travel along sensory neurones to the CNS, therefore the signal reaches the coordination centre.\n"
            "3. Motor neurones carry impulses to effectors so that a response is produced."
        ),
    },
}


# ----------------------------------------------------------------------
# Scoring helpers
# ----------------------------------------------------------------------

def _count(rx: re.Pattern, hay: str) -> int:
    return len(rx.findall(hay or ""))


def detect_core_teaching_scaffold(plain: str) -> Dict[str, Any]:
    hits = [p.pattern for p in CORE_TEACHING_SCAFFOLD_PATTERNS if p.search(plain or "")]
    return {"hasScaffold": bool(hits), "hits": hits}


def count_worked_sequenced_points(plain: str) -> int:
    if not plain:
        return 0
    numbered = len(re.findall(r"(?:^|[\n\r])\s*\d+[\.)]\s+", plain, flags=re.MULTILINE))
    inline_numbered = 0 if numbered else len(re.findall(r"\b\d+[\.)]\s+", plain))
    bullets = len(re.findall(r"(?:^|[\n\r])\s*[•\-\*]\s+", plain, flags=re.MULTILINE))
    causal = 0
    for s in re.split(r"[.!?]+", plain):
        s = s.strip()
        if len(s) > 12 and WORKED_CAUSAL_MARKERS.search(s):
            causal += 1
    return max(numbered, inline_numbered, bullets, causal)


def score_worked_example_structure(plain: str, profile: Dict[str, Any]) -> Dict[str, Any]:
    min_steps = (profile.get("workedReasoning") or {}).get("minSteps", 3)
    sequenced = count_worked_sequenced_points(plain)
    causal = _count(WORKED_CAUSAL_MARKERS, plain)
    question_stem = bool(
        re.search(r"\?", plain or "")
        or re.search(r"\b\d+\s*marks?\b", plain or "", re.IGNORECASE)
        or re.search(r"\bexplain how\b", plain or "", re.IGNORECASE)
        or re.search(r"\bquestion\s*:", plain or "", re.IGNORECASE)
    )
    return {
        "sequencedPoints": sequenced,
        "minSteps": min_steps,
        "causalCount": causal,
        "questionStem": question_stem,
        "pass": sequenced >= min_steps and causal >= 2 and question_stem,
    }


def contrast_pair_coverage(pairs: List[Dict[str, str]], hay: str) -> Dict[str, Any]:
    matched = 0
    hay_l = hay or ""
    for pair in pairs or []:
        strong = (pair.get("strong") or "").lower()
        strong_words = [w for w in re.split(r"\W+", strong) if len(w) > 4]
        strong_hit = strong and (strong in hay_l or sum(1 for w in strong_words if w in hay_l) >= 2)
        if strong_hit:
            matched += 1
    return {"matched": matched, "total": len(pairs or [])}


# ----------------------------------------------------------------------
# Public API — score a structured lesson (list of blocks)
# ----------------------------------------------------------------------

@dataclass
class Block:
    key: str
    title: str
    body_html: str
    protected: bool = False
    score: Optional[float] = None
    violations: List[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Block":
        return cls(
            key=d.get("key", ""),
            title=d.get("title", ""),
            body_html=d.get("body_html", "") or d.get("bodyHtml", ""),
            protected=bool(d.get("protected", False)),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "key": self.key,
            "title": self.title,
            "body_html": self.body_html,
            "protected": self.protected,
            "score": self.score,
            "violations": self.violations,
        }


def score_lesson_blocks(blocks: List[Dict[str, Any]],
                        profile: Optional[Dict[str, Any]] = None
                        ) -> Dict[str, Any]:
    """
    Returns:
        {
          "pass": bool,
          "overall_score": float (0..10),
          "signals": {...},
          "violations": [...],
          "per_block": {key: {"score": float, "violations": [...]}},
          "target_blocks": [...],
          "protected_blocks": [...]
        }
    """
    profile = profile or DEFAULT_PROFILE
    v2 = (profile or {}).get("examinerLanguageV2", {}) or {}

    block_map: Dict[str, Block] = {}
    for raw in blocks or []:
        b = Block.from_dict(raw)
        block_map[b.key] = b

    target_bodies = {k: block_map[k].body_html for k in V2_TARGET_BLOCK_KEYS if k in block_map}
    hay = "\n".join(strip_html(v).lower() for v in target_bodies.values())

    connectives = _count(EXAMINER_CONNECTIVES, hay)
    sci_verbs = _count(SCIENTIFIC_VERBS, hay)
    vague_verbs = _count(VAGUE_VERBS, hay)
    vague_nouns = _count(VAGUE_NOUNS, hay)
    sci_nouns = _count(SCIENTIFIC_NOUNS, hay)
    framing = _count(EXAMINER_FRAMING, hay)

    contrast = contrast_pair_coverage(v2.get("contrastPairs", []), hay)
    exam_say_hits = 0
    for line in v2.get("examSayLines", []):
        tokens = [w for w in re.split(r"\W+", line.lower()) if len(w) > 5][:4]
        if sum(1 for t in tokens if t in hay) >= 2:
            exam_say_hits += 1

    core_plain = strip_html((block_map.get("coreTeaching") or Block("", "", "")).body_html).lower()
    core_scaffold = detect_core_teaching_scaffold(core_plain)

    worked_plain = strip_html((block_map.get("workedExample") or Block("", "", "")).body_html).lower()
    worked_struct = score_worked_example_structure(worked_plain, profile)

    blocks_with_grade_lang = 0
    per_block: Dict[str, Dict[str, Any]] = {}
    for key, blk in block_map.items():
        if key not in V2_TARGET_BLOCK_KEYS:
            continue
        plain = strip_html(blk.body_html).lower()
        b_conn = _count(EXAMINER_CONNECTIVES, plain)
        b_sci = _count(SCIENTIFIC_VERBS, plain)
        b_nouns = _count(SCIENTIFIC_NOUNS, plain)
        b_framing = _count(EXAMINER_FRAMING, plain)
        b_vague_v = _count(VAGUE_VERBS, plain)
        if b_sci >= 1 or b_conn >= 1 or b_nouns >= 1:
            blocks_with_grade_lang += 1
        block_violations: List[str] = []
        if key == "coreTeaching" and core_scaffold["hasScaffold"]:
            block_violations.append("Contains autofix scaffold placeholder text.")
        if key == "coreTeaching" and b_framing < 1:
            block_violations.append("Missing examiner framing (e.g. 'Examiners expect…').")
        if key == "workedExample" and not worked_struct["pass"]:
            block_violations.append(
                f"Below threshold: sequenced={worked_struct['sequencedPoints']} "
                f"(min {worked_struct['minSteps']}), causal={worked_struct['causalCount']} (min 2)."
            )
        score = _block_score(b_conn, b_sci, b_nouns, b_framing, b_vague_v, contrast["matched"], key == "workedExample" and worked_struct["pass"])
        blk.score = score
        blk.violations = block_violations
        per_block[key] = {"score": score, "violations": block_violations}

    # Lesson-level violations
    violations: List[str] = []
    if connectives < 2:
        violations.append("Fewer than 2 examiner connectives across target blocks.")
    if sci_verbs < 2:
        violations.append("Fewer than 2 scientific verbs across target blocks.")
    if contrast["matched"] < 1 and exam_say_hits < 1:
        violations.append("No topic-specific contrast pair or exam-say phrasing detected.")
    if blocks_with_grade_lang < 2:
        violations.append("Examiner-grade language in fewer than 2 target blocks.")
    if "coreTeaching" in block_map and core_scaffold["hasScaffold"]:
        violations.append("Core Learning contains autofix scaffold placeholder text.")
    if "examTip" not in block_map:
        violations.append("EXAM TIP block not found for scoring.")
    if "workedExample" in block_map and not worked_struct["pass"]:
        violations.append(
            f"Worked Example below threshold (sequenced={worked_struct['sequencedPoints']}, "
            f"causal={worked_struct['causalCount']})."
        )
    if vague_nouns > 0 and sci_nouns == 0:
        violations.append('Vague nouns ("signals/messages") without scientific alternatives.')

    overall = round(sum(b.score or 0 for b in block_map.values() if b.key in V2_TARGET_BLOCK_KEYS) /
                    max(1, len(target_bodies)), 1) if target_bodies else 0.0

    signals = {
        "targetBlockCount": len(target_bodies),
        "connectiveCount": connectives,
        "scientificVerbCount": sci_verbs,
        "vagueVerbCount": vague_verbs,
        "vagueNounCount": vague_nouns,
        "scientificNounCount": sci_nouns,
        "examinerFramingCount": framing,
        "contrastPairsMatched": contrast["matched"],
        "examSayHits": exam_say_hits,
        "coreTeachingScaffold": core_scaffold["hasScaffold"],
        "workedSequencedPoints": worked_struct["sequencedPoints"],
        "workedCausalCount": worked_struct["causalCount"],
        "workedStructurePass": worked_struct["pass"],
        "blocksWithGradeLanguage": blocks_with_grade_lang,
    }

    return {
        "pass": not violations,
        "overall_score": overall,
        "signals": signals,
        "violations": violations,
        "per_block": per_block,
        "target_blocks": V2_TARGET_BLOCK_KEYS,
        "protected_blocks": sorted(PROTECTED_BLOCK_KEYS),
        "profile_key": (profile or {}).get("taxonomyKey"),
    }


def _block_score(conn: int, sci: int, nouns: int, framing: int,
                 vague_v: int, contrast_matched: int, worked_pass: bool) -> float:
    """Heuristic 0..10 block score. Transparent, no ML."""
    s = 4.0
    s += min(2.0, conn * 0.4)
    s += min(2.0, sci * 0.4)
    s += min(1.5, nouns * 0.3)
    s += min(1.5, framing * 0.5)
    s += min(1.0, contrast_matched * 0.5)
    s -= min(2.0, vague_v * 0.3)
    if worked_pass:
        s += 1.0
    return max(0.0, min(10.0, round(s, 1)))
