/**
 * One-shot lesson generator + coverage review tests (Phase 4 gaps).
 */

const {
  buildOneShotLessonCoveragePlanAppendix,
  mergeOneShotCoveragePlanIntoInstructions,
  PLAN_MARKER,
} = require("../lib/teacherBrain/oneShotLessonCoveragePlan");
const { buildTeacherBrainPromptAppendixFromContext } = require("../lib/lessonGeneratorV4/teacherBrainPromptAppendix");
const { buildLessonCoverageReview } = require("../lib/teacherBrain/lessonCoverageReview");

describe("One-shot lesson coverage plan", () => {
  const reflexPages = [
    {
      blocks: [
        {
          type: "dragdropmatch",
          content: "Match reflex arc pathway receptor sensory relay motor effector.",
        },
        {
          type: "interactivesequence",
          content: "Step by step reflex arc pathway from stimulus to effector.",
        },
        {
          type: "checkpoint",
          question: "Order the reflex arc pathway.",
        },
        {
          type: "checkpoint",
          question: "Another reflex arc pathway recall question.",
        },
      ],
    },
  ];

  test("main lesson generator instructions receive coverage plan marker", () => {
    const merged = mergeOneShotCoveragePlanIntoInstructions("", {
      topic: "Nervous system reflex arc",
      pages: reflexPages,
    });
    expect(merged).toContain(PLAN_MARKER);
    expect(merged).toMatch(/MUST NOT BE OVER-TESTED/i);
    expect(merged).toMatch(/REQUIRED VARIETY/i);
    expect(merged).toMatch(/Recall|Explain|Apply/i);
  });

  test("V4 teacher brain appendix includes one-shot coverage plan", () => {
    const appendix = buildTeacherBrainPromptAppendixFromContext(
      { topic: "Nervous system", subject: "Biology", examBoard: "AQA", tier: "Higher" },
      { topic: "Nervous system", pages: reflexPages }
    );
    expect(appendix).toContain(PLAN_MARKER);
    expect(appendix).toMatch(/step-by-step|Step-by-Step/i);
  });

  test("reflex pathway over-tested lesson plans alternative checkpoint focus", () => {
    const { plans } = buildOneShotLessonCoveragePlanAppendix({
      topic: "Nervous system",
      pages: reflexPages,
    });
    const checkpointPlans = plans.filter((p) => p.diagnostic.generationKind === "checkpoint");
    expect(checkpointPlans.length).toBeGreaterThan(0);
    const targetsPathway = checkpointPlans.filter(
      (p) => p.diagnostic.conceptId === "reflex_arc_pathway"
    );
    expect(targetsPathway.length).toBeLessThan(checkpointPlans.length);
  });
});

describe("Lesson coverage review (editor)", () => {
  test("detects hidden bank items and pathway duplication appearances", () => {
    const review = buildLessonCoverageReview({
      topic: "Nervous system",
      pages: [
        {
          blocks: [
            { type: "dragdropmatch", content: "reflex arc pathway drag drop" },
            { type: "interactivesequence", content: "reflex arc pathway steps" },
            { type: "checkpoint", question: "reflex arc pathway checkpoint" },
          ],
        },
      ],
      bankQuizQuestions: [
        { questionText: "Another reflex arc pathway quiz question" },
      ],
      bankFlashcards: [{ front: "Synapse", back: "Gap between neurones" }],
    });

    expect(review.hiddenSources.bankQuizQuestions).toBe(1);
    expect(review.hiddenSources.bankFlashcards).toBe(1);
    const pathwayWarning = review.overTested.find((w) => w.id === "reflex_arc_pathway");
    expect(pathwayWarning).toBeDefined();
    expect(pathwayWarning.appearances.map((a) => a.label)).toEqual(
      expect.arrayContaining(["Drag & Drop", "Step-by-Step", "Checkpoint", "Quiz"])
    );
    expect(pathwayWarning.suggestedReplacement.length).toBeGreaterThan(0);
    const lowCoverage = review.underTested.filter((c) => c.count === 0);
    expect(lowCoverage.length).toBeGreaterThan(0);
  });
});
