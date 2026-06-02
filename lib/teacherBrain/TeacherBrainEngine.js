/**
 * Teacher Brain — Phase 1: pre-lesson analysis only (isolated prototype).
 *
 * Does NOT generate lessons, prompts, or blocks.
 */

const { extractCoreConcepts } = require("./conceptExtractor");
const { planMisconceptions } = require("./misconceptionEngine");
const { planRequiredDiagrams } = require("./diagramPlanner");
const { planActivityRecommendations } = require("./activityPlanner");
const { planExamTargets } = require("./examPlanner");
const { planRetrieval } = require("./retrievalPlanner");

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
 *   retrievalPlan: object[]
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
  const activityRecommendations = planActivityRecommendations(normalized, coreConcepts);
  const examTargets = planExamTargets(normalized, coreConcepts);
  const retrievalPlan = planRetrieval(normalized, coreConcepts);

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
  };
}

module.exports = {
  runTeacherBrain,
};
