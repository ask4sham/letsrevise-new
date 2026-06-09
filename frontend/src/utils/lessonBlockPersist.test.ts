import { diagramBlockForPersist, graphBlockForLessonSave } from "./lessonBlockPersist";

describe("diagramBlockForPersist", () => {
  it("preserves imageUrl, caption, role visual, and diagramVariant for generator imports", () => {
    const out = diagramBlockForPersist({
      type: "diagram",
      title: "Photosynthesis overview",
      role: "visual",
      imageUrl: "https://cdn.example.com/photo.svg",
      caption: "Cross-section of a leaf",
      diagramVariant: "featured",
      content: "<p>Study the diagram.</p>",
      number: 8,
    });
    expect(out).toMatchObject({
      type: "diagram",
      title: "Photosynthesis overview",
      role: "visual",
      imageUrl: "https://cdn.example.com/photo.svg",
      caption: "Cross-section of a leaf",
      diagramVariant: "featured",
    });
    expect(String(out.content)).toContain("Study the diagram");
  });

  it("persists dedicated studentTask field separately from subtitle", () => {
    const out = diagramBlockForPersist({
      type: "diagram",
      title: "Reflex arc",
      subtitle: "Study the reflex arc shown in the diagram.",
      studentTask: "Task\n\n1. Name the five stages.",
      caption: "GCSE AQA Biology",
      imageUrl: "https://cdn.example.com/reflex.png",
    });
    expect(out).toMatchObject({
      type: "diagram",
      title: "Reflex arc",
      subtitle: "Study the reflex arc shown in the diagram.",
      studentTask: "Task\n\n1. Name the five stages.",
      caption: "GCSE AQA Biology",
      imageUrl: "https://cdn.example.com/reflex.png",
    });
  });

  it("does not inject image here placeholder when imageUrl is set", () => {
    const out = diagramBlockForPersist({
      type: "diagram",
      imageUrl: "https://cdn.example.com/leaf.png",
      caption: "Leaf",
    });
    expect(out.imageUrl).toBe("https://cdn.example.com/leaf.png");
    expect(out.content).toBe("");
  });
});

describe("graphBlockForLessonSave", () => {
  it("recovers graph from JSON content when type was mis-tagged text", () => {
    const out = graphBlockForLessonSave({
      type: "text",
      content: JSON.stringify({
        graphType: "line",
        graphSeries: [{ id: "s1", label: "A", points: [{ x: 0, y: 1 }] }],
      }),
    });
    expect(out.type).toBe("graph");
    expect(out.content).toBe("");
    expect((out.graphSeries as unknown[]).length).toBe(1);
  });

  it("includes graphSeries with empty content (no JSON prose blob)", () => {
    const out = graphBlockForLessonSave({
      type: "graph",
      title: "Rate graph",
      graphType: "line",
      graphSeries: [
        {
          id: "s1",
          label: "Main",
          points: [
            { x: 0, y: 1 },
            { x: 1, y: 3 },
          ],
        },
      ],
      number: 8,
    });
    expect(out.type).toBe("graph");
    expect(out.number).toBe(8);
    expect(Array.isArray(out.graphSeries)).toBe(true);
    expect((out.graphSeries as unknown[]).length).toBe(1);
    expect(out.content).toBe("");
  });
});
