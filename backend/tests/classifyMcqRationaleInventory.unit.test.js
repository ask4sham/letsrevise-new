/**
 * Unit tests: V2.2 MCQ rationale inventory classification (read-only).
 */
const {
  classifyCompositeMcqPart,
  NEUTRAL_WHY_CORRECT,
} = require("../utils/classifyMcqRationaleInventory");

function baseMcq(overrides = {}) {
  return {
    label: "a",
    type: "mcq",
    marks: 1,
    questionText: "Which factor is not essential for seed germination?",
    options: ["Water", "Oxygen", "Light", "Temperature"],
    correctIndex: 2,
    markScheme: ["Award 1 mark for selecting Option C / Light."],
    ...overrides,
  };
}

describe("classifyCompositeMcqPart", () => {
  test("missing: no partData / no explanation / null", () => {
    expect(classifyCompositeMcqPart(baseMcq()).bucket).toBe("missing");
    expect(classifyCompositeMcqPart(baseMcq({ partData: {} })).bucket).toBe("missing");
    expect(classifyCompositeMcqPart(baseMcq({ partData: { explanation: null } })).bucket).toBe("missing");
  });

  test("empty: empty string / spaces / newlines", () => {
    expect(classifyCompositeMcqPart(baseMcq({ partData: { explanation: "" } })).bucket).toBe("empty");
    expect(classifyCompositeMcqPart(baseMcq({ partData: { explanation: "   " } })).bucket).toBe("empty");
    expect(classifyCompositeMcqPart(baseMcq({ partData: { explanation: "\n\t" } })).bucket).toBe("empty");
  });

  test("generic patterns", () => {
    const cases = [
      "Light",
      "C",
      "Option C",
      "C — Light",
      "Correct answer: C — Light",
      "The answer is C.",
      "This is correct.",
      "It is the right answer.",
      "Award 1 mark for selecting Light.",
      NEUTRAL_WHY_CORRECT,
    ];
    for (const explanation of cases) {
      const res = classifyCompositeMcqPart(baseMcq({ partData: { explanation } }), {
        subject: "Biology",
        topicKey: "edexcel-igcse-biology:germination",
      });
      expect(res.bucket).toBe("generic");
      expect(res.potentiallyEligibleForBackfill).toBe(true);
    }
  });

  test("substantive: concise teacher text is not rejected by AI min-length", () => {
    const cases = [
      "Water activates enzymes.",
      "Seeds use stored food reserves before photosynthesis begins.",
      "The area is 12 cm² because 3 × 4 = 12.",
      "Sodium loses one electron to form a positive ion.",
      "The metaphor creates a vivid image of isolation.",
    ];
    for (const explanation of cases) {
      const res = classifyCompositeMcqPart(
        baseMcq({
          partData: { explanation },
          options: ["A", "B", "C", "D"],
          correctIndex: 0,
        }),
        { subject: "Biology", topicKey: "bio:x" }
      );
      expect(res.bucket).toBe("substantive");
      expect(res.potentiallyEligibleForBackfill).toBe(false);
    }
  });

  test("malformed structures", () => {
    expect(classifyCompositeMcqPart(baseMcq({ questionText: "" })).bucket).toBe("malformed");
    expect(classifyCompositeMcqPart(baseMcq({ options: undefined })).bucket).toBe("malformed");
    expect(classifyCompositeMcqPart(baseMcq({ options: "x" })).bucket).toBe("malformed");
    expect(classifyCompositeMcqPart(baseMcq({ options: ["Only"] })).bucket).toBe("malformed");
    expect(classifyCompositeMcqPart(baseMcq({ correctIndex: -1 })).bucket).toBe("malformed");
    expect(classifyCompositeMcqPart(baseMcq({ correctIndex: 9 })).bucket).toBe("malformed");
    expect(classifyCompositeMcqPart({ type: "short", questionText: "x" }).bucket).toBe("malformed");
    expect(
      classifyCompositeMcqPart(baseMcq({ partData: { explanation: 12 } })).bucket
    ).toBe("malformed");
  });

  test("eligibility requires context and non-archived", () => {
    const missing = classifyCompositeMcqPart(baseMcq(), { subject: "Biology", topicKey: "t" });
    expect(missing.potentiallyEligibleForBackfill).toBe(true);
    const noCtx = classifyCompositeMcqPart(baseMcq(), { subject: "Biology" });
    expect(noCtx.potentiallyEligibleForBackfill).toBe(false);
    const archived = classifyCompositeMcqPart(baseMcq(), {
      subject: "Biology",
      topicKey: "t",
      isArchived: true,
    });
    expect(archived.potentiallyEligibleForBackfill).toBe(false);
  });
});
