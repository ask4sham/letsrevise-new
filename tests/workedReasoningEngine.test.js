/**
 * Phase 3H.1.8b.3a — Worked Reasoning V2 unit tests.
 */

const {
  buildWorkedReasoningPromptSection,
  scoreWorkedReasoningCoverage,
  isWorkedReasoningV2Enabled,
  WORKED_REASONING_MARKER,
} = require("../lib/teacherBrain/workedReasoningEngine");
const { resolveTeachingQualityProfile } = require("../lib/teacherBrain/teachingQualityProfiles");
const {
  buildTeachingQualityUpgradePromptSection,
} = require("../lib/teacherBrain/teachingQualityUpgrade");

describe("Phase 3H.1.8b.3a — Worked Reasoning V2", () => {
  const prevTf = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
  const prevUp = process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE;
  const prevV2 = process.env.TEACHER_BRAIN_WORKED_REASONING_V2;

  afterEach(() => {
    if (prevTf === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevTf;
    if (prevUp === undefined) delete process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE;
    else process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = prevUp;
    if (prevV2 === undefined) delete process.env.TEACHER_BRAIN_WORKED_REASONING_V2;
    else process.env.TEACHER_BRAIN_WORKED_REASONING_V2 = prevV2;
  });

  test("V2 disabled by default — no appendix change", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    delete process.env.TEACHER_BRAIN_WORKED_REASONING_V2;
    expect(isWorkedReasoningV2Enabled()).toBe(false);
    expect(buildWorkedReasoningPromptSection({ topic: "Homeostasis" })).toBe("");
    const combined = buildTeachingQualityUpgradePromptSection({ topic: "Homeostasis" });
    expect(combined).not.toMatch(/WORKED REASONING ENGINE/);
  });

  test("V2 appendix is format-agnostic", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    process.env.TEACHER_BRAIN_WORKED_REASONING_V2 = "1";

    const section = buildWorkedReasoningPromptSection({
      topic: "Structure and function of the nervous system",
    });
    expect(section).toMatch(WORKED_REASONING_MARKER);
    expect(section).toMatch(/because|therefore|so that/i);
    expect(section).not.toMatch(/<ol>/i);
    expect(section).toMatch(/Do NOT require HTML tags/i);
    expect(section).toMatch(/reflex arc/i);
  });

  test("scores strong plain-text worked example", () => {
    const profile = resolveTeachingQualityProfile({
      topic: "Structure and function of the nervous system",
    });
    const strong = `
17 — WORKED EXAMPLE
Paste into: Worked example (checkpoint)

Question: Explain how a reflex arc produces a rapid response to a painful stimulus. (4 marks)

1. Receptors in the skin detect the painful stimulus because they are specialised to respond to damage.
2. Sensory neurones carry electrical impulses to the CNS therefore the signal reaches the spinal cord quickly.
3. Relay neurones pass impulses across synapses so that motor neurones are activated.
4. Motor neurones carry impulses to the effector muscle consequently the muscle contracts rapidly.
`;
    const score = scoreWorkedReasoningCoverage(strong, profile);
    expect(score.pass).toBe(true);
    expect(score.signals.causalCount).toBeGreaterThanOrEqual(2);
    expect(score.signals.sequencedPoints).toBeGreaterThanOrEqual(4);
  });

  test("fails weak worked example", () => {
    const profile = resolveTeachingQualityProfile({ topic: "Homeostasis" });
    const weak = `
17 — WORKED EXAMPLE
Paste into: Worked example (checkpoint)

Question: Explain homeostasis.

Homeostasis keeps conditions stable.
`;
    const score = scoreWorkedReasoningCoverage(weak, profile);
    expect(score.pass).toBe(false);
    expect(score.violations.length).toBeGreaterThan(0);
  });
});
