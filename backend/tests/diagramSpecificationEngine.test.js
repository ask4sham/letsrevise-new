/**
 * P3.0A — Diagram Specification Engine tests (no production imports).
 */
const {
  SCHEMA_VERSION,
  DIAGRAM_TYPES,
  INTERACTION_TYPES,
  validateDiagramSpecification,
  EXAMPLE_SPECS,
  REFLEX_ARC_SPEC,
} = require("../services/diagramSpecificationEngine");

describe("diagramSpecificationEngine", () => {
  test("schema exports diagram and interaction type enums", () => {
    expect(DIAGRAM_TYPES).toContain("hotspot");
    expect(DIAGRAM_TYPES).toContain("process");
    expect(DIAGRAM_TYPES).toContain("labelled");
    expect(DIAGRAM_TYPES).toContain("practical-setup");
    expect(DIAGRAM_TYPES).toContain("compare-contrast");
    expect(DIAGRAM_TYPES).toContain("flowchart");
    expect(INTERACTION_TYPES).toContain("tti");
    expect(INTERACTION_TYPES).toContain("drag-drop");
  });

  test("all four example specifications validate", () => {
    expect(EXAMPLE_SPECS).toHaveLength(4);
    for (const spec of EXAMPLE_SPECS) {
      const result = validateDiagramSpecification(spec);
      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.normalized?.schemaVersion).toBe(SCHEMA_VERSION);
    }
  });

  test("reflex arc example has process diagram type and ordered labels", () => {
    const result = validateDiagramSpecification(REFLEX_ARC_SPEC);
    expect(result.normalized?.diagramType).toBe("process");
    expect(result.normalized?.labels.length).toBeGreaterThanOrEqual(8);
    const ordered = result.normalized?.labels.filter((l) => typeof l.order === "number") || [];
    expect(ordered.length).toBeGreaterThanOrEqual(2);
    expect(result.normalized?.activities?.hotspots?.length).toBe(8);
  });

  test("rejects missing required fields", () => {
    const result = validateDiagramSpecification({ schemaVersion: SCHEMA_VERSION });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "REQUIRED")).toBe(true);
  });

  test("rejects invalid diagramType", () => {
    const result = validateDiagramSpecification({
      ...REFLEX_ARC_SPEC,
      diagramType: "infographic",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.path === "diagramType")).toBe(true);
  });

  test("rejects duplicate label ids", () => {
    const broken = {
      ...REFLEX_ARC_SPEC,
      labels: [
        { id: "dup", text: "ONE" },
        { id: "dup", text: "TWO" },
      ],
    };
    const result = validateDiagramSpecification(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "DUPLICATE")).toBe(true);
  });

  test("rejects unknown labelId in activity hotspot seed", () => {
    const broken = {
      ...REFLEX_ARC_SPEC,
      activities: {
        hotspots: [{ id: "Z", labelId: "nonexistent" }],
      },
    };
    const result = validateDiagramSpecification(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "REFERENCE")).toBe(true);
  });

  test("rejects wrong schema version", () => {
    const result = validateDiagramSpecification({
      ...REFLEX_ARC_SPEC,
      schemaVersion: "1.0",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.path === "schemaVersion")).toBe(true);
  });

  test("strict mode rejects unknown top-level fields", () => {
    const result = validateDiagramSpecification(
      { ...REFLEX_ARC_SPEC, extraField: true },
      { strict: true }
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "UNKNOWN_FIELD")).toBe(true);
  });

  test("normalizes tier casing", () => {
    const result = validateDiagramSpecification({
      ...REFLEX_ARC_SPEC,
      tier: "higher",
    });
    expect(result.ok).toBe(true);
    expect(result.normalized?.tier).toBe("Higher");
  });
});
