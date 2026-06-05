/**
 * Phase 3D — boundary interaction replacement planner.
 */

const {
  planBoundaryInteractionReplacements,
  nervousSystemStructureInteractionTemplate,
  formatBoundaryInteractionReplacementAppendix,
  normalizeOriginalActivityKind,
} = require("../lib/teacherBrain/boundaryInteractionReplacementPlanner");
const {
  planBoundaryReplacements,
  formatBoundaryReplacementAppendix,
} = require("../lib/teacherBrain/boundaryReplacementPlanner");
const { auditLessonBoundary } = require("../lib/teacherBrain/lessonBoundaryAudit");
const { resolveSubTopicProfile } = require("../lib/teacherBrain/subTopicProfiles");
const { buildLessonCoverageReview } = require("../lib/teacherBrain/lessonCoverageReview");
const { createCoverageGenerationGate } = require("../lib/teacherBrain/coverageGatedGeneration");
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

function conceptPlanFor(pages, mode) {
  process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = String(mode);
  const audit = auditFor(pages);
  const profile = resolveSubTopicProfile(STRUCTURE_INPUT);
  return planBoundaryReplacements({ boundaryAudit: audit, subTopicProfile: profile });
}

describe("boundaryInteractionReplacementPlanner (Phase 3D)", () => {
  const prevBoundary = process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;

  afterEach(() => {
    if (prevBoundary === undefined) {
      delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    } else {
      process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = prevBoundary;
    }
  });

  test("flag 0 returns empty interaction plan", () => {
    delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    const audit = auditFor(contaminatedPages);
    const profile = resolveSubTopicProfile(STRUCTURE_INPUT);
    const plan = planBoundaryInteractionReplacements({
      boundaryAudit: audit,
      subTopicProfile: profile,
    });
    expect(plan.interactionReplacementPlans).toEqual([]);
  });

  test("no profile returns empty interaction plan", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const audit = auditFor(contaminatedPages);
    const plan = planBoundaryInteractionReplacements({
      boundaryAudit: audit,
      subTopicProfile: null,
    });
    expect(plan.interactionReplacementPlans).toEqual([]);
  });

  test("reflex_arc_pathway dragDrop: 3D template then authority reroute in mode 2", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const profile = resolveSubTopicProfile(STRUCTURE_INPUT);
    const template = nervousSystemStructureInteractionTemplate(
      "reflex_arc_pathway",
      "dragDrop",
      profile
    );
    expect(template.replacementTemplateKey).toBe("neurone_structure_drag_drop");
    expect(template.replacementBlockType).toBe("dragdropmatch");
    expect(template.cards).toContain("myelin sheath");

    const merged = conceptPlanFor(contaminatedPages, 2);
    const reflex = merged.interactionReplacementPlans.find(
      (p) => p.originalConceptId === "reflex_arc_pathway"
    );
    expect(reflex).toBeTruthy();
    expect(reflex.replacementTemplateKey).toBe("impulse_transmission_sequence");
    expect(reflex.authorityRerouted).toBe(true);
    expect(reflex.originalActivityKind).toBe("dragDrop");
  });

  test("brain_regions interactiveDiagram replaces with CNS/PNS or neurone label", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const profile = resolveSubTopicProfile(STRUCTURE_INPUT);
    const template = nervousSystemStructureInteractionTemplate(
      "brain_regions",
      "interactiveDiagram",
      profile
    );
    expect(template.replacementTemplateKey).toBe("cns_pns_comparison_or_neurone_label");
    expect(template.replacementBlockType).toBe("interactivediagram");

    const merged = conceptPlanFor(contaminatedPages, 2);
    const brain = merged.interactionReplacementPlans.find(
      (p) => p.originalConceptId === "brain_regions"
    );
    expect(brain).toBeTruthy();
    expect(brain.replacementActivityKind).toBe("interactiveDiagram");
  });

  test("thermoregulation examPractice replaces with impulse_transmission_sequence", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const profile = resolveSubTopicProfile(STRUCTURE_INPUT);
    const template = nervousSystemStructureInteractionTemplate(
      "thermoregulation",
      "examPractice",
      profile
    );
    expect(template.replacementTemplateKey).toBe("impulse_transmission_sequence");
    expect(template.replacementConceptId).toBe("impulse_transmission");
    expect(template.replacementBlockType).toBe("interactivesequence");
  });

  test("accommodation checkpoint replaces with myelin_speed checkpoint", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const profile = resolveSubTopicProfile(STRUCTURE_INPUT);
    const template = nervousSystemStructureInteractionTemplate(
      "accommodation",
      "checkpoint",
      profile
    );
    expect(template.replacementTemplateKey).toBe("myelin_speed_explanation");
    expect(template.checkpointPrompt).toMatch(/myelin sheath speeds up/i);

    const merged = conceptPlanFor(contaminatedPages, 2);
    const acc = merged.interactionReplacementPlans.find(
      (p) => p.originalConceptId === "accommodation"
    );
    expect(acc).toBeTruthy();
    expect(acc.replacementBlockType).toBe("checkpoint");
  });

  test("mode 1 reports interaction suggestions only", () => {
    const merged = conceptPlanFor(contaminatedPages, 1);
    expect(merged.interactionReplacementPlans.length).toBeGreaterThan(0);
    expect(merged.interactionRerouteActive).toBeFalsy();
    expect(merged.rerouteActive).toBe(false);
    expect(merged.interactionReportOnly).toBe(true);
  });

  test("mode 2 adds interaction instructions to generator prompt", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const gate = createCoverageGenerationGate({
      ...STRUCTURE_INPUT,
      pages: contaminatedPages,
    });
    const prompt = appendCoveragePlanToUserPrompt("BASE PROMPT", gate, 3, "quiz");
    expect(prompt).toMatch(/BOUNDARY INTERACTION REPLACEMENT/);
    expect(prompt).toMatch(/neurone structure|myelin/i);
    expect(prompt).toContain("BASE PROMPT");
  });

  test("formatBoundaryReplacementAppendix includes interaction section in mode 2", () => {
    const merged = conceptPlanFor(contaminatedPages, 2);
    const text = formatBoundaryReplacementAppendix(merged);
    expect(text).toMatch(/BOUNDARY REPLACEMENT PLAN/);
    expect(text).toMatch(/BOUNDARY INTERACTION REPLACEMENT/);
    const interactionOnly = formatBoundaryInteractionReplacementAppendix(merged);
    expect(interactionOnly).toMatch(/Replace forbidden interaction types/);
  });

  test("Coverage Review includes interaction replacement plan in mode 1", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const review = buildLessonCoverageReview({
      ...STRUCTURE_INPUT,
      pages: contaminatedPages,
    });
    expect(review.boundaryReplacementPlan.interactionReplacementPlans.length).toBeGreaterThan(0);
  });

  test("planner does not change lesson block count", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const before = contaminatedPages[0].blocks.length;
    conceptPlanFor(contaminatedPages, 2);
    expect(contaminatedPages[0].blocks.length).toBe(before);
  });

  test("normalizeOriginalActivityKind maps block types", () => {
    expect(normalizeOriginalActivityKind("dragdropmatch")).toBe("dragDrop");
    expect(normalizeOriginalActivityKind("interactivediagram")).toBe("interactiveDiagram");
    expect(normalizeOriginalActivityKind("exam")).toBe("examPractice");
  });
});
