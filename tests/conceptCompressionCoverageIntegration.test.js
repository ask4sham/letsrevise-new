/**
 * Phase 3H.0 — Concept Compression integration tests.
 */

const { buildOneShotLessonCoveragePlanAppendix } = require("../lib/teacherBrain/oneShotLessonCoveragePlan");
const { buildLessonCoverageReview } = require("../lib/teacherBrain/lessonCoverageReview");
const { buildTeacherBrainPromptAppendixFromContext } = require("../lib/lessonGeneratorV4/teacherBrainPromptAppendix");

const STRUCTURE_INPUT = {
  topicKey: "aqa-gcse-biology:nervous-system-structure",
  subTopic: "Structure and function of the nervous system",
  topic: "Homeostasis and Response",
};

const compressionPages = [
  {
    blocks: [
      {
        type: "objectives",
        content:
          "The nervous system is the body's rapid communication system. Detect and respond quickly to changes.",
      },
      {
        type: "text",
        content:
          "Stimulus receptor neurone CNS effector response. Axon dendrite myelin sheath PNS.",
      },
    ],
  },
];

describe("conceptCompressionCoverageIntegration (Phase 3H.0)", () => {
  const prevCompression = process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION;
  const prevBoundary = process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;

  afterEach(() => {
    if (prevCompression === undefined) delete process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION;
    else process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION = prevCompression;
    if (prevBoundary === undefined) delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    else process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = prevBoundary;
  });

  test("one-shot appendix includes CONCEPT COMPRESSION when enabled", () => {
    process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION = "1";
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const { appendix } = buildOneShotLessonCoveragePlanAppendix({
      ...STRUCTURE_INPUT,
      pages: compressionPages,
    });
    expect(appendix).toMatch(/CONCEPT COMPRESSION:/);
    expect(appendix).toMatch(/Core Model:/);
    expect(appendix).toMatch(/Stimulus/);
  });

  test("V4 prompt appendix includes CONCEPT COMPRESSION when enabled", () => {
    process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION = "1";
    const appendix = buildTeacherBrainPromptAppendixFromContext(
      { topic: STRUCTURE_INPUT.topic, topicKey: STRUCTURE_INPUT.topicKey, subTopic: STRUCTURE_INPUT.subTopic },
      STRUCTURE_INPUT
    );
    expect(appendix).toMatch(/CONCEPT COMPRESSION:/);
  });

  test("Coverage Review includes conceptCompressionCoverage", () => {
    process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION = "1";
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const review = buildLessonCoverageReview({
      ...STRUCTURE_INPUT,
      pages: compressionPages,
    });
    expect(review.conceptCompressionCoverage?.enabled).toBe(true);
    expect(review.conceptCompressionCoverage.compressionScorePct).toBeGreaterThan(0);
    expect(review.conceptCompressionCoverage.definitionPresent).toBe(true);
  });

  test("homeostasis profile resolves in coverage review", () => {
    process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION = "1";
    const review = buildLessonCoverageReview({
      topic: "Homeostasis and Response",
      subTopic: "Homeostasis",
      pages: [
        {
          blocks: [
            {
              type: "text",
              content:
                "Homeostasis regulates internal conditions for optimum enzyme activity. Receptors coordination centre effectors negative feedback.",
            },
          ],
        },
      ],
    });
    expect(review.conceptCompressionCoverage?.enabled).toBe(true);
    expect(review.conceptCompressionCoverage.taxonomyKey).toBe("homeostasis");
  });

  test("the eye profile resolves in coverage review", () => {
    process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION = "1";
    const review = buildLessonCoverageReview({
      topic: "Homeostasis and Response",
      subTopic: "The Eye",
      pages: [
        {
          blocks: [
            {
              type: "text",
              content:
                "The eye detects light and forms images. Cornea lens retina accommodation focus vision.",
            },
          ],
        },
      ],
    });
    expect(review.conceptCompressionCoverage?.enabled).toBe(true);
    expect(review.conceptCompressionCoverage.taxonomyKey).toBe("the-eye");
  });

  test("Photosynthesis unchanged when no compression profile", () => {
    process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION = "1";
    const review = buildLessonCoverageReview({
      topic: "Photosynthesis",
      subTopic: "Photosynthesis",
      pages: [{ blocks: [{ type: "text", content: "chlorophyll" }] }],
    });
    expect(review.conceptCompressionCoverage?.enabled).toBe(false);
  });

  test("flag off — no appendix or coverage section", () => {
    delete process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION;
    const { appendix } = buildOneShotLessonCoveragePlanAppendix(STRUCTURE_INPUT);
    expect(appendix).not.toMatch(/CONCEPT COMPRESSION:/);
    const review = buildLessonCoverageReview({ ...STRUCTURE_INPUT, pages: compressionPages });
    expect(review.conceptCompressionCoverage?.enabled).toBe(false);
  });
});
