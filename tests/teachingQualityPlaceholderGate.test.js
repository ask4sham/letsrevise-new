const {
  NERVOUS_SYSTEM_TEACHING_QUALITY,
  resolveTeachingQualityProfile,
} = require("../lib/teacherBrain/teachingQualityProfiles");
const {
  detectUnresolvedPlaceholders,
  detectDualOutput,
  validateOpeningSlots,
  evaluateTeachingQualityGate,
} = require("../lib/teacherBrain/teachingQualityPlaceholderGate");
const {
  buildTeacherFirstOpeningPlan,
  buildSs1Layer2MandatoryOpeningSection,
} = require("../lib/teacherBrain/teacherFirstKnowledgeEngine");
const { buildSs1AntiDuplicationPromptSection } = require("../lib/teacherBrain/teacherFirstSs1Architecture");

describe("Phase 3H.1.8a.1 — placeholder gate and Layer 2", () => {
  const prevTf = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;

  afterEach(() => {
    if (prevTf === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevTf;
  });

  test("detects unresolved bracket placeholders", () => {
    const bad = `
5 — CORE MODEL
<p>[The key GCSE model or pathway for Homeostasis]</p>
<li>[example 1 for Homeostasis]</li>
<p><strong>[term 1]</strong></p>
`;
    const good = `
5 — CORE MODEL
<p>Stimulus → Receptor → Sensory neurone → CNS → Motor neurone → Effector → Response</p>
`;
    expect(detectUnresolvedPlaceholders(bad).pass).toBe(false);
    expect(detectUnresolvedPlaceholders(good).pass).toBe(true);
  });

  test("detects dual-output preamble", () => {
    const dual = `LESSON OBJECTIVE FIELD: Learn homeostasis
<h2><strong>Core model</strong></h2>
<p>Receptor pathway here</p>
1 — LESSON OBJECTIVES
Paste into: Text (concept)
`;
    const single = `LESSON OBJECTIVE FIELD: Learn homeostasis
SHORT SUMMARY FIELD: Summary
<strong>Homeostasis – Organisation (AQA KS4 - GCSE)</strong>
1 — LESSON OBJECTIVES
Paste into: Text (concept)
`;
    expect(detectDualOutput(dual).pass).toBe(false);
    expect(detectDualOutput(single).pass).toBe(true);
  });

  test("validates nervous system opening slots", () => {
    const good = `
5 — CORE MODEL
Stimulus → Receptor → Sensory neurone → CNS → Motor neurone → Effector → Response
6 — KEY EXAMPLES
Reflex actions, withdrawal reflex, touch receptors, light receptors, temperature receptors
7 — EXAM VOCABULARY
receptor, sensory neurone, relay neurone, motor neurone, synapse, CNS, PNS, effector, response, stimulus
`;
    const result = validateOpeningSlots(good, NERVOUS_SYSTEM_TEACHING_QUALITY);
    expect(result.pass).toBe(true);

    const bad = `
5 — CORE MODEL
[The key GCSE model or pathway for Structure and function of the nervous system]
`;
    expect(validateOpeningSlots(bad, NERVOUS_SYSTEM_TEACHING_QUALITY).pass).toBe(false);
  });

  test("nervous system profile has enriched opening slots", () => {
    const profile = resolveTeachingQualityProfile({
      topic: "Structure and function of the nervous system",
    });
    expect(profile.openingSlots.coreModel).toMatch(/Sensory neurone/);
    expect(profile.openingSlots.keyExamples).toContain("Withdrawal reflex");
    expect(profile.openingSlots.examVocabulary).toContain("synapse");
  });

  test("buildPrompt wiring sections when teacher-first on", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";

    const plan = buildTeacherFirstOpeningPlan({
      topic: "Structure and function of the nervous system",
      topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
      subject: "Biology",
    });
    const mandatory = buildSs1Layer2MandatoryOpeningSection(plan);
    expect(mandatory).toMatch(/MANDATORY OPENING SLOTS/);
    expect(mandatory).toMatch(/Sensory neurone/);
    expect(mandatory).toMatch(/Withdrawal reflex/);
    expect(buildSs1AntiDuplicationPromptSection()).toMatch(/ANTI-DUPLICATION/);
  });

  test("evaluateTeachingQualityGate fails on placeholders", () => {
    const gate = evaluateTeachingQualityGate(
      "5 — CORE MODEL\n[The key GCSE model or pathway for X]",
      { topic: "Structure and function of the nervous system" }
    );
    expect(gate.pass).toBe(false);
    expect(gate.placeholders.pass).toBe(false);
  });
});
