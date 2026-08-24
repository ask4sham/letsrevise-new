import {
  concealOpenExamPracticeMarkSchemes,
  formatExamPracticeContentForImport,
  stripDuplicateExamPracticeSections,
  hasRenderableExamPracticeContent,
} from "./formatExamPracticeContent";
import { mcqFingerprintFromStemAndAnswer } from "./questionStemSimilarity";

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

describe("stripDuplicateExamPracticeSections", () => {
  const haploidStem = "Why must human gametes be haploid before fertilisation?";
  const haploidAnswer = "So fusion restores the diploid chromosome number in the zygote";
  const block26Html = [
    "<p><strong>Q1 (1 mark)</strong></p>",
    `<p>${haploidStem}</p>`,
    "<details><summary>Reveal Model Answer</summary>",
    "<p><strong>Model answer:</strong></p>",
    `<p>${haploidAnswer}</p>`,
    "</details>",
    "<p><strong>Q2 (1 mark)</strong></p>",
    "<p>State the nuclear event that defines fertilisation and name the cell produced.</p>",
    "<details><summary>Reveal Model Answer</summary>",
    "<p><strong>Model answer:</strong></p>",
    "<p>Fusion of two haploid nuclei to form a diploid zygote nucleus</p>",
    "</details>",
  ].join("\n");

  it("strips Q sections that match prior inline activity fingerprints", () => {
    const exclude = new Set([
      mcqFingerprintFromStemAndAnswer(haploidStem, haploidAnswer),
      mcqFingerprintFromStemAndAnswer(
        "State the nuclear event that defines fertilisation and name the cell produced.",
        "Fusion of two haploid nuclei to form a diploid zygote nucleus"
      ),
    ]);
    const out = stripDuplicateExamPracticeSections(block26Html, exclude);
    expect(hasRenderableExamPracticeContent(out)).toBe(false);
  });

  it("keeps unique Q sections when only one duplicates", () => {
    const exclude = new Set([mcqFingerprintFromStemAndAnswer(haploidStem, haploidAnswer)]);
    const out = stripDuplicateExamPracticeSections(block26Html, exclude);
    expect(hasRenderableExamPracticeContent(out)).toBe(true);
    expect(out).toContain("State the nuclear event");
    expect(out).not.toContain(haploidStem);
  });
});
