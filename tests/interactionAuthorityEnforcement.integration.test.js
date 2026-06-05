/**
 * Phase 3G.8 — integration tests for interaction authority enforcement pipeline.
 */

const {
  enforceInteractionAuthorityOnDraft,
  countForbiddenPrimaryActivities,
} = require("../lib/teacherBrain/interactionAuthorityEnforcer");
const { runTeacherBrain } = require("../lib/teacherBrain");
const {
  injectDiagramAndActivityBriefs,
  BRIEF_MARKER,
  resolveInteractiveDiagramTopicKind,
  resolveInteractiveSequenceTopicKind,
} = require("../lib/teacherBrain/diagramBriefInjector");

const STRUCTURE_INPUT = {
  topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
  subTopic: "Structure and function of the nervous system",
  topic: "Structure and function of the nervous system",
};

function contaminatedNervousSystemPages() {
  return [
    {
      title: "Page 1",
      order: 1,
      blocks: [
        {
          type: "text",
          title: "Key examples",
          content: "Sensory neurones, motor neurones, CNS, PNS — reflex pathway as a neighbour mention.",
        },
        {
          type: "keyIdea",
          title: "What to Notice",
          role: "whatToNotice",
          content: "Focus on the labelled parts or key features on the neurone diagram.",
        },
        {
          type: "dragDropMatch",
          title: "REFLEX ARC PATHWAY",
          content: "Order the reflex arc pathway from stimulus to effector",
        },
        {
          type: "checkpoint",
          prompt:
            "Explain how the eye focuses on a near object. Include ciliary muscles and suspensory ligaments.",
          questionType: "short",
          correctAnswer: "Lens becomes thicker.",
        },
        {
          type: "interactiveDiagram",
          title: "Label brain regions",
          content: "Label cerebellum, medulla and cerebral cortex.",
        },
        {
          type: "dragDropMatch",
          title: "Thermoregulation responses",
          content: "Sort sweating and vasodilation for body temperature control",
        },
        {
          type: "dragDropMatch",
          title: "Neurone structure labelling",
          content: "Label dendrites, axon, myelin sheath and cell body",
        },
      ],
    },
  ];
}

describe("interactionAuthorityEnforcement integration (Phase 3G.8)", () => {
  const prevBoundary = process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;

  afterEach(() => {
    if (prevBoundary === undefined) delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    else process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = prevBoundary;
  });

  test("contaminated fixture → zero forbidden primary activities after enforce (sanitizeDraft path)", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const pages = contaminatedNervousSystemPages();
    expect(countForbiddenPrimaryActivities(pages, STRUCTURE_INPUT)).toBeGreaterThanOrEqual(4);

    const result = enforceInteractionAuthorityOnDraft({
      pages,
      ...STRUCTURE_INPUT,
    });

    expect(result.changed).toBe(true);
    expect(countForbiddenPrimaryActivities(result.pages, STRUCTURE_INPUT)).toBe(0);
    expect(result.enforcement.blocksRerouted.length).toBeGreaterThanOrEqual(4);

    const keyExamples = result.pages[0].blocks.find((b) => b.title === "Key examples");
    expect(keyExamples.content).toMatch(/reflex pathway/i);

    const whatToNotice = result.pages[0].blocks.find((b) => b.title === "What to Notice");
    expect(whatToNotice.content).toMatch(/Focus on the labelled parts/i);

    const authorised = result.pages[0].blocks.filter((b) => b._authorityEnforced);
    expect(authorised.length).toBeGreaterThanOrEqual(4);
    expect(result.pages[0].blocks.some((b) => /Neurone structure/i.test(b.title || ""))).toBe(true);
  });

  test("nervous-system-structure diagram brief injector uses generic not brain/reflexArc headers", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    expect(
      resolveInteractiveDiagramTopicKind({
        topic: STRUCTURE_INPUT.topic,
        topicKey: STRUCTURE_INPUT.topicKey,
        subTopic: STRUCTURE_INPUT.subTopic,
      })
    ).toBe("generic");
    expect(
      resolveInteractiveSequenceTopicKind({
        topic: STRUCTURE_INPUT.topic,
        topicKey: STRUCTURE_INPUT.topicKey,
        subTopic: STRUCTURE_INPUT.subTopic,
      })
    ).toBe("generic");

    const brain = runTeacherBrain({
      topic: STRUCTURE_INPUT.topic,
      topicKey: STRUCTURE_INPUT.topicKey,
      subTopic: STRUCTURE_INPUT.subTopic,
      subject: "Biology",
      examBoard: "AQA",
      tier: "Higher",
    });

    const pages = [
      {
        title: "Page 1",
        blocks: [{ type: "interactiveDiagram", title: "Interactive Diagram", intro: "Label the diagram." }],
      },
    ];

    const { pages: injected, injections } = injectDiagramAndActivityBriefs(pages, brain, {
      topic: STRUCTURE_INPUT.topic,
      topicKey: STRUCTURE_INPUT.topicKey,
      subTopic: STRUCTURE_INPUT.subTopic,
    });

    const note = injected[0].blocks[0].note || "";
    expect(note).toContain(BRIEF_MARKER);
    expect(note).not.toMatch(/BRAIN DIAGRAM BRIEF/i);
    expect(note).not.toMatch(/REFLEX ARC DIAGRAM BRIEF/i);
    expect(note).not.toMatch(/EYE DIAGRAM BRIEF/i);
    expect(injections[0].interactiveDiagramTopicKind).toBe("generic");
  });
});
