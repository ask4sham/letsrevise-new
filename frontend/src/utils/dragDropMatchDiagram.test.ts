import {
  coerceDiagramZonePct,
  dedupeDiagramZoneIds,
  isDragDropDiagramMode,
  logDragDropMatchZoneBindings,
  mergeDiagramZoneExplanation,
  parseDragDropMatchMode,
  repairDiagramDropZonesForLessonEditor,
  resolveDragDropMatchModeForPersist,
  sanitizeDiagramDropZonesForAuthoring,
  sanitizePlacedDiagramDropZones,
} from "./dragDropMatchDiagram";

describe("dragDropMatchDiagram", () => {
  describe("coerceDiagramZonePct", () => {
    it("parses numeric strings from JSON/API", () => {
      expect(coerceDiagramZonePct("37.5")).toBe(37.5);
      expect(coerceDiagramZonePct(" 12 ")).toBe(12);
    });

    it("returns undefined for non-numeric garbage", () => {
      expect(coerceDiagramZonePct("")).toBeUndefined();
      expect(coerceDiagramZonePct(undefined)).toBeUndefined();
      expect(coerceDiagramZonePct(NaN)).toBeUndefined();
    });
  });

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

    it("dedupes duplicate zone ids after sanitize", () => {
      const z = sanitizePlacedDiagramDropZones(
        [
          { id: "same", x: 10, y: 10, correctPairId: "a" },
          { id: "same", x: 20, y: 20, correctPairId: "b" },
        ],
        ["a", "b"]
      );
      expect(z.map((x) => x.id)).toEqual(["same", "same__dup1"]);
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

    it("accepts string x/y (Mongo/JSON hydration)", () => {
      const raw = [{ id: "z1", x: "10", y: "20", correctPairId: "a" }];
      const z = sanitizePlacedDiagramDropZones(raw, pairIds);
      expect(z).toHaveLength(1);
      expect(z[0]).toMatchObject({ id: "z1", x: 10, y: 20, correctPairId: "a" });
    });
  });

  describe("dedupeDiagramZoneIds", () => {
    it("suffixes duplicate zone ids so placements/React keys stay distinct", () => {
      const out = dedupeDiagramZoneIds([
        { id: "dup", correctPairId: "a" },
        { id: "dup", correctPairId: "b" },
        { id: "dup", correctPairId: "c" },
      ]);
      expect(out.map((z) => z.id)).toEqual(["dup", "dup__dup1", "dup__dup2"]);
      expect(out.map((z) => z.correctPairId)).toEqual(["a", "b", "c"]);
    });
  });

  describe("repairDiagramDropZonesForLessonEditor", () => {
    let idCounter = 0;
    const nextId = () => {
      idCounter += 1;
      return `nid_${idCounter}`;
    };

    beforeEach(() => {
      idCounter = 0;
    });

    it("issues new ids, keeps order and coords, and fixes invalid correctPairId to first pair", () => {
      const out = repairDiagramDropZonesForLessonEditor(
        [
          { id: "dup", x: 11, y: 22, correctPairId: "missing", explanation: " Z " },
          { id: "dup", x: 33, y: 44, correctPairId: "p2" },
        ],
        [{ id: "p1" }, { id: "p2" }],
        nextId
      );
      expect(out).toHaveLength(2);
      expect(out[0].id).not.toBe("dup");
      expect(out[1].id).not.toBe("dup");
      expect(out[0].id).not.toBe(out[1].id);
      expect(out[0].x).toBe(11);
      expect(out[0].y).toBe(22);
      expect(out[0].correctPairId).toBe("p1");
      expect(out[1].correctPairId).toBe("p2");
      expect(out[0].explanation).toBe("Z");
    });

    it("alignZoneIndexToPairIndex assigns pair ids by zone row order", () => {
      const out = repairDiagramDropZonesForLessonEditor(
        [
          { id: "z", x: 1, y: 2, correctPairId: "WRONG" },
          { id: "z", x: 3, y: 4, correctPairId: "WRONG" },
          { id: "z", x: 5, y: 6, correctPairId: "WRONG" },
          { id: "z", x: 7, y: 8, correctPairId: "WRONG" },
        ],
        [{ id: "ph" }, { id: "ly" }, { id: "ab" }, { id: "at" }],
        nextId,
        { alignZoneIndexToPairIndex: true }
      );
      expect(out.map((z) => z.correctPairId)).toEqual(["ph", "ly", "ab", "at"]);
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
    it("accepts trimmed / alternate casing from APIs", () => {
      expect(isDragDropDiagramMode(" Diagram ")).toBe(true);
      expect(isDragDropDiagramMode("DIAGRAM")).toBe(true);
    });
    it("infers diagram when image + drop zones exist but matchMode missing", () => {
      expect(
        isDragDropDiagramMode(undefined, {
          imageUrl: "/a.png",
          dropZones: [{ id: "z1", correctPairId: "p1" }],
        })
      ).toBe(true);
    });
    it("respects explicit text over inference context", () => {
      expect(
        isDragDropDiagramMode("text", {
          imageUrl: "/a.png",
          dropZones: [{ id: "z1", correctPairId: "p1" }],
        })
      ).toBe(false);
    });
  });

  describe("resolveDragDropMatchModeForPersist", () => {
    it("returns diagram when matchMode missing but image and zones present", () => {
      expect(
        resolveDragDropMatchModeForPersist(undefined, {
          imageUrl: "https://x/y.png",
          dropZones: [{ id: "dz1", correctPairId: "pair_a" }],
        })
      ).toBe("diagram");
    });
    it("returns undefined when zones lack correctPairId", () => {
      expect(
        resolveDragDropMatchModeForPersist(undefined, {
          imageUrl: "https://x/y.png",
          dropZones: [{ id: "dz1" }],
        })
      ).toBeUndefined();
    });
    it("prefers explicit text", () => {
      expect(
        resolveDragDropMatchModeForPersist("text", {
          imageUrl: "https://x/y.png",
          dropZones: [{ id: "z1", correctPairId: "p1" }],
        })
      ).toBe("text");
    });
  });

  describe("parseDragDropMatchMode", () => {
    it("normalizes casing and whitespace", () => {
      expect(parseDragDropMatchMode(" diagram\n")).toBe("diagram");
      expect(parseDragDropMatchMode("TEXT")).toBe("text");
    });
  });

  describe("logDragDropMatchZoneBindings", () => {
    it("no-ops when DEBUG_DDM is unset", () => {
      const ls = window.localStorage;
      const prev = ls.getItem("DEBUG_DDM");
      ls.removeItem("DEBUG_DDM");
      expect(() =>
        logDragDropMatchZoneBindings("t", [{ id: "z1", correctPairId: "p1" }], [{ id: "p1", answer: "A" }])
      ).not.toThrow();
      if (prev != null) ls.setItem("DEBUG_DDM", prev);
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
