import {
  applyAiCompositeDraftToFormFields,
  compositeFormHasDraftContent,
  mapAiCompositeDraftToParts,
  type AiCompositeDraft,
} from "./compositeAiDraft";

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
  });
});
