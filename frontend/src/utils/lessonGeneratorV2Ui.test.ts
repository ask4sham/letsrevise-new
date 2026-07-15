import {
  isLessonGeneratorV2UiEnabled,
  buildV2DraftGeneratePayload,
  formatV2GenerateError,
  isSuccessfulV2DraftSave,
} from "./lessonGeneratorV2Ui";

describe("lessonGeneratorV2Ui", () => {
  test("env flag off by default / absent", () => {
    expect(isLessonGeneratorV2UiEnabled({})).toBe(false);
    expect(isLessonGeneratorV2UiEnabled({ REACT_APP_LESSON_GENERATOR_V2_UI: "0" })).toBe(false);
  });

  test("env flag on for 1/true/yes/on", () => {
    expect(isLessonGeneratorV2UiEnabled({ REACT_APP_LESSON_GENERATOR_V2_UI: "1" })).toBe(true);
    expect(isLessonGeneratorV2UiEnabled({ REACT_APP_LESSON_GENERATOR_V2_UI: "true" })).toBe(true);
    expect(isLessonGeneratorV2UiEnabled({ REACT_APP_LESSON_GENERATOR_V2_UI: "YES" })).toBe(true);
  });

  test("buildV2DraftGeneratePayload includes persist:true and omits V1 planner flags", () => {
    const payload = buildV2DraftGeneratePayload({
      subject: "Biology",
      level: "GCSE",
      topic: "Cell structure",
      topicKey: "aqa-gcse-biology:cell-structure",
      board: "AQA",
      tier: "higher",
    });
    expect(payload).toEqual({
      subject: "Biology",
      level: "GCSE",
      topic: "Cell structure",
      board: "AQA",
      tier: "higher",
      topicKey: "aqa-gcse-biology:cell-structure",
      persist: true,
    });
    expect(payload).not.toHaveProperty("useLessonGeneratorV2");
    expect(payload).not.toHaveProperty("useLessonGeneratorV3");
    expect(payload).not.toHaveProperty("useLessonGeneratorV4");
    expect(payload).not.toHaveProperty("autoGenerateFromBanks");
  });

  test("formatV2GenerateError maps disabled / persist / quality codes", () => {
    expect(
      formatV2GenerateError({ response: { data: { code: "LESSON_GENERATOR_V2_DISABLED" } } })
    ).toMatch(/not enabled on the server/i);
    expect(
      formatV2GenerateError({ response: { data: { code: "LESSON_V2_PERSIST_DISABLED" } } })
    ).toMatch(/draft save is not enabled/i);
    expect(
      formatV2GenerateError({
        response: { data: { code: "LESSON_V2_PHASE3_FAILED", msg: "bad questions" } },
      })
    ).toMatch(/LESSON_V2_PHASE3_FAILED/);
    expect(
      formatV2GenerateError({ response: { data: { code: "LESSON_V2_PERSIST_FAILED" } } })
    ).toMatch(/Nothing was published/i);
  });

  test("isSuccessfulV2DraftSave requires saved true and lessonId", () => {
    expect(isSuccessfulV2DraftSave({ saved: true, lessonId: "abc" })).toBe(true);
    expect(isSuccessfulV2DraftSave({ saved: false, lessonId: "abc" })).toBe(false);
    expect(isSuccessfulV2DraftSave({ saved: true })).toBe(false);
  });
});
