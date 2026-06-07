import {
  extractQ5ModelDetailsBlock,
  formatExamPracticeContentForImport,
} from "../frontend/src/utils/formatExamPracticeContent";
import {
  deriveCheckpointWhyExplanation,
  explanationsAreDuplicate,
  resolveImportedCheckpointExplanation,
} from "../frontend/src/utils/deriveCheckpointWhyExplanation";

describe("presentation polish import", () => {
  it("formats flattened Q5 exam practice into structured HTML", () => {
    const flat = `Q5 (6 marks)
Explain the main process in this topic using a clear cause → effect chain. [6]
Mark scheme:
- States key steps
- Uses because/therefore`;

    const out = formatExamPracticeContentForImport(flat);
    expect(out).toMatch(/<strong>Q5 \(6 marks\):<\/strong>/);
    expect(out).toMatch(/<p>Explain the main process/);
    expect(out).not.toMatch(/\[6\]/);
    expect(out).toMatch(/<h3><strong>Mark scheme:<\/strong><\/h3>/);
    expect(out).toMatch(/<li>States key steps<\/li>/);
  });

  it("binds Q5 model answer to Q5 not Q1 after import formatting", () => {
    const q1Answer = "Brain and spinal cord.";
    const q5Answer =
      "Stimulus detected by receptors. An electrical impulse travels along a sensory neurone to the CNS. The CNS processes the impulse and sends a signal along a motor neurone. The effector responds.";
    const multiExam = `
Q1 (1 mark) What is the CNS?
<details><summary>Reveal Model Answer</summary>${q1Answer}</details>
Q5 (6 marks)
Explain the main process in this topic using a clear cause → effect chain. [6]
Mark scheme:
- States key steps
- Uses because/therefore
- Links to outcome
- Accurate vocabulary
<details><summary>Reveal Model Answer</summary>
${q5Answer}
</details>`;

    const q5Idx = multiExam.search(/Q5\s*\(\s*6\s*marks?\)/i);
    const bound = extractQ5ModelDetailsBlock(multiExam, q5Idx);
    expect(bound).toMatch(/sensory neurone/i);
    expect(bound).not.toMatch(/Brain and spinal cord/i);

    const imported = formatExamPracticeContentForImport(multiExam);
    const q5Section = imported.slice(imported.search(/Q5\s*\(\s*6\s*marks?\)/i));
    expect(q5Section).toMatch(/sensory neurone/i);
    expect(q5Section).not.toContain("Brain and spinal cord.");
    expect(q5Section.length).toBeGreaterThan(q1Answer.length);
    expect(q1Answer).not.toEqual(
      q5Section.match(/<details>[\s\S]*?<\/details>/i)?.[0] || ""
    );
  });

  it("replaces duplicate self-check explanations with WHY text", () => {
    const ans =
      "Long axon carries impulses from the spinal cord to the effector.";
    expect(explanationsAreDuplicate(ans, ans)).toBe(true);
    const why = resolveImportedCheckpointExplanation(ans, ans, {
      topic: "nervous system",
    });
    expect(why.toLowerCase()).not.toBe(ans.toLowerCase());
    expect(deriveCheckpointWhyExplanation(ans, { topic: "nervous system" })).toMatch(
      /structure|function|myelin|impulse/i
    );
  });
});
