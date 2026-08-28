/**

 * Phase 2 — deterministic assessment target planning from Lesson Truth.

 */



const { canonicalizeSemantic, hashSemantic } = require("./canonicalize");

const { safeStr, textMentionsConcept } = require("./conceptNormalization");

const {

  PLAN_VERSION,

  TARGET_MODE_COMPARE,

  TARGET_MODE_RELATIONSHIP,

  RECURRENCE_BREADTH,

  RECURRENCE_DEPTH,

  RECURRENCE_COMPARE,

  buildTargetId,

  defaultCognitiveForSurface,

  nextCognitiveLevel,

  globalLedgerKey,

  normalizeAssessmentRequirement,

  compareStrings,

} = require("./assessmentTargetTypes");



const DEFAULT_MAX_GLOBAL_USES = 1;

const DEFAULT_MAX_SURFACE_USES = 1;

const UNASSIGNED_REASON_NO_RELATED_PAIR = "NO_RELATED_PAIR";

const UNASSIGNED_REASON_NO_COGNITIVE_LEVEL = "NO_AVAILABLE_COGNITIVE_LEVEL";

const UNASSIGNED_REASON_AMBIGUOUS_RELATED_PAIR = "AMBIGUOUS_RELATED_PAIR";



function conceptEvidenceIds(taughtEvidence, conceptId) {

  return (taughtEvidence || [])

    .filter((ev) => (ev.conceptIds || []).includes(conceptId))

    .map((ev) => ev.evidenceId)

    .sort(compareStrings);

}



function objectiveIdsForConcept(taughtEvidence, conceptId) {

  const ids = new Set();

  for (const ev of taughtEvidence || []) {

    if (!(ev.conceptIds || []).includes(conceptId)) continue;

    for (const oid of ev.objectiveIds || []) ids.add(oid);

  }

  return [...ids].sort(compareStrings);

}



function rankRequiredConcepts(requiredConcepts, taughtEvidence) {

  return [...(requiredConcepts || [])]

    .map((concept) => {

      const evidenceIds = conceptEvidenceIds(taughtEvidence, concept.id);

      const objectiveIds = objectiveIdsForConcept(taughtEvidence, concept.id);

      const hasDefinition = evidenceIds.some((eid) => {

        const ev = (taughtEvidence || []).find((x) => x.evidenceId === eid);

        return Boolean(ev?.summary && /\bis\b/i.test(ev.summary));

      });

      return {

        concept,

        evidenceCount: evidenceIds.length,

        objectiveCount: objectiveIds.length,

        hasDefinition,

        evidenceIds,

        objectiveIds,

      };

    })

    .filter((row) => row.evidenceCount > 0)

    .sort((a, b) => {

      if (b.evidenceCount !== a.evidenceCount) return b.evidenceCount - a.evidenceCount;

      if (b.objectiveCount !== a.objectiveCount) return b.objectiveCount - a.objectiveCount;

      if (Number(b.hasDefinition) !== Number(a.hasDefinition)) {

        return Number(b.hasDefinition) - Number(a.hasDefinition);

      }

      return compareStrings(a.concept.id, b.concept.id);

    });

}



function objectiveReferencesConcept(objective, conceptRef) {

  if (!objective || !conceptRef) return false;

  const objHay = `${safeStr(objective.text)} ${(objective.matchTerms || []).join(" ")}`.toLowerCase();

  const terms = [...(conceptRef.matchTerms || []), conceptRef.name]

    .map((t) => safeStr(t).toLowerCase())

    .filter(Boolean);

  for (const term of terms) {

    if (objHay.includes(term)) return true;

    for (const matchTerm of objective.matchTerms || []) {

      const ot = safeStr(matchTerm).toLowerCase();

      if (ot.length >= 4 && term.includes(ot)) return true;

    }

  }

  return textMentionsConcept(objective.text, conceptRef);

}



function scoreRelatedPair(left, right, learningObjectives) {

  let best = 0;



  if (left.objectiveIds.some((oid) => right.objectiveIds.includes(oid))) {

    best = Math.max(best, 200);

  }



  if (left.evidenceIds.some((eid) => right.evidenceIds.includes(eid))) {

    best = Math.max(best, 300);

  }



  for (const objective of learningObjectives || []) {

    if (!objective?.objectiveId) continue;

    const leftReferenced = objectiveReferencesConcept(objective, left.concept);

    const rightReferenced = objectiveReferencesConcept(objective, right.concept);

    if (!leftReferenced || !rightReferenced) continue;



    let score = 100;

    const leftLinked = left.objectiveIds.includes(objective.objectiveId);

    const rightLinked = right.objectiveIds.includes(objective.objectiveId);

    if (leftLinked) score += 40;

    if (rightLinked) score += 40;

    if (leftLinked && rightLinked) score += 50;

    best = Math.max(best, score);

  }



  return best;

}



function conceptsShareLessonRelation(left, right, learningObjectives) {

  return scoreRelatedPair(left, right, learningObjectives) > 0;

}



function evidenceBlockRole(taughtEvidence, evidenceId) {

  const ev = (taughtEvidence || []).find((x) => x.evidenceId === evidenceId);

  return safeStr(ev?.role || ev?.blockRole).toLowerCase();

}



function pairEvidenceTopology(left, right, taughtEvidence) {

  const sharedEvidence = left.evidenceIds.filter((eid) => right.evidenceIds.includes(eid));

  const exclusiveA = left.evidenceIds.filter((eid) => !sharedEvidence.includes(eid));

  const exclusiveB = right.evidenceIds.filter((eid) => !sharedEvidence.includes(eid));

  const sharedObjective = left.objectiveIds.filter((oid) => right.objectiveIds.includes(oid));

  const rolesA = exclusiveA.map((eid) => evidenceBlockRole(taughtEvidence, eid));

  const rolesB = exclusiveB.map((eid) => evidenceBlockRole(taughtEvidence, eid));

  const bothConceptRoleExclusive =

    exclusiveA.length > 0 &&

    exclusiveB.length > 0 &&

    rolesA.includes("concept") &&

    rolesB.includes("concept")

      ? 1

      : 0;



  return {

    bothIndependent: exclusiveA.length > 0 && exclusiveB.length > 0 ? 1 : 0,

    minExclusive: Math.min(exclusiveA.length, exclusiveB.length),

    evidenceBalance: Math.abs(left.evidenceIds.length - right.evidenceIds.length),

    sharedObjectiveOnEvidence: sharedObjective.length,

    bothConceptRoleExclusive,

  };

}



function comparePairCandidates(a, b, forCompare) {

  if (a.score !== b.score) return b.score - a.score;

  if (a.topology.bothIndependent !== b.topology.bothIndependent) {

    return b.topology.bothIndependent - a.topology.bothIndependent;

  }

  if (a.topology.minExclusive !== b.topology.minExclusive) {

    return b.topology.minExclusive - a.topology.minExclusive;

  }

  if (a.topology.evidenceBalance !== b.topology.evidenceBalance) {

    return a.topology.evidenceBalance - b.topology.evidenceBalance;

  }

  if (a.topology.sharedObjectiveOnEvidence !== b.topology.sharedObjectiveOnEvidence) {

    return b.topology.sharedObjectiveOnEvidence - a.topology.sharedObjectiveOnEvidence;

  }

  if (forCompare && a.topology.bothConceptRoleExclusive !== b.topology.bothConceptRoleExclusive) {

    return b.topology.bothConceptRoleExclusive - a.topology.bothConceptRoleExclusive;

  }

  return 0;

}



/**

 * @returns {{ pair: string[]|null, reason: string|null }}

 */

function selectRelatedPair(ranked, learningObjectives, usedPairKeys = new Set(), options = {}) {

  const { forCompare = false, taughtEvidence = [] } = options;

  const candidates = [];



  for (let i = 0; i < ranked.length; i += 1) {

    for (let j = i + 1; j < ranked.length; j += 1) {

      const left = ranked[i];

      const right = ranked[j];

      const score = scoreRelatedPair(left, right, learningObjectives);

      if (score <= 0) continue;



      const primaryConceptIds = [left.concept.id, right.concept.id].sort(compareStrings);

      const pairKey = primaryConceptIds.join("+");

      if (usedPairKeys.has(pairKey)) continue;



      candidates.push({

        pair: primaryConceptIds,

        pairKey,

        score,

        topology: pairEvidenceTopology(left, right, taughtEvidence),

      });

    }

  }



  if (!candidates.length) {

    return { pair: null, reason: UNASSIGNED_REASON_NO_RELATED_PAIR };

  }



  candidates.sort((a, b) => {

    const cmp = comparePairCandidates(a, b, forCompare);

    if (cmp !== 0) return cmp;

    return compareStrings(a.pairKey, b.pairKey);

  });



  const best = candidates[0];

  const tied = candidates.filter(

    (candidate) =>

      candidate.score === best.score && comparePairCandidates(candidate, best, forCompare) === 0

  );



  if (tied.length > 1 && forCompare) {

    return { pair: null, reason: UNASSIGNED_REASON_AMBIGUOUS_RELATED_PAIR };

  }



  return { pair: best.pair, reason: null };

}



function deriveSupportingForTarget(primaryConceptIds, supportingConcepts, taughtEvidence) {

  const linked = [];

  for (const support of supportingConcepts || []) {

    let attach = false;

    for (const ev of taughtEvidence || []) {

      const hasPrimary = (ev.conceptIds || []).some((id) => primaryConceptIds.includes(id));

      const hasSupport = (ev.conceptIds || []).includes(support.id);

      if (hasPrimary && hasSupport) attach = true;

    }

    if (!attach) continue;

    linked.push(support.id);

  }

  return [...new Set(linked)].sort(compareStrings);

}



function ledgerUsage(ledger, conceptId, cognitiveLevel) {

  return ledger.global[globalLedgerKey(conceptId, cognitiveLevel)] || 0;

}



function resolveCognitiveLevelForConcepts(primaryConceptIds, baseLevel, ledger) {

  let level = baseLevel;

  while (level) {

    const blocked = primaryConceptIds.some(

      (conceptId) => ledgerUsage(ledger, conceptId, level) >= DEFAULT_MAX_GLOBAL_USES

    );

    if (!blocked) return level;

    const next = nextCognitiveLevel(level);

    if (next === level) break;

    level = next;

  }

  return null;

}



function chargeLedger(ledger, primaryConceptIds, cognitiveLevel, surface) {

  for (const conceptId of primaryConceptIds) {

    const gKey = globalLedgerKey(conceptId, cognitiveLevel);

    const sKey = `${conceptId}|${cognitiveLevel}|${surface}`;

    ledger.global[gKey] = (ledger.global[gKey] || 0) + 1;

    ledger.surface[sKey] = (ledger.surface[sKey] || 0) + 1;

  }

}



function buildTarget({

  requirement,

  primaryConceptIds,

  cognitiveLevel,

  recurrenceKind,

  supportingConceptIds,

  taughtEvidence,

}) {

  const { surface, slotIndex, targetMode } = requirement;

  const objectiveIds = [

    ...new Set(primaryConceptIds.flatMap((id) => objectiveIdsForConcept(taughtEvidence, id))),

  ].sort(compareStrings);

  const evidenceIds = [

    ...new Set(primaryConceptIds.flatMap((id) => conceptEvidenceIds(taughtEvidence, id))),

  ].sort(compareStrings);



  return {

    targetId: buildTargetId(surface, slotIndex, primaryConceptIds, cognitiveLevel, targetMode),

    primaryConceptIds: [...primaryConceptIds].sort(compareStrings),

    supportingConceptIds: [...supportingConceptIds].sort(compareStrings),

    objectiveIds,

    cognitiveLevel,

    assessmentSurface: surface,

    evidenceIds,

    priority: slotIndex,

    recurrenceKind,

    maxGlobalUses: DEFAULT_MAX_GLOBAL_USES,

    maxSurfaceUses: DEFAULT_MAX_SURFACE_USES,

    targetMode,

  };

}



function recordUnassigned(unassignedSlots, requirement, reason) {

  unassignedSlots.push({

    slotIndex: requirement.slotIndex,

    surface: requirement.surface,

    targetMode: requirement.targetMode,

    reason,

  });

}



/**

 * @param {import("./types").LessonTruthEnvelope} lessonTruthEnvelope

 * @param {object[]} assessmentRequirements

 */

function planAssessmentTargets(lessonTruthEnvelope, assessmentRequirements = []) {

  if (!lessonTruthEnvelope?.semantic) {

    throw new TypeError("planAssessmentTargets requires lessonTruthEnvelope.semantic");

  }



  const semantic = lessonTruthEnvelope.semantic;

  const requirements = [...assessmentRequirements]

    .map(normalizeAssessmentRequirement)

    .sort((a, b) => a.slotIndex - b.slotIndex || compareStrings(a.surface, b.surface));



  const ranked = rankRequiredConcepts(semantic.requiredConcepts, semantic.taughtEvidence);

  const slotCapacity = requirements.length;

  const prioritized = slotCapacity < ranked.length ? ranked.slice(0, slotCapacity) : ranked;

  const uncoveredConceptIds =

    slotCapacity < ranked.length ? ranked.slice(slotCapacity).map((r) => r.concept.id) : [];



  const targets = [];

  const unassignedSlots = [];

  const ledger = { global: {}, surface: {} };

  const breadthAssigned = new Set();

  const usedRelatedPairs = new Set();

  let depthCursor = 0;



  for (const req of requirements) {

    const baseLevel = defaultCognitiveForSurface(req.surface);



    if (req.targetMode === TARGET_MODE_COMPARE || req.targetMode === TARGET_MODE_RELATIONSHIP) {

      const selection = selectRelatedPair(
        ranked,
        semantic.learningObjectives,
        usedRelatedPairs,
        {
          forCompare: req.targetMode === TARGET_MODE_COMPARE,
          taughtEvidence: semantic.taughtEvidence,
        }
      );

      const primaryConceptIds = selection.pair;

      if (!primaryConceptIds) {

        recordUnassigned(unassignedSlots, req, selection.reason || UNASSIGNED_REASON_NO_RELATED_PAIR);

        continue;

      }

      const cognitiveLevel = resolveCognitiveLevelForConcepts(primaryConceptIds, baseLevel, ledger);

      if (!cognitiveLevel) {

        recordUnassigned(unassignedSlots, req, UNASSIGNED_REASON_NO_COGNITIVE_LEVEL);

        continue;

      }

      const supportingConceptIds =

        req.targetMode === TARGET_MODE_RELATIONSHIP

          ? deriveSupportingForTarget(primaryConceptIds, semantic.supportingConcepts, semantic.taughtEvidence)

          : [];

      const target = buildTarget({

        requirement: req,

        primaryConceptIds,

        cognitiveLevel,

        recurrenceKind:

          req.targetMode === TARGET_MODE_COMPARE ? RECURRENCE_COMPARE : RECURRENCE_DEPTH,

        supportingConceptIds,

        taughtEvidence: semantic.taughtEvidence,

      });

      chargeLedger(ledger, target.primaryConceptIds, cognitiveLevel, req.surface);

      usedRelatedPairs.add(primaryConceptIds.join("+"));

      targets.push(target);

      continue;

    }



    const uncovered = prioritized.find((row) => !breadthAssigned.has(row.concept.id));

    if (uncovered) {

      const cognitiveLevel = resolveCognitiveLevelForConcepts([uncovered.concept.id], baseLevel, ledger);

      if (!cognitiveLevel) {

        recordUnassigned(unassignedSlots, req, UNASSIGNED_REASON_NO_COGNITIVE_LEVEL);

        continue;

      }

      const supportingConceptIds = deriveSupportingForTarget(

        [uncovered.concept.id],

        semantic.supportingConcepts,

        semantic.taughtEvidence

      );

      const target = buildTarget({

        requirement: req,

        primaryConceptIds: [uncovered.concept.id],

        cognitiveLevel,

        recurrenceKind: RECURRENCE_BREADTH,

        supportingConceptIds,

        taughtEvidence: semantic.taughtEvidence,

      });

      chargeLedger(ledger, target.primaryConceptIds, cognitiveLevel, req.surface);

      targets.push(target);

      breadthAssigned.add(uncovered.concept.id);

      continue;

    }



    const pool = prioritized.length ? prioritized : ranked;

    let assigned = false;

    for (let attempt = 0; attempt < pool.length; attempt += 1) {

      const pick = pool[(depthCursor + attempt) % pool.length];

      const cognitiveLevel = resolveCognitiveLevelForConcepts([pick.concept.id], baseLevel, ledger);

      if (!cognitiveLevel) continue;

      depthCursor += attempt + 1;

      const supportingConceptIds = deriveSupportingForTarget(

        [pick.concept.id],

        semantic.supportingConcepts,

        semantic.taughtEvidence

      );

      const target = buildTarget({

        requirement: req,

        primaryConceptIds: [pick.concept.id],

        cognitiveLevel,

        recurrenceKind: RECURRENCE_DEPTH,

        supportingConceptIds,

        taughtEvidence: semantic.taughtEvidence,

      });

      chargeLedger(ledger, target.primaryConceptIds, cognitiveLevel, req.surface);

      targets.push(target);

      assigned = true;

      break;

    }

    if (!assigned) {

      recordUnassigned(unassignedSlots, req, UNASSIGNED_REASON_NO_COGNITIVE_LEVEL);

    }

  }



  targets.sort((a, b) => a.priority - b.priority || compareStrings(a.targetId, b.targetId));

  unassignedSlots.sort(

    (a, b) => a.slotIndex - b.slotIndex || compareStrings(a.surface, b.surface)

  );



  const assignedPrimaryIds = new Set(targets.flatMap((t) => t.primaryConceptIds));

  const uncoveredFromAssignment = ranked

    .map((row) => row.concept.id)

    .filter((id) => !assignedPrimaryIds.has(id));

  const uncoveredConceptIdsFinal = [

    ...new Set([...uncoveredConceptIds, ...uncoveredFromAssignment]),

  ].sort(compareStrings);



  const planSemantic = canonicalizeSemantic({

    version: PLAN_VERSION,

    targets,

    uncoveredConceptIds: uncoveredConceptIdsFinal,

    requiredConceptIds: ranked.map((r) => r.concept.id),

  });



  return {

    semantic: planSemantic,

    meta: {

      planVersion: PLAN_VERSION,

      contentHash: hashSemantic(planSemantic),

      targetCount: targets.length,

      uncoveredConceptIds: uncoveredConceptIdsFinal,

      unassignedSlots,

    },

    ledger,

  };

}



module.exports = {

  planAssessmentTargets,

  rankRequiredConcepts,

  deriveSupportingForTarget,

  conceptEvidenceIds,

  conceptsShareLessonRelation,

  scoreRelatedPair,

  selectRelatedPair,

  pairEvidenceTopology,

  comparePairCandidates,

  resolveCognitiveLevelForConcepts,

  UNASSIGNED_REASON_NO_RELATED_PAIR,

  UNASSIGNED_REASON_AMBIGUOUS_RELATED_PAIR,

};


