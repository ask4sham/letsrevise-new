/**
 * Phase 3E — priority engine integration with boundary + coverage gate.
 */

const { createCoverageGenerationGate, planCoverageGatedQuestionBatch } = require("../lib/teacherBrain/coverageGatedGeneration");
const { buildOneShotLessonCoveragePlanAppendix } = require("../lib/teacherBrain/oneShotLessonCoveragePlan");
const { buildLessonCoverageReview } = require("../lib/teacherBrain/lessonCoverageReview");
const { getPriorityTier } = require("../lib/teacherBrain/conceptPriorityEngine");
const { resolveConceptPriorityProfile } = require("../lib/teacherBrain/conceptPriorityProfiles");

const STRUCTURE_INPUT = {
  topicKey: "aqa-gcse-biology:nervous-system-structure",
  subTopic: "Structure and function of the nervous system",
  topic: "Homeostasis and Response",
};

const flatPages = [
  {
    blocks: [
      { type: "text", content: "CNS and PNS overview." },
      { type: "checkpoint", prompt: "What is the CNS?" },
    ],
  },
];

describe("conceptPriorityCoverageIntegration (Phase 3E)", () => {
  const prevPriority = process.env.TEACHER_BRAIN_PRIORITY_ENGINE;
  const prevBoundary = process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;

  afterEach(() => {
    if (prevPriority === undefined) delete process.env.TEACHER_BRAIN_PRIORITY_ENGINE;
    else process.env.TEACHER_BRAIN_PRIORITY_ENGINE = prevPriority;
    if (prevBoundary === undefined) delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    else process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = prevBoundary;
  });

  test("Photosynthesis lesson unchanged when priority engine on but no profile", () => {
    process.env.TEACHER_BRAIN_PRIORITY_ENGINE = "1";
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "0";
    const gate = createCoverageGenerationGate({
      topic: "Photosynthesis",
      subTopic: "Photosynthesis",
    });
    expect(gate.priorityProfile).toBeFalsy();
    const plans = planCoverageGatedQuestionBatch(gate, 3, "quiz");
    expect(plans.length).toBe(3);
    expect(plans[0].diagnostic.conceptId).toBeTruthy();
  });

  test("boundary filtering still excludes forbidden concepts with priority on", () => {
    process.env.TEACHER_BRAIN_PRIORITY_ENGINE = "1";
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const contaminated = [
      {
        blocks: [
          { type: "dragdropmatch", title: "Reflex arc", content: "reflex arc pathway" },
          { type: "checkpoint", prompt: "thermoregulation control" },
        ],
      },
    ];
    const gate = createCoverageGenerationGate({ ...STRUCTURE_INPUT, pages: contaminated });
    expect(gate.priorityEngineEnabled).toBe(true);
    const plans = planCoverageGatedQuestionBatch(gate, 6, "quiz");
    const ids = plans.map((p) => p.diagnostic.conceptId).filter(Boolean);
    expect(ids).not.toContain("reflex_arc_pathway");
    expect(ids).not.toContain("thermoregulation");
  });

  test("priority gate prefers tier 1 concepts over tier 2 when engine on", () => {
    process.env.TEACHER_BRAIN_PRIORITY_ENGINE = "1";
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const gate = createCoverageGenerationGate({ ...STRUCTURE_INPUT, pages: flatPages });
    const priorityProfile = resolveConceptPriorityProfile(STRUCTURE_INPUT);
    const plans = planCoverageGatedQuestionBatch(gate, 5, "checkpoint");
    const tier1Hits = plans.filter((p) => {
      const id = p.diagnostic.conceptId;
      return id && getPriorityTier(id, priorityProfile) === 1;
    });
    expect(tier1Hits.length).toBeGreaterThan(0);
  });

  test("one-shot appendix includes CONCEPT PRIORITY when engine on", () => {
    process.env.TEACHER_BRAIN_PRIORITY_ENGINE = "1";
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const { appendix } = buildOneShotLessonCoveragePlanAppendix({
      ...STRUCTURE_INPUT,
      pages: flatPages,
    });
    expect(appendix).toMatch(/CONCEPT PRIORITY/);
    expect(appendix).toMatch(/myelin|neurone/i);
  });

  test("Coverage Review includes concept priority distribution", () => {
    process.env.TEACHER_BRAIN_PRIORITY_ENGINE = "1";
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const review = buildLessonCoverageReview({
      ...STRUCTURE_INPUT,
      pages: flatPages,
    });
    expect(review.conceptPriorityDistribution?.enabled).toBe(true);
    expect(review.conceptPriorityDistribution.tiers.length).toBeGreaterThan(0);
  });
});
