/**
 * Phase 3H.1.7 — Teaching Quality integration tests.
 */

const { buildOneShotLessonCoveragePlanAppendix } = require("../lib/teacherBrain/oneShotLessonCoveragePlan");
const { buildLessonCoverageReview } = require("../lib/teacherBrain/lessonCoverageReview");
const { buildTeacherBrainPromptAppendixFromContext } = require("../lib/lessonGeneratorV4/teacherBrainPromptAppendix");
const { scoreTeachingQuality, buildTeachingQualityReview } = require("../lib/teacherBrain/teachingQualityRubric");

const TOPICS = {
  homeostasis: {
    topicKey: "aqa-gcse-biology:homeostasis",
    subTopic: "Homeostasis",
    topic: "Homeostasis and Response",
  },
  nervousSystem: {
    topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
    subTopic: "Structure and function of the nervous system",
    topic: "Structure and function of the nervous system",
  },
  theEye: {
    topicKey: "aqa-gcse-biology:the-eye",
    subTopic: "The eye",
    topic: "The eye",
  },
  photosynthesis: {
    topicKey: "aqa-gcse-biology:photosynthesis",
    subTopic: "Photosynthesis",
    topic: "Photosynthesis",
  },
};

function fixturePages(topicKey) {
  const base = [
    { type: "text", title: "Definition", content: "Core definition for the sub-topic." },
    { type: "keyIdea", role: "coreRule", title: "Core model", content: "Structure enables function in this topic." },
    { type: "checkpoint", question: "State one key term (1 mark)", answer: "Example term." },
    {
      type: "text",
      title: "Core Teaching",
      content: "Teaching content with because and for example links to the topic.",
    },
    {
      type: "commonMistake",
      content: "Wrong: Generic mistake.\nCorrect: Accurate idea.\nExam link: Loses marks in explain questions.",
    },
    { type: "examTip", content: "Premium Exam Tip: Use command words and name structures for marks in GCSE exams." },
    {
      type: "checkpoint",
      role: "workedExample",
      question: "Explain the process (4 marks)",
      answer: "- Step one because structure allows function\n- Step two therefore response occurs\n- Step three so that homeostasis is maintained",
    },
    {
      type: "keyIdea",
      role: "finalMemoryRule",
      content: "<h2>💡 Key Insight</h2><p>Memorable rule for revision.</p>",
    },
  ];

  if (topicKey.includes("nervous")) {
    base[3].content +=
      " Sensory neurones carry impulses to the CNS whereas motor neurones carry impulses away to effectors.";
  }
  if (topicKey.includes("the-eye")) {
    base[3].content +=
      " Compare the lens and cornea: the cornea refracts light whereas the lens adjusts focus.";
  }
  if (topicKey.includes("homeostasis")) {
    base[3].content +=
      " Negative feedback reverses a change whereas positive feedback amplifies it in homeostasis.";
    base.push({
      type: "stretch",
      content: "Grade 9: link receptor structure to function because top-band answers need causal chains.",
    });
  }

  return [{ blocks: base }];
}

describe("teachingQualityIntegration (Phase 3H.1.7)", () => {
  const prevQuality = process.env.TEACHER_BRAIN_TEACHING_QUALITY;
  const prevOpening = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;

  afterEach(() => {
    if (prevQuality === undefined) delete process.env.TEACHER_BRAIN_TEACHING_QUALITY;
    else process.env.TEACHER_BRAIN_TEACHING_QUALITY = prevQuality;
    if (prevOpening === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevOpening;
  });

  test("one-shot appendix includes TEACHING QUALITY REQUIREMENTS for Homeostasis", () => {
    process.env.TEACHER_BRAIN_TEACHING_QUALITY = "1";
    const { appendix } = buildOneShotLessonCoveragePlanAppendix(TOPICS.homeostasis);
    expect(appendix).toMatch(/TEACHING QUALITY REQUIREMENTS/);
    expect(appendix).toMatch(/Misconception block/);
    expect(appendix).toMatch(/Worked reasoning example/);
  });

  test("V4 prompt appendix includes teaching quality for Nervous System profile", () => {
    process.env.TEACHER_BRAIN_TEACHING_QUALITY = "1";
    const appendix = buildTeacherBrainPromptAppendixFromContext(
      { topic: TOPICS.nervousSystem.topic, topicKey: TOPICS.nervousSystem.topicKey, subTopic: TOPICS.nervousSystem.subTopic },
      TOPICS.nervousSystem
    );
    expect(appendix).toMatch(/TEACHING QUALITY REQUIREMENTS/);
    expect(appendix).toMatch(/nervous-system-structure|Retrieval question/);
  });

  test("Coverage Review includes teachingQualityReview for The Eye", () => {
    process.env.TEACHER_BRAIN_TEACHING_QUALITY = "1";
    const review = buildLessonCoverageReview({
      ...TOPICS.theEye,
      pages: fixturePages(TOPICS.theEye.topicKey),
    });
    expect(review.teachingQualityReview?.enabled).toBe(true);
    expect(review.teachingQualityReview?.scoreLabel).toMatch(/\/40$/);
    expect(review.teachingQualityReview?.totalScore).toBeGreaterThan(0);
  });

  test("Homeostasis fixture scores ≥26/40 with key elements present", () => {
    process.env.TEACHER_BRAIN_TEACHING_QUALITY = "1";
    const review = buildTeachingQualityReview({
      ...TOPICS.homeostasis,
      pages: fixturePages(TOPICS.homeostasis.topicKey),
    });
    expect(review.totalScore).toBeGreaterThanOrEqual(26);
    expect(review.present).toEqual(expect.arrayContaining(["memory rule", "misconception"]));
  });

  test("Nervous System fixture includes compare/contrast signal", () => {
    process.env.TEACHER_BRAIN_TEACHING_QUALITY = "1";
    const scoring = scoreTeachingQuality({
      ...TOPICS.nervousSystem,
      pages: fixturePages(TOPICS.nervousSystem.topicKey),
    });
    expect(scoring.dimensions.compareContrast.score).toBeGreaterThanOrEqual(2);
  });

  test("photosynthesis regression — no profile appendix, coverage review still works", () => {
    process.env.TEACHER_BRAIN_TEACHING_QUALITY = "1";
    const { appendix } = buildOneShotLessonCoveragePlanAppendix(TOPICS.photosynthesis);
    expect(appendix).not.toMatch(/TEACHING QUALITY REQUIREMENTS/);

    const review = buildLessonCoverageReview({
      ...TOPICS.photosynthesis,
      pages: [{ blocks: [{ type: "text", content: "Plants use light energy for photosynthesis." }] }],
    });
    expect(review.teachingQualityReview?.enabled).toBe(true);
    expect(review.teachingQualityReview?.totalScore).toBeLessThan(10);
    expect(review.teachingQualityReview?.missing.length).toBeGreaterThan(0);
  });

  test("default flag off — no teaching quality in coverage review or appendix", () => {
    delete process.env.TEACHER_BRAIN_TEACHING_QUALITY;
    const { appendix } = buildOneShotLessonCoveragePlanAppendix(TOPICS.homeostasis);
    expect(appendix).not.toMatch(/TEACHING QUALITY REQUIREMENTS/);
    const review = buildLessonCoverageReview({
      ...TOPICS.homeostasis,
      pages: fixturePages(TOPICS.homeostasis.topicKey),
    });
    expect(review.teachingQualityReview?.enabled).toBe(false);
  });
});
