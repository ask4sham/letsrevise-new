/**
 * Phase 3H.1.6 — Dashboard teacher-first opening alignment tests.
 */

const {
  isDashboardTeacherFirstEnabled,
  buildDashboardTeacherFirstPromptSection,
  enforceDashboardTeacherFirstOpening,
  DASHBOARD_OPENING_SLOTS,
} = require("../lib/teacherBrain/dashboardTeacherFirstOpening");
const { buildLessonCoverageReview } = require("../lib/teacherBrain/lessonCoverageReview");

function hookFirstDraft() {
  return {
    pages: [
      {
        blocks: [
          { type: "text", title: "Hook", role: "hook", content: "Imagine you are on a hot day..." },
          { type: "keyIdea", title: "Core Rule", role: "coreRule", content: "Homeostasis keeps conditions stable." },
          { type: "commonMistake", role: "commonMistake", content: "Wrong: only temperature.\nCorrect: multiple factors." },
          { type: "keyIdea", role: "patternRecognition", content: "Pattern for exams." },
          { type: "diagram", role: "concept", content: "image here", caption: "image here" },
        ],
      },
    ],
  };
}

describe("dashboardTeacherFirstOpening (Phase 3H.1.6)", () => {
  const prevFlag = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevFlag;
  });

  test("flag off leaves module disabled", () => {
    delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    expect(isDashboardTeacherFirstEnabled()).toBe(false);
    expect(buildDashboardTeacherFirstPromptSection({ topic: "Homeostasis" })).toBe("");
  });

  test("flag on prompt section forbids hook-first opening", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const section = buildDashboardTeacherFirstPromptSection({ topic: "Homeostasis" });
    expect(section).toMatch(/DASHBOARD TEACHER-FIRST OPENING/);
    expect(section).toMatch(/title "Definition"/);
    expect(section).toMatch(/title "Scenario"/);
    expect(section).toMatch(/Do NOT put Scenario \(hook\) before block 8/);
  });

  test("enforce reorders hook-first draft to teacher-first opening titles", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const draft = hookFirstDraft();
    enforceDashboardTeacherFirstOpening(draft, {
      topic: "Homeostasis",
      topicKey: "aqa-gcse-biology:homeostasis",
      subject: "Biology",
    });

    const titles = draft.pages[0].blocks.slice(0, 10).map((b) => b.title);
    expect(titles.slice(0, 9)).toEqual(DASHBOARD_OPENING_SLOTS.map((s) => s.title));
    expect(titles[7]).toBe("Scenario");
    expect(draft.pages[0].blocks[7].role).toBe("hook");
    expect(draft.pages[0].blocks[2].title).toBe("Definition");
    expect(draft.pages[0].blocks[4].title).toBe("Core model");
    expect(draft.pages[0].blocks[4].role).toBe("coreRule");
  });

  test("coverage review passes after enforcement for homeostasis", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const draft = hookFirstDraft();
    enforceDashboardTeacherFirstOpening(draft, {
      topic: "Homeostasis",
      topicKey: "aqa-gcse-biology:homeostasis",
      subject: "Biology",
    });

    const review = buildLessonCoverageReview({
      topic: "Homeostasis",
      topicKey: "aqa-gcse-biology:homeostasis",
      subject: "Biology",
      pages: draft.pages,
    });
    const tf = review.teacherFirstOpeningCoverage;
    expect(tf.enabled).toBe(true);
    expect(tf.scenarioBeforeCoreKnowledge).toBe(false);
    expect(tf.openingScorePct).toBeGreaterThan(25);
  });

  test("definition block wins over core teaching that mentions definition in body", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const draft = {
      pages: [
        {
          blocks: [
            { type: "text", title: "Revision Objectives", role: "lessonObjectives", content: "Objectives" },
            { type: "text", title: "Prior Knowledge", role: "priorKnowledge", content: "Prior" },
            {
              type: "text",
              title: "Core Teaching",
              role: "concept",
              content:
                "The **definition** of homeostasis is the regulation of internal conditions. Step by step teaching.",
            },
            { type: "text", title: "Why it matters", role: "whyItMatters", content: "Why" },
            { type: "keyIdea", title: "Core model", role: "coreRule", content: "Model" },
            {
              type: "text",
              title: "Definition",
              role: "definition",
              content: "Homeostasis is the regulation of internal conditions.",
            },
            { type: "text", title: "Scenario", role: "hook", content: "Short scenario" },
          ],
        },
      ],
    };

    enforceDashboardTeacherFirstOpening(draft, {
      topic: "Homeostasis",
      topicKey: "aqa-gcse-biology:homeostasis",
      subject: "Biology",
    });

    const blocks = draft.pages[0].blocks;
    expect(blocks[2].title).toBe("Definition");
    expect(blocks[2].role).toBe("definition");
    expect(String(blocks[2].content)).toMatch(/regulation of internal conditions/i);
    expect(blocks[8].title).toBe("Core Teaching");
    expect(blocks.findIndex((b) => b.title === "Definition")).toBe(2);
  });

  test("flag off does not mutate draft", () => {
    delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    const draft = hookFirstDraft();
    const before = JSON.stringify(draft);
    enforceDashboardTeacherFirstOpening(draft, {
      topic: "Homeostasis",
      topicKey: "aqa-gcse-biology:homeostasis",
    });
    expect(JSON.stringify(draft)).toBe(before);
  });
});
