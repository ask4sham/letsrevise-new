import {
  isDragDropDiagramMode,
  mergeDiagramZoneExplanation,
  sanitizeDiagramDropZonesForAuthoring,
  sanitizePlacedDiagramDropZones,
} from "./dragDropMatchDiagram";

describe("dragDropMatchDiagram", () => {
  describe("sanitizePlacedDiagramDropZones", () => {
    const pairIds = ["a", "b"];

    it("drops zones with unknown correctPairId", () => {
      const z = sanitizePlacedDiagramDropZones(
        [{ id: "z1", x: 10, y: 20, correctPairId: "missing" }],
        pairIds
      );
      expect(z).toHaveLength(0);
    });

    it("keeps valid placed zones", () => {
      const z = sanitizePlacedDiagramDropZones(
        [{ id: "z1", x: 10, y: 20, correctPairId: "a", explanation: " Hi " }],
        pairIds
      );
      expect(z).toEqual([{ id: "z1", x: 10, y: 20, correctPairId: "a", explanation: "Hi" }]);
    });

    it("drops zones without finite coords", () => {
      expect(
        sanitizePlacedDiagramDropZones([{ id: "z1", correctPairId: "a", x: 5 }], pairIds)
      ).toHaveLength(0);
    });

    it("clamps x/y into 0–100", () => {
      const z = sanitizePlacedDiagramDropZones(
        [{ id: "z1", x: 150, y: -10, correctPairId: "b" }],
        pairIds
      );
      expect(z[0].x).toBe(100);
      expect(z[0].y).toBe(0);
    });
  });

  describe("sanitizeDiagramDropZonesForAuthoring", () => {
    it("allows valid pair ref without coords", () => {
      const z = sanitizeDiagramDropZonesForAuthoring([{ id: "z1", correctPairId: "p1" }], ["p1"]);
      expect(z).toEqual([{ id: "z1", correctPairId: "p1" }]);
    });

    it("filters invalid pair ref", () => {
      expect(sanitizeDiagramDropZonesForAuthoring([{ id: "z1", correctPairId: "x" }], ["p1"])).toHaveLength(0);
    });
  });

  describe("isDragDropDiagramMode", () => {
    it("is false when matchMode omitted", () => {
      expect(isDragDropDiagramMode(undefined)).toBe(false);
      expect(isDragDropDiagramMode("")).toBe(false);
    });
    it("is true only for explicit diagram", () => {
      expect(isDragDropDiagramMode("diagram")).toBe(true);
      expect(isDragDropDiagramMode("text")).toBe(false);
    });
  });

  describe("mergeDiagramZoneExplanation", () => {
    it("prefers zone over pair", () => {
      expect(mergeDiagramZoneExplanation("Z", "P")).toBe("Z");
    });
    it("falls back to pair", () => {
      expect(mergeDiagramZoneExplanation(undefined, "P")).toBe("P");
    });
  });
});
