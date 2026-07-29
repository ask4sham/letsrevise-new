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

  test.each([
    ["missing", (d) => { delete d.parts[0].explanation; }],
    ["weak bare option", (d) => { d.parts[0].explanation = "Light."; }],
    ["administrative", (d) => { d.parts[0].explanation = "Award 1 mark for selecting Option B."; }],
    ["generic", (d) => { d.parts[0].explanation = "This is correct."; }],
  ])("rationale-only %s triggers one repair then succeeds", async (_name, mutate) => {
    const first = validEasy();
    mutate(first);
    const repaired = validEasy();
    callOpenAiJson.mockResolvedValueOnce(first).mockResolvedValueOnce(repaired);

    const draft = await generateCompositeExamDraft({
      topicKey: "edexcel-igcse-biology:x",
      difficulty: "easy",
    });
    expect(callOpenAiJson).toHaveBeenCalledTimes(2);
    expect(draft.parts.find((p) => p.type === "mcq").explanation).toMatch(/genetically identical/i);
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

  test.each([
    [
      "malformed options",
      (d) => {
        d.parts[0].options = ["A", "B"];
      },
    ],
    [
      "invalid correctIndex",
      (d) => {
        d.parts[0].correctIndex = 9;
      },
    ],
    [
      "incorrect MCQ marks",
      (d) => {
        d.parts[0].marks = 2;
        d.totalMarks = 4;
      },
    ],
    [
      "incorrect total marks",
      (d) => {
        d.totalMarks = 9;
      },
    ],
    [
      "duplicate / wrong labels",
      (d) => {
        d.parts[1].label = "a";
      },
    ],
    [
      "missing shared stem",
      (d) => {
        d.sharedStem = "";
      },
    ],
    [
      "mixed explanation + scoring",
      (d) => {
        delete d.parts[0].explanation;
        d.parts[0].correctIndex = 9;
      },
    ],
  ])("non-rationale fail-fast: %s — exactly one LLM call", async (_name, mutate) => {
    const bad = validEasy();
    mutate(bad);
    callOpenAiJson.mockResolvedValue(bad);

    await expect(
      generateCompositeExamDraft({
        topicKey: "edexcel-igcse-biology:x",
        difficulty: "easy",
      })
    ).rejects.toMatchObject({ code: "AI_DRAFT_INVALID", statusCode: 422 });
    expect(callOpenAiJson).toHaveBeenCalledTimes(1);
  });

  test("rejects short-only AI output with 422 after exactly one LLM call", async () => {
    callOpenAiJson.mockResolvedValue(shortOnlyEasy());
    await expect(
      generateCompositeExamDraft({
        topicKey: "edexcel-igcse-biology:x",
        difficulty: "easy",
      })
    ).rejects.toMatchObject({ code: "AI_DRAFT_INVALID", statusCode: 422 });
    expect(callOpenAiJson).toHaveBeenCalledTimes(1);
  });

  test("deep immutability: repair may only change the failed explanation", async () => {
    const first = validEasy();
    const originalExplanation = first.parts[0].explanation;
    first.parts[0].explanation = "This is correct.";

    const repaired = {
      title: "CHANGED TITLE",
      sharedStem: "CHANGED SHARED STEM MUST NOT WIN",
      difficulty: "easy",
      totalMarks: 99,
      parts: [
        {
          label: "a",
          type: "mcq",
          marks: 9,
          questionText: "CHANGED QUESTION TEXT MUST NOT WIN",
          options: ["W", "X", "Y", "Z"],
          correctIndex: 0,
          explanation:
            "Asexual reproduction involves one parent and produces genetically identical offspring through mitosis.",
          markSchemeLines: ["CHANGED SCHEME"],
          commandWord: "CHANGED",
          skill: "CHANGED",
        },
        {
          label: "b",
          type: "short",
          marks: 9,
          questionText: "CHANGED SHORT TEXT MUST NOT WIN",
          markSchemeLines: ["CHANGED SHORT SCHEME"],
          commandWord: "CHANGED",
          skill: "CHANGED",
        },
      ],
      warnings: ["changed"],
    };
    callOpenAiJson.mockResolvedValueOnce(first).mockResolvedValueOnce(repaired);

    const draft = await generateCompositeExamDraft({
      topicKey: "edexcel-igcse-biology:x",
      difficulty: "easy",
    });

    const expected = {
      ...first,
      parts: [
        { ...first.parts[0], explanation: repaired.parts[0].explanation },
        { ...first.parts[1] },
      ],
    };
    // Validator normalises output; compare critical immutable fields deeply.
    expect(draft.title).toBe(first.title);
    expect(draft.sharedStem).toBe(first.sharedStem);
    expect(draft.difficulty).toBe("easy");
    expect(draft.totalMarks).toBe(3);
    expect(draft.parts).toHaveLength(2);
    expect(draft.parts[0].label).toBe("a");
    expect(draft.parts[1].label).toBe("b");
    expect(draft.parts[0].type).toBe("mcq");
    expect(draft.parts[1].type).toBe("short");
    expect(draft.parts[0].questionText).toBe(first.parts[0].questionText);
    expect(draft.parts[1].questionText).toBe(first.parts[1].questionText);
    expect(draft.parts[0].options).toEqual(first.parts[0].options);
    expect(draft.parts[0].correctIndex).toBe(1);
    expect(draft.parts[0].marks).toBe(1);
    expect(draft.parts[1].marks).toBe(2);
    expect(draft.parts[0].markSchemeLines).toEqual(first.parts[0].markSchemeLines);
    expect(draft.parts[1].markSchemeLines).toEqual(first.parts[1].markSchemeLines);
    expect(draft.parts[0].commandWord).toBe(first.parts[0].commandWord);
    expect(draft.parts[1].commandWord).toBe(first.parts[1].commandWord);
    expect(draft.parts[0].skill).toBe(first.parts[0].skill);
    expect(draft.parts[1].skill).toBe(first.parts[1].skill);
    expect(draft.parts[0].explanation).toBe(repaired.parts[0].explanation);
    expect(draft.parts[0].explanation).not.toBe("This is correct.");
    expect(originalExplanation).toBe(repaired.parts[0].explanation); // repair restored a good rationale
    void expected;
  });

  test("repair with changed part count still preserves original structure", async () => {
    const first = validEasy();
    delete first.parts[0].explanation;
    const repaired = {
      ...validEasy(),
      parts: [
        {
          ...validEasy().parts[0],
          explanation:
            "Asexual reproduction involves one parent and produces genetically identical offspring through mitosis.",
        },
        // Extra part — must be ignored
        {
          label: "c",
          type: "short",
          marks: 1,
          questionText: "Extra part that must not appear.",
          markSchemeLines: ["Award 1 mark for nothing."],
        },
      ],
      totalMarks: 4,
    };
    callOpenAiJson.mockResolvedValueOnce(first).mockResolvedValueOnce(repaired);

    const draft = await generateCompositeExamDraft({
      topicKey: "edexcel-igcse-biology:x",
      difficulty: "easy",
    });
    expect(draft.parts).toHaveLength(2);
    expect(draft.parts.map((p) => p.label)).toEqual(["a", "b"]);
    expect(draft.parts[0].explanation).toMatch(/genetically identical/i);
  });

  test("repair with reordered / wrong labels does not accept structural change", async () => {
    const first = validEasy();
    delete first.parts[0].explanation;
    const repaired = {
      title: "X",
      sharedStem: first.sharedStem,
      difficulty: "easy",
      totalMarks: 3,
      parts: [
        {
          label: "b",
          type: "mcq",
          marks: 1,
          questionText: first.parts[0].questionText,
          options: first.parts[0].options,
          correctIndex: 1,
          explanation:
            "Asexual reproduction involves one parent and produces genetically identical offspring through mitosis.",
          markSchemeLines: first.parts[0].markSchemeLines,
        },
        {
          label: "a",
          type: "short",
          marks: 2,
          questionText: first.parts[1].questionText,
          markSchemeLines: first.parts[1].markSchemeLines,
        },
      ],
    };
    callOpenAiJson.mockResolvedValueOnce(first).mockResolvedValueOnce(repaired);

    // Label a is MCQ on original; repaired puts explanation on label b (short) and makes a short.
    // Merge looks up repaired part "a" — finds short type → ignores explanation → still missing → 422.
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

describe("isRationaleOnlyRepairable", () => {
  const {
    isRationaleOnlyRepairable,
  } = require("../services/generateCompositeExamDraft");

  test("allows explanation-only issue sets", () => {
    expect(isRationaleOnlyRepairable(["mcq_explanation_missing:part_a"])).toBe(true);
    expect(
      isRationaleOnlyRepairable([
        "mcq_explanation_too_short:part_a",
        "mcq_explanation_administrative:part_a",
      ])
    ).toBe(true);
  });

  test("rejects mixed or non-explanation issues", () => {
    expect(
      isRationaleOnlyRepairable([
        "mcq_explanation_missing:part_a",
        "mcq_correct_index_invalid:part_a",
      ])
    ).toBe(false);
    expect(isRationaleOnlyRepairable(["total_marks_mismatch:declared_9_sum_3"])).toBe(false);
    expect(isRationaleOnlyRepairable(["label_not_sequential:expected_a_got_b"])).toBe(false);
    expect(isRationaleOnlyRepairable([])).toBe(false);
  });
});

describe("mergeRationaleOnlyExplanations", () => {
  const {
    mergeRationaleOnlyExplanations,
  } = require("../services/generateCompositeExamDraft");

  test("preserves valid explanation on another MCQ while repairing one label", () => {
    const original = {
      title: "T",
      sharedStem: "Shared stem for multi MCQ immutability.",
      difficulty: "medium",
      totalMarks: 2,
      parts: [
        {
          label: "a",
          type: "mcq",
          marks: 1,
          questionText: "First MCQ question text here?",
          options: ["A1", "A2", "A3", "A4"],
          correctIndex: 0,
          explanation: "VALID RATIONALE FOR A MUST STAY BYTE FOR BYTE.",
          markSchemeLines: ["Award 1 mark for selecting Option A."],
          commandWord: "Identify",
          skill: "recall",
        },
        {
          label: "b",
          type: "mcq",
          marks: 1,
          questionText: "Second MCQ question text here?",
          options: ["B1", "B2", "B3", "B4"],
          correctIndex: 2,
          explanation: "This is correct.",
          markSchemeLines: ["Award 1 mark for selecting Option C."],
          commandWord: "Identify",
          skill: "recall",
        },
      ],
    };
    const repaired = {
      title: "CHANGED",
      sharedStem: "CHANGED",
      parts: [
        {
          label: "a",
          type: "mcq",
          marks: 9,
          questionText: "CHANGED A",
          options: ["X", "Y", "Z", "W"],
          correctIndex: 3,
          explanation: "CHANGED VALID A — MUST NOT APPLY",
          markSchemeLines: ["CHANGED"],
        },
        {
          label: "b",
          type: "mcq",
          marks: 9,
          questionText: "CHANGED B",
          options: ["X", "Y", "Z", "W"],
          correctIndex: 0,
          explanation: "B is correct because option C matches the required concept clearly.",
          markSchemeLines: ["CHANGED"],
        },
        { label: "c", type: "short", marks: 1, questionText: "Extra", markSchemeLines: ["x"] },
      ],
    };
    const issues = ["mcq_explanation_generic:part_b"];
    const merged = mergeRationaleOnlyExplanations(original, repaired, "medium", issues);
    expect(merged.ok).toBe(true);
    expect(merged.candidate.title).toBe("T");
    expect(merged.candidate.sharedStem).toBe(original.sharedStem);
    expect(merged.candidate.parts).toHaveLength(2);
    expect(merged.candidate.parts[0].explanation).toBe("VALID RATIONALE FOR A MUST STAY BYTE FOR BYTE.");
    expect(merged.candidate.parts[0].options).toEqual(["A1", "A2", "A3", "A4"]);
    expect(merged.candidate.parts[0].correctIndex).toBe(0);
    expect(merged.candidate.parts[0].questionText).toBe(original.parts[0].questionText);
    expect(merged.candidate.parts[1].explanation).toBe(
      "B is correct because option C matches the required concept clearly."
    );
    expect(merged.candidate.parts[1].options).toEqual(["B1", "B2", "B3", "B4"]);
    expect(merged.candidate.parts[1].correctIndex).toBe(2);
  });
});
