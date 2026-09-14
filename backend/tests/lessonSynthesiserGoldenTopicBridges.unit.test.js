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

/** Proven from backend/config/aqa_gcse_biology_topics.json */
const TEACHER_AQA_SEXUAL_ASEXUAL = "aqa-gcse-biology:sexual-asexual-reproduction";

describe("E0.1 golden-set Teacher-button bridges", () => {
  test("bridge table matches authoritative taxonomy keys", () => {
    expect(P1_TOPIC_BRIDGES).toHaveLength(3);
    const teacherKeys = P1_TOPIC_BRIDGES.map((b) => b.teacherTopicKey);
    expect(teacherKeys).toContain(TEACHER_EDEXCEL_GAMETES);
    expect(teacherKeys).toContain(TEACHER_EDEXCEL_SEXUAL_ASEXUAL);
    expect(teacherKeys).toContain(TEACHER_AQA_SEXUAL_ASEXUAL);
  });

  test("Edexcel sexual vs asexual → Synthesiser reproduction/sexual-vs-asexual-reproduction", () => {
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

  test("AQA sexual-asexual-reproduction → Synthesiser reproduction/sexual-reproduction", () => {
    const mapped = mapTeacherIdentityToSynthesiserIdentity({
      specKey: "aqa-gcse-biology",
      topicKey: TEACHER_AQA_SEXUAL_ASEXUAL,
    });
    expect(mapped.ok).toBe(true);
    expect(mapped.synthesiserTopicKey).toBe("reproduction/sexual-reproduction");
    expect(mapped.tierMode).toBe(TIER_MODE.TIERED);
  });

  test("AQA synthesiser asexual-only pack has no teacher taxonomy key (blocked)", () => {
    const mapped = mapTeacherIdentityToSynthesiserIdentity({
      specKey: "aqa-gcse-biology",
      topicKey: "aqa-gcse-biology:asexual-reproduction",
    });
    expect(mapped.ok).toBe(false);
    expect(mapped.code).toBe("SYNTHESISER_TOPIC_UNSUPPORTED");
  });

  test("Edexcel 4BI1 tier stripped on new bridge", () => {
    const mapped = mapTeacherBodyToSynthesiseInput({
      specKey: "edexcel-igcse-biology",
      topicKey: TEACHER_EDEXCEL_SEXUAL_ASEXUAL,
      tier: "Higher",
    });
    expect(mapped.ok).toBe(true);
    expect(mapped.synthesiseInput.tier).toBeUndefined();
  });

  test("AQA tier forwarded when provided", () => {
    const mapped = mapTeacherBodyToSynthesiseInput({
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      specKey: "aqa-gcse-biology",
      topicKey: TEACHER_AQA_SEXUAL_ASEXUAL,
      tier: "foundation",
    });
    expect(mapped.ok).toBe(true);
    expect(mapped.synthesiseInput.tier).toBe("Foundation");
  });

  test("status list length matches bridges", () => {
    expect(listP1SupportedTopicIdentities()).toHaveLength(P1_TOPIC_BRIDGES.length);
  });
});
