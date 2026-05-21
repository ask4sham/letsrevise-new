import { lessonFieldLooksLikeHtml, mergeLessonBlockIntroFields } from "./lessonRichText";

describe("lessonRichText", () => {
  it("detects HTML from generator", () => {
    expect(lessonFieldLooksLikeHtml("<p>Label the hotspots</p>")).toBe(true);
    expect(lessonFieldLooksLikeHtml("Plain instruction.")).toBe(false);
  });

  it("merges intro and content without duplication", () => {
    expect(mergeLessonBlockIntroFields("<p>A</p>", "")).toBe("<p>A</p>");
    expect(mergeLessonBlockIntroFields("", "fallback")).toBe("fallback");
    expect(mergeLessonBlockIntroFields("same", "same")).toBe("same");
  });
});
