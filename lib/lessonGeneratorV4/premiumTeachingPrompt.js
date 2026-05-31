/**
 * V4 premium teaching prompt — 10/10 polish directives (generation only).
 */

const { buildTeacherVoiceDirectives } = require("./teacherVoiceEngine");
const { buildConceptStorytellingPromptSection } = require("./conceptStorytellingEngine");
const { buildCoreLearningPromptSection } = require("./coreLearningStructureEngine");
const { buildWorkedExamplePromptSection } = require("./workedExampleEngine");
const { buildExaminerBrainPromptSection } = require("./examinerBrainEngine");
const { buildConceptLinkingPromptSection } = require("./conceptLinkingEngine");
const { buildHigherTierChallengePromptSection } = require("./higherTierChallengeEngine");
const { buildModelAnswerQualityPromptSection } = require("./modelAnswerQualityEngine");
const { buildTeacherTransitionPromptSection } = require("./teacherTransitionEngine");
const { buildTeachingJourneyPlan } = require("./teachingJourneyEngine");
const { buildExaminerIntelligencePlan } = require("./examinerIntelligenceEngine");
const { buildTeacherBrainPromptAppendixFromContext } = require("./teacherBrainPromptAppendix");

/**
 * @param {object} blueprint
 * @param {object} [ctx] — topic, subject, examBoard, tier (for Teacher Brain)
 */
function buildPremiumTeachingPromptAppendix(blueprint = {}, ctx = {}) {
  const journey = buildTeachingJourneyPlan(blueprint);
  const lines = [
    "--- Lesson Generator V4 — Premium 10/10 teaching (MANDATORY) ---",
    "Goal: Outstanding GCSE AQA teacher — NOT an organised AI block system.",
    "",
    buildTeacherVoiceDirectives(),
    "",
    buildConceptStorytellingPromptSection(blueprint),
    "",
    buildCoreLearningPromptSection(blueprint),
    "",
    buildWorkedExamplePromptSection(blueprint),
    "",
    buildExaminerBrainPromptSection(blueprint),
    "",
    buildConceptLinkingPromptSection(blueprint),
    "",
    buildHigherTierChallengePromptSection(blueprint, ctx),
    "",
    buildModelAnswerQualityPromptSection(blueprint),
    "",
    buildTeacherTransitionPromptSection(blueprint),
    "",
    "TEACHING JOURNEY:",
    `Hook — ${journey.hook.purpose}`,
    `Prior bridge — ${journey.priorKnowledgeBridge.purpose}`,
    `Big picture — ${journey.bigPicture.purpose}`,
    `Recap — ${journey.lessonRecap.purpose}`,
    "",
    "EXAMINER INTELLIGENCE (also weave Students often write / AQA wants / Better answer / Full-mark phrase):",
  ];

  for (const row of buildExaminerIntelligencePlan(blueprint).slice(0, 6)) {
    lines.push(`- ${row.conceptName}`);
  }

  lines.push(
    "",
    "RETRIEVAL: Spiral checkpoints building on prior concepts.",
    "ACTIVITIES: Recall → explain → apply → exam thinking.",
    "",
    "10/10 CHECK: Every core concept has analogy + link + trap + exam phrase. No textbook walls."
  );

  const teacherBrainSection = buildTeacherBrainPromptAppendixFromContext(blueprint, ctx);
  if (teacherBrainSection) {
    lines.push("", teacherBrainSection);
  }

  return lines.join("\n");
}

module.exports = {
  buildPremiumTeachingPromptAppendix,
};
