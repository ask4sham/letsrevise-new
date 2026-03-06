/**
 * PR: AI lesson generation creates ONE default page with blocks.
 * Unit tests for contentGeneration collapse logic (starter-pack, weak-evidence-fix).
 */
const { collapseLlmPagesToSinglePage } = require("../controllers/contentGeneration.controller");

describe("contentGeneration: collapseLlmPagesToSinglePage", () => {
  const seed = "test-seed-12345";

  test("returns exactly 1 page when LLM returns multiple subsection pages", () => {
    const llmPages = [
      { title: "Core Concept 1", order: 1, blocks: [{ type: "text", content: "Eukaryotic cells have a nucleus." }] },
      { title: "Exam Tips", order: 2, blocks: [{ type: "text", content: "Know organelle functions for the exam." }] },
      {
        title: "Check Understanding",
        order: 3,
        blocks: [],
        checkpoint: { question: "What contains DNA?", options: ["A", "B", "C", "D"], answer: "A" },
      },
    ];
    const result = collapseLlmPagesToSinglePage(llmPages, seed);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Page 1");
    expect(result[0].blocks.length).toBeGreaterThanOrEqual(2);
    const hasCheckpoint = result[0].blocks.some((b) => b.type === "checkpoint");
    expect(hasCheckpoint).toBe(true);
  });

  test("maps subsection titles to block types (Core Concept → keyIdea, Exam Tips → examTip)", () => {
    const llmPages = [
      { title: "Core Concept 1", order: 1, blocks: [{ type: "text", content: "Key content." }] },
      { title: "Exam Tips", order: 2, blocks: [{ type: "text", content: "Exam tip content." }] },
    ];
    const result = collapseLlmPagesToSinglePage(llmPages, seed);
    expect(result).toHaveLength(1);
    const blocks = result[0].blocks;
    const keyIdeaBlock = blocks.find((b) => b.type === "keyIdea");
    const examTipBlock = blocks.find((b) => b.type === "examTip");
    expect(keyIdeaBlock).toBeDefined();
    expect(examTipBlock).toBeDefined();
  });

  test("no separate pages for Core Concept, Exam Tips, Check Understanding, Stretch", () => {
    const llmPages = [
      { title: "Overview", order: 1, blocks: [{ type: "text", content: "Intro." }] },
      { title: "Core Concept 2", order: 2, blocks: [{ type: "keyIdea", content: "Lock and key." }] },
      { title: "Stretch: Deeper Knowledge", order: 3, blocks: [{ type: "stretch", content: "Extension." }] },
    ];
    const result = collapseLlmPagesToSinglePage(llmPages, seed);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Page 1");
    const blocks = result[0].blocks;
    expect(blocks.some((b) => b.type === "stretch")).toBe(true);
  });

  test("empty pages returns single placeholder page", () => {
    const result = collapseLlmPagesToSinglePage([], seed);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Page 1");
    expect(result[0].blocks.length).toBeGreaterThanOrEqual(1);
  });

  test("single page from LLM passes through with blocks preserved", () => {
    const llmPages = [
      {
        title: "Page 1",
        order: 1,
        blocks: [
          { type: "text", content: "Content." },
          { type: "keyIdea", content: "Key point." },
          { type: "checkpoint", question: "Quick check?", options: ["A", "B", "C", "D"], answer: "A" },
        ],
      },
    ];
    const result = collapseLlmPagesToSinglePage(llmPages, seed);
    expect(result).toHaveLength(1);
    expect(result[0].blocks.length).toBe(3);
  });
});
