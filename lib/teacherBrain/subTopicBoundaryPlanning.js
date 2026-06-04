/**
 * Sub-topic boundary — planning integration (runs before CoverageGate).
 */

const { resolveSubTopicProfile, listProfileConcepts } = require("./subTopicProfiles");
const {
  getSubTopicBoundaryMode,
  isSubTopicBoundaryEnforcementEnabled,
  classifyConcept,
  validateGenerationSlot,
  scoreScopeContamination,
} = require("./subTopicBoundaryGuard");
const { selectNextGenerationSlot } = require("./lessonCoverageIntelligence");

/**
 * @param {object} [options]
 * @param {string} [options.topicKey]
 * @param {string} [options.subTopic]
 * @param {string} [options.topic]
 */
function buildSubTopicBoundaryContext(options = {}) {
  const mode = getSubTopicBoundaryMode();
  const profile = resolveSubTopicProfile(options);

  if (!profile || mode === 0) {
    return {
      active: false,
      mode: 0,
      boundaryMode: 0,
      boundaryProfileKey: null,
      subTopicProfile: null,
      allowedConceptIds: [],
      forbiddenConceptIds: [],
      neighbouringConceptIds: [],
      enforce: false,
      boundaryStatus: "off",
    };
  }

  return {
    active: true,
    mode,
    boundaryMode: mode,
    boundaryProfileKey: profile.taxonomyKey,
    subTopicProfile: profile,
    allowedConceptIds: profile.primaryConcepts.map((c) => c.id),
    forbiddenConceptIds: profile.forbiddenConcepts.map((c) => c.id),
    neighbouringConceptIds: profile.neighbouringConcepts.map((c) => c.id),
    enforce: isSubTopicBoundaryEnforcementEnabled(),
    boundaryStatus: mode === 2 ? "enforce" : "warn",
  };
}

/**
 * Merge profile primary concepts into core concept list for planning.
 * @param {object[]} coreConcepts
 * @param {import("./subTopicProfiles").SubTopicProfile|null} profile
 */
function mergePrimaryConceptsIntoCore(coreConcepts = [], profile) {
  if (!profile) return coreConcepts;
  const byId = new Map((coreConcepts || []).map((c) => [c.id, c]));
  let order = Math.max(0, ...[...byId.values()].map((c) => c.teachingOrder || 0));

  for (const primary of profile.primaryConcepts) {
    if (byId.has(primary.id)) continue;
    order += 1;
    byId.set(primary.id, {
      id: primary.id,
      name: primary.name,
      importance: "core",
      teachingOrder: order,
      summary: primary.name,
      aqaExamPhrase: primary.name,
      linksTo: [],
    });
  }

  return [...byId.values()];
}

/**
 * @param {string} conceptId
 * @param {object} boundaryContext
 * @param {string} generationKind
 */
function isBoundaryBlockedConcept(conceptId, boundaryContext, generationKind) {
  if (!boundaryContext?.active || !conceptId || !boundaryContext.subTopicProfile) {
    return false;
  }
  const result = validateGenerationSlot(
    {
      conceptId,
      generationKind: generationKind || "practice",
      isPrimary: true,
    },
    boundaryContext.subTopicProfile
  );
  return result.wouldReject;
}

/**
 * Select coverage slot with boundary applied before CoverageGate ranking.
 * @param {object} coverageMap
 * @param {object} request
 * @param {object} boundaryContext
 */
function selectNextGenerationSlotWithBoundary(coverageMap, request = {}, boundaryContext) {
  if (!boundaryContext?.active) {
    return {
      slot: selectNextGenerationSlot(coverageMap, request),
      avoidedBoundaryConcepts: [],
      outOfScopeWarnings: [],
    };
  }

  const excluded = new Set(request.excludedConceptIds || []);
  const avoidedBoundaryConcepts = [];
  const outOfScopeWarnings = [];
  const kind = request.generationKind || "practice";
  let slot = null;

  for (let attempt = 0; attempt < 30; attempt++) {
    slot = selectNextGenerationSlot(coverageMap, {
      ...request,
      excludedConceptIds: [...excluded],
    });

    if (!slot.conceptId) break;

    if (!isBoundaryBlockedConcept(slot.conceptId, boundaryContext, kind)) {
      break;
    }

    const validation = validateGenerationSlot(
      { conceptId: slot.conceptId, generationKind: kind, isPrimary: true },
      boundaryContext.subTopicProfile
    );

    avoidedBoundaryConcepts.push({
      conceptId: slot.conceptId,
      conceptName: slot.conceptName,
      classification: validation.classification,
      reason: validation.reason,
      generationKind: kind,
    });
    outOfScopeWarnings.push(validation.reason);
    excluded.add(slot.conceptId);
  }

  if (slot?.conceptId && boundaryContext.enforce) {
    const validation = validateGenerationSlot(
      { conceptId: slot.conceptId, generationKind: kind, isPrimary: true },
      boundaryContext.subTopicProfile
    );
    if (validation.wouldReject) {
      slot = {
        ...slot,
        allowed: false,
        warnings: [...(slot.warnings || []), validation.reason],
        rationale: validation.reason,
      };
    }
  }

  return {
    slot,
    avoidedBoundaryConcepts,
    outOfScopeWarnings: [...new Set(outOfScopeWarnings)],
  };
}

/**
 * @param {object} boundaryContext
 * @param {object[]} [pages]
 */
function buildBoundaryReviewFromLesson(boundaryContext, pages = []) {
  if (!boundaryContext?.active || !boundaryContext.subTopicProfile) {
    return null;
  }

  const profile = boundaryContext.subTopicProfile;
  const contamination = scoreScopeContamination(pages, profile);

  const inScopeConcepts = profile.primaryConcepts.map((c) => ({
    id: c.id,
    name: c.name,
    scope: "in_scope",
  }));

  const outOfScopeConcepts = [
    ...profile.forbiddenConcepts.map((c) => ({ id: c.id, name: c.name, scope: "forbidden" })),
    ...profile.neighbouringConcepts.map((c) => ({ id: c.id, name: c.name, scope: "neighbouring" })),
  ];

  return {
    boundaryProfileKey: boundaryContext.boundaryProfileKey,
    boundaryMode: boundaryContext.boundaryMode,
    boundaryStatus: boundaryContext.boundaryStatus,
    inScopeConcepts,
    outOfScopeConcepts,
    scopeContaminationScore: contamination.contaminationScore,
    inScopePct: contamination.inScopePct,
    assessedCount: contamination.assessedCount,
    outOfScopeCount: contamination.outOfScopeCount,
    boundaryWarnings: contamination.violations.map((v) => v.reason),
    violations: contamination.violations,
    reportOnly: contamination.reportOnly,
  };
}

/**
 * Prompt appendix for Teacher Brain / one-shot generation.
 * @param {object} boundaryContext
 */
function formatSubTopicBoundaryAppendix(boundaryContext) {
  if (!boundaryContext?.active || !boundaryContext.subTopicProfile) return "";

  const profile = boundaryContext.subTopicProfile;
  const display =
    profile.taxonomyKey === "nervous-system-structure"
      ? "Structure and function of the nervous system"
      : profile.taxonomyKey;

  const forbiddenLines = profile.forbiddenConcepts.map((c) => `* ${c.name}`).join("\n");
  const primaryLines = profile.primaryConcepts.map((c) => `* ${c.name}`).join("\n");

  const modeNote =
    boundaryContext.mode === 2
      ? "Enforcement is ON: do not assign forbidden concepts as primary activity/question targets."
      : "Warn mode: stay in scope; forbidden concepts are deprioritised in planning.";

  return [
    "SUB-TOPIC BOUNDARY (required — applies before coverage balancing):",
    `Selected sub-topic: ${display}.`,
    "Stay inside this sub-topic.",
    modeNote,
    "",
    "In-scope primary concepts:",
    primaryLines,
    "",
    "Do not create activities, flashcards, quizzes, checkpoints, diagrams or exam questions whose primary objective is:",
    forbiddenLines,
    "",
    "Neighbouring sub-topics (reflex arc, brain, eye) may be mentioned briefly for context only — not as primary assessment targets.",
  ].join("\n");
}

/**
 * Attach boundary fields to coverage diagnostic / metadata.
 * @param {object} diagnostic
 * @param {object} boundaryContext
 * @param {object} [boundaryResult]
 */
function attachBoundaryToDiagnostic(diagnostic, boundaryContext, boundaryResult = {}) {
  if (!diagnostic) return diagnostic;
  if (!boundaryContext?.active) {
    return {
      ...diagnostic,
      boundaryMode: 0,
      boundaryStatus: "off",
    };
  }

  return {
    ...diagnostic,
    boundaryProfileKey: boundaryContext.boundaryProfileKey,
    boundaryMode: boundaryContext.boundaryMode,
    boundaryStatus: boundaryContext.boundaryStatus,
    avoidedBoundaryConcepts: boundaryResult.avoidedBoundaryConcepts || [],
    outOfScopeWarnings: boundaryResult.outOfScopeWarnings || [],
  };
}

module.exports = {
  buildSubTopicBoundaryContext,
  mergePrimaryConceptsIntoCore,
  isBoundaryBlockedConcept,
  selectNextGenerationSlotWithBoundary,
  buildBoundaryReviewFromLesson,
  formatSubTopicBoundaryAppendix,
  attachBoundaryToDiagnostic,
  listProfileConcepts,
  classifyConcept,
};
