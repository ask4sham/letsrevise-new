/**
 * Phase 3E — neurone-first priority engine (within boundary-allowed concepts).
 */

const { classifyConcept } = require("./subTopicBoundaryGuard");
const {
  resolveConceptPriorityProfile,
  flattenPriorityEntries,
} = require("./conceptPriorityProfiles");

const PRIORITY_MARKER = "CONCEPT PRIORITY:";

function isPriorityEngineEnabled() {
  return String(process.env.TEACHER_BRAIN_PRIORITY_ENGINE || "0").trim() === "1";
}

/**
 * Map coverage-map concept id → priority entry id (if any).
 * @param {string} conceptId
 * @param {import("./conceptPriorityProfiles").ConceptPriorityProfile} priorityProfile
 */
function priorityKeyForConceptId(conceptId, priorityProfile) {
  if (!conceptId || !priorityProfile) return null;
  for (const entry of flattenPriorityEntries(priorityProfile)) {
    if (entry.id === conceptId) return entry.id;
    if (entry.profileIds?.includes(conceptId)) return entry.id;
  }
  return null;
}

/**
 * @param {string} conceptId
 * @param {import("./conceptPriorityProfiles").ConceptPriorityProfile|null} priorityProfile
 * @returns {number} 1–4 when known, 99 when unknown / engine off
 */
function getPriorityTier(conceptId, priorityProfile) {
  if (!priorityProfile || !conceptId) return 99;
  let best = 99;
  for (const entry of flattenPriorityEntries(priorityProfile)) {
    if (entry.id === conceptId || entry.profileIds?.includes(conceptId)) {
      best = Math.min(best, entry.tier);
    }
  }
  return best;
}

/**
 * Lower score = higher priority for sorting.
 * @param {string} conceptId
 * @param {import("./conceptPriorityProfiles").ConceptPriorityProfile|null} priorityProfile
 * @param {object} [row]
 */
function scoreConceptPriority(conceptId, priorityProfile, row = null) {
  if (!isPriorityEngineEnabled() || !priorityProfile) {
    return 5000 + (row ? row.testedCount * 10 + row.taughtCount : 0);
  }
  const tier = getPriorityTier(conceptId, priorityProfile);
  const exposure = row ? row.testedCount * 10 + row.taughtCount : 0;
  return tier * 1000 + exposure;
}

/**
 * @param {object[]} concepts — coverage rows with id
 * @param {import("./conceptPriorityProfiles").ConceptPriorityProfile|null} priorityProfile
 */
function sortConceptsByPriority(concepts, priorityProfile) {
  if (!isPriorityEngineEnabled() || !priorityProfile || !concepts?.length) {
    return [...(concepts || [])];
  }
  return [...concepts].sort((a, b) => {
    const scoreA = scoreConceptPriority(a.id, priorityProfile, a);
    const scoreB = scoreConceptPriority(b.id, priorityProfile, b);
    if (scoreA !== scoreB) return scoreA - scoreB;
    return (a.teachingOrder || 99) - (b.teachingOrder || 99);
  });
}

/**
 * Pick highest-priority id from candidates (after boundary filter).
 * @param {string[]} candidateIds
 * @param {import("./conceptPriorityProfiles").ConceptPriorityProfile|null} priorityProfile
 * @param {object} [coverageMap]
 */
function pickHighestPriorityConceptId(candidateIds, priorityProfile, coverageMap = null) {
  if (!candidateIds?.length) return null;
  if (!isPriorityEngineEnabled() || !priorityProfile) {
    return candidateIds[0];
  }
  const rows = coverageMap?.concepts || [];
  const byId = new Map(rows.map((c) => [c.id, c]));
  const sorted = sortConceptsByPriority(
    candidateIds.map((id) => byId.get(id) || { id, taughtCount: 0, testedCount: 0 }),
    priorityProfile
  );
  return sorted[0]?.id || candidateIds[0];
}

/**
 * Re-rank coverage slot pool (post-boundary).
 * @param {object[]} ranked
 * @param {import("./conceptPriorityProfiles").ConceptPriorityProfile|null} priorityProfile
 */
function rerankCoveragePoolByPriority(ranked, priorityProfile) {
  if (!isPriorityEngineEnabled() || !priorityProfile || !ranked?.length) {
    return ranked;
  }
  return sortConceptsByPriority(ranked, priorityProfile);
}

/**
 * @param {import("./conceptPriorityProfiles").ConceptPriorityProfile} priorityProfile
 * @param {import("./subTopicProfiles").SubTopicProfile|null} subTopicProfile
 */
function filterForbiddenFromPriorityCandidates(candidateIds, subTopicProfile) {
  if (!subTopicProfile) return candidateIds;
  return (candidateIds || []).filter((id) => {
    const c = classifyConcept(id, subTopicProfile);
    return c !== "forbidden";
  });
}

/**
 * @param {object} input
 * @param {object} [input.coverageMap]
 * @param {Map<string, object[]>} [input.appearancesByConcept]
 * @param {import("./conceptPriorityProfiles").ConceptPriorityProfile} input.priorityProfile
 */
function buildConceptPriorityDistribution(input = {}) {
  const priorityProfile = input.priorityProfile;
  if (!priorityProfile) {
    return {
      enabled: false,
      tiers: [],
      underrepresented: [],
      warnings: [],
    };
  }

  const coverageMap = input.coverageMap;
  const appearances = input.appearancesByConcept || new Map();
  const rows = coverageMap?.concepts || [];
  const byProfileId = new Map(rows.map((c) => [c.id, c]));

  const tiers = [];
  const underrepresented = [];

  for (const group of priorityProfile.tiers) {
    const concepts = [];
    for (const entry of group.concepts) {
      let taught = 0;
      let tested = 0;
      for (const pid of entry.profileIds || [entry.id]) {
        const row = byProfileId.get(pid);
        if (row) {
          taught += row.taughtCount || 0;
          tested += row.testedCount || 0;
        }
        const apps = appearances.get(pid) || appearances.get(entry.id) || [];
        if (apps.length && !row) {
          tested += apps.length;
        }
      }
      const total = taught + tested;
      concepts.push({
        id: entry.id,
        name: entry.name,
        taughtCount: taught,
        testedCount: tested,
        total,
      });
      if (group.tier === 1 && total <= 1) {
        underrepresented.push({
          conceptId: entry.id,
          name: entry.name,
          total,
          message:
            total === 0
              ? `${entry.name} appears zero times — increase teaching and assessment focus.`
              : `${entry.name} appears only once — Tier 1 should dominate lesson time.`,
        });
      }
    }
    tiers.push({
      tier: group.tier,
      label: group.label,
      concepts: concepts.filter((c) => c.total > 0).sort((a, b) => b.total - a.total),
      allConcepts: concepts,
    });
  }

  const warnings = underrepresented.map((u) => u.message);

  return {
    enabled: isPriorityEngineEnabled(),
    taxonomyKey: priorityProfile.taxonomyKey,
    tiers,
    underrepresented,
    warnings,
  };
}

/**
 * @param {import("./conceptPriorityProfiles").ConceptPriorityProfile|null} priorityProfile
 */
function formatConceptPriorityAppendix(priorityProfile) {
  if (!isPriorityEngineEnabled() || !priorityProfile) return "";

  const tier1 = priorityProfile.tiers.find((t) => t.tier === 1);
  const tier2 = priorityProfile.tiers.find((t) => t.tier === 2);

  const lines = [
    PRIORITY_MARKER,
    "Highest priority concepts (must dominate teaching, interactions, and assessment):",
    ...(tier1?.concepts || []).map((c) => `* ${c.name}`),
    "",
    "Important secondary concepts:",
    ...(tier2?.concepts || []).map((c) => `* ${c.name}`),
    "",
    "These Tier 1 concepts should receive the largest teaching allocation, largest interaction allocation, largest assessment allocation, and strongest exam focus.",
    "Apply boundary rules first — forbidden sibling-topic concepts must never gain priority.",
  ];

  return lines.join("\n");
}

/**
 * @param {object} options
 * @param {string} [options.topicKey]
 * @param {string} [options.subTopic]
 * @param {import("./subTopicProfiles").SubTopicProfile|null} [options.subTopicProfile]
 */
function buildPriorityContext(options = {}) {
  const priorityProfile = resolveConceptPriorityProfile(options);
  return {
    enabled: isPriorityEngineEnabled() && Boolean(priorityProfile),
    priorityProfile,
  };
}

module.exports = {
  isPriorityEngineEnabled,
  resolveConceptPriorityProfile,
  getPriorityTier,
  scoreConceptPriority,
  sortConceptsByPriority,
  pickHighestPriorityConceptId,
  rerankCoveragePoolByPriority,
  filterForbiddenFromPriorityCandidates,
  buildConceptPriorityDistribution,
  formatConceptPriorityAppendix,
  buildPriorityContext,
  priorityKeyForConceptId,
  PRIORITY_MARKER,
};
