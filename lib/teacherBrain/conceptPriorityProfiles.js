/**
 * Phase 3E — concept priority tiers within a sub-topic profile.
 */

/**
 * @typedef {object} PriorityConceptEntry
 * @property {string} id
 * @property {string} name
 * @property {string[]} profileIds — ids used in coverage map / sub-topic profile
 */

/**
 * @typedef {object} ConceptPriorityProfile
 * @property {string} taxonomyKey
 * @property {RegExp[]} topicKeyPatterns
 * @property {{ tier: number, label: string, concepts: PriorityConceptEntry[] }[]} tiers
 */

const NERVOUS_SYSTEM_STRUCTURE_PRIORITY = {
  taxonomyKey: "nervous-system-structure",
  topicKeyPatterns: [/nervous-system-structure/i],
  tiers: [
    {
      tier: 1,
      label: "Tier 1",
      concepts: [
        {
          id: "neurone_structure",
          name: "Neurone structure",
          profileIds: ["neurones"],
        },
        { id: "axons", name: "Axon", profileIds: ["axons"] },
        { id: "myelin_sheath", name: "Myelin sheath", profileIds: ["myelin_sheath"] },
        { id: "dendrites", name: "Dendrites", profileIds: ["dendrites"] },
        {
          id: "nerve_endings",
          name: "Nerve endings",
          profileIds: ["synapses_structure", "neurones"],
        },
        {
          id: "structure_function_link",
          name: "Structure–function link",
          profileIds: ["neurones", "axons", "myelin_sheath"],
        },
      ],
    },
    {
      tier: 2,
      label: "Tier 2",
      concepts: [
        { id: "cns", name: "CNS", profileIds: ["cns"] },
        { id: "pns", name: "PNS", profileIds: ["pns"] },
        {
          id: "receptors",
          name: "Receptors",
          profileIds: ["receptors"],
        },
        {
          id: "effectors",
          name: "Effectors",
          profileIds: ["effectors"],
        },
        {
          id: "impulse_transmission",
          name: "Impulse transmission",
          profileIds: ["impulse_transmission"],
        },
      ],
    },
    {
      tier: 3,
      label: "Tier 3",
      concepts: [
        {
          id: "synapse",
          name: "Synapse",
          profileIds: ["synapses_structure"],
        },
        {
          id: "relay_neurone",
          name: "Relay neurone",
          profileIds: ["neurones"],
        },
        {
          id: "sensory_neurone",
          name: "Sensory neurone",
          profileIds: ["neurones"],
        },
        {
          id: "motor_neurone",
          name: "Motor neurone",
          profileIds: ["neurones"],
        },
      ],
    },
    {
      tier: 4,
      label: "Tier 4",
      concepts: [
        { id: "reflex_arc", name: "Reflex arc (brief only)", profileIds: ["reflex_arc"] },
        {
          id: "brain_regions",
          name: "Brain regions",
          profileIds: ["brain_regions", "brain"],
        },
        { id: "accommodation", name: "Accommodation", profileIds: ["accommodation"] },
        {
          id: "thermoregulation",
          name: "Thermoregulation",
          profileIds: ["thermoregulation"],
        },
      ],
    },
  ],
};

const PRIORITY_PROFILES = [NERVOUS_SYSTEM_STRUCTURE_PRIORITY];

function leafKeyFromTopicKey(topicKey = "") {
  const raw = String(topicKey || "").trim().toLowerCase();
  if (!raw) return "";
  const idx = raw.lastIndexOf(":");
  return idx >= 0 ? raw.slice(idx + 1) : raw;
}

/**
 * Flatten profile entries for lookup.
 * @param {ConceptPriorityProfile} profile
 */
function flattenPriorityEntries(profile) {
  const entries = [];
  for (const group of profile.tiers || []) {
    for (const concept of group.concepts || []) {
      entries.push({
        ...concept,
        tier: group.tier,
        tierLabel: group.label,
      });
    }
  }
  return entries;
}

/**
 * @param {object} [input]
 * @param {string} [input.topicKey]
 * @param {string} [input.subTopic]
 * @param {import("./subTopicProfiles").SubTopicProfile|null} [input.subTopicProfile]
 * @returns {ConceptPriorityProfile|null}
 */
function resolveConceptPriorityProfile(input = {}) {
  const leaf = leafKeyFromTopicKey(input.topicKey);
  const profile = input.subTopicProfile;

  for (const priorityProfile of PRIORITY_PROFILES) {
    if (leaf && priorityProfile.topicKeyPatterns.some((re) => re.test(leaf))) {
      return priorityProfile;
    }
    if (profile?.taxonomyKey === priorityProfile.taxonomyKey) {
      return priorityProfile;
    }
  }
  return null;
}

module.exports = {
  PRIORITY_PROFILES,
  NERVOUS_SYSTEM_STRUCTURE_PRIORITY,
  resolveConceptPriorityProfile,
  flattenPriorityEntries,
};
