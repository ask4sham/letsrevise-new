import {
  cleanSequenceStepDescription,
  sequenceStepDescriptionNeedsCleaning,
} from "./cleanSequenceStepDescription";

describe("cleanSequenceStepDescription", () => {
  it("removes lr-seq-mini-flow HTML and keeps biology text", () => {
    const raw = [
      '<p class="lr-seq-mini-flow" aria-hidden="true"><span>🔬</span> <span>Step 1</span> <strong>→</strong></p>',
      "<p><strong>Location:</strong> In the ROOTS: Root hair cells absorb nitrate ions from the soil by active transport.</p>",
      '<p class="lr-seq-transition" aria-hidden="true"><em>Next</em> ↓</p>',
    ].join("\n");

    expect(sequenceStepDescriptionNeedsCleaning(raw)).toBe(true);
    const out = cleanSequenceStepDescription(raw, { stepTitle: "Active transport in roots" });
    expect(out).not.toMatch(/lr-seq-mini-flow/i);
    expect(out).not.toMatch(/aria-hidden/i);
    expect(out).not.toMatch(/<\s*p\b/i);
    expect(out).toContain("ROOTS");
    expect(out).toContain("active transport");
  });

  it("strips image prompt delimiter suffix", () => {
    const raw = "Explain uptake.\n\n«IMAGE_PROMPT»\nShow root hairs";
    expect(cleanSequenceStepDescription(raw)).toBe("Explain uptake.");
  });

  it("leaves plain text unchanged", () => {
    const plain = "Chlorophyll absorbs light energy in the chloroplast.";
    expect(cleanSequenceStepDescription(plain)).toBe(plain);
  });
});
