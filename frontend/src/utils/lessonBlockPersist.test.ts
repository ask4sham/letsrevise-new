import {
  diagramAuthoringInstructionsForEditor,
  diagramAuthoringInstructionsFromBlock,
  diagramBlockForPersist,
  diagramSubtitleFromBlock,
  graphBlockForLessonSave,
  mergeSavedDiagramAuthoringInstructions,
} from "./lessonBlockPersist";

const INSTRUCTIONS =
  "Follow how oxygen, carbon dioxide, and energy move through the body during exercise. Compare what happens during aerobic respiration and anaerobic respiration in muscle cells.";

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

  it("mirrors instructions into content for student GET round-trip", () => {
    const out = diagramBlockForPersist({
      type: "diagram",
      subtitle: INSTRUCTIONS,
      content: "Oxygen in, carbon dioxide out – the exercise pathway",
      imageUrl: "/uploads/diagram.png",
    });
    expect(out.content).toBe(INSTRUCTIONS);
    expect(diagramSubtitleFromBlock(out)).toBe(INSTRUCTIONS);
  });

  it("diagramAuthoringInstructionsForEditor reads long saved content", () => {
    expect(
      diagramAuthoringInstructionsForEditor({
        content: INSTRUCTIONS,
      })
    ).toBe(INSTRUCTIONS);
  });

  it("diagramAuthoringInstructionsForEditor ignores short generator content blurbs", () => {
    expect(
      diagramAuthoringInstructionsForEditor({
        content: "Oxygen in, carbon dioxide out – the exercise pathway",
      })
    ).toBeUndefined();
  });

  it("dual-writes diagram instructions to intro for legacy schema compatibility", () => {
    const out = diagramBlockForPersist({
      type: "diagram",
      subtitle:
        "Follow how oxygen, carbon dioxide, and energy move through the body during exercise.",
      imageUrl: "/uploads/diagram.png",
    });
    expect(out.subtitle).toContain("Follow how oxygen");
    expect(out.intro).toBe(out.subtitle);
    expect(out.note).toBe(out.subtitle);
    expect(out.content).toBe(out.subtitle);
  });

  it("diagramAuthoringInstructionsFromBlock ignores legacy content", () => {
    expect(
      diagramAuthoringInstructionsFromBlock({
        content: "Oxygen in, carbon dioxide out – the exercise pathway",
      })
    ).toBeUndefined();
  });

  it("does not promote legacy content to subtitle on save", () => {
    const out = diagramBlockForPersist({
      type: "diagram",
      content:
        "<p>Follow how oxygen, carbon dioxide, and energy move through the body during exercise.</p>",
      imageUrl: "/uploads/diagram.png",
    });
    expect(out.subtitle).toBeUndefined();
    expect(out.intro).toBeUndefined();
  });

  it("diagramSubtitleFromBlock reads intro when subtitle missing", () => {
    expect(
      diagramSubtitleFromBlock({
        intro: "Follow how oxygen, carbon dioxide, and energy move through the body during exercise.",
      })
    ).toContain("Follow how oxygen");
  });

  it("mergeSavedDiagramAuthoringInstructions restores instructions after stale refetch", () => {
    const saved = [
      {
        pageId: "p1",
        blocks: [
          {
            type: "diagram",
            subtitle:
              "Follow how oxygen, carbon dioxide, and energy move through the body during exercise.",
          },
        ],
      },
    ];
    const loaded = [
      {
        pageId: "p1",
        blocks: [
          {
            type: "diagram",
            content: "Oxygen in, carbon dioxide out – the exercise pathway",
          },
        ],
      },
    ];
    const merged = mergeSavedDiagramAuthoringInstructions(loaded, saved);
    expect(merged[0].blocks?.[0]).toMatchObject({
      subtitle:
        "Follow how oxygen, carbon dioxide, and energy move through the body during exercise.",
    });
  });

  it("diagramSubtitleFromBlock prefers explicit subtitle", () => {
    expect(
      diagramSubtitleFromBlock({
        subtitle: "Label the parts.",
        content: "<p>Other text that is long enough to qualify.</p>",
      })
    ).toBe("Label the parts.");
  });

  it("persists subtitle for student-facing instructions", () => {
    const out = diagramBlockForPersist({
      type: "diagram",
      title: "Leaf structure",
      subtitle: "Identify the palisade and spongy mesophyll.",
      caption: "Source: exam board specimen",
      imageUrl: "https://cdn.example.com/leaf.png",
    });
    expect(out).toMatchObject({
      title: "Leaf structure",
      subtitle: "Identify the palisade and spongy mesophyll.",
      caption: "Source: exam board specimen",
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
