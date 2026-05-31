/**
 * Concept extractor — core ideas a GCSE teacher would teach for this topic.
 */

const { resolveTopicProfile } = require("./topicProfiles");

/**
 * @param {{ topic: string, subject?: string, examBoard?: string, tier?: string }} input
 * @returns {object[]}
 */
function extractCoreConcepts(input = {}) {
  const profile = resolveTopicProfile(input);
  const tier = String(input.tier || "").toLowerCase();
  const isHigher = tier.includes("higher") || tier === "ht";

  return profile.coreConcepts.map((c) => ({
    id: c.id,
    name: c.name,
    importance: c.importance,
    teachingOrder: c.teachingOrder,
    summary: c.summary,
    aqaExamPhrase: c.examPhrase,
    linksTo: c.linksTo || [],
    tierNote: c.id === "deamination_urea" && !isHigher ? "Foundation: mention briefly; HT depth optional" : null,
    lessonChain: profile.lessonChain,
  }));
}

module.exports = {
  extractCoreConcepts,
};
