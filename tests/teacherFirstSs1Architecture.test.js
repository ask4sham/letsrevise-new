/**
 * Phase 3H.1.5 — Teacher-first SS1 structural enforcement tests.
 */

const {
  getSs1CanonicalSlots,
  getMandatoryArchitectureSequence,
  getFoundationSlots,
  getSs1BlockNumber,
  buildSs1BlockOrderPromptSection,
  TEACHER_FIRST_SS1_CANONICAL_SLOTS,
  CLASSIC_SS1_CANONICAL_SLOTS,
} = require("../lib/teacherBrain/teacherFirstSs1Architecture");
const {
  scoreTeacherFirstOpeningCoverage,
  buildTeacherFirstOpeningPlan,
} = require("../lib/teacherBrain/teacherFirstKnowledgeEngine");
// buildTeacherFirstOpeningPlan used for profile acceptance tests
const { HOMEOSTASIS_OPENING } = require("../lib/teacherBrain/teacherFirstKnowledgeProfiles");

function slotTitles() {
  return getSs1CanonicalSlots().map((s) => s.title);
}

describe("teacherFirstSs1Architecture (Phase 3H.1.5)", () => {
  const prevFlag = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevFlag;
  });

  test("flag off keeps classic 20-block SS1 order with scenario at block 3", () => {
    delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    expect(getSs1CanonicalSlots()).toHaveLength(20);
    expect(slotTitles()[2]).toBe("SCENARIO");
    expect(slotTitles()[3]).toBe("CORE RULE");
    expect(getSs1BlockNumber("scenario")).toBe(3);
  });

  test("flag on uses 24-block teacher-first order with scenario at block 8", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    expect(getSs1CanonicalSlots()).toHaveLength(24);
    expect(slotTitles().slice(0, 9)).toEqual([
      "REVISION OBJECTIVES",
      "PRIOR KNOWLEDGE",
      "DEFINITION",
      "WHY IT MATTERS",
      "CORE MODEL",
      "KEY EXAMPLES",
      "EXAM VOCABULARY",
      "SCENARIO",
      "CORE TEACHING",
    ]);
    expect(getSs1BlockNumber("scenario")).toBe(8);
    expect(getFoundationSlots()).toEqual([
      "objectives",
      "priorKnowledge",
      "definition",
      "whyItMatters",
      "coreModel",
      "keyExamples",
      "examVocabulary",
      "scenario",
    ]);
  });

  test("SS1 prompt section places definition before scenario when flag on", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const section = buildSs1BlockOrderPromptSection({ topic: "Homeostasis" });
    const defPos = section.indexOf("3 — DEFINITION");
    const scenarioPos = section.indexOf("8 — SCENARIO");
    expect(defPos).toBeGreaterThan(-1);
    expect(scenarioPos).toBeGreaterThan(defPos);
    expect(section).toMatch(/Do NOT put Scenario before Definition/);
    expect(section).not.toMatch(/3 — SCENARIO/);
  });

  test("nervous system and eye profiles use same structural order", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const { NERVOUS_SYSTEM_STRUCTURE_OPENING, THE_EYE_OPENING } = require("../lib/teacherBrain/teacherFirstKnowledgeProfiles");
    const nervousPlan = buildTeacherFirstOpeningPlan({
      profile: NERVOUS_SYSTEM_STRUCTURE_OPENING,
      topicKey: "aqa-gcse-biology:nervous-system-structure",
    });
    const eyePlan = buildTeacherFirstOpeningPlan({
      profile: THE_EYE_OPENING,
      topicKey: "aqa-gcse-biology:the-eye",
    });
    expect(nervousPlan.coreModel).toMatch(/Stimulus/);
    expect(eyePlan.coreModel).toBe("Cornea → Lens → Retina");
    expect(getSs1BlockNumber("scenario")).toBe(8);
    expect(getSs1BlockNumber("coreModel")).toBe(5);
  });

  test("homeostasis profile ordering passes scenarioBeforeCoreKnowledge check", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const plan = buildTeacherFirstOpeningPlan({
      profile: HOMEOSTASIS_OPENING,
      topicKey: "aqa-gcse-biology:homeostasis",
      subTopic: "Homeostasis",
    });
    const pages = [
      {
        blocks: [
          { type: "text", title: "REVISION OBJECTIVES", content: "Revision objectives" },
          { type: "text", title: "PRIOR KNOWLEDGE", content: "Prior knowledge" },
          { type: "text", title: "DEFINITION", content: plan.definition },
          { type: "text", title: "WHY IT MATTERS", content: plan.whyItMatters },
          { type: "keyIdea", title: "CORE MODEL", content: plan.coreModel },
          { type: "text", title: "KEY EXAMPLES", content: plan.keyExamples.join(" ") },
          { type: "text", title: "EXAM VOCABULARY", content: plan.examVocabulary.join(" ") },
          { type: "text", title: "SCENARIO", content: "A runner sweats after exercise." },
        ],
      },
    ];
    const score = scoreTeacherFirstOpeningCoverage({ plan, pages });
    expect(score.scenarioBeforeCoreKnowledge).toBe(false);
    expect(score.openingScorePct).toBeGreaterThan(50);
  });

  test("scenario before core knowledge is flagged and heavily penalised", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const plan = buildTeacherFirstOpeningPlan({ profile: HOMEOSTASIS_OPENING });
    const score = scoreTeacherFirstOpeningCoverage({
      plan,
      pages: [
        {
          blocks: [
            { type: "text", title: "SCENARIO", content: "Imagine you jog to school..." },
            { type: "text", title: "DEFINITION", content: "Homeostasis regulates internal conditions." },
          ],
        },
      ],
    });
    expect(score.scenarioBeforeCoreKnowledge).toBe(true);
    expect(score.flags).toContain("Scenario before core knowledge");
    expect(score.openingScorePct).toBeLessThanOrEqual(25);
  });

  test("mandatory architecture sequence includes knowledge slots before scenario", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const seq = getMandatoryArchitectureSequence();
    expect(seq.indexOf("definition")).toBeLessThan(seq.indexOf("scenario"));
    expect(seq.indexOf("examVocabulary")).toBeLessThan(seq.indexOf("scenario"));
    expect(TEACHER_FIRST_SS1_CANONICAL_SLOTS.length).toBe(24);
    expect(CLASSIC_SS1_CANONICAL_SLOTS.length).toBe(20);
  });
});
