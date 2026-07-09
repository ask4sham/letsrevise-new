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
