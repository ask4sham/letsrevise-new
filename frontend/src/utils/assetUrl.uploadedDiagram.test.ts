import {
  resolveFullResolutionImageUrlForLightbox,
  resolveLessonStepImageSrc,
  resolveUploadedDiagramImageSrc,
} from "./assetUrl";

describe("resolveUploadedDiagramImageSrc", () => {
  it("maps .display.png to full-resolution .png for student diagrams", () => {
    const display =
      "https://example.com/lesson-media/page/block_5/map.display.png";
    expect(resolveUploadedDiagramImageSrc(display)).toBe(
      "https://example.com/lesson-media/page/block_5/map.png"
    );
    expect(resolveFullResolutionImageUrlForLightbox(display)).toBe(
      resolveUploadedDiagramImageSrc(display)
    );
  });

  it("leaves non-display URLs unchanged", () => {
    const raw = "https://example.com/lesson-media/map.png";
    expect(resolveUploadedDiagramImageSrc(raw)).toBe(raw);
  });

  it("resolveLessonStepImageSrc maps display.png for step-by-step images", () => {
    const display = "https://cdn.example.com/glycolysis.display.png";
    expect(resolveLessonStepImageSrc(display)).toBe("https://cdn.example.com/glycolysis.png");
  });
});
