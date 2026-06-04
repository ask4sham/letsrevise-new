/**
 * Sub-topic boundary × CoverageGate integration (Phase 3).
 */

const {
  createCoverageGenerationGate,
  planCoverageGatedQuestion,
  planCoverageGatedQuestionBatch,
} = require("../lib/teacherBrain/coverageGatedGeneration");
const { buildOneShotLessonCoveragePlanAppendix } = require("../lib/teacherBrain/oneShotLessonCoveragePlan");
const { buildLessonCoverageReview } = require("../lib/teacherBrain/lessonCoverageReview");
const { formatSubTopicBoundaryAppendix } = require("../lib/teacherBrain/subTopicBoundaryPlanning");

const STRUCTURE_INPUT = {
  topicKey: "aqa-gcse-biology:nervous-system-structure",
  subTopic: "Structure and function of the nervous system",
  topic: "Homeostasis and Response",
};

const contaminatedPages = [
  {
    blocks: [
      {
        type: "text",
        content: "Neurones have dendrites and axons with a myelin sheath.",
      },
      {
        type: "dragdropmatch",
        title: "Reflex arc pathway",
        content: "Order the reflex arc pathway from stimulus to effector.",
      },
      {
        type: "checkpoint",
        prompt: "Describe accommodation of the eye lens.",
      },
      {
        type: "checkpoint",
        prompt: "Explain thermoregulation and vasodilation.",
      },
    ],
  },
];

describe("SubTopicBoundary × CoverageGate", () => {
  const prevBoundary = process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;

  afterEach(() => {
    if (prevBoundary === undefined) {
      delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    } else {
      process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = prevBoundary;
    }
  });

  test("default flag (0) leaves coverage selection unchanged for structure lesson", () => {
    delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    const gate = createCoverageGenerationGate({
      ...STRUCTURE_INPUT,
      pages: contaminatedPages,
    });
    expect(gate.boundary.active).toBe(false);
    const { diagnostic } = planCoverageGatedQuestion(gate, { generationKind: "checkpoint" });
    expect(diagnostic.boundaryMode).toBe(0);
    expect(diagnostic.conceptId).toBeTruthy();
  });

  test("warn mode (1) does not select reflex_arc_pathway for nervous-system-structure", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const gate = createCoverageGenerationGate({
      ...STRUCTURE_INPUT,
      pages: contaminatedPages,
    });
    expect(gate.boundary.active).toBe(true);
    expect(gate.boundary.boundaryProfileKey).toBe("nervous-system-structure");

    const { diagnostic } = planCoverageGatedQuestion(gate, { generationKind: "checkpoint" });
    expect(diagnostic.conceptId).not.toBe("reflex_arc_pathway");
    expect(diagnostic.conceptId).not.toBe("accommodation");
    expect(diagnostic.conceptId).not.toBe("thermoregulation");
    expect(diagnostic.boundaryMode).toBe(1);
    expect(diagnostic.boundaryStatus).toBe("warn");
  });

  test("warn mode excludes accommodation and thermoregulation from practice batch planning", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const gate = createCoverageGenerationGate({
      ...STRUCTURE_INPUT,
      pages: contaminatedPages,
    });
    const plans = planCoverageGatedQuestionBatch(gate, 6, "practice");
    const ids = plans.map((p) => p.diagnostic.conceptId).filter(Boolean);
    expect(ids).not.toContain("accommodation");
    expect(ids).not.toContain("thermoregulation");
    expect(ids).not.toContain("reflex_arc_pathway");
    expect(ids).not.toContain("brain_regions");
  });

  test("enforce mode (2) blocks forbidden concept selection", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const gate = createCoverageGenerationGate({
      ...STRUCTURE_INPUT,
      pages: contaminatedPages,
    });

    const plans = planCoverageGatedQuestionBatch(gate, 8, "quiz");
    for (const p of plans) {
      expect(p.diagnostic.conceptId).not.toBe("reflex_arc_pathway");
      expect(p.diagnostic.conceptId).not.toBe("accommodation");
      expect(p.diagnostic.allowed).not.toBe(false);
    }
    expect(gate.boundary.boundaryStatus).toBe("enforce");
  });

  test("one-shot coverage appendix includes boundary replacement plan when mode >= 1", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const { appendix } = buildOneShotLessonCoveragePlanAppendix({
      ...STRUCTURE_INPUT,
      pages: contaminatedPages,
    });
    expect(appendix).toContain("BOUNDARY REPLACEMENT PLAN");
    expect(appendix).toMatch(/Instead of/i);
  });

  test("one-shot coverage appendix includes forbidden concept list when profile resolved", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const { appendix } = buildOneShotLessonCoveragePlanAppendix({
      ...STRUCTURE_INPUT,
      pages: contaminatedPages,
    });
    expect(appendix).toContain("SUB-TOPIC BOUNDARY");
    expect(appendix).toContain("Reflex arc pathway");
    expect(appendix).toContain("Thermoregulation");
    expect(appendix).toContain("Accommodation");
  });

  test("formatSubTopicBoundaryAppendix lists forbidden targets", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const { buildSubTopicBoundaryContext } = require("../lib/teacherBrain/subTopicBoundaryPlanning");
    const text = formatSubTopicBoundaryAppendix(buildSubTopicBoundaryContext(STRUCTURE_INPUT));
    expect(text).toMatch(/SUB-TOPIC BOUNDARY/);
    expect(text).toMatch(/brain regions/i);
  });

  test("Coverage Review reports out-of-scope concepts from existing lesson content", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const review = buildLessonCoverageReview({
      ...STRUCTURE_INPUT,
      pages: contaminatedPages,
    });
    expect(review.boundaryProfileKey).toBe("nervous-system-structure");
    expect(review.outOfScopeConcepts.length).toBeGreaterThan(0);
    expect(review.scopeContaminationScore).toBeGreaterThan(0);
    expect(review.boundaryWarnings.length).toBeGreaterThan(0);
    expect(
      review.outOfScopeConcepts.some((c) => c.id === "reflex_arc_pathway" || c.id === "accommodation")
    ).toBe(true);
  });

  test("lessons without resolved profile behave as before in warn mode", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const gate = createCoverageGenerationGate({
      topic: "Photosynthesis",
      subTopic: "Photosynthesis",
    });
    expect(gate.boundary.active).toBe(false);
    const { diagnostic } = planCoverageGatedQuestion(gate, { generationKind: "quiz" });
    expect(diagnostic.boundaryStatus).toBe("off");
    expect(diagnostic.conceptId).toBeTruthy();
  });
});
