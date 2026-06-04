/**
 * Phase 3H.0 — concept compression profiles per sub-topic.
 * Each profile defines the 3–5 highest-value concepts to establish early in a lesson.
 */

/**
 * @typedef {object} ConceptCompressionProfile
 * @property {string} taxonomyKey
 * @property {RegExp[]} topicKeyPatterns
 * @property {RegExp[]} displayPatterns
 * @property {string} definition
 * @property {string} whyItMatters
 * @property {string[]} gcseExamples
 * @property {string} coreModel
 * @property {string[]} examAnchors
 * @property {string[]} [definitionMatchTerms]
 * @property {string[]} [whyMatchTerms]
 * @property {string[]} [coreModelMatchTerms]
 * @property {{ term: string, label: string }[]} [examAnchorTerms]
 */

const HOMEOSTASIS_COMPRESSION = {
  taxonomyKey: "homeostasis",
  topicKeyPatterns: [/homeostasis/i, /control-of-body-temperature/i, /thermoregulation/i],
  displayPatterns: [
    /^homeostasis$/i,
    /control of body temperature/i,
    /thermoregulation/i,
    /maintaining internal conditions/i,
  ],
  definition:
    "Homeostasis is the regulation of internal conditions to maintain optimum conditions for cells and enzymes.",
  whyItMatters: "Enzymes only work efficiently within narrow conditions.",
  gcseExamples: ["Body temperature", "Blood glucose", "Water balance"],
  coreModel: "Receptors → Coordination Centre → Effectors",
  examAnchors: ["Receptor", "Coordination Centre", "Effector", "Negative Feedback"],
  definitionMatchTerms: ["homeostasis", "internal conditions", "optimum conditions", "regulation"],
  whyMatchTerms: ["enzyme", "efficient", "narrow conditions", "why it matters", "important"],
  coreModelMatchTerms: [
    "receptor",
    "coordination centre",
    "coordination center",
    "effector",
    "negative feedback",
  ],
  examAnchorTerms: [
    { term: "receptor", label: "Receptor" },
    { term: "coordination centre", label: "Coordination Centre" },
    { term: "coordination center", label: "Coordination Centre" },
    { term: "effector", label: "Effector" },
    { term: "negative feedback", label: "Negative Feedback" },
  ],
};

const NERVOUS_SYSTEM_STRUCTURE_COMPRESSION = {
  taxonomyKey: "nervous-system-structure",
  topicKeyPatterns: [/nervous-system-structure/i, /structure-and-function-of-the-nervous-system/i],
  displayPatterns: [/structure\s+and\s+function\s+of\s+the\s+nervous\s+system/i],
  definition: "The nervous system is the body's rapid communication system.",
  whyItMatters: "It allows organisms to detect and respond quickly to changes.",
  gcseExamples: ["Receptors", "Neurones", "CNS and PNS", "Effectors"],
  coreModel: "Stimulus → Receptor → Neurone → CNS → Effector → Response",
  examAnchors: ["Neurone", "Axon", "Dendrite", "Myelin", "CNS", "PNS"],
  definitionMatchTerms: [
    "nervous system",
    "communication system",
    "rapid communication",
    "detect and respond",
  ],
  whyMatchTerms: [
    "quickly",
    "rapid",
    "detect",
    "respond",
    "why it matters",
    "important",
    "survival",
  ],
  coreModelMatchTerms: [
    "stimulus",
    "receptor",
    "neurone",
    "neuron",
    "cns",
    "central nervous",
    "effector",
    "response",
  ],
  examAnchorTerms: [
    { term: "neurone", label: "Neurone" },
    { term: "neuron", label: "Neurone" },
    { term: "axon", label: "Axon" },
    { term: "dendrite", label: "Dendrite" },
    { term: "myelin", label: "Myelin" },
    { term: "cns", label: "CNS" },
    { term: "central nervous", label: "CNS" },
    { term: "pns", label: "PNS" },
    { term: "peripheral nervous", label: "PNS" },
  ],
};

const THE_EYE_COMPRESSION = {
  taxonomyKey: "the-eye",
  topicKeyPatterns: [/the-eye/i, /\beye\b/i, /accommodation/i],
  displayPatterns: [/^the eye$/i, /structure of the eye/i, /accommodation/i, /vision and the eye/i],
  definition: "The eye detects light and forms images.",
  whyItMatters: "Clear vision depends on correctly focusing light onto the retina.",
  gcseExamples: ["Cornea", "Lens", "Retina", "Accommodation"],
  coreModel: "Cornea → Lens → Retina",
  examAnchors: ["Cornea", "Iris", "Lens", "Retina", "Accommodation"],
  definitionMatchTerms: ["eye", "detects light", "forms images", "vision"],
  whyMatchTerms: ["focus", "retina", "clear vision", "why it matters", "important"],
  coreModelMatchTerms: ["cornea", "lens", "retina", "light", "focus"],
  examAnchorTerms: [
    { term: "cornea", label: "Cornea" },
    { term: "iris", label: "Iris" },
    { term: "lens", label: "Lens" },
    { term: "retina", label: "Retina" },
    { term: "accommodation", label: "Accommodation" },
  ],
};

const COMPRESSION_PROFILES = [
  NERVOUS_SYSTEM_STRUCTURE_COMPRESSION,
  THE_EYE_COMPRESSION,
  HOMEOSTASIS_COMPRESSION,
];

function leafKeyFromTopicKey(topicKey = "") {
  const raw = String(topicKey || "").trim().toLowerCase();
  if (!raw) return "";
  const idx = raw.lastIndexOf(":");
  return idx >= 0 ? raw.slice(idx + 1) : raw;
}

/**
 * @param {object} [input]
 * @param {string} [input.topicKey]
 * @param {string} [input.subTopic]
 * @param {string} [input.topic]
 * @param {string} [input.taxonomyKey]
 * @param {import("./subTopicProfiles").SubTopicProfile|null} [input.subTopicProfile]
 * @returns {ConceptCompressionProfile|null}
 */
function resolveConceptCompressionProfile(input = {}) {
  const leaf = leafKeyFromTopicKey(input.topicKey);
  const subTopic = String(input.subTopic || "").trim();
  const topic = String(input.topic || "").trim();

  if (input.taxonomyKey) {
    const byKey = COMPRESSION_PROFILES.find((p) => p.taxonomyKey === input.taxonomyKey);
    if (byKey) return byKey;
  }

  if (input.subTopicProfile?.taxonomyKey) {
    const bySub = COMPRESSION_PROFILES.find(
      (p) => p.taxonomyKey === input.subTopicProfile.taxonomyKey
    );
    if (bySub) return bySub;
  }

  for (const profile of COMPRESSION_PROFILES) {
    if (leaf && profile.topicKeyPatterns.some((re) => re.test(leaf))) {
      return profile;
    }
  }

  for (const profile of COMPRESSION_PROFILES) {
    if (subTopic && profile.displayPatterns.some((re) => re.test(subTopic))) {
      return profile;
    }
    if (topic && profile.displayPatterns.some((re) => re.test(topic))) {
      return profile;
    }
  }

  return null;
}

module.exports = {
  HOMEOSTASIS_COMPRESSION,
  NERVOUS_SYSTEM_STRUCTURE_COMPRESSION,
  THE_EYE_COMPRESSION,
  COMPRESSION_PROFILES,
  resolveConceptCompressionProfile,
  leafKeyFromTopicKey,
};
