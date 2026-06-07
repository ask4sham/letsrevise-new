/**
 * Phase 3C.5 — objective boundary enforcer.
 */

const {
  enforceObjectiveBoundaries,
  enforceObjectiveBoundariesOnDraft,
  formatObjectiveBoundaryAppendix,
  analyzeObjectiveItem,
} = require("../lib/teacherBrain/objectiveBoundaryEnforcer");
const { resolveSubTopicProfile } = require("../lib/teacherBrain/subTopicProfiles");
const { buildOneShotLessonCoveragePlanAppendix } = require("../lib/teacherBrain/oneShotLessonCoveragePlan");
const { buildLessonCoverageReview } = require("../lib/teacherBrain/lessonCoverageReview");

const STRUCTURE_INPUT = {
  topicKey: "aqa-gcse-biology:nervous-system-structure",
  subTopic: "Structure and function of the nervous system",
  topic: "Homeostasis and Response",
};

const profile = () => resolveSubTopicProfile(STRUCTURE_INPUT);

const contaminatedObjectives = [
  "Identify the cerebral cortex, cerebellum and medulla.",
  "Describe eye accommodation and lens shape change.",
  "Explain thermoregulation and vasodilation.",
  "Describe the full reflex arc pathway from stimulus to effector.",
];

const inScopeObjectives = [
  "Describe the function of the CNS and PNS.",
  "Explain how myelin sheath speeds up electrical impulses along axons.",
  "Label dendrites, axon and cell body on a motor neurone.",
];

const objectivePages = [
  {
    blocks: [
      {
        type: "keyIdea",
        role: "lessonObjectives",
        title: "REVISION OBJECTIVES",
        content: [
          "At the end of this lesson, you should be able to:",
          ...contaminatedObjectives.map((o) => `• ${o}`),
          ...inScopeObjectives.map((o) => `• ${o}`),
        ].join("\n"),
      },
      { type: "text", role: "priorKnowledge", title: "PRIOR KNOWLEDGE", content: "• Recall thermoregulation." },
    ],
  },
];

describe("objectiveBoundaryEnforcer (Phase 3C.5)", () => {
  const prevBoundary = process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;

  afterEach(() => {
    if (prevBoundary === undefined) {
      delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    } else {
      process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = prevBoundary;
    }
  });

  test("mode 0 leaves contaminated objectives unchanged", () => {
    delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    const result = enforceObjectiveBoundaries({
      objectives: contaminatedObjectives,
      subTopicProfile: profile(),
    });
    expect(result.changed).toBe(false);
    expect(result.cleanedObjectives).toEqual(contaminatedObjectives);
    expect(result.warnings).toEqual([]);
  });

  test("mode 1 detects but does not rewrite contaminated objectives", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const result = enforceObjectiveBoundaries({
      objectives: contaminatedObjectives,
      subTopicProfile: profile(),
      applyChanges: false,
    });
    expect(result.changed).toBe(false);
    expect(result.cleanedObjectives).toEqual(contaminatedObjectives);
    expect(result.outOfScopeObjectiveCount).toBeGreaterThan(0);
    expect(result.replacementItems.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("mode 2 replaces brain region objective", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const result = enforceObjectiveBoundaries({
      objectives: ["Identify the cerebral cortex, cerebellum and medulla."],
      subTopicProfile: profile(),
    });
    expect(result.changed).toBe(true);
    expect(result.cleanedObjectives[0]).toMatch(/neurone|dendrites|axon|myelin/i);
    expect(result.cleanedObjectives[0]).not.toMatch(/cerebellum|medulla/i);
  });

  test("mode 2 replaces eye accommodation objective", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const result = enforceObjectiveBoundaries({
      objectives: ["Describe eye accommodation and lens shape."],
      subTopicProfile: profile(),
    });
    expect(result.cleanedObjectives[0]).toMatch(/axon|myelin|impulse/i);
    expect(result.cleanedObjectives[0]).not.toMatch(/accommodation/i);
  });

  test("mode 2 replaces thermoregulation objective", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const result = enforceObjectiveBoundaries({
      objectives: ["Explain thermoregulation and body temperature control."],
      subTopicProfile: profile(),
    });
    expect(result.cleanedObjectives[0]).toMatch(/receptors|neurones|CNS|effectors/i);
    expect(result.cleanedObjectives[0]).not.toMatch(/thermoregulation/i);
  });

  test("mode 2 replaces full reflex arc objective", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const result = enforceObjectiveBoundaries({
      objectives: ["Describe the reflex arc pathway from stimulus to effector in detail."],
      subTopicProfile: profile(),
    });
    expect(result.cleanedObjectives[0]).toMatch(/impulses travel|receptors|neurones/i);
    expect(result.cleanedObjectives[0]).not.toMatch(/reflex arc pathway/i);
  });

  test("valid neurone CNS PNS objectives remain unchanged", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const result = enforceObjectiveBoundaries({
      objectives: inScopeObjectives,
      subTopicProfile: profile(),
    });
    expect(result.cleanedObjectives).toEqual(inScopeObjectives);
    expect(result.removedOutOfScopeItems).toEqual([]);
  });

  test("no profile returns unchanged", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const result = enforceObjectiveBoundaries({
      objectives: contaminatedObjectives,
      subTopicProfile: null,
    });
    expect(result.changed).toBe(false);
    expect(result.cleanedObjectives).toEqual(contaminatedObjectives);
  });

  test("replacement objectives are in-scope", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    for (const item of contaminatedObjectives) {
      const analysis = analyzeObjectiveItem(item, profile());
      expect(analysis.contaminated).toBe(true);
      const result = enforceObjectiveBoundaries({
        objectives: [item],
        subTopicProfile: profile(),
      });
      const cleaned = result.cleanedObjectives[0];
      const recheck = analyzeObjectiveItem(cleaned, profile());
      expect(recheck.contaminated).toBe(false);
    }
  });

  test("draft enforcement preserves lesson block structure", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const pages = JSON.parse(JSON.stringify(objectivePages));
    const beforeBlocks = pages[0].blocks.length;
    const { pages: nextPages, changed } = enforceObjectiveBoundariesOnDraft({
      ...STRUCTURE_INPUT,
      pages,
    });
    expect(nextPages[0].blocks.length).toBe(beforeBlocks);
    expect(changed).toBe(true);
    const content = nextPages[0].blocks[0].content;
    expect(content).not.toMatch(/cerebellum|accommodation|thermoregulation/i);
    expect(content).toMatch(/neurone|myelin|CNS|impulses/i);
  });

  test("one-shot prompt includes OBJECTIVE BOUNDARY in mode 1", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const { appendix } = buildOneShotLessonCoveragePlanAppendix({
      ...STRUCTURE_INPUT,
      pages: objectivePages,
    });
    expect(appendix).toMatch(/OBJECTIVE BOUNDARY/);
    expect(appendix).toMatch(/cerebral cortex|cerebellum|thermoregulation/i);
    expect(appendix).toMatch(/neurones|myelin/i);
  });

  test("Coverage Review includes objectiveBoundary metadata", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const review = buildLessonCoverageReview({
      ...STRUCTURE_INPUT,
      pages: objectivePages,
    });
    expect(review.objectiveBoundary).toBeDefined();
    expect(review.objectiveBoundary.outOfScopeObjectiveCount).toBeGreaterThan(0);
    expect(review.objectiveBoundary.replacementItems.length).toBeGreaterThan(0);
  });

  test("analysis does not drop block count on existing lesson", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const pages = JSON.parse(JSON.stringify(objectivePages));
    const before = pages[0].blocks.length;
    buildLessonCoverageReview({ ...STRUCTURE_INPUT, pages });
    expect(pages[0].blocks.length).toBe(before);
  });

  test("formatObjectiveBoundaryAppendix empty when mode 0", () => {
    delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    expect(formatObjectiveBoundaryAppendix(profile(), 0)).toBe("");
  });
});
