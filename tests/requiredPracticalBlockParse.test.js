const {
  detectRpSpecialistBlock,
  parseEquipmentItems,
  parseMarkdownTable,
  parseMethodSteps,
} = require("../lib/teacherBrain/requiredPracticalBlockParse");

describe("requiredPracticalBlockParse (V2.2)", () => {
  test("detects specialist blocks by role and title", () => {
    expect(detectRpSpecialistBlock({ role: "equipment", title: "Equipment" })).toBe("equipment");
    expect(detectRpSpecialistBlock({ role: "method", title: "Method" })).toBe("method");
    expect(detectRpSpecialistBlock({ role: "resultsTable", title: "Results Table" })).toBe(
      "resultsTable"
    );
    expect(detectRpSpecialistBlock({ role: "evaluationGrid", title: "Evaluation Grid" })).toBe(
      "evaluationGrid"
    );
    expect(detectRpSpecialistBlock({ role: "concept", title: "Core Teaching" })).toBeNull();
  });

  test("parseEquipmentItems extracts bullet list", () => {
    const items = parseEquipmentItems(
      "**Equipment list:**\n- 30 cm ruler\n- Partner\n- Calculator"
    );
    expect(items).toEqual(["30 cm ruler", "Partner", "Calculator"]);
  });

  test("parseMethodSteps extracts numbered procedure", () => {
    const steps = parseMethodSteps(
      "1. Sit comfortably with forearm resting on the table.\n2. Partner holds ruler vertically.\n3. Partner releases ruler.\n4. Catch ruler.\n5. Record distance."
    );
    expect(steps).toHaveLength(5);
    expect(steps[0]).toMatch(/Sit comfortably/i);
  });

  test("parseMarkdownTable parses results table with Mean row", () => {
    const table = parseMarkdownTable(
      "| Trial | Distance (cm) | Notes |\n| --- | --- | --- |\n| 1 | | |\n| Mean | | |"
    );
    expect(table.headers).toEqual(["Trial", "Distance (cm)", "Notes"]);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[1][0]).toBe("Mean");
  });
});
