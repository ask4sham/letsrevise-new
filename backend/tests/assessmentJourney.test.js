/**
 * Assessment journey planner / validator / apply — Human Reproductive Systems pilot.
 */
const {
  planAssessmentJourney,
  buildAssessmentJourneyPromptSection,
  SLOT_ORDER,
} = require("../services/assessmentJourneyPlanner");
const {
  validateAssessmentIntent,
  buildAssessmentValidatorFeedback,
} = require("../services/assessmentIntentValidator");
const { applyAssessmentJourneyFromPlan } = require("../services/assessmentJourneyApply");
const { isGenericPlaceholderStem } = require("../../lib/questionDeduplicationGuard");
const { resolveTopicSpecForGeneration, clearTopicSpecCache } = require("../services/topicSpecification");

const EDEXCEL_SPEC = "edexcel-igcse-biology";
const HUMAN_REPRO_TOPIC = "human-male-and-female-reproductive-systems";

function buildGenericReproductiveDraft() {
  const genericMcq = {
    type: "checkpoint",
    prompt: "Which statement best explains a key idea about reproduction?",
    questionType: "mcq",
    options: [
      "A precise cause → effect explanation linked to the topic",
      "An unrelated process from another topic",
      "A common misconception stated as if it were true",
      "A vague name with no mechanism",
    ],
    correctAnswer: "A precise cause → effect explanation linked to the topic",
    explanation: "",
  };
  return {
    title: "Human Male & Female Reproductive Systems",
    pages: [
      {
        title: "Page 1",
        order: 1,
        blocks: [
          { type: "text", role: "hook", content: "Reproductive systems produce gametes." },
          { ...genericMcq },
          { ...genericMcq, role: "quickCheck", prompt: "Which statement best matches this topic?" },
          {
            type: "selfCheck",
            prompt: "Which option is most accurate about reproduction?",
            questionType: "mcq",
            options: ["Option 1", "Option 2", "Option 3", "Option 4"],
            correctAnswer: "Option 1",
          },
          {
            type: "checkpoint",
            role: "workedExample",
            prompt: "Which statement best explains a key process?",
            questionType: "short",
            options: [],
            correctAnswer: "A vague answer",
          },
          {
            type: "text",
            role: "examPractice",
            content: "<p>Which option is most accurate?</p>",
          },
        ],
      },
    ],
  };
}

describe("assessment journey — Human Male & Female Reproductive Systems", () => {
  beforeEach(() => clearTopicSpecCache());

  const topicSpec = resolveTopicSpecForGeneration(EDEXCEL_SPEC, HUMAN_REPRO_TOPIC, {
    examCode: "4BI1",
  });

  const journey = planAssessmentJourney({
    topic: "Human Male & Female Reproductive Systems",
    topicKey: HUMAN_REPRO_TOPIC,
    specKey: EDEXCEL_SPEC,
    topicSpec,
    examCode: "4BI1",
  });

  test("produces varied assessment slots with distinct skills", () => {
    expect(journey.plan).toHaveLength(SLOT_ORDER.length);
    expect(journey.plan.map((p) => p.slot)).toEqual(SLOT_ORDER);
    expect(journey.plan.map((p) => p.skill)).toEqual([
      "recall",
      "explain",
      "apply",
      "analyse",
      "exam-style",
    ]);
  });

  test("planner prompt section bans generic placeholder stems", () => {
    const section = buildAssessmentJourneyPromptSection(journey);
    expect(section).toMatch(/ASSESSMENT JOURNEY/i);
    expect(section).toMatch(/BANNED stems/i);
    expect(section).toMatch(/checkpoint.*recall/i);
  });

  test("exemplars are topic-specific from spec record", () => {
    const bySlot = Object.fromEntries(journey.plan.map((p) => [p.slot, p.exemplar]));
    expect(bySlot.checkpoint.question).toMatch(/sperm|testis/i);
    expect(bySlot.quickCheck.question).toMatch(/explain why.*oviduct|cilia/i);
    expect(bySlot.selfCheck.question).toMatch(/student says/i);
    expect(bySlot.selfCheck.question).toMatch(/uterus/i);
    expect(bySlot.workedExample.question).toMatch(/\(3 marks\)/i);
    expect(bySlot.examPractice.question).toMatch(/compare/i);
    expect(bySlot.examPractice.question).toMatch(/\(4 marks\)/i);
  });

  test("generic draft fails validation before repair", () => {
    const draft = buildGenericReproductiveDraft();
    const before = validateAssessmentIntent(draft, {
      plan: journey.plan,
      vocabulary: topicSpec.requiredKeywords,
      misconceptions: topicSpec.commonMisconceptions,
    });
    expect(before.valid).toBe(false);
    expect(before.issues.some((i) => /generic placeholder/i.test(i))).toBe(true);
  });

  test("apply repairs generic draft to valid varied journey", () => {
    const draft = buildGenericReproductiveDraft();
    applyAssessmentJourneyFromPlan(draft, {
      plan: journey.plan,
      topicLabel: "Human Male & Female Reproductive Systems",
      vocabulary: topicSpec.requiredKeywords,
      misconceptions: topicSpec.commonMisconceptions,
      force: true,
    });

    const after = validateAssessmentIntent(draft, {
      plan: journey.plan,
      vocabulary: topicSpec.requiredKeywords,
      misconceptions: topicSpec.commonMisconceptions,
    });
    expect(after.valid).toBe(true);
    expect(after.slotsPresent).toEqual(expect.arrayContaining(SLOT_ORDER));
  });

  test("no generic placeholder survives after apply", () => {
    const draft = buildGenericReproductiveDraft();
    applyAssessmentJourneyFromPlan(draft, {
      plan: journey.plan,
      topicLabel: "Human Male & Female Reproductive Systems",
      vocabulary: topicSpec.requiredKeywords,
      misconceptions: topicSpec.commonMisconceptions,
      force: true,
    });

    const stems = [];
    for (const page of draft.pages) {
      for (const block of page.blocks) {
        const text = [block.prompt, block.question, block.content].filter(Boolean).join(" ");
        if (text.trim()) stems.push(text);
      }
    }
    for (const stem of stems) {
      expect(isGenericPlaceholderStem(stem)).toBe(false);
      expect(stem).not.toMatch(/precise cause → effect explanation linked to the topic/i);
      expect(stem).not.toMatch(/unrelated process from another topic/i);
    }
  });

  test("checkpoint and self-check test different concepts at different skills", () => {
    const checkpointItem = journey.plan.find((p) => p.slot === "checkpoint");
    const selfCheckItem = journey.plan.find((p) => p.slot === "selfCheck");
    expect(checkpointItem.concept).not.toBe(selfCheckItem.concept);
    expect(checkpointItem.skill).toBe("recall");
    expect(selfCheckItem.skill).toBe("apply");
  });

  test("exam practice includes command word and marks", () => {
    const exam = journey.plan.find((p) => p.slot === "examPractice");
    expect(exam.exemplar.question).toMatch(/compare/i);
    expect(exam.exemplar.question).toMatch(/4 marks/i);
  });

  test("same concept + same skill cannot appear twice in plan", () => {
    const keys = journey.plan.map((p) => `${p.concept}::${p.skill}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("validator feedback formats issues for second pass", () => {
    const draft = buildGenericReproductiveDraft();
    const validation = validateAssessmentIntent(draft, {
      plan: journey.plan,
      vocabulary: [],
      misconceptions: [],
    });
    const feedback = buildAssessmentValidatorFeedback(validation);
    expect(feedback.length).toBeGreaterThan(0);
    expect(feedback[0]).toMatch(/^ASSESSMENT:/);
  });
});

describe("assessment journey — thin-spec fallback", () => {
  test("topics without rich spec still get varied skill plan", () => {
    const journey = planAssessmentJourney({
      topic: "Cell structure",
      topicKey: "cell-structure",
      topicSpec: {
        learningOutcomes: ["Describe cell structure"],
        requiredVocabulary: ["nucleus", "cytoplasm", "mitochondria"],
        requiredStructures: ["nucleus", "mitochondria", "cell membrane"],
        commonMisconceptions: ["Prokaryotes have a nucleus"],
        requiredProcesses: ["protein synthesis"],
        likelyExamQuestions: ["Compare plant and animal cells"],
      },
    });
    const skills = journey.plan.map((p) => p.skill);
    expect(new Set(skills).size).toBe(skills.length);
    expect(journey.plan.every((p) => p.concept && p.purpose)).toBe(true);
  });
});
