import {
  applyAiCompositeDraftToFormFields,
  compositeFormHasDraftContent,
  mapAiCompositeDraftToParts,
} from "./compositeAiDraft";
import type { AiCompositeDraft } from "./compositeAiDraft";

const sampleDraft: AiCompositeDraft = {
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
      markSchemeLines: ["Award 1 mark for one parent / no gametes."],
    },
    {
      label: "b",
      type: "short",
      marks: 2,
      questionText: "Describe one advantage of asexual reproduction.",
      markSchemeLines: [
        "Award 1 mark for rapid increase.",
        "Award 1 mark for identical useful traits.",
      ],
    },
  ],
};

const mixedDraft: AiCompositeDraft = {
  title: "Asexual reproduction basics",
  sharedStem: "A gardener grows identical strawberry plants from runners.",
  difficulty: "easy",
  totalMarks: 3,
  parts: [
    {
      label: "a",
      type: "mcq",
      marks: 1,
      questionText: "Which statement best describes asexual reproduction?",
      options: [
        "Two parents and varied offspring",
        "One parent and identical offspring",
        "Gametes always fuse",
        "Meiosis always occurs first",
      ],
      correctIndex: 1,
      markSchemeLines: ["Award 1 mark for selecting Option B."],
    },
    {
      label: "b",
      type: "short",
      marks: 2,
      questionText: "Describe one advantage of asexual reproduction.",
      markSchemeLines: [
        "Award 1 mark for rapid increase.",
        "Award 1 mark for identical useful traits.",
      ],
    },
    {
      label: "c",
      type: "table",
      marks: 2,
      questionText: "Complete the table.",
      markSchemeLines: ["Should be ignored by mapper"],
    },
  ],
};

describe("compositeAiDraft mapping", () => {
  test("maps parts to CompositePartForm short shape", () => {
    const parts = mapAiCompositeDraftToParts(sampleDraft);
    expect(parts).toHaveLength(2);
    expect(parts[0].type).toBe("short");
    expect(parts[0].marks).toBe(1);
    expect(parts[0].markScheme).toContain("Award 1 mark");
    expect(parts[1].markScheme.split("\n")).toHaveLength(2);
  });

  test("MCQ AI part maps to CompositePartForm correctly", () => {
    const parts = mapAiCompositeDraftToParts(mixedDraft);
    expect(parts[0].type).toBe("mcq");
    expect(parts[0].options.slice(0, 4)).toEqual([
      "Two parents and varied offspring",
      "One parent and identical offspring",
      "Gametes always fuse",
      "Meiosis always occurs first",
    ]);
    expect(parts[0].correctIndex).toBe(1);
    expect(parts[0].markScheme).toContain("Option B");
  });

  test("table parts are not mapped", () => {
    const parts = mapAiCompositeDraftToParts(mixedDraft);
    expect(parts.every((p) => p.type !== "table")).toBe(true);
    expect(parts).toHaveLength(2);
  });

  test("applyAiCompositeDraftToFormFields sets title, stem and mixed parts", () => {
    const fields = applyAiCompositeDraftToFormFields(mixedDraft);
    expect(fields.title).toBe(mixedDraft.title);
    expect(fields.sharedStem).toBe(mixedDraft.sharedStem);
    expect(fields.parts.map((p) => p.type)).toEqual(["mcq", "short"]);
    expect(fields.stimulusTable).toBeNull();
    expect(fields.questionStyle).toBe("standard");
  });

  test("data-table draft maps to sharedStem + short parts + stimulusTable", () => {
    const dataDraft: AiCompositeDraft = {
      title: "Enzyme temperature investigation",
      sharedStem: "A student investigated the effect of temperature on enzyme activity.",
      difficulty: "easy",
      questionStyle: "data_table",
      totalMarks: 3,
      dataTable: {
        title: "Results",
        columns: [
          { heading: "Temperature", unit: "°C" },
          { heading: "Rate", unit: "s⁻¹" },
        ],
        rows: [
          ["20", "0.013"],
          ["30", "0.022"],
          ["40", "0.040"],
        ],
      },
      parts: [
        {
          label: "a",
          type: "short",
          marks: 1,
          questionText: "State the temperature at which the rate was highest.",
          markSchemeLines: ["Award 1 mark for 40 °C."],
        },
        {
          label: "b",
          type: "short",
          marks: 2,
          questionText: "Describe the trend shown by the rate results.",
          markSchemeLines: [
            "Award 1 mark for rate increases to 40 °C.",
            "Award 1 mark for rate then falls.",
          ],
        },
      ],
    };
    const fields = applyAiCompositeDraftToFormFields(dataDraft);
    expect(fields.questionStyle).toBe("data_table");
    expect(fields.stimulusTable?.columns).toHaveLength(2);
    expect(fields.stimulusTable?.rows).toHaveLength(3);
    expect(fields.parts.every((p) => p.type === "short")).toBe(true);
    expect(fields.parts).toHaveLength(2);
  });

  test("compositeFormHasDraftContent detects existing content", () => {
    expect(compositeFormHasDraftContent({ title: "", sharedStem: "", parts: [] })).toBe(false);
    expect(
      compositeFormHasDraftContent({
        title: "",
        sharedStem: "",
        parts: [{ questionText: "Explain osmosis." }],
      })
    ).toBe(true);
    expect(
      compositeFormHasDraftContent({
        title: "",
        sharedStem: "",
        parts: [],
        stimulusTable: {
          columns: [{ heading: "T", unit: "°C" }, { heading: "R", unit: "s⁻¹" }],
          rows: [["1", "2"], ["3", "4"], ["5", "6"]],
        },
      })
    ).toBe(true);
  });
});
