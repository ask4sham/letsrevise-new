import {
  buildCompositeSaveParts,
  compositeSaveHasTablePart,
  getCompositePartTypeOptions,
  makeDefaultTablePartData,
  mapApiPartToCompositePartForm,
  MCQ_EXPLANATION_MAX_LENGTH,
  serializeCompositePartForSave,
  validateCompositePartForm,
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

  test("MCQ serialization unchanged when no explanation (no partData)", () => {
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
    expect(serializeCompositePartForSave(part)).not.toHaveProperty("partData");
  });

  test("MCQ serialization includes trimmed partData.explanation", () => {
    const part: CompositePartForm = {
      label: "a",
      type: "mcq",
      marks: 1,
      questionText: "Which factor is NOT essential?",
      options: ["Water", "Light", "", ""],
      correctIndex: 1,
      markScheme: "Award 1 mark for selecting Light.",
      partData: {
        explanation:
          "  Light is not essential for germination because the seed initially uses energy stored in its food reserves.  ",
      },
    };
    expect(serializeCompositePartForSave(part)).toEqual({
      label: "a",
      type: "mcq",
      marks: 1,
      questionText: "Which factor is NOT essential?",
      markScheme: ["Award 1 mark for selecting Light."],
      options: ["Water", "Light"],
      correctIndex: 1,
      partData: {
        explanation:
          "Light is not essential for germination because the seed initially uses energy stored in its food reserves.",
      },
    });
  });

  test("MCQ serialization omits partData when explanation is whitespace-only", () => {
    const part: CompositePartForm = {
      label: "a",
      type: "mcq",
      marks: 1,
      questionText: "Pick one.",
      options: ["A", "B"],
      correctIndex: 0,
      markScheme: "",
      partData: { explanation: "   " },
    };
    const saved = serializeCompositePartForSave(part);
    expect(saved).not.toHaveProperty("partData");
  });

  test("mapApiPartToCompositePartForm loads MCQ explanation", () => {
    const loaded = mapApiPartToCompositePartForm(
      {
        label: "a",
        type: "mcq",
        marks: 1,
        questionText: "Pick one.",
        options: ["A", "B"],
        correctIndex: 0,
        markScheme: ["Admin line"],
        partData: { explanation: "Water activates enzymes." },
      },
      0,
      false
    );
    expect(loaded.type).toBe("mcq");
    expect(loaded.partData).toEqual({ explanation: "Water activates enzymes." });
    expect(loaded.markScheme).toBe("Admin line");
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
    expect(loaded.partData && "headers" in loaded.partData ? loaded.partData.headers : undefined).toEqual(["H1"]);
    expect(
      loaded.partData && "rows" in loaded.partData ? loaded.partData.rows[0].cells[0].blank : undefined
    ).toBe(true);
    expect(
      loaded.partData && "rows" in loaded.partData ? loaded.partData.rows[0].cells[0].correctAnswer : undefined
    ).toBe("x");
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

  test("validateCompositePartForm uses trimmed length for the 1000-character limit", () => {
    const base: CompositePartForm = {
      label: "a",
      type: "mcq",
      marks: 1,
      questionText: "Pick one.",
      options: ["A", "B"],
      correctIndex: 0,
      markScheme: "",
    };
    expect(
      validateCompositePartForm({
        ...base,
        partData: { explanation: `  ${"x".repeat(999)}  ` },
      })
    ).toBeNull();
    expect(
      validateCompositePartForm({
        ...base,
        partData: { explanation: `  ${"x".repeat(1000)}  ` },
      })
    ).toBeNull();
    expect(
      validateCompositePartForm({
        ...base,
        partData: { explanation: "x".repeat(1001) },
      })
    ).toBe(`Part (a) explanation must be at most ${MCQ_EXPLANATION_MAX_LENGTH} characters.`);
  });
});
