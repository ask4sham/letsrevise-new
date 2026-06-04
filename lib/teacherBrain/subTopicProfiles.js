/**
 * Sub-topic profiles — leaf taxonomy keys define teaching boundaries (Phase 0–2).
 * Main topic / unit is not used as the concept universe.
 */

/** @typedef {"in_scope"|"neighbouring"|"forbidden"|"unknown"} ConceptScope */

/**
 * @typedef {object} SubTopicConceptDef
 * @property {string} id
 * @property {string} name
 * @property {string[]} [matchTerms]
 */

/**
 * @typedef {object} SubTopicProfile
 * @property {string} taxonomyKey
 * @property {RegExp[]} displayPatterns
 * @property {RegExp[]} topicKeyPatterns
 * @property {SubTopicConceptDef[]} primaryConcepts
 * @property {SubTopicConceptDef[]} neighbouringConcepts
 * @property {SubTopicConceptDef[]} forbiddenConcepts
 * @property {string} centralConceptId
 * @property {Record<string, string[]>} [allowedActivityKinds]
 */

const NERVOUS_SYSTEM_STRUCTURE_PROFILE = {
  taxonomyKey: "nervous-system-structure",
  displayPatterns: [/structure\s+and\s+function\s+of\s+the\s+nervous\s+system/i],
  topicKeyPatterns: [/nervous-system-structure/i],
  centralConceptId: "neurones",
  primaryConcepts: [
    { id: "cns", name: "CNS", matchTerms: ["cns", "central nervous system", "brain and spinal cord"] },
    { id: "pns", name: "PNS", matchTerms: ["pns", "peripheral nervous system"] },
    {
      id: "neurones",
      name: "Neurones",
      matchTerms: ["neurone", "neuron", "nerve cell", "motor neurone", "sensory neurone", "relay neurone"],
    },
    { id: "nerves", name: "Nerves", matchTerms: ["nerve", "nerves", "bundle of neurones"] },
    { id: "axons", name: "Axons", matchTerms: ["axon", "axons", "nerve fibre", "nerve fiber"] },
    { id: "dendrites", name: "Dendrites", matchTerms: ["dendrite", "dendrites"] },
    {
      id: "myelin_sheath",
      name: "Myelin sheath",
      matchTerms: ["myelin", "myelin sheath", "schwann cell", "insulation"],
    },
    {
      id: "impulse_transmission",
      name: "Impulse transmission",
      matchTerms: [
        "impulse",
        "impulses",
        "electrical impulse",
        "nerve impulse",
        "action potential",
        "transmission along neurone",
      ],
    },
    {
      id: "synapses_structure",
      name: "Synapses (structure)",
      matchTerms: ["synapse", "synapses", "synaptic gap", "dendron", "axon terminal"],
    },
  ],
  neighbouringConcepts: [
    { id: "reflex_arc", name: "Reflex arc", matchTerms: ["reflex arc", "reflex"] },
    { id: "brain", name: "Brain", matchTerms: ["brain", "cerebrum", "cerebellum", "medulla"] },
    { id: "eye", name: "Eye", matchTerms: ["eye", "retina", "cornea", "lens"] },
  ],
  forbiddenConcepts: [
    {
      id: "reflex_arc_pathway",
      name: "Reflex arc pathway",
      matchTerms: [
        "reflex arc pathway",
        "reflex pathway",
        "stimulus to effector",
        "receptor sensory neurone relay motor effector",
        "order the reflex arc",
      ],
    },
    {
      id: "brain_regions",
      name: "Brain regions",
      matchTerms: [
        "brain regions",
        "label the brain",
        "cerebral cortex",
        "cerebellum function",
        "medulla function",
        "brain labelling",
        "brain labeling",
      ],
    },
    {
      id: "accommodation",
      name: "Accommodation",
      matchTerms: ["accommodation", "near vision", "far vision", "lens shape change"],
    },
    {
      id: "thermoregulation",
      name: "Thermoregulation",
      matchTerms: [
        "thermoregulation",
        "body temperature",
        "temperature control",
        "hypothalamus temperature",
        "vasodilation",
        "vasoconstriction",
        "sweating",
        "shivering",
      ],
    },
  ],
  allowedActivityKinds: {
    dragDrop: ["label_neurone", "match_neurone_parts", "cns_pns_sort"],
    hotspot: ["neurone_structure", "synapse_gap"],
    sequence: ["impulse_direction"],
    checkpoint: ["recall_structure", "explain_myelin", "describe_adaptations"],
  },
};

const SUB_TOPIC_PROFILES = [NERVOUS_SYSTEM_STRUCTURE_PROFILE];

/**
 * @param {string} topicKey
 * @returns {string}
 */
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
 * @returns {SubTopicProfile|null}
 */
function resolveSubTopicProfile(input = {}) {
  const leaf = leafKeyFromTopicKey(input.topicKey);
  const subTopic = String(input.subTopic || "").trim();
  const topic = String(input.topic || "").trim();

  for (const profile of SUB_TOPIC_PROFILES) {
    if (leaf && profile.topicKeyPatterns.some((re) => re.test(leaf))) {
      return profile;
    }
  }

  for (const profile of SUB_TOPIC_PROFILES) {
    if (subTopic && profile.displayPatterns.some((re) => re.test(subTopic))) {
      return profile;
    }
    if (topic && profile.displayPatterns.some((re) => re.test(topic))) {
      return profile;
    }
  }

  return null;
}

/**
 * Flat list with scope tag for matching.
 * @param {SubTopicProfile} profile
 */
function listProfileConcepts(profile) {
  if (!profile) return [];
  return [
    ...profile.primaryConcepts.map((c) => ({ ...c, scope: "in_scope" })),
    ...profile.neighbouringConcepts.map((c) => ({ ...c, scope: "neighbouring" })),
    ...profile.forbiddenConcepts.map((c) => ({ ...c, scope: "forbidden" })),
  ];
}

module.exports = {
  NERVOUS_SYSTEM_STRUCTURE_PROFILE,
  SUB_TOPIC_PROFILES,
  resolveSubTopicProfile,
  leafKeyFromTopicKey,
  listProfileConcepts,
};
