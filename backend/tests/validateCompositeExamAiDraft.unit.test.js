/**
 * Unit tests: AI composite exam draft validation + service (mocked LLM).
 * Requires exactly one MCQ + at least one short; table rejected.
 */
const {
  validateCompositeExamAiDraft,
  normalizeDifficulty,
} = require("../utils/validateCompositeExamAiDraft");

jest.mock("../utils/lessonAssetLlm", () => ({
  callOpenAiJson: jest.fn(),
}));

const { callOpenAiJson } = require("../utils/lessonAssetLlm");
const { generateCompositeExamDraft } = require("../services/generateCompositeExamDraft");

function validMcqPart(label = "a", { hard = false } = {}) {
  if (hard) {
    return {
      label,
      type: "mcq",
      marks: 1,
      questionText: "A farmer produces identical potato plants from tubers. Why can a new disease wipe out the whole crop?",
      options: [
        "Asexual offspring are genetically identical so all may be susceptible",
        "Sexual reproduction always produces weaker plants",
        "Tubers cannot store food reserves",
        "Meiosis increases mutation rate in every tuber generation",
      ],
      correctIndex: 0,
      explanation:
        "Asexual offspring are clones, so they share the same alleles and are all vulnerable to the same pathogen.",
      markSchemeLines: [
        "Award 1 mark for selecting Option A (clones / identical genetics / shared susceptibility).",
      ],
      commandWord: "Explain",
      skill: "apply",
    };
  }
  return {
    label,
    type: "mcq",
    marks: 1,
    questionText: "Which statement best describes asexual reproduction?",
    options: [
      "Offspring are produced by two parents and are genetically varied",
      "Offspring are produced by one parent and are genetically identical",
      "Gametes fuse to form a zygote",
      "Meiosis always occurs before fertilisation",
    ],
    correctIndex: 1,
    explanation:
      "Asexual reproduction involves one parent and produces genetically identical offspring through mitosis.",
    markSchemeLines: [
      "Award 1 mark for selecting Option B (offspring from one parent / genetically identical).",
    ],
    commandWord: "Identify",
    skill: "recall",
  };
}

function validEasy() {
  return {
    title: "Asexual reproduction basics",
    sharedStem: "A gardener grows identical strawberry plants from runners.",
    difficulty: "easy",
    totalMarks: 3,
    parts: [
      validMcqPart("a"),
      {
        label: "b",
        type: "short",
        marks: 2,
        questionText: "Describe one advantage of asexual reproduction for the plant.",
        markSchemeLines: [
          "Award 1 mark for rapid population increase / no need for pollinator.",
          "Award 1 mark for offspring adapted to the same environment / identical traits.",
        ],
        commandWord: "Describe",
        skill: "describe",
      },
    ],
    warnings: [],
  };
}

function validMedium() {
  return {
    title: "Comparing reproductive strategies",
    sharedStem: "Some plants reproduce asexually while others reproduce sexually.",
    difficulty: "medium",
    totalMarks: 5,
    parts: [
      validMcqPart("a"),
      {
        label: "b",
        type: "short",
        marks: 2,
        questionText: "Explain why asexual offspring are genetically identical to the parent.",
        markSchemeLines: [
          "Award 1 mark for mitosis / no mixing of gametes.",
          "Award 1 mark for identical DNA / clones of the parent.",
        ],
        commandWord: "Explain",
        skill: "explain",
      },
      {
        label: "c",
        type: "short",
        marks: 2,
        questionText: "Suggest why asexual reproduction can be a disadvantage after an environmental change.",
        markSchemeLines: [
          "Award 1 mark for low genetic variation / all offspring similar.",
          "Award 1 mark for population may all be vulnerable / less likely to survive change.",
        ],
        commandWord: "Suggest",
        skill: "apply",
      },
    ],
    warnings: [],
  };
}

function validHard() {
  return {
    title: "Higher-tier reproduction analysis",
    sharedStem: "Organisms can reproduce sexually or asexually depending on conditions.",
    difficulty: "hard",
    totalMarks: 7,
    parts: [
      validMcqPart("a", { hard: true }),
      {
        label: "b",
        type: "short",
        marks: 2,
        questionText: "Compare asexual and sexual reproduction in terms of genetic variation.",
        markSchemeLines: [
          "Award 1 mark for asexual produces clones / little variation.",
          "Award 1 mark for sexual produces genetic variation / mixing of alleles.",
        ],
        commandWord: "Compare",
        skill: "compare",
      },
      {
        label: "c",
        type: "short",
        marks: 2,
        questionText: "Evaluate the benefit of sexual reproduction in a changing environment.",
        markSchemeLines: [
          "Award 1 mark for variation increases chance some individuals survive.",
          "Award 1 mark for linked explanation of changing selection pressures.",
        ],
        commandWord: "Evaluate",
        skill: "evaluate",
      },
      {
        label: "d",
        type: "short",
        marks: 2,
        questionText: "Justify why farmers may still prefer asexual methods for some crops.",
        markSchemeLines: [
          "Award 1 mark for desirable traits conserved / uniform yield.",
          "Award 1 mark for faster production / no need for pollination.",
        ],
        commandWord: "Justify",
        skill: "justify",
      },
    ],
    warnings: [],
  };
}

function shortOnlyEasy() {
  return {
    title: "Asexual reproduction basics",
    sharedStem: "A gardener grows identical strawberry plants from runners.",
    difficulty: "easy",
    totalMarks: 3,
    parts: [
      {
        label: "a",
        type: "short",
        marks: 1,
        questionText: "State what is meant by asexual reproduction.",
        markSchemeLines: [
          "Award 1 mark for reproduction involving one parent / no gametes / genetically identical offspring.",
        ],
      },
      {
        label: "b",
        type: "short",
        marks: 2,
        questionText: "Describe one advantage of asexual reproduction for the plant.",
        markSchemeLines: [
          "Award 1 mark for rapid population increase / no need for pollinator.",
          "Award 1 mark for offspring adapted to the same environment / identical traits.",
        ],
      },
    ],
  };
}

describe("validateCompositeExamAiDraft", () => {
  test("easy draft with exactly one MCQ + short passes", () => {
    const res = validateCompositeExamAiDraft(validEasy(), { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(true);
    expect(res.draft.parts.filter((p) => p.type === "mcq")).toHaveLength(1);
    expect(res.draft.parts.filter((p) => p.type === "short")).toHaveLength(1);
    expect(res.draft.totalMarks).toBe(3);
  });

  test("medium draft with exactly one MCQ + short passes", () => {
    const res = validateCompositeExamAiDraft(validMedium(), { difficulty: "medium", hasImage: false });
    expect(res.ok).toBe(true);
    expect(res.draft.parts.filter((p) => p.type === "mcq")).toHaveLength(1);
    expect(res.draft.parts.filter((p) => p.type === "short")).toHaveLength(2);
    expect(res.draft.totalMarks).toBe(5);
  });

  test("hard draft with exactly one MCQ + short passes", () => {
    const res = validateCompositeExamAiDraft(validHard(), { difficulty: "hard", hasImage: false });
    expect(res.ok).toBe(true);
    expect(res.draft.parts.filter((p) => p.type === "mcq")).toHaveLength(1);
    expect(res.draft.totalMarks).toBe(7);
  });

  test("draft with zero MCQ parts fails", () => {
    const res = validateCompositeExamAiDraft(shortOnlyEasy(), { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues).toContain("mcq_required_exactly_one");
  });

  test("draft with two MCQ parts fails", () => {
    const bad = validEasy();
    bad.parts[1] = validMcqPart("b");
    bad.totalMarks = 2;
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/too_many_mcq_parts/);
  });

  test("draft with table part fails", () => {
    const bad = validEasy();
    bad.parts[1].type = "table";
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/unsupported_type/);
  });

  test("MCQ with invalid options fails", () => {
    const bad = validEasy();
    bad.parts[0].options = ["A", "B"];
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/mcq_options_count/);
  });

  test("MCQ with invalid correctIndex fails", () => {
    const bad = validEasy();
    bad.parts[0].correctIndex = 9;
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/mcq_correct_index_invalid/);
  });

  test("MCQ marks not 1 fails", () => {
    const bad = validEasy();
    bad.parts[0].marks = 2;
    bad.totalMarks = 4;
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/mcq_marks_must_be_1/);
  });

  test("Easy/Medium/Hard bands still enforced", () => {
    const bad = validEasy();
    bad.parts[1].marks = 5;
    bad.totalMarks = 6;
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/total_marks_out_of_band/);
  });

  test("totalMarks mismatch fails", () => {
    const bad = validEasy();
    bad.totalMarks = 9;
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/total_marks_mismatch/);
  });

  test("no image language when hasImage=false", () => {
    const bad = validEasy();
    bad.sharedStem = "The diagram shows asexual reproduction in strawberry plants.";
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues).toContain("image_language_without_image");
  });

  test("normalizeDifficulty accepts Easy casing", () => {
    expect(normalizeDifficulty("Easy")).toBe("easy");
    expect(normalizeDifficulty("nope")).toBeNull();
  });

  test("MCQ missing explanation fails", () => {
    const bad = validEasy();
    delete bad.parts[0].explanation;
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/mcq_explanation_missing:part_a/);
  });

  test("MCQ weak explanation fails", () => {
    const bad = validEasy();
    bad.parts[0].explanation = "This is correct.";
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/mcq_explanation_/);
  });

  test("valid draft preserves MCQ explanation on output", () => {
    const res = validateCompositeExamAiDraft(validEasy(), { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(true);
    const mcq = res.draft.parts.find((p) => p.type === "mcq");
    expect(mcq.explanation).toMatch(/genetically identical/i);
    expect(res.draft.parts.find((p) => p.type === "short").explanation).toBeUndefined();
  });
});

describe("generateCompositeExamDraft service", () => {
  beforeEach(() => {
    callOpenAiJson.mockReset();
  });

  test("returns validated draft with exactly one MCQ and explanation — no repair", async () => {
    callOpenAiJson.mockResolvedValue(validMedium());
    const draft = await generateCompositeExamDraft({
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topic: "Sexual & Asexual Reproduction",
      topicKey: "edexcel-igcse-biology:sexual-asexual",
      difficulty: "medium",
      hasImage: false,
    });
    expect(callOpenAiJson).toHaveBeenCalledTimes(1);
    expect(draft.parts.filter((p) => p.type === "mcq")).toHaveLength(1);
    expect(draft.parts.filter((p) => p.type === "short").length).toBeGreaterThanOrEqual(1);
    expect(draft.parts.find((p) => p.type === "mcq").explanation).toBeTruthy();
  });

  test("missing explanation triggers one repair then succeeds", async () => {
    const first = validEasy();
    delete first.parts[0].explanation;
    const repaired = validEasy();
    callOpenAiJson.mockResolvedValueOnce(first).mockResolvedValueOnce(repaired);

    const draft = await generateCompositeExamDraft({
      topicKey: "edexcel-igcse-biology:x",
      difficulty: "easy",
    });
    expect(callOpenAiJson).toHaveBeenCalledTimes(2);
    expect(draft.parts.find((p) => p.type === "mcq").explanation).toMatch(/genetically identical/i);
  });

  test("weak explanation triggers one repair then succeeds", async () => {
    const first = validEasy();
    first.parts[0].explanation = "Light.";
    const repaired = validEasy();
    callOpenAiJson.mockResolvedValueOnce(first).mockResolvedValueOnce(repaired);

    const draft = await generateCompositeExamDraft({
      topicKey: "edexcel-igcse-biology:x",
      difficulty: "easy",
    });
    expect(callOpenAiJson).toHaveBeenCalledTimes(2);
    expect(draft.parts.find((p) => p.type === "mcq").explanation.length).toBeGreaterThan(20);
  });

  test("repair also invalid → exactly two LLM calls and 422", async () => {
    const first = validEasy();
    delete first.parts[0].explanation;
    const stillBad = validEasy();
    stillBad.parts[0].explanation = "This is correct.";
    callOpenAiJson.mockResolvedValueOnce(first).mockResolvedValueOnce(stillBad);

    await expect(
      generateCompositeExamDraft({
        topicKey: "edexcel-igcse-biology:x",
        difficulty: "easy",
      })
    ).rejects.toMatchObject({ code: "AI_DRAFT_INVALID", statusCode: 422 });
    expect(callOpenAiJson).toHaveBeenCalledTimes(2);
  });

  test("repair cannot silently change correctIndex — scoring preserved from first draft", async () => {
    const first = validEasy();
    delete first.parts[0].explanation;
    const repaired = validEasy();
    repaired.parts[0].correctIndex = 0;
    repaired.parts[0].explanation =
      "Asexual reproduction involves one parent and produces genetically identical offspring through mitosis.";
    callOpenAiJson.mockResolvedValueOnce(first).mockResolvedValueOnce(repaired);

    const draft = await generateCompositeExamDraft({
      topicKey: "edexcel-igcse-biology:x",
      difficulty: "easy",
    });
    expect(draft.parts.find((p) => p.type === "mcq").correctIndex).toBe(1);
    expect(draft.parts.find((p) => p.type === "mcq").options).toEqual(first.parts[0].options);
  });

  test("repair cannot silently change options or marks", async () => {
    const first = validEasy();
    delete first.parts[0].explanation;
    const repaired = validEasy();
    repaired.parts[0].options = ["A", "B", "C", "D"];
    repaired.parts[0].marks = 1;
    repaired.parts[1].marks = 9;
    repaired.parts[0].explanation =
      "Asexual reproduction involves one parent and produces genetically identical offspring through mitosis.";
    callOpenAiJson.mockResolvedValueOnce(first).mockResolvedValueOnce(repaired);

    const draft = await generateCompositeExamDraft({
      topicKey: "edexcel-igcse-biology:x",
      difficulty: "easy",
    });
    expect(draft.parts[0].options).toEqual(first.parts[0].options);
    expect(draft.parts[1].marks).toBe(2);
  });

  test("rejects short-only AI output with 422 after one repair still short-only", async () => {
    callOpenAiJson.mockResolvedValue(shortOnlyEasy());
    await expect(
      generateCompositeExamDraft({
        topicKey: "edexcel-igcse-biology:x",
        difficulty: "easy",
      })
    ).rejects.toMatchObject({ code: "AI_DRAFT_INVALID", statusCode: 422 });
    expect(callOpenAiJson).toHaveBeenCalledTimes(2);
  });

  test("rejects missing topicKey before calling LLM", async () => {
    await expect(
      generateCompositeExamDraft({ difficulty: "easy", topicKey: "" })
    ).rejects.toMatchObject({ code: "TOPIC_REQUIRED", statusCode: 400 });
    expect(callOpenAiJson).not.toHaveBeenCalled();
  });

  test("malformed JSON path: LLM_BAD_JSON surfaces without DB write", async () => {
    const e = new Error("bad json");
    e.code = "LLM_BAD_JSON";
    callOpenAiJson.mockRejectedValue(e);
    await expect(
      generateCompositeExamDraft({
        topicKey: "edexcel-igcse-biology:x",
        difficulty: "easy",
      })
    ).rejects.toMatchObject({ code: "LLM_BAD_JSON", statusCode: 503 });
    expect(callOpenAiJson).toHaveBeenCalledTimes(1);
  });
});
