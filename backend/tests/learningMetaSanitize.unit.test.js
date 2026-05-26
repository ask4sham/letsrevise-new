/**
 * learningMeta survives sanitisePagesInput without affecting legacy blocks.
 */
const { sanitisePagesInput } = require("../routes/lessons");
const {
  attachLearningMetaToSanitisedBlock,
  sanitizeLearningMeta,
} = require("../utils/sanitizeLearningMeta");

describe("sanitisePagesInput learningMeta", () => {
  it("preserves learningMeta on text blocks", () => {
    const pages = sanitisePagesInput([
      {
        pageId: "p1",
        order: 1,
        title: "Page 1",
        blocks: [
          {
            type: "text",
            content: "Plain lesson text",
            learningMeta: {
              concept: "Photosynthesis",
              skill: "Explain",
              difficulty: "medium",
            },
          },
        ],
      },
    ]);
    expect(pages[0].blocks[0].learningMeta).toEqual({
      concept: "Photosynthesis",
      skill: "Explain",
      difficulty: "medium",
    });
  });

  it("works when learningMeta is omitted (legacy lesson)", () => {
    const pages = sanitisePagesInput([
      {
        pageId: "p1",
        order: 1,
        blocks: [{ type: "text", content: "Legacy" }],
      },
    ]);
    expect(pages[0].blocks[0].content).toBe("Legacy");
    expect(pages[0].blocks[0].learningMeta).toBeUndefined();
  });

  it("preserves learningMeta on interactiveSequence without changing steps", () => {
    const pages = sanitisePagesInput([
      {
        pageId: "p1",
        order: 1,
        blocks: [
          {
            type: "interactiveSequence",
            title: "Process",
            intro: "",
            sequenceSteps: [
              {
                title: "Step 1",
                description: "Do something",
                imageUrl: "/img.png",
                caption: "Key",
              },
            ],
            learningMeta: { examSkill: "Describe a process" },
          },
        ],
      },
    ]);
    const b = pages[0].blocks[0];
    expect(b.type).toBe("interactiveSequence");
    expect(b.learningMeta).toEqual({ examSkill: "Describe a process" });
    expect(b.sequenceSteps).toHaveLength(1);
    expect(b.sequenceSteps[0].imageUrl).toBe("/img.png");
  });

  it("preserves learningMeta on dragDropMatch", () => {
    const pages = sanitisePagesInput([
      {
        pageId: "p1",
        order: 1,
        blocks: [
          {
            type: "dragDropMatch",
            matchMode: "text",
            pairs: [
              { id: "p1", prompt: "A", answer: "1" },
              { id: "p2", prompt: "B", answer: "2" },
            ],
            learningMeta: { misconceptionRisk: "Swapping labels" },
          },
        ],
      },
    ]);
    expect(pages[0].blocks[0].learningMeta.misconceptionRisk).toBe("Swapping labels");
    expect(pages[0].blocks[0].pairs).toHaveLength(2);
  });

  it("preserves learningMeta on graph blocks", () => {
    const pages = sanitisePagesInput([
      {
        pageId: "p1",
        order: 1,
        blocks: [
          {
            type: "graph",
            graphType: "line",
            xAxisLabel: "Light",
            yAxisLabel: "Rate",
            graphSeries: [{ id: "s1", label: "R", points: [{ x: 0, y: 1 }] }],
            learningMeta: { concept: "Limiting factor graph" },
          },
        ],
      },
    ]);
    expect(pages[0].blocks[0].type).toBe("graph");
    expect(pages[0].blocks[0].learningMeta.concept).toBe("Limiting factor graph");
    expect(pages[0].blocks[0].graphSeries).toHaveLength(1);
  });
});

describe("sanitizeLearningMeta", () => {
  it("attachLearningMetaToSanitisedBlock is a no-op without meta", () => {
    const base = { type: "text", content: "x" };
    expect(attachLearningMetaToSanitisedBlock(base, {})).toEqual(base);
  });
});
