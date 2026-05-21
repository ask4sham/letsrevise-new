import {
  diagramMarkdownContentForPreview,
  isDiagramPlaceholderContent,
} from "./diagramBlockPreview";

describe("diagramBlockPreview", () => {
  it("detects image here placeholder", () => {
    expect(isDiagramPlaceholderContent("image here")).toBe(true);
    expect(isDiagramPlaceholderContent("  Image Here  ")).toBe(true);
  });

  it("strips placeholder from preview markdown when image is set", () => {
    expect(diagramMarkdownContentForPreview("image here", "/a.png")).toBe("");
    expect(diagramMarkdownContentForPreview("<p>Caption</p>", "/a.png")).toContain("Caption");
  });
});
