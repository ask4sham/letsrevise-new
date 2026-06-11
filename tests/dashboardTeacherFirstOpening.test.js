/**
 * Phase 3H.1.6 — Dashboard teacher-first opening alignment tests.
 */

const {
  isDashboardTeacherFirstEnabled,
  buildDashboardTeacherFirstPromptSection,
  enforceDashboardTeacherFirstOpening,
  openingBlockIsPlaceholder,
  DASHBOARD_OPENING_SLOTS,
} = require("../lib/teacherBrain/dashboardTeacherFirstOpening");
const { buildTeacherFirstOpeningPlan } = require("../lib/teacherBrain/teacherFirstKnowledgeEngine");
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

describe("dashboardTeacherFirstOpening placeholder remediation (Phase 3b.3f.3B)", () => {
  const prevFlag = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;

  beforeEach(() => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevFlag;
  });

  function placeholderDraftForTopic() {
    return {
      pages: [
        {
          blocks: [
            {
              type: "text",
              title: "Revision Objectives",
              role: "lessonObjectives",
              content:
                "By the end of this lesson you will:\n• State the definition of Homeostasis\n• Explain why it matters\n• Apply the core model in exam-style answers",
            },
            { type: "text", title: "Prior Knowledge", role: "priorKnowledge", content: "Prior" },
            {
              type: "text",
              title: "Definition",
              role: "definition",
              content: "**Definition:** Homeostasis — state the precise GCSE definition using spec vocabulary.",
            },
            {
              type: "text",
              title: "Why it matters",
              role: "whyItMatters",
              content:
                "**Why it matters:** Homeostasis is tested because examiners reward clear explanation of why the process matters for organisms.",
            },
            {
              type: "keyIdea",
              title: "Core model",
              role: "coreRule",
              content: "**Core model:** State the main pathway or comparison for Homeostasis that examiners expect.",
            },
            {
              type: "text",
              title: "Key examples",
              role: "keyExamples",
              content: "• One concrete Homeostasis example\n• One comparison or application examiners recognise",
            },
            {
              type: "text",
              title: "Exam vocabulary",
              role: "examVocabulary",
              content: "**Exam vocabulary:** Use precise spec terms for Homeostasis in every exam answer.",
            },
            {
              type: "text",
              title: "Scenario",
              role: "hook",
              content:
                "A short context linking Homeostasis to something you already understand — then apply the core model taught above.",
            },
            {
              type: "text",
              title: "Core Teaching",
              role: "concept",
              content:
                "Now build your understanding of Homeostasis step by step using the definition and core model above.",
            },
          ],
        },
      ],
    };
  }

  test("openingBlockIsPlaceholder detects generic scaffolding", () => {
    expect(
      openingBlockIsPlaceholder(
        "By the end of this lesson you will:\n• State the definition of Homeostasis\n• Apply the core model in exam-style answers",
        "objectives",
        { topicLabel: "Homeostasis" }
      )
    ).toBe(true);
    expect(
      openingBlockIsPlaceholder(
        "Before we start, recall what you already know about how organisms detect and respond to changes.",
        "priorKnowledge",
        { topicLabel: "Homeostasis" }
      )
    ).toBe(true);
    expect(
      openingBlockIsPlaceholder(
        "Homeostasis is the regulation of internal conditions to maintain optimum conditions for cells and enzymes.",
        "definition",
        {
          topicLabel: "Homeostasis",
          plan: buildTeacherFirstOpeningPlan({
            topic: "Homeostasis",
            topicKey: "aqa-gcse-biology:homeostasis",
            subject: "Biology",
          }),
        }
      )
    ).toBe(false);
  });

  test("replaces placeholder opening slots with profile content for homeostasis", () => {
    const draft = placeholderDraftForTopic();
    enforceDashboardTeacherFirstOpening(draft, {
      topic: "Homeostasis",
      topicKey: "aqa-gcse-biology:homeostasis",
      subject: "Biology",
    });

    const blocks = draft.pages[0].blocks.slice(0, 9);
    expect(blocks[2].content).toMatch(/regulation of internal conditions/i);
    expect(blocks[3].content).toMatch(/enzymes only work efficiently/i);
    expect(blocks[4].content).toMatch(/receptors.*coordination centre.*effectors/i);
    expect(blocks[5].content).toMatch(/body temperature/i);
    expect(blocks[6].content).toMatch(/receptor.*effector/i);
    expect(blocks[7].content).not.toMatch(/something you already understand/i);
    expect(blocks[8].content).not.toMatch(/now build your understanding of homeostasis step by step using the definition/i);
  });

  test("preserves substantive LLM definition content", () => {
    const draft = {
      pages: [
        {
          blocks: [
            { type: "text", title: "Revision Objectives", role: "lessonObjectives", content: "Objectives" },
            { type: "text", title: "Prior Knowledge", role: "priorKnowledge", content: "Prior" },
            {
              type: "text",
              title: "Definition",
              role: "definition",
              content: "Homeostasis is the regulation of internal conditions.",
            },
            { type: "text", title: "Why it matters", role: "whyItMatters", content: "Why" },
            { type: "keyIdea", title: "Core model", role: "coreRule", content: "Model" },
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

    expect(draft.pages[0].blocks[2].content).toBe("Homeostasis is the regulation of internal conditions.");
  });

  test("unprofiled topic keeps generic fallbacks", () => {
    const draft = hookFirstDraft();
    enforceDashboardTeacherFirstOpening(draft, {
      topic: "The Carbon Cycle",
      topicKey: "aqa-gcse-biology:carbon-cycle",
      subject: "Biology",
    });

    expect(draft.pages[0].blocks[0].content).toMatch(/state the definition of the carbon cycle/i);
    expect(draft.pages[0].blocks[1].content).toMatch(/how organisms detect and respond to changes/i);
  });

  const profileTopics = [
    {
      label: "Homeostasis",
      topicKey: "aqa-gcse-biology:homeostasis",
      definitionMatch: /regulation of internal conditions/i,
    },
    {
      label: "Structure and function of the nervous system",
      topicKey: "aqa-gcse-biology:nervous-system-structure",
      definitionMatch: /rapid communication system/i,
    },
    {
      label: "The Eye",
      topicKey: "aqa-gcse-biology:the-eye",
      definitionMatch: /detects light/i,
    },
  ];

  test.each(profileTopics)("offline profile fill: $label", ({ label, topicKey, definitionMatch }) => {
    const draft = hookFirstDraft();
    enforceDashboardTeacherFirstOpening(draft, {
      topic: label,
      topicKey,
      subject: "Biology",
    });

    const opening = draft.pages[0].blocks.slice(0, 9);
    expect(opening.map((b) => b.title)).toEqual(DASHBOARD_OPENING_SLOTS.map((s) => s.title));
    expect(opening[2].content).toMatch(definitionMatch);
    expect(openingBlockIsPlaceholder(opening[2].content, "definition", { topicLabel: label })).toBe(false);
    expect(openingBlockIsPlaceholder(opening[4].content, "coreModel", { topicLabel: label })).toBe(false);

    const review = buildLessonCoverageReview({
      topic: label,
      topicKey,
      subject: "Biology",
      pages: draft.pages,
    });
    expect(review.teacherFirstOpeningCoverage.openingScorePct).toBeGreaterThan(40);
  });
});
