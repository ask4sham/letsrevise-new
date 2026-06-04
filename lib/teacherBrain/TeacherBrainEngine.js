/**
 * Teacher Brain — analysis + Phase 4 lesson coverage intelligence.
 *
 * Does NOT generate lessons, prompts, or blocks (except coverage balancing on plans).
 */

const { extractCoreConcepts } = require("./conceptExtractor");
const { planMisconceptions } = require("./misconceptionEngine");
const { planRequiredDiagrams } = require("./diagramPlanner");
const { planActivityRecommendations } = require("./activityPlanner");
const { planExamTargets } = require("./examPlanner");
const { planRetrieval } = require("./retrievalPlanner");
const {
  buildLessonCoverageMap,
  applyCoverageToActivityRecommendations,
  applyCoverageToRetrievalPlan,
} = require("./lessonCoverageIntelligence");

/**
 * @param {{
 *   topic: string,
 *   subject?: string,
 *   examBoard?: string,
 *   tier?: string
 * }} input
 * @returns {{
 *   coreConcepts: object[],
 *   misconceptions: object[],
 *   requiredDiagrams: object[],
 *   activityRecommendations: object[],
 *   examTargets: object[],
 *   retrievalPlan: object[],
 *   coverageMap: object
 * }}
 */
function runTeacherBrain(input = {}) {
  if (!input.topic || !String(input.topic).trim()) {
    throw new Error("Teacher Brain requires a topic");
  }

  const normalized = {
    topic: String(input.topic).trim(),
    topicKey: String(input.topicKey || "").trim(),
    subTopic: String(input.subTopic || "").trim(),
    subject: String(input.subject || "Biology").trim(),
    examBoard: String(input.examBoard || "AQA").trim(),
    tier: String(input.tier || "Higher").trim(),
  };

  const coreConcepts = extractCoreConcepts(normalized);
  const misconceptions = planMisconceptions(normalized, coreConcepts);
  const requiredDiagrams = planRequiredDiagrams(normalized, coreConcepts);

  const coverageMap = buildLessonCoverageMap({
    pages: input.pages,
    quiz: input.quiz,
    coreConcepts,
    misconceptions,
    lessonId: input.lessonId,
  });

  const rawActivities = planActivityRecommendations(normalized, coreConcepts);
  const activityRecommendations = applyCoverageToActivityRecommendations(
    rawActivities,
    coverageMap,
    coreConcepts
  );
  const examTargets = planExamTargets(normalized, coreConcepts);
  const rawRetrieval = planRetrieval(normalized, coreConcepts);
  const retrievalPlan = applyCoverageToRetrievalPlan(rawRetrieval, coverageMap);

  return {
    topic: normalized.topic,
    topicKey: normalized.topicKey,
    subTopic: normalized.subTopic,
    subject: normalized.subject,
    examBoard: normalized.examBoard,
    tier: normalized.tier,
    coreConcepts,
    misconceptions,
    requiredDiagrams,
    activityRecommendations,
    examTargets,
    retrievalPlan,
    coverageMap,
  };
}

module.exports = {
  runTeacherBrain,
};
