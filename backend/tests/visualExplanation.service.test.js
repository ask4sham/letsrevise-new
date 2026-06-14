/**
 * Unit tests for visualExplanation service (no LLM spend).
 */
const {
  EXPLAIN_SCHEMA_DESC,
  REQUIRED_EXPLANATION_FIELDS,
  extractJsonObject,
  validateExplanation,
  generateImageFromPrompt,
} = require("../services/visualExplanation");

describe("visualExplanation service", () => {
  test("EXPLAIN_SCHEMA_DESC lists all required fields", () => {
    for (const key of REQUIRED_EXPLANATION_FIELDS) {
      expect(EXPLAIN_SCHEMA_DESC).toContain(key);
    }
  });

  test("extractJsonObject parses embedded JSON", () => {
    const data = extractJsonObject('Here is JSON: {"what_image_shows":"x","key_parts":[],"step_by_step":[],"why_it_matters_gcse":"y","common_mistake":"z","exam_tip":"a","exam_question":"b","model_answer":"c","image_prompt":"d"} end');
    expect(data.what_image_shows).toBe("x");
  });

  test("extractJsonObject rejects empty text", () => {
    expect(() => extractJsonObject("")).toThrow(/Empty LLM response/);
  });

  test("validateExplanation requires key_parts length >= 3", () => {
    expect(() =>
      validateExplanation({
        what_image_shows: "a",
        key_parts: [{ label: "A", what: "b" }],
        step_by_step: ["s"],
        why_it_matters_gcse: "w",
        common_mistake: "c",
        exam_tip: "e",
        exam_question: "q",
        model_answer: "m",
        image_prompt: "p",
      })
    ).toThrow(/key_parts/);
  });

  test("generateImageFromPrompt returns null when prompt too short", async () => {
    const result = await generateImageFromPrompt("short");
    expect(result).toBeNull();
  });

  test("generateImageFromPrompt returns null when DISABLE_OPENAI=1", async () => {
    const prev = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";
    try {
      const result = await generateImageFromPrompt(
        "Labelled GCSE diagram of the eye with cornea, lens, retina on white background."
      );
      expect(result).toBeNull();
    } finally {
      if (prev === undefined) delete process.env.DISABLE_OPENAI;
      else process.env.DISABLE_OPENAI = prev;
    }
  });
});
