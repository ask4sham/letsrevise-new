/**
 * Sub-topic boundary guard — permission layer before coverage (Phase 0–2).
 * Pure functions; no generation wiring in this slice.
 */

const { normalizeText, blockHaystack } = require("../lessonBlockAnalysis");
const { listProfileConcepts } = require("./subTopicProfiles");

/**
 * @param {object} block
 */
function blockHaystackExtended(block) {
  return normalizeText(
    [
      blockHaystack(block),
      block?.prompt,
      block?.questionText,
      block?.explanation,
      block?.front,
      block?.back,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

const ASSESSMENT_GENERATION_KINDS = new Set([
  "activity",
  "checkpoint",
  "quiz",
  "hotspot",
  "practice",
  "retrieval",
  "exam",
  "selfcheck",
]);

const PRIMARY_ACTIVITY_BLOCK_TYPES = new Set([
  "checkpoint",
  "selfcheck",
  "selfcheckquestion",
  "dragdropmatch",
  "interactivesequence",
  "interactivediagram",
  "hotspot",
  "labeldiagram",
  "diagram",
]);

/**
 * @returns {0|1|2}
 */
function getSubTopicBoundaryMode() {
  const raw = String(process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY || "0").trim();
  const n = Number(raw);
  if (n === 1 || n === 2) return n;
  return 0;
}

/** Whether future pipelines should hard-reject forbidden-primary items. */
function isSubTopicBoundaryEnforcementEnabled() {
  return getSubTopicBoundaryMode() >= 2;
}

/**
 * @param {import("./subTopicProfiles").SubTopicConceptDef} concept
 * @returns {string[]}
 */
function termsForConcept(concept) {
  if (!concept) return [];
  const terms = new Set();
  if (concept.id) {
    terms.add(String(concept.id).replace(/_/g, " "));
  }
  if (concept.name) {
    terms.add(String(concept.name).toLowerCase());
  }
  for (const t of concept.matchTerms || []) {
    terms.add(String(t).toLowerCase());
  }
  return [...terms].map((t) => normalizeText(t)).filter(Boolean);
}

/**
 * @param {string} hay
 * @param {import("./subTopicProfiles").SubTopicProfile} profile
 * @returns {string[]}
 */
function matchProfileConceptIds(hay, profile) {
  const normalizedHay = normalizeText(hay);
  if (!normalizedHay || !profile) return [];
  const hits = new Set();
  for (const concept of listProfileConcepts(profile)) {
    for (const term of termsForConcept(concept)) {
      if (term && normalizedHay.includes(term)) {
        hits.add(concept.id);
        break;
      }
    }
  }
  return [...hits];
}

/**
 * @param {string} conceptId
 * @param {import("./subTopicProfiles").SubTopicProfile|null} profile
 * @returns {import("./subTopicProfiles").ConceptScope}
 */
function classifyConcept(conceptId, profile) {
  if (!profile || !conceptId) return "unknown";
  const id = String(conceptId).trim().toLowerCase();
  if (profile.forbiddenConcepts.some((c) => c.id === id)) return "forbidden";
  if (profile.neighbouringConcepts.some((c) => c.id === id)) return "neighbouring";
  if (profile.primaryConcepts.some((c) => c.id === id)) return "in_scope";
  return "unknown";
}

/**
 * Infer dominant concept id from text (forbidden > neighbouring > primary priority for disambiguation).
 * @param {string} hay
 * @param {import("./subTopicProfiles").SubTopicProfile} profile
 * @returns {string|null}
 */
function inferPrimaryConceptIdFromHaystack(hay, profile) {
  const ids = matchProfileConceptIds(hay, profile);
  if (!ids.length) return null;
  const order = ["forbidden", "neighbouring", "in_scope"];
  for (const scope of order) {
    const pool =
      scope === "forbidden"
        ? profile.forbiddenConcepts
        : scope === "neighbouring"
          ? profile.neighbouringConcepts
          : profile.primaryConcepts;
    const hit = ids.find((id) => pool.some((c) => c.id === id));
    if (hit) return hit;
  }
  return ids[0];
}

/**
 * @param {object} block
 */
function isPrimaryAssessmentBlock(block) {
  const type = String(block?.type || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (PRIMARY_ACTIVITY_BLOCK_TYPES.has(type)) return true;
  if (block?.question || block?.prompt || block?.questionText) return true;
  return false;
}

/**
 * @param {object} slot
 * @param {import("./subTopicProfiles").SubTopicProfile|null} profile
 */
function validateGenerationSlot(slot = {}, profile) {
  if (!profile) {
    return {
      allowed: true,
      scope: "unknown",
      classification: "unknown",
      reason: "No sub-topic profile resolved.",
      wouldReject: false,
    };
  }

  const conceptId =
    slot.conceptId ||
    inferPrimaryConceptIdFromHaystack(
      [slot.conceptName, slot.prompt, slot.question, slot.title].filter(Boolean).join(" "),
      profile
    );
  const classification = classifyConcept(conceptId, profile);
  const generationKind = String(slot.generationKind || "practice").toLowerCase();
  const isAssessment = ASSESSMENT_GENERATION_KINDS.has(generationKind);
  const isPrimary = slot.isPrimary !== false;

  let wouldReject = false;
  let reason = "In scope for this sub-topic.";

  if (isAssessment && isPrimary) {
    if (classification === "forbidden") {
      wouldReject = true;
      reason = `Forbidden for this sub-topic: primary ${generationKind} must not target "${conceptId}".`;
    } else if (classification === "neighbouring") {
      wouldReject = true;
      reason = `Neighbouring sub-topic only: "${conceptId}" may be mentioned briefly, not as a primary ${generationKind} target.`;
    } else if (classification === "unknown" && conceptId) {
      wouldReject = true;
      reason = `Concept "${conceptId}" is outside the defined scope for this sub-topic.`;
    }
  }

  const allowed = !wouldReject || !isSubTopicBoundaryEnforcementEnabled();

  return {
    allowed,
    wouldReject,
    conceptId: conceptId || null,
    classification,
    scope: classification,
    reason,
    generationKind,
  };
}

/**
 * @param {object} block
 * @param {import("./subTopicProfiles").SubTopicProfile|null} profile
 */
function validateBlockScope(block = {}, profile) {
  if (!profile) {
    return {
      allowed: true,
      isAssessed: false,
      classification: "unknown",
      conceptId: null,
      reason: "No sub-topic profile resolved.",
      wouldReject: false,
    };
  }

  const hay = blockHaystackExtended(block);
  const conceptId = block.conceptId || inferPrimaryConceptIdFromHaystack(hay, profile);
  const classification = classifyConcept(conceptId, profile);
  const isAssessed = isPrimaryAssessmentBlock(block);

  let wouldReject = false;
  let reason = "Teaching or in-scope content.";

  if (isAssessed) {
    if (classification === "forbidden") {
      wouldReject = true;
      reason = `Forbidden primary activity: block targets "${conceptId}" (belongs to another sub-topic lesson).`;
    } else if (classification === "neighbouring") {
      wouldReject = true;
      reason = `Neighbouring concept "${conceptId}" cannot be the primary focus of this activity.`;
    }
  }

  const allowed = !wouldReject || !isSubTopicBoundaryEnforcementEnabled();

  return {
    allowed,
    wouldReject,
    isAssessed,
    conceptId,
    classification,
    scope: classification,
    reason,
    blockType: block.type || null,
  };
}

/**
 * @param {object[]|{ pages?: object[] }} itemsOrBlocks
 * @param {import("./subTopicProfiles").SubTopicProfile|null} profile
 */
/**
 * @param {object[]|{ pages?: object[] }} itemsOrBlocks
 * @returns {object[]}
 */
function normalizeToBlocks(itemsOrBlocks) {
  if (!itemsOrBlocks) return [];
  if (Array.isArray(itemsOrBlocks)) {
    if (itemsOrBlocks.length > 0 && Array.isArray(itemsOrBlocks[0]?.blocks)) {
      return itemsOrBlocks.flatMap((p) => p?.blocks || []);
    }
    return itemsOrBlocks;
  }
  if (Array.isArray(itemsOrBlocks.pages)) {
    return itemsOrBlocks.pages.flatMap((p) => p?.blocks || []);
  }
  return [];
}

function scoreScopeContamination(itemsOrBlocks, profile) {
  if (!profile) {
    return {
      assessedCount: 0,
      outOfScopeCount: 0,
      inScopeCount: 0,
      contaminationScore: 0,
      inScopePct: 100,
      violations: [],
    };
  }

  const blocks = normalizeToBlocks(itemsOrBlocks);

  const violations = [];
  let assessedCount = 0;
  let outOfScopeCount = 0;
  let inScopeCount = 0;

  for (const block of blocks) {
    const result = validateBlockScope(block, profile);
    if (!result.isAssessed) continue;
    assessedCount += 1;
    if (result.wouldReject) {
      outOfScopeCount += 1;
      violations.push({
        conceptId: result.conceptId,
        classification: result.classification,
        reason: result.reason,
        blockType: result.blockType,
        title: block.title || block.question || null,
      });
    } else if (result.classification === "in_scope") {
      inScopeCount += 1;
    }
  }

  const contaminationScore =
    assessedCount > 0 ? Math.round((outOfScopeCount / assessedCount) * 100) : 0;
  const inScopePct =
    assessedCount > 0 ? Math.round((inScopeCount / assessedCount) * 100) : 100;

  return {
    assessedCount,
    outOfScopeCount,
    inScopeCount,
    contaminationScore,
    inScopePct,
    violations,
    reportOnly: !isSubTopicBoundaryEnforcementEnabled(),
  };
}

module.exports = {
  getSubTopicBoundaryMode,
  isSubTopicBoundaryEnforcementEnabled,
  classifyConcept,
  validateGenerationSlot,
  validateBlockScope,
  scoreScopeContamination,
  matchProfileConceptIds,
  inferPrimaryConceptIdFromHaystack,
  normalizeToBlocks,
  blockHaystackExtended,
  ASSESSMENT_GENERATION_KINDS,
};
