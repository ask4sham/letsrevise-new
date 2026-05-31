/**
 * Golden pedagogical comparison — curated Metabolism vs thin draft.
 */

const { buildLessonBlueprint } = require("../lessonGeneratorV2/lessonBlueprintEngine");
const {
  compareToGoldenMetabolism,
  loadCuratedMetabolismPages,
  scoreTenOutOfTenRubric,
} = require("../lessonGeneratorV4");

describe("V4 golden Metabolism comparison", () => {
  const blueprint = buildLessonBlueprint({
    topic: "Metabolism",
    subject: "Biology",
    examBoard: "AQA",
    tier: "higher",
  });

  test("curated Metabolism benchmark loads", () => {
    const pages = loadCuratedMetabolismPages();
    expect(pages).toBeTruthy();
    expect(pages[0].blocks.length).toBeGreaterThan(10);
  });

  test("curated Metabolism scores higher than thin AI-style draft on pedagogy", () => {
    const curated = loadCuratedMetabolismPages();
    const thin = [
      {
        blocks: [
          {
            type: "text",
            role: "concept",
            content:
              "<p>Metabolism is defined as all chemical reactions. ATP is energy. Respiration makes energy.</p>",
          },
          { type: "checkpoint", content: "What is metabolism? Option 1: reactions Answer: reactions" },
        ],
      },
    ];
    const ctx = { blueprint, tier: "higher" };
    const goldenScore = scoreTenOutOfTenRubric(curated, ctx);
    const thinScore = scoreTenOutOfTenRubric(thin, ctx);

    expect(goldenScore.average).toBeGreaterThan(thinScore.average);
    expect(goldenScore.categories.conceptStorytelling).toBeGreaterThan(
      thinScore.categories.conceptStorytelling
    );
    expect(goldenScore.categories.teacherVoice ?? goldenScore.categories.teachingClarity).toBeDefined();
    expect(goldenScore.categories.examinerThinking).toBeGreaterThan(
      thinScore.categories.examinerThinking
    );
  });

  test("curated Metabolism meets golden pedagogical benchmark", () => {
    const curated = loadCuratedMetabolismPages();
    const result = compareToGoldenMetabolism(curated, { blueprint, tier: "higher" });
    expect(result.golden.categories.conceptStorytelling).toBeGreaterThanOrEqual(7);
    expect(result.golden.categories.examinerThinking).toBeGreaterThanOrEqual(4);
    expect(result.meetsOrExceedsCount).toBeGreaterThanOrEqual(7);
    expect(result.passed).toBe(true);
  });

  test("premium prompt appendix includes 10/10 teaching directives", () => {
    const { buildPremiumTeachingPromptAppendix } = require("../lessonGeneratorV4");
    const appendix = buildPremiumTeachingPromptAppendix(blueprint, { tier: "higher" });
    expect(appendix).toMatch(/CONCEPT STORYTELLING/);
    expect(appendix).toMatch(/CORE LEARNING BLOCKS/);
    expect(appendix).toMatch(/EXAMINER BRAIN/);
    expect(appendix).toMatch(/WORKED EXAMPLE/);
    expect(appendix).toMatch(/CONCEPT LINKING/);
    expect(appendix).toMatch(/HIGHER TIER CHALLENGE/);
    expect(appendix).toMatch(/10\/10 CHECK/);
  });
});
