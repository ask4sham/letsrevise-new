/**
 * Block 28 — bounded mark-scheme corrective retry for AI-generated short exam questions.
 */
const {
  GENERATED_EXAM_REJECT,
  tryNormalizeGeneratedExamQuestionForBank,
  normalizeGeneratedExamQuestionForBank,
} = require("../utils/examQuestionBankGeneratedItem");
const {
  buildCorrectiveRegenerationUserPrompt,
  resolveGeneratedExamQuestionForBank,
  persistGeneratedExamQuestionBatch,
  GeneratedExamQuestionSetIncompleteError,
} = require("../utils/examQuestionGeneratedMarkSchemeRecovery");

const validFourPoint = {
  question: "Explain how mutations can affect protein synthesis and organism traits.",
  marks: 4,
  markScheme: [
    "Mutation changes the DNA base sequence.",
    "Amino acid sequence may change.",
    "Protein shape or function may change.",
    "Organism phenotype may change.",
  ],
  modelAnswer: "A long model answer for the generated question.",
  topicKey: "aqa-gcse-biology:cells",
};

const invalidTwoPoint = {
  ...validFourPoint,
  markScheme: ["Describe the DNA change.", "Link to protein function."],
};

const fixedFourPoint = {
  ...validFourPoint,
  markScheme: [
    "Mutation changes the DNA base sequence of a gene.",
    "The amino acid sequence in the protein may change.",
    "The protein may have a different shape or function.",
    "The organism's phenotype may change.",
  ],
};

describe("examQuestionGeneratedMarkSchemeRecovery", () => {
  test("A. valid 4-mark / 4-point short succeeds without retry", async () => {
    const regenerate = jest.fn();
    const resolved = await resolveGeneratedExamQuestionForBank(validFourPoint, { regenerate });
    expect(resolved.ok).toBe(true);
    expect(resolved.retried).toBe(false);
    expect(resolved.normalized.markScheme).toHaveLength(4);
    expect(regenerate).not.toHaveBeenCalled();
  });

  test("B. initial 4-mark / 2-point result is rejected and triggers exactly one corrective retry", async () => {
    const regenerate = jest.fn().mockResolvedValue(fixedFourPoint);
    const resolved = await resolveGeneratedExamQuestionForBank(invalidTwoPoint, { regenerate });
    expect(regenerate).toHaveBeenCalledTimes(1);
    expect(resolved.ok).toBe(true);
    expect(resolved.retried).toBe(true);
  });

  test("C. retry returning 4-mark / 4-point result is accepted", async () => {
    const regenerate = jest.fn().mockResolvedValue(fixedFourPoint);
    const resolved = await resolveGeneratedExamQuestionForBank(invalidTwoPoint, { regenerate });
    expect(resolved.ok).toBe(true);
    expect(resolved.normalized.marks).toBe(4);
    expect(resolved.normalized.markScheme).toHaveLength(4);
  });

  test("D. initial and retry both invalid: nothing persisted and batch is incomplete", async () => {
    const regenerate = jest.fn().mockResolvedValue(invalidTwoPoint);
    const persist = jest.fn();
    const batch = await persistGeneratedExamQuestionBatch({
      items: [invalidTwoPoint],
      expectedCount: 1,
      regenerate,
      persist,
    });
    expect(regenerate).toHaveBeenCalledTimes(1);
    expect(persist).not.toHaveBeenCalled();
    expect(batch.complete).toBe(false);
    expect(batch.incompleteFailures).toHaveLength(1);
    expect(batch.error).toBeInstanceOf(GeneratedExamQuestionSetIncompleteError);
    expect(batch.error.code).toBe("GENERATED_EXAM_QUESTION_SET_INCOMPLETE");
  });

  test("E. maximum retry count is 1 even if retry still mismatches", async () => {
    const regenerate = jest
      .fn()
      .mockResolvedValueOnce(invalidTwoPoint)
      .mockResolvedValueOnce(fixedFourPoint);
    await resolveGeneratedExamQuestionForBank(invalidTwoPoint, { regenerate });
    expect(regenerate).toHaveBeenCalledTimes(1);
  });

  test("corrective prompt includes required one-mark point instruction", () => {
    const prompt = buildCorrectiveRegenerationUserPrompt(invalidTwoPoint, 4);
    expect(prompt).toMatch(
      /This question is worth 4 marks\. Return exactly 4 distinct, independently awardable one-mark mark-scheme points\./
    );
  });

  test("non mark-scheme mismatch failures do not retry", async () => {
    const regenerate = jest.fn();
    const resolved = await resolveGeneratedExamQuestionForBank(
      {
        type: "short",
        marks: 4,
        markScheme: ["A", "B", "C", "D"],
        question: "Too short",
        modelAnswer: "short",
      },
      { regenerate }
    );
    expect(resolved.ok).toBe(false);
    expect(resolved.retried).toBe(false);
    expect(resolved.code).toBe(GENERATED_EXAM_REJECT.PUBLISH_NOT_READY);
    expect(regenerate).not.toHaveBeenCalled();
  });

  test("normalizeGeneratedExamQuestionForBank still rejects mismatch without retry", () => {
    expect(normalizeGeneratedExamQuestionForBank(invalidTwoPoint)).toBeNull();
    const attempt = tryNormalizeGeneratedExamQuestionForBank(invalidTwoPoint);
    expect(attempt.ok).toBe(false);
    expect(attempt.code).toBe(GENERATED_EXAM_REJECT.MARK_SCHEME_COUNT_MISMATCH);
  });
});
