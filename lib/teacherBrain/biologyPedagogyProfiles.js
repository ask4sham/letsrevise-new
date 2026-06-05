/**
 * Phase 3F — biology pedagogy profiles (structure → adaptation → function → exam).
 */

/**
 * @typedef {object} PedagogyConceptFramework
 * @property {string} conceptId
 * @property {string} name
 * @property {string[]} matchTerms
 * @property {string} structure
 * @property {string} adaptation
 * @property {string} function
 * @property {string} examApplication
 */

/**
 * @typedef {object} RequiredInteractionSpec
 * @property {string} id
 * @property {string} title
 * @property {string} blockType
 * @property {string} activityKind
 * @property {string} instructions
 * @property {string[]} cards
 * @property {string[]} pairs
 */

/**
 * @typedef {object} BiologyPedagogyProfile
 * @property {string} taxonomyKey
 * @property {RegExp[]} topicKeyPatterns
 * @property {PedagogyConceptFramework[]} tier1Frameworks
 * @property {RequiredInteractionSpec[]} requiredInteractions
 * @property {object} mandatoryExamBlock
 */

const NERVOUS_SYSTEM_STRUCTURE_PEDAGOGY = {
  taxonomyKey: "nervous-system-structure",
  topicKeyPatterns: [/nervous-system-structure/i],
  tier1Frameworks: [
    {
      conceptId: "neurone_structure",
      name: "Neurone structure",
      matchTerms: ["neurone", "neuron", "nerve cell", "cell body", "dendrites"],
      structure: "A neurone has a cell body, dendrites, a nucleus, a long axon and nerve endings.",
      adaptation: "Dendrites provide a large surface area; the axon is long to carry impulses over distance.",
      function: "Neurones transmit electrical impulses between receptors, the CNS and effectors.",
      examApplication:
        "Students can label neurone parts and link each structure to rapid communication.",
    },
    {
      conceptId: "axons",
      name: "Axon",
      matchTerms: ["axon", "axons", "nerve fibre", "nerve fiber"],
      structure: "The axon is a long extension of the neurone carrying impulses away from the cell body.",
      adaptation: "Length allows impulses to travel quickly over long distances in the body.",
      function: "Carries electrical impulses to synapses and target cells.",
      examApplication: "Explain how axon length supports coordinated responses.",
    },
    {
      conceptId: "myelin_sheath",
      name: "Myelin sheath",
      matchTerms: ["myelin", "myelin sheath", "schwann"],
      structure: "Myelin is a fatty insulating sheath wrapped around the axon.",
      adaptation: "It prevents signal loss and allows saltatory conduction between gaps (nodes of Ranvier).",
      function: "Increases the speed of electrical impulse transmission along the axon.",
      examApplication:
        "Explain how myelin allows rapid responses to stimuli (4-mark GCSE style).",
    },
    {
      conceptId: "dendrites",
      name: "Dendrites",
      matchTerms: ["dendrite", "dendrites"],
      structure: "Branched extensions from the cell body with many receptors.",
      adaptation: "Large surface area to receive signals from many other neurones.",
      function: "Receive impulses and conduct them toward the cell body.",
      examApplication: "Link dendrite structure to reception of stimuli in exam answers.",
    },
    {
      conceptId: "nerve_endings",
      name: "Nerve endings",
      matchTerms: ["axon terminal", "nerve ending", "synapse", "synaptic"],
      structure: "Axon terminals form synapses with other neurones or effectors.",
      adaptation: "Neurotransmitter release across the synaptic gap.",
      function: "Pass impulses to the next neurone or to an effector.",
      examApplication: "Describe how impulses cross synapses in sequence questions.",
    },
  ],
  requiredInteractions: [
    {
      id: "interaction_a",
      title: "Neurone structure labelling",
      blockType: "dragdropmatch",
      activityKind: "dragDrop",
      instructions:
        "Drag and drop labels onto a neurone diagram. After labelling, explain how each part supports impulse transmission.",
      cards: [
        "dendrites",
        "cell body",
        "nucleus",
        "axon",
        "myelin sheath",
        "nerve endings",
      ],
      pairs: [],
    },
    {
      id: "interaction_b",
      title: "Structure → adaptation → function matching",
      blockType: "dragdropmatch",
      activityKind: "dragDrop",
      instructions:
        "Match each structure to its adaptation and function (e.g. Axon → long → carries impulses over long distances; Myelin → insulating → increases speed).",
      cards: [],
      pairs: [
        "Axon → long → carries impulses over long distances",
        "Myelin → insulating → increases speed",
        "Dendrites → branched → large surface area to receive signals",
      ],
    },
    {
      id: "interaction_c",
      title: "CNS vs PNS classification",
      blockType: "dragdropmatch",
      activityKind: "dragDrop",
      instructions:
        "Sort or match: Brain → CNS; Spinal cord → CNS; Motor neurone → PNS; Sensory neurone → PNS.",
      cards: ["Brain", "Spinal cord", "Motor neurone", "Sensory neurone", "CNS", "PNS"],
      pairs: [
        "Brain → CNS",
        "Spinal cord → CNS",
        "Motor neurone → PNS",
        "Sensory neurone → PNS",
      ],
    },
  ],
  mandatoryExamBlock: {
    marks: 4,
    question:
      "Explain how neurones are adapted for rapid transmission of electrical impulses.",
    modelAnswer:
      "Neurones have long axons to carry impulses over distance. The myelin sheath insulates the axon and allows saltatory conduction, increasing speed. Branched dendrites provide a large surface area to receive signals. Synapses pass impulses to the next neurone or effector for a coordinated response.",
    cognitiveSkill: "Explain",
  },
};

const PEDAGOGY_PROFILES = [NERVOUS_SYSTEM_STRUCTURE_PEDAGOGY];

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
 * @param {import("./subTopicProfiles").SubTopicProfile|null} [input.subTopicProfile]
 * @returns {BiologyPedagogyProfile|null}
 */
function resolvePedagogyProfile(input = {}) {
  const leaf = leafKeyFromTopicKey(input.topicKey);
  const subTopic = String(input.subTopic || "").trim();

  for (const profile of PEDAGOGY_PROFILES) {
    if (input.taxonomyKey && input.taxonomyKey === profile.taxonomyKey) {
      return profile;
    }
    if (leaf && profile.topicKeyPatterns.some((re) => re.test(leaf))) {
      return profile;
    }
    if (input.subTopicProfile?.taxonomyKey === profile.taxonomyKey) {
      return profile;
    }
    if (subTopic && /structure\s+and\s+function\s+of\s+the\s+nervous\s+system/i.test(subTopic)) {
      return profile;
    }
  }
  return null;
}

module.exports = {
  PEDAGOGY_PROFILES,
  NERVOUS_SYSTEM_STRUCTURE_PEDAGOGY,
  resolvePedagogyProfile,
};
