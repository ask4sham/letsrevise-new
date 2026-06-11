/**
 * Phase 3b.3f.8A — Grade 7–9 stretch block helper.
 * @jest-environment node
 */

const {
  ensureGrade79StretchBlock,
  buildTopicAwareGrade79Stretch,
} = require("../routes/ai");
const { hasGrade79Signals } = require("../../lib/teacherBrain/teachingQualityRubric");

const BENCHMARK_TOPICS = [
  {
    label: "Reflex Arc",
    topic: "The reflex arc",
    topicKey: "aqa-gcse-biology:reflex-arc",
    mustMatch: /spinal cord|bypasses the brain|survival/i,
  },
  {
    label: "Cell Structure",
    topic: "Cell structure",
    topicKey: "aqa-gcse-biology:cell-structure",
    mustMatch: /mitochondria|chloroplast|structure to function/i,
  },
  {
    label: "Blood Glucose",
    topic: "Control of blood glucose concentration",
    topicKey: "aqa-gcse-biology:control-blood-glucose",
    mustMatch: /negative feedback|insulin|glucagon|diabetes/i,
  },
  {
    label: "Mitosis",
    topic: "Mitosis and the cell cycle",
    topicKey: "aqa-gcse-biology:mitosis-cell-cycle",
    mustMatch: /DNA replicates|daughter cells|cancer|growth/i,
  },
  {
    label: "Materials Cycled",
    topic: "How materials are cycled",
    topicKey: "aqa-gcse-biology:how-materials-cycled",
    mustMatch: /decomposers|carbon|ecosystem/i,
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
  blocks.push({ type: "keyIdea", role: "synthesis", content: "Synthesis point." });
  blocks.push({ type: "keyIdea", role: "finalMemoryRule", content: "Remember the key idea." });
  return {
    title: "Test lesson",
    pages: [{ title: "Page 1", order: 1, blocks }],
  };
}

describe("ensureGrade79StretchBlock (Phase 3b.3f.8A)", () => {
  test.each(BENCHMARK_TOPICS)("$label — inserts topic-specific stretch block", ({ topic, topicKey, mustMatch }) => {
    const draft = sparseTheoryDraft(10);
    const before = draft.pages[0].blocks.length;

    ensureGrade79StretchBlock(draft, topic, { topicKey, subTopic: topic });

    const blocks = draft.pages[0].blocks;
    expect(blocks.length).toBe(before + 1);

    const stretch = blocks.find((b) => b.type === "stretch");
    expect(stretch).toBeTruthy();
    expect(stretch.title).toMatch(/grade\s*7/i);
    expect(stretch.content).toMatch(mustMatch);
    expect(stretch.content).toMatch(/because|therefore|this means|which means/i);
    expect(hasGrade79Signals(stretch.content)).toBe(true);

    const fmrIdx = blocks.findIndex((b) => b.role === "finalMemoryRule");
    const stretchIdx = blocks.indexOf(stretch);
    expect(stretchIdx).toBeLessThan(fmrIdx);
  });

  test("preserves existing strong stretch block", () => {
    const draft = sparseTheoryDraft(8);
    const blocks = draft.pages[0].blocks;
    const strong = {
      type: "stretch",
      title: "Top-band stretch",
      content:
        "Grade 9: link receptor detection to effector response because precise causal chains earn top-band marks in homeostasis, therefore examiners reward full sequences.",
    };
    blocks.splice(blocks.length - 1, 0, strong);

    ensureGrade79StretchBlock(draft, "Homeostasis", {
      topicKey: "aqa-gcse-biology:homeostasis",
      subTopic: "Homeostasis",
    });

    const stretchBlocks = blocks.filter((b) => b.type === "stretch");
    expect(stretchBlocks).toHaveLength(1);
    expect(stretchBlocks[0].content).toBe(strong.content);
  });

  test("skips Required Practical mode", () => {
    const draft = sparseTheoryDraft(8);
    ensureGrade79StretchBlock(draft, "Reaction time", {
      topicKey: "aqa-gcse-biology:required-practical-reaction-time",
      subTopic: "Reaction time",
    });
    expect(draft.pages[0].blocks.some((b) => b.type === "stretch")).toBe(false);
  });

  test("buildTopicAwareGrade79Stretch returns generic fallback for unknown topics", () => {
    const built = buildTopicAwareGrade79Stretch("Unknown topic", { topicKey: "aqa-gcse-biology:unknown" });
    expect(built.title).toMatch(/grade\s*7/i);
    expect(built.content).toMatch(/because|therefore|this means/i);
    expect(hasGrade79Signals(built.content)).toBe(true);
  });
});
