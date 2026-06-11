/**
 * Phase 5B.3f.1 — strip V8 authoring tags from saved lesson content.
 * @jest-environment node
 */

const { stripV8AuthoringTags } = require("../routes/ai");

const V8_TAG_TYPES = ["definition", "mechanism", "comparison", "application", "evaluation"];

const V8_SAMPLE_LINES = {
  definition: "[v8 definition] In exams, state a precise definition using key terms from the specification.",
  mechanism: "[v8 mechanism] Show the sequence: what happens, then why it happens, using topic vocabulary.",
  comparison: "[v8 comparison] In compare questions, make both sides explicit and use a linking word (e.g. whereas).",
  application: "[v8 application] Add one concrete example or context so your answer is not only theoretical.",
  evaluation: "[v8 evaluation] For evaluation marks, balance strengths and limits, and link to evidence or context.",
};

function countV8TagsInDraft(draft) {
  const re = /\[v8 (?:definition|mechanism|comparison|application|evaluation)\]/gi;
  return (draft.pages || [])
    .flatMap((p) => p.blocks || [])
    .reduce((n, b) => n + (String(b.content || "").match(re) || []).length, 0);
}

function draftWithBlocks(blocks) {
  return {
    title: "Test lesson",
    pages: [{ title: "Page 1", order: 1, blocks }],
  };
}

describe("stripV8AuthoringTags (Phase 5B.3f.1)", () => {
  test.each(V8_TAG_TYPES)("removes [v8 %s] line from block content", (tagType) => {
    const draft = draftWithBlocks([
      {
        type: "text",
        role: "concept",
        content: `Real teaching content about the topic.\n\n${V8_SAMPLE_LINES[tagType]}`,
      },
    ]);

    stripV8AuthoringTags(draft);

    expect(draft.pages[0].blocks[0].content).toBe("Real teaching content about the topic.");
    expect(countV8TagsInDraft(draft)).toBe(0);
  });

  test("removes all five V8 tag types from a multi-block draft", () => {
    const blocks = V8_TAG_TYPES.map((tagType, i) => ({
      type: "text",
      role: i === 0 ? "hook" : "concept",
      title: `Block ${i + 1}`,
      content: `Topic content ${i + 1}.\n\n${V8_SAMPLE_LINES[tagType]}`,
    }));
    const draft = draftWithBlocks(blocks);
    const rolesBefore = blocks.map((b) => b.role);
    const titlesBefore = blocks.map((b) => b.title);

    stripV8AuthoringTags(draft);

    expect(countV8TagsInDraft(draft)).toBe(0);
    expect(draft.pages[0].blocks).toHaveLength(5);
    expect(draft.pages[0].blocks.map((b) => b.role)).toEqual(rolesBefore);
    expect(draft.pages[0].blocks.map((b) => b.title)).toEqual(titlesBefore);
    draft.pages[0].blocks.forEach((b, i) => {
      expect(b.content).toBe(`Topic content ${i + 1}.`);
    });
  });

  test("is case-insensitive", () => {
    const draft = draftWithBlocks([
      {
        type: "text",
        content: "Core idea.\n\n[V8 DEFINITION] Hidden authoring hint.",
      },
    ]);

    stripV8AuthoringTags(draft);

    expect(draft.pages[0].blocks[0].content).toBe("Core idea.");
    expect(countV8TagsInDraft(draft)).toBe(0);
  });

  test("preserves non-V8 content and block metadata", () => {
    const draft = draftWithBlocks([
      {
        type: "keyIdea",
        role: "coreRule",
        title: "Key idea",
        content: "Mitosis produces two identical daughter cells.",
        _intent: "definition",
      },
    ]);

    stripV8AuthoringTags(draft);

    expect(draft.pages[0].blocks[0].content).toBe("Mitosis produces two identical daughter cells.");
    expect(draft.pages[0].blocks[0]._intent).toBe("definition");
    expect(draft.pages[0].blocks[0].role).toBe("coreRule");
  });

  test("handles null draft and empty pages safely", () => {
    expect(stripV8AuthoringTags(null)).toBe(null);
    expect(stripV8AuthoringTags({ pages: [] })).toEqual({ pages: [] });
  });
});
