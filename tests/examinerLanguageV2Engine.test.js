/**
 * Phase 3H.1.8b.3b — Examiner Language V2 unit + non-regression tests.
 */

const {
  buildExaminerLanguageV2PromptSection,
  scoreExaminerLanguageV2Coverage,
  isExaminerLanguageV2Enabled,
  EXAMINER_LANGUAGE_V2_MARKER,
  V2_TARGET_BLOCK_KEYS,
  extractBlockBodiesByPatterns,
} = require("../lib/teacherBrain/examinerLanguageV2Engine");
const { resolveTeachingQualityProfile } = require("../lib/teacherBrain/teachingQualityProfiles");
const {
  buildTeachingQualityUpgradePromptSection,
} = require("../lib/teacherBrain/teachingQualityUpgrade");
const {
  TEACHER_FIRST_OPENING_ORDER_VERSION,
  getSs1CanonicalSlots,
} = require("../lib/teacherBrain/teacherFirstSs1Architecture");
const {
  REQUIRED_PRACTICAL_MODE_VERSION,
  REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS,
} = require("../lib/teacherBrain/requiredPracticalMode");

describe("Phase 3H.1.8b.3b — Examiner Language V2", () => {
  const prevTf = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
  const prevUp = process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE;
  const prevV2 = process.env.TEACHER_BRAIN_EXAMINER_LANGUAGE_V2;

  afterEach(() => {
    if (prevTf === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevTf;
    if (prevUp === undefined) delete process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE;
    else process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = prevUp;
    if (prevV2 === undefined) delete process.env.TEACHER_BRAIN_EXAMINER_LANGUAGE_V2;
    else process.env.TEACHER_BRAIN_EXAMINER_LANGUAGE_V2 = prevV2;
  });

  test("V2 disabled by default — no appendix change", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    delete process.env.TEACHER_BRAIN_EXAMINER_LANGUAGE_V2;
    expect(isExaminerLanguageV2Enabled()).toBe(false);
    expect(
      buildExaminerLanguageV2PromptSection({ topic: "Structure and function of the nervous system" })
    ).toBe("");
  });

  test("V2 targets only four blocks — not Summary or Exam Practice", () => {
    expect(V2_TARGET_BLOCK_KEYS).toEqual([
      "coreTeaching",
      "commonMistake",
      "examTechnique",
      "workedExample",
    ]);

    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    process.env.TEACHER_BRAIN_EXAMINER_LANGUAGE_V2 = "1";

    const section = buildExaminerLanguageV2PromptSection({
      topic: "Structure and function of the nervous system",
    });
    expect(section).toMatch(EXAMINER_LANGUAGE_V2_MARKER);
    expect(section).toMatch(/FOUR blocks/i);
    expect(section).toMatch(/Students often write/i);
    expect(section).toMatch(/Examiners expect/i);
    expect(section).toMatch(/Do not say/i);
    expect(section).toMatch(/Creditworthy answer/i);
    expect(section).toMatch(/To gain full marks/i);
    expect(section).toMatch(/electrical impulses/i);
    expect(section).toMatch(/DO NOT add, remove, or reorder blocks/i);
    expect(section).toMatch(/Do NOT modify Summary, Exam Practice/i);
    expect(section).not.toMatch(/SUMMARY takeaway/i);
    expect(section).not.toMatch(/EXAM PRACTICE model answers/i);
    expect(section).not.toMatch(/EXAM TIP/i);
  });

  test("extractBlockBodies ignores Summary and Exam Practice", () => {
    const text = `
9 — CORE TEACHING
Paste into: Text (concept)
Core content here.

15 — COMMON MISTAKE
Paste into: Common mistake
Mistake content.

23 — SUMMARY
Paste into: Text (concept)
Summary text.

19 — EXAM PRACTICE
Paste into: Text (concept)
Practice text.
`;
    const bodies = extractBlockBodiesByPatterns(text);
    expect(bodies.coreTeaching).toBeTruthy();
    expect(bodies.commonMistake).toBeTruthy();
    expect(bodies.summary).toBeUndefined();
    expect(bodies.examPractice).toBeUndefined();
  });

  test("scores strong examiner-grade lesson language in target blocks only", () => {
    const profile = resolveTeachingQualityProfile({
      topic: "Structure and function of the nervous system",
    });
    const strong = `
9 — CORE TEACHING
Paste into: Text (concept)

The nervous system coordinates responses through electrical impulses transmitted along neurones because receptors detect stimuli.

15 — COMMON MISTAKE
Paste into: Common mistake

Students often write: Messages travel through nerves.
Correct: Electrical impulses travel along sensory and motor neurones.

16 — EXAM TECHNIQUE
Paste into: Exam technique (exam skill)

Examiners expect named neurones and impulse direction. To gain full marks: link stimulus to effector.

17 — WORKED EXAMPLE
Paste into: Worked example (checkpoint)

Step 1 Observation: Mean reaction time decreased from 260 ms to 240 ms.
Step 2 Data: Repeated trials show a consistent decrease.
Step 3 Explanation: Caffeine acts as a stimulant affecting nervous transmission because it increases impulse transmission.
Step 4 Conclusion: Therefore the data supports faster responses.

23 — SUMMARY
Paste into: Text (concept)

Remember this.
`;
    const score = scoreExaminerLanguageV2Coverage(strong, profile);
    expect(score.pass).toBe(true);
    expect(score.signals.scientificVerbCount).toBeGreaterThanOrEqual(2);
    expect(score.signals.connectiveCount).toBeGreaterThanOrEqual(2);
    expect(score.signals.examinerFramingCount).toBeGreaterThanOrEqual(2);
    expect(score.signals.targetBlockCount).toBe(4);
  });

  test("fails vague student-friendly wording in target blocks", () => {
    const profile = resolveTeachingQualityProfile({ topic: "Homeostasis" });
    const weak = `
9 — CORE TEACHING
Paste into: Text (concept)

The body needs to get cool so it helps you sweat.
`;
    const score = scoreExaminerLanguageV2Coverage(weak, profile);
    expect(score.pass).toBe(false);
    expect(score.violations.length).toBeGreaterThan(0);
  });

  test("combined teaching quality prompt includes V2 when flag on", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    process.env.TEACHER_BRAIN_EXAMINER_LANGUAGE_V2 = "1";

    const combined = buildTeachingQualityUpgradePromptSection({ topic: "Homeostasis" });
    expect(combined).toMatch(/EXAMINER LANGUAGE V2/);
  });
});

describe("Phase 3H.1.8b.3b — structural non-regression", () => {
  const prevTf = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;

  afterEach(() => {
    if (prevTf === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevTf;
  });

  test("Teacher-First opening order version unchanged", () => {
    expect(TEACHER_FIRST_OPENING_ORDER_VERSION).toBe("3H.1.6-locked");
  });

  test("Definition and Scenario slots present when Teacher-First flag on", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const slots = getSs1CanonicalSlots({ topic: "Homeostasis" });
    expect(slots.find((s) => s.key === "definition")).toBeTruthy();
    expect(slots.find((s) => s.key === "scenario")).toBeTruthy();
    expect(slots.find((s) => s.key === "summary")).toBeTruthy();
    expect(slots.find((s) => s.key === "keywords")).toBeTruthy();
  });

  test("Required Practical V2.2 baseline slot count unchanged", () => {
    expect(REQUIRED_PRACTICAL_MODE_VERSION).toBe("V2.2");
    expect(REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS).toHaveLength(19);
    expect(REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS.map((s) => s.key)).toContain("equipment");
    expect(REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS.map((s) => s.key)).toContain("variablesMatch");
  });

  test("Teacher-First SS1 slot count unchanged when flag on", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const slots = getSs1CanonicalSlots({ topic: "Homeostasis" });
    expect(slots.length).toBeGreaterThanOrEqual(24);
    expect(slots[0].key).toBe("objectives");
    expect(slots.some((s) => s.key === "coreTeaching")).toBe(true);
    expect(slots.some((s) => s.key === "summary")).toBe(true);
    expect(slots.some((s) => s.key === "keywords")).toBe(true);
  });

  test("RP SS1 slot count unchanged", () => {
    const slots = getSs1CanonicalSlots({
      topic: "Required Practical: Reaction time",
      topicKey: "aqa-gcse-biology:rp-reaction-time",
    });
    expect(slots).toHaveLength(19);
    expect(slots[6].title).toBe("VARIABLES MATCHING ACTIVITY");
    expect(slots[7].title).toBe("EQUIPMENT");
  });
});
