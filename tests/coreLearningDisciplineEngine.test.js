/**
 * Phase 3H.1.8b.3d — Core Learning Discipline V1 unit + non-regression tests.
 */

const {
  buildCoreLearningDisciplinePromptSection,
  scoreCoreLearningDiscipline,
  isCoreLearningDisciplineEnabled,
  CORE_LEARNING_DISCIPLINE_MARKER,
} = require("../lib/teacherBrain/coreLearningDisciplineEngine");
const { resolveTeachingQualityProfile } = require("../lib/teacherBrain/teachingQualityProfiles");
const {
  buildTeachingQualityUpgradePromptSection,
} = require("../lib/teacherBrain/teachingQualityUpgrade");
const {
  buildGrade89ChallengePromptSection,
  GRADE89_CHALLENGE_MARKER,
} = require("../lib/teacherBrain/grade89ChallengeEngine");
const {
  TEACHER_FIRST_OPENING_ORDER_VERSION,
  getSs1CanonicalSlots,
} = require("../lib/teacherBrain/teacherFirstSs1Architecture");
const {
  REQUIRED_PRACTICAL_MODE_VERSION,
  REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS,
} = require("../lib/teacherBrain/requiredPracticalMode");
const {
  EXAMINER_LANGUAGE_V2_MARKER,
  buildExaminerLanguageV2PromptSection,
} = require("../lib/teacherBrain/examinerLanguageV2Engine");

describe("Phase 3H.1.8b.3d — Core Learning Discipline V1", () => {
  const prevTf = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
  const prevUp = process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE;
  const prevCld = process.env.TEACHER_BRAIN_CORE_LEARNING_DISCIPLINE_V1;

  afterEach(() => {
    if (prevTf === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevTf;
    if (prevUp === undefined) delete process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE;
    else process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = prevUp;
    if (prevCld === undefined) delete process.env.TEACHER_BRAIN_CORE_LEARNING_DISCIPLINE_V1;
    else process.env.TEACHER_BRAIN_CORE_LEARNING_DISCIPLINE_V1 = prevCld;
  });

  test("Core Learning Discipline disabled by default — no appendix change", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    delete process.env.TEACHER_BRAIN_CORE_LEARNING_DISCIPLINE_V1;
    expect(isCoreLearningDisciplineEnabled()).toBe(false);
    expect(buildCoreLearningDisciplinePromptSection({ topic: "Homeostasis" })).toBe("");
  });

  test("appendix includes progression rules when flag on", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    process.env.TEACHER_BRAIN_CORE_LEARNING_DISCIPLINE_V1 = "1";

    const section = buildCoreLearningDisciplinePromptSection({ topic: "Homeostasis" });
    expect(section).toMatch(CORE_LEARNING_DISCIPLINE_MARKER);
    expect(section).toMatch(/RULE 1 — NO REPEATED DEFINITIONS/);
    expect(section).toMatch(/Definition → Mechanism → Application → Evaluation/);
    expect(section).toMatch(/RULE 3 — DIAGRAM COMPLEMENTARITY/);
    expect(section).toMatch(/RULE 4 — SUMMARY DISCIPLINE/);
    expect(section).toMatch(/RULE 5 — EXAM PRACTICE DISCIPLINE/);
    expect(section).toMatch(/negative feedback/);
    expect(section).toMatch(/no new blocks|do NOT add, remove, or reorder blocks/i);
  });

  test("topic profiles exist for Homeostasis, Nervous System, and The Eye", () => {
    for (const topic of [
      "Homeostasis",
      "Structure and function of the nervous system",
      "The eye",
    ]) {
      const profile = resolveTeachingQualityProfile({ topic });
      expect(profile?.coreLearningDiscipline?.canonicalTerms?.length).toBeGreaterThan(3);
      expect(profile?.coreLearningDiscipline?.progressionMap).toBeTruthy();
    }
  });

  test("disciplined lesson passes redundancy scorer", () => {
    const profile = resolveTeachingQualityProfile({ topic: "Homeostasis" });
    const disciplined = `
5 — DEFINITION
Paste into: Text (concept)

Homeostasis is defined as the maintenance of a constant internal environment.

6 — CORE MODEL
Paste into: Text (concept)

Receptors → Coordination centre → Effectors

9 — CORE TEACHING
Paste into: Text (concept)

When core temperature rises, thermoreceptors detect the change because the optimum is exceeded. The hypothalamus coordinates sweating therefore heat loss increases by evaporation.

10 — VISUAL EXPLANATION
Paste into: Diagram

Notice the feedback loop: receptors detect change, the coordination centre responds, and effectors restore optimum conditions.

17 — WORKED EXAMPLE
Paste into: Worked example (checkpoint)

During exercise, core temperature rose to 38°C. For example, sweating increased therefore evaporation removed heat energy.

22 — EXAM PRACTICE
Paste into: Exam practice

Evaluate whether sweating alone controls body temperature during exercise. Explain how thermoreceptors and effectors provide evidence.

23 — SUMMARY
Paste into: Text (concept)

Examiner takeaway: negative feedback restores optimum conditions. Full marks require named receptors, coordination centre, and effectors.
`;
    const score = scoreCoreLearningDiscipline(disciplined, profile);
    expect(score.pass).toBe(true);
    expect(score.disciplineScore).toBeGreaterThanOrEqual(70);
    expect(score.signals.repeatedDefinitionCount).toBe(0);
  });

  test("repetitive lesson fails redundancy scorer", () => {
    const profile = resolveTeachingQualityProfile({
      topic: "Structure and function of the nervous system",
    });
    const repetitive = `
5 — DEFINITION
Paste into: Text (concept)

A sensory neurone is defined as a neurone that carries impulses to the CNS.

9 — CORE TEACHING
Paste into: Text (concept)

A sensory neurone is defined as a neurone that carries impulses to the CNS because it detects stimuli.

17 — WORKED EXAMPLE
Paste into: Worked example (checkpoint)

Sensory neurones carry impulses to the CNS because receptors detect stimuli therefore motor neurones respond.

22 — EXAM PRACTICE
Paste into: Exam practice

State the function of a sensory neurone.

23 — SUMMARY
Paste into: Text (concept)

A sensory neurone is defined as a neurone that carries impulses to the CNS. Receptors detect stimuli. Motor neurones carry impulses to effectors.
`;
    const score = scoreCoreLearningDiscipline(repetitive, profile);
    expect(score.pass).toBe(false);
    expect(score.violations.length).toBeGreaterThan(0);
    expect(score.signals.repeatedDefinitionCount).toBeGreaterThan(0);
  });

  test("combined teaching quality prompt includes Core Learning Discipline when flag on", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    process.env.TEACHER_BRAIN_CORE_LEARNING_DISCIPLINE_V1 = "1";

    const combined = buildTeachingQualityUpgradePromptSection({ topic: "The eye" });
    expect(combined).toMatch(/CORE LEARNING DISCIPLINE V1/);
    expect(combined).toMatch(/accommodation/i);
  });
});

describe("Phase 3H.1.8b.3d — non-regression (protected baselines unchanged)", () => {
  const prevTf = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
  const prevUp = process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE;
  const prevG89 = process.env.TEACHER_BRAIN_GRADE89_CHALLENGE_V1;
  const prevElv2 = process.env.TEACHER_BRAIN_EXAMINER_LANGUAGE_V2;
  const prevCld = process.env.TEACHER_BRAIN_CORE_LEARNING_DISCIPLINE_V1;

  afterEach(() => {
    if (prevTf === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevTf;
    if (prevUp === undefined) delete process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE;
    else process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = prevUp;
    if (prevG89 === undefined) delete process.env.TEACHER_BRAIN_GRADE89_CHALLENGE_V1;
    else process.env.TEACHER_BRAIN_GRADE89_CHALLENGE_V1 = prevG89;
    if (prevElv2 === undefined) delete process.env.TEACHER_BRAIN_EXAMINER_LANGUAGE_V2;
    else process.env.TEACHER_BRAIN_EXAMINER_LANGUAGE_V2 = prevElv2;
    if (prevCld === undefined) delete process.env.TEACHER_BRAIN_CORE_LEARNING_DISCIPLINE_V1;
    else process.env.TEACHER_BRAIN_CORE_LEARNING_DISCIPLINE_V1 = prevCld;
  });

  test("Teacher-First opening order version unchanged", () => {
    expect(TEACHER_FIRST_OPENING_ORDER_VERSION).toBe("3H.1.6-locked");
  });

  test("Required Practical V2.2 baseline slot count unchanged", () => {
    expect(REQUIRED_PRACTICAL_MODE_VERSION).toBe("V2.2");
    expect(REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS).toHaveLength(19);
  });

  test("Grade 8/9 Challenge appendix unchanged when only CLD flag added", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    process.env.TEACHER_BRAIN_GRADE89_CHALLENGE_V1 = "1";
    process.env.TEACHER_BRAIN_CORE_LEARNING_DISCIPLINE_V1 = "1";

    const g89 = buildGrade89ChallengePromptSection({
      topic: "Structure and function of the nervous system",
    });
    expect(g89).toMatch(GRADE89_CHALLENGE_MARKER);
    expect(g89).toMatch(/CHALLENGE RULES/);
    expect(g89).not.toMatch(/CORE LEARNING DISCIPLINE/);
  });

  test("Examiner Language V2 appendix unchanged when only CLD flag added", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    process.env.TEACHER_BRAIN_EXAMINER_LANGUAGE_V2 = "1";
    process.env.TEACHER_BRAIN_CORE_LEARNING_DISCIPLINE_V1 = "1";

    const elv2 = buildExaminerLanguageV2PromptSection({ topic: "Homeostasis" });
    expect(elv2).toMatch(EXAMINER_LANGUAGE_V2_MARKER);
    expect(elv2).not.toMatch(/CORE LEARNING DISCIPLINE/);
  });

  test("Teacher-First SS1 slot count unchanged when flag on", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const slots = getSs1CanonicalSlots({ topic: "Homeostasis" });
    expect(slots.length).toBeGreaterThanOrEqual(24);
    expect(slots[0].key).toBe("objectives");
  });

  test("RP SS1 slot count unchanged", () => {
    const slots = getSs1CanonicalSlots({
      topic: "Required Practical: Reaction time",
      topicKey: "aqa-gcse-biology:rp-reaction-time",
    });
    expect(slots).toHaveLength(19);
    expect(slots[6].title).toBe("VARIABLES MATCHING ACTIVITY");
  });
});
