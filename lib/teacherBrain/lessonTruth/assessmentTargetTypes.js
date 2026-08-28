/**
 * Phase 2 — Assessment target planning and alignment types/constants (server-only).
 */

const { COGNITIVE_SKILLS } = require("../lessonCoverageIntelligence");
const { ALL_ASSESSMENT_SKILLS } = require("../assessmentSkillProfiles");
const { safeStr } = require("./conceptNormalization");

const PLAN_VERSION = "assessment-plan-v1.0.0";

const TARGET_MODE_SINGLE = "single";
const TARGET_MODE_COMPARE = "compare";
const TARGET_MODE_RELATIONSHIP = "relationship";
const TARGET_MODES = [TARGET_MODE_SINGLE, TARGET_MODE_COMPARE, TARGET_MODE_RELATIONSHIP];

const RECURRENCE_BREADTH = "breadth";
const RECURRENCE_DEPTH = "depth";
const RECURRENCE_COMPARE = "compare";

const EVIDENCE_CLASS = {
  EXACT_DIRECT_TERM: "EXACT_DIRECT_TERM",
  DIRECT_CLAUSE_MATCH: "DIRECT_CLAUSE_MATCH",
  NORMALIZED_DIRECT_PHRASE: "NORMALIZED_DIRECT_PHRASE",
  WEAK_LEXICAL: "WEAK_LEXICAL",
  NONE: "NONE",
};

const CONFIDENCE_TIER = {
  CONFIDENT: "CONFIDENT",
  AMBIGUOUS: "AMBIGUOUS",
  NO_MATCH: "NO_MATCH",
};

const ALIGNMENT_VERDICT = {
  ACCEPT: "ACCEPT",
  REGENERATE: "REGENERATE",
  REVIEW: "REVIEW",
};

const REASON_CODES = {
  AUTHORIZED: "AUTHORIZED",
  SUPPORTING_AS_PRIMARY: "SUPPORTING_AS_PRIMARY",
  UNAUTHORIZED_CONCEPT: "UNAUTHORIZED_CONCEPT",
  NO_PRIMARY_CONCEPT_MATCH: "NO_PRIMARY_CONCEPT_MATCH",
  ASSESSMENT_EXCLUSION: "ASSESSMENT_EXCLUSION",
  OUT_OF_SCOPE_TARGET: "OUT_OF_SCOPE_TARGET",
  NO_TAUGHT_EVIDENCE: "NO_TAUGHT_EVIDENCE",
  TARGET_ASSIGNMENT_MISMATCH: "TARGET_ASSIGNMENT_MISMATCH",
  DUPLICATE_CONCEPT_TARGET: "DUPLICATE_CONCEPT_TARGET",
  COGNITIVE_LEVEL_MISMATCH: "COGNITIVE_LEVEL_MISMATCH",
  OBJECTIVE_MISMATCH: "OBJECTIVE_MISMATCH",
  AMBIGUOUS_ALIGNMENT: "AMBIGUOUS_ALIGNMENT",
};

/** Canonical assessment surfaces used by Phase 2 planner/tests. */
const ASSESSMENT_SURFACES = [
  "checkpoint",
  "page_quiz",
  "quick_check",
  "self_check",
  "quiz_mcq",
  "revision_practice",
  "exam_practice_block",
  "worked_example",
  "higher_tier_challenge",
];

const SURFACE_DEFAULT_COGNITIVE = {
  checkpoint: "Recall",
  page_quiz: "Recall",
  quick_check: "Explain",
  self_check: "Explain",
  quiz_mcq: "Apply",
  revision_practice: "Apply",
  exam_practice_block: "Analyse",
  worked_example: "Analyse",
  higher_tier_challenge: "Evaluate",
};

const SKILL_LABEL_TO_COGNITIVE = {
  Recall: "Recall",
  Describe: "Explain",
  Explain: "Explain",
  Compare: "Analyse",
  Analyse: "Analyse",
  Evaluate: "Evaluate",
  Justify: "Analyse",
  Calculate: "Apply",
  "Interpret Data": "Apply",
  "Use Evidence": "Analyse",
  "Source Analysis": "Analyse",
  "Essay Planning": "Evaluate",
};

function compareStrings(a, b) {
  const left = String(a ?? "");
  const right = String(b ?? "");
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function evidenceClassToConfidence(evidenceClass) {
  if (
    evidenceClass === EVIDENCE_CLASS.EXACT_DIRECT_TERM ||
    evidenceClass === EVIDENCE_CLASS.DIRECT_CLAUSE_MATCH ||
    evidenceClass === EVIDENCE_CLASS.NORMALIZED_DIRECT_PHRASE
  ) {
    return CONFIDENCE_TIER.CONFIDENT;
  }
  if (evidenceClass === EVIDENCE_CLASS.WEAK_LEXICAL) return CONFIDENCE_TIER.AMBIGUOUS;
  return CONFIDENCE_TIER.NO_MATCH;
}

function globalLedgerKey(conceptId, cognitiveLevel) {
  return `${conceptId}|${cognitiveLevel}`;
}

function surfaceLedgerKey(conceptId, cognitiveLevel, surface) {
  return `${conceptId}|${cognitiveLevel}|${surface}`;
}

function cognitiveBandDistance(observed, assigned) {
  const left = COGNITIVE_SKILLS.indexOf(observed);
  const right = COGNITIVE_SKILLS.indexOf(assigned);
  if (left < 0 || right < 0) return null;
  return Math.abs(left - right);
}

function normalizeTargetMode(mode) {
  const raw = safeStr(mode).toLowerCase();
  if (TARGET_MODES.includes(raw)) return raw;
  return TARGET_MODE_SINGLE;
}

function normalizeAssessmentRequirement(req) {
  const surface = safeStr(req?.surface).toLowerCase();
  return {
    surface,
    slotIndex: Number(req?.slotIndex) || 0,
    targetMode: normalizeTargetMode(req?.targetMode),
  };
}

function defaultCognitiveForSurface(surface) {
  return SURFACE_DEFAULT_COGNITIVE[surface] || "Recall";
}

function nextCognitiveLevel(level) {
  const idx = COGNITIVE_SKILLS.indexOf(level);
  if (idx < 0 || idx >= COGNITIVE_SKILLS.length - 1) return level;
  return COGNITIVE_SKILLS[idx + 1];
}

function buildTargetId(surface, slotIndex, primaryConceptIds, cognitiveLevel, targetMode) {
  const ids = [...primaryConceptIds].sort().join("+");
  return `tgt-${surface}-${slotIndex}-${ids}-${cognitiveLevel}-${targetMode}`;
}

/**
 * Deterministic observed cognitive level from stem command words.
 * @param {string} stem
 * @returns {string|null} COGNITIVE_SKILLS value or null
 */
function inferObservedCognitiveLevel(stem) {
  const text = safeStr(stem);
  if (!text) return null;

  if (/\b(compare|contrast|difference between|similarities and differences)\b/i.test(text)) {
    return "Analyse";
  }
  if (/\b(to what extent|evaluate|assess|judge)\b/i.test(text)) {
    return "Evaluate";
  }
  if (/\b(analyse|analyze|examine|break down)\b/i.test(text)) {
    return "Analyse";
  }

  const commandEntries = [];
  for (const skill of ALL_ASSESSMENT_SKILLS) {
    for (const cw of skill.commandWords || []) {
      commandEntries.push({ commandWord: cw, skill });
    }
  }
  commandEntries.sort((a, b) => b.commandWord.length - a.commandWord.length);

  for (const entry of commandEntries) {
    const escaped = entry.commandWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(text)) {
      return SKILL_LABEL_TO_COGNITIVE[entry.skill.label] || "Explain";
    }
  }

  return null;
}

function emptyUsageLedger() {
  return { global: {}, surface: {} };
}

function sortReasonCodes(codes) {
  return [...new Set(codes || [])].sort(compareStrings);
}

module.exports = {
  PLAN_VERSION,
  TARGET_MODE_SINGLE,
  TARGET_MODE_COMPARE,
  TARGET_MODE_RELATIONSHIP,
  TARGET_MODES,
  RECURRENCE_BREADTH,
  RECURRENCE_DEPTH,
  RECURRENCE_COMPARE,
  EVIDENCE_CLASS,
  CONFIDENCE_TIER,
  ALIGNMENT_VERDICT,
  REASON_CODES,
  ASSESSMENT_SURFACES,
  SURFACE_DEFAULT_COGNITIVE,
  COGNITIVE_SKILLS,
  compareStrings,
  evidenceClassToConfidence,
  globalLedgerKey,
  surfaceLedgerKey,
  cognitiveBandDistance,
  normalizeTargetMode,
  normalizeAssessmentRequirement,
  defaultCognitiveForSurface,
  nextCognitiveLevel,
  buildTargetId,
  inferObservedCognitiveLevel,
  emptyUsageLedger,
  sortReasonCodes,
};
