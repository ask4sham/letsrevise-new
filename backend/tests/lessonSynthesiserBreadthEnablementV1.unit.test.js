"use strict";

const {
  mapTeacherIdentityToSynthesiserIdentity,
  P1_TOPIC_BRIDGES,
  TIER_MODE,
} = require("../services/lessonSynthesiser/topicIdentityAdapter");
const { mapTeacherBodyToSynthesiseInput } = require("../services/lessonSynthesiser/supportedTopics");

const BREADTH_BRIDGES = [
  {
    code: "B1",
    teacher: "edexcel-igcse-biology:the-process-of-photosynthesis",
    synth: "photosynthesis/the-process-of-photosynthesis",
  },
  {
    code: "B2",
    teacher: "edexcel-igcse-biology:levels-of-organisation",
    synth: "organisation/levels-of-organisation",
  },
  {
    code: "B3",
    teacher: "edexcel-igcse-biology:pathogens",
    synth: "variety/pathogens",
  },
  {
    code: "B4",
    teacher:
      "edexcel-igcse-biology:animal-and-plant-cells-similarities-and-differences",
    synth: "cells/animal-and-plant-cells-similarities-and-differences",
  },
];

describe("Breadth Enablement V1 — production bridges", () => {
  test("P1 bridge table includes G1/G2 plus four breadth topics", () => {
    expect(P1_TOPIC_BRIDGES).toHaveLength(6);
  });

  for (const row of BREADTH_BRIDGES) {
    test(`${row.code}: teacher topic maps to synthesiser topic`, () => {
      const mapped = mapTeacherIdentityToSynthesiserIdentity({
        specKey: "edexcel-igcse-biology",
        topicKey: row.teacher,
      });
      expect(mapped.ok).toBe(true);
      expect(mapped.synthesiserTopicKey).toBe(row.synth);
      expect(mapped.tierMode).toBe(TIER_MODE.UNTIERED);
    });

    test(`${row.code}: body map omits tier (4BI1 untiered)`, () => {
      const mapped = mapTeacherBodyToSynthesiseInput({
        specKey: "edexcel-igcse-biology",
        topicKey: row.teacher,
        topic: "placeholder",
        tier: "Higher",
      });
      expect(mapped.ok).toBe(true);
      expect(mapped.synthesiseInput.tier).toBeUndefined();
      expect(mapped.synthesiseInput.topicKey).toBe(row.synth);
    });
  }

  test("combined AQA sexual-asexual topic still fails closed", () => {
    const mapped = mapTeacherIdentityToSynthesiserIdentity({
      specKey: "aqa-gcse-biology",
      topicKey: "aqa-gcse-biology:sexual-asexual-reproduction",
    });
    expect(mapped.ok).toBe(false);
    expect(mapped.code).toBe("SYNTHESISER_TOPIC_UNSUPPORTED");
  });

  test("near-miss Edexcel topic without bridge fails closed", () => {
    const mapped = mapTeacherIdentityToSynthesiserIdentity({
      specKey: "edexcel-igcse-biology",
      topicKey: "edexcel-igcse-biology:factors-affecting-the-rate-of-photosynthesis",
    });
    expect(mapped.ok).toBe(false);
    expect(mapped.code).toBe("SYNTHESISER_TOPIC_UNSUPPORTED");
  });
});
