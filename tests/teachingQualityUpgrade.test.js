const {
  resolveTeachingQualityProfile,
  HOMEOSTASIS_TEACHING_QUALITY,
} = require("../lib/teacherBrain/teachingQualityProfiles");
const {
  buildReasoningChainPromptSection,
  scoreReasoningChainCoverage,
  isTeachingQualityUpgradeEnabled,
} = require("../lib/teacherBrain/reasoningChainEngine");
const {
  buildExaminerLanguagePromptSection,
  scoreExaminerLanguageCoverage,
} = require("../lib/teacherBrain/examinerLanguageEngine");
const {
  buildTeachingQualityUpgradePromptSection,
  evaluateTeachingQualityUpgrade,
} = require("../lib/teacherBrain/teachingQualityUpgrade");
const {
  TEACHER_FIRST_OPENING_ORDER_VERSION,
  getSs1BlockNumber,
} = require("../lib/teacherBrain/teacherFirstSs1Architecture");

describe("Phase 3H.1.8a — Teaching Quality Upgrade", () => {
  const prevTf = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
  const prevUp = process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE;

  afterEach(() => {
    if (prevTf === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevTf;
    if (prevUp === undefined) delete process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE;
    else process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = prevUp;
  });

  test("opening order version is locked", () => {
    expect(TEACHER_FIRST_OPENING_ORDER_VERSION).toBe("3H.1.6-locked");
  });

  test("upgrade section empty when flag off", () => {
    delete process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE;
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    expect(buildTeachingQualityUpgradePromptSection({ topic: "Homeostasis" })).toBe("");
    expect(isTeachingQualityUpgradeEnabled()).toBe(false);
  });

  test("resolves profiles for acceptance topics", () => {
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";

    expect(resolveTeachingQualityProfile({ topic: "Homeostasis" })?.taxonomyKey).toBe(
      "homeostasis"
    );
    expect(
      resolveTeachingQualityProfile({ topic: "Structure and function of the nervous system" })
        ?.taxonomyKey
    ).toBe("nervous-system-structure");
    expect(resolveTeachingQualityProfile({ topic: "The eye" })?.taxonomyKey).toBe("the-eye");
  });

  test("prompt sections include reasoning and examiner markers", () => {
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";

    const coreModelBlock = getSs1BlockNumber("coreModel");
    const reasoningSection = buildReasoningChainPromptSection({ topic: "Homeostasis" });
    expect(reasoningSection).toMatch(/GCSE REASONING CHAIN ENGINE/);
    expect(reasoningSection).toMatch(/Thermoreceptors/);
    expect(reasoningSection).toMatch(new RegExp(`Block ${coreModelBlock} \\(CORE MODEL\\)`));
    expect(reasoningSection).toMatch(/→/);

    const coreTeachingBlock = getSs1BlockNumber("coreTeaching");
    const examinerSection = buildExaminerLanguagePromptSection({ topic: "Homeostasis" });
    expect(examinerSection).toMatch(/EXAMINER LANGUAGE ENGINE/);
    expect(examinerSection).toMatch(/Students often write/);
    expect(examinerSection).toMatch(new RegExp(`Block ${coreTeachingBlock} \\(CORE TEACHING\\)`));

    const combined = buildTeachingQualityUpgradePromptSection({ topic: "Homeostasis" });
    expect(combined).toMatch(/REASONING CHAIN/);
    expect(combined).toMatch(/EXAMINER LANGUAGE/);
  });

  test("requires teacher-first flag for prompt sections", () => {
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    expect(buildReasoningChainPromptSection({ topic: "Homeostasis" })).toBe("");
  });

  test("scores reasoning and examiner coverage", () => {
    const goodReasoning = `
6 — CORE MODEL
Paste into: Core rule (key idea)

Temperature rises → thermoreceptors detect change → hypothalamus receives information
→ sweat glands activated → evaporation removes heat → temperature returns towards optimum
because enzymes work best at optimum conditions therefore homeostasis is essential.
`;

    const weakReasoning = `
6 — CORE MODEL
Paste into: Core rule (key idea)

Homeostasis keeps conditions stable.
`;

    const goodScore = scoreReasoningChainCoverage(goodReasoning, HOMEOSTASIS_TEACHING_QUALITY);
    expect(goodScore.hasExplicitChain).toBe(true);
    expect(goodScore.pass).toBe(true);

    const weakScore = scoreReasoningChainCoverage(weakReasoning, HOMEOSTASIS_TEACHING_QUALITY);
    expect(weakScore.pass).toBe(false);

    const goodExaminer = `
9 — CORE TEACHING
Paste into: Text (concept)

<p>Examiners expect named receptors and effectors.</p>
<p>In the exam, say thermoreceptors detect a change.</p>

15 — COMMON MISTAKE
Paste into: Common mistake

<p>Students often write "the body gets too hot so it sweats."</p>
<p>Weak answer: sweating cools you down.</p>
`;

    const examScore = scoreExaminerLanguageCoverage(goodExaminer);
    expect(examScore.distinctPatterns).toBeGreaterThanOrEqual(3);
    expect(examScore.pass).toBe(true);

    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    const evalGood = evaluateTeachingQualityUpgrade(goodReasoning + goodExaminer, {
      topic: "Homeostasis",
    });
    expect(evalGood.profileKey).toBe("homeostasis");
    expect(evalGood.gate).toBeDefined();
  });
});
