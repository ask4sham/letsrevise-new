/**
 * Coverage-gated generation — reflex arc and balance tests (Phase 4 enforcement).
 */

const { runTeacherBrain } = require("../lib/teacherBrain");
const {
  createCoverageGenerationGate,
  planCoverageGatedQuestion,
  planCoverageGatedQuestionBatch,
} = require("../lib/teacherBrain/coverageGatedGeneration");
const { buildLessonCoverageMap } = require("../lib/teacherBrain/lessonCoverageIntelligence");

describe("Coverage-gated generation (Phase 4 enforcement)", () => {
  const reflexLessonPages = [
    {
      blocks: [
        {
          type: "dragdropmatch",
          content: "Order the reflex arc pathway: receptor sensory neurone relay motor effector.",
        },
        {
          type: "interactivesequence",
          content: "Step by step reflex arc pathway sequence stimulus to effector.",
        },
        {
          type: "checkpoint",
          question: "Recall the reflex arc pathway order.",
        },
        {
          type: "checkpoint",
          question: "Another reflex arc pathway recall question.",
        },
      ],
    },
  ];

  test("reflex_arc_pathway tested twice must not be selected for another recall checkpoint", () => {
    const brain = runTeacherBrain({ topic: "Nervous system reflex arc" });
    const gate = createCoverageGenerationGate({
      topic: "Nervous system",
      pages: reflexLessonPages,
      coreConcepts: brain.coreConcepts,
      misconceptions: brain.misconceptions,
    });

    const pathway = gate.coverageMap.concepts.find((c) => c.id === "reflex_arc_pathway");
    expect(pathway.testedCount).toBeGreaterThanOrEqual(2);
    expect(pathway.isOverTested).toBe(false);

    const { diagnostic } = planCoverageGatedQuestion(gate, { generationKind: "checkpoint" });
    expect(diagnostic.conceptId).not.toBe("reflex_arc_pathway");
    expect(diagnostic.reasonSelected).toMatch(/lowest coverage|Prefer/i);
  });

  test("practice batch prefers lower-coverage concepts across the lesson", () => {
    const brain = runTeacherBrain({ topic: "Nervous system" });
    const gate = createCoverageGenerationGate({
      topic: "Nervous system",
      pages: reflexLessonPages,
      coreConcepts: brain.coreConcepts,
    });

    const plans = planCoverageGatedQuestionBatch(gate, 4, "practice");
    const conceptIds = plans.map((p) => p.diagnostic.conceptId).filter(Boolean);
    expect(new Set(conceptIds).size).toBeGreaterThanOrEqual(2);
    const pathwayCount = conceptIds.filter((id) => id === "reflex_arc_pathway").length;
    expect(pathwayCount).toBeLessThanOrEqual(1);
  });

  test("quiz batch rotates cognitive skills", () => {
    const brain = runTeacherBrain({ topic: "Metabolism" });
    const gate = createCoverageGenerationGate({
      topic: "Metabolism",
      coreConcepts: brain.coreConcepts,
    });
    const plans = planCoverageGatedQuestionBatch(gate, 5, "quiz");
    const skills = plans.map((p) => p.diagnostic.cognitiveSkill);
    expect(new Set(skills).size).toBeGreaterThanOrEqual(2);
  });

  test("flashcards should not all target the same concept", () => {
    const brain = runTeacherBrain({ topic: "Nervous system" });
    const gate = createCoverageGenerationGate({
      topic: "Nervous system",
      pages: reflexLessonPages,
      coreConcepts: brain.coreConcepts,
    });
    const plans = planCoverageGatedQuestionBatch(gate, 4, "retrieval");
    const ids = plans.map((p) => p.diagnostic.conceptId).filter(Boolean);
    expect(new Set(ids).size).toBeGreaterThanOrEqual(2);
  });

  test("central concept may appear more often but non-central concepts should not dominate", () => {
    const brain = runTeacherBrain({ topic: "Nervous system" });
    const map = buildLessonCoverageMap({
      pages: reflexLessonPages,
      coreConcepts: brain.coreConcepts,
    });
    const central = map.concepts.find((c) => c.id === map.centralConceptId);
    expect(central.id).toBe("reflex_arc_pathway");

    const gate = createCoverageGenerationGate({
      topic: "Nervous system",
      pages: reflexLessonPages,
      coreConcepts: brain.coreConcepts,
    });
    planCoverageGatedQuestionBatch(gate, 6, "quiz");

    const pathwayRow = gate.working.concepts.find((c) => c.id === "reflex_arc_pathway");
    const othersTested = gate.working.concepts
      .filter((c) => c.id !== "reflex_arc_pathway" && c.testedCount > 0)
      .reduce((s, c) => s + c.testedCount, 0);
    expect(othersTested).toBeGreaterThan(0);
    expect(pathwayRow.dominanceRatio).toBeLessThan(0.85);
  });

  test("each diagnostic includes required audit fields", () => {
    const brain = runTeacherBrain({ topic: "Metabolism" });
    const gate = createCoverageGenerationGate({ topic: "Metabolism", coreConcepts: brain.coreConcepts });
    const { diagnostic } = planCoverageGatedQuestion(gate, { generationKind: "hotspot" });
    expect(diagnostic).toMatchObject({
      conceptId: expect.any(String),
      cognitiveSkill: expect.any(String),
      reasonSelected: expect.any(String),
      avoidedDuplicates: expect.any(Array),
      coverageBefore: expect.any(Array),
      coverageAfter: expect.any(Array),
    });
  });
});
