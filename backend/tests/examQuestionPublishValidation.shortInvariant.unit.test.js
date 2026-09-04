const {
  validateExamQuestionPublishReadiness,
  validateShortExamQuestionBankWrite,
} = require("../utils/examQuestionPublishValidation");
const { normalizeGeneratedExamQuestionForBank } = require("../utils/examQuestionBankGeneratedItem");

describe("examQuestionPublishValidation short mark-scheme invariant", () => {
  const base = {
    topicKey: "aqa-gcse-biology:cells",
    type: "short",
    question: "Explain how osmosis affects plant cells in a concentrated solution.",
    correctAnswer: "Water leaves the cell by osmosis so the cytoplasm shrinks.",
    metadata: { modelAnswer: "Water leaves the cell by osmosis so the cytoplasm shrinks." },
  };

  test("publish readiness passes when marks equal markScheme length", () => {
    const ready = validateExamQuestionPublishReadiness({
      ...base,
      marks: 4,
      markScheme: ["Point one here", "Point two here", "Point three here", "Point four here"],
    });
    expect(ready.ok).toBe(true);
  });

  test("publish readiness fails when marks exceed markScheme length", () => {
    const ready = validateExamQuestionPublishReadiness({
      ...base,
      marks: 4,
      markScheme: ["Point one here", "Point two here"],
    });
    expect(ready.ok).toBe(false);
    expect(ready.msg).toMatch(/exactly 4 mark-scheme points/i);
  });

  test("short bank write validation enforces equality", () => {
    expect(
      validateShortExamQuestionBankWrite({
        type: "short",
        marks: 2,
        markScheme: ["One substantive point", "Two substantive points"],
        question: base.question,
      }).ok
    ).toBe(true);
    expect(
      validateShortExamQuestionBankWrite({
        type: "short",
        marks: 4,
        markScheme: ["One substantive point", "Two substantive points"],
        question: base.question,
      }).ok
    ).toBe(false);
  });

  test("generated short with mismatch fails normalization", () => {
    const out = normalizeGeneratedExamQuestionForBank({
      question: "Explain how mutations can affect protein synthesis and organism traits.",
      marks: 4,
      markScheme: ["Describe the DNA change.", "Link to protein function."],
      modelAnswer: "A long model answer for the generated question.",
      topicKey: base.topicKey,
    });
    expect(out).toBeNull();
  });

  test("generated short with matching marks and markScheme passes normalization", () => {
    const out = normalizeGeneratedExamQuestionForBank({
      question: "Explain how mutations can affect protein synthesis and organism traits.",
      marks: 4,
      markScheme: [
        "Mutation changes the DNA base sequence.",
        "Amino acid sequence may change.",
        "Protein shape or function may change.",
        "Organism phenotype may change.",
      ],
      modelAnswer: "A long model answer for the generated question.",
      topicKey: base.topicKey,
    });
    expect(out).not.toBeNull();
    expect(out.marks).toBe(4);
    expect(out.markScheme).toHaveLength(4);
  });
});
