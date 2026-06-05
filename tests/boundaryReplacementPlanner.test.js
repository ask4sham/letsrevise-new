/**
 * Phase 3C — boundary replacement planner.
 */

const {
  planBoundaryReplacements,
  formatBoundaryReplacementAppendix,
} = require("../lib/teacherBrain/boundaryReplacementPlanner");
const { auditLessonBoundary } = require("../lib/teacherBrain/lessonBoundaryAudit");
const { resolveSubTopicProfile } = require("../lib/teacherBrain/subTopicProfiles");
const { buildLessonCoverageMap } = require("../lib/teacherBrain/lessonCoverageIntelligence");
const { extractCoreConcepts } = require("../lib/teacherBrain/conceptExtractor");
const { buildLessonCoverageReview } = require("../lib/teacherBrain/lessonCoverageReview");
const { createCoverageGenerationGate, planCoverageGatedQuestionBatch } = require("../lib/teacherBrain/coverageGatedGeneration");
const { appendCoveragePlanToUserPrompt } = require("../backend/utils/coverageGatedLessonLlm");

const STRUCTURE_INPUT = {
  topicKey: "aqa-gcse-biology:nervous-system-structure",
  subTopic: "Structure and function of the nervous system",
  topic: "Homeostasis and Response",
};

const contaminatedPages = [
  {
    blocks: [
      { type: "text", content: "Neurones and myelin sheath." },
      {
        type: "dragdropmatch",
        title: "Reflex arc pathway",
        content: "Order the reflex arc pathway.",
      },
      { type: "checkpoint", prompt: "Explain thermoregulation and vasodilation." },
      {
        type: "interactivediagram",
        title: "Brain regions interactive diagram",
        content: "Label cerebrum cerebellum medulla.",
      },
      {
        type: "checkpoint",
        prompt: "Describe accommodation of the eye lens.",
      },
    ],
  },
];

function auditFor(pages) {
  return auditLessonBoundary({ ...STRUCTURE_INPUT, pages });
}

describe("boundaryReplacementPlanner (Phase 3C)", () => {
  const prevBoundary = process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;

  afterEach(() => {
    if (prevBoundary === undefined) {
      delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    } else {
      process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = prevBoundary;
    }
  });

  test("flag 0 returns empty plan", () => {
    delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    const audit = auditFor(contaminatedPages);
    const profile = resolveSubTopicProfile(STRUCTURE_INPUT);
    const plan = planBoundaryReplacements({ boundaryAudit: audit, subTopicProfile: profile });
    expect(plan.replacementPlans).toEqual([]);
    expect(plan.rerouteActive).toBe(false);
  });

  test("no profile returns empty plan", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const audit = auditFor(contaminatedPages);
    const plan = planBoundaryReplacements({
      boundaryAudit: audit,
      subTopicProfile: null,
    });
    expect(plan.replacementPlans).toEqual([]);
  });

  test("reflex_arc_pathway reroutes to neurones impulse or myelin", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const audit = auditFor(contaminatedPages);
    const profile = resolveSubTopicProfile(STRUCTURE_INPUT);
    const plan = planBoundaryReplacements({ boundaryAudit: audit, subTopicProfile: profile });
    const reflex = plan.replacementPlans.find((p) => p.originalConceptId === "reflex_arc_pathway");
    expect(reflex).toBeTruthy();
    expect(["neurones", "impulse_transmission", "myelin_sheath"]).toContain(
      reflex.suggestedReplacementConceptId
    );
  });

  test("thermoregulation reroutes to myelin or impulse_transmission", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const audit = auditFor(contaminatedPages);
    const profile = resolveSubTopicProfile(STRUCTURE_INPUT);
    const plan = planBoundaryReplacements({ boundaryAudit: audit, subTopicProfile: profile });
    const thermo = plan.replacementPlans.find((p) => p.originalConceptId === "thermoregulation");
    expect(thermo).toBeTruthy();
    expect(["myelin_sheath", "impulse_transmission"]).toContain(thermo.suggestedReplacementConceptId);
  });

  test("brain_regions reroutes to neurones or cns/pns", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const audit = auditFor(contaminatedPages);
    const profile = resolveSubTopicProfile(STRUCTURE_INPUT);
    const plan = planBoundaryReplacements({ boundaryAudit: audit, subTopicProfile: profile });
    const brain = plan.replacementPlans.find((p) => p.originalConceptId === "brain_regions");
    expect(brain).toBeTruthy();
    expect(["neurones", "cns", "pns"]).toContain(brain.suggestedReplacementConceptId);
  });

  test("accommodation reroutes to neurones dendrites or axons", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const audit = auditFor(contaminatedPages);
    const profile = resolveSubTopicProfile(STRUCTURE_INPUT);
    const plan = planBoundaryReplacements({ boundaryAudit: audit, subTopicProfile: profile });
    const acc = plan.replacementPlans.find((p) => p.originalConceptId === "accommodation");
    expect(acc).toBeTruthy();
    expect(["neurones", "dendrites", "axons"]).toContain(acc.suggestedReplacementConceptId);
  });

  test("mode 1 advisory only", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const audit = auditFor(contaminatedPages);
    const profile = resolveSubTopicProfile(STRUCTURE_INPUT);
    const plan = planBoundaryReplacements({ boundaryAudit: audit, subTopicProfile: profile });
    expect(plan.reportOnly).toBe(true);
    expect(plan.rerouteActive).toBe(false);
    expect(plan.promptInstructions.length).toBeGreaterThan(0);
  });

  test("mode 2 sets rerouteActive and blockedConceptIds", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const audit = auditFor(contaminatedPages);
    const profile = resolveSubTopicProfile(STRUCTURE_INPUT);
    const plan = planBoundaryReplacements({ boundaryAudit: audit, subTopicProfile: profile });
    expect(plan.rerouteActive).toBe(true);
    expect(plan.reportOnly).toBe(false);
    expect(plan.blockedConceptIds).toContain("reflex_arc_pathway");
    expect(plan.blockedConceptIds).toContain("thermoregulation");
    expect(plan.preferredConceptIds.length).toBeGreaterThan(0);
  });

  test("formatBoundaryReplacementAppendix includes marker", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const audit = auditFor(contaminatedPages);
    const profile = resolveSubTopicProfile(STRUCTURE_INPUT);
    const plan = planBoundaryReplacements({ boundaryAudit: audit, subTopicProfile: profile });
    const text = formatBoundaryReplacementAppendix(plan);
    expect(text).toMatch(/BOUNDARY REPLACEMENT PLAN/);
    expect(text).toMatch(/thermoregulation|Reflex/i);
  });

  test("Coverage Review includes boundaryReplacementPlan in mode 1", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const review = buildLessonCoverageReview({
      ...STRUCTURE_INPUT,
      pages: contaminatedPages,
    });
    expect(review.boundaryReplacementPlan).toBeDefined();
    expect(review.boundaryReplacementPlan.replacementPlans.length).toBeGreaterThan(0);
  });

  test("Coverage Gate excludes blocked concepts in mode 2", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const gate = createCoverageGenerationGate({
      ...STRUCTURE_INPUT,
      pages: contaminatedPages,
    });
    expect(gate.replacementPlan?.rerouteActive).toBe(true);
    const plans = planCoverageGatedQuestionBatch(gate, 8, "quiz");
    const ids = plans.map((p) => p.diagnostic.conceptId).filter(Boolean);
    expect(ids).not.toContain("reflex_arc_pathway");
    expect(ids).not.toContain("thermoregulation");
    expect(ids).not.toContain("accommodation");
    expect(ids).not.toContain("brain_regions");
  });

  test("generate assets prompt includes replacement instructions in mode 2", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const gate = createCoverageGenerationGate({
      ...STRUCTURE_INPUT,
      pages: contaminatedPages,
    });
    const prompt = appendCoveragePlanToUserPrompt("BASE PROMPT", gate, 3, "quiz");
    expect(prompt).toMatch(/BOUNDARY REPLACEMENT PLAN/);
    expect(prompt).toMatch(/BOUNDARY INTERACTION REPLACEMENT/);
    expect(prompt).toMatch(/thermoregulation|Reflex/i);
    expect(prompt).toContain("BASE PROMPT");
  });

  test("planner does not change lesson block count", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const before = contaminatedPages[0].blocks.length;
    const audit = auditFor(contaminatedPages);
    const profile = resolveSubTopicProfile(STRUCTURE_INPUT);
    const coreConcepts = extractCoreConcepts(STRUCTURE_INPUT);
    const coverageMap = buildLessonCoverageMap({ pages: contaminatedPages, coreConcepts });
    planBoundaryReplacements({ boundaryAudit: audit, subTopicProfile: profile, coverageMap });
    expect(contaminatedPages[0].blocks.length).toBe(before);
  });
});
