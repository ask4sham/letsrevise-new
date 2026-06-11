/**
 * Phase 3H.1.7 — Teaching Quality Rubric unit tests.
 */

const {
  scoreTeachingQuality,
  buildTeachingQualityReview,
  formatTeachingQualityAppendix,
  formatTeachingQualityReviewLines,
  isTeachingQualityEnabled,
  hasMisconceptionFormat,
  hasReasoningChain,
  findWorkedExampleBlock,
  MAX_TOTAL_SCORE,
  TEACHING_QUALITY_DIMENSIONS,
} = require("../lib/teacherBrain/teachingQualityRubric");

function richLesson(overrides = {}) {
  return {
    topic: "Homeostasis",
    subTopic: "Homeostasis",
    topicKey: "aqa-gcse-biology:homeostasis",
    pages: [
      {
        blocks: [
          { type: "text", title: "Definition", content: "Homeostasis is the regulation of internal conditions." },
          {
            type: "keyIdea",
            role: "coreRule",
            title: "Core model",
            content: "Receptors → coordination centre → effectors maintain a set point.",
          },
          {
            type: "checkpoint",
            question: "What is detected by receptors in homeostasis? (1 mark)",
            answer: "A change in internal conditions.",
          },
          {
            type: "text",
            title: "Core Teaching",
            role: "concept",
            content: `
              <h2>Retrieval checkpoint</h2>
              <p>Before we go further: what is a set point?</p>
              <h2>Compare and contrast</h2>
              <p>Negative feedback reverses a change whereas positive feedback amplifies it in homeostasis.</p>
              <h2>Worked reasoning example</h2>
              <p>Question: Explain how the body responds when blood glucose rises (4 marks)</p>
              <ol><li>Receptors detect high glucose because levels exceed the set point</li><li>Pancreas releases insulin therefore cells take up glucose</li><li>So that blood glucose returns to the set point</li></ol>
              <h2>Grade 9 explanation</h2>
              <p>Grade 9 answers link receptor detection to effector response because precise causal chains earn top-band marks.</p>
            `.trim(),
          },
          {
            type: "commonMistake",
            content:
              "Wrong: Homeostasis means keeping everything the same.\nCorrect: Homeostasis is regulation around a set point.\nExam link: Examiners penalise 'same' without set point.",
          },
          {
            type: "examTip",
            content:
              "<h2>Premium Exam Tip</h2><p>Always name the set point and effector in homeostasis answers — examiners award marks for both.</p><h3>Weak answer:</h3><p>It keeps things stable.</p><h3>Better answer:</h3><p>It maintains a set point.</p><h3>Full-mark answer:</h3><ul><li>Receptors detect change</li><li>Effectors reverse change</li><li>Set point restored</li></ul>",
          },
          {
            type: "checkpoint",
            role: "workedExample",
            question: "Explain negative feedback in homeostasis (3 marks)",
            answer:
              "- Receptors detect a change\n- Effectors reverse the change\n- Because this returns conditions to the set point",
          },
          { type: "stretch", content: "Grade 9: link structure of receptors to their function in detecting stimuli because examiners reward causal chains." },
          {
            type: "keyIdea",
            role: "finalMemoryRule",
            title: "Final memory rule",
            content: "<h2>💡 Key Insight</h2><p>Homeostasis = set point + negative feedback loop.</p>",
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("teachingQualityRubric (Phase 3H.1.7)", () => {
  const prevFlag = process.env.TEACHER_BRAIN_TEACHING_QUALITY;

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.TEACHER_BRAIN_TEACHING_QUALITY;
    else process.env.TEACHER_BRAIN_TEACHING_QUALITY = prevFlag;
  });

  test("eight dimensions defined, max score 40", () => {
    expect(Object.keys(TEACHING_QUALITY_DIMENSIONS)).toHaveLength(8);
    expect(MAX_TOTAL_SCORE).toBe(40);
  });

  test("flag off → disabled review", () => {
    delete process.env.TEACHER_BRAIN_TEACHING_QUALITY;
    const review = buildTeachingQualityReview(richLesson());
    expect(review.enabled).toBe(false);
    expect(isTeachingQualityEnabled()).toBe(false);
    expect(formatTeachingQualityAppendix({ topicKey: "aqa-gcse-biology:homeostasis" })).toBe("");
  });

  test("rich lesson scores strongly across dimensions", () => {
    process.env.TEACHER_BRAIN_TEACHING_QUALITY = "1";
    const scoring = scoreTeachingQuality(richLesson());
    expect(scoring.enabled).toBe(true);
    expect(scoring.totalScore).toBeGreaterThanOrEqual(26);
    expect(scoring.scoreLabel).toMatch(/\/40$/);
    expect(scoring.dimensions.misconceptionHandling.score).toBeGreaterThanOrEqual(3);
    expect(scoring.dimensions.memoryRule.score).toBeGreaterThanOrEqual(3);
  });

  test("definition-only lesson scores low with missing elements", () => {
    process.env.TEACHER_BRAIN_TEACHING_QUALITY = "1";
    const review = buildTeachingQualityReview({
      topic: "Homeostasis",
      pages: [
        {
          blocks: [
            {
              type: "text",
              title: "Core Teaching",
              content: "<p>Homeostasis is the regulation of internal conditions.</p>",
            },
          ],
        },
      ],
    });
    expect(review.totalScore).toBeLessThan(15);
    expect(review.missing.length).toBeGreaterThanOrEqual(4);
    expect(review.missing).toEqual(expect.arrayContaining(["memory rule"]));
  });

  test("review separates strengths, weaknesses, missing, present", () => {
    process.env.TEACHER_BRAIN_TEACHING_QUALITY = "1";
    const review = buildTeachingQualityReview(richLesson());
    expect(review.scoreLabel).toMatch(/^\d+\/40$/);
    expect(review.present).toEqual(expect.arrayContaining(["memory rule"]));
    expect(formatTeachingQualityReviewLines(review)).toMatch(/Teaching Quality Score:/);
    expect(formatTeachingQualityReviewLines(review)).toMatch(/Present:/);
  });

  test("misconception and reasoning helpers", () => {
    expect(hasMisconceptionFormat("Wrong: x\nCorrect: y\nExam link: z")).toBe(true);
    expect(
      hasReasoningChain("Question (4 marks)\n1. Because receptors detect\n2. Therefore effectors respond")
    ).toBe(true);
  });

  test("biology profile appendix when flag on", () => {
    process.env.TEACHER_BRAIN_TEACHING_QUALITY = "1";
    const appendix = formatTeachingQualityAppendix({
      topicKey: "aqa-gcse-biology:homeostasis",
      subTopic: "Homeostasis",
      subject: "Biology",
    });
    expect(appendix).toMatch(/TEACHING QUALITY REQUIREMENTS/);
    expect(appendix).toMatch(/Misconception block/);
    expect(appendix).toMatch(/Memory rule/);
    expect(appendix).toMatch(/homeostasis/);
  });

  test("photosynthesis has no biology profile appendix", () => {
    process.env.TEACHER_BRAIN_TEACHING_QUALITY = "1";
    const appendix = formatTeachingQualityAppendix({
      topicKey: "aqa-gcse-biology:photosynthesis",
      subTopic: "Photosynthesis",
      subject: "Biology",
    });
    expect(appendix).toBe("");
  });

  describe("scoreWorkedReasoning — checkpoint preference (Phase 3b.3f.8A)", () => {
    const duplicateWorkedBlocks = [
      { type: "text", title: "Core Teaching", role: "concept", content: "Reflex arc teaching content." },
      {
        type: "text",
        role: "workedExample",
        title: "Worked Example",
        content:
          "Question: Explain why reflex arcs are faster than voluntary actions. (3 marks)\n• Reflex arcs bypass the brain.",
      },
      {
        type: "checkpoint",
        role: "workedExample",
        question: "Describe the pathway of a reflex arc from stimulus to response. (4 marks)",
        explanation:
          "- Stimulus detected by receptors because this starts the arc.\n- Sensory neurone carries impulse therefore the signal reaches the spinal cord.\n- Motor neurone stimulates effector so that the response is rapid.",
      },
    ];

    test("findWorkedExampleBlock prefers checkpoint over earlier text block", () => {
      const picked = findWorkedExampleBlock(duplicateWorkedBlocks);
      expect(picked?.type).toBe("checkpoint");
      expect(picked?.question).toMatch(/Describe the pathway/);
    });

    test("scores higher when checkpoint has exam-style question and model bullets", () => {
      process.env.TEACHER_BRAIN_TEACHING_QUALITY = "1";
      const withDuplicate = scoreTeachingQuality(
        { topic: "The reflex arc", pages: [{ blocks: duplicateWorkedBlocks }] },
        { forceEnabled: true }
      );
      const checkpointOnly = scoreTeachingQuality(
        {
          topic: "The reflex arc",
          pages: [
            {
              blocks: [
                { type: "text", title: "Core Teaching", role: "concept", content: "Teaching." },
                duplicateWorkedBlocks[2],
              ],
            },
          ],
        },
        { forceEnabled: true }
      );
      expect(withDuplicate.dimensions.workedReasoning.score).toBeGreaterThanOrEqual(4);
      expect(withDuplicate.dimensions.workedReasoning.score).toBe(
        checkpointOnly.dimensions.workedReasoning.score
      );
      expect(withDuplicate.dimensions.workedReasoning.signals).toEqual(
        expect.arrayContaining(["modelAnswer", "markCount", "markingPoints"])
      );
    });

    test("falls back to non-checkpoint workedExample when no checkpoint exists", () => {
      process.env.TEACHER_BRAIN_TEACHING_QUALITY = "1";
      const blocks = [
        { type: "text", title: "Core Teaching", role: "concept", content: "Teaching." },
        {
          type: "text",
          role: "workedExample",
          content:
            "Explain the process. (4 marks)\n- Step one because reason.\n- Step two therefore outcome.\n- Step three so that result.",
        },
      ];
      expect(findWorkedExampleBlock(blocks)?.type).toBe("text");
      const scoring = scoreTeachingQuality(
        { topic: "Test topic", pages: [{ blocks }] },
        { forceEnabled: true }
      );
      expect(scoring.dimensions.workedReasoning.score).toBeGreaterThanOrEqual(2);
      expect(scoring.dimensions.workedReasoning.signals).toContain("workedExampleRole");
    });
  });
});
