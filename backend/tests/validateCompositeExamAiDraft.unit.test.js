/**
 * Unit tests: AI composite exam draft validation + service (mocked LLM).
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
        markSchemeLines: ["Award 1 mark for reproduction involving one parent / no gametes / genetically identical offspring."],
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
    expect(res.draft.parts).toHaveLength(2);
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
    expect(res.draft.parts).toHaveLength(3);
  });

  test("totalMarks equals sum of parts", () => {
    const bad = validEasy();
    bad.totalMarks = 9;
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/total_marks_mismatch/);
  });

  test("labels sequential", () => {
    const bad = validEasy();
    bad.parts[1].label = "c";
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/label_not_sequential/);
  });

  test("no image language when hasImage=false", () => {
    const bad = validEasy();
    bad.sharedStem = "The diagram shows asexual reproduction in strawberry plants.";
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues).toContain("image_language_without_image");
  });

  test("image language allowed when hasImage=true", () => {
    const ok = validEasy();
    ok.sharedStem = "The diagram shows asexual reproduction in strawberry plants.";
    const res = validateCompositeExamAiDraft(ok, { difficulty: "easy", hasImage: true });
    expect(res.ok).toBe(true);
  });

  test("unsupported table part rejected", () => {
    const bad = validEasy();
    bad.parts[0].type = "table";
    const res = validateCompositeExamAiDraft(bad, { difficulty: "easy", hasImage: false });
    expect(res.ok).toBe(false);
    expect(res.issues.join(" ")).toMatch(/unsupported_type/);
  });

  test("malformed AI JSON / missing parts rejected", () => {
    const res = validateCompositeExamAiDraft({ title: "x", sharedStem: "enough stem text here" }, { difficulty: "easy" });
    expect(res.ok).toBe(false);
  });

  test("mark scheme line validation works", () => {
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

  test("returns validated draft and does not throw when LLM returns valid JSON", async () => {
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
    expect(draft.totalMarks).toBe(4);
    expect(draft.parts.every((p) => p.type === "short")).toBe(true);
    expect(callOpenAiJson).toHaveBeenCalledTimes(1);
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
