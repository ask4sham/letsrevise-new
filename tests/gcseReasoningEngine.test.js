/**
 * Phase 3G — GCSE reasoning engine unit tests.
 */

const {
  GCSE_REASONING_STEPS,
  isGcseReasoningEngineEnabled,
  resolveReasoningProfile,
  buildReasoningChain,
  scoreReasoningCoverage,
  identifyReasoningGaps,
  buildReasoningAppendix,
} = require("../lib/teacherBrain/gcseReasoningEngine");

const STRUCTURE_INPUT = {
  topicKey: "aqa-gcse-biology:nervous-system-structure",
  subTopic: "Structure and function of the nervous system",
};

const fullReasoningPages = [
  {
    blocks: [
      {
        type: "text",
        content:
          "Structure: Myelin is a fatty insulating sheath around the axon. Adaptation: It prevents electrical signal loss. Function: Impulses jump between gaps. Consequence: Transmission becomes much faster. Exam: Explain why fast transmission helps rapid responses to stimuli.",
      },
      {
        type: "text",
        content:
          "Structure: The axon is long. Adaptation: carries impulses over distance. Function: transmits signals. Consequence: rapid coordinated responses. GCSE explain how axon length supports transmission.",
      },
      {
        type: "checkpoint",
        prompt: "Explain how neurones are adapted for rapid transmission of electrical impulses.",
      },
    ],
  },
];

const weakMyelinPages = [
  {
    blocks: [{ type: "text", content: "Myelin increases transmission speed." }],
  },
];

describe("gcseReasoningEngine (Phase 3G)", () => {
  const prev = process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE;

  afterEach(() => {
    if (prev === undefined) delete process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE;
    else process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE = prev;
  });

  test("engine off by default", () => {
    delete process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE;
    expect(isGcseReasoningEngineEnabled()).toBe(false);
    expect(buildReasoningAppendix(resolveReasoningProfile(STRUCTURE_INPUT))).toBe("");
  });

  test("GCSE_REASONING_STEPS has five stages", () => {
    expect(GCSE_REASONING_STEPS).toEqual([
      "structure",
      "adaptation",
      "function",
      "consequence",
      "exam_application",
    ]);
  });

  test("buildReasoningChain for myelin includes consequence", () => {
    process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE = "1";
    const chain = buildReasoningChain("myelin_sheath", resolveReasoningProfile(STRUCTURE_INPUT));
    expect(chain.steps.length).toBe(5);
    expect(chain.chainText).toMatch(/Consequence:/i);
    expect(chain.chainText).toMatch(/much faster/i);
  });

  test("scoreReasoningCoverage detects high score on full lesson", () => {
    process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE = "1";
    const score = scoreReasoningCoverage({
      reasoningProfile: resolveReasoningProfile(STRUCTURE_INPUT),
      pages: fullReasoningPages,
    });
    expect(score.enabled).toBe(true);
    expect(score.reasoningScorePct).toBeGreaterThanOrEqual(75);
    expect(score.consequenceBlocks).toBeGreaterThan(0);
    const myelin = score.conceptReasoning.find((c) => c.conceptId === "myelin_sheath");
    expect(myelin?.steps.structure).toBe(true);
    expect(myelin?.steps.function).toBe(true);
  });

  test("identifyReasoningGaps flags missing consequence for myelin", () => {
    process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE = "1";
    const profile = resolveReasoningProfile(STRUCTURE_INPUT);
    const score = scoreReasoningCoverage({
      reasoningProfile: profile,
      pages: weakMyelinPages,
    });
    const myelinGap = score.gaps.find((g) => g.conceptId === "myelin_sheath");
    expect(myelinGap).toBeTruthy();
    expect(myelinGap.missingSteps).toContain("Consequence");
    expect(
      myelinGap.recommendations.some((r) => /rapid response/i.test(r))
    ).toBe(true);
  });

  test("buildReasoningAppendix includes marker and five-step instructions", () => {
    process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE = "1";
    const text = buildReasoningAppendix(resolveReasoningProfile(STRUCTURE_INPUT));
    expect(text).toMatch(/GCSE REASONING ENGINE/);
    expect(text).toMatch(/cause-and-effect/i);
    expect(text).toMatch(/consequence/i);
    expect(text).toMatch(/MYELIN/i);
  });

  test("non-profile lesson returns empty appendix", () => {
    process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE = "1";
    expect(resolveReasoningProfile({ topic: "Photosynthesis" })).toBeNull();
    expect(buildReasoningAppendix(null)).toBe("");
  });
});
