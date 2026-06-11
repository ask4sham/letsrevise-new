/**
 * Phase 3b.3f.6A — real-world application structure-gate helper.
 * @jest-environment node
 */

const {
  ensureRealWorldApplicationBlock,
  buildTopicAwareRealWorldApplication,
} = require("../routes/ai");
const {
  validateLessonStructure,
  blockMentionsApplication,
  blockFlowText,
} = require("../services/lessonDraftValidation");

const BENCHMARK_TOPICS = [
  {
    label: "Reflex Arc",
    topic: "The reflex arc",
    topicKey: "aqa-gcse-biology:reflex-arc",
    mustMatch: /withdrawal reflex|reflex arc|avoid injury|hot pan/i,
  },
  {
    label: "Cell Structure",
    topic: "Cell structure",
    topicKey: "aqa-gcse-biology:cell-structure",
    mustMatch: /microscopy|specialised cells|diagnos/i,
  },
  {
    label: "Blood Glucose",
    topic: "Control of blood glucose concentration",
    topicKey: "aqa-gcse-biology:control-blood-glucose",
    mustMatch: /diabetes|insulin|blood glucose/i,
  },
  {
    label: "Mitosis",
    topic: "Mitosis and the cell cycle",
    topicKey: "aqa-gcse-biology:mitosis-cell-cycle",
    mustMatch: /mitosis|growth|repair|cancer/i,
  },
  {
    label: "Materials Cycled",
    topic: "How materials are cycled",
    topicKey: "aqa-gcse-biology:how-materials-cycled",
    mustMatch: /decomposition|farms|ecosystem|climate|carbon cycle/i,
  },
];

function sparseTheoryDraft(blockCount = 12) {
  const blocks = [];
  for (let i = 0; i < blockCount; i++) {
    blocks.push({
      type: "text",
      role: i === 0 ? "hook" : "concept",
      title: `Block ${i + 1}`,
      content: `Teaching content for block ${i + 1}.`,
    });
  }
  blocks.push({ type: "keyIdea", role: "finalMemoryRule", content: "Remember the key idea." });
  blocks.push({
    type: "checkpoint",
    role: "workedExample",
    prompt: "Explain the process. (4 marks)",
    questionType: "short",
    options: [],
    correctAnswer: "Point one because reason.",
    explanation:
      "- Point one because this shows understanding.\n- Point two therefore the process continues.\n- Point three so that the outcome is clear.",
  });
  return {
    title: "Test lesson",
    pages: [{ title: "Page 1", order: 1, blocks }],
  };
}

function secondHalfApplicationBlocks(blocks) {
  const mid = Math.ceil(blocks.length / 2);
  return blocks
    .slice(mid)
    .filter((b) => blockMentionsApplication(blockFlowText(b)));
}

describe("ensureRealWorldApplicationBlock (Phase 3b.3f.6A)", () => {
  test.each(BENCHMARK_TOPICS)("$label — inserts topic-specific application in second half", ({ topic, topicKey, mustMatch }) => {
    const draft = sparseTheoryDraft(14);
    const before = draft.pages[0].blocks.length;

    ensureRealWorldApplicationBlock(draft, topic, { topicKey, subTopic: topic });

    const blocks = draft.pages[0].blocks;
    expect(blocks.length).toBe(before + 1);

    const apps = secondHalfApplicationBlocks(blocks);
    expect(apps.length).toBeGreaterThanOrEqual(1);

    const inserted = blocks.find((b) => /real-world application/i.test(String(b.title || "")));
    expect(inserted).toBeTruthy();
    expect(inserted.content).toMatch(mustMatch);
    expect(inserted.content).toMatch(/real-world|for example|used in/i);
    expect(inserted.content).not.toMatch(/this is important in real life/i);

    const mid = Math.ceil(blocks.length / 2);
    const insertIdx = blocks.indexOf(inserted);
    expect(insertIdx).toBeGreaterThanOrEqual(mid);
  });

  test("preserves existing strong application block in second half", () => {
    const draft = sparseTheoryDraft(10);
    const blocks = draft.pages[0].blocks;
    const mid = Math.ceil(blocks.length / 2);
    blocks.splice(mid + 1, 0, {
      type: "text",
      title: "Clinical link",
      role: "concept",
      content:
        "**Real-world application:** Doctors use this idea in medicine when treating patients — for example, insulin therapy in diabetes management.",
    });

    const beforeCount = blocks.length;
    ensureRealWorldApplicationBlock(draft, "Control of blood glucose", {
      topicKey: "aqa-gcse-biology:control-blood-glucose",
    });

    expect(draft.pages[0].blocks.length).toBe(beforeCount);
    expect(
      draft.pages[0].blocks.filter((b) => /clinical link|insulin therapy/i.test(blockFlowText(b))).length
    ).toBe(1);
  });

  test("inserted block satisfies validateLessonStructure application rule on sparse draft", () => {
    const draft = sparseTheoryDraft(16);
    draft.pages[0].blocks.push(
      { type: "diagram", role: "concept", content: "d1", caption: "d1" },
      { type: "diagram", role: "concept", content: "d2", caption: "d2" },
      { type: "commonMistake", role: "commonMistake", content: "Wrong: x\nCorrect: y\nExam link: z" },
      { type: "keyIdea", role: "patternRecognition", content: "Pattern" },
      { type: "keyIdea", role: "synthesis", content: "Synthesis" }
    );

    ensureRealWorldApplicationBlock(draft, "The reflex arc", {
      topicKey: "aqa-gcse-biology:reflex-arc",
      subTopic: "The reflex arc",
    });

    const result = validateLessonStructure(draft, { isManual: false });
    expect(result.blocking).not.toContain(
      "Real-world or medical application is missing or appears too weakly."
    );
  });

  test("Required Practical mode — no application block inserted", () => {
    const draft = sparseTheoryDraft(12);
    const before = draft.pages[0].blocks.length;

    ensureRealWorldApplicationBlock(draft, "Required practical: reaction time", {
      topicKey: "aqa-gcse-biology:rp-reaction-time",
      subTopic: "Required practical: reaction time",
    });

    expect(draft.pages[0].blocks.length).toBe(before);
    expect(secondHalfApplicationBlocks(draft.pages[0].blocks).length).toBe(0);
  });

  test("buildTopicAwareRealWorldApplication rejects generic filler phrasing", () => {
    const fb = buildTopicAwareRealWorldApplication("Photosynthesis", { topicKey: "photosynthesis" });
    expect(fb.content).toMatch(/real-world|for example|used in/i);
    expect(fb.content).not.toMatch(/this is important in real life/i);
  });
});
