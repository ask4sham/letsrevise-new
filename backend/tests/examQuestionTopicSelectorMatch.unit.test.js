const {
  normaliseTopicText,
  buildTopicTitleRegex,
  resolveSpecKeyForTopicQuery,
  resolveSelectorTopicMatch,
  buildTopicSelectorQueryClause,
} = require("../utils/examQuestionTopicSelectorMatch");

describe("examQuestionTopicSelectorMatch", () => {
  test("normaliseTopicText treats & and 'and' equivalently", () => {
    expect(normaliseTopicText("Human Male & Female Reproductive Systems")).toBe(
      "human male and female reproductive systems"
    );
    expect(normaliseTopicText("Human Male and Female Reproductive Systems")).toBe(
      "human male and female reproductive systems"
    );
  });

  test("buildTopicTitleRegex matches & and 'and' variants, anchored", () => {
    const rx = buildTopicTitleRegex("Human Male & Female Reproductive Systems");
    expect(rx.test("Human Male & Female Reproductive Systems")).toBe(true);
    expect(rx.test("Human male and female reproductive systems")).toBe(true);
    // Not a partial match — extra trailing words must fail.
    expect(rx.test("Human Male & Female Reproductive Systems and Hormones")).toBe(false);
    expect(rx.test("Female Reproductive Systems")).toBe(false);
  });

  test("resolveSelectorTopicMatch returns candidates + title fallback for Edexcel IGCSE", () => {
    const res = resolveSelectorTopicMatch({
      specKey: "edexcel-igcse-biology",
      topicKey: "edexcel-igcse-biology:human-male-and-female-reproductive-systems",
    });
    expect(res.candidates).toContain(
      "edexcel-igcse-biology:human-male-and-female-reproductive-systems"
    );
    expect(res.titleRegexes.length).toBeGreaterThan(0);
    expect(res.normalisedTitles).toContain("human male and female reproductive systems");
  });

  test("buildTopicSelectorQueryClause: $or with topicKey candidates and topic fallback", () => {
    const { clause } = buildTopicSelectorQueryClause({
      specKey: "edexcel-igcse-biology",
      topicKey: "edexcel-igcse-biology:human-male-and-female-reproductive-systems",
    });
    expect(Array.isArray(clause.$or)).toBe(true);
    const [byKey, fallback] = clause.$or;
    expect(byKey.topicKey.$in).toContain(
      "edexcel-igcse-biology:human-male-and-female-reproductive-systems"
    );
    expect(fallback.$and[0].topicKey.$nin).toBeDefined();
    expect(Array.isArray(fallback.$and[1].$or)).toBe(true);
  });

  test("unknown/unresolvable topic → plain topicKey candidates (no title fallback)", () => {
    const { clause } = buildTopicSelectorQueryClause({
      specKey: "edexcel-igcse-biology",
      topicKey: "edexcel-igcse-biology:not-a-real-topic-xyz",
    });
    // No taxonomy title resolves, so we keep exact topicKey candidate matching only.
    expect(clause.$or).toBeUndefined();
    expect(clause.topicKey.$in).toBeDefined();
  });

  test("missing specKey defaults to AQA and does not match Edexcel namespaced rows (slug only)", () => {
    const slug = "roles-of-oestrogen-and-progesterone-in-the-menstrual-cycle";
    const saved = `edexcel-igcse-biology:${slug}`;
    const withoutSpec = buildTopicSelectorQueryClause({ topicKey: slug });
    const withEdexcel = buildTopicSelectorQueryClause({ specKey: "edexcel-igcse-biology", topicKey: slug });
    const candidatesWithout = withoutSpec.clause.topicKey?.$in || withoutSpec.clause.$or?.[0]?.topicKey?.$in || [];
    const candidatesWith = withEdexcel.clause.topicKey?.$in || withEdexcel.clause.$or?.[0]?.topicKey?.$in || [];
    expect(candidatesWithout).toContain(`aqa-gcse-biology:${slug}`);
    expect(candidatesWithout).not.toContain(saved);
    expect(candidatesWith).toContain(saved);
  });

  test("namespaced topicKey infers Edexcel spec without explicit specKey query param", () => {
    const slug = "roles-of-oestrogen-and-progesterone-in-the-menstrual-cycle";
    const namespaced = `edexcel-igcse-biology:${slug}`;
    expect(resolveSpecKeyForTopicQuery({ topicKey: namespaced })).toBe("edexcel-igcse-biology");
    const { clause } = buildTopicSelectorQueryClause({ topicKey: namespaced });
    const candidates = clause.topicKey?.$in || clause.$or?.[0]?.topicKey?.$in || [];
    expect(candidates).toContain(namespaced);
    expect(candidates).not.toContain(`aqa-gcse-biology:${slug}`);
  });
});
