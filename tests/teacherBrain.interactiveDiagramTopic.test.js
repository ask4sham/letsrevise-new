/**
 * Interactive Diagram topic specialization (Brain, Reflex Arc, Eye, Cell).
 */

const { runTeacherBrain } = require("../lib/teacherBrain");
const {
  injectDiagramAndActivityBriefs,
  BRIEF_MARKER,
  resolveInteractiveDiagramTopicKind,
} = require("../lib/teacherBrain/diagramBriefInjector");

function sampleInteractiveDiagramPage() {
  return [
    {
      title: "Page 1",
      blocks: [
        {
          type: "interactiveDiagram",
          title: "Interactive Diagram",
          intro: "Label the diagram.",
          hotspots: [],
        },
      ],
    },
  ];
}

describe("Interactive Diagram topic specialization", () => {
  test.each([
    ["The brain", "brain", /BRAIN DIAGRAM BRIEF/i, /Cerebral cortex/i],
    ["The Brain", "brain", /BRAIN DIAGRAM BRIEF/i, /Cerebral cortex/i],
    ["Brain", "brain", /BRAIN DIAGRAM BRIEF/i, /Medulla/i],
    ["The reflex arc", "reflexArc", /REFLEX ARC DIAGRAM BRIEF/i, /Sensory neurone/i],
    ["The eye", "eye", /EYE DIAGRAM BRIEF/i, /Retina/i],
    ["Cell structure", "cell", /CELL DIAGRAM BRIEF/i, /Mitochondria/i],
    ["Animal and plant cells", "cell", /CELL DIAGRAM BRIEF/i, /Nucleus/i],
  ])("topic %s → %s brief", (topic, kind, headerRe, contentRe) => {
    expect(resolveInteractiveDiagramTopicKind({ topic })).toBe(kind);

    const brain = runTeacherBrain({ topic, subject: "Biology", examBoard: "AQA", tier: "Higher" });
    expect(brain.topic).toBe(topic);
    expect(brain.requiredDiagrams[0].title).toMatch(
      kind === "brain"
        ? /Brain/i
        : kind === "reflexArc"
          ? /Reflex/i
          : kind === "eye"
            ? /Eye/i
            : /Cell/i
    );

    const { pages, injections } = injectDiagramAndActivityBriefs(sampleInteractiveDiagramPage(), brain);
    const note = pages[0].blocks[0].note || "";
    expect(note).toContain(BRIEF_MARKER);
    expect(note).toMatch(headerRe);
    expect(note).toMatch(contentRe);
    expect(note).not.toMatch(/^DIAGRAM BRIEF$/m);
    expect(injections[0].briefKind).toBe(`diagram:${kind}`);
    expect(injections[0].interactiveDiagramTopicKind).toBe(kind);
  });

  test("Metabolism keeps metabolism diagram brief (not topic specialization header)", () => {
    const brain = runTeacherBrain({ topic: "Metabolism", subject: "Biology" });
    const { pages } = injectDiagramAndActivityBriefs(sampleInteractiveDiagramPage(), brain);
    const note = pages[0].blocks[0].note || "";
    expect(note).toMatch(/DIAGRAM BRIEF/i);
    expect(note).not.toMatch(/BRAIN DIAGRAM BRIEF/i);
    expect(note).toMatch(/Cell's Economy|Metabolism/i);
  });

  test("topicKey the-brain resolves when topic title is a parent unit", () => {
    const brain = runTeacherBrain({
      topic: "Homeostasis and Response",
      topicKey: "aqa-gcse-biology:the-brain",
      subject: "Biology",
    });
    expect(resolveInteractiveDiagramTopicKind({ topic: brain.topic, topicKey: brain.topicKey })).toBe(
      "brain"
    );
    const { pages } = injectDiagramAndActivityBriefs(sampleInteractiveDiagramPage(), brain, {
      topic: brain.topic,
      topicKey: brain.topicKey,
    });
    expect(pages[0].blocks[0].note).toMatch(/BRAIN DIAGRAM BRIEF/i);
    expect(pages[0].blocks[0].note).toMatch(/Spinal cord/i);
  });

  test("nervous-system-structure sub-topic uses generic diagram brief not brain/reflexArc", () => {
    const topicKey = "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure";
    const subTopic = "Structure and function of the nervous system";
    expect(
      resolveInteractiveDiagramTopicKind({ topic: subTopic, topicKey, subTopic })
    ).toBe("generic");

    const brain = runTeacherBrain({
      topic: subTopic,
      topicKey,
      subTopic,
      subject: "Biology",
      examBoard: "AQA",
      tier: "Higher",
    });
    const { pages } = injectDiagramAndActivityBriefs(sampleInteractiveDiagramPage(), brain, {
      topic: subTopic,
      topicKey,
      subTopic,
    });
    expect(pages[0].blocks[0].note).not.toMatch(/BRAIN DIAGRAM BRIEF|REFLEX ARC DIAGRAM BRIEF/i);
  });

  test("Nervous System parent topic still resolves to brain brief when no leaf profile", () => {
    const brain = runTeacherBrain({ topic: "Nervous System", subject: "Biology" });
    const { pages } = injectDiagramAndActivityBriefs(sampleInteractiveDiagramPage(), brain);
    expect(pages[0].blocks[0].note).toMatch(/BRAIN DIAGRAM BRIEF/i);
  });

  test("unmapped topic keeps generic DIAGRAM BRIEF", () => {
    const brain = runTeacherBrain({ topic: "Photosynthesis", subject: "Biology" });
    expect(resolveInteractiveDiagramTopicKind({ topic: brain.topic })).toBe("generic");
    const { pages, injections } = injectDiagramAndActivityBriefs(sampleInteractiveDiagramPage(), brain);
    const note = pages[0].blocks[0].note || "";
    expect(note).toMatch(/DIAGRAM BRIEF/i);
    expect(note).not.toMatch(/BRAIN DIAGRAM BRIEF|REFLEX ARC|EYE DIAGRAM|CELL DIAGRAM/i);
    expect(injections[0].briefKind).toBe("diagram");
  });
});
