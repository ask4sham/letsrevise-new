/**
 * PR3.2 — Unit test: sanitizePageForPreview strips explanation from checkpoint blocks.
 * USP 2a: correctAnswer is kept so frontend can show Correct/Not quite without revealing which option; explanation is never sent in preview.
 */
const { sanitizePageForPreview } = require("../utils/lessonPayload");

describe("sanitizePageForPreview", () => {
  test("strips explanation from checkpoint blocks; keeps correctAnswer for client-side marking", () => {
    const page = {
      pageId: "p1",
      title: "Test",
      blocks: [
        { type: "text", content: "Hello" },
        {
          type: "checkpoint",
          prompt: "What is X?",
          questionType: "mcq",
          options: ["A", "B", "C", "D"],
          correctAnswer: "B",
          explanation: "Because...",
        },
      ],
      checkpoint: { question: "Q?", options: ["1", "2"], answer: "1" },
    };
    const out = sanitizePageForPreview(page);
    expect(out.blocks).toHaveLength(2);
    const cpBlock = out.blocks.find((b) => b.type === "checkpoint");
    expect(cpBlock).toBeDefined();
    expect(cpBlock.prompt).toBe("What is X?");
    expect(cpBlock.options).toEqual(["A", "B", "C", "D"]);
    expect(cpBlock.correctAnswer).toBe("B");
    expect(cpBlock).not.toHaveProperty("explanation");
  });

  test("strips answer from page-level checkpoint", () => {
    const page = {
      pageId: "p1",
      blocks: [],
      checkpoint: { question: "Q?", options: ["A", "B"], answer: "A" },
    };
    const out = sanitizePageForPreview(page);
    expect(out.checkpoint.question).toBe("Q?");
    expect(out.checkpoint).not.toHaveProperty("answer");
  });

  test("keeps diagram blocks in preview with type, visualId, caption, mode, annotations, steps", () => {
    const page = {
      pageId: "p1",
      title: "Cells",
      blocks: [
        { type: "text", content: "Intro" },
        {
          type: "diagram",
          visualId: "507f1f77bcf86cd799439011",
          caption: "Animal cell",
          mode: "annotated",
          annotations: [{ id: "a1", kind: "label", text: "Nucleus", x: 0.3, y: 0.4 }],
          steps: [{ id: "s1", title: "Step 1", showAnnotationIds: ["a1"] }],
        },
      ],
    };
    const out = sanitizePageForPreview(page);
    expect(out.blocks).toHaveLength(2);
    const diagramBlock = out.blocks.find((b) => b.type === "diagram");
    expect(diagramBlock).toBeDefined();
    expect(diagramBlock.type).toBe("diagram");
    expect(diagramBlock.visualId).toBe("507f1f77bcf86cd799439011");
    expect(diagramBlock.caption).toBe("Animal cell");
    expect(diagramBlock.mode).toBe("annotated");
    expect(diagramBlock.annotations).toEqual([{ id: "a1", kind: "label", text: "Nucleus", x: 0.3, y: 0.4 }]);
    expect(diagramBlock.steps).toEqual([{ id: "s1", title: "Step 1", showAnnotationIds: ["a1"] }]);
    expect(Object.keys(diagramBlock).sort()).toEqual(
      ["annotations", "caption", "mode", "steps", "type", "visualId"].sort()
    );
  });

  test("diagram block without mode/annotations/steps gets mode default only", () => {
    const page = {
      pageId: "p1",
      blocks: [{ type: "diagram", visualId: "507f1f77bcf86cd799439011", caption: "Old style" }],
    };
    const out = sanitizePageForPreview(page);
    const diagramBlock = out.blocks[0];
    expect(diagramBlock.type).toBe("diagram");
    expect(diagramBlock.visualId).toBe("507f1f77bcf86cd799439011");
    expect(diagramBlock.caption).toBe("Old style");
    expect(diagramBlock.mode).toBe("static");
    expect(diagramBlock.annotations).toBeUndefined();
    expect(diagramBlock.steps).toBeUndefined();
  });
});
