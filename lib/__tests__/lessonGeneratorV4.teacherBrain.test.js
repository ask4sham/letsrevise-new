/**
 * V4 + Teacher Brain prompt integration (Phase 2).
 */

const { buildLessonBlueprint } = require("../lessonGeneratorV2/lessonBlueprintEngine");
const { buildPremiumTeachingPromptAppendix } = require("../lessonGeneratorV4/premiumTeachingPrompt");
const {
  buildTeacherBrainPromptAppendixFromContext,
  BRAIN_MARKER,
} = require("../lessonGeneratorV4/teacherBrainPromptAppendix");

describe("V4 prompt + Teacher Brain (Phase 2)", () => {
  const metabolismBlueprint = buildLessonBlueprint({
    topic: "Metabolism",
    subject: "Biology",
    examBoard: "AQA",
    tier: "higher",
  });

  test("Metabolism V4 prompt includes Teacher Brain planning guidance", () => {
    const appendix = buildPremiumTeachingPromptAppendix(metabolismBlueprint, {
      topic: "Metabolism",
      subject: "Biology",
      examBoard: "AQA",
      tier: "Higher",
    });

    expect(appendix).toMatch(/Lesson Generator V4/);
    expect(appendix).toMatch(BRAIN_MARKER);
    expect(appendix).toMatch(/expert teacher planning brain/i);
    expect(appendix).toMatch(/glucose.*respiration.*ATP/i);
    expect(appendix).toMatch(/digestion/i);
    expect(appendix).toMatch(/transfers energy to ATP|transferred to ATP|not.*produces energy/i);
    expect(appendix).toMatch(/Diagram needed:/i);
    expect(appendix).toMatch(/Cell's Economy|cell's economy/i);
    expect(appendix).toMatch(/1 mark/i);
    expect(appendix).toMatch(/2 mark/i);
    expect(appendix).toMatch(/4 mark/i);
    expect(appendix).toMatch(/6 mark/i);
    expect(appendix).toMatch(/RETRIEVAL PLAN/i);
    expect(appendix).toMatch(/immediate/i);
    expect(appendix).toMatch(/do NOT generate images/i);
  });

  test("Teacher Brain appendix alone is compact and structured", () => {
    const brainSection = buildTeacherBrainPromptAppendixFromContext(metabolismBlueprint, {
      topic: "Metabolism",
      tier: "Higher",
    });
    expect(brainSection.length).toBeGreaterThan(200);
    expect(brainSection).toMatch(/CORE CONCEPT CHAIN/);
    expect(brainSection).toMatch(/TOP MISCONCEPTIONS/);
    expect(brainSection).toMatch(/DIAGRAM BRIEFS/);
    expect(brainSection).toMatch(/LESSON COVERAGE MAP/i);
    expect(brainSection).toMatch(/Cognitive skill balance/i);
    expect(brainSection).toMatch(/ONE-SHOT LESSON COVERAGE PLAN/i);
  });

  test("unknown topic still returns V4 premium prompt without breaking", () => {
    const bp = buildLessonBlueprint({
      topic: "Obscure Topic XYZ 999",
      subject: "Biology",
      examBoard: "AQA",
      tier: "higher",
    });
    const appendix = buildPremiumTeachingPromptAppendix(bp, {
      topic: "Obscure Topic XYZ 999",
      subject: "Biology",
      examBoard: "AQA",
      tier: "Higher",
    });
    expect(appendix).toMatch(/Lesson Generator V4/);
    expect(appendix).toMatch(/CONCEPT STORYTELLING/);
    // Generic Teacher Brain profile still adds guidance
    expect(appendix.length).toBeGreaterThan(500);
  });

  test("missing topic skips Teacher Brain section but keeps V4", () => {
    const appendix = buildPremiumTeachingPromptAppendix({}, {});
    expect(appendix).toMatch(/Lesson Generator V4/);
    expect(appendix).not.toMatch(BRAIN_MARKER);
  });
});
