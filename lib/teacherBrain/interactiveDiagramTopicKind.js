/**
 * Resolve GCSE topic → interactive diagram brief specialization (like drag-drop layout).
 */

const { resolveSubTopicProfile } = require("./subTopicProfiles");

function safeStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

function buildTopicHaystack(input = {}) {
  return [safeStr(input.topic), safeStr(input.subTopic), safeStr(input.topicKey)].filter(Boolean).join(" ");
}

/** Leaf profiles that must not inherit broad parent-topic diagram kinds. */
const PROFILE_TOPIC_KIND_OVERRIDES = {
  "nervous-system-structure": "generic",
};

/** @type {{ kind: string, patterns: RegExp[] }[]} */
const TOPIC_KIND_RULES = [
  { kind: "metabolism", patterns: [/metabolism/i, /catabolism/i, /anabolism/i] },
  { kind: "reflexArc", patterns: [/reflex\s*arc/i, /reflex-arc/i] },
  {
    kind: "brain",
    patterns: [
      /\bthe\s+brain\b/i,
      /^brain$/i,
      /\bhuman\s+nervous\s+system\b/i,
      /\bnervous\s+system\b/i,
      /(?:^|[:\-])the-brain(?:\b|$)/i,
      /\bbrain\s+structure\b/i,
    ],
  },
  { kind: "eye", patterns: [/\bthe\s+eye\b/i, /^eye$/i, /:the-eye\b/i, /(?:^|[:\-])the-eye(?:\b|$)/i] },
  {
    kind: "cell",
    patterns: [
      /cell\s+structure/i,
      /animal\s+and\s+plant\s+cells/i,
      /eukaryotic\s+and\s+prokaryotic/i,
      /^animal\s+cell$/i,
      /^plant\s+cell$/i,
      /:cell-structure\b/i,
      /:animal-plant-cells\b/i,
      /(?:^|[:\-])cell-structure(?:\b|$)/i,
      /(?:^|[:\-])animal-plant-cells(?:\b|$)/i,
    ],
  },
];

/**
 * @param {{ topic?: string, topicKey?: string, subTopic?: string }} input
 * @returns {"metabolism"|"reflexArc"|"brain"|"eye"|"cell"|"generic"}
 */
function resolveInteractiveDiagramTopicKind(input = {}) {
  const profile = resolveSubTopicProfile(input);
  if (profile?.taxonomyKey && PROFILE_TOPIC_KIND_OVERRIDES[profile.taxonomyKey]) {
    return PROFILE_TOPIC_KIND_OVERRIDES[profile.taxonomyKey];
  }

  const hay = buildTopicHaystack(input);
  if (!hay) return "generic";
  for (const { kind, patterns } of TOPIC_KIND_RULES) {
    if (patterns.some((re) => re.test(hay))) return kind;
  }
  return "generic";
}

module.exports = {
  TOPIC_KIND_RULES,
  buildTopicHaystack,
  resolveInteractiveDiagramTopicKind,
};
