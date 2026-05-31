/**
 * Lesson Generator V4 — teaching intelligence layer tests.
 */

const fs = require("fs");
const path = require("path");
const { buildLessonBlueprint } = require("../lessonGeneratorV2/lessonBlueprintEngine");
const {
  buildTeachingPromptAppendix,
  runLessonGeneratorV4Pipeline,
  runLessonQualityGateV2,
} = require("../lessonGeneratorV4");
const { computeLessonFlowScoreV2 } = require("../lessonFlowScore");

function parseDryRunLessons() {
  const raw = fs.readFileSync(
    path.join(__dirname, "../../backend/scripts/dry-run-pilot-lessons-output.json"),
    "utf8"
  );
  return raw
    .trim()
    .split(/\n(?=\{)/)
    .map((s) => JSON.parse(s));
}

function beforeToPages(before) {
  return [
    {
      title: "Lesson",
      order: 1,
      blocks: before.map((b) => ({
        type: b.type,
        role: b.role,
        title: b.title,
        content: b.preview || "",
      })),
    },
  ];
}

describe("Lesson Generator V4", () => {
  test("buildTeachingPromptAppendix includes journey and examiner language", () => {
    const bp = buildLessonBlueprint({
      topic: "Metabolism",
      subject: "Biology",
      examBoard: "AQA",
      tier: "higher",
    });
    const appendix = buildTeachingPromptAppendix(bp);
    expect(appendix).toMatch(/Lesson Generator V4/);
    expect(appendix).toMatch(/Students often write/);
    expect(appendix).toMatch(/Spiral checkpoints|Spiral checkpoints building/i);
    expect(appendix).toMatch(/CONCEPT STORYTELLING/);
    expect(appendix).toMatch(/teacher/i);
  });

  test("computeLessonFlowScoreV2 exposes teaching sub-scores", () => {
    const bp = buildLessonBlueprint({ topic: "Metabolism", subject: "Biology" });
    const pages = beforeToPages(
      parseDryRunLessons().find((l) => l.title.includes("Metabolism"))?.before || []
    );
    const scores = computeLessonFlowScoreV2(pages, { blueprint: bp });
    expect(scores).toHaveProperty("teachingFlowScore");
    expect(scores).toHaveProperty("explanationScore");
    expect(scores).toHaveProperty("retrievalJourneyScore");
    expect(scores).toHaveProperty("teacherVoiceScore");
    expect(scores).toHaveProperty("overallTeachingScore");
    expect(scores.overallTeachingScore).toBeGreaterThanOrEqual(0);
    expect(scores.overallTeachingScore).toBeLessThanOrEqual(100);
  });

  test("curated respiration lesson scores higher teacher voice than empty draft", () => {
    const lessons = parseDryRunLessons();
    const resp = lessons.find((l) => l.title.includes("Respiration"));
    expect(resp).toBeTruthy();
    const bp = buildLessonBlueprint({ topic: "Respiration", subject: "Biology" });
    const curated = computeLessonFlowScoreV2(beforeToPages(resp.before), { blueprint: bp });
    const empty = computeLessonFlowScoreV2(
      [{ blocks: [{ type: "text", content: "Metabolism is important." }] }],
      { blueprint: bp }
    );
    expect(curated.teacherVoiceScore).toBeGreaterThan(empty.teacherVoiceScore);
  });

  test("quality gate v2 blocks premium when sub-scores low", () => {
    const bp = buildLessonBlueprint({ topic: "Metabolism", subject: "Biology" });
    const pages = [{ blocks: [{ type: "text", content: "ATP." }] }];
    const gate = runLessonQualityGateV2(pages, { blueprint: bp });
    expect(gate.canAchievePremium).toBe(false);
    expect(gate.failures.length).toBeGreaterThan(0);
  });

  test("runLessonGeneratorV4Pipeline returns diagnostics", () => {
    const bp = buildLessonBlueprint({ topic: "Metabolism", subject: "Biology" });
    const lessons = parseDryRunLessons();
    const meta = lessons.find((l) => l.title.includes("Metabolism"));
    const pages = beforeToPages(meta?.before || []);
    const result = runLessonGeneratorV4Pipeline(pages, { blueprint: bp });
    expect(result.version).toBe(4);
    expect(result.diagnostics).toHaveProperty("strengths");
    expect(result.diagnostics).toHaveProperty("teacherVoiceScore");
    expect(result.flowScore.overallTeachingScore).toBeDefined();
    expect(result.rubric).toHaveProperty("categories");
    expect(result.rubric).toHaveProperty("average");
  });
});
