/**
 * Phase 2B/2C — extended schema + spec lesson validator.
 */
const {
  getTopicSpecRecord,
  resolveTopicSpecForGeneration,
  clearTopicSpecCache,
} = require("../services/topicSpecification");
const {
  validateLessonAgainstTopicSpec,
  validateLessonForTopic,
  buildSpecValidatorFeedback,
  textContainsPhrase,
} = require("../services/specLessonValidator");

const EDEXCEL_SPEC = "edexcel-igcse-biology";

const COORDINATION_SECTION_TOPICS = [
  "response-to-changes-in-the-environment",
  "homeostasis",
  "co-ordinating-response",
  "response-to-stimuli-plants",
  "nervous-and-hormonal-control",
  "human-nervous-system",
  "role-of-neurotransmitters-at-synapses",
  "simple-reflex-arc",
  "the-human-eye-structure",
  "the-human-eye-function",
  "the-role-of-skin-in-temperature-regulation",
  "hormones-adrenaline-insulin-testosterone-progesterone-and-oestrogen",
  "the-role-of-hormones-adh-fsh-and-lh",
];

describe("Edexcel spec — Co-ordination & Response section", () => {
  beforeEach(() => clearTopicSpecCache());

  test.each(COORDINATION_SECTION_TOPICS)("rich record for %s", (topicSlug) => {
    const record = getTopicSpecRecord(EDEXCEL_SPEC, topicSlug);
    expect(record).not.toBeNull();
    expect(record.specReference.length).toBeGreaterThanOrEqual(1);
    expect(record.learningOutcomes.length).toBeGreaterThanOrEqual(3);
    expect(record.requiredVocabulary.length).toBeGreaterThanOrEqual(3);
  });

  test("reflex arc includes required neurone structures", () => {
    const record = getTopicSpecRecord(EDEXCEL_SPEC, "simple-reflex-arc");
    expect(record.specReference).toContain("2.90");
    expect(record.requiredStructures).toEqual(
      expect.arrayContaining(["sensory neurone", "relay neurone", "motor neurone"])
    );
    expect(record.commandWords).toEqual(expect.arrayContaining(["describe", "label"]));
  });

  test("homeostasis links to 2.81", () => {
    const record = getTopicSpecRecord(EDEXCEL_SPEC, "homeostasis");
    expect(record.specReference).toContain("2.81");
    expect(record.learningOutcomes.some((o) => /body temperature/i.test(o))).toBe(true);
  });
});

describe("Phase 2B — extended schema on human reproduction pilot", () => {
  test("human reproductive systems has requiredStructures", () => {
    const resolved = resolveTopicSpecForGeneration(
      EDEXCEL_SPEC,
      "human-male-and-female-reproductive-systems"
    );
    expect(resolved.requiredStructures).toEqual(
      expect.arrayContaining(["testis", "oviduct", "uterus", "cervix"])
    );
    expect(resolved.commandWords.length).toBeGreaterThanOrEqual(3);
    expect(resolved.likelyExamQuestions.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Phase 2C — spec lesson validator", () => {
  const topicSpec = resolveTopicSpecForGeneration(
    EDEXCEL_SPEC,
    "human-male-and-female-reproductive-systems"
  );

  test("passes when draft covers structures and vocabulary", () => {
    const draft = {
      pages: [
        {
          blocks: [
            {
              type: "text",
              content:
                "The testis produces sperm. The epididymis stores sperm. The sperm duct carries sperm. " +
                "The prostate gland adds fluid. The urethra carries urine and semen. The penis delivers sperm. " +
                "The ovary produces eggs. The oviduct is lined with cilia and is where fertilisation occurs, not the uterus. " +
                "The muscular wall of the uterus protects the embryo; the lining allows implantation. " +
                "The cervix and vagina are part of the female system. " +
                "Describe male and female reproductive organs. Explain fertilisation in the oviduct. " +
                "Explain how sperm travel from the testes to leave the body.",
            },
            { type: "diagram", content: "Labelled male and female reproductive system" },
          ],
        },
      ],
    };

    const result = validateLessonAgainstTopicSpec(draft, topicSpec);
    expect(result.valid).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  test("fails when required structures missing", () => {
    const draft = {
      pages: [{ blocks: [{ type: "text", content: "General reproduction overview only." }] }],
    };
    const result = validateLessonAgainstTopicSpec(draft, topicSpec);
    expect(result.valid).toBe(false);
    expect(result.missing.structures.length).toBeGreaterThan(0);
    expect(buildSpecValidatorFeedback(result).length).toBeGreaterThan(0);
  });

  test("validateLessonForTopic loads record by key", () => {
    const draft = {
      pages: [
        {
          blocks: [
            {
              type: "text",
              content:
                "Homeostasis is maintenance of a constant internal environment. Body temperature and body water content are examples.",
            },
          ],
        },
      ],
    };
    const result = validateLessonForTopic(draft, EDEXCEL_SPEC, "homeostasis");
    expect(result.thinCoverage).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.missing.vocabulary.length).toBeGreaterThan(0);
  });

  test("textContainsPhrase handles simple plurals", () => {
    expect(textContainsPhrase("the testis produces sperm", "testis")).toBe(true);
    expect(textContainsPhrase("the testis produces sperm", "testes")).toBe(true);
  });
});
