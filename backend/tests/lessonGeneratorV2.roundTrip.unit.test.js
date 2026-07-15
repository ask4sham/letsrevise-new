/**
 * V2 draft → assemble → lesson PUT sanitizer round-trip must keep 3/3/5 banks.
 */
const { runLessonGeneratorV2Scaffold } = require("../services/lessonGeneratorV2");
const { collectActivityQuestions } = require("../services/lessonGeneratorV2/validateFinalLesson");
const { sanitisePagesInput } = require("../routes/lessons");

describe("Lesson Generator V2 editor round-trip preservation", () => {
  test("assembled banks survive sanitisePagesInput without Option 1 filler", async () => {
    const result = await runLessonGeneratorV2Scaffold({
      topic: "Adaptations for Pollination",
      subject: "Biology",
      level: "GCSE",
      board: "Edexcel",
      topicKey: "edexcel-igcse-biology:adaptations-for-pollination",
      teacherId: "000000000000000000000001",
    });
    expect(result.criticOk).toBe(true);
    expect(result.finalLesson.level).toBe("IGCSE");
    expect(result.finalLesson.board).toBe("Edexcel");
    expect(result.finalLesson.specKey).toBe("edexcel-igcse-biology");

    const before = collectActivityQuestions(result.finalLesson);
    expect(before.selfCheck).toHaveLength(3);
    expect(before.checkpoint).toHaveLength(3);
    expect(before.quiz).toHaveLength(5);

    // Simulate editor PUT that keeps questions[] (post-fix hydrate/persist).
    const sanitizedPages = sanitisePagesInput(result.finalLesson.pages, true);
    const after = collectActivityQuestions({
      ...result.finalLesson,
      pages: sanitizedPages,
      quiz: result.finalLesson.quiz,
    });
    expect(after.selfCheck).toHaveLength(3);
    expect(after.checkpoint).toHaveLength(3);
    expect(after.quiz).toHaveLength(5);

    const blob = JSON.stringify({ pages: sanitizedPages, quiz: result.finalLesson.quiz });
    expect(blob).not.toMatch(/Which statement is correct/);
    expect(blob).not.toMatch(/"Option 1"/);
    expect(blob).not.toMatch(/"Option 2"/);
  });

  test("selfCheck/checkpoint expose legacy fields from questions[0]", async () => {
    const result = await runLessonGeneratorV2Scaffold({
      topic: "Cell structure",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
    });
    const blocks = result.finalLesson.pages[0].blocks;
    const sc = blocks.find((b) => b.type === "selfCheck");
    const cp = blocks.find((b) => b.type === "checkpoint");
    expect(sc.questions).toHaveLength(3);
    expect(sc.prompt).toBe(sc.questions[0].prompt);
    expect(sc.correctAnswer).toBe(sc.questions[0].correctAnswer);
    expect(cp.questions).toHaveLength(3);
    expect(cp.prompt).toBe(cp.questions[0].prompt);
  });
});
