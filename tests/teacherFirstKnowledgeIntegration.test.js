/**
 * Phase 3H.1 — Teacher-First Knowledge Delivery integration tests.
 */

const { buildOneShotLessonCoveragePlanAppendix } = require("../lib/teacherBrain/oneShotLessonCoveragePlan");
const { buildLessonCoverageReview } = require("../lib/teacherBrain/lessonCoverageReview");
const { buildTeacherBrainPromptAppendixFromContext } = require("../lib/lessonGeneratorV4/teacherBrainPromptAppendix");

const HOMEOSTASIS_INPUT = {
  topicKey: "aqa-gcse-biology:homeostasis",
  subTopic: "Homeostasis",
  topic: "Homeostasis and Response",
};

const goodOpeningPages = [
  {
    blocks: [
      {
        type: "text",
        content:
          "Homeostasis is the regulation of internal conditions to maintain optimum conditions for cells and enzymes.",
      },
      {
        type: "text",
        content:
          "Enzymes only work efficiently within narrow conditions. Receptors coordination centre effectors stimulus response optimum.",
      },
    ],
  },
];

const scenarioHeavyPages = [
  {
    blocks: [
      {
        type: "text",
        content: "Imagine you are on a hot beach. Question to carry through this lesson...",
      },
      {
        type: "text",
        content: "Later we will define homeostasis.",
      },
    ],
  },
];

describe("teacherFirstKnowledgeIntegration (Phase 3H.1)", () => {
  const prevOpening = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
  const prevCompression = process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION;
  const prevBoundary = process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;

  afterEach(() => {
    if (prevOpening === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevOpening;
    if (prevCompression === undefined) delete process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION;
    else process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION = prevCompression;
    if (prevBoundary === undefined) delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    else process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = prevBoundary;
  });

  test("one-shot appendix includes TEACHER-FIRST KNOWLEDGE DELIVERY when enabled", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const { appendix } = buildOneShotLessonCoveragePlanAppendix(HOMEOSTASIS_INPUT);
    expect(appendix).toMatch(/TEACHER-FIRST KNOWLEDGE DELIVERY/);
    expect(appendix).toMatch(/LAYER 1 — UNIVERSAL TEACHER-FIRST FRAMEWORK/);
    expect(appendix).toMatch(/LAYER 2 — SUBJECT PROFILE \(Biology\)/);
    expect(appendix).toMatch(/Receptors/);
    expect(appendix).toMatch(/Do not begin with a long scenario/);
  });

  test("V4 prompt appendix includes teacher-first section when enabled", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const appendix = buildTeacherBrainPromptAppendixFromContext(
      { topic: HOMEOSTASIS_INPUT.topic, topicKey: HOMEOSTASIS_INPUT.topicKey, subTopic: HOMEOSTASIS_INPUT.subTopic },
      HOMEOSTASIS_INPUT
    );
    expect(appendix).toMatch(/TEACHER-FIRST KNOWLEDGE DELIVERY/);
  });

  test("Coverage Review includes teacherFirstOpeningCoverage diagnostics", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const review = buildLessonCoverageReview({
      ...HOMEOSTASIS_INPUT,
      pages: goodOpeningPages,
    });
    expect(review.teacherFirstOpeningCoverage?.enabled).toBe(true);
    expect(review.teacherFirstOpeningCoverage.definitionAppearsEarly).toBe(true);
    expect(review.teacherFirstOpeningCoverage.openingScorePct).toBeGreaterThan(50);
  });

  test("Coverage Review flags scenario-heavy opening", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const review = buildLessonCoverageReview({
      ...HOMEOSTASIS_INPUT,
      pages: scenarioHeavyPages,
    });
    expect(review.teacherFirstOpeningCoverage?.scenarioBeforeDefinition).toBe(true);
    expect(review.teacherFirstOpeningCoverage?.scenarioBeforeCoreKnowledge).toBe(true);
    expect(review.teacherFirstOpeningCoverage?.flags).toEqual(
      expect.arrayContaining([
        "Opening too scenario-heavy",
        "Scenario before definition",
        "Scenario before core knowledge",
      ])
    );
  });

  test("photosynthesis unaffected when no profile exists", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const review = buildLessonCoverageReview({
      topic: "Bioenergetics",
      subTopic: "Photosynthesis",
      topicKey: "aqa-gcse-biology:photosynthesis",
      pages: [{ blocks: [{ type: "text", content: "Plants use light energy." }] }],
    });
    expect(review.teacherFirstOpeningCoverage?.enabled).toBe(true);
    expect(review.teacherFirstOpeningCoverage?.taxonomyKey).toBeNull();
    expect(review.teacherFirstOpeningCoverage?.definitionAppearsEarly).toBe(false);
  });

  test("default flag off = no appendix or coverage diagnostics", () => {
    delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    const { appendix } = buildOneShotLessonCoveragePlanAppendix(HOMEOSTASIS_INPUT);
    expect(appendix).not.toMatch(/TEACHER-FIRST KNOWLEDGE DELIVERY/);
    const review = buildLessonCoverageReview({
      ...HOMEOSTASIS_INPUT,
      pages: goodOpeningPages,
    });
    expect(review.teacherFirstOpeningCoverage?.enabled).toBe(false);
  });
});
