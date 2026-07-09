import {
  buildCompositeSaveParts,
  compositeSaveHasTablePart,
  getCompositePartTypeOptions,
  makeDefaultTablePartData,
  mapApiPartToCompositePartForm,
  serializeCompositePartForSave,
  type CompositePartForm,
} from "./compositeTableEditorUtils";

describe("compositeTableEditorUtils", () => {
  test("flag OFF: Table option hidden from part type list", () => {
    expect(getCompositePartTypeOptions(false)).toEqual(["short", "mcq"]);
    expect(getCompositePartTypeOptions(false)).not.toContain("table");
  });

  test("flag ON: Table option visible in part type list", () => {
    expect(getCompositePartTypeOptions(true)).toEqual(["short", "mcq", "table"]);
  });

  test("table partData persists through serializeCompositePartForSave", () => {
    const part: CompositePartForm = {
      label: "a",
      type: "table",
      marks: 3,
      questionText: "Complete the table.",
      options: [],
      correctIndex: 0,
      markScheme: "One mark per blank",
      partData: {
        headers: ["Structure", "Function"],
        rows: [
          {
            cells: [
              { value: "Mitochondria", blank: true, correctAnswer: "Mitochondria" },
              { value: "Releases energy", blank: false },
            ],
          },
        ],
      },
    };

    const saved = serializeCompositePartForSave(part);
    expect(saved.type).toBe("table");
    expect(saved.options).toEqual([]);
    expect(saved.correctIndex).toBeNull();
    expect(saved.partData).toEqual(part.partData);
    expect(saved).not.toHaveProperty("headers");
    expect(saved).not.toHaveProperty("rows");
  });

  test("buildCompositeSaveParts sets schemaVersion hint via compositeSaveHasTablePart", () => {
    const mcqPart: CompositePartForm = {
      label: "a",
      type: "mcq",
      marks: 1,
      questionText: "Pick one.",
      options: ["A", "B"],
      correctIndex: 0,
      markScheme: "",
    };
    const tablePart: CompositePartForm = {
      ...mcqPart,
      type: "table",
      partData: makeDefaultTablePartData(),
    };

    expect(compositeSaveHasTablePart([mcqPart])).toBe(false);
    expect(compositeSaveHasTablePart([tablePart])).toBe(true);

    const mcqSaved = buildCompositeSaveParts([mcqPart])[0];
    expect(mcqSaved).toEqual({
      label: "a",
      type: "mcq",
      marks: 1,
      questionText: "Pick one.",
      markScheme: [],
      options: ["A", "B"],
      correctIndex: 0,
    });
    expect(mcqSaved).not.toHaveProperty("partData");
  });

  test("MCQ serialization unchanged (no partData)", () => {
    const part: CompositePartForm = {
      label: "b",
      type: "mcq",
      marks: 1,
      questionText: "Which is correct?",
      options: ["Wrong", "Right", "", ""],
      correctIndex: 1,
      markScheme: "Correct answer: B",
    };
    expect(serializeCompositePartForSave(part)).toEqual({
      label: "b",
      type: "mcq",
      marks: 1,
      questionText: "Which is correct?",
      markScheme: ["Correct answer: B"],
      options: ["Wrong", "Right"],
      correctIndex: 1,
    });
  });

  test("Short serialization unchanged (no partData)", () => {
    const part: CompositePartForm = {
      label: "c",
      type: "short",
      marks: 2,
      questionText: "Explain mitosis.",
      options: ["", "", "", ""],
      correctIndex: 0,
      markScheme: "Point one\nPoint two",
    };
    expect(serializeCompositePartForSave(part)).toEqual({
      label: "c",
      type: "short",
      marks: 2,
      questionText: "Explain mitosis.",
      markScheme: ["Point one", "Point two"],
      options: [],
      correctIndex: null,
    });
  });

  test("mapApiPartToCompositePartForm loads table partData when flag ON", () => {
    const loaded = mapApiPartToCompositePartForm(
      {
        label: "a",
        type: "table",
        marks: 2,
        questionText: "Fill in the table.",
        markScheme: ["Mark 1"],
        partData: {
          headers: ["H1"],
          rows: [{ cells: [{ blank: true, correctAnswer: "x" }] }],
        },
      },
      0,
      true
    );
    expect(loaded.type).toBe("table");
    expect(loaded.partData?.headers).toEqual(["H1"]);
    expect(loaded.partData?.rows[0].cells[0].blank).toBe(true);
    expect(loaded.partData?.rows[0].cells[0].correctAnswer).toBe("x");
  });

  test("mapApiPartToCompositePartForm coerces table to short when flag OFF", () => {
    const loaded = mapApiPartToCompositePartForm(
      { label: "a", type: "table", marks: 2, questionText: "Q", partData: makeDefaultTablePartData() },
      0,
      false
    );
    expect(loaded.type).toBe("short");
    expect(loaded.partData).toBeUndefined();
  });
});
