import {
  isLessonSynthesiserV1UiEnabled,
  buildLessonSynthesiserV1GeneratePayload,
} from "./lessonSynthesiserV1Ui";

describe("lessonSynthesiserV1Ui", () => {
  test("flag parsing", () => {
    expect(isLessonSynthesiserV1UiEnabled({ REACT_APP_LESSON_SYNTHESISER_V1: "0" })).toBe(
      false
    );
    expect(isLessonSynthesiserV1UiEnabled({ REACT_APP_LESSON_SYNTHESISER_V1: "true" })).toBe(
      true
    );
  });

  test("build payload includes specKey and omits tier for IGCSE", () => {
    const payload = buildLessonSynthesiserV1GeneratePayload({
      subject: "Biology",
      level: "IGCSE",
      board: "Edexcel",
      topic: "Gametes",
      topicKey: "edexcel-igcse-biology:reproduction/gametes-fertilisation",
      specKey: "edexcel-igcse-biology",
      tier: "higher",
    });
    expect(payload.specKey).toBe("edexcel-igcse-biology");
    expect(payload.tier).toBeUndefined();
  });
});
