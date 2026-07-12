/**
 * Unit tests: AI composite exam draft validation + service (mocked LLM).
 * V1.1: short + mcq; table rejected.
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

function baseParts(n, marksEach) {
  return Array.from({ length: n }, (_, i) => {
    const label = "abcdefghijklmnopqrstuvwxyz"[i];
    const marks = marksEach;
    return {
      label,
      type: "short",
      marks,
      questionText: `Part ${label}: describe a relevant point about the topic carefully.`,
      markSchemeLines: Array.from({ length: marks }, (_, m) => `Award 1 mark for distinct point ${m + 1} about the topic.`),
      commandWord: "Describe",
      skill: "recall",
    };
  });
}

function validMcqPart(label = "a") {
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
      {
        label: "a",
        type: "short",
        marks: 1,
        questionText: "State what is meant by asexual reproduction.",
        markSchemeLines: [
          "Award 1 mark for reproduction involving one parent / no gametes / genetically identical offspring.",
        ],
        commandWord: "State",
        skill: "recall",
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
        commandWord: "Describe",
        skill: "describe",
      },
    ],
    warnings: [],
  };
}

function validEasyWithMcq() {
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
  const parts = baseParts(2, 2);
  parts[0].questionText = "Explain why asexual offspring are genetically identical to the parent.";
  parts[0].commandWord = "Explain";
  parts[0].skill = "explain";
  parts[1].questionText = "Suggest why asexual reproduction can be a disadvantage after an environmental change.";
  parts[1].commandWord = "Suggest";
  parts[1].skill = "apply";
  return {
    title: "Comparing reproductive strategies",
    sharedStem: "Some plants reproduce asexually while others reproduce sexually.",
    difficulty: "medium",
    totalMarks: 4,
    parts,
    warnings: [],
  };
}

function validMediumWithMcq() {
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
  const parts = baseParts(3, 2);
  parts[0].questionText = "Compare asexual and sexual reproduction in terms of genetic variation.";
  parts[0].commandWord = "Compare";
  parts[0].skill = "compare";
  parts[1].questionText = "Evaluate the benefit of sexual reproduction in a changing environment.";
  parts[1].commandWord = "Evaluate";
  parts[1].skill = "evaluate";
  parts[2].questionText = "Justify why farmers may still prefer asexual methods for some crops.";
  parts[2].commandWord = "Justify";
  parts[2].skill = "justify";
  return {
    title: "Higher-tier reproduction analysis",
    sharedStem: "Organisms can reproduce sexually or asexually depending on conditions.",
    difficulty: "hard",
    totalMarks: 6,
    parts,
    warnings: [],
  };
}

describe("validateCompositeExamAiDraft", () => {
  test("easy draft valid: 2–4 marks", () => {
    const res = validateCompositeExamAiDraft(validEasy(), { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(true);
    expect(res.draft.totalMarks).toBe(3);
  });

  test("medium draft valid: 4–6 marks", () => {
    const res = validateCompositeExamAiDraft(validMedium(), { difficulty: "medium", hasImage: false });
    expect(res.ok).toBe(true);
    expect(res.draft.totalMarks).toBe(4);
  });

  test("hard draft valid: 6–9 marks", () => {
    const res = validateCompositeExamAiDraft(validHard(), { difficulty: "hard", hasImage: false });
    expect(res.ok).toBe(true);
    expect(res.draft.totalMarks).toBe(6);
  });

  test("valid MCQ part passes", () => {
    const res = validateCompositeExamAiDraft(validEasyWithMcq(), { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(true);
    expect(res.draft.parts[0].type).toBe("mcq");
    expect(res.draft.parts[0].options).toHaveLength(4);
    expect(res.draft.parts[0].correctIndex).toBe(1);
  });

  test("mixed short + MCQ medium draft passes", () => {
    const res = validateCompositeExamAiDraft(validMediumWithMcq(), { difficulty: "medium", hasImage: false });
    expect(res.ok).toBe(true);
    expect(res.draft.parts.map((p) => p.type)).toEqual(["mcq", "short", "short"]);
    expect(res.draft.totalMarks).toBe(5);
  });

  test("MCQ with fewer than 4 options fails", () => {
    const bad = validEasyWithMcq();
    bad.parts[0].options = ["A", "B", "C"];
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/mcq_options_count/);
  });

  test("MCQ with more than 4 options fails", () => {
    const bad = validEasyWithMcq();
    bad.parts[0].options = ["A", "B", "C", "D", "E"];
    bad.parts[0].correctIndex = 0;
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/mcq_options_count/);
  });

  test("MCQ with duplicate options fails", () => {
    const bad = validEasyWithMcq();
    bad.parts[0].options = ["Same", "Same", "Other", "Else"];
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/mcq_options_duplicate/);
  });

  test("MCQ with invalid correctIndex fails", () => {
    const bad = validEasyWithMcq();
    bad.parts[0].correctIndex = 4;
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/mcq_correct_index_invalid/);
  });

  test("MCQ with all of the above fails", () => {
    const bad = validEasyWithMcq();
    bad.parts[0].options[3] = "All of the above";
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/mcq_banned_option/);
  });

  test("table part still rejected", () => {
    const bad = validEasy();
    bad.parts[0].type = "table";
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/unsupported_type/);
  });

  test("totalMarks equals sum of parts", () => {
    const bad = validEasyWithMcq();
    bad.totalMarks = 9;
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/total_marks_mismatch/);
  });

  test("difficulty band still checked", () => {
    const bad = validEasyWithMcq();
    bad.parts[1].marks = 5;
    bad.totalMarks = 6;
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/total_marks_out_of_band/);
  });

  test("no image language when hasImage=false", () => {
    const bad = validEasyWithMcq();
    bad.sharedStem = "The diagram shows asexual reproduction in strawberry plants.";
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues).toContain("image_language_without_image");
  });

  test("labels sequential", () => {
    const bad = validEasy();
    bad.parts[1].label = "c";
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/label_not_sequential/);
  });

  test("mark scheme line validation works for short", () => {
    const bad = validEasy();
    bad.parts[1].markSchemeLines = ["short", "tiny"];
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/mark_scheme_weak/);
  });

  test("normalizeDifficulty accepts Easy casing", () => {
    expect(normalizeDifficulty("Easy")).toBe("easy");
    expect(normalizeDifficulty("nope")).toBeNull();
  });
});

describe("generateCompositeExamDraft service", () => {
  beforeEach(() => {
    callOpenAiJson.mockReset();
  });

  test("returns validated mixed MCQ + short draft", async () => {
    callOpenAiJson.mockResolvedValue(validMediumWithMcq());
    const draft = await generateCompositeExamDraft({
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topic: "Sexual & Asexual Reproduction",
      topicKey: "edexcel-igcse-biology:sexual-asexual",
      difficulty: "medium",
      hasImage: false,
    });
    expect(draft.totalMarks).toBe(5);
    expect(draft.parts.some((p) => p.type === "mcq")).toBe(true);
    expect(draft.parts.some((p) => p.type === "short")).toBe(true);
    expect(draft.parts.every((p) => p.type !== "table")).toBe(true);
  });

  test("rejects missing topicKey before calling LLM", async () => {
    await expect(
      generateCompositeExamDraft({ difficulty: "easy", topicKey: "" })
    ).rejects.toMatchObject({ code: "TOPIC_REQUIRED", statusCode: 400 });
    expect(callOpenAiJson).not.toHaveBeenCalled();
  });

  test("rejects invalid AI output with 422", async () => {
    callOpenAiJson.mockResolvedValue({ title: "Bad", sharedStem: "Too short", parts: [] });
    await expect(
      generateCompositeExamDraft({
        topicKey: "edexcel-igcse-biology:x",
        difficulty: "easy",
      })
    ).rejects.toMatchObject({ code: "AI_DRAFT_INVALID", statusCode: 422 });
  });
});
