/**
 * Question deduplication guard — generator tests.
 */

const {
  applyQuestionDeduplicationGuard,
  listQuestionBlocksInLesson,
  isGenericPlaceholderStem,
  questionsAreNearDuplicate,
  normalizeQuestionStem,
  isBloodGlucoseTopic,
} = require("../lib/questionDeduplicationGuard");

function mcqBlock(n, heading, question, answer = "Insulin") {
  return [
    `${n} — ${heading}`,
    "Paste into: Checkpoint block",
    "",
    "Question:",
    question,
    "",
    "Option 1:",
    "Insulin",
    "",
    "Option 2:",
    "Glucagon",
    "",
    "Option 3:",
    "ADH",
    "",
    "Option 4:",
    "Thyroxine",
    "",
    "Answer:",
    answer,
    "",
  ].join("\n");
}

function collectCheckpointQuestions(text) {
  return listQuestionBlocksInLesson(text)
    .filter((b) => b.kind === "checkpoint" || b.kind === "quickCheck")
    .map((b) => normalizeQuestionStem(b.stem));
}

describe("questionDeduplicationGuard", () => {
  test("detects generic placeholder stems", () => {
    expect(isGenericPlaceholderStem("Which statement best matches this topic?")).toBe(true);
    expect(isGenericPlaceholderStem("Explain one key idea about Homeostasis using a cause → effect chain.")).toBe(true);
    expect(isGenericPlaceholderStem("When blood glucose rises, which hormone is released?")).toBe(false);
  });

  test("near-duplicate detection catches same stem meaning", () => {
    const a = "When blood glucose rises above the set point which hormone does the pancreas release";
    const b = "When blood glucose rises above the set point, which hormone does the pancreas release?";
    expect(questionsAreNearDuplicate(a, b)).toBe(true);
  });

  test("a generated lesson cannot contain two identical checkpoint questions", () => {
    const q =
      "When blood glucose rises above the set point, which hormone does the pancreas release?";
    const lesson = [
      "LESSON OBJECTIVE FIELD:",
      "Control blood glucose.",
      "",
      mcqBlock(12, "CHECKPOINT", q),
      "",
      mcqBlock(18, "CHECKPOINT", q),
    ].join("\n");

    const result = applyQuestionDeduplicationGuard(lesson, {
      topic: "Control of blood glucose",
      topicKey: "aqa-biology-gcse:homeostasis",
    });

    expect(result.changed).toBe(true);
    expect(result.duplicatesResolved).toBeGreaterThanOrEqual(1);

    const stems = collectCheckpointQuestions(result.text);
    const unique = new Set(stems);
    expect(unique.size).toBe(stems.length);
  });

  test("a lesson cannot contain repeated generic placeholder questions", () => {
    const generic = "Which statement best matches this topic?";
    const lesson = [
      mcqBlock(5, "CHECKPOINT", generic),
      "",
      mcqBlock(9, "QUICK CHECK", generic),
    ].join("\n");

    const result = applyQuestionDeduplicationGuard(lesson, {
      topic: "Control of blood glucose",
    });

    expect(result.changed).toBe(true);
    const stems = collectCheckpointQuestions(result.text);
    const genericCount = stems.filter((s) => isGenericPlaceholderStem(s)).length;
    expect(genericCount).toBeLessThanOrEqual(1);
  });

  test("blood glucose lesson receives distinct checkpoint questions", () => {
    expect(isBloodGlucoseTopic("Control of blood glucose", "")).toBe(true);

    const lesson = [
      mcqBlock(1, "CHECKPOINT", "Which statement best matches this topic?"),
      "",
      mcqBlock(2, "CHECKPOINT", "Which statement best matches this topic?"),
      "",
      mcqBlock(3, "QUICK CHECK", "Which statement best matches this topic?"),
    ].join("\n");

    const result = applyQuestionDeduplicationGuard(lesson, {
      topic: "Control of blood glucose",
    });

    const stems = collectCheckpointQuestions(result.text);
    expect(stems.length).toBe(3);
    expect(new Set(stems).size).toBe(3);

    const joined = result.text.toLowerCase();
    expect(joined).toMatch(/insulin|glucagon|glycogen|pancreas|negative feedback/);
    expect(joined).not.toMatch(/unrelated topic|nervous system pathway/);
  });

  test("deduplication does not remove legitimate different questions on the same topic", () => {
    const lesson = [
      mcqBlock(
        1,
        "CHECKPOINT",
        "When blood glucose rises above the set point, which hormone does the pancreas release?",
        "Insulin"
      ),
      "",
      mcqBlock(
        2,
        "QUICK CHECK",
        "When blood glucose falls below the set point, which hormone is released to raise it?",
        "Glucagon"
      ),
    ].join("\n");

    const result = applyQuestionDeduplicationGuard(lesson, {
      topic: "Control of blood glucose",
    });

    expect(result.changed).toBe(false);
    expect(result.duplicatesResolved).toBe(0);
    expect(collectCheckpointQuestions(result.text)).toHaveLength(2);
  });

  test("simulates post-autofix duplicate generic checkpoints (inject + repair pattern)", () => {
    const genericMain = "Which statement best matches this topic?";
    const genericQuick = "What should a strong exam answer usually include?";
    const lesson = [
      mcqBlock(10, "CHECKPOINT", genericMain),
      "",
      mcqBlock(11, "QUICK CHECK", genericQuick),
      "",
      mcqBlock(12, "CHECKPOINT", genericMain),
    ].join("\n");

    const result = applyQuestionDeduplicationGuard(lesson, {
      topic: "Control of blood glucose",
    });

    expect(result.changed).toBe(true);
    const stems = collectCheckpointQuestions(result.text);
    expect(new Set(stems).size).toBe(stems.length);
    expect(stems.filter((s) => isGenericPlaceholderStem(s)).length).toBeLessThanOrEqual(1);
  });
});
