/**
 * Phase 2 — open-world question discovery and alignment gate focused tests.
 */

const fs = require("fs");
const path = require("path");
const { buildLessonTruth } = require("../lib/teacherBrain/lessonTruth/buildLessonTruth");
const { planAssessmentTargets } = require("../lib/teacherBrain/lessonTruth/planAssessmentTargets");
const { discoverQuestionAssessmentConcepts } = require("../lib/teacherBrain/lessonTruth/extractQuestionAssessmentConcepts");
const { assessQuestionAlignment } = require("../lib/teacherBrain/lessonTruth/assessQuestionAlignment");
const {
  ALIGNMENT_VERDICT,
  REASON_CODES,
  inferObservedCognitiveLevel,
  emptyUsageLedger,
  globalLedgerKey,
} = require("../lib/teacherBrain/lessonTruth/assessmentTargetTypes");

const FIXTURE_DIR = path.join(__dirname, "fixtures", "lessonTruth");
const PHASE2_DIR = path.join(__dirname, "..", "lib", "teacherBrain", "lessonTruth");

const variationLesson = require(path.join(FIXTURE_DIR, "variation-within-species.lesson.json"));
const variationRequirements = require(path.join(FIXTURE_DIR, "variation-within-species.assessment-requirements.json"));
const weimarLesson = require(path.join(FIXTURE_DIR, "weimar-instability.lesson.json"));
const weimarRequirements = require(path.join(FIXTURE_DIR, "weimar-instability.assessment-requirements.json"));

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

function variationContext() {
  const lessonTruth = buildLessonTruth(variationLesson);
  const assessmentPlan = planAssessmentTargets(lessonTruth, variationRequirements);
  const geneticTarget = assessmentPlan.semantic.targets.find(
    (t) => t.primaryConceptIds.length === 1 && t.primaryConceptIds[0] === "genetic_variation"
  );
  const compareTarget = assessmentPlan.semantic.targets.find((t) => t.targetMode === "compare");
  return { lessonTruth, assessmentPlan, geneticTarget, compareTarget };
}

function weimarContext() {
  const lessonTruth = buildLessonTruth(weimarLesson);
  const hyperTarget = {
    targetId: "test-hyper",
    primaryConceptIds: ["hyperinflation"],
    supportingConceptIds: ["economic_link"],
    objectiveIds: [],
    cognitiveLevel: "Recall",
    assessmentSurface: "checkpoint",
    evidenceIds: [],
    priority: 0,
    recurrenceKind: "breadth",
    maxGlobalUses: 1,
    maxSurfaceUses: 1,
    targetMode: "single",
  };
  return { lessonTruth, hyperTarget };
}

function assessVariation(stem, target, extra = {}) {
  const { lessonTruth, assessmentPlan } = variationContext();
  const observedCognitiveLevel =
    extra.observedCognitiveLevel !== undefined
      ? extra.observedCognitiveLevel
      : target?.cognitiveLevel ?? null;
  return assessQuestionAlignment({
    lessonTruth,
    assessmentPlan,
    stem,
    assignedTargetId: target?.targetId,
    observedCognitiveLevel,
    usageLedger: extra.usageLedger ?? emptyUsageLedger(),
    options: extra.options,
    modelAnswer: extra.modelAnswer,
  });
}

describe("Phase 2 question concept discovery", () => {
  test("discovers open-world unknown concept from directive clause", () => {
    const discovery = discoverQuestionAssessmentConcepts({
      stem: "Describe adaptations of a sperm cell.",
    });
    expect(discovery.hasConfidentDirect).toBe(true);
    expect(discovery.confidentDirectConcepts.some((c) => c.conceptId.includes("adaptations"))).toBe(true);
    expect(discovery.confidentDirectConcepts.some((c) => c.conceptId.includes("sperm"))).toBe(true);
  });

  test("does not use Lesson Truth as discovery candidate pool", () => {
    const { lessonTruth } = variationContext();
    const requiredIds = lessonTruth.semantic.requiredConcepts.map((c) => c.id);
    const discovery = discoverQuestionAssessmentConcepts({
      stem: "Describe adaptations of a sperm cell.",
    });
    for (const item of discovery.confidentDirectConcepts) {
      expect(requiredIds.includes(item.conceptId)).toBe(false);
    }
  });

  test("discovers multiple direct clauses in one stem", () => {
    const discovery = discoverQuestionAssessmentConcepts({
      stem: "Explain genetic variation and describe adaptations of a sperm cell.",
    });
    const ids = discovery.confidentDirectConcepts.map((c) => c.conceptId);
    expect(ids.some((id) => id.includes("genetic"))).toBe(true);
    expect(ids.some((id) => id.includes("adaptations"))).toBe(true);
  });

  test("options cannot create DIRECT concepts", () => {
    const discovery = discoverQuestionAssessmentConcepts({
      stem: "Explain genetic variation.",
      options: ["Adaptations of a sperm cell", "Egg cell structure", "Zygote formation"],
    });
    expect(discovery.directConcepts.every((d) => d.role !== "direct" || d.conceptId === "genetic_variation")).toBe(
      true
    );
    expect(discovery.confidentDirectConcepts.map((c) => c.conceptId)).toEqual(["genetic_variation"]);
  });

  test("options cannot override clear stem concept", () => {
    const result = assessVariation("Explain genetic variation.", null, {
      options: ["Describe adaptations of a sperm cell"],
    });
    expect(result.discovery.confidentDirectConcepts.map((c) => c.conceptId)).toEqual(["genetic_variation"]);
  });

  test("model answer cannot introduce unrelated DIRECT concept", () => {
    const discovery = discoverQuestionAssessmentConcepts({
      stem: "Explain genetic variation.",
      modelAnswer: "Adaptations of a sperm cell include a tail and enzymes.",
    });
    expect(discovery.confidentDirectConcepts.map((c) => c.conceptId)).toEqual(["genetic_variation"]);
    expect(discovery.directConcepts.some((c) => c.conceptId.includes("adaptations"))).toBe(false);
  });

  test("supports compare and difference-between phrasing", () => {
    const compare = discoverQuestionAssessmentConcepts({
      stem: "Compare genetic and environmental variation.",
    });
    const diff = discoverQuestionAssessmentConcepts({
      stem: "Explain the difference between genetic and environmental variation.",
    });
    for (const discovery of [compare, diff]) {
      const ids = discovery.confidentDirectConcepts.map((c) => c.conceptId).sort();
      expect(ids).toEqual(["environmental_variation", "genetic_variation"]);
    }
  });

  test("vague paraphrase yields no confident direct match", () => {
    const discovery = discoverQuestionAssessmentConcepts({
      stem: "Without naming the key idea directly, explain why organisms in this topic differ.",
    });
    expect(discovery.hasConfidentDirect).toBe(false);
  });

  test("does not falsely split coordinated phrases at ordinary and", () => {
    const cases = [
      "Compare genetic and environmental variation.",
      "Explain the effect of genes and environment on height.",
      "State two genetic and two environmental causes.",
    ];
    for (const stem of cases) {
      const discovery = discoverQuestionAssessmentConcepts({ stem });
      expect(discovery.clauses).toHaveLength(1);
    }
  });

  test("splits genuine multi-directive stems", () => {
    const discovery = discoverQuestionAssessmentConcepts({
      stem: "Explain genetic variation and describe adaptations of a sperm cell.",
    });
    expect(discovery.clauses.length).toBeGreaterThan(1);
  });
});

describe("Phase 2 assessQuestionAlignment gate", () => {
  test("authorised direct concept ACCEPT", () => {
    const { geneticTarget } = variationContext();
    const result = assessVariation("Explain genetic variation.", geneticTarget);
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.ACCEPT);
    expect(result.reasons).toContain(REASON_CODES.AUTHORIZED);
  });

  test("confident unknown direct concept REGENERATE", () => {
    const { geneticTarget } = variationContext();
    const result = assessVariation("Describe adaptations of a sperm cell.", geneticTarget);
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REGENERATE);
    expect(result.reasons).toContain(REASON_CODES.UNAUTHORIZED_CONCEPT);
  });

  test("no confident direct match REVIEW", () => {
    const { geneticTarget } = variationContext();
    const result = assessVariation(
      "Without naming the key idea directly, explain why organisms in this topic differ.",
      geneticTarget
    );
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REVIEW);
    expect(result.reasons).toContain(REASON_CODES.NO_PRIMARY_CONCEPT_MATCH);
  });

  test("supporting-as-primary REGENERATE", () => {
    const { lessonTruth, assessmentPlan } = variationContext();
    const target = assessmentPlan.semantic.targets.find((t) => t.primaryConceptIds[0] === "genetic_variation");
    const result = assessQuestionAlignment({
      lessonTruth,
      assessmentPlan,
      stem: "Explain random fertilisation.",
      assignedTargetId: target.targetId,
      observedCognitiveLevel: "Explain",
      usageLedger: emptyUsageLedger(),
    });
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REGENERATE);
    expect(result.reasons).toContain(REASON_CODES.SUPPORTING_AS_PRIMARY);
  });

  test("linked support context ACCEPT for relationship phrasing", () => {
    const { lessonTruth } = variationContext();
    const target = {
      targetId: "test-linked-support",
      primaryConceptIds: ["genetic_variation"],
      supportingConceptIds: ["random_fertilisation"],
      objectiveIds: [],
      cognitiveLevel: "Explain",
      assessmentSurface: "self_check",
      evidenceIds: [],
      priority: 99,
      recurrenceKind: "breadth",
      maxGlobalUses: 1,
      maxSurfaceUses: 1,
      targetMode: "single",
    };
    const result = assessQuestionAlignment({
      lessonTruth,
      assessmentPlan: { semantic: { targets: [target] } },
      stem: "Explain how random fertilisation contributes to genetic variation.",
      assignedTargetId: target.targetId,
      observedCognitiveLevel: "Explain",
      usageLedger: emptyUsageLedger(),
    });
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.ACCEPT);
  });

  test("unlinked assessed support REGENERATE", () => {
    const { geneticTarget } = variationContext();
    const result = assessVariation(
      "Explain how random fertilisation contributes to genetic variation.",
      geneticTarget
    );
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REGENERATE);
    expect(result.reasons).toContain(REASON_CODES.SUPPORTING_AS_PRIMARY);
  });

  test("mixed authorised and drift REGENERATE with UNAUTHORIZED only", () => {
    const { geneticTarget } = variationContext();
    const result = assessVariation(
      "Explain genetic variation and describe adaptations of a sperm cell.",
      geneticTarget
    );
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REGENERATE);
    expect(result.reasons).toContain(REASON_CODES.UNAUTHORIZED_CONCEPT);
    expect(result.reasons).not.toContain(REASON_CODES.TARGET_ASSIGNMENT_MISMATCH);
  });

  test("compare target accepts matching pair", () => {
    const { compareTarget } = variationContext();
    const result = assessVariation("Compare genetic and environmental variation.", compareTarget);
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.ACCEPT);
  });

  test("compare target accepts difference-between phrasing", () => {
    const { compareTarget } = variationContext();
    const result = assessVariation(
      "Explain the difference between genetic and environmental variation.",
      compareTarget
    );
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.ACCEPT);
  });

  test("global duplicate REGENERATE", () => {
    const { geneticTarget } = variationContext();
    const ledger = emptyUsageLedger();
    ledger.global[globalLedgerKey("genetic_variation", geneticTarget.cognitiveLevel)] = 1;
    const result = assessVariation("Explain genetic variation.", geneticTarget, { usageLedger: ledger });
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REGENERATE);
    expect(result.reasons).toContain(REASON_CODES.DUPLICATE_CONCEPT_TARGET);
  });

  test("cognitive null skips mismatch", () => {
    const { geneticTarget } = variationContext();
    const result = assessVariation("Explain genetic variation.", geneticTarget, {
      observedCognitiveLevel: null,
    });
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.ACCEPT);
    expect(result.reasons).not.toContain(REASON_CODES.COGNITIVE_LEVEL_MISMATCH);
  });

  test("cognitive one-band difference REVIEW", () => {
    const { compareTarget } = variationContext();
    const result = assessVariation("Compare genetic and environmental variation.", compareTarget, {
      observedCognitiveLevel: "Apply",
    });
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REVIEW);
    expect(result.reasons).toContain(REASON_CODES.COGNITIVE_LEVEL_MISMATCH);
  });

  test("cognitive two-plus band difference REGENERATE", () => {
    const { geneticTarget } = variationContext();
    const result = assessVariation("Explain genetic variation.", geneticTarget, {
      observedCognitiveLevel: "Evaluate",
    });
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REGENERATE);
    expect(result.reasons).toContain(REASON_CODES.COGNITIVE_LEVEL_MISMATCH);
  });

  test("missing objective metadata does not reject", () => {
    const { lessonTruth } = variationContext();
    const target = {
      targetId: "test-no-objectives",
      primaryConceptIds: ["genetic_variation"],
      supportingConceptIds: [],
      objectiveIds: [],
      cognitiveLevel: "Recall",
      assessmentSurface: "checkpoint",
      evidenceIds: [],
      priority: 0,
      recurrenceKind: "breadth",
      maxGlobalUses: 1,
      maxSurfaceUses: 1,
      targetMode: "single",
    };
    const result = assessQuestionAlignment({
      lessonTruth,
      assessmentPlan: { semantic: { targets: [target] } },
      stem: "Explain genetic variation.",
      assignedTargetId: target.targetId,
      observedCognitiveLevel: "Explain",
      usageLedger: emptyUsageLedger(),
    });
    expect(result.verdict).not.toBe(ALIGNMENT_VERDICT.REGENERATE);
    expect(result.reasons).not.toContain(REASON_CODES.OBJECTIVE_MISMATCH);
  });

  test("same input produces identical verdict and sorted reasons", () => {
    const { geneticTarget } = variationContext();
    const first = assessVariation("Explain genetic variation.", geneticTarget);
    const second = assessVariation("Explain genetic variation.", geneticTarget);
    expect(first.verdict).toBe(second.verdict);
    expect(first.reasons).toEqual(second.reasons);
  });

  test("ASSESSMENT_EXCLUSION rejects forbidden concept", () => {
    const { lessonTruth, assessmentPlan, geneticTarget } = variationContext();
    const truth = {
      ...lessonTruth,
      semantic: {
        ...lessonTruth.semantic,
        assessmentExclusions: [
          { id: "fertilisation", name: "Fertilisation", matchTerms: ["fertilisation"] },
        ],
      },
    };
    const result = assessQuestionAlignment({
      lessonTruth: truth,
      assessmentPlan,
      stem: "Define fertilisation.",
      assignedTargetId: geneticTarget.targetId,
      observedCognitiveLevel: geneticTarget.cognitiveLevel,
      usageLedger: emptyUsageLedger(),
    });
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REGENERATE);
    expect(result.reasons).toContain(REASON_CODES.ASSESSMENT_EXCLUSION);
  });

  test("OUT_OF_SCOPE_TARGET rejects neighbouring drift concept", () => {
    const { lessonTruth, assessmentPlan, geneticTarget } = variationContext();
    const truth = {
      ...lessonTruth,
      semantic: {
        ...lessonTruth.semantic,
        outOfScopeConcepts: [
          {
            id: "adaptations_of_sperm_cell",
            name: "adaptations of sperm cell",
            matchTerms: ["adaptations of sperm cell", "sperm"],
          },
        ],
      },
    };
    const result = assessQuestionAlignment({
      lessonTruth: truth,
      assessmentPlan,
      stem: "Describe adaptations of a sperm cell.",
      assignedTargetId: geneticTarget.targetId,
      observedCognitiveLevel: geneticTarget.cognitiveLevel,
      usageLedger: emptyUsageLedger(),
    });
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REGENERATE);
    expect(result.reasons).toContain(REASON_CODES.OUT_OF_SCOPE_TARGET);
  });

  test("NO_TAUGHT_EVIDENCE rejects target without evidence backing", () => {
    const { lessonTruth, assessmentPlan } = variationContext();
    const truth = {
      ...lessonTruth,
      semantic: {
        ...lessonTruth.semantic,
        taughtEvidence: lessonTruth.semantic.taughtEvidence.map((ev) => ({
          ...ev,
          conceptIds: (ev.conceptIds || []).filter((id) => id !== "genetic_variation"),
        })),
      },
    };
    const hollowTarget = {
      targetId: "test-no-evidence",
      primaryConceptIds: ["genetic_variation"],
      supportingConceptIds: [],
      objectiveIds: [],
      cognitiveLevel: "Recall",
      assessmentSurface: "checkpoint",
      evidenceIds: [],
      priority: 99,
      recurrenceKind: "breadth",
      maxGlobalUses: 1,
      maxSurfaceUses: 1,
      targetMode: "single",
    };
    const result = assessQuestionAlignment({
      lessonTruth: truth,
      assessmentPlan: { semantic: { targets: [hollowTarget] } },
      stem: "Explain genetic variation.",
      assignedTargetId: hollowTarget.targetId,
      observedCognitiveLevel: "Recall",
      usageLedger: emptyUsageLedger(),
    });
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REGENERATE);
    expect(result.reasons).toContain(REASON_CODES.NO_TAUGHT_EVIDENCE);
  });

  test("TARGET_ASSIGNMENT_MISMATCH rejects compare target with single-concept question", () => {
    const { compareTarget, lessonTruth, assessmentPlan } = variationContext();
    const result = assessQuestionAlignment({
      lessonTruth,
      assessmentPlan,
      stem: "Explain genetic variation.",
      assignedTargetId: compareTarget.targetId,
      observedCognitiveLevel: compareTarget.cognitiveLevel,
      usageLedger: emptyUsageLedger(),
    });
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REGENERATE);
    expect(result.reasons).toContain(REASON_CODES.TARGET_ASSIGNMENT_MISMATCH);
  });

  test("planned relationship target accepts linked relationship question", () => {
    const lessonTruth = buildLessonTruth(weimarLesson);
    const assessmentPlan = planAssessmentTargets(lessonTruth, weimarRequirements);
    const relationshipTarget = assessmentPlan.semantic.targets.find((t) => t.targetMode === "relationship");
    expect(relationshipTarget).toBeTruthy();
    const result = assessQuestionAlignment({
      lessonTruth,
      assessmentPlan,
      stem: "Explain how reparations payments contribute to hyperinflation.",
      assignedTargetId: relationshipTarget.targetId,
      observedCognitiveLevel: relationshipTarget.cognitiveLevel,
      usageLedger: emptyUsageLedger(),
    });
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.ACCEPT);
    expect(relationshipTarget.supportingConceptIds).toContain("economic_link");
  });
});

describe("Phase 2 Variation drift and acceptance cases", () => {
  test("ACCEPT: explain genetic variation", () => {
    const { geneticTarget } = variationContext();
    expect(assessVariation("Explain genetic variation.", geneticTarget).verdict).toBe(ALIGNMENT_VERDICT.ACCEPT);
  });

  test("REGENERATE: sperm cell adaptations drift", () => {
    const { geneticTarget } = variationContext();
    const result = assessVariation("Describe adaptations of a sperm cell.", geneticTarget);
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REGENERATE);
    expect(result.reasons).toContain(REASON_CODES.UNAUTHORIZED_CONCEPT);
  });

  test("REGENERATE: define fertilisation drift", () => {
    const { geneticTarget } = variationContext();
    const result = assessVariation("Define fertilisation.", geneticTarget);
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REGENERATE);
  });

  test("REGENERATE: haploid gamete isolated drift", () => {
    const { geneticTarget } = variationContext();
    const result = assessVariation("Why must gametes be haploid?", geneticTarget);
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REGENERATE);
  });

  test("REVIEW: vague paraphrase", () => {
    const { geneticTarget } = variationContext();
    const result = assessVariation(
      "Without naming the key idea directly, explain why organisms in this topic differ.",
      geneticTarget
    );
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REVIEW);
  });
});

describe("Phase 2 History drift and acceptance cases", () => {
  test("REGENERATE: World War Two causes drift", () => {
    const { lessonTruth, hyperTarget } = weimarContext();
    const result = assessQuestionAlignment({
      lessonTruth,
      assessmentPlan: { semantic: { targets: [hyperTarget] } },
      stem: "Explain the causes of World War Two.",
      assignedTargetId: hyperTarget.targetId,
      observedCognitiveLevel: "Explain",
      usageLedger: emptyUsageLedger(),
    });
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REGENERATE);
    expect(result.reasons).toContain(REASON_CODES.UNAUTHORIZED_CONCEPT);
    expect(result.discovery.confidentDirectConcepts.some((c) => c.conceptId.includes("world_war"))).toBe(true);
  });

  test("REGENERATE: mixed authorised and Nazi police drift", () => {
    const { lessonTruth, hyperTarget } = weimarContext();
    const result = assessQuestionAlignment({
      lessonTruth,
      assessmentPlan: { semantic: { targets: [hyperTarget] } },
      stem: "Explain hyperinflation and describe the structure of the Nazi police state.",
      assignedTargetId: hyperTarget.targetId,
      observedCognitiveLevel: "Explain",
      usageLedger: emptyUsageLedger(),
    });
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REGENERATE);
    expect(result.reasons).toContain(REASON_CODES.UNAUTHORIZED_CONCEPT);
  });

  test("ACCEPT: clear required-concept question", () => {
    const { lessonTruth, hyperTarget } = weimarContext();
    const result = assessQuestionAlignment({
      lessonTruth,
      assessmentPlan: { semantic: { targets: [hyperTarget] } },
      stem: "Explain hyperinflation.",
      assignedTargetId: hyperTarget.targetId,
      observedCognitiveLevel: hyperTarget.cognitiveLevel,
      usageLedger: emptyUsageLedger(),
    });
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.ACCEPT);
  });

  test("REVIEW: broad economic instability cannot map confidently to hyperinflation", () => {
    const { lessonTruth, hyperTarget } = weimarContext();
    const result = assessQuestionAlignment({
      lessonTruth,
      assessmentPlan: { semantic: { targets: [hyperTarget] } },
      stem: "Explain economic instability in the Weimar Republic.",
      assignedTargetId: hyperTarget.targetId,
      observedCognitiveLevel: "Explain",
      usageLedger: emptyUsageLedger(),
    });
    expect(result.verdict).toBe(ALIGNMENT_VERDICT.REVIEW);
    expect(result.reasons).toContain(REASON_CODES.NO_PRIMARY_CONCEPT_MATCH);
    expect(result.discovery.hasConfidentDirect).toBe(false);
  });

  test("production Phase 2 modules contain no fixture-specific subject strings", () => {
    const source = readPhase2ProductionSources().toLowerCase();
    for (const term of FIXTURE_SUBJECT_TERMS) {
      expect(source.includes(term)).toBe(false);
    }
  });

  test("Phase 2 modules do not invoke LLM, provider, or network APIs", () => {
    const source = readPhase2ProductionSources();
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\baxios\b/);
    expect(source).not.toMatch(/\bopenai\b/i);
    expect(source).not.toMatch(/\bhttps?\.\w+/);
  });
});
