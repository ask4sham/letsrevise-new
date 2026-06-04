/**
 * Phase 3C — boundary-aware replacement planning for future generation reroute.
 * Does not mutate existing lesson content.
 */

const { getSubTopicBoundaryMode, isSubTopicBoundaryEnforcementEnabled } = require("./subTopicBoundaryGuard");
const { listProfileConcepts } = require("./subTopicProfiles");
const {
  mergeInteractionPlanIntoReplacementPlan,
  formatBoundaryInteractionReplacementAppendix,
} = require("./boundaryInteractionReplacementPlanner");

/** @type {Record<string, { targets: string[]; activityKind: string; cognitiveSkill: string }>} */
const NERVOUS_SYSTEM_STRUCTURE_REROUTES = {
  reflex_arc_pathway: {
    targets: ["neurones", "impulse_transmission", "myelin_sheath"],
    activityKind: "checkpoint",
    cognitiveSkill: "Explain",
  },
  reflex_arc: {
    targets: ["neurones", "impulse_transmission", "myelin_sheath"],
    activityKind: "checkpoint",
    cognitiveSkill: "Explain",
  },
  thermoregulation: {
    targets: ["myelin_sheath", "impulse_transmission"],
    activityKind: "checkpoint",
    cognitiveSkill: "Explain",
  },
  accommodation: {
    targets: ["neurones", "dendrites", "axons"],
    activityKind: "labeldiagram",
    cognitiveSkill: "Apply",
  },
  eye: {
    targets: ["neurones", "dendrites", "axons"],
    activityKind: "labeldiagram",
    cognitiveSkill: "Apply",
  },
  brain_regions: {
    targets: ["neurones", "cns", "pns"],
    activityKind: "labeldiagram",
    cognitiveSkill: "Apply",
  },
  brain: {
    targets: ["neurones", "cns", "pns"],
    activityKind: "labeldiagram",
    cognitiveSkill: "Apply",
  },
};

const REPLACEMENT_MARKER = "--- BOUNDARY REPLACEMENT PLAN (Phase 3C)";

function emptyPlan(mode = 0) {
  return {
    replacementPlans: [],
    blockedConceptIds: [],
    preferredConceptIds: [],
    promptInstructions: [],
    reportOnly: true,
    rerouteActive: false,
    boundaryMode: mode,
  };
}

function conceptNameForId(conceptId, profile) {
  if (!conceptId || !profile) return conceptId || "";
  for (const c of listProfileConcepts(profile)) {
    if (c.id === conceptId) return c.name;
  }
  return conceptId;
}

function rerouteSpecForConcept(conceptId, profile) {
  const key = profile?.taxonomyKey;
  if (key === "nervous-system-structure" && NERVOUS_SYSTEM_STRUCTURE_REROUTES[conceptId]) {
    return NERVOUS_SYSTEM_STRUCTURE_REROUTES[conceptId];
  }
  const primary = profile?.primaryConcepts?.[0];
  return primary
    ? { targets: [primary.id], activityKind: "checkpoint", cognitiveSkill: "Explain" }
    : { targets: [], activityKind: "checkpoint", cognitiveSkill: "Explain" };
}

/**
 * Pick least-tested in-scope target from coverage map.
 * @param {string[]} targetIds
 * @param {object} coverageMap
 * @param {import("./subTopicProfiles").SubTopicProfile} profile
 */
function pickReplacementTarget(targetIds, coverageMap, profile) {
  const ids = (targetIds || []).filter(Boolean);
  if (!ids.length) return profile?.centralConceptId || null;

  const rows = coverageMap?.concepts || [];
  const byId = new Map(rows.map((c) => [c.id, c]));

  let best = ids[0];
  let bestScore = Infinity;
  for (const id of ids) {
    const row = byId.get(id);
    const score = row ? row.testedCount * 10 + row.taughtCount : 0;
    if (score < bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

function activityKindForGenerationKind(generationKind, fallback) {
  const k = String(generationKind || "").toLowerCase();
  if (k === "flashcard" || k === "retrieval") return "flashcard";
  if (k === "quiz") return "quiz";
  if (k === "exam") return "exam";
  if (k === "activity") return fallback || "activity";
  return fallback || "checkpoint";
}

/**
 * @param {object} input
 * @param {object} [input.boundaryAudit]
 * @param {import("./subTopicProfiles").SubTopicProfile|null} [input.subTopicProfile]
 * @param {object} [input.coverageMap]
 * @param {string} [input.generationKind]
 */
function planBoundaryReplacements(input = {}) {
  const mode = getSubTopicBoundaryMode();
  if (mode === 0) return emptyPlan(0);

  const profile = input.subTopicProfile;
  const audit = input.boundaryAudit;
  if (!profile || !audit?.boundaryProfileKey) return emptyPlan(mode);

  const generationKind = input.generationKind || "practice";
  const coverageMap = input.coverageMap;
  const rerouteActive = isSubTopicBoundaryEnforcementEnabled();

  const outOfScopeFindings = (audit.blockFindings || []).filter(
    (f) => f.boundaryStatus === "forbidden" || f.boundaryStatus === "neighbouring"
  );

  const seenOriginal = new Set();
  const replacementPlans = [];

  for (const finding of outOfScopeFindings) {
    const originalId = finding.primaryConceptId;
    if (!originalId || seenOriginal.has(originalId)) continue;
    seenOriginal.add(originalId);

    const spec = rerouteSpecForConcept(originalId, profile);
    const targetId = pickReplacementTarget(spec.targets, coverageMap, profile);
    if (!targetId) continue;

    const activityKind = activityKindForGenerationKind(generationKind, spec.activityKind);

    replacementPlans.push({
      originalConceptId: originalId,
      originalConceptName: finding.primaryConceptName || conceptNameForId(originalId, profile),
      violationType: finding.boundaryStatus,
      suggestedReplacementConceptId: targetId,
      suggestedReplacementConceptName: conceptNameForId(targetId, profile),
      suggestedActivityKind: activityKind,
      cognitiveSkill: spec.cognitiveSkill,
      reason: `${finding.primaryConceptName || originalId} is ${finding.boundaryStatus} for this sub-topic; reroute future ${generationKind} to ${conceptNameForId(targetId, profile)}.`,
    });
  }

  const blockedConceptIds = [
    ...new Set([
      ...profile.forbiddenConcepts.map((c) => c.id),
      ...(rerouteActive ? profile.neighbouringConcepts.map((c) => c.id) : []),
      ...replacementPlans.map((p) => p.originalConceptId),
    ]),
  ];

  const preferredFromPlans = replacementPlans.map((p) => p.suggestedReplacementConceptId);
  const underTestedPrimaries = (coverageMap?.concepts || [])
    .filter(
      (c) =>
        profile.primaryConcepts.some((p) => p.id === c.id) &&
        c.testedCount <= 1 &&
        !blockedConceptIds.includes(c.id)
    )
    .sort((a, b) => a.testedCount - b.testedCount)
    .map((c) => c.id);

  const preferredConceptIds = [
    ...new Set([...preferredFromPlans, ...underTestedPrimaries, profile.centralConceptId].filter(Boolean)),
  ];

  const promptInstructions = [];
  if (replacementPlans.length) {
    promptInstructions.push(
      "Out-of-scope primary concepts detected in this lesson — do NOT use them as the primary focus of new generated items:"
    );
    for (const p of replacementPlans.slice(0, 8)) {
      promptInstructions.push(
        `- Instead of "${p.originalConceptName}" (${p.violationType}), use "${p.suggestedReplacementConceptName}" (${p.suggestedActivityKind}, ${p.cognitiveSkill}).`
      );
    }
  }

  if (preferredConceptIds.length) {
    promptInstructions.push(
      `Prefer in-scope concepts for new generation: ${preferredConceptIds
        .map((id) => conceptNameForId(id, profile))
        .slice(0, 8)
        .join(", ")}.`
    );
  }

  if (rerouteActive) {
    promptInstructions.push(
      "Enforcement mode: blocked concepts must not be selected as primary targets for new checkpoints, quiz items, flashcards, or exam drafts."
    );
  } else {
    promptInstructions.push(
      "Advisory mode: follow replacement guidance when planning new items; existing lesson blocks are unchanged."
    );
  }

  const conceptPlan = {
    replacementPlans,
    blockedConceptIds,
    preferredConceptIds,
    promptInstructions,
    conceptPromptInstructions: [...promptInstructions],
    reportOnly: !rerouteActive,
    rerouteActive,
    boundaryMode: mode,
    boundaryProfileKey: profile.taxonomyKey,
  };

  return mergeInteractionPlanIntoReplacementPlan(conceptPlan, audit, profile);
}

/**
 * @param {object} replacementPlan
 */
function formatBoundaryReplacementAppendix(replacementPlan) {
  const conceptLines =
    replacementPlan?.conceptPromptInstructions || replacementPlan?.promptInstructions;
  const hasConcept = conceptLines?.length > 0;
  const interactionSection = formatBoundaryInteractionReplacementAppendix(replacementPlan);
  if (!hasConcept && !interactionSection) return "";

  const parts = [];
  if (hasConcept) {
    parts.push(REPLACEMENT_MARKER, "", ...conceptLines);
    if (replacementPlan.rerouteActive) {
      parts.push("", "Reroute enforcement is ON for this generation request.");
    }
  }
  if (interactionSection) {
    if (parts.length) parts.push("", interactionSection);
    else parts.push(interactionSection);
  }
  return parts.join("\n");
}

/**
 * Compact metadata for API responses.
 * @param {ReturnType<typeof planBoundaryReplacements>} plan
 */
function boundaryReplacementResponseMeta(plan) {
  if (
    !plan?.replacementPlans?.length &&
    !plan?.blockedConceptIds?.length &&
    !plan?.interactionReplacementPlans?.length
  ) {
    return null;
  }
  return {
    boundaryProfileKey: plan.boundaryProfileKey,
    boundaryMode: plan.boundaryMode,
    rerouteActive: plan.rerouteActive,
    reportOnly: plan.reportOnly,
    blockedConceptIds: plan.blockedConceptIds,
    preferredConceptIds: plan.preferredConceptIds,
    replacementCount: plan.replacementPlans.length,
    replacementPlans: plan.replacementPlans.slice(0, 12),
    promptInstructions: plan.promptInstructions,
    interactionReplacementPlans: plan.interactionReplacementPlans?.slice(0, 12),
    interactionPromptInstructions: plan.interactionPromptInstructions,
    interactionRerouteActive: plan.interactionRerouteActive,
  };
}

/**
 * Build audit + replacement plan from lesson-shaped input.
 * @param {object} options — same shape as auditLessonBoundary input
 * @param {object} coverageMap
 * @param {string} [generationKind]
 */
function buildBoundaryReplacementFromLesson(options = {}, coverageMap = null, generationKind = "practice") {
  const { auditLessonBoundary } = require("./lessonBoundaryAudit");
  const { resolveSubTopicProfile } = require("./subTopicProfiles");

  const profile = resolveSubTopicProfile(options);
  const audit = auditLessonBoundary(options);
  const plan = planBoundaryReplacements({
    boundaryAudit: audit,
    subTopicProfile: profile,
    coverageMap,
    generationKind,
  });
  return { audit, plan, profile };
}

module.exports = {
  planBoundaryReplacements,
  formatBoundaryReplacementAppendix,
  boundaryReplacementResponseMeta,
  buildBoundaryReplacementFromLesson,
  NERVOUS_SYSTEM_STRUCTURE_REROUTES,
  REPLACEMENT_MARKER,
};
