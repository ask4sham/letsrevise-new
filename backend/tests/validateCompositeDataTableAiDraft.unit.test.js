/**
 * Unit tests: AI data-table composite draft validation + service (mocked LLM).
 */
const {
  validateCompositeDataTableAiDraft,
  normalizeDifficulty,
} = require("../utils/validateCompositeDataTableAiDraft");

jest.mock("../utils/lessonAssetLlm", () => ({
  callOpenAiJson: jest.fn(),
}));

const { callOpenAiJson } = require("../utils/lessonAssetLlm");
const { generateCompositeDataTableDraft } = require("../services/generateCompositeDataTableDraft");

function baseTable() {
  return {
    title: "Effect of temperature on enzyme activity",
    columns: [
      { heading: "Temperature", unit: "°C" },
      { heading: "Time taken", unit: "s" },
      { heading: "Rate", unit: "s⁻¹" },
    ],
    rows: [
      ["20", "80", "0.013"],
      ["30", "45", "0.022"],
      ["40", "25", "0.040"],
      ["50", "60", "0.017"],
    ],
  };
}

function validEasy() {
  return {
    title: "Enzyme temperature investigation",
    sharedStem: "A student investigated the effect of temperature on enzyme activity.",
    difficulty: "easy",
    questionStyle: "data_table",
    totalMarks: 3,
    dataTable: baseTable(),
    parts: [
      {
        label: "a",
        type: "short",
        marks: 1,
        questionText: "State the temperature at which the rate was highest.",
        markSchemeLines: ["Award 1 mark for 40 °C."],
        skill: "read_data",
        dataDependency: "highest Rate value in Rate column",
      },
      {
        label: "b",
        type: "short",
        marks: 2,
        questionText: "Describe the trend shown by the rate results.",
        markSchemeLines: [
          "Award 1 mark for rate increases from 20 °C to 40 °C.",
          "Award 1 mark for rate decreases at 50 °C.",
        ],
        skill: "describe_trend",
        dataDependency: "Rate column trend across temperatures",
      },
    ],
    warnings: [],
  };
}

function validMedium() {
  return {
    title: "Enzyme temperature investigation",
    sharedStem: "A student investigated the effect of temperature on enzyme activity using the results below.",
    difficulty: "medium",
    questionStyle: "data_table",
    totalMarks: 5,
    dataTable: baseTable(),
    parts: [
      {
        label: "a",
        type: "short",
        marks: 1,
        questionText: "State the temperature at which the rate was highest.",
        markSchemeLines: ["Award 1 mark for 40 °C."],
        skill: "read_data",
        dataDependency: "highest Rate value",
      },
      {
        label: "b",
        type: "short",
        marks: 2,
        questionText: "Calculate the difference in rate between 30 °C and 40 °C.",
        markSchemeLines: [
          "Award 1 mark for 0.040 − 0.022.",
          "Award 1 mark for 0.018 (s⁻¹).",
        ],
        skill: "calculate",
        dataDependency: "Rate column rows for 30 and 40",
      },
      {
        label: "c",
        type: "short",
        marks: 2,
        questionText: "Explain the trend in rate from 20 °C to 40 °C.",
        markSchemeLines: [
          "Award 1 mark for rate increases as temperature rises to 40 °C.",
          "Award 1 mark for more successful collisions / higher kinetic energy.",
        ],
        skill: "explain_trend",
        dataDependency: "Rate column increase 20 to 40",
      },
    ],
    warnings: [],
  };
}

function validHard() {
  return {
    title: "Enzyme temperature investigation",
    sharedStem: "A student investigated the effect of temperature on enzyme activity and recorded the results shown.",
    difficulty: "hard",
    questionStyle: "data_table",
    totalMarks: 7,
    dataTable: baseTable(),
    parts: [
      {
        label: "a",
        type: "short",
        marks: 1,
        questionText: "State the temperature at which the rate was highest.",
        markSchemeLines: ["Award 1 mark for 40 °C."],
        skill: "read_data",
        dataDependency: "highest Rate",
      },
      {
        label: "b",
        type: "short",
        marks: 2,
        questionText: "Describe the trend shown by the rate results.",
        markSchemeLines: [
          "Award 1 mark for rate increases from 20 °C to 40 °C.",
          "Award 1 mark for rate decreases from 40 °C to 50 °C.",
        ],
        skill: "describe_trend",
        dataDependency: "Rate column trend",
      },
      {
        label: "c",
        type: "short",
        marks: 2,
        questionText: "Explain the biological cause of the decrease in rate at 50 °C.",
        markSchemeLines: [
          "Award 1 mark for enzyme denaturation / active site changes shape.",
          "Award 1 mark for fewer enzyme-substrate complexes formed.",
        ],
        skill: "explain",
        dataDependency: "Rate decrease at Temperature 50",
      },
      {
        label: "d",
        type: "short",
        marks: 2,
        questionText: "Evaluate one limitation of the method and suggest an improvement.",
        markSchemeLines: [
          "Award 1 mark for identifying a limitation (e.g. only one repeat / large temperature gaps).",
          "Award 1 mark for a matching improvement (repeats / narrower intervals).",
        ],
        skill: "evaluate",
        dataDependency: "table design / Temperature spacing",
      },
    ],
    warnings: [],
  };
}

describe("validateCompositeDataTableAiDraft", () => {
  test("valid Easy data-table draft passes", () => {
    const result = validateCompositeDataTableAiDraft(validEasy(), { difficulty: "easy" });
    expect(result.ok).toBe(true);
    expect(result.draft.questionStyle).toBe("data_table");
    expect(result.draft.parts.every((p) => p.type === "short")).toBe(true);
  });

  test("valid Medium data-table draft passes", () => {
    const result = validateCompositeDataTableAiDraft(validMedium(), { difficulty: "medium" });
    expect(result.ok).toBe(true);
    expect(result.draft.parts).toHaveLength(3);
  });

  test("valid Hard data-table draft passes", () => {
    const result = validateCompositeDataTableAiDraft(validHard(), { difficulty: "hard" });
    expect(result.ok).toBe(true);
    expect(result.draft.totalMarks).toBe(7);
  });

  test("invalid column count rejected", () => {
    const draft = validEasy();
    draft.dataTable.columns = [{ heading: "Only", unit: "x" }];
    draft.dataTable.rows = [["1"], ["2"], ["3"]];
    const result = validateCompositeDataTableAiDraft(draft, { difficulty: "easy" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.startsWith("data_table_column_count"))).toBe(true);
  });

  test("invalid row count rejected", () => {
    const draft = validEasy();
    draft.dataTable.rows = [
      ["20", "80", "0.013"],
      ["30", "45", "0.022"],
    ];
    const result = validateCompositeDataTableAiDraft(draft, { difficulty: "easy" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.startsWith("data_table_row_count"))).toBe(true);
  });

  test("blank cells rejected", () => {
    const draft = validEasy();
    draft.dataTable.rows[1][1] = "  ";
    const result = validateCompositeDataTableAiDraft(draft, { difficulty: "easy" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.startsWith("data_table_blank_cell"))).toBe(true);
  });

  test("missing units rejected for numeric columns", () => {
    const draft = validEasy();
    draft.dataTable.columns[2].unit = "";
    draft.dataTable.columns[2].heading = "Rate";
    const result = validateCompositeDataTableAiDraft(draft, { difficulty: "easy" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.startsWith("data_table_missing_unit"))).toBe(true);
  });

  test("inconsistent rows rejected", () => {
    const draft = validEasy();
    draft.dataTable.rows[0] = ["20", "80"];
    const result = validateCompositeDataTableAiDraft(draft, { difficulty: "easy" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.startsWith("data_table_row_length_mismatch"))).toBe(true);
  });

  test("type table rejected", () => {
    const draft = validEasy();
    draft.parts[0].type = "table";
    const result = validateCompositeDataTableAiDraft(draft, { difficulty: "easy" });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("unsupported_type:table");
  });

  test("MCQ rejected in data-table mode", () => {
    const draft = validEasy();
    draft.parts[0].type = "mcq";
    draft.parts[0].options = ["A", "B", "C", "D"];
    draft.parts[0].correctIndex = 0;
    const result = validateCompositeDataTableAiDraft(draft, { difficulty: "easy" });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("mcq_not_allowed_in_data_table_mode");
  });

  test("totalMarks mismatch rejected", () => {
    const draft = validEasy();
    draft.totalMarks = 99;
    const result = validateCompositeDataTableAiDraft(draft, { difficulty: "easy" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.startsWith("total_marks_mismatch"))).toBe(true);
  });

  test("highest answer mismatch rejected", () => {
    const draft = validEasy();
    draft.parts[0].markSchemeLines = ["Award 1 mark for 20 °C."];
    const result = validateCompositeDataTableAiDraft(draft, { difficulty: "easy" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.startsWith("extreme_answer_mismatch"))).toBe(true);
  });

  test("trend contradiction rejected", () => {
    const draft = validEasy();
    draft.parts[1].markSchemeLines = [
      "Award 1 mark for rate stays constant throughout.",
      "Award 1 mark for no change with temperature.",
    ];
    const result = validateCompositeDataTableAiDraft(draft, { difficulty: "easy" });
    // Monotonic-up-only / down-only contradictions remain hard rejects; peak patterns may warn.
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.startsWith("trend_contradiction"))).toBe(true);
  });

  test("unknown dataDependency is a warning not a hard reject", () => {
    const draft = validEasy();
    draft.parts[0].dataDependency = "xyzzy unrelated phrase here";
    const result = validateCompositeDataTableAiDraft(draft, { difficulty: "easy" });
    expect(result.ok).toBe(true);
    expect(result.draft.warnings.some((w) => w.startsWith("data_dependency_unknown"))).toBe(true);
  });

  test("normalizeDifficulty accepts bands", () => {
    expect(normalizeDifficulty("Easy")).toBe("easy");
    expect(normalizeDifficulty("nope")).toBe(null);
  });
});

describe("generateCompositeDataTableDraft service", () => {
  beforeEach(() => {
    callOpenAiJson.mockReset();
  });

  test("returns validated draft without retry when first draft is valid", async () => {
    callOpenAiJson.mockResolvedValue(validEasy());
    const draft = await generateCompositeDataTableDraft({
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topic: "Enzymes",
      topicKey: "enzymes",
      difficulty: "easy",
    });
    expect(draft.questionStyle).toBe("data_table");
    expect(draft.dataTable.rows).toHaveLength(4);
    expect(callOpenAiJson).toHaveBeenCalledTimes(1);
  });

  test("retries once when first draft has only 2 rows, then returns repaired draft", async () => {
    const twoRows = validEasy();
    twoRows.dataTable.rows = [
      ["20", "80", "0.013"],
      ["30", "45", "0.022"],
    ];
    callOpenAiJson.mockResolvedValueOnce(twoRows).mockResolvedValueOnce(validEasy());
    const draft = await generateCompositeDataTableDraft({
      topicKey: "enzymes",
      difficulty: "easy",
    });
    expect(draft.dataTable.rows.length).toBeGreaterThanOrEqual(3);
    expect(callOpenAiJson).toHaveBeenCalledTimes(2);
    const repairUser = String(callOpenAiJson.mock.calls[1][0].user || "");
    expect(repairUser).toMatch(/data_table_row_count/i);
    expect(repairUser).toMatch(/Do not return only 2 rows/i);
  });

  test("returns 422 when first and repaired drafts both fail validation", async () => {
    const twoRows = validEasy();
    twoRows.dataTable.rows = [
      ["20", "80", "0.013"],
      ["30", "45", "0.022"],
    ];
    callOpenAiJson.mockResolvedValue(twoRows);
    await expect(
      generateCompositeDataTableDraft({
        topicKey: "enzymes",
        difficulty: "easy",
      })
    ).rejects.toMatchObject({ statusCode: 422, code: "AI_DRAFT_INVALID" });
    // initial + up to MAX_REPAIR_ATTEMPTS repairs
    expect(callOpenAiJson).toHaveBeenCalledTimes(1 + 2);
  });

  test("rejects invalid LLM payload with 422 after failed repair", async () => {
    const bad = validEasy();
    bad.parts[0].type = "mcq";
    bad.parts[0].options = ["A", "B", "C", "D"];
    bad.parts[0].correctIndex = 0;
    callOpenAiJson.mockResolvedValue(bad);
    await expect(
      generateCompositeDataTableDraft({
        topicKey: "enzymes",
        difficulty: "easy",
      })
    ).rejects.toMatchObject({ statusCode: 422, code: "AI_DRAFT_INVALID" });
    expect(callOpenAiJson).toHaveBeenCalledTimes(1 + 2);
  });

  test("requires topicKey", async () => {
    await expect(
      generateCompositeDataTableDraft({ difficulty: "easy" })
    ).rejects.toMatchObject({ statusCode: 400, code: "TOPIC_REQUIRED" });
    expect(callOpenAiJson).not.toHaveBeenCalled();
  });
});
