"use strict";

const {
  mapTeacherIdentityToSynthesiserIdentity,
  P1_TOPIC_BRIDGES,
  TIER_MODE,
} = require("../services/lessonSynthesiser/topicIdentityAdapter");
const {
  mapTeacherBodyToSynthesiseInput,
  listP1SupportedTopicIdentities,
} = require("../services/lessonSynthesiser/supportedTopics");

/** Proven from backend/config/edexcel_igcse_biology_topics.json */
const TEACHER_EDEXCEL_GAMETES = "edexcel-igcse-biology:gametes-and-fertilisation";
const TEACHER_EDEXCEL_SEXUAL_ASEXUAL =
  "edexcel-igcse-biology:sexual-and-asexual-reproduction-differences";

/** Proven from backend/config/aqa_gcse_biology_topics.json — combined topic */
const TEACHER_AQA_SEXUAL_ASEXUAL = "aqa-gcse-biology:sexual-asexual-reproduction";

describe("E0.1R semantic topic-bridge integrity", () => {
  test("A: bridge table is Edexcel-only (two valid semantic bridges)", () => {
    expect(P1_TOPIC_BRIDGES).toHaveLength(2);
    const teacherKeys = P1_TOPIC_BRIDGES.map((b) => b.teacherTopicKey);
    expect(teacherKeys).toContain(TEACHER_EDEXCEL_GAMETES);
    expect(teacherKeys).toContain(TEACHER_EDEXCEL_SEXUAL_ASEXUAL);
    expect(teacherKeys).not.toContain(TEACHER_AQA_SEXUAL_ASEXUAL);
  });

  test("A: Edexcel gametes bridge remains valid", () => {
    const mapped = mapTeacherIdentityToSynthesiserIdentity({
      specKey: "edexcel-igcse-biology",
      topicKey: TEACHER_EDEXCEL_GAMETES,
    });
    expect(mapped.ok).toBe(true);
    expect(mapped.synthesiserTopicKey).toBe("reproduction/gametes-fertilisation");
    expect(mapped.tierMode).toBe(TIER_MODE.UNTIERED);
  });

  test("B: Edexcel sexual-vs-asexual bridge remains valid", () => {
    const mapped = mapTeacherIdentityToSynthesiserIdentity({
      specKey: "edexcel-igcse-biology",
      topicKey: TEACHER_EDEXCEL_SEXUAL_ASEXUAL,
    });
    expect(mapped.ok).toBe(true);
    expect(mapped.synthesiserTopicKey).toBe(
      "reproduction/sexual-vs-asexual-reproduction"
    );
    expect(mapped.tierMode).toBe(TIER_MODE.UNTIERED);
  });

  test("C/F: AQA combined topic fails closed (not sexual-only subset bridge)", () => {
    const mapped = mapTeacherIdentityToSynthesiserIdentity({
      specKey: "aqa-gcse-biology",
      topicKey: TEACHER_AQA_SEXUAL_ASEXUAL,
    });
    expect(mapped.ok).toBe(false);
    expect(mapped.code).toBe("SYNTHESISER_TOPIC_UNSUPPORTED");
  });

  test("D: AQA combined does not map to asexual-only synthesiser pack slug", () => {
    const mapped = mapTeacherIdentityToSynthesiserIdentity({
      specKey: "aqa-gcse-biology",
      topicKey: "aqa-gcse-biology:asexual-reproduction",
    });
    expect(mapped.ok).toBe(false);
    expect(mapped.code).toBe("SYNTHESISER_TOPIC_UNSUPPORTED");
  });

  test("E: no cross-board fallback to Edexcel sexual-vs-asexual pack", () => {
    const mapped = mapTeacherIdentityToSynthesiserIdentity({
      specKey: "aqa-gcse-biology",
      topicKey: TEACHER_AQA_SEXUAL_ASEXUAL,
    });
    expect(mapped.ok).toBe(false);
    if (!mapped.ok) {
      expect(mapped.synthesiserTopicKey).toBeUndefined();
    }
    const edexcelOnly = mapTeacherIdentityToSynthesiserIdentity({
      specKey: "edexcel-igcse-biology",
      topicKey: TEACHER_EDEXCEL_SEXUAL_ASEXUAL,
    });
    expect(edexcelOnly.synthesiserSpecKey).toBe("edexcel-igcse-biology");
  });

  test("Edexcel 4BI1 tier stripped on sexual-vs-asexual bridge", () => {
    const mapped = mapTeacherBodyToSynthesiseInput({
      specKey: "edexcel-igcse-biology",
      topicKey: TEACHER_EDEXCEL_SEXUAL_ASEXUAL,
      tier: "Higher",
    });
    expect(mapped.ok).toBe(true);
    expect(mapped.synthesiseInput.tier).toBeUndefined();
  });

  test("G: status list length matches bridges", () => {
    expect(listP1SupportedTopicIdentities()).toHaveLength(P1_TOPIC_BRIDGES.length);
  });
});
