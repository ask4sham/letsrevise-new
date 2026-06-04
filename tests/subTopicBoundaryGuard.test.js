/**
 * Sub-topic boundary guard — Phase 0–2 contract tests.
 */

const { resolveSubTopicProfile } = require("../lib/teacherBrain/subTopicProfiles");
const {
  classifyConcept,
  validateGenerationSlot,
  validateBlockScope,
  scoreScopeContamination,
} = require("../lib/teacherBrain/subTopicBoundaryGuard");

const STRUCTURE_INPUT = {
  topicKey: "aqa-gcse-biology:nervous-system-structure",
  subTopic: "Structure and function of the nervous system",
  topic: "Homeostasis and Response",
};

describe("resolveSubTopicProfile", () => {
  test("resolves nervous-system-structure from topicKey", () => {
    const profile = resolveSubTopicProfile(STRUCTURE_INPUT);
    expect(profile).not.toBeNull();
    expect(profile.taxonomyKey).toBe("nervous-system-structure");
  });

  test("resolves from display title when topicKey absent", () => {
    const profile = resolveSubTopicProfile({
      subTopic: "Structure and function of the nervous system",
    });
    expect(profile?.taxonomyKey).toBe("nervous-system-structure");
  });

  test("returns null for unrelated sub-topic", () => {
    expect(resolveSubTopicProfile({ subTopic: "Photosynthesis" })).toBeNull();
  });
});

describe("SubTopicBoundaryGuard — nervous-system-structure", () => {
  let profile;

  beforeAll(() => {
    profile = resolveSubTopicProfile(STRUCTURE_INPUT);
    expect(profile).toBeTruthy();
  });

  describe("classifyConcept", () => {
    test("in-scope concepts", () => {
      expect(classifyConcept("cns", profile)).toBe("in_scope");
      expect(classifyConcept("pns", profile)).toBe("in_scope");
      expect(classifyConcept("neurones", profile)).toBe("in_scope");
      expect(classifyConcept("nerves", profile)).toBe("in_scope");
      expect(classifyConcept("axons", profile)).toBe("in_scope");
      expect(classifyConcept("dendrites", profile)).toBe("in_scope");
      expect(classifyConcept("myelin_sheath", profile)).toBe("in_scope");
      expect(classifyConcept("impulse_transmission", profile)).toBe("in_scope");
    });

    test("neighbouring concepts", () => {
      expect(classifyConcept("reflex_arc", profile)).toBe("neighbouring");
      expect(classifyConcept("brain", profile)).toBe("neighbouring");
      expect(classifyConcept("eye", profile)).toBe("neighbouring");
    });

    test("forbidden concepts", () => {
      expect(classifyConcept("reflex_arc_pathway", profile)).toBe("forbidden");
      expect(classifyConcept("brain_regions", profile)).toBe("forbidden");
      expect(classifyConcept("accommodation", profile)).toBe("forbidden");
      expect(classifyConcept("thermoregulation", profile)).toBe("forbidden");
    });
  });

  describe("validateGenerationSlot", () => {
    test("allows in-scope primary slots", () => {
      const result = validateGenerationSlot(
        {
          conceptId: "myelin_sheath",
          generationKind: "checkpoint",
          isPrimary: true,
        },
        profile
      );
      expect(result.wouldReject).toBe(false);
      expect(result.allowed).toBe(true);
      expect(result.classification).toBe("in_scope");
    });

    test("rejects forbidden-primary slots", () => {
      const reflex = validateGenerationSlot(
        {
          conceptId: "reflex_arc_pathway",
          generationKind: "activity",
          isPrimary: true,
        },
        profile
      );
      expect(reflex.wouldReject).toBe(true);
      expect(reflex.classification).toBe("forbidden");

      const brain = validateGenerationSlot(
        {
          conceptId: "brain_regions",
          generationKind: "quiz",
          isPrimary: true,
        },
        profile
      );
      expect(brain.wouldReject).toBe(true);

      const eye = validateGenerationSlot(
        {
          conceptId: "accommodation",
          generationKind: "practice",
          isPrimary: true,
        },
        profile
      );
      expect(eye.wouldReject).toBe(true);

      const thermo = validateGenerationSlot(
        {
          conceptId: "thermoregulation",
          generationKind: "exam",
          isPrimary: true,
        },
        profile
      );
      expect(thermo.wouldReject).toBe(true);
    });

    test("rejects neighbouring concept as primary assessment target", () => {
      const result = validateGenerationSlot(
        {
          conceptId: "reflex_arc",
          generationKind: "retrieval",
          isPrimary: true,
        },
        profile
      );
      expect(result.wouldReject).toBe(true);
      expect(result.classification).toBe("neighbouring");
    });
  });

  describe("validateBlockScope", () => {
    test("allows in-scope checkpoint block", () => {
      const result = validateBlockScope(
        {
          type: "checkpoint",
          role: "quickCheck",
          prompt: "Explain how the myelin sheath increases the speed of nerve impulses.",
        },
        profile
      );
      expect(result.isAssessed).toBe(true);
      expect(result.wouldReject).toBe(false);
    });

    test("rejects forbidden-primary activity blocks", () => {
      expect(
        validateBlockScope(
          {
            type: "dragdropmatch",
            title: "Reflex arc pathway",
            content: "Order the reflex arc: receptor sensory neurone relay motor effector.",
          },
          profile
        ).wouldReject
      ).toBe(true);

      expect(
        validateBlockScope(
          {
            type: "interactivediagram",
            title: "Brain regions",
            content: "Label the cerebrum, cerebellum and medulla on the brain diagram.",
          },
          profile
        ).wouldReject
      ).toBe(true);

      expect(
        validateBlockScope(
          {
            type: "checkpoint",
            prompt: "Describe accommodation when focusing on a near object.",
          },
          profile
        ).wouldReject
      ).toBe(true);

      expect(
        validateBlockScope(
          {
            type: "checkpoint",
            question: "Explain how thermoregulation maintains body temperature.",
          },
          profile
        ).wouldReject
      ).toBe(true);
    });
  });

  describe("scoreScopeContamination", () => {
    test("flags contaminated nervous-system lesson blocks", () => {
      const contaminatedPages = [
        {
          blocks: [
            {
              type: "text",
              content: "Neurones have dendrites and axons. The myelin sheath insulates axons.",
            },
            {
              type: "dragdropmatch",
              title: "Reflex arc pathway",
              content: "Match the reflex arc pathway from stimulus to effector.",
            },
            {
              type: "interactivediagram",
              title: "Brain labelling",
              content: "Label brain regions: cerebrum, cerebellum, medulla.",
            },
            {
              type: "checkpoint",
              prompt: "Describe accommodation of the eye lens.",
            },
            {
              type: "checkpoint",
              prompt: "Explain thermoregulation and vasodilation.",
            },
          ],
        },
      ];

      const score = scoreScopeContamination(contaminatedPages, profile);
      expect(score.assessedCount).toBeGreaterThanOrEqual(4);
      expect(score.outOfScopeCount).toBeGreaterThanOrEqual(3);
      expect(score.contaminationScore).toBeGreaterThanOrEqual(50);
      expect(score.violations.some((v) => v.conceptId === "reflex_arc_pathway")).toBe(true);
      expect(score.violations.some((v) => v.conceptId === "brain_regions")).toBe(true);
    });

    test("low contamination for in-scope-only lesson", () => {
      const inScopePages = [
        {
          blocks: [
            {
              type: "checkpoint",
              prompt: "Describe two adaptations of neurones for carrying impulses.",
            },
            {
              type: "text",
              content: "The CNS consists of the brain and spinal cord. The PNS connects the body.",
            },
          ],
        },
      ];

      const score = scoreScopeContamination(inScopePages, profile);
      expect(score.outOfScopeCount).toBe(0);
      expect(score.contaminationScore).toBe(0);
    });
  });
});
