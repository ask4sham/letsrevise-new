/**
 * Phase 3G — GCSE reasoning integration tests.
 */

const { buildOneShotLessonCoveragePlanAppendix } = require("../lib/teacherBrain/oneShotLessonCoveragePlan");
const { buildLessonCoverageReview } = require("../lib/teacherBrain/lessonCoverageReview");
const { buildReasoningChain } = require("../lib/teacherBrain/gcseReasoningEngine");

const STRUCTURE_INPUT = {
  topicKey: "aqa-gcse-biology:nervous-system-structure",
  subTopic: "Structure and function of the nervous system",
  topic: "Homeostasis and Response",
};

const reasoningPages = [
  {
    blocks: [
      {
        type: "text",
        content:
          "Structure: Myelin sheath around axon. Adaptation: insulates. Function: faster impulses. Consequence: rapid responses. Exam application: 4-mark explain rapid responses.",
      },
      {
        type: "dragdropmatch",
        title: "Neurone labelling",
        content: "dendrites axon myelin neurone structure",
      },
    ],
  },
];

describe("gcseReasoningCoverageIntegration (Phase 3G)", () => {
  const prevReasoning = process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE;
  const prevBoundary = process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;

  afterEach(() => {
    if (prevReasoning === undefined) delete process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE;
    else process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE = prevReasoning;
    if (prevBoundary === undefined) delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    else process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = prevBoundary;
  });

  test("nervous-system lesson receives reasoning chains in appendix", () => {
    process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE = "1";
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const chain = buildReasoningChain(
      "myelin_sheath",
      require("../lib/teacherBrain/gcseReasoningEngine").resolveReasoningProfile(STRUCTURE_INPUT)
    );
    expect(chain.chainText).toMatch(/Structure:/);

    const { appendix } = buildOneShotLessonCoveragePlanAppendix({
      ...STRUCTURE_INPUT,
      pages: reasoningPages,
    });
    expect(appendix).toMatch(/GCSE REASONING ENGINE/);
    expect(appendix).toMatch(/advantage it provides/i);
  });

  test("Coverage review includes reasoningCoverage", () => {
    process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE = "1";
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const review = buildLessonCoverageReview({
      ...STRUCTURE_INPUT,
      pages: reasoningPages,
    });
    expect(review.reasoningCoverage?.enabled).toBe(true);
    expect(review.reasoningCoverage.reasoningScorePct).toBeGreaterThan(0);
    expect(review.reasoningCoverage.conceptReasoning?.length).toBeGreaterThan(0);
  });

  test("Coverage review detects missing reasoning stages", () => {
    process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE = "1";
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const review = buildLessonCoverageReview({
      ...STRUCTURE_INPUT,
      pages: [{ blocks: [{ type: "text", content: "Myelin speeds up impulses only." }] }],
    });
    const myelin = review.reasoningCoverage?.conceptReasoning?.find(
      (c) => c.conceptId === "myelin_sheath"
    );
    expect(myelin?.steps.consequence).toBe(false);
    expect(review.reasoningCoverage?.gaps?.length).toBeGreaterThan(0);
  });

  test("Photosynthesis lesson unchanged", () => {
    process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE = "1";
    const review = buildLessonCoverageReview({
      topic: "Photosynthesis",
      subTopic: "Photosynthesis",
      pages: [{ blocks: [{ type: "text", content: "chlorophyll" }] }],
    });
    expect(review.reasoningCoverage?.enabled).toBe(false);
  });
});
