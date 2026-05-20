import { resolveDragDropMatchModeForPersist } from "./dragDropMatchDiagram";

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
});
