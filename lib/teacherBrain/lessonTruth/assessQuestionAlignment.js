/**
 * Phase 2 — deterministic lesson alignment gate (server-only).
 */

const { textMentionsConcept } = require("./conceptNormalization");
const {
  discoverQuestionAssessmentConcepts,
} = require("./extractQuestionAssessmentConcepts");
const { conceptEvidenceIds } = require("./planAssessmentTargets");
const {
  ALIGNMENT_VERDICT,
  REASON_CODES,
  CONFIDENCE_TIER,
  cognitiveBandDistance,
  globalLedgerKey,
  sortReasonCodes,
} = require("./assessmentTargetTypes");

function findAssignedTarget(plan, assignedTargetId) {
  return (plan?.semantic?.targets || plan?.targets || []).find((t) => t.targetId === assignedTargetId);
}

function resolveDiscoveredConcept(conceptId, label, lessonTruthSemantic) {
  const pools = [
    ...(lessonTruthSemantic?.requiredConcepts || []).map((ref) => ({ ref, kind: "required" })),
    ...(lessonTruthSemantic?.supportingConcepts || []).map((ref) => ({ ref, kind: "supporting" })),
  ];
  for (const entry of pools) {
    const { ref, kind } = entry;
    if (conceptId === ref.id) return { truthId: ref.id, kind };
    if (textMentionsConcept(label, ref)) return { truthId: ref.id, kind };
    if (textMentionsConcept(conceptId.replace(/_/g, " "), ref)) return { truthId: ref.id, kind };
  }
  return null;
}

function conceptAuthorizedForTarget(conceptId, label, assignedTarget, lessonTruthSemantic) {
  const resolved = resolveDiscoveredConcept(conceptId, label, lessonTruthSemantic);
  if (!resolved) return "unauthorized";
  if ((assignedTarget?.primaryConceptIds || []).includes(resolved.truthId)) return "primary";
  if ((assignedTarget?.supportingConceptIds || []).includes(resolved.truthId)) return "supporting";
  if (resolved.kind === "required") return "required_unassigned";
  return "supporting_unlinked";
}

function matchesConceptSet(discoveredIds, expectedIds) {
  const a = [...discoveredIds].sort();
  const b = [...expectedIds].sort();
  if (a.length !== b.length) return false;
  return a.every((id, i) => id === b[i]);
}

function checkExclusion(conceptId, lessonTruthSemantic) {
  for (const ex of lessonTruthSemantic?.assessmentExclusions || []) {
    if (conceptId === ex.id || textMentionsConcept(conceptId.replace(/_/g, " "), ex)) {
      return REASON_CODES.ASSESSMENT_EXCLUSION;
    }
  }
  for (const ex of lessonTruthSemantic?.outOfScopeConcepts || []) {
    if (conceptId === ex.id || textMentionsConcept(conceptId.replace(/_/g, " "), ex)) {
      return REASON_CODES.OUT_OF_SCOPE_TARGET;
    }
  }
  return null;
}

function checkDuplication(assignedTarget, usageLedger) {
  if (!assignedTarget || !usageLedger) return null;
  const ledger = usageLedger.global || {};
  for (const conceptId of assignedTarget.primaryConceptIds || []) {
    const key = globalLedgerKey(conceptId, assignedTarget.cognitiveLevel);
    const used = ledger[key] || 0;
    const allowed = assignedTarget.maxGlobalUses || 1;
    if (used >= allowed) return REASON_CODES.DUPLICATE_CONCEPT_TARGET;
  }
  return null;
}

function checkCompoundTarget(discovery, assignedTarget, lessonTruthSemantic) {
  const mode = assignedTarget?.targetMode || "single";
  const confidentIds = discovery.confidentDirectConcepts
    .map((d) => resolveDiscoveredConcept(d.conceptId, d.label, lessonTruthSemantic)?.truthId || d.conceptId)
    .filter(Boolean);
  const uniqueConfident = [...new Set(confidentIds)].sort();

  if (mode === "compare") {
    if (!discovery.isCompareStem && !/\bdifference between\b/i.test(discovery.stem)) {
      return REASON_CODES.TARGET_ASSIGNMENT_MISMATCH;
    }
    if ((assignedTarget.primaryConceptIds || []).length !== 2) {
      return REASON_CODES.TARGET_ASSIGNMENT_MISMATCH;
    }
    if (!matchesConceptSet(uniqueConfident, assignedTarget.primaryConceptIds)) {
      return REASON_CODES.TARGET_ASSIGNMENT_MISMATCH;
    }
  }

  if (mode === "relationship") {
    if (!discovery.isRelationshipStem && !/\b(contributes?|affects?|leads?|causes?)\b/i.test(discovery.stem)) {
      return REASON_CODES.TARGET_ASSIGNMENT_MISMATCH;
    }
    if ((assignedTarget.primaryConceptIds || []).length !== 2) {
      return REASON_CODES.TARGET_ASSIGNMENT_MISMATCH;
    }
  }

  return null;
}

function authorizeDirectConcepts(discovery, assignedTarget, lessonTruthSemantic) {
  const reasons = [];

  if (!discovery.hasConfidentDirect) {
    if (discovery.hasAmbiguousOnly) {
      return { verdict: ALIGNMENT_VERDICT.REVIEW, reasons: [REASON_CODES.NO_PRIMARY_CONCEPT_MATCH] };
    }
    return { verdict: ALIGNMENT_VERDICT.REVIEW, reasons: [REASON_CODES.NO_PRIMARY_CONCEPT_MATCH] };
  }

  const confidentDirect = discovery.confidentDirectConcepts;

  for (const item of confidentDirect) {
    const exclusion = checkExclusion(item.conceptId, lessonTruthSemantic);
    if (exclusion) {
      reasons.push(exclusion);
      continue;
    }

    const auth = conceptAuthorizedForTarget(
      item.conceptId,
      item.label,
      assignedTarget,
      lessonTruthSemantic
    );
    if (auth === "primary") continue;
    if (auth === "supporting") {
      reasons.push(REASON_CODES.SUPPORTING_AS_PRIMARY);
      continue;
    }
    if (auth === "supporting_unlinked") {
      reasons.push(REASON_CODES.SUPPORTING_AS_PRIMARY);
      continue;
    }
    if (auth === "required_unassigned") {
      reasons.push(REASON_CODES.UNAUTHORIZED_CONCEPT);
      continue;
    }
    reasons.push(REASON_CODES.UNAUTHORIZED_CONCEPT);
  }

  for (const ctx of discovery.contextConcepts.filter((c) => c.confidence === CONFIDENCE_TIER.CONFIDENT)) {
    const auth = conceptAuthorizedForTarget(
      ctx.conceptId,
      ctx.label,
      assignedTarget,
      lessonTruthSemantic
    );
    if (auth === "supporting" || auth === "primary") continue;
    if (auth === "supporting_unlinked" && /\b(contributes?|affects?|leads?|causes?)\b/i.test(discovery.stem)) {
      reasons.push(REASON_CODES.SUPPORTING_AS_PRIMARY);
    }
  }

  const uniq = sortReasonCodes(reasons);
  if (uniq.some((r) => r === REASON_CODES.UNAUTHORIZED_CONCEPT || r === REASON_CODES.ASSESSMENT_EXCLUSION || r === REASON_CODES.OUT_OF_SCOPE_TARGET || r === REASON_CODES.SUPPORTING_AS_PRIMARY)) {
    return { verdict: ALIGNMENT_VERDICT.REGENERATE, reasons: uniq };
  }

  return { verdict: null, reasons: [] };
}

function checkTaughtEvidence(assignedTarget, lessonTruthSemantic) {
  for (const conceptId of assignedTarget?.primaryConceptIds || []) {
    const evidence = conceptEvidenceIds(lessonTruthSemantic?.taughtEvidence, conceptId);
    if (!evidence.length) return REASON_CODES.NO_TAUGHT_EVIDENCE;
  }
  return null;
}

/**
 * @param {object} input QuestionAlignmentInput
 */
function assessQuestionAlignment(input = {}) {
  const lessonTruth = input.lessonTruth;
  const plan = input.assessmentPlan;
  const semantic = lessonTruth?.semantic;
  const assignedTarget = input.assignedTargetId
    ? findAssignedTarget(plan, input.assignedTargetId)
    : null;

  const discovery = discoverQuestionAssessmentConcepts({
    stem: input.stem,
    options: input.options,
    modelAnswer: input.modelAnswer,
  });

  const reasons = [];

  if (!semantic) {
    return {
      verdict: ALIGNMENT_VERDICT.REVIEW,
      reasons: [REASON_CODES.NO_PRIMARY_CONCEPT_MATCH],
      discovery,
      assignedTarget: assignedTarget || null,
    };
  }

  if (assignedTarget) {
    const noEvidence = checkTaughtEvidence(assignedTarget, semantic);
    if (noEvidence) reasons.push(noEvidence);

    const compoundIssue = checkCompoundTarget(discovery, assignedTarget, semantic);
    if (compoundIssue) reasons.push(compoundIssue);

    const dup = checkDuplication(assignedTarget, input.usageLedger);
    if (dup) reasons.push(dup);
  }

  const authResult = authorizeDirectConcepts(discovery, assignedTarget, semantic);
  if (authResult.verdict === ALIGNMENT_VERDICT.REVIEW) {
    return {
      verdict: ALIGNMENT_VERDICT.REVIEW,
      reasons: sortReasonCodes(authResult.reasons),
      discovery,
      assignedTarget: assignedTarget || null,
    };
  }
  if (authResult.verdict === ALIGNMENT_VERDICT.REGENERATE) {
    return {
      verdict: ALIGNMENT_VERDICT.REGENERATE,
      reasons: sortReasonCodes([...reasons, ...authResult.reasons]),
      discovery,
      assignedTarget: assignedTarget || null,
    };
  }

  if (assignedTarget && input.observedCognitiveLevel) {
    const distance = cognitiveBandDistance(
      input.observedCognitiveLevel,
      assignedTarget.cognitiveLevel
    );
    if (distance != null) {
      if (distance >= 2) reasons.push(REASON_CODES.COGNITIVE_LEVEL_MISMATCH);
      else if (distance === 1) {
        return {
          verdict: ALIGNMENT_VERDICT.REVIEW,
          reasons: sortReasonCodes([...reasons, REASON_CODES.COGNITIVE_LEVEL_MISMATCH]),
          discovery,
          assignedTarget,
        };
      }
    }
  }

  if (reasons.length) {
    return {
      verdict: ALIGNMENT_VERDICT.REGENERATE,
      reasons: sortReasonCodes(reasons),
      discovery,
      assignedTarget: assignedTarget || null,
    };
  }

  if (
    discovery.confidentDirectConcepts.length > 1 &&
    assignedTarget &&
    (assignedTarget.targetMode || "single") === "single" &&
    !discovery.isCompareStem &&
    !/\bdifference between\b/i.test(discovery.stem)
  ) {
    const ids = discovery.confidentDirectConcepts.map((d) => d.conceptId);
    if (!ids.every((id) => assignedTarget.primaryConceptIds.includes(id))) {
      return {
        verdict: ALIGNMENT_VERDICT.REVIEW,
        reasons: [REASON_CODES.AMBIGUOUS_ALIGNMENT],
        discovery,
        assignedTarget,
      };
    }
  }

  return {
    verdict: ALIGNMENT_VERDICT.ACCEPT,
    reasons: [REASON_CODES.AUTHORIZED],
    discovery,
    assignedTarget: assignedTarget || null,
  };
}

module.exports = {
  assessQuestionAlignment,
  findAssignedTarget,
  conceptAuthorizedForTarget,
};
