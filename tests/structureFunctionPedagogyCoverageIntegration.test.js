/**
 * Phase 3F — pedagogy engine integration tests.
 */

const { buildOneShotLessonCoveragePlanAppendix } = require("../lib/teacherBrain/oneShotLessonCoveragePlan");
const { buildLessonCoverageReview } = require("../lib/teacherBrain/lessonCoverageReview");
const { createCoverageGenerationGate } = require("../lib/teacherBrain/coverageGatedGeneration");
const { formatStructureFunctionPedagogyAppendix } = require("../lib/teacherBrain/structureFunctionPedagogyEngine");

const STRUCTURE_INPUT = {
  topicKey: "aqa-gcse-biology:nervous-system-structure",
  subTopic: "Structure and function of the nervous system",
  topic: "Homeostasis and Response",
};

const richPages = [
  {
    blocks: [
      {
        type: "dragdropmatch",
        title: "Neurone structure labelling",
        content: "dendrites cell body nucleus axon myelin sheath nerve endings",
      },
      {
        type: "text",
        content:
          "Structure adaptation function table. Myelin insulates the axon. Function: faster impulses.",
      },
      {
        type: "checkpoint",
        prompt: "Explain how neurones are adapted for rapid transmission of electrical impulses.",
      },
    ],
  },
];

describe("structureFunctionPedagogyCoverageIntegration (Phase 3F)", () => {
  const prevPedagogy = process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE;
  const prevBoundary = process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
  const prevPriority = process.env.TEACHER_BRAIN_PRIORITY_ENGINE;

  afterEach(() => {
    if (prevPedagogy === undefined) delete process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE;
    else process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE = prevPedagogy;
    if (prevBoundary === undefined) delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    else process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = prevBoundary;
    if (prevPriority === undefined) delete process.env.TEACHER_BRAIN_PRIORITY_ENGINE;
    else process.env.TEACHER_BRAIN_PRIORITY_ENGINE = prevPriority;
  });

  test("Photosynthesis unaffected when pedagogy engine on", () => {
    process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE = "1";
    expect(formatStructureFunctionPedagogyAppendix(null)).toBe("");
    const gate = createCoverageGenerationGate({
      topic: "Photosynthesis",
      subTopic: "Photosynthesis",
    });
    expect(gate.boundary.active).toBe(false);
  });

  test("one-shot appendix includes structure-function pedagogy section", () => {
    process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE = "1";
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const { appendix } = buildOneShotLessonCoveragePlanAppendix({
      ...STRUCTURE_INPUT,
      pages: richPages,
    });
    expect(appendix).toMatch(/STRUCTURE → FUNCTION PEDAGOGY/);
    expect(appendix).toMatch(/Neurone structure labelling/);
    expect(appendix).toMatch(/Explain how neurones are adapted/);
  });

  test("Coverage Review includes pedagogy coverage", () => {
    process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE = "1";
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const review = buildLessonCoverageReview({
      ...STRUCTURE_INPUT,
      pages: richPages,
    });
    expect(review.pedagogyCoverage?.enabled).toBe(true);
    expect(review.pedagogyCoverage.structureBlocks).toBeGreaterThanOrEqual(0);
  });

  test("boundary gate still works with pedagogy on", () => {
    process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE = "1";
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const gate = createCoverageGenerationGate({
      ...STRUCTURE_INPUT,
      pages: [
        {
          blocks: [
            { type: "checkpoint", prompt: "thermoregulation and vasodilation" },
          ],
        },
      ],
    });
    expect(gate.boundary.active).toBe(true);
  });
});
