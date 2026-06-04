/**
 * Teacher Brain Phase 4 — Lesson Coverage Intelligence.
 */

const { runTeacherBrain } = require("../lib/teacherBrain");
const {
  buildLessonCoverageMap,
  checkCoverageBeforeGeneration,
  applyCoverageToActivityRecommendations,
  COGNITIVE_SKILLS,
} = require("../lib/teacherBrain/lessonCoverageIntelligence");

describe("Teacher Brain Phase 4 — Lesson Coverage Intelligence", () => {
  const metabolismConcepts = runTeacherBrain({ topic: "Metabolism" }).coreConcepts;

  test("buildLessonCoverageMap tracks taught, tested, misconceptions, and exam skills", () => {
    const map = buildLessonCoverageMap({
      coreConcepts: metabolismConcepts,
      pages: [
        {
          blocks: [
            { type: "text", role: "concept", content: "Metabolism is all enzyme-controlled reactions." },
            { type: "checkpoint", question: "Define metabolism in one sentence." },
            { type: "commonmistake", content: "Pupils confuse metabolism with digestion." },
            { type: "examtip", content: "2 mark explain command word." },
            { type: "dragdropmatch", content: "Match ATP and glucose to respiration steps." },
            { type: "checkpoint", question: "Another metabolism checkpoint question." },
            { type: "checkpoint", question: "Third metabolism test on metabolism definition." },
          ],
        },
      ],
      quiz: [{ question: "Which statement about catabolism is correct?" }],
    });

    expect(map.phase).toBe(4);
    expect(map.centralConceptName).toBe("Metabolism");

    const metabolism = map.concepts.find((c) => c.id === "metabolism");
    expect(metabolism.taughtCount).toBeGreaterThanOrEqual(1);
    expect(metabolism.testedCount).toBeGreaterThanOrEqual(2);
    expect(metabolism.misconceptionAddressedCount).toBeGreaterThanOrEqual(1);
    expect(metabolism.isCentral).toBe(true);
    expect(metabolism.isOverTested).toBe(false);

    const catabolism = map.concepts.find((c) => c.id === "catabolism");
    expect(catabolism.testedCount).toBeGreaterThanOrEqual(1);

    expect(map.lessonTotals.tested).toBeGreaterThanOrEqual(3);
    expect(COGNITIVE_SKILLS.every((s) => typeof map.cognitiveSkillBalance[s] === "number")).toBe(
      true
    );
  });

  test("non-central concepts flag isOverTested after multiple checks", () => {
    const map = buildLessonCoverageMap({
      coreConcepts: metabolismConcepts,
      pages: [
        {
          blocks: [
            { type: "checkpoint", question: "ATP energy currency question one." },
            { type: "checkpoint", question: "ATP transfers energy — quick check." },
            { type: "checkpoint", question: "Why do cells use ATP instead of glucose?" },
          ],
        },
      ],
    });
    const atp = map.concepts.find((c) => c.id === "atp");
    expect(atp.testedCount).toBeGreaterThanOrEqual(2);
    expect(atp.isOverTested).toBe(true);
  });

  test("checkCoverageBeforeGeneration deprioritises over-tested concepts", () => {
    const map = buildLessonCoverageMap({
      coreConcepts: metabolismConcepts,
      pages: [
        {
          blocks: [
            { type: "text", content: "ATP transfers energy in cells." },
            { type: "checkpoint", question: "Metabolism definition check." },
            { type: "checkpoint", question: "Metabolism compare question." },
            { type: "checkpoint", question: "Metabolism exam-style recall." },
          ],
        },
      ],
    });

    const slot = checkCoverageBeforeGeneration(map, { generationKind: "checkpoint" });
    expect(slot.allowed).toBe(true);
    expect(slot.conceptId).not.toBe("metabolism");
    expect(COGNITIVE_SKILLS).toContain(slot.cognitiveSkill);
  });

  test("applyCoverageToActivityRecommendations rotates cognitive skills", () => {
    const raw = [
      { activityType: "Multiple Choice", afterConcept: "metabolism", cognitiveLevel: "recall", rationale: "A" },
      { activityType: "Label Diagram", afterConcept: "atp", cognitiveLevel: "understanding", rationale: "B" },
      { activityType: "Exam Practice", afterConcept: "end", cognitiveLevel: "exam thinking", rationale: "C" },
    ];
    const balanced = applyCoverageToActivityRecommendations(raw, null, metabolismConcepts);
    const skills = balanced.map((a) => a.cognitiveSkill).filter(Boolean);
    expect(skills.length).toBe(3);
    expect(new Set(skills).size).toBeGreaterThanOrEqual(2);
    balanced.forEach((a) => {
      expect(a.coverageRationale).toBeTruthy();
    });
  });

  test("runTeacherBrain returns coverageMap on every lesson", () => {
    const brain = runTeacherBrain({ topic: "Metabolism" });
    expect(brain.coverageMap).toBeDefined();
    expect(brain.coverageMap.concepts.length).toBe(brain.coreConcepts.length);
    expect(brain.activityRecommendations[0].cognitiveSkill).toBeTruthy();
  });
});
