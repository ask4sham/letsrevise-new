/**
 * Phase 3F — structure-function pedagogy engine unit tests.
 */

const {
  isPedagogyEngineEnabled,
  resolvePedagogyProfile,
  generateStructureFunctionFramework,
  generateRequiredInteractionSet,
  generateExamApplicationPrompts,
  scorePedagogicalCoverage,
  formatStructureFunctionPedagogyAppendix,
  enrichInteractionWithPedagogy,
} = require("../lib/teacherBrain/structureFunctionPedagogyEngine");

const STRUCTURE_INPUT = {
  topicKey: "aqa-gcse-biology:nervous-system-structure",
  subTopic: "Structure and function of the nervous system",
};

const richPedagogyPages = [
  {
    blocks: [
      {
        type: "keyIdea",
        role: "lessonObjectives",
        content: "• Explain neurone structure and myelin sheath function.",
      },
      {
        type: "text",
        content:
          "Structure: Myelin is a fatty sheath around the axon. Adaptation: It insulates and allows saltatory conduction. Function: Increases impulse speed.",
      },
      {
        type: "dragdropmatch",
        title: "Neurone structure labelling",
        content: "Label dendrites, cell body, nucleus, axon, myelin sheath, nerve endings.",
      },
      {
        type: "dragdropmatch",
        title: "Structure adaptation function matching",
        content: "Axon → long → carries impulses. Myelin → insulating → increases speed.",
      },
      {
        type: "dragdropmatch",
        title: "CNS vs PNS classification",
        content: "Brain → CNS. Spinal cord → CNS. Motor neurone → PNS. Sensory neurone → PNS.",
      },
      {
        type: "text",
        content:
          "| Structure | Adaptation | Function |\n| Myelin sheath | Insulates axon | Speeds impulses |",
      },
      {
        type: "checkpoint",
        prompt: "Explain how neurones are adapted for rapid transmission of electrical impulses.",
        explanation:
          "Long axons, myelin sheath with saltatory conduction, dendrites with large surface area.",
      },
    ],
  },
];

describe("structureFunctionPedagogyEngine (Phase 3F)", () => {
  const prevPedagogy = process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE;

  afterEach(() => {
    if (prevPedagogy === undefined) delete process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE;
    else process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE = prevPedagogy;
  });

  test("engine off by default", () => {
    delete process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE;
    expect(isPedagogyEngineEnabled()).toBe(false);
    expect(formatStructureFunctionPedagogyAppendix(resolvePedagogyProfile(STRUCTURE_INPUT))).toBe("");
  });

  test("generates structure-function framework for nervous system", () => {
    process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE = "1";
    const profile = resolvePedagogyProfile(STRUCTURE_INPUT);
    const { rows, tableMarkdown } = generateStructureFunctionFramework(profile);
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(tableMarkdown).toMatch(/STRUCTURE–FUNCTION TABLE/);
    expect(rows.some((r) => r.conceptId === "myelin_sheath")).toBe(true);
  });

  test("generates required interaction set including neurone labelling", () => {
    process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE = "1";
    const interactions = generateRequiredInteractionSet(resolvePedagogyProfile(STRUCTURE_INPUT));
    expect(interactions.find((i) => i.id === "interaction_a")?.cards).toContain("myelin sheath");
    expect(interactions.find((i) => i.id === "interaction_c")?.pairs).toContain("Brain → CNS");
  });

  test("generates GCSE 4-mark exam prompt", () => {
    process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE = "1";
    const exams = generateExamApplicationPrompts(resolvePedagogyProfile(STRUCTURE_INPUT));
    expect(exams[0].marks).toBe(4);
    expect(exams[0].question).toMatch(/neurones are adapted/i);
    expect(exams[0].modelAnswer).toMatch(/myelin/i);
  });

  test("format appendix includes pedagogy marker and table", () => {
    process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE = "1";
    const text = formatStructureFunctionPedagogyAppendix(resolvePedagogyProfile(STRUCTURE_INPUT));
    expect(text).toMatch(/STRUCTURE → FUNCTION PEDAGOGY/);
    expect(text).toMatch(/Neurone structure labelling/);
    expect(text).toMatch(/4-mark/);
  });

  test("scores high pedagogy coverage on rich lesson", () => {
    process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE = "1";
    const score = scorePedagogicalCoverage({
      pedagogyProfile: resolvePedagogyProfile(STRUCTURE_INPUT),
      pages: richPedagogyPages,
    });
    expect(score.enabled).toBe(true);
    expect(score.pedagogyScorePct).toBeGreaterThanOrEqual(75);
    expect(score.requiredInteractionsPresent.interaction_a).toBe(true);
    expect(score.hasMandatoryExam).toBe(true);
  });

  test("flags missing adaptation-function teaching for myelin-only mentions", () => {
    process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE = "1";
    const score = scorePedagogicalCoverage({
      pedagogyProfile: resolvePedagogyProfile(STRUCTURE_INPUT),
      pages: [{ blocks: [{ type: "text", content: "Myelin speeds up impulses." }] }],
    });
    expect(score.gaps.some((g) => /myelin|adaptation|structure/i.test(g))).toBe(true);
    expect(score.pedagogyScorePct).toBeLessThan(80);
  });

  test("enrichInteractionWithPedagogy adds pedagogy chain", () => {
    process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE = "1";
    const enriched = enrichInteractionWithPedagogy(
      {
        replacementConceptId: "myelin_sheath",
        replacementTemplateKey: "myelin_speed_explanation",
        instructions: "Checkpoint",
      },
      resolvePedagogyProfile(STRUCTURE_INPUT)
    );
    expect(enriched.checkpointPrompt).toMatch(/Structure:/i);
    expect(enriched.checkpointPrompt).toMatch(/Adaptation:/i);
  });
});
