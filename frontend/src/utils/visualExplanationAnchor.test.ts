import {
  buildVisualExplanationContext,
  findVisualExplanationAnchor,
  getVisualExplanationTopic,
  isBlockRenderedInLessonView,
  isKickerLikeBlock,
  stripTeacherScaffolding,
  trimContextToMaxLength,
  VISUAL_EXPLANATION_CONTEXT_MAX_CHARS,
} from "./visualExplanationAnchor";

const lesson = {
  title: "Reflex arc",
  topic: "Nervous system — Reflex arc",
  subject: "Biology",
  level: "GCSE",
  examBoardName: "AQA",
};

describe("findVisualExplanationAnchor", () => {
  it("skips Revision Objectives", () => {
    const page = {
      pageId: "p1",
      title: "Reflex arc pathway",
      blocks: [
        { type: "keyIdea", role: "lessonObjectives", title: "Revision Objectives", content: "<ul><li>Recall stimulus</li></ul>" },
        { type: "text", role: "concept", title: "Core Learning", content: "<p>Reflex arc pathway from stimulus to response.</p>" },
      ],
    };
    const anchor = findVisualExplanationAnchor(page, lesson);
    expect(anchor?.anchorIndex).toBe(1);
    expect(anchor?.priorityTier).toBe(2);
  });

  it("skips Prior Knowledge", () => {
    const page = {
      pageId: "p1",
      blocks: [
        { type: "text", role: "priorKnowledge", title: "Prior Knowledge", content: "<p>Neurones carry impulses.</p>" },
        { type: "diagram", role: "concept", title: "Reflex arc diagram", caption: "Stimulus to effector" },
      ],
    };
    const anchor = findVisualExplanationAnchor(page, lesson);
    expect(anchor?.anchorIndex).toBe(1);
    expect(anchor?.priorityTier).toBe(1);
  });

  it("chooses Core Teaching / Core Learning over later text", () => {
    const page = {
      pageId: "p1",
      blocks: [
        { type: "text", role: "hook", title: "Hook", content: "Imagine touching a hot pan." },
        { type: "text", role: "concept", title: "Core Learning", content: "<p>The reflex arc is a rapid pathway.</p>" },
        { type: "text", role: "concept", title: "Exam tip", content: "Use precise vocabulary in answers." },
      ],
    };
    const anchor = findVisualExplanationAnchor(page, lesson);
    expect(anchor?.anchorIndex).toBe(1);
    expect(anchor?.anchorTitle).toBe("Core Learning");
  });

  it("chooses diagram when available", () => {
    const page = {
      pageId: "p1",
      blocks: [
        { type: "text", role: "concept", title: "Core Learning", content: "<p>Teaching text about reflex arc.</p>" },
        { type: "diagram", role: "concept", title: "Reflex arc", caption: "Labelled GCSE diagram" },
      ],
    };
    const anchor = findVisualExplanationAnchor(page, lesson);
    expect(anchor?.anchorIndex).toBe(1);
    expect(anchor?.priorityTier).toBe(1);
  });

  it("falls back safely before checkpoint blocks", () => {
    const page = {
      pageId: "p1",
      blocks: [
        { type: "text", role: "lessonObjectives", title: "Revision Objectives", content: "List" },
        { type: "text", role: "priorknowledge", title: "Prior Knowledge", content: "List" },
        { type: "text", role: "concept", title: "Scenario", content: "Short intro only." },
        { type: "checkpoint", role: "quickCheck", prompt: "Which neurone carries the impulse to the CNS?", options: ["A", "B"] },
      ],
    };
    const anchor = findVisualExplanationAnchor(page, lesson);
    expect(anchor?.anchorIndex).toBe(2);
    expect(anchor?.priorityTier).toBe(7);
  });

  it("skips kicker-like blocks hidden from render and anchors a visible block", () => {
    const page = {
      pageId: "p1",
      blocks: [
        { type: "text", role: "lessonObjectives", title: "Revision Objectives", content: "List" },
        { type: "text", role: "priorKnowledge", title: "Prior Knowledge", content: "List" },
        { type: "text", content: "Reflex arc (GCSE)" },
        {
          type: "text",
          role: "concept",
          title: "Core Learning",
          content: "<p>Reflex arc pathway from stimulus to response.</p>",
        },
      ],
    };
    expect(isKickerLikeBlock(page.blocks[2])).toBe(true);
    expect(isBlockRenderedInLessonView(page.blocks[2], { showPageKicker: false })).toBe(false);

    const anchor = findVisualExplanationAnchor(page, lesson, { showPageKicker: false });
    expect(anchor?.anchorIndex).toBe(3);
    expect(anchor?.anchorTitle).toBe("Core Learning");

    const renderedIndices = page.blocks
      .map((block, idx) => ({ block, idx }))
      .filter(({ block }) => isBlockRenderedInLessonView(block, { showPageKicker: false }))
      .map(({ idx }) => idx);
    expect(renderedIndices).toContain(anchor!.anchorIndex);
  });
});

describe("stripTeacherScaffolding", () => {
  it("removes emojis and design brief language", () => {
    const raw =
      "👉 🧠 Prior Knowledge\nReport issue with this block\nDesign brief: draw a neuron\n<p><strong>Core Learning</strong></p><p>Reflex arc pathway.</p>";
    const out = stripTeacherScaffolding(raw);
    expect(out).not.toMatch(/👉|🧠|Report issue|Design brief/i);
    expect(out).toMatch(/Core Learning/i);
    expect(out).toMatch(/Reflex arc pathway/i);
  });
});

describe("buildVisualExplanationContext", () => {
  it("trims context to backend limit", () => {
    const longBody = "Pathway ".repeat(200);
    const page = {
      pageId: "p1",
      title: "Reflex arc pathway",
      blocks: [
        { type: "text", role: "concept", title: "Core Learning", content: `<p>${longBody}</p>` },
      ],
    };
    const anchor = findVisualExplanationAnchor(page, lesson);
    expect(anchor).not.toBeNull();
    const context = buildVisualExplanationContext(page, anchor!.anchorIndex, lesson);
    expect(context.length).toBeLessThanOrEqual(VISUAL_EXPLANATION_CONTEXT_MAX_CHARS);
    expect(context).toMatch(/Topic: Nervous system/);
    expect(context).toMatch(/Anchor: Core Learning/);
  });
});

describe("trimContextToMaxLength", () => {
  it("does not break words when a space exists late in the slice", () => {
    const text = "one two three four five six seven eight nine ten eleven twelve";
    const trimmed = trimContextToMaxLength(text, 30);
    expect(trimmed.endsWith(" ")).toBe(false);
    expect(trimmed.split(" ").every((w) => text.includes(w))).toBe(true);
  });
});

describe("getVisualExplanationTopic", () => {
  it("prefers anchor block title", () => {
    const topic = getVisualExplanationTopic(
      { title: "Page 1" },
      lesson,
      { type: "diagram", title: "Reflex arc diagram", caption: "Stimulus to effector" }
    );
    expect(topic).toBe("Reflex arc diagram");
  });
});
