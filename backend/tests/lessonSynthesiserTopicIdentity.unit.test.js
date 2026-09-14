"use strict";

const {
  mapTeacherIdentityToSynthesiserIdentity,
  normalizeTeacherTopicIdentity,
  P1_TOPIC_BRIDGES,
} = require("../services/lessonSynthesiser/topicIdentityAdapter");
const {
  mapTeacherBodyToSynthesiseInput,
  listP1SupportedTopicIdentities,
} = require("../services/lessonSynthesiser/supportedTopics");

const TEACHER_GAMETES = "edexcel-igcse-biology:gametes-and-fertilisation";
const SYNTH_GAMETES = "reproduction/gametes-fertilisation";

describe("Lesson Synthesiser topic identity adapter (P1.3)", () => {
  test("A: teacher taxonomy topicKey maps to Synthesiser pack topicKey", () => {
    const mapped = mapTeacherIdentityToSynthesiserIdentity({
      specKey: "edexcel-igcse-biology",
      topicKey: TEACHER_GAMETES,
    });
    expect(mapped.ok).toBe(true);
    expect(mapped.synthesiserSpecKey).toBe("edexcel-igcse-biology");
    expect(mapped.synthesiserTopicKey).toBe(SYNTH_GAMETES);
    expect(mapped.teacherTopicKey).toBe(TEACHER_GAMETES);
  });

  test("B: mapped topic passes P1 supported-topic gate via mapTeacherBodyToSynthesiseInput", () => {
    const mapped = mapTeacherBodyToSynthesiseInput({
      subject: "Biology",
      level: "IGCSE",
      board: "Edexcel",
      topic: "Gametes & Fertilisation",
      specKey: "edexcel-igcse-biology",
      topicKey: TEACHER_GAMETES,
      tier: "Higher",
    });
    expect(mapped.ok).toBe(true);
    expect(mapped.synthesiseInput.topicKey).toBe(SYNTH_GAMETES);
    expect(mapped.synthesiseInput.tier).toBeUndefined();
  });

  test("C: unknown teacher topic fails closed", () => {
    const mapped = mapTeacherIdentityToSynthesiserIdentity({
      specKey: "edexcel-igcse-biology",
      topicKey: "edexcel-igcse-biology:photosynthesis-unknown",
    });
    expect(mapped.ok).toBe(false);
    expect(mapped.code).toBe("SYNTHESISER_TOPIC_UNSUPPORTED");
  });

  test("D: no heuristic guessing — wrong slug does not map via string transform", () => {
    const mapped = mapTeacherIdentityToSynthesiserIdentity({
      specKey: "edexcel-igcse-biology",
      topicKey: "reproduction/gametes-fertilisation",
    });
    expect(mapped.ok).toBe(false);
    expect(mapped.code).toBe("SYNTHESISER_TOPIC_UNSUPPORTED");
  });

  test("E: 4BI1 tier remains absent on body map", () => {
    const mapped = mapTeacherBodyToSynthesiseInput({
      specKey: "edexcel-igcse-biology",
      topicKey: TEACHER_GAMETES,
      tier: "Higher Tier",
    });
    expect(mapped.ok).toBe(true);
    expect(mapped.synthesiseInput.tier).toBeUndefined();
  });

  test("I: status list and adapter agree on supported identity", () => {
    const statusList = listP1SupportedTopicIdentities();
    expect(statusList).toHaveLength(P1_TOPIC_BRIDGES.length);
    const gametes = statusList.find((t) => t.teacherTopicKey === TEACHER_GAMETES);
    expect(gametes).toBeTruthy();
    expect(gametes.topicKey).toBe(SYNTH_GAMETES);
  });

  test("normalizeTeacherTopicIdentity preserves taxonomy namespaced key", () => {
    const n = normalizeTeacherTopicIdentity(
      "edexcel-igcse-biology",
      TEACHER_GAMETES
    );
    expect(n.namespacedTopicKey).toBe(TEACHER_GAMETES);
    expect(n.canonicalSlug).toBe("gametes-and-fertilisation");
  });
});
