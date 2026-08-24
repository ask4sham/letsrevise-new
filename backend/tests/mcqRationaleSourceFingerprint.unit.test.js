/**
 * Unit: V2.3A MCQ rationale source fingerprint.
 */
const {
  computeMcqRationaleSourceFingerprint,
  buildCanonicalSourcePayload,
  stableStringify,
} = require("../utils/mcqRationaleSourceFingerprint");

function baseInput(overrides = {}) {
  return {
    questionId: "507f1f77bcf86cd799439011",
    partLabel: "a",
    sharedStem: "Shared stem",
    questionText: "Which is correct?",
    options: ["A", "B", "C", "D"],
    correctIndex: 2,
    marks: 1,
    markScheme: ["Award 1 mark for C"],
    subject: "Biology",
    examBoard: "AQA",
    level: "GCSE",
    tier: "",
    topic: "Photosynthesis",
    topicKey: "photosynthesis",
    imageContextText: "",
    currentExplanation: "",
    ...overrides,
  };
}

describe("computeMcqRationaleSourceFingerprint", () => {
  test("deterministic across object key ordering", () => {
    const a = computeMcqRationaleSourceFingerprint(baseInput());
    const shuffled = {
      currentExplanation: "",
      topicKey: "photosynthesis",
      options: ["A", "B", "C", "D"],
      questionId: "507f1f77bcf86cd799439011",
      partLabel: "a",
      correctIndex: 2,
      sharedStem: "Shared stem",
      questionText: "Which is correct?",
      marks: 1,
      markScheme: ["Award 1 mark for C"],
      subject: "Biology",
      examBoard: "AQA",
      level: "GCSE",
      tier: "",
      topic: "Photosynthesis",
      imageContextText: "",
    };
    expect(computeMcqRationaleSourceFingerprint(shuffled)).toBe(a);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  test("ordered options matter", () => {
    const a = computeMcqRationaleSourceFingerprint(baseInput({ options: ["A", "B", "C", "D"] }));
    const b = computeMcqRationaleSourceFingerprint(baseInput({ options: ["D", "C", "B", "A"] }));
    expect(a).not.toBe(b);
  });

  test("question text changes fingerprint", () => {
    const a = computeMcqRationaleSourceFingerprint(baseInput());
    const b = computeMcqRationaleSourceFingerprint(baseInput({ questionText: "Different?" }));
    expect(a).not.toBe(b);
  });

  test("correctIndex changes fingerprint", () => {
    const a = computeMcqRationaleSourceFingerprint(baseInput({ correctIndex: 1 }));
    const b = computeMcqRationaleSourceFingerprint(baseInput({ correctIndex: 2 }));
    expect(a).not.toBe(b);
  });

  test("marks and mark scheme change fingerprint", () => {
    const a = computeMcqRationaleSourceFingerprint(baseInput({ marks: 1 }));
    const b = computeMcqRationaleSourceFingerprint(baseInput({ marks: 2 }));
    const c = computeMcqRationaleSourceFingerprint(baseInput({ markScheme: ["Other"] }));
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  test("shared stem changes fingerprint", () => {
    const a = computeMcqRationaleSourceFingerprint(baseInput());
    const b = computeMcqRationaleSourceFingerprint(baseInput({ sharedStem: "Other stem" }));
    expect(a).not.toBe(b);
  });

  test("topic context changes fingerprint", () => {
    const a = computeMcqRationaleSourceFingerprint(baseInput());
    const b = computeMcqRationaleSourceFingerprint(baseInput({ topicKey: "other-topic" }));
    const c = computeMcqRationaleSourceFingerprint(baseInput({ subject: "Chemistry" }));
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  test("current explanation changes fingerprint", () => {
    const a = computeMcqRationaleSourceFingerprint(baseInput({ currentExplanation: "" }));
    const b = computeMcqRationaleSourceFingerprint(baseInput({ currentExplanation: "Generic." }));
    expect(a).not.toBe(b);
  });

  test("irrelevant metadata does not change fingerprint", () => {
    const a = computeMcqRationaleSourceFingerprint(baseInput());
    const b = computeMcqRationaleSourceFingerprint({
      ...baseInput(),
      teacherId: "abc",
      status: "published",
      updatedAt: new Date("2020-01-01").toISOString(),
      model: "gpt",
      promptVersion: "x",
    });
    expect(a).toBe(b);
  });

  test("updatedAt is not part of canonical payload", () => {
    const payload = buildCanonicalSourcePayload({
      ...baseInput(),
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(payload).not.toHaveProperty("updatedAt");
    expect(stableStringify(payload)).not.toContain("updatedAt");
  });

  test("mediaContext diagnostic fields do not affect educational fingerprint", () => {
    const a = computeMcqRationaleSourceFingerprint(baseInput());
    const b = computeMcqRationaleSourceFingerprint({
      ...baseInput(),
      mediaContext: {
        referencePresent: true,
        scope: "question_shared",
        trustedContextAvailable: false,
      },
    });
    expect(a).toBe(b);
    const payload = buildCanonicalSourcePayload({
      ...baseInput(),
      mediaContext: { referencePresent: true, scope: "question_shared", trustedContextAvailable: false },
    });
    expect(payload).not.toHaveProperty("mediaContext");
    expect(stableStringify(payload)).not.toContain("mediaContext");
  });
});
