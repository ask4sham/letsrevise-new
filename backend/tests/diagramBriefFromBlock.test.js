/**
 * P3.0C — Diagram brief from lesson block tests.
 */
const {
  lessonBlockToDiagramSpec,
  composeDiagramBriefFromBlock,
} = require("../services/diagramSpecificationEngine");

const BRAIN_LESSON = {
  subject: "Biology",
  board: "AQA",
  tier: "Higher",
  topic: "The Brain",
  subTopic: "Brain Regions and Functions",
};

const BRAIN_PAGE = { title: "Brain Regions and Functions" };

const BRAIN_DRAG_DROP_BLOCK = {
  type: "dragDropMatch",
  title: "Brain Regions — Structure to Function",
  matchMode: "diagram",
  instructions: "Match each function to the correct brain region.",
  pairs: [
    { id: "p1", prompt: "Thermoregulation control centre", answer: "Hypothalamus" },
    { id: "p2", prompt: "Master gland for endocrine control", answer: "Pituitary gland" },
    { id: "p3", prompt: "Controls breathing and heart rate", answer: "Medulla" },
    { id: "p4", prompt: "Coordinates balance and movement", answer: "Cerebellum" },
  ],
};

describe("diagramBriefFromBlock", () => {
  test("maps brain drag-drop block to structure-to-function spec", () => {
    const mapped = lessonBlockToDiagramSpec(BRAIN_DRAG_DROP_BLOCK, BRAIN_LESSON, BRAIN_PAGE);
    expect(mapped.ok).toBe(true);
    expect(mapped.spec.activityPedagogyType).toBe("structure-to-function");
    expect(mapped.spec.conceptCards).toHaveLength(4);
    expect(mapped.spec.layout.complexAnatomy).toBe(true);
  });

  test("composed brief uses region IDs and keeps biology in teacherMetadata", () => {
    const result = composeDiagramBriefFromBlock({
      block: BRAIN_DRAG_DROP_BLOCK,
      lesson: BRAIN_LESSON,
      page: BRAIN_PAGE,
    });
    expect(result.ok).toBe(true);
    expect(result.brief).toMatch(/Region 1 highlighted/i);
    expect(result.brief.toLowerCase()).not.toContain("hypothalamus");
    expect(result.brief).not.toContain("Thermoregulation control centre");
    expect(result.teacherMetadata).toMatch(/Region 1 = Hypothalamus/i);
    expect(result.teacherMetadata).toContain("Thermoregulation control centre");
  });

  test("static diagram block maps to labelled spec", () => {
    const result = composeDiagramBriefFromBlock({
      block: {
        type: "diagram",
        title: "Photosynthesis",
        caption: "Overall equation and chloroplast inputs/outputs",
        annotations: [
          { id: "a1", text: "SUNLIGHT" },
          { id: "a2", text: "CHLOROPLAST" },
        ],
      },
      lesson: { subject: "Biology", board: "AQA", tier: "Higher", topic: "Photosynthesis" },
      page: { title: "How plants make food" },
    });
    expect(result.ok).toBe(true);
    expect(result.spec.diagramType).toBe("labelled");
    expect(result.brief).toMatch(/Labels to use/i);
    expect(result.brief).toContain("SUNLIGHT");
  });

  test("unsupported block type returns error", () => {
    const result = composeDiagramBriefFromBlock({
      block: { type: "text", content: "Hello" },
      lesson: BRAIN_LESSON,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
