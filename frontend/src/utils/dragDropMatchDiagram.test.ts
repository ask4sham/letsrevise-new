import {
  buildDragDropMatchBlockForPersist,
  coerceDiagramZonePct,
  dedupeDiagramZoneIds,
  dragDropMatchModeFromBlockForProps,
  dragDropMatchModeFromUiSelect,
  buildContractTextToImageBoxedDropZones,
  buildDefaultTextToImageDropZones,
  buildTextToImageMainDropZones,
  getTtiBoxGeometryLayout,
  isContractPortraitImageAspect,
  normalizeTtiBoxGeometryVersion,
  TTI_BOXED_ZONE_HEIGHT_PCT,
  TTI_BOXED_ZONE_WIDTH_PCT,
  coalesceDragDropMatchBlockPatch,
  dragDropBlockHasRenderableMainImage,
  dragDropPairsHaveTargetImages,
  dragDropTextToImageCanRender,
  isDragDropDiagramMode,
  isDragDropTextToImageMode,
  logDragDropMatchZoneBindings,
  mergeDiagramZoneExplanation,
  parseDragDropMatchMode,
  resolveDragDropMatchModeForUi,
  resolveDragDropPersistMode,
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
      expect(parseDragDropMatchMode("text-to-image")).toBe("text-to-image");
      expect(parseDragDropMatchMode("Text To Image")).toBe("text-to-image");
    });
  });

  describe("buildDefaultTextToImageDropZones", () => {
    it("creates one zone per pair with spread coordinates", () => {
      const z = buildDefaultTextToImageDropZones(["p1", "p2"]);
      expect(z).toHaveLength(2);
      expect(z[0]).toMatchObject({ id: "tti-auto-0", correctPairId: "p1" });
      expect(z[1]).toMatchObject({ id: "tti-auto-1", correctPairId: "p2" });
      expect(z[0].x).toBeGreaterThan(0);
      expect(z[0].y).toBeGreaterThan(0);
    });
  });

  describe("buildContractTextToImageBoxedDropZones", () => {
    it("returns four contract-aligned zones for four pairs", () => {
      const z = buildContractTextToImageBoxedDropZones(["p1", "p2", "p3", "p4"]);
      expect(z).toHaveLength(4);
      expect(z[0]).toMatchObject({ id: "tti-boxed-0", correctPairId: "p1" });
      expect(z[0].x).toBeCloseTo(82.67, 1);
      expect(z[0].y).toBeCloseTo(25.42, 1);
      expect(z[3].y).toBeCloseTo(88.75, 1);
    });

    it("falls back to default grid when pair count is not four", () => {
      const z = buildContractTextToImageBoxedDropZones(["p1", "p2"]);
      expect(z[0].id).toBe("tti-auto-0");
    });
  });

  describe("buildTextToImageMainDropZones", () => {
    it("uses portrait contract layout when layout is portrait and four pairs", () => {
      const z = buildTextToImageMainDropZones(["p1", "p2", "p3", "p4"], "portrait");
      expect(z[0].id).toBe("tti-boxed-0");
      expect(z[0].x).toBeCloseTo(82.67, 1);
    });

    it("uses square-display layout when layout is square-display and four pairs", () => {
      const z = buildTextToImageMainDropZones(["p1", "p2", "p3", "p4"], "square-display");
      expect(z[0].id).toBe("tti-boxed-0");
      expect(z[0].x).toBeCloseTo(70.25, 1);
      expect(z[0].y).toBeCloseTo(25.42, 1);
      expect(z[1].y).toBeCloseTo(47.17, 1);
      expect(z[2].y).toBeCloseTo(67.83, 1);
      expect(z[3].y).toBeCloseTo(88.75, 1);
    });

    it("uses fallback grid when layout is null", () => {
      const z = buildTextToImageMainDropZones(["p1", "p2", "p3", "p4"], null);
      expect(z[0].id).toBe("tti-auto-0");
    });
  });

  describe("isContractPortraitImageAspect", () => {
    it("accepts 900×1350 and 2× export dimensions", () => {
      expect(isContractPortraitImageAspect(900, 1350)).toBe(true);
      expect(isContractPortraitImageAspect(1800, 2700)).toBe(true);
      expect(isContractPortraitImageAspect(1600, 900)).toBe(false);
    });
  });

  describe("TTI boxed zone contract proportions", () => {
    it("matches canonical v1 600×600 display artboard ratios", () => {
      expect(TTI_BOXED_ZONE_WIDTH_PCT).toBeCloseTo(26, 2);
      expect(TTI_BOXED_ZONE_HEIGHT_PCT).toBeCloseTo(12.67, 2);
    });

    it("loads v1 square-display geometry from shared spec", () => {
      const geo = getTtiBoxGeometryLayout("square-display");
      expect(geo.box.widthPx).toBe(156);
      expect(geo.box.heightPx).toBe(76);
      expect(geo.box.centerXPct).toBeCloseTo(70.25, 2);
      expect(geo.zones.map((z) => z.centerYPct)).toEqual([25.42, 47.17, 67.83, 88.75]);
    });

    it("supports legacy geometry version for older assets", () => {
      const geo = getTtiBoxGeometryLayout("square-display", "legacy");
      expect(geo.box.heightPct).toBeCloseTo(14, 2);
      expect(geo.zones[3].centerYPct).toBeCloseTo(91.08, 2);
    });

    it("normalizes geometry version tokens", () => {
      expect(normalizeTtiBoxGeometryVersion(undefined)).toBe("tti-box-geometry-v1");
      expect(normalizeTtiBoxGeometryVersion("legacy")).toBe("legacy");
      expect(normalizeTtiBoxGeometryVersion("tti-box-geometry-legacy")).toBe("legacy");
    });
  });

  describe("dragDropTextToImageCanRender", () => {
    it("is true for main imageUrl without per-pair targets", () => {
      expect(
        dragDropTextToImageCanRender(
          { matchMode: "text-to-image", imageUrl: "https://example.com/main.png" },
          [{ id: "p1", prompt: "A", answer: "B" }]
        )
      ).toBe(true);
    });

    it("is false when mode is not text-to-image", () => {
      expect(
        dragDropTextToImageCanRender(
          { matchMode: "text", imageUrl: "https://example.com/main.png" },
          []
        )
      ).toBe(false);
    });
  });

  describe("dragDropBlockHasRenderableMainImage", () => {
    it("reads block.imageUrl", () => {
      expect(dragDropBlockHasRenderableMainImage({ imageUrl: " /x.png " })).toBe(true);
      expect(dragDropBlockHasRenderableMainImage({ imageUrl: "  " })).toBe(false);
    });
  });

  describe("isDragDropTextToImageMode", () => {
    it("is true only for explicit text-to-image", () => {
      expect(isDragDropTextToImageMode("text-to-image")).toBe(true);
      expect(isDragDropTextToImageMode("diagram")).toBe(false);
      expect(isDragDropTextToImageMode(undefined)).toBe(false);
    });
  });

  describe("resolveDragDropPersistMode", () => {
    it("reads dragDropLayout when matchMode is omitted", () => {
      expect(
        resolveDragDropPersistMode({
          type: "dragDropMatch",
          dragDropLayout: "textToImage",
          pairs: [{ id: "p1", prompt: "A", answer: "B", imageUrl: "/t.png" }],
        })
      ).toBe("text-to-image");
    });

    it("does not coerce textToImage to text", () => {
      expect(
        resolveDragDropPersistMode({ matchMode: "textToImage", dragDropLayout: "textToImage" })
      ).toBe("text-to-image");
    });

    it("infers text-to-image from pair imageUrl but not answerImageUrl alone", () => {
      expect(
        resolveDragDropPersistMode({
          type: "dragDropMatch",
          pairs: [{ id: "p1", prompt: "A", answer: "B", imageUrl: "/target.png" }],
        })
      ).toBe("text-to-image");
      expect(
        resolveDragDropPersistMode({
          type: "dragDropMatch",
          pairs: [{ id: "p1", prompt: "A", answer: "B", answerImageUrl: "/thumb.png" }],
        })
      ).not.toBe("text-to-image");
    });

    it("prefers explicit text-to-image over stale diagram fields on block", () => {
      expect(
        resolveDragDropPersistMode({
          matchMode: "textToImage",
          imageUrl: "https://example.com/old-diagram.png",
          dropZones: [{ id: "z1", correctPairId: "p1" }],
          pairs: [{ id: "p1", prompt: "A", answer: "B", imageUrl: "/t.png" }],
        })
      ).toBe("text-to-image");
    });

    it("infers text-to-image from main block imageUrl when layout fields are omitted", () => {
      expect(
        resolveDragDropPersistMode({
          type: "dragDropMatch",
          imageUrl: "https://example.com/main.png",
          pairs: [{ id: "p1", prompt: "A", answer: "B" }],
        })
      ).toBe("text-to-image");
    });

    it("does not treat stale dragDropLayout standard as text when matchMode is textToImage", () => {
      expect(
        resolveDragDropPersistMode({
          matchMode: "textToImage",
          dragDropLayout: "standard",
          imageUrl: "https://example.com/main.png",
          pairs: [{ id: "p1", prompt: "A", answer: "B" }],
        })
      ).toBe("text-to-image");
    });
  });

  describe("dragDropMatchModeFromBlockForProps", () => {
    it("returns text-to-image for API reload shape (dragDropLayout only)", () => {
      expect(
        dragDropMatchModeFromBlockForProps({
          type: "dragDropMatch",
          dragDropLayout: "textToImage",
          pairs: [{ id: "p1", prompt: "X", answer: "Y", imageUrl: "https://cdn/x.png" }],
        })
      ).toBe("text-to-image");
    });
  });

  describe("layout select persistence", () => {
    it("buildDragDropMatchBlockForPersist emits text-to-image matchMode", () => {
      const out = buildDragDropMatchBlockForPersist(
        {
          type: "dragDropMatch",
          matchMode: "text-to-image",
          pairs: [{ id: "p1", prompt: "A", answer: "B", imageUrl: "/t.png" }],
        },
        { newId: () => "new_id" }
      );
      expect(out?.matchMode).toBe("textToImage");
      expect(out?.dragDropLayout).toBe("textToImage");
      expect(out?.type).toBe("dragDropMatch");
      expect((out?.pairs as { imageUrl?: string }[])?.[0]?.imageUrl).toBe("/t.png");
    });

    it("buildDragDropMatchBlockForPersist keeps main imageUrl when only imageUrl is set on block", () => {
      const out = buildDragDropMatchBlockForPersist(
        {
          type: "dragDropMatch",
          imageUrl: "https://example.com/main-only.png",
          pairs: [{ id: "p1", prompt: "Clue", answer: "Label" }],
        },
        { newId: () => "id" }
      );
      expect(out?.matchMode).toBe("textToImage");
      expect(out?.imageUrl).toBe("https://example.com/main-only.png");
    });

    it("coalesceDragDropMatchBlockPatch adds layout fields when patching main imageUrl", () => {
      const out = coalesceDragDropMatchBlockPatch(
        {
          type: "dragDropMatch",
          matchMode: "textToImage",
          pairs: [{ id: "p1", prompt: "A", answer: "B" }],
        },
        { imageUrl: "https://example.com/main.png" }
      );
      expect(out.matchMode).toBe("textToImage");
      expect(out.dragDropLayout).toBe("textToImage");
      expect(out.imageUrl).toBe("https://example.com/main.png");
    });

    it("buildDragDropMatchBlockForPersist keeps main imageUrl when dragDropLayout is stale standard", () => {
      const out = buildDragDropMatchBlockForPersist(
        {
          type: "dragDropMatch",
          matchMode: "textToImage",
          dragDropLayout: "standard",
          imageUrl: "https://example.com/main.png",
          pairs: [{ id: "p1", prompt: "Term", answer: "def" }],
        },
        { newId: () => "id" }
      );
      expect(out?.matchMode).toBe("textToImage");
      expect(out?.dragDropLayout).toBe("textToImage");
      expect(out?.imageUrl).toBe("https://example.com/main.png");
      expect(out?.dropZones).toBeUndefined();
    });

    it("buildDragDropMatchBlockForPersist strips diagram fields for text-to-image", () => {
      const out = buildDragDropMatchBlockForPersist(
        {
          type: "dragDropMatch",
          matchMode: "textToImage",
          dragDropLayout: "textToImage",
          imageUrl: "https://example.com/diagram.png",
          dropZones: [{ id: "z1", correctPairId: "p1" }],
          pairs: [{ id: "p1", prompt: "Term", answer: "def", imageUrl: "/img.png", imageAlt: "alt" }],
        },
        { newId: () => "id" }
      );
      expect(out?.matchMode).toBe("textToImage");
      expect(out?.dropZones).toBeUndefined();
      expect(out?.imageUrl).toBe("https://example.com/diagram.png");
      expect((out?.pairs as { imageUrl?: string; imageAlt?: string }[])?.[0]).toMatchObject({
        imageUrl: "/img.png",
        imageAlt: "alt",
      });
    });

    it("checkpoint block in page does not alter dragDropMatch persist mode", () => {
      const ddm = buildDragDropMatchBlockForPersist(
        {
          type: "dragDropMatch",
          dragDropLayout: "textToImage",
          pairs: [{ id: "p1", prompt: "A", answer: "B", imageUrl: "/t.png" }],
        },
        { newId: () => "new_id" }
      );
      expect(ddm?.matchMode).toBe("textToImage");
      expect(ddm?.type).toBe("dragDropMatch");
    });

    it("maps UI select values to persisted matchMode", () => {
      expect(dragDropMatchModeFromUiSelect("standard")).toBe("text");
      expect(dragDropMatchModeFromUiSelect("text-to-image")).toBe("text-to-image");
      expect(dragDropMatchModeFromUiSelect("diagram")).toBe("diagram");
    });

    it("resolveDragDropMatchModeForUi returns standard for text/omitted", () => {
      expect(resolveDragDropMatchModeForUi("text")).toBe("standard");
      expect(resolveDragDropMatchModeForUi(undefined)).toBe("standard");
      expect(resolveDragDropMatchModeForUi("text-to-image")).toBe("text-to-image");
      expect(resolveDragDropMatchModeForUi("diagram")).toBe("diagram");
    });
  });

  describe("dragDropPairsHaveTargetImages", () => {
    it("detects pair imageUrl or answerImageUrl", () => {
      expect(
        dragDropPairsHaveTargetImages([{ imageUrl: "https://example.com/a.png" }], () => true)
      ).toBe(true);
      expect(dragDropPairsHaveTargetImages([{ prompt: "x" }], () => true)).toBe(false);
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
