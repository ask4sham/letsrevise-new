/**
 * Block 28 Practice Integrity V1 — policy and mark-scheme invariant unit tests.
 */
const {
  isBlock28SupportedType,
  validateShortMarksMarkSchemeInvariant,
  filterBlock28SupportedPracticeQuestions,
  normalizeMarkSchemeLines,
} = require("../../lib/block28PracticePolicy");

describe("block28PracticePolicy", () => {
  test("mcq and short are supported", () => {
    expect(isBlock28SupportedType("mcq")).toBe(true);
    expect(isBlock28SupportedType("short")).toBe(true);
  });

  test("composite, label, table, data are unsupported", () => {
    for (const type of ["composite", "label", "table", "data"]) {
      expect(isBlock28SupportedType(type)).toBe(false);
    }
  });

  test("4-mark short with 4 mark points passes", () => {
    const out = validateShortMarksMarkSchemeInvariant(4, ["A", "B", "C", "D"]);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.marks).toBe(4);
      expect(out.markScheme).toHaveLength(4);
    }
  });

  test("4-mark short with 2 mark points fails", () => {
    const out = validateShortMarksMarkSchemeInvariant(4, ["A", "B"]);
    expect(out.ok).toBe(false);
  });

  test("2-mark short with 3 mark points fails", () => {
    const out = validateShortMarksMarkSchemeInvariant(2, ["A", "B", "C"]);
    expect(out.ok).toBe(false);
  });

  test("1-mark short with 1 mark point passes", () => {
    const out = validateShortMarksMarkSchemeInvariant(1, ["One point"]);
    expect(out.ok).toBe(true);
  });

  test("blank mark-scheme lines do not count as awardable points", () => {
    expect(normalizeMarkSchemeLines(["A", "", "  ", "B"])).toEqual(["A", "B"]);
    const out = validateShortMarksMarkSchemeInvariant(2, ["A", "", "B"]);
    expect(out.ok).toBe(true);
  });

  test("filterBlock28SupportedPracticeQuestions drops composite", () => {
    const rows = [
      { id: "1", type: "short", question: "S" },
      { id: "2", type: "composite", question: "C" },
      { id: "3", type: "mcq", question: "M" },
    ];
    expect(filterBlock28SupportedPracticeQuestions(rows).map((r) => r.id)).toEqual(["1", "3"]);
  });
});
