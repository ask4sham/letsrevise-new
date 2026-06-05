/**
 * Resolve GCSE topic → interactive sequence (step-by-step) brief specialization.
 */

const { buildTopicHaystack } = require("./interactiveDiagramTopicKind");
const { resolveSubTopicProfile } = require("./subTopicProfiles");

/** Leaf profiles that must not inherit broad parent-topic sequence kinds. */
const PROFILE_SEQUENCE_KIND_OVERRIDES = {
  "nervous-system-structure": "generic",
};

/** @type {{ kind: string, patterns: RegExp[] }[]} */
const SEQUENCE_TOPIC_KIND_RULES = [
  { kind: "metabolism", patterns: [/metabolism/i, /catabolism/i, /anabolism/i] },
  { kind: "reflexArc", patterns: [/reflex\s*arc/i, /reflex-arc/i, /(?:^|[:\-])reflex-arc(?:\b|$)/i] },
  {
    kind: "brain",
    patterns: [
      /\bthe\s+brain\b/i,
      /^brain$/i,
      /\bhuman\s+nervous\s+system\b/i,
      /\bnervous\s+system\b/i,
      /(?:^|[:\-])the-brain(?:\b|$)/i,
    ],
  },
  {
    kind: "homeostasis",
    patterns: [
      /homeostasis/i,
      /negative\s+feedback/i,
      /control\s+of\s+body\s+temperature/i,
      /thermoregulation/i,
      /blood\s+glucose/i,
      /osmoregulation/i,
    ],
  },
  {
    kind: "mitosis",
    patterns: [
      /\bmitosis\b/i,
      /cell\s+cycle/i,
      /cell\s+division/i,
      /(?:^|[:\-])mitosis(?:\b|$)/i,
    ],
  },
  {
    kind: "digestion",
    patterns: [/digestion/i, /digestive\s+system/i, /(?:^|[:\-])digestive-system(?:\b|$)/i],
  },
  {
    kind: "photosynthesis",
    patterns: [/photosynthesis/i, /(?:^|[:\-])photosynthesis(?:\b|$)/i],
  },
];

/**
 * @param {{ topic?: string, topicKey?: string, subTopic?: string }} input
 * @returns {
 *   "metabolism"|"reflexArc"|"brain"|"homeostasis"|"mitosis"|"digestion"|"photosynthesis"|"generic"
 * }
 */
function resolveInteractiveSequenceTopicKind(input = {}) {
  const profile = resolveSubTopicProfile(input);
  if (profile?.taxonomyKey && PROFILE_SEQUENCE_KIND_OVERRIDES[profile.taxonomyKey]) {
    return PROFILE_SEQUENCE_KIND_OVERRIDES[profile.taxonomyKey];
  }

  const hay = buildTopicHaystack(input);
  if (!hay) return "generic";
  for (const { kind, patterns } of SEQUENCE_TOPIC_KIND_RULES) {
    if (patterns.some((re) => re.test(hay))) return kind;
  }
  return "generic";
}

module.exports = {
  SEQUENCE_TOPIC_KIND_RULES,
  resolveInteractiveSequenceTopicKind,
};
