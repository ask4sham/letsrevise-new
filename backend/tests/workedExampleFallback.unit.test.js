/**
 * Phase 5B.3f.2 — topic-aware worked example fallback.
 * @jest-environment node
 */

const {
  resolveWorkedExampleFallback,
  ensureWorkedExampleCheckpoint,
} = require("../routes/ai");
const {
  hasSubstantialWorkedAnswer,
  isFakeMedicineWorkedExampleStem,
  isQualityWorkedExampleBlock,
} = require("../services/lessonDraftValidation");

const ACCEPTANCE_TOPICS = [
  {
    label: "Reflex Arc",
    meta: { topic: "Reflex Arc", subTopic: "Reflex Arc", topicKey: "aqa-gcse-biology:reflex-arc" },
    mustMatch: /reflex arc|stimulus|receptor|motor neurone/i,
    mustNotMatch: /medicine|stem cell|bone marrow/i,
  },
  {
    label: "Cell Structure",
    meta: { topic: "Cell Structure", topicKey: "aqa-gcse-biology:cell-structure" },
    mustMatch: /chloroplast|plant cell|photosynth/i,
    mustNotMatch: /medicine|stem cell|bone marrow/i,
  },
  {
    label: "Blood Glucose Control",
    meta: { topic: "Blood Glucose Control", subTopic: "Control of blood glucose" },
    mustMatch: /blood glucose|insulin|glucose/i,
    mustNotMatch: /medicine|stem cell|bone marrow/i,
  },
  {
    label: "Mitosis and the Cell Cycle",
    meta: { topic: "Mitosis and the cell cycle", topicKey: "aqa-gcse-biology:mitosis" },
    mustMatch: /mitosis|chromosome|daughter cell/i,
    mustNotMatch: /medicine|stem cell|bone marrow/i,
  },
  {
    label: "Carbon Cycle",
    meta: { topic: "The carbon cycle", subTopic: "Carbon cycle" },
    mustMatch: /carbon|decomposer|photosynth|respir/i,
    mustNotMatch: /medicine|stem cell|bone marrow/i,
  },
];

function draftWithEmptyCheckpoint(meta) {
  return {
    title: meta.topic,
    pages: [
      {
        title: "Page 1",
        order: 1,
        blocks: [
          { type: "text", role: "hook", content: "Hook" },
          { type: "keyIdea", role: "coreRule", content: "Core rule" },
          { type: "commonMistake", role: "commonMistake", content: "Wrong: x\nCorrect: y\nExam link: z" },
          { type: "keyIdea", role: "patternRecognition", content: "Pattern" },
          { type: "diagram", role: "concept", content: "image", caption: "image" },
          { type: "diagram", role: "concept", content: "image2", caption: "image2" },
          { type: "keyIdea", role: "synthesis", content: "Synthesis" },
          { type: "keyIdea", role: "finalMemoryRule", content: "Memory rule" },
          {
            type: "checkpoint",
            role: "quickCheck",
            prompt: "Quick check placeholder?",
            questionType: "short",
            options: [],
            correctAnswer: "A",
            explanation: "",
          },
        ],
      },
    ],
  };
}

describe("workedExampleFallback (Phase 5B.3f.2)", () => {
  test.each(ACCEPTANCE_TOPICS)("$label gets topic-appropriate fallback", ({ meta, mustMatch, mustNotMatch }) => {
    const fallback = resolveWorkedExampleFallback(meta);
    const combined = `${fallback.question}\n${fallback.explanation}`;

    expect(fallback.question).toMatch(/\(\s*\d+\s*marks?\s*\)/i);
    expect(fallback.explanation).toMatch(/because|therefore|so that/i);
    expect((fallback.explanation.match(/(^|\n)\s*[-•*]\s*/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(fallback.correctAnswer).not.toMatch(/^see model answer$/i);
    expect(combined).toMatch(mustMatch);
    expect(combined).not.toMatch(mustNotMatch);
    expect(isFakeMedicineWorkedExampleStem(fallback.question, `${meta.topic} ${meta.subTopic}`)).toBe(false);
  });

  test("homeostasis profile provides thermoregulation stem", () => {
    const fallback = resolveWorkedExampleFallback({ topic: "Homeostasis", subTopic: "Homeostasis" });
    expect(fallback.question).toMatch(/core temperature rises during exercise/i);
    expect(hasSubstantialWorkedAnswer({ explanation: fallback.explanation })).toBe(true);
  });

  test("ensureWorkedExampleCheckpoint replaces legacy medicine/stem-cell fake", () => {
    const draft = {
      pages: [
        {
          blocks: [
            {
              type: "checkpoint",
              role: "workedExample",
              prompt: "Explain one important use of Reflex Arc in medicine (3 marks)",
              questionType: "short",
              options: [],
              explanation:
                "- Stem cells can differentiate into specialised cells.\n" +
                "- This means they can replace damaged or diseased cells.\n" +
                "- Example: bone marrow stem cells can be used to treat leukaemia.",
              correctAnswer: "See model answer",
            },
          ],
        },
      ],
    };

    ensureWorkedExampleCheckpoint(draft, "Reflex Arc", { topic: "Reflex Arc" });
    const worked = draft.pages[0].blocks.find((b) => b.role === "workedExample");

    expect(worked.prompt).toMatch(/reflex arc|stimulus|receptor/i);
    expect(worked.prompt).not.toMatch(/medicine/i);
    expect(worked.explanation).not.toMatch(/bone marrow stem cells/i);
    expect(worked.correctAnswer).not.toMatch(/^see model answer$/i);
    expect(isQualityWorkedExampleBlock(worked, "reflex arc")).toBe(true);
  });

  test("ensureWorkedExampleCheckpoint fills empty checkpoint on sparse draft", () => {
    const draft = draftWithEmptyCheckpoint({ topic: "Cell Structure" });
    ensureWorkedExampleCheckpoint(draft, "Cell Structure", { topic: "Cell Structure" });
    const worked = draft.pages[0].blocks.find((b) => b.role === "workedExample");
    expect(worked).toBeDefined();
    expect(isQualityWorkedExampleBlock(worked, "cell structure")).toBe(true);
  });
});
