/**
 * Phase 3G.8 — interaction authority enforcer unit tests.
 */

const {
  enforceInteractionAuthorityOnDraft,
  isEnforcementTarget,
  countForbiddenPrimaryActivities,
} = require("../lib/teacherBrain/interactionAuthorityEnforcer");
const { resolveSubTopicProfile } = require("../lib/teacherBrain/subTopicProfiles");

const STRUCTURE_INPUT = {
  topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
  subTopic: "Structure and function of the nervous system",
  topic: "Structure and function of the nervous system",
};

const profile = () => resolveSubTopicProfile(STRUCTURE_INPUT);

function pagesWith(...blocks) {
  return [{ title: "Page 1", order: 1, blocks }];
}

describe("interactionAuthorityEnforcer (Phase 3G.8)", () => {
  const prevBoundary = process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;

  afterEach(() => {
    if (prevBoundary === undefined) delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    else process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = prevBoundary;
  });

  test("mode 0 → no-op", () => {
    delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    const pages = pagesWith({
      type: "dragDropMatch",
      title: "REFLEX ARC PATHWAY",
      content: "Order the reflex arc pathway",
    });
    const result = enforceInteractionAuthorityOnDraft({
      pages,
      ...STRUCTURE_INPUT,
      subTopicProfile: profile(),
    });
    expect(result.changed).toBe(false);
    expect(result.pages[0].blocks[0].title).toBe("REFLEX ARC PATHWAY");
  });

  test("mode 2 + no profile → no-op", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const pages = pagesWith({
      type: "dragDropMatch",
      title: "REFLEX ARC PATHWAY",
      content: "Order the reflex arc pathway",
    });
    const result = enforceInteractionAuthorityOnDraft({
      pages,
      topicKey: "aqa-gcse-biology:photosynthesis",
      topic: "Photosynthesis",
    });
    expect(result.changed).toBe(false);
    expect(result.enforcement.enabled).toBe(false);
  });

  test("dragDropMatch titled REFLEX ARC PATHWAY → rerouted to impulse_transmission_sequence", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const pages = pagesWith({
      type: "dragDropMatch",
      title: "REFLEX ARC PATHWAY",
      content: "Order the reflex arc pathway from stimulus to effector",
    });
    const result = enforceInteractionAuthorityOnDraft({
      pages,
      ...STRUCTURE_INPUT,
      subTopicProfile: profile(),
    });
    expect(result.changed).toBe(true);
    expect(result.enforcement.blocksRerouted).toHaveLength(1);
    expect(result.enforcement.blocksRerouted[0].replacementKey).toBe("impulse_transmission_sequence");
    const block = result.pages[0].blocks[0];
    expect(block.type).toBe("interactivesequence");
    expect(block.title).toMatch(/Impulse transmission sequence/i);
    expect(block.steps?.length).toBeGreaterThan(0);
  });

  test("checkpoint with accommodation prompt → rerouted to myelin_speed_reasoning", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const pages = pagesWith({
      type: "checkpoint",
      prompt:
        "Explain how the eye focuses on a near object. Include ciliary muscles and suspensory ligaments.",
      questionType: "short",
      correctAnswer: "Lens becomes thicker.",
    });
    const result = enforceInteractionAuthorityOnDraft({
      pages,
      ...STRUCTURE_INPUT,
      subTopicProfile: profile(),
    });
    expect(result.changed).toBe(true);
    expect(result.enforcement.blocksRerouted[0].replacementKey).toBe("myelin_speed_reasoning");
    expect(result.pages[0].blocks[0].prompt).toMatch(/myelin/i);
  });

  test("brain-region interactive diagram → rerouted to neurone_structure_labelling", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const pages = pagesWith({
      type: "interactiveDiagram",
      title: "Label brain regions",
      content: "Label the cerebellum, medulla and cerebral cortex.",
    });
    const result = enforceInteractionAuthorityOnDraft({
      pages,
      ...STRUCTURE_INPUT,
      subTopicProfile: profile(),
    });
    expect(result.changed).toBe(true);
    expect(result.enforcement.blocksRerouted[0].replacementKey).toBe("neurone_structure_labelling");
    expect(result.pages[0].blocks[0].type).toBe("dragdropmatch");
    expect(result.pages[0].blocks[0].cards?.length).toBeGreaterThan(0);
  });

  test("thermoregulation sort activity → rerouted to authorised template", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const pages = pagesWith({
      type: "dragDropMatch",
      title: "Thermoregulation responses",
      content: "Sort sweating and vasodilation into responses to high body temperature",
    });
    const result = enforceInteractionAuthorityOnDraft({
      pages,
      ...STRUCTURE_INPUT,
      subTopicProfile: profile(),
    });
    expect(result.changed).toBe(true);
    expect(result.enforcement.blocksRerouted[0].replacementKey).toBeTruthy();
    expect(["receptor_effector_chain", "impulse_transmission_sequence"]).toContain(
      result.enforcement.blocksRerouted[0].replacementKey
    );
  });

  test('Key examples text with "reflex pathway" → unchanged', () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const original = {
      type: "text",
      title: "Key examples",
      content: "Sensory neurones, motor neurones, CNS and PNS — reflex pathway as a neighbour example.",
    };
    const pages = pagesWith(original);
    const result = enforceInteractionAuthorityOnDraft({
      pages,
      ...STRUCTURE_INPUT,
      subTopicProfile: profile(),
    });
    expect(result.changed).toBe(false);
    expect(result.pages[0].blocks[0]).toEqual(original);
    expect(isEnforcementTarget(original)).toBe(false);
  });

  test('What to Notice with "focus on labelled parts" → unchanged', () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const original = {
      type: "keyIdea",
      title: "What to Notice",
      role: "whatToNotice",
      content: "Focus on the labelled parts or key features. Notice how each feature links to its job.",
    };
    const pages = pagesWith(original);
    const result = enforceInteractionAuthorityOnDraft({
      pages,
      ...STRUCTURE_INPUT,
      subTopicProfile: profile(),
    });
    expect(result.changed).toBe(false);
    expect(result.pages[0].blocks[0]).toEqual(original);
    expect(isEnforcementTarget(original)).toBe(false);
  });

  test("countForbiddenPrimaryActivities is zero after enforcement", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const contaminated = pagesWith(
      {
        type: "dragDropMatch",
        title: "REFLEX ARC PATHWAY",
        content: "reflex arc pathway drag drop",
      },
      {
        type: "checkpoint",
        prompt: "Describe accommodation and lens shape change for near vision.",
        questionType: "short",
        correctAnswer: "",
      }
    );
    expect(countForbiddenPrimaryActivities(contaminated, STRUCTURE_INPUT)).toBeGreaterThan(0);
    const result = enforceInteractionAuthorityOnDraft({
      pages: contaminated,
      ...STRUCTURE_INPUT,
      subTopicProfile: profile(),
    });
    expect(countForbiddenPrimaryActivities(result.pages, STRUCTURE_INPUT)).toBe(0);
  });
});
