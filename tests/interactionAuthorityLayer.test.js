/**
 * Phase 3G.7 — interaction authority layer unit tests.
 */

const {
  resolveAuthorizedInteractions,
  validateInteractionAuthority,
  buildInteractionAuthorityPrompt,
  auditInteractionAuthorityFromLesson,
  AUTHORITY_MARKER,
} = require("../lib/teacherBrain/interactionAuthorityLayer");
const { resolveSubTopicProfile } = require("../lib/teacherBrain/subTopicProfiles");

const STRUCTURE_INPUT = {
  topicKey: "aqa-gcse-biology:nervous-system-structure",
  subTopic: "Structure and function of the nervous system",
};

const profile = () => resolveSubTopicProfile(STRUCTURE_INPUT);

describe("interactionAuthorityLayer (Phase 3G.7)", () => {
  const prevBoundary = process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;

  afterEach(() => {
    if (prevBoundary === undefined) delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    else process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = prevBoundary;
  });

  test("mode 0 is no-op", () => {
    delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    const auth = resolveAuthorizedInteractions({ subTopicProfile: profile() });
    expect(auth.authorizedInteractionKeys).toEqual([]);
    expect(auth.promptInstructions).toEqual([]);
  });

  test("no profile is no-op", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const auth = resolveAuthorizedInteractions({ subTopicProfile: null, topic: "Photosynthesis" });
    expect(auth.profileKey).toBeNull();
  });

  test("nervous-system-structure returns only authorised interactions", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const auth = resolveAuthorizedInteractions({ subTopicProfile: profile() });
    expect(auth.profileKey).toBe("nervous-system-structure");
    expect(auth.authorizedInteractionKeys).toContain("neurone_structure_labelling");
    expect(auth.authorizedInteractionKeys).toContain("cns_pns_sort");
    expect(auth.authorizedInteractionKeys).toContain("impulse_transmission_sequence");
    expect(auth.authorizedInteractionKeys.length).toBe(6);
    expect(auth.blockedInteractionKeys).toContain("eye_accommodation_diagram");
  });

  test("eye interaction is blocked", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const auth = resolveAuthorizedInteractions({ subTopicProfile: profile() });
    const result = validateInteractionAuthority({
      interaction: { title: "Eye accommodation diagram", content: "Describe lens accommodation" },
      authorizedInteractions: auth,
      subTopicProfile: profile(),
    });
    expect(result.valid).toBe(false);
    expect(result.suggestedReplacementKey).toBe("myelin_speed_reasoning");
  });

  test("thermoregulation interaction is blocked", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const auth = resolveAuthorizedInteractions({ subTopicProfile: profile() });
    const result = validateInteractionAuthority({
      interaction: { title: "Thermoregulation sequence", content: "vasodilation sweating" },
      authorizedInteractions: auth,
      subTopicProfile: profile(),
    });
    expect(result.valid).toBe(false);
    expect(result.blockedKey).toMatch(/thermo/i);
  });

  test("brain region interaction is blocked", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const auth = resolveAuthorizedInteractions({ subTopicProfile: profile() });
    const result = validateInteractionAuthority({
      interaction: { title: "Label brain regions", content: "cerebellum medulla cortex" },
      authorizedInteractions: auth,
      subTopicProfile: profile(),
    });
    expect(result.valid).toBe(false);
    expect(result.suggestedReplacementKey).toBe("neurone_structure_labelling");
  });

  test("reflex arc drag/drop is blocked", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const auth = resolveAuthorizedInteractions({ subTopicProfile: profile() });
    const result = validateInteractionAuthority({
      interaction: { title: "Reflex arc pathway drag drop", content: "order the reflex arc" },
      authorizedInteractions: auth,
      subTopicProfile: profile(),
    });
    expect(result.valid).toBe(false);
    expect(result.suggestedReplacementKey).toBe("impulse_transmission_sequence");
  });

  test("impulse sequence allowed but full reflex wording blocked", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const auth = resolveAuthorizedInteractions({ subTopicProfile: profile() });
    const ok = validateInteractionAuthority({
      interaction: {
        key: "impulse_transmission_sequence",
        title: "Impulse transmission",
        content: "stimulus receptor sensory neurone CNS motor neurone effector response",
      },
      authorizedInteractions: auth,
      subTopicProfile: profile(),
    });
    expect(ok.valid).toBe(true);

    const bad = validateInteractionAuthority({
      interaction: {
        key: "impulse_transmission_sequence",
        content: "order the reflex arc pathway from stimulus to effector",
      },
      authorizedInteractions: auth,
      subTopicProfile: profile(),
    });
    expect(bad.valid).toBe(false);
  });

  test("buildInteractionAuthorityPrompt includes authorised list in mode 1", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const auth = resolveAuthorizedInteractions({ subTopicProfile: profile() });
    const prompt = buildInteractionAuthorityPrompt({
      authorizedInteractions: auth.authorizedInteractionTemplates,
      blockedInteractions: auth.blockedInteractions,
      boundaryMode: 1,
    });
    expect(prompt.text).toMatch(new RegExp(AUTHORITY_MARKER));
    expect(prompt.text).toMatch(/Neurone structure labelling/i);
    expect(prompt.text).toMatch(/Do NOT generate/i);
  });
});
