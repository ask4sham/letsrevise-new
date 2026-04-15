/**
 * @jest-environment node
 */
const { buildCheckpointPageBreakdown } = require("../utils/checkpointPageBreakdown");

describe("buildCheckpointPageBreakdown", () => {
  test("empty attempts", () => {
    expect(buildCheckpointPageBreakdown([])).toEqual([]);
  });

  test("ignores practice rows", () => {
    const rows = buildCheckpointPageBreakdown([
      { source: "practice", isCorrect: true },
      { source: "checkpoint", isCorrect: true, pageId: "p1" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].pageId).toBe("p1");
    expect(rows[0].attempts).toBe(1);
  });

  test("mixed legacy (no pageId) and new (pageId + revision)", () => {
    const rows = buildCheckpointPageBreakdown(
      [
        { source: "checkpoint", isCorrect: true },
        { source: "checkpoint", isCorrect: false },
        { source: "checkpoint", isCorrect: true, pageId: "p_a" },
        { source: "checkpoint", isCorrect: false, pageId: "p_a", checkpointRevision: 1 },
        { source: "checkpoint", isCorrect: true, pageId: "p_a", checkpointRevision: 1 },
        { source: "checkpoint", isCorrect: true, pageId: "p_b" },
      ],
      new Map([
        ["p_a", "Page A"],
        ["p_b", "Page B"],
      ])
    );
    const legacy = rows.find((r) => r.pageId === null && r.checkpointRevision === null);
    expect(legacy?.attempts).toBe(2);
    expect(legacy?.pageTitle).toBeNull();

    const pa = rows.find((r) => r.pageId === "p_a" && r.checkpointRevision === null);
    expect(pa?.attempts).toBe(1);
    expect(pa?.pageTitle).toBe("Page A");

    const paRev = rows.find((r) => r.pageId === "p_a" && r.checkpointRevision === 1);
    expect(paRev?.attempts).toBe(2);
    expect(paRev?.accuracy).toBe(0.5);

    const pb = rows.find((r) => r.pageId === "p_b");
    expect(pb?.attempts).toBe(1);
    expect(pb?.pageTitle).toBe("Page B");
  });
});
