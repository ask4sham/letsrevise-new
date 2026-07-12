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

describe("compositeAiDraft mapping", () => {
  test("maps parts to CompositePartForm short shape", () => {
    const parts = mapAiCompositeDraftToParts(sampleDraft);
    expect(parts).toHaveLength(2);
    expect(parts[0].type).toBe("short");
    expect(parts[0].marks).toBe(1);
    expect(parts[0].markScheme).toContain("Award 1 mark");
    expect(parts[1].markScheme.split("\n")).toHaveLength(2);
  });

  test("applyAiCompositeDraftToFormFields sets title and stem", () => {
    const fields = applyAiCompositeDraftToFormFields(sampleDraft);
    expect(fields.title).toBe(sampleDraft.title);
    expect(fields.sharedStem).toBe(sampleDraft.sharedStem);
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
  });
});
