/**
 * Interactive sequence (step-by-step) topic specialization.
 */

const { runTeacherBrain } = require("../lib/teacherBrain");
const {
  injectDiagramAndActivityBriefs,
  BRIEF_MARKER,
  resolveInteractiveSequenceTopicKind,
} = require("../lib/teacherBrain/diagramBriefInjector");

function sampleSequencePage() {
  return [
    {
      title: "Page 1",
      blocks: [
        {
          type: "interactiveSequence",
          title: "Step-by-Step Process",
          intro: "Follow the process.",
          sequenceSteps: [],
        },
      ],
    },
  ];
}

function injectSequenceBrief(topic, extra = {}) {
  const brain = runTeacherBrain({ topic, subject: "Biology", ...extra });
  return injectDiagramAndActivityBriefs(sampleSequencePage(), brain, {
    topic: brain.topic || topic,
    topicKey: brain.topicKey || extra.topicKey,
    subTopic: brain.subTopic || extra.subTopic,
  });
}

describe("Interactive sequence topic specialization", () => {
  test("The brain does not produce ATP/metabolism step wording", () => {
    const { pages, injections } = injectSequenceBrief("The Brain");
    const note = pages[0].blocks[0].note || "";
    expect(note).toContain(BRIEF_MARKER);
    expect(note).toMatch(/NERVOUS SYSTEM STEP-BY-STEP BRIEF/i);
    expect(note).toMatch(/CNS processes the information/i);
    expect(note).not.toMatch(/Introduce the starting molecule/i);
    expect(note).not.toMatch(/Where is ATP involved/i);
    expect(injections[0].briefKind).toBe("stepByStep:brain");
  });

  test("reflex arc produces stimulus → effector sequence", () => {
    const { pages, injections } = injectSequenceBrief("The reflex arc");
    const note = pages[0].blocks[0].note || "";
    expect(note).toMatch(/REFLEX ARC STEP-BY-STEP BRIEF/i);
    expect(note).toMatch(/Stimulus detected by receptor/i);
    expect(note).toMatch(/Relay neurone passes impulse across synapse/i);
    expect(note).toMatch(/Effector produces response/i);
    expect(note).toMatch(/stimulus → receptor → sensory neurone/i);
    expect(note).not.toMatch(/ATP/i);
    expect(injections[0].briefKind).toBe("stepByStep:reflexArc");
  });

  test("nervous system topic resolves to brain sequence brief", () => {
    expect(resolveInteractiveSequenceTopicKind({ topic: "Nervous System" })).toBe("brain");
    const { pages } = injectSequenceBrief("Nervous System");
    expect(pages[0].blocks[0].note).toMatch(/NERVOUS SYSTEM STEP-BY-STEP BRIEF/i);
  });

  test("topicKey reflex-arc resolves when parent topic title differs", () => {
    const { pages } = injectSequenceBrief("Homeostasis and Response", {
      topicKey: "aqa-gcse-biology:reflex-arc",
    });
    expect(pages[0].blocks[0].note).toMatch(/REFLEX ARC STEP-BY-STEP BRIEF/i);
  });

  test("mitosis produces mitosis-specific steps", () => {
    const { pages, injections } = injectSequenceBrief("Mitosis and the cell cycle");
    const note = pages[0].blocks[0].note || "";
    expect(note).toMatch(/MITOSIS STEP-BY-STEP BRIEF/i);
    expect(note).toMatch(/Chromosomes line up at the centre/i);
    expect(note).not.toMatch(/ATP/i);
    expect(injections[0].briefKind).toBe("stepByStep:mitosis");
  });

  test("digestion produces digestion-specific steps", () => {
    const { pages } = injectSequenceBrief("Digestive system");
    expect(pages[0].blocks[0].note).toMatch(/DIGESTION STEP-BY-STEP BRIEF/i);
    expect(pages[0].blocks[0].note).toMatch(/small intestine/i);
  });

  test("photosynthesis produces photosynthesis-specific steps", () => {
    const { pages } = injectSequenceBrief("Photosynthesis");
    expect(pages[0].blocks[0].note).toMatch(/PHOTOSYNTHESIS STEP-BY-STEP BRIEF/i);
    expect(pages[0].blocks[0].note).toMatch(/chlorophyll/i);
  });

  test("metabolism keeps legacy ATP step-by-step brief", () => {
    const brain = runTeacherBrain({ topic: "Metabolism", subject: "Biology" });
    const { pages } = injectDiagramAndActivityBriefs(sampleSequencePage(), brain);
    const note = pages[0].blocks[0].note || "";
    expect(note).toMatch(/STEP-BY-STEP BRIEF/i);
    expect(note).not.toMatch(/REFLEX ARC STEP-BY-STEP/i);
    expect(note).not.toMatch(/NERVOUS SYSTEM STEP-BY-STEP/i);
    expect(note).toMatch(/ATP/i);
  });

  test("unknown topic uses generic STEP-BY-STEP fallback", () => {
    const { pages, injections } = injectSequenceBrief("Ecology");
    const note = pages[0].blocks[0].note || "";
    expect(note).toMatch(/STEP-BY-STEP BRIEF/i);
    expect(note).not.toMatch(/NERVOUS SYSTEM STEP-BY-STEP/i);
    expect(note).not.toMatch(/REFLEX ARC STEP-BY-STEP/i);
    expect(note).not.toMatch(/MITOSIS STEP-BY-STEP/i);
    expect(note).toMatch(/Where is ATP involved|Main structure or flow|Key label/i);
    expect(injections[0].briefKind).toBe("stepByStep");
  });
});
