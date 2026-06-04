const {
  buildReferenceLessonMaterialPrompt,
  buildAdditionalInstructionsStrong,
} = require("../lib/referenceLessonMaterialPrompt");

describe("referenceLessonMaterialPrompt", () => {
  test("returns empty string for blank input", () => {
    expect(buildReferenceLessonMaterialPrompt("")).toBe("");
    expect(buildReferenceLessonMaterialPrompt("   ")).toBe("");
    expect(buildReferenceLessonMaterialPrompt(null)).toBe("");
  });

  test("wraps teacher material in REFERENCE LESSON MATERIAL section", () => {
    const out = buildReferenceLessonMaterialPrompt(
      "Homeostasis keeps internal conditions stable.\nNegative feedback loop."
    );
    expect(out).toContain("## REFERENCE LESSON MATERIAL (HIGH PRIORITY — TRUSTED TEACHER INPUT)");
    expect(out).toContain("Use this as trusted teacher-provided reference");
    expect(out).toContain("- definition");
    expect(out).toContain("- why it matters");
    expect(out).toContain("- core model");
    expect(out).toContain("- exam vocabulary");
    expect(out).toContain("Do not copy wording verbatim");
    expect(out).toContain("PRIORITISE this reference");
    expect(out).toContain("Homeostasis keeps internal conditions stable.");
    expect(out).toContain("Negative feedback loop.");
  });

  test("buildAdditionalInstructionsStrong aliases reference builder", () => {
    const raw = "Include blood glucose example.";
    expect(buildAdditionalInstructionsStrong(raw)).toBe(
      buildReferenceLessonMaterialPrompt(raw)
    );
  });
});
