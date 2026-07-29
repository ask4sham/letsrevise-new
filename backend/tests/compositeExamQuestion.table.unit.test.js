/**
 * Backend unit tests: composite table parts (Phase 1).
 * V1 mcq/short behaviour must remain unchanged.
 */

const {
  PART_TYPES,
  normalizePart,
  validateCompositeDraft,
  validateCompositePublish,
  buildCompositeFields,
} = require("../utils/compositeExamQuestion");

describe("compositeExamQuestion table parts", () => {
  test("PART_TYPES includes table additively", () => {
    expect(PART_TYPES).toEqual(expect.arrayContaining(["mcq", "short", "table"]));
  });

  test("normalizePart preserves V1 mcq without partData", () => {
    const part = normalizePart(
      {
        label: "a",
        type: "mcq",
        marks: 1,
        questionText: "Pick one",
        options: ["A", "B"],
        correctIndex: 0,
      },
      0
    );
    expect(part.type).toBe("mcq");
    expect(part.partData).toBeUndefined();
  });

  test("normalizePart preserves MCQ explanation and strips unexpected keys", () => {
    const part = normalizePart(
      {
        type: "mcq",
        marks: 1,
        questionText: "Pick one",
        options: ["A", "B"],
        correctIndex: 0,
        partData: {
          explanation: "  Water activates enzymes.  ",
          unexpectedKey: "remove me",
        },
      },
      0
    );
    expect(part.partData).toEqual({ explanation: "Water activates enzymes." });
    expect(part.partData).not.toHaveProperty("unexpectedKey");
  });

  test("normalizePart omits empty or whitespace-only MCQ explanation", () => {
    const empty = normalizePart(
      {
        type: "mcq",
        marks: 1,
        questionText: "Pick one",
        options: ["A", "B"],
        correctIndex: 0,
        partData: { explanation: "   " },
      },
      0
    );
    expect(empty.partData).toBeUndefined();

    const blankObj = normalizePart(
      {
        type: "mcq",
        marks: 1,
        questionText: "Pick one",
        options: ["A", "B"],
        correctIndex: 0,
        partData: {},
      },
      0
    );
    expect(blankObj.partData).toBeUndefined();
  });

  test("normalizePart accepts exactly 1000 trimmed explanation characters", () => {
    const explanation = "x".repeat(1000);
    const part = normalizePart(
      {
        type: "mcq",
        marks: 1,
        questionText: "Pick one",
        options: ["A", "B"],
        correctIndex: 0,
        partData: { explanation: `  ${explanation}  ` },
      },
      0
    );
    expect(part.partData).toEqual({ explanation });
  });

  test("normalizePart rejects 1001 trimmed explanation characters without truncating", () => {
    expect(() =>
      normalizePart(
        {
          label: "a",
          type: "mcq",
          marks: 1,
          questionText: "Pick one",
          options: ["A", "B"],
          correctIndex: 0,
          partData: { explanation: "x".repeat(1001) },
        },
        0
      )
    ).toThrow(/at most 1000 characters/i);
  });

  test("whitespace padding does not count toward the 1000-character limit", () => {
    const paddedUnder = `  ${"x".repeat(999)}  `;
    const under = normalizePart(
      {
        type: "mcq",
        marks: 1,
        questionText: "Pick one",
        options: ["A", "B"],
        correctIndex: 0,
        partData: { explanation: paddedUnder },
      },
      0
    );
    expect(under.partData.explanation).toBe("x".repeat(999));

    const paddedExact = `  ${"x".repeat(1000)}  `;
    const exact = normalizePart(
      {
        type: "mcq",
        marks: 1,
        questionText: "Pick one",
        options: ["A", "B"],
        correctIndex: 0,
        partData: { explanation: paddedExact },
      },
      0
    );
    expect(exact.partData.explanation).toBe("x".repeat(1000));
  });

  test("normalizePart rejects non-string MCQ explanation types", () => {
    for (const explanation of [{ nested: true }, ["arr"], 42, true, null]) {
      const part = normalizePart(
        {
          type: "mcq",
          marks: 1,
          questionText: "Pick one",
          options: ["A", "B"],
          correctIndex: 0,
          partData: { explanation },
        },
        0
      );
      expect(part.partData).toBeUndefined();
    }
  });

  test("normalizePart leaves short parts without partData", () => {
    const part = normalizePart(
      {
        type: "short",
        marks: 2,
        questionText: "Explain",
        markScheme: ["Point"],
        partData: { explanation: "should not persist on short" },
      },
      0
    );
    expect(part.type).toBe("short");
    expect(part.partData).toBeUndefined();
  });

  test("validateCompositeDraft rejects MCQ explanation over 1000 characters", () => {
    const result = validateCompositeDraft({
      topicKey: "edexcel_igcse_biology_topic",
      sharedStem: "Shared stem for the composite question.",
      parts: [
        {
          label: "a",
          type: "mcq",
          marks: 1,
          questionText: "Which is correct?",
          options: ["A", "B"],
          correctIndex: 0,
          partData: { explanation: "x".repeat(1001) },
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.msg).toMatch(/at most 1000 characters/i);
  });

  test("validateCompositeDraft accepts exactly 1000 trimmed characters with padding", () => {
    const result = validateCompositeDraft({
      topicKey: "edexcel_igcse_biology_topic",
      sharedStem: "Shared stem for the composite question.",
      parts: [
        {
          label: "a",
          type: "mcq",
          marks: 1,
          questionText: "Which is correct?",
          options: ["A", "B"],
          correctIndex: 0,
          partData: { explanation: `  ${"x".repeat(1000)}  ` },
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  test("normalizePart stores table partData", () => {
    const part = normalizePart(
      {
        label: "b",
        type: "table",
        marks: 2,
        questionText: "Complete the table",
        markScheme: ["Award 1 mark per correct cell"],
        partData: {
          headers: ["Nutrient", "%"],
          rows: [
            {
              cells: [
                { value: "Calcium" },
                { blank: true, correctAnswer: "12" },
              ],
            },
          ],
        },
      },
      1
    );
    expect(part.type).toBe("table");
    expect(part.partData.headers).toEqual(["Nutrient", "%"]);
    expect(part.partData.rows[0].cells[1].correctAnswer).toBe("12");
  });

  test("draft validation accepts valid table part", () => {
    const result = validateCompositeDraft({
      topicKey: "edexcel_igcse_biology_topic",
      sharedStem: "Use the data in the table.",
      parts: [
        {
          label: "a",
          type: "table",
          marks: 2,
          questionText: "Complete the table",
          partData: {
            headers: ["A", "B"],
            rows: [
              {
                cells: [
                  { value: "row" },
                  { blank: true, correctAnswer: "1" },
                ],
              },
            ],
          },
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  test("publish validation requires mark scheme for table", () => {
    const doc = {
      topicKey: "edexcel_igcse_biology_topic",
      sharedStem: "Use the data in the table.",
      parts: [
        {
          label: "a",
          type: "table",
          marks: 2,
          questionText: "Complete the table",
          partData: {
            headers: ["A", "B"],
            rows: [
              {
                cells: [
                  { value: "row" },
                  { blank: true, correctAnswer: "1" },
                ],
              },
            ],
          },
        },
      ],
    };
    expect(validateCompositePublish(doc).ok).toBe(false);
    doc.parts[0].markScheme = ["1 mark for correct cell value"];
    expect(validateCompositePublish(doc).ok).toBe(true);
  });

  test("buildCompositeFields sets schemaVersion 2 when table present", () => {
    const fields = buildCompositeFields({
      sharedStem: "Stem",
      parts: [
        {
          label: "a",
          type: "table",
          marks: 1,
          questionText: "Table",
          partData: {
            headers: ["A"],
            rows: [{ cells: [{ blank: true, correctAnswer: "x" }] }],
          },
        },
      ],
    });
    expect(fields.schemaVersion).toBe(2);
  });

  test("buildCompositeFields omits schemaVersion for V1-only parts", () => {
    const fields = buildCompositeFields({
      sharedStem: "Stem",
      parts: [
        {
          label: "a",
          type: "short",
          marks: 1,
          questionText: "Explain",
          markScheme: ["Point one is long enough"],
        },
      ],
    });
    expect(fields.schemaVersion).toBeUndefined();
  });
});
