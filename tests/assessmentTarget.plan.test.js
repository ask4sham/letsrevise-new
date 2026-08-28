/**
 * Phase 2 — assessment target planner focused tests.
 */

const fs = require("fs");
const path = require("path");
const { buildLessonTruth } = require("../lib/teacherBrain/lessonTruth/buildLessonTruth");
const {
  planAssessmentTargets,
  rankRequiredConcepts,
  deriveSupportingForTarget,
  conceptEvidenceIds,
  conceptsShareLessonRelation,
  selectRelatedPair,
  scoreRelatedPair,
  pairEvidenceTopology,
  UNASSIGNED_REASON_AMBIGUOUS_RELATED_PAIR,
  UNASSIGNED_REASON_NO_RELATED_PAIR,
} = require("../lib/teacherBrain/lessonTruth/planAssessmentTargets");
const { semanticEquals, hashSemantic } = require("../lib/teacherBrain/lessonTruth/canonicalize");
const {
  TARGET_MODE_COMPARE,
  TARGET_MODE_RELATIONSHIP,
  RECURRENCE_BREADTH,
  RECURRENCE_DEPTH,
  globalLedgerKey,
} = require("../lib/teacherBrain/lessonTruth/assessmentTargetTypes");

const FIXTURE_DIR = path.join(__dirname, "fixtures", "lessonTruth");
const PHASE2_DIR = path.join(__dirname, "..", "lib", "teacherBrain", "lessonTruth");

const variationLesson = require(path.join(FIXTURE_DIR, "variation-within-species.lesson.json"));
const variationRequirements = require(path.join(FIXTURE_DIR, "variation-within-species.assessment-requirements.json"));
const variationExpected = require(path.join(FIXTURE_DIR, "variation-within-species.expected-targets.json"));

const weimarLesson = require(path.join(FIXTURE_DIR, "weimar-instability.lesson.json"));
const weimarRequirements = require(path.join(FIXTURE_DIR, "weimar-instability.assessment-requirements.json"));
const weimarExpected = require(path.join(FIXTURE_DIR, "weimar-instability.expected-targets.json"));

const FIXTURE_SUBJECT_TERMS = [
  "sperm",
  "egg",
  "zygote",
  "fertilisation",
  "variation",
  "hyperinflation",
  "weimar",
  "nazi",
  "reparations",
];

function readPhase2ProductionSources() {
  const files = [
    "assessmentTargetTypes.js",
    "planAssessmentTargets.js",
    "extractQuestionAssessmentConcepts.js",
    "assessQuestionAlignment.js",
  ];
  return files.map((file) => fs.readFileSync(path.join(PHASE2_DIR, file), "utf8")).join("\n");
}

function buildPlan(lesson, requirements) {
  return planAssessmentTargets(buildLessonTruth(lesson), requirements);
}

describe("Phase 2 planAssessmentTargets", () => {
  let variationTruth;
  let variationPlan;

  beforeAll(() => {
    variationTruth = buildLessonTruth(variationLesson);
    variationPlan = buildPlan(variationLesson, variationRequirements);
  });

  test("same input produces identical plan", () => {
    const again = buildPlan(variationLesson, variationRequirements);
    expect(semanticEquals(variationPlan.semantic, again.semantic)).toBe(true);
  });

  test("same input produces identical semantic hash", () => {
    const again = buildPlan(variationLesson, variationRequirements);
    expect(variationPlan.meta.contentHash).toBe(again.meta.contentHash);
    expect(hashSemantic(variationPlan.semantic)).toBe(again.meta.contentHash);
  });

  test("primary concepts come only from requiredConcepts", () => {
    const requiredIds = new Set(variationTruth.semantic.requiredConcepts.map((c) => c.id));
    for (const target of variationPlan.semantic.targets) {
      for (const id of target.primaryConceptIds) {
        expect(requiredIds.has(id)).toBe(true);
      }
      expect(target.primaryConceptIds.length).toBeGreaterThanOrEqual(1);
      expect(target.primaryConceptIds.length).toBeLessThanOrEqual(2);
    }
  });

  test("every primary target has taughtEvidence", () => {
    for (const target of variationPlan.semantic.targets) {
      for (const conceptId of target.primaryConceptIds) {
        expect(conceptEvidenceIds(variationTruth.semantic.taughtEvidence, conceptId).length).toBeGreaterThan(0);
      }
    }
  });

  test("breadth targets precede depth recurrence for singles", () => {
    const singles = variationPlan.semantic.targets.filter((t) => t.targetMode === "single");
    const breadth = singles.filter((t) => t.recurrenceKind === RECURRENCE_BREADTH);
    const depth = singles.filter((t) => t.recurrenceKind === RECURRENCE_DEPTH);
    expect(breadth.length).toBeGreaterThan(0);
    if (depth.length) {
      expect(Math.min(...depth.map((t) => t.priority))).toBeGreaterThan(Math.min(...breadth.map((t) => t.priority)));
    }
  });

  test("insufficient slots prioritise deterministically and report uncoveredConceptIds", () => {
    const weimarTruth = buildLessonTruth(weimarLesson);
    const plan = buildPlan(weimarLesson, weimarRequirements);
    expect(plan.meta.uncoveredConceptIds).toEqual(weimarExpected.uncoveredConceptIds);
    const ranked = rankRequiredConcepts(weimarTruth.semantic.requiredConcepts, weimarTruth.semantic.taughtEvidence);
    for (const id of plan.semantic.targets.flatMap((t) => t.primaryConceptIds)) {
      expect(ranked.some((row) => row.concept.id === id)).toBe(true);
    }
  });

  test("global ledger never exceeds one use per concept and cognitive level", () => {
    for (const [key, count] of Object.entries(variationPlan.ledger.global)) {
      expect(count).toBeLessThanOrEqual(1);
      if (variationExpected.noSameLevelGlobalDuplicates) {
        expect(count).toBe(1);
      }
    }
  });

  test("depth recurrence uses cognitive progression not same-level repetition", () => {
    const depthTarget = variationPlan.semantic.targets.find((t) => t.priority === variationExpected.depthSlotIndex);
    expect(depthTarget.cognitiveLevel).toBe(variationExpected.depthCognitiveLevel);
    const earlier = variationPlan.semantic.targets.find(
      (t) =>
        t.primaryConceptIds.includes(variationExpected.depthConceptId) &&
        t.priority < variationExpected.depthSlotIndex
    );
    expect(earlier.cognitiveLevel).not.toBe(depthTarget.cognitiveLevel);
  });

  test("compare and relationship do not grant same-level global duplication", () => {
    const compoundTargets = variationPlan.semantic.targets.filter(
      (t) => t.targetMode === TARGET_MODE_COMPARE || t.targetMode === TARGET_MODE_RELATIONSHIP
    );
    for (const target of compoundTargets) {
      for (const conceptId of target.primaryConceptIds) {
        expect(variationPlan.ledger.global[globalLedgerKey(conceptId, target.cognitiveLevel)]).toBe(1);
      }
    }
  });

  test("excess slots deepen rather than repeat same concept and cognitive level globally", () => {
    const ledger = variationPlan.ledger.global;
    const seen = new Map();
    for (const target of variationPlan.semantic.targets) {
      for (const conceptId of target.primaryConceptIds) {
        const key = globalLedgerKey(conceptId, target.cognitiveLevel);
        const count = seen.get(key) || 0;
        if (target.recurrenceKind === RECURRENCE_BREADTH) {
          expect(count).toBe(0);
        }
        seen.set(key, count + 1);
        expect(ledger[key]).toBeGreaterThanOrEqual(1);
        if (target.recurrenceKind === RECURRENCE_BREADTH) {
          expect(ledger[key]).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  test("surface ledger records distribution without granting extra global allowance", () => {
    for (const target of variationPlan.semantic.targets) {
      for (const conceptId of target.primaryConceptIds) {
        const sKey = `${conceptId}|${target.cognitiveLevel}|${target.assessmentSurface}`;
        expect(variationPlan.ledger.surface[sKey]).toBeGreaterThanOrEqual(1);
      }
    }
    const dup = variationPlan.semantic.targets.filter(
      (t) => t.primaryConceptIds.length === 1 && t.primaryConceptIds[0] === "genetic_variation"
    );
    expect(dup.some((t) => t.recurrenceKind === RECURRENCE_BREADTH)).toBe(true);
    expect(dup.some((t) => t.recurrenceKind === RECURRENCE_DEPTH && t.cognitiveLevel === "Apply")).toBe(true);
  });

  test("compare pairs require lesson-derived relation not rank extremes", () => {
    const weimarTruth = buildLessonTruth(weimarLesson);
    const ranked = rankRequiredConcepts(weimarTruth.semantic.requiredConcepts, weimarTruth.semantic.taughtEvidence);
    const top = ranked.find((row) => row.concept.id === weimarExpected.mustNotCompareUnrelatedRankExtremes.topRankedConceptId);
    const bottom = ranked.find(
      (row) => row.concept.id === weimarExpected.mustNotCompareUnrelatedRankExtremes.bottomRankedConceptId
    );
    expect(conceptsShareLessonRelation(top, bottom, weimarTruth.semantic.learningObjectives)).toBe(false);
    const selected = selectRelatedPair(ranked, weimarTruth.semantic.learningObjectives, new Set(), {
      forCompare: true,
      taughtEvidence: weimarTruth.semantic.taughtEvidence,
    });
    expect(selected.pair.sort()).not.toEqual(
      [
        weimarExpected.mustNotCompareUnrelatedRankExtremes.topRankedConceptId,
        weimarExpected.mustNotCompareUnrelatedRankExtremes.bottomRankedConceptId,
      ].sort()
    );
    expect(selected.pair.sort()).toEqual(weimarExpected.relationshipPrimaryConceptIds.sort());
  });

  test("compare slot without a related pair remains unassigned", () => {
    const weimarTruth = buildLessonTruth(weimarLesson);
    const ranked = rankRequiredConcepts(weimarTruth.semantic.requiredConcepts, weimarTruth.semantic.taughtEvidence);
    const isolated = ranked.find((row) => row.concept.id === "political_extremism");
    const plan = planAssessmentTargets(
      {
        semantic: {
          ...weimarTruth.semantic,
          requiredConcepts: [isolated.concept],
        },
      },
      [{ surface: "self_check", slotIndex: 0, targetMode: "compare" }]
    );
    expect(plan.semantic.targets).toHaveLength(0);
    expect(plan.meta.unassignedSlots).toEqual([
      {
        slotIndex: 0,
        surface: "self_check",
        targetMode: "compare",
        reason: "NO_RELATED_PAIR",
      },
    ]);
  });

  test("compound targets are capped at two primary concepts", () => {
    for (const target of variationPlan.semantic.targets) {
      if (target.targetMode === TARGET_MODE_COMPARE || target.targetMode === TARGET_MODE_RELATIONSHIP) {
        expect(target.primaryConceptIds).toHaveLength(2);
      }
    }
  });

  test("compare targets appear only when targetMode is compare", () => {
    const compareReqSlots = new Set(
      variationRequirements.filter((r) => r.targetMode === "compare").map((r) => r.slotIndex)
    );
    for (const target of variationPlan.semantic.targets) {
      if (target.targetMode === TARGET_MODE_COMPARE) {
        expect(compareReqSlots.has(target.priority)).toBe(true);
      }
    }
    const compareTarget = variationPlan.semantic.targets.find((t) => t.targetMode === TARGET_MODE_COMPARE);
    expect(compareTarget.primaryConceptIds.sort()).toEqual(variationExpected.comparePrimaryConceptIds.sort());
    expect(compareTarget.cognitiveLevel).toBe(variationExpected.compareCognitiveLevel);
  });

  test("relationship targets appear only when targetMode is relationship", () => {
    const relationshipTarget = variationPlan.semantic.targets.find(
      (t) => t.priority === variationExpected.relationshipSlotIndex
    );
    expect(relationshipTarget.targetMode).toBe(TARGET_MODE_RELATIONSHIP);
    expect(relationshipTarget.primaryConceptIds.sort()).toEqual(
      variationExpected.relationshipPrimaryConceptIds.sort()
    );
    expect(relationshipTarget.cognitiveLevel).toBe(variationExpected.relationshipCognitiveLevel);
  });

  test("supporting concepts are linked per target not globally", () => {
    const geneticBreadth = variationPlan.semantic.targets.find(
      (t) => t.primaryConceptIds[0] === "genetic_variation" && t.recurrenceKind === RECURRENCE_BREADTH
    );
    expect(geneticBreadth.supportingConceptIds).toEqual(variationExpected.geneticVariationSupportingConceptIds);
    const environmentalBreadth = variationPlan.semantic.targets.find(
      (t) => t.primaryConceptIds[0] === "environmental_variation" && t.recurrenceKind === RECURRENCE_BREADTH
    );
    expect(environmentalBreadth.supportingConceptIds).toEqual([]);
    const derived = deriveSupportingForTarget(
      ["environmental_variation"],
      variationTruth.semantic.supportingConcepts,
      variationTruth.semantic.taughtEvidence
    );
    expect(derived).not.toContain("mutation");
  });

  test("does not promote spec or topic concepts into primary targets", () => {
    const requiredIds = new Set(variationTruth.semantic.requiredConcepts.map((c) => c.id));
    for (const target of variationPlan.semantic.targets) {
      for (const id of target.primaryConceptIds) {
        expect(requiredIds.has(id)).toBe(true);
      }
    }
  });

  test("Variation expected plan is independently asserted", () => {
    expect(variationPlan.semantic.targets).toHaveLength(variationExpected.targetCount);
    const breadthPrimaries = variationPlan.semantic.targets
      .filter((t) => t.recurrenceKind === RECURRENCE_BREADTH && t.targetMode === "single")
      .map((t) => t.primaryConceptIds[0]);
    expect(breadthPrimaries).toEqual(variationExpected.breadthPrimaryConceptIds);
    const depthTarget = variationPlan.semantic.targets.find((t) => t.priority === variationExpected.depthSlotIndex);
    expect(depthTarget.primaryConceptIds).toEqual([variationExpected.depthConceptId]);
    expect(depthTarget.cognitiveLevel).toBe(variationExpected.depthCognitiveLevel);
  });

  test("History expected plan is independently asserted", () => {
    const plan = buildPlan(weimarLesson, weimarRequirements);
    expect(plan.semantic.targets).toHaveLength(weimarExpected.targetCount);
    const breadthPrimaries = plan.semantic.targets
      .filter((t) => t.recurrenceKind === RECURRENCE_BREADTH && t.targetMode === "single")
      .map((t) => t.primaryConceptIds[0]);
    expect(breadthPrimaries).toEqual(weimarExpected.breadthPrimaryConceptIds);
    const relationship = plan.semantic.targets.find((t) => t.priority === weimarExpected.relationshipSlotIndex);
    expect(relationship.primaryConceptIds.sort()).toEqual(weimarExpected.relationshipPrimaryConceptIds.sort());
    expect(relationship.supportingConceptIds).toEqual(weimarExpected.relationshipSupportingConceptIds);
    expect(relationship.cognitiveLevel).toBe(weimarExpected.relationshipCognitiveLevel);
    const remaining = plan.semantic.targets.find(
      (t) => t.primaryConceptIds[0] === weimarExpected.remainingBreadthConceptId
    );
    expect(remaining).toBeTruthy();
    expect(plan.meta.uncoveredConceptIds).toEqual(weimarExpected.uncoveredConceptIds);
  });

  test("Variation compare pair is justified by parallel concept-role evidence topology", () => {
    const ranked = rankRequiredConcepts(
      variationTruth.semantic.requiredConcepts,
      variationTruth.semantic.taughtEvidence
    );
    const taughtEvidence = variationTruth.semantic.taughtEvidence;
    const learningObjectives = variationTruth.semantic.learningObjectives;
    const genetic = ranked.find((row) => row.concept.id === "genetic_variation");
    const environmental = ranked.find((row) => row.concept.id === "environmental_variation");
    const combined = ranked.find((row) => row.concept.id === "combined_genetic_and_environmental_effects");
    const species = ranked.find((row) => row.concept.id === "variation_within_a_species");

    expect(scoreRelatedPair(genetic, environmental, learningObjectives)).toBe(
      scoreRelatedPair(genetic, combined, learningObjectives)
    );
    const peerTopology = pairEvidenceTopology(genetic, environmental, taughtEvidence);
    expect(peerTopology.bothConceptRoleExclusive).toBe(1);
    expect(pairEvidenceTopology(genetic, combined, taughtEvidence).bothConceptRoleExclusive).toBe(0);
    expect(pairEvidenceTopology(genetic, species, taughtEvidence).bothConceptRoleExclusive).toBe(0);

    const selected = selectRelatedPair(ranked, learningObjectives, new Set(), {
      forCompare: true,
      taughtEvidence,
    });
    expect(selected.pair.sort()).toEqual(variationExpected.comparePrimaryConceptIds.sort());
    expect(selected.reason).toBeNull();
  });

  test("legitimate combined_* concept IDs are not penalised by name", () => {
    const semantic = {
      requiredConcepts: [
        { id: "combined_forces", name: "combined forces", matchTerms: ["combined forces"] },
        { id: "force_a", name: "force a", matchTerms: ["force a"] },
        { id: "force_b", name: "force b", matchTerms: ["force b"] },
      ],
      supportingConcepts: [],
      learningObjectives: [
        {
          objectiveId: "obj-1",
          text: "Explain combined forces and force a",
          matchTerms: ["combined", "forces", "force", "explain"],
        },
      ],
      taughtEvidence: [
        {
          evidenceId: "ev-combined",
          role: "concept",
          conceptIds: ["combined_forces"],
          objectiveIds: [],
        },
        {
          evidenceId: "ev-a",
          role: "concept",
          conceptIds: ["force_a"],
          objectiveIds: [],
        },
        {
          evidenceId: "ev-b",
          role: "concept",
          conceptIds: ["force_b"],
          objectiveIds: [],
        },
        {
          evidenceId: "ev-shared",
          role: "concept",
          conceptIds: ["combined_forces", "force_a"],
          objectiveIds: [],
        },
      ],
    };
    const ranked = rankRequiredConcepts(semantic.requiredConcepts, semantic.taughtEvidence);
    const selected = selectRelatedPair(ranked, semantic.learningObjectives, new Set(), {
      forCompare: true,
      taughtEvidence: semantic.taughtEvidence,
    });
    expect(selected.pair).toEqual(["combined_forces", "force_a"]);
    expect(selected.reason).toBeNull();
  });

  test("truly ambiguous compare pairs remain unassigned instead of guessing", () => {
    const semantic = {
      requiredConcepts: [
        { id: "concept_alpha", name: "concept alpha", matchTerms: ["alpha"] },
        { id: "concept_beta", name: "concept beta", matchTerms: ["beta"] },
        { id: "concept_gamma", name: "concept gamma", matchTerms: ["gamma"] },
      ],
      supportingConcepts: [],
      learningObjectives: [
        {
          objectiveId: "obj-bridge",
          text: "Relate alpha beta and gamma in one objective",
          matchTerms: ["alpha", "beta", "gamma"],
        },
      ],
      taughtEvidence: [
        {
          evidenceId: "ev-alpha",
          role: "concept",
          conceptIds: ["concept_alpha"],
          objectiveIds: [],
        },
        {
          evidenceId: "ev-beta",
          role: "concept",
          conceptIds: ["concept_beta"],
          objectiveIds: [],
        },
        {
          evidenceId: "ev-gamma",
          role: "concept",
          conceptIds: ["concept_gamma"],
          objectiveIds: [],
        },
      ],
    };
    const ranked = rankRequiredConcepts(semantic.requiredConcepts, semantic.taughtEvidence);
    const selection = selectRelatedPair(ranked, semantic.learningObjectives, new Set(), {
      forCompare: true,
      taughtEvidence: semantic.taughtEvidence,
    });
    expect(selection.pair).toBeNull();
    expect(selection.reason).toBe(UNASSIGNED_REASON_AMBIGUOUS_RELATED_PAIR);

    const plan = planAssessmentTargets({ semantic }, [
      { surface: "self_check", slotIndex: 0, targetMode: "compare" },
    ]);
    expect(plan.semantic.targets).toHaveLength(0);
    expect(plan.meta.unassignedSlots).toEqual([
      {
        slotIndex: 0,
        surface: "self_check",
        targetMode: "compare",
        reason: UNASSIGNED_REASON_AMBIGUOUS_RELATED_PAIR,
      },
    ]);
  });

  test("production planner does not use concept-id substring pairing heuristics", () => {
    const source = fs.readFileSync(path.join(PHASE2_DIR, "planAssessmentTargets.js"), "utf8");
    expect(source.includes('.includes("combined")')).toBe(false);
    expect(source.includes(".includes('combined')")).toBe(false);
  });

  test("production Phase 2 modules contain no fixture-specific subject strings", () => {
    const source = readPhase2ProductionSources().toLowerCase();
    for (const term of FIXTURE_SUBJECT_TERMS) {
      expect(source.includes(term)).toBe(false);
    }
  });
});
