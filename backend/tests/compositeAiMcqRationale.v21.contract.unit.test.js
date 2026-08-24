/**
 * V2.1 contract: AI draft explanation → FE map → serialize → BE normalize → feedback text.
 * Pure / mocked — no LLM, no external DB.
 */
const { validateCompositeExamAiDraft } = require("../utils/validateCompositeExamAiDraft");
const { normalizeMcqPartData, normalizePart } = require("../utils/compositeExamQuestion");

describe("V2.1 AI MCQ explanation persistence contract (mocked, no LLM)", () => {
  const aiDraft = {
    title: "Germinating seeds",
    sharedStem: "Seeds need certain conditions to germinate successfully.",
    difficulty: "easy",
    totalMarks: 3,
    parts: [
      {
        label: "a",
        type: "mcq",
        marks: 1,
        questionText: "Which factor is not essential for seed germination?",
        options: ["Water", "Oxygen", "Light", "Temperature"],
        correctIndex: 2,
        explanation:
          "Light is not essential because the seed initially uses energy stored in its food reserves. Water activates enzymes, oxygen supports aerobic respiration, and a suitable temperature allows enzyme-controlled reactions.",
        markSchemeLines: ["Award 1 mark for selecting Option C / Light."],
        commandWord: "Identify",
        skill: "Knowledge",
      },
      {
        label: "b",
        type: "short",
        marks: 2,
        questionText: "Explain why water is needed for germination.",
        markSchemeLines: [
          "Award 1 mark for activates enzymes / softens testa.",
          "Award 1 mark for allows mobilisation of food stores.",
        ],
        commandWord: "Explain",
        skill: "explain",
      },
    ],
  };

  test("validated AI draft carries explanation; normalize stores partData.explanation only", () => {
    const validated = validateCompositeExamAiDraft(aiDraft, { difficulty: "easy", hasImage: false });
    expect(validated.ok).toBe(true);
    const mcq = validated.draft.parts.find((p) => p.type === "mcq");
    expect(mcq.explanation).toMatch(/food reserves/i);

    // Simulate FE mapping + serialize shape used on Save Draft.
    const savePart = {
      label: mcq.label,
      type: "mcq",
      marks: mcq.marks,
      questionText: mcq.questionText,
      options: mcq.options,
      correctIndex: mcq.correctIndex,
      markScheme: mcq.markSchemeLines,
      partData: { explanation: mcq.explanation },
    };
    const normalized = normalizePart(savePart, 0);
    expect(normalized.partData).toEqual({ explanation: mcq.explanation });
    expect(normalized.options).toEqual(mcq.options);
    expect(normalized.correctIndex).toBe(2);
    expect(normalized.marks).toBe(1);
    expect(normalized.markScheme).toEqual(mcq.markSchemeLines);

    // Strip of arbitrary keys still applies.
    expect(
      normalizeMcqPartData({ explanation: mcq.explanation, whyCorrect: "ignore", modelAnswer: "ignore" }, "a")
    ).toEqual({ explanation: mcq.explanation });
  });

  test("short parts do not require or store explanation", () => {
    const validated = validateCompositeExamAiDraft(aiDraft, { difficulty: "easy", hasImage: false });
    const short = validated.draft.parts.find((p) => p.type === "short");
    expect(short.explanation).toBeUndefined();
    const normalized = normalizePart(
      {
        label: short.label,
        type: "short",
        marks: short.marks,
        questionText: short.questionText,
        markScheme: short.markSchemeLines,
      },
      1
    );
    expect(normalized.partData).toBeUndefined();
  });
});
