/**
 * Universal assessment journey — multi-topic regression.
 */
const { planAssessmentJourney, SLOT_ORDER } = require("../services/assessmentJourneyPlanner");
const { validateAssessmentIntent } = require("../services/assessmentIntentValidator");
const { applyAssessmentJourneyFromPlan } = require("../services/assessmentJourneyApply");
const { resolveTopicSpecForGeneration, clearTopicSpecCache } = require("../services/topicSpecification");
const { isGenericPlaceholderStem } = require("../../lib/questionDeduplicationGuard");

const EDEXCEL = "edexcel-igcse-biology";

const TOPICS = [
  {
    slug: "human-male-and-female-reproductive-systems",
    title: "Human Male & Female Reproductive Systems",
  },
  { slug: "simple-reflex-arc", title: "Simple Reflex Arc" },
  { slug: "the-process-of-photosynthesis", title: "The Process of Photosynthesis" },
];

function assertUniversalJourney(slug, title) {
  const topicSpec = resolveTopicSpecForGeneration(EDEXCEL, slug);
  const journey = planAssessmentJourney({
    topic: title,
    topicKey: slug,
    specKey: EDEXCEL,
    topicSpec,
  });

  expect(journey.plan).toHaveLength(5);
  expect(journey.plan.map((p) => p.skill)).toEqual([
    "recall",
    "explain",
    "apply",
    "analyse",
    "exam-style",
  ]);

  const conceptSkill = journey.plan.map((p) => `${p.concept}::${p.skill}`);
  expect(new Set(conceptSkill).size).toBe(conceptSkill.length);

  for (const item of journey.plan) {
    expect(item.exemplar.question.length).toBeGreaterThan(10);
    expect(isGenericPlaceholderStem(item.exemplar.question)).toBe(false);
  }

  const draft = {
    title,
    pages: [
      {
        blocks: [
          {
            type: "checkpoint",
            prompt: "Which statement best explains a key idea?",
            questionType: "mcq",
            options: [
              "A precise cause → effect explanation linked to the topic",
              "An unrelated process from another topic",
              "A common misconception stated as if it were true",
              "A vague name with no mechanism",
            ],
            correctAnswer: "A precise cause → effect explanation linked to the topic",
          },
        ],
      },
    ],
  };

  applyAssessmentJourneyFromPlan(draft, {
    plan: journey.plan,
    topicLabel: title,
    vocabulary: topicSpec.requiredVocabulary,
    force: true,
  });

  const validation = validateAssessmentIntent(draft, {
    plan: journey.plan,
    vocabulary: topicSpec.requiredVocabulary,
    misconceptions: topicSpec.commonMisconceptions,
  });
  expect(validation.valid).toBe(true);
  expect(validation.slotsPresent).toEqual(expect.arrayContaining(SLOT_ORDER));

  const selfCheck = journey.plan.find((p) => p.slot === "selfCheck");
  expect(selfCheck.skill).toBe("apply");
  expect(selfCheck.exemplar.questionType).not.toBe("mcq");

  const exam = journey.plan.find((p) => p.slot === "examPractice");
  expect(exam.exemplar.question).toMatch(/\(\d+\s*marks?\)/i);
  expect(exam.exemplar.question).toMatch(COMMAND_WORD_RE);
}

const COMMAND_WORD_RE = /\b(describe|explain|compare|evaluate|analyse|analyze|state|suggest|calculate|label)\b/i;

describe("universal assessment journey", () => {
  beforeEach(() => clearTopicSpecCache());

  test.each(TOPICS)("$slug produces valid five-slot journey", ({ slug, title }) => {
    assertUniversalJourney(slug, title);
  });

  test("photosynthesis quick check uses process or graph vocabulary", () => {
    const topicSpec = resolveTopicSpecForGeneration(EDEXCEL, "the-process-of-photosynthesis");
    const journey = planAssessmentJourney({
      topic: "The Process of Photosynthesis",
      topicKey: "the-process-of-photosynthesis",
      topicSpec,
    });
    const quick = journey.plan.find((p) => p.slot === "quickCheck");
    expect(quick.exemplar.question).toMatch(/explain|describe|chlorophyll|photosynthesis|carbon dioxide/i);
  });

  test("reflex arc checkpoint references nervous system vocabulary", () => {
    const topicSpec = resolveTopicSpecForGeneration(EDEXCEL, "simple-reflex-arc");
    const journey = planAssessmentJourney({
      topic: "Simple Reflex Arc",
      topicKey: "simple-reflex-arc",
      topicSpec,
    });
    const cp = journey.plan.find((p) => p.slot === "checkpoint");
    expect(cp.exemplar.question).toMatch(/which structure|neurone|reflex/i);
  });
});
