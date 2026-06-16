/**
 * P3.0E — Diagram brief from lesson block tests (activity-contract hardening).
 */
const {
  lessonBlockToDiagramSpec,
  composeDiagramBriefFromBlock,
} = require("../services/diagramSpecificationEngine");

const BRAIN_LESSON = {
  subject: "Biology",
  board: "AQA",
  tier: "Higher",
  topic: "The Nervous System",
  subTopic: "Brain Regions and Functions",
};

const BRAIN_PAGE = { title: "Brain Regions and Functions" };

const BRAIN_DRAG_DROP_BLOCK = {
  type: "dragDropMatch",
  title: "Brain Regions — Structure to Function",
  matchMode: "diagram",
  instructions: "Match each function to the correct brain region.",
  studentTask: "Drag each function card to the correct numbered region.",
  pairs: [
    { id: "p1", prompt: "Thermoregulation control centre", answer: "Hypothalamus" },
    { id: "p2", prompt: "Master gland for endocrine control", answer: "Pituitary gland" },
    { id: "p3", prompt: "Controls breathing and heart rate", answer: "Medulla" },
    { id: "p4", prompt: "Coordinates balance and movement", answer: "Cerebellum" },
  ],
};

const RULER_DROP_LESSON = {
  subject: "Biology",
  board: "AQA",
  tier: "Higher",
  topic: "Reaction Time Required Practical",
  subTopic: "Ruler Drop Method",
};

const RULER_DROP_PAGE = { title: "Ruler-drop response pathway" };

const RULER_DROP_BLOCK = {
  type: "interactiveDiagram",
  title: "Ruler-Drop Response Pathway",
  instructions:
    "Label the nervous pathway involved in the ruler-drop response to explain where delay can occur.",
  studentTask: "Drag each label to the correct letter on the diagram.",
  hotspots: [
    { id: "A", label: "Stimulus", description: "Ruler begins to fall" },
    { id: "B", label: "Receptor (eye)", description: "Detects ruler movement" },
    { id: "C", label: "Coordinator (CNS)", description: "Processes information in the brain/spinal cord" },
    { id: "D", label: "Effector (hand muscle)", description: "Hand catches the ruler" },
  ],
};

describe("diagramBriefFromBlock", () => {
  test("maps brain drag-drop block to structure-to-function activity contract", () => {
    const mapped = lessonBlockToDiagramSpec(BRAIN_DRAG_DROP_BLOCK, BRAIN_LESSON, BRAIN_PAGE);
    expect(mapped.ok).toBe(true);
    expect(mapped.spec.activityPedagogyType).toBe("structure-to-function");
    expect(mapped.spec.activityBrief?.answerOnImage).toBe("region-ids");
    expect(mapped.spec.activityBrief?.activityInstruction).toContain("Match each function");
    expect(mapped.spec.conceptCards).toHaveLength(4);
    expect(mapped.spec.layout.complexAnatomy).toBe(true);
  });

  test("brain drag-drop brief is activity-specific and keeps answers out of image prompt", () => {
    const result = composeDiagramBriefFromBlock({
      block: BRAIN_DRAG_DROP_BLOCK,
      lesson: BRAIN_LESSON,
      page: BRAIN_PAGE,
    });
    expect(result.ok).toBe(true);
    expect(result.metadata?.activityContract).toBe(true);
    expect(result.brief).toMatch(/Brain Regions — Structure to Function/i);
    expect(result.brief).toContain("Match each function to the correct brain region.");
    expect(result.brief).toMatch(/Region 1 highlighted/i);
    expect(result.brief).toMatch(/ANSWER DISPLAY RULE/i);
    expect(result.brief).toMatch(/region-ids|numbered region markers/i);
    expect(result.brief.toLowerCase()).not.toContain("hypothalamus");
    expect(result.brief).not.toContain("Thermoregulation control centre");
    expect(result.teacherMetadata).toMatch(/Region 1 = Hypothalamus/i);
    expect(result.teacherMetadata).toContain("Thermoregulation control centre");
  });

  test("ruler-drop interactive diagram brief is activity-specific with letter hotspots", () => {
    const result = composeDiagramBriefFromBlock({
      block: RULER_DROP_BLOCK,
      lesson: RULER_DROP_LESSON,
      page: RULER_DROP_PAGE,
    });
    expect(result.ok).toBe(true);
    expect(result.spec.activityBrief?.answerOnImage).toBe("letters-only");
    expect(result.brief).toMatch(/ruler-drop response/i);
    expect(result.brief).toMatch(/where delay can occur/i);
    expect(result.brief).toMatch(/Hotspot A:/i);
    expect(result.brief).toMatch(/Hotspot B:/i);
    expect(result.brief).toMatch(/Hotspot C:/i);
    expect(result.brief).toMatch(/Hotspot D:/i);
    expect(result.brief).toContain("Stimulus");
    expect(result.brief).toContain("Receptor (eye)");
    expect(result.brief).toContain("Coordinator (CNS)");
    expect(result.brief).toContain("Effector (hand muscle)");
    expect(result.brief).toMatch(/letter marker on image/i);
    expect(result.brief).toMatch(/Ruler-drop required practical setup/i);
    expect(result.brief).not.toMatch(/Labels to use/i);
    expect(result.teacherMetadata).toMatch(/Hotspot A → Stimulus/i);
    expect(result.teacherMetadata).toContain("Receptor (eye)");
  });

  test("ruler-drop brief avoids generic-only phrasing", () => {
    const result = composeDiagramBriefFromBlock({
      block: RULER_DROP_BLOCK,
      lesson: RULER_DROP_LESSON,
      page: RULER_DROP_PAGE,
    });
    expect(result.brief).toMatch(/for the "Ruler-Drop Response Pathway" activity/i);
    expect(result.brief).toMatch(/IMAGE MUST SHOW/i);
    expect(result.brief).toMatch(/not a generic nervous system overview/i);
  });

  test("static diagram block uses caption and activity instruction", () => {
    const result = composeDiagramBriefFromBlock({
      block: {
        type: "diagram",
        title: "Photosynthesis",
        caption: "Overall equation and chloroplast inputs/outputs",
        subtitle: "Students label reactants and products.",
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
    expect(result.brief).toContain("Students label reactants and products.");
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
