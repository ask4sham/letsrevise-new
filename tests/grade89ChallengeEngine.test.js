/**
 * Phase 3H.1.8b.3c — Grade 8/9 Challenge unit + non-regression tests.
 */

const {
  buildGrade89ChallengePromptSection,
  scoreGrade89ChallengeCoverage,
  isGrade89ChallengeEnabled,
  GRADE89_CHALLENGE_MARKER,
} = require("../lib/teacherBrain/grade89ChallengeEngine");
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

describe("Phase 3H.1.8b.3c — Grade 8/9 Challenge", () => {
  const prevTf = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
  const prevUp = process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE;
  const prevG89 = process.env.TEACHER_BRAIN_GRADE89_CHALLENGE_V1;

  afterEach(() => {
    if (prevTf === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevTf;
    if (prevUp === undefined) delete process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE;
    else process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = prevUp;
    if (prevG89 === undefined) delete process.env.TEACHER_BRAIN_GRADE89_CHALLENGE_V1;
    else process.env.TEACHER_BRAIN_GRADE89_CHALLENGE_V1 = prevG89;
  });

  test("Challenge disabled by default — no appendix change", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    delete process.env.TEACHER_BRAIN_GRADE89_CHALLENGE_V1;
    expect(isGrade89ChallengeEnabled()).toBe(false);
    expect(
      buildGrade89ChallengePromptSection({ topic: "Structure and function of the nervous system" })
    ).toBe("");
  });

  test("Challenge appendix includes rules and topic stems when flag on", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    process.env.TEACHER_BRAIN_GRADE89_CHALLENGE_V1 = "1";

    const section = buildGrade89ChallengePromptSection({
      topic: "Structure and function of the nervous system",
    });
    expect(section).toMatch(GRADE89_CHALLENGE_MARKER);
    expect(section).toMatch(/CHALLENGE RULES/);
    expect(section).toMatch(/Compare the roles of sensory, relay and motor neurones/i);
    expect(section).toMatch(/not simple recall/i);
    expect(section).toMatch(/no new blocks/i);
    expect(section).toMatch(/examiner-grade language/i);
  });

  test("scores strong Grade 8/9 challenge lesson", () => {
    const profile = resolveTeachingQualityProfile({
      topic: "Structure and function of the nervous system",
    });
    const strong = `
6 — CORE MODEL
Paste into: Text (concept)

Stimulus → Receptor → Sensory neurone → CNS → Motor neurone → Effector → Response

9 — CORE TEACHING
Paste into: Text (concept)

The nervous system coordinates responses through electrical impulses.

**Grade 8/9 challenge**
Compare the roles of sensory, relay and motor neurones in producing a coordinated response. Sensory neurones carry electrical impulses to the CNS whereas motor neurones transmit to effectors. Therefore coordination requires both pathways — evaluate which pathway is more critical for reflex speed.

17 — WORKED EXAMPLE
Paste into: Worked example (checkpoint)

Explain why myelinated neurones transmit faster — evaluate the survival advantage because saltatory conduction increases transmission speed.

22 — EXAM PRACTICE
Paste into: Exam practice

Evaluate whether a reflex arc through the spinal cord is always faster than a conscious response through the brain. Justify using evidence about synapse delays.

23 — SUMMARY
Paste into: Text (concept)

Grade 8/9: Compare electrical transmission along neurones with chemical transmission across synapses.
`;
    const score = scoreGrade89ChallengeCoverage(strong, profile);
    expect(score.pass).toBe(true);
    expect(score.signals.challengeBlockCount).toBeGreaterThanOrEqual(1);
    expect(score.signals.commandCount).toBeGreaterThanOrEqual(2);
    expect(score.signals.criteriaHits).toBeGreaterThanOrEqual(2);
  });

  test("fails recall-only challenge stems", () => {
    const profile = resolveTeachingQualityProfile({ topic: "Homeostasis" });
    const weak = `
9 — CORE TEACHING
Paste into: Text (concept)

State the function of thermoreceptors.

23 — SUMMARY
Paste into: Text (concept)

Remember homeostasis.
`;
    const score = scoreGrade89ChallengeCoverage(weak, profile);
    expect(score.pass).toBe(false);
    expect(score.violations.length).toBeGreaterThan(0);
  });

  test("combined teaching quality prompt includes Grade 8/9 when flag on", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    process.env.TEACHER_BRAIN_GRADE89_CHALLENGE_V1 = "1";

    const combined = buildTeachingQualityUpgradePromptSection({ topic: "Homeostasis" });
    expect(combined).toMatch(/GRADE 8\/9 CHALLENGE/);
    expect(combined).toMatch(/negative feedback/i);
  });
});

describe("Phase 3H.1.8b.3c — structural non-regression", () => {
  const prevTf = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;

  afterEach(() => {
    if (prevTf === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevTf;
  });

  test("Teacher-First opening order version unchanged", () => {
    expect(TEACHER_FIRST_OPENING_ORDER_VERSION).toBe("3H.1.6-locked");
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
