import {
  concealOpenExamPracticeMarkSchemes,
  formatExamPracticeContentForImport,
} from "./formatExamPracticeContent";

describe("concealOpenExamPracticeMarkSchemes", () => {
  it("moves open mark scheme inside Reveal Model Answer details", () => {
    const input = [
      "<p><strong>Q1 (1 marks)</strong></p>",
      "<p>Why must human gametes be haploid before fertilisation?</p>",
      "<h3><strong>Mark scheme:</strong></h3>",
      "<ul>",
      "<li>Haploid gametes</li>",
      "<li>Fusion restores diploid zygote</li>",
      "</ul>",
      "<details><summary>Reveal Model Answer</summary><p>So diploid number is restored.</p></details>",
    ].join("\n");

    const out = concealOpenExamPracticeMarkSchemes(input);
    expect(out).toMatch(/<details>[\s\S]*Mark scheme:[\s\S]*<\/details>/i);
    expect(out.indexOf("Mark scheme:")).toBeGreaterThan(out.indexOf("<summary>"));
    // Stem stays outside details
    expect(out.indexOf("Why must human gametes")).toBeLessThan(out.indexOf("<details>"));
  });

  it("wraps orphan mark scheme in its own details", () => {
    const input = [
      "<p><strong>Q1 (1 marks)</strong></p>",
      "<p>Stem only</p>",
      "<h3><strong>Mark scheme:</strong></h3>",
      "<ul><li>Point A</li></ul>",
    ].join("\n");
    const out = concealOpenExamPracticeMarkSchemes(input);
    expect(out).toContain("<summary>Reveal Model Answer</summary>");
    expect(out).toMatch(/<details>[\s\S]*Point A[\s\S]*<\/details>/);
  });

  it("does not double-wrap mark schemes already inside details", () => {
    const input = [
      "<details><summary>Reveal Model Answer</summary>",
      "<h3><strong>Mark scheme:</strong></h3>",
      "<ul><li>Already hidden</li></ul>",
      "</details>",
    ].join("\n");
    const out = concealOpenExamPracticeMarkSchemes(input);
    expect(out.match(/<details>/gi)?.length).toBe(1);
  });
});

describe("formatExamPracticeContentForImport", () => {
  it("conceals mark schemes for non-Q5 exam practice banks", () => {
    const input = [
      "<p><strong>Q1 (1 marks)</strong></p>",
      "<p>Stem</p>",
      "<h3><strong>Mark scheme:</strong></h3>",
      "<ul><li>A</li></ul>",
      "<details><summary>Reveal Model Answer</summary><p>Model</p></details>",
    ].join("\n");
    const out = formatExamPracticeContentForImport(input);
    expect(out.indexOf("Mark scheme:")).toBeGreaterThan(out.indexOf("<summary>"));
  });
});
