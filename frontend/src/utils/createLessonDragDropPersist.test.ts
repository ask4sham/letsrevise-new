import {
  buildDragDropMatchBlockForPersist,
  resolveDragDropMatchModeForPersist,
} from "./dragDropMatchDiagram";

/**
 * Regression: CreateLesson buildLessonPayload must emit text-to-image (see CreateLessonPage dragDropMatch branch).
 */
describe("CreateLesson dragDropMatch persist shape", () => {
  it("resolveDragDropMatchModeForPersist keeps text-to-image for save payload", () => {
    expect(resolveDragDropMatchModeForPersist("text-to-image")).toBe("text-to-image");
    expect(
      resolveDragDropMatchModeForPersist("text-to-image", {
        imageUrl: "https://example.com/diagram.png",
        dropZones: [{ id: "z1", correctPairId: "p1" }],
      })
    ).toBe("text-to-image");
  });

  it("buildDragDropMatchBlockForPersist keeps text-to-image when diagram inference signals exist", () => {
    const out = buildDragDropMatchBlockForPersist(
      {
        type: "dragDropMatch",
        matchMode: "textToImage",
        dragDropLayout: "textToImage",
        imageUrl: "https://example.com/old-diagram.png",
        dropZones: [{ id: "z1", correctPairId: "p1" }],
        pairs: [{ id: "p1", prompt: "A", answer: "B", imageUrl: "/target.png" }],
      },
      { newId: () => "id" }
    );
    expect(out?.matchMode).toBe("textToImage");
    expect(out?.dragDropLayout).toBe("textToImage");
    expect(out?.dropZones).toBeUndefined();
  });
});
