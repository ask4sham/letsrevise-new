/**
 * Phase 3G.7 — interaction authority integration tests.
 */

const { buildOneShotLessonCoveragePlanAppendix } = require("../lib/teacherBrain/oneShotLessonCoveragePlan");
const { buildLessonCoverageReview } = require("../lib/teacherBrain/lessonCoverageReview");
const { planBoundaryInteractionReplacements } = require("../lib/teacherBrain/boundaryInteractionReplacementPlanner");
const { auditLessonBoundary } = require("../lib/teacherBrain/lessonBoundaryAudit");
const { resolveSubTopicProfile } = require("../lib/teacherBrain/subTopicProfiles");
const { planBoundaryReplacements } = require("../lib/teacherBrain/boundaryReplacementPlanner");
const { appendCoveragePlanToUserPrompt } = require("../backend/utils/coverageGatedLessonLlm");
const { createCoverageGenerationGate } = require("../lib/teacherBrain/coverageGatedGeneration");

const STRUCTURE_INPUT = {
  topicKey: "aqa-gcse-biology:nervous-system-structure",
  subTopic: "Structure and function of the nervous system",
  topic: "Homeostasis and Response",
};

const contaminatedPages = [
  {
    blocks: [
      { type: "dragdropmatch", title: "Reflex arc pathway", content: "Order the reflex arc pathway." },
      { type: "interactivediagram", title: "Eye accommodation diagram", content: "lens iris pupil" },
      { type: "dragdropmatch", title: "Brain regions", content: "cerebellum medulla cortex" },
      { type: "checkpoint", prompt: "Explain thermoregulation and vasodilation." },
    ],
  },
];

describe("interactionAuthorityCoverageIntegration (Phase 3G.7)", () => {
  const prevBoundary = process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;

  afterEach(() => {
    if (prevBoundary === undefined) delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    else process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = prevBoundary;
  });

  test("prompt appendix includes authorised list in mode 1", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const { appendix } = buildOneShotLessonCoveragePlanAppendix({
      ...STRUCTURE_INPUT,
      pages: contaminatedPages,
    });
    expect(appendix).toMatch(/INTERACTION AUTHORITY/);
    expect(appendix).toMatch(/Neurone structure labelling/i);
    expect(appendix).toMatch(/CNS\/PNS classification/i);
  });

  test("mode 2 asset prompt lists enforcement and authorised interactions", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const gate = createCoverageGenerationGate({
      ...STRUCTURE_INPUT,
      pages: contaminatedPages,
    });
    const prompt = appendCoveragePlanToUserPrompt("BASE", gate, 2, "quiz");
    expect(prompt).toMatch(/INTERACTION AUTHORITY/);
    expect(prompt).toMatch(/Enforcement/);
    expect(prompt).toMatch(/authorised interactions/i);
    expect(prompt).toMatch(/neurone_structure_labelling/);
    expect(prompt).toMatch(/Do NOT generate/i);
    expect(prompt).not.toMatch(/Instead create a .* \(dragDrop\) task: "Eye/i);
    expect(prompt).toContain("BASE");
  });

  test("interaction replacement planner uses authority layer in mode 2", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const profile = resolveSubTopicProfile(STRUCTURE_INPUT);
    const audit = auditLessonBoundary({ ...STRUCTURE_INPUT, pages: contaminatedPages });
    const replacementPlan = planBoundaryReplacements({
      boundaryAudit: audit,
      subTopicProfile: profile,
    });
    const interactionPlan = planBoundaryInteractionReplacements({
      boundaryAudit: audit,
      boundaryReplacementPlan: replacementPlan,
      subTopicProfile: profile,
    });
    expect(interactionPlan.interactionAuthority).toBeTruthy();
    expect(interactionPlan.interactionPromptInstructions.some((l) => /INTERACTION AUTHORITY/i.test(l))).toBe(true);
  });

  test("Coverage Review reports unauthorised interactions", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const review = buildLessonCoverageReview({
      ...STRUCTURE_INPUT,
      pages: contaminatedPages,
    });
    expect(review.interactionAuthority?.enabled).toBe(true);
    expect(review.interactionAuthority.unauthorisedDetected.length).toBeGreaterThan(0);
    expect(review.interactionAuthority.suggestedReplacements.length).toBeGreaterThan(0);
  });

  test("existing lesson block count unchanged after audit", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const before = contaminatedPages[0].blocks.length;
    buildLessonCoverageReview({ ...STRUCTURE_INPUT, pages: contaminatedPages });
    expect(contaminatedPages[0].blocks.length).toBe(before);
  });

  test("Photosynthesis unaffected", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const review = buildLessonCoverageReview({
      topic: "Photosynthesis",
      subTopic: "Photosynthesis",
      pages: [{ blocks: [{ type: "text", content: "chlorophyll" }] }],
    });
    expect(review.interactionAuthority?.enabled).toBe(false);
  });
});
