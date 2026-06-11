/**
 * Phase 3H.1 — Teacher-First Knowledge Delivery profiles.
 *
 * Layer 1: Universal teacher-first framework (structure/order).
 * Layer 2: Subject-specific teaching profiles (topic content).
 * Biology is the first implemented subject profile.
 */

/**
 * @typedef {object} TeacherFirstKnowledgeProfile
 * @property {string} taxonomyKey
 * @property {string} [subjectKey]
 * @property {RegExp[]} topicKeyPatterns
 * @property {RegExp[]} displayPatterns
 * @property {string} definition
 * @property {string} whyItMatters
 * @property {string} coreModel
 * @property {string[]} keyExamples
 * @property {string[]} examVocabulary
 * @property {string[]} [keyWordsTerms]
 * @property {string[]} definitionMatchTerms
 * @property {string[]} whyMatchTerms
 * @property {string[]} coreModelMatchTerms
 * @property {string[]} examVocabMatchTerms
 */

/**
 * @typedef {object} SubjectTeachingProfile
 * @property {string} subjectKey
 * @property {string} label
 * @property {boolean} implemented
 * @property {TeacherFirstKnowledgeProfile[]} topicProfiles
 */

/** Layer 1 — universal opening structure for every subject/topic. */
const UNIVERSAL_TEACHER_FIRST_FRAMEWORK = {
  layer: 1,
  openingOrder: [
    "definition",
    "whyItMatters",
    "coreModel",
    "keyExamples",
    "examVocabulary",
    "shortScenarioOrActivity",
  ],
  sections: [
    { key: "definition", label: "Definition" },
    { key: "whyItMatters", label: "Why it matters" },
    { key: "coreModel", label: "Core model" },
    { key: "keyExamples", label: "Key examples" },
    { key: "examVocabulary", label: "Exam vocabulary" },
    { key: "shortScenarioOrActivity", label: "Short scenario or activity" },
  ],
  promptInstructions: [
    "Start with the definition.",
    "Explain why the concept matters.",
    "Present the GCSE core model early.",
    "List key GCSE examples and vocabulary.",
    "Do not begin with a long scenario.",
    'Do not use "Imagine..." as the main teaching method.',
    "Use scenarios only after the key idea is clear.",
  ],
};

const HOMEOSTASIS_OPENING = {
  taxonomyKey: "homeostasis",
  subjectKey: "biology",
  topicKeyPatterns: [/homeostasis/i, /control-of-body-temperature/i, /thermoregulation/i],
  displayPatterns: [/^homeostasis$/i, /control of body temperature/i, /thermoregulation/i],
  definition:
    "Homeostasis is the regulation of internal conditions to maintain optimum conditions for cells and enzymes.",
  whyItMatters: "Enzymes only work efficiently within narrow conditions.",
  coreModel: "Receptors → Coordination centre → Effectors",
  keyExamples: ["Body temperature", "Blood glucose", "Water balance"],
  examVocabulary: [
    "receptor",
    "coordination centre",
    "effector",
    "stimulus",
    "response",
    "optimum",
    "enzyme",
  ],
  keyWordsTerms: [
    "homeostasis",
    "stimulus",
    "receptor",
    "coordination centre",
    "effector",
    "response",
    "optimum",
    "negative feedback",
    "hormone",
    "enzyme",
  ],
  definitionMatchTerms: ["homeostasis", "internal conditions", "optimum", "regulation"],
  whyMatchTerms: ["enzyme", "efficient", "narrow conditions", "why it matters", "matters"],
  coreModelMatchTerms: ["receptor", "coordination centre", "coordination center", "effector"],
  examVocabMatchTerms: [
    "receptor",
    "coordination centre",
    "coordination center",
    "effector",
    "stimulus",
    "response",
    "optimum",
    "enzyme",
  ],
};

const NERVOUS_SYSTEM_STRUCTURE_OPENING = {
  taxonomyKey: "nervous-system-structure",
  subjectKey: "biology",
  topicKeyPatterns: [/nervous-system-structure/i, /structure-and-function-of-the-nervous-system/i],
  displayPatterns: [
    /structure\s+and\s+function\s+of\s+the\s+nervous\s+system/i,
    /nervous\s+system.*(?:structure|function|basic|basics|neurone|neuron|receptor|synapse)/i,
    /(?:structure|function).*nervous\s+system/i,
  ],
  definition: "The nervous system is the body's rapid communication system.",
  whyItMatters: "It allows organisms to detect changes and respond quickly.",
  coreModel: "Stimulus → Receptor → Sensory neurone → CNS → Motor neurone → Effector → Response",
  keyExamples: [
    "Reflex actions",
    "Withdrawal reflex",
    "Touch receptors",
    "Light receptors",
    "Temperature receptors",
  ],
  examVocabulary: [
    "receptor",
    "sensory neurone",
    "relay neurone",
    "motor neurone",
    "synapse",
    "CNS",
    "PNS",
    "effector",
    "response",
    "stimulus",
  ],
  keyWordsTerms: [
    "receptor",
    "stimulus",
    "response",
    "sensory neurone",
    "relay neurone",
    "motor neurone",
    "synapse",
    "CNS",
    "PNS",
    "effector",
    "myelin sheath",
    "axon",
    "dendrite",
  ],
  definitionMatchTerms: ["nervous system", "rapid communication", "communication system"],
  whyMatchTerms: ["detect", "respond quickly", "quickly", "why it matters", "matters"],
  coreModelMatchTerms: [
    "stimulus",
    "receptor",
    "sensory neurone",
    "sensory neuron",
    "motor neurone",
    "motor neuron",
    "cns",
    "effector",
    "response",
  ],
  examVocabMatchTerms: [
    "sensory neurone",
    "sensory neuron",
    "relay neurone",
    "relay neuron",
    "motor neurone",
    "motor neuron",
    "synapse",
    "cns",
    "pns",
    "receptor",
    "effector",
    "response",
    "stimulus",
  ],
};

const THE_EYE_OPENING = {
  taxonomyKey: "the-eye",
  subjectKey: "biology",
  topicKeyPatterns: [/the-eye/i, /\beye\b/i],
  displayPatterns: [/^the eye$/i, /structure of the eye/i, /vision and the eye/i],
  definition: "The eye detects light and helps form a focused image.",
  whyItMatters: "Clear vision depends on focusing light onto the retina.",
  coreModel: "Cornea → Lens → Retina",
  keyExamples: ["Cornea refraction", "Lens accommodation", "Retina image formation"],
  examVocabulary: [
    "cornea",
    "lens",
    "retina",
    "iris",
    "pupil",
    "ciliary muscles",
    "suspensory ligaments",
    "accommodation",
  ],
  keyWordsTerms: [
    "cornea",
    "iris",
    "pupil",
    "lens",
    "retina",
    "ciliary muscles",
    "suspensory ligaments",
    "accommodation",
    "refraction",
    "photoreceptor",
  ],
  definitionMatchTerms: ["eye", "detects light", "focused image", "forms an image"],
  whyMatchTerms: ["retina", "focus", "clear vision", "why it matters", "matters"],
  coreModelMatchTerms: ["cornea", "lens", "retina"],
  examVocabMatchTerms: [
    "cornea",
    "lens",
    "retina",
    "iris",
    "pupil",
    "ciliary",
    "suspensory",
    "accommodation",
  ],
};

const REFLEX_ARC_OPENING = {
  taxonomyKey: "reflex-arc",
  subjectKey: "biology",
  topicKeyPatterns: [/reflex-arc/i],
  displayPatterns: [/^the reflex arc$/i, /reflex\s+arc/i, /reflex\s+action/i],
  definition:
    "A reflex arc is the rapid pathway through the nervous system that produces an automatic response without conscious thought.",
  whyItMatters:
    "Reflex arcs protect the body from harm by responding faster than voluntary actions.",
  coreModel:
    "Stimulus → Receptor → Sensory neurone → Relay neurone (spinal cord) → Motor neurone → Effector → Response",
  keyExamples: [
    "Withdrawal reflex from a hot object",
    "Knee jerk reflex",
    "Blink reflex",
    "Pupillary reflex",
  ],
  examVocabulary: [
    "receptor",
    "sensory neurone",
    "relay neurone",
    "motor neurone",
    "effector",
    "stimulus",
    "response",
    "spinal cord",
    "reflex",
  ],
  keyWordsTerms: [
    "reflex arc",
    "reflex",
    "receptor",
    "stimulus",
    "response",
    "sensory neurone",
    "relay neurone",
    "motor neurone",
    "effector",
    "spinal cord",
    "automatic",
  ],
  definitionMatchTerms: ["reflex arc", "automatic response", "without conscious", "rapid pathway"],
  whyMatchTerms: ["protect", "faster", "voluntary", "harm", "why it matters", "matters"],
  coreModelMatchTerms: [
    "stimulus",
    "receptor",
    "sensory neurone",
    "sensory neuron",
    "relay neurone",
    "relay neuron",
    "motor neurone",
    "motor neuron",
    "effector",
    "spinal cord",
    "response",
  ],
  examVocabMatchTerms: [
    "sensory neurone",
    "sensory neuron",
    "relay neurone",
    "relay neuron",
    "motor neurone",
    "motor neuron",
    "effector",
    "receptor",
    "stimulus",
    "response",
    "reflex",
    "spinal cord",
  ],
};

const CELL_STRUCTURE_OPENING = {
  taxonomyKey: "cell-structure",
  subjectKey: "biology",
  topicKeyPatterns: [/cell-structure/i],
  displayPatterns: [
    /^cell structure$/i,
    /structure of (?:animal|plant|bacterial )?cells/i,
    /animal and plant cells/i,
    /eukaryot/i,
    /prokaryot/i,
  ],
  definition:
    "Cell structure describes the parts of cells and their functions in plants, animals, and bacteria.",
  whyItMatters:
    "Understanding cell structures explains how organisms carry out life processes such as respiration and photosynthesis.",
  coreModel:
    "Nucleus (controls activities) → Cytoplasm (chemical reactions) → Cell membrane (controls transport); plant cells also have cell wall, chloroplast, and large vacuole",
  keyExamples: [
    "Animal cell organelles",
    "Plant cell with chloroplasts",
    "Bacterial cell (no nucleus)",
    "Mitochondria for respiration",
  ],
  examVocabulary: [
    "nucleus",
    "cytoplasm",
    "cell membrane",
    "mitochondria",
    "ribosomes",
    "chloroplast",
    "cell wall",
    "vacuole",
    "plasmid",
  ],
  keyWordsTerms: [
    "nucleus",
    "cytoplasm",
    "cell membrane",
    "mitochondria",
    "ribosomes",
    "chloroplast",
    "cell wall",
    "vacuole",
    "plasmid",
    "organelle",
    "eukaryotic",
    "prokaryotic",
  ],
  definitionMatchTerms: ["cell structure", "parts of cells", "functions", "organelles"],
  whyMatchTerms: ["life processes", "respiration", "photosynthesis", "why it matters", "matters"],
  coreModelMatchTerms: [
    "nucleus",
    "cytoplasm",
    "cell membrane",
    "chloroplast",
    "cell wall",
    "vacuole",
    "mitochondria",
  ],
  examVocabMatchTerms: [
    "nucleus",
    "cytoplasm",
    "cell membrane",
    "mitochondria",
    "ribosomes",
    "chloroplast",
    "cell wall",
    "vacuole",
    "plasmid",
    "organelle",
  ],
};

const CONTROL_BLOOD_GLUCOSE_OPENING = {
  taxonomyKey: "control-blood-glucose",
  subjectKey: "biology",
  topicKeyPatterns: [/control-blood-glucose/i, /blood-glucose/i],
  displayPatterns: [
    /control of blood glucose/i,
    /blood glucose concentration/i,
    /blood glucose regulation/i,
    /insulin.*glucagon/i,
  ],
  definition:
    "Control of blood glucose is the regulation of glucose concentration in the blood to maintain optimum levels for cells.",
  whyItMatters:
    "Cells need a stable glucose supply for respiration; levels that are too high or too low are dangerous.",
  coreModel:
    "Receptors detect change → Pancreas (coordination centre) → Insulin or glucagon released → Liver/muscles (effectors) → Blood glucose returns to optimum",
  keyExamples: [
    "Blood glucose rises after a meal",
    "Insulin lowers blood glucose",
    "Glucagon raises blood glucose",
    "Glycogen stored in the liver",
  ],
  examVocabulary: [
    "insulin",
    "glucagon",
    "glycogen",
    "pancreas",
    "liver",
    "receptor",
    "negative feedback",
    "blood glucose",
    "hormone",
  ],
  keyWordsTerms: [
    "insulin",
    "glucagon",
    "glycogen",
    "pancreas",
    "liver",
    "blood glucose",
    "negative feedback",
    "receptor",
    "effector",
    "hormone",
    "optimum",
  ],
  definitionMatchTerms: [
    "blood glucose",
    "glucose concentration",
    "regulation",
    "optimum",
  ],
  whyMatchTerms: ["respiration", "stable", "too high", "too low", "why it matters", "matters"],
  coreModelMatchTerms: [
    "insulin",
    "glucagon",
    "pancreas",
    "glycogen",
    "liver",
    "receptor",
    "negative feedback",
    "optimum",
  ],
  examVocabMatchTerms: [
    "insulin",
    "glucagon",
    "glycogen",
    "pancreas",
    "liver",
    "receptor",
    "negative feedback",
    "blood glucose",
    "hormone",
  ],
};

const MITOSIS_CELL_CYCLE_OPENING = {
  taxonomyKey: "mitosis-cell-cycle",
  subjectKey: "biology",
  topicKeyPatterns: [/mitosis-cell-cycle/i, /mitosis/i],
  displayPatterns: [
    /mitosis and the cell cycle/i,
    /^mitosis$/i,
    /the cell cycle/i,
    /cell division.*growth/i,
  ],
  definition:
    "Mitosis is cell division that produces two genetically identical daughter cells for growth and repair.",
  whyItMatters:
    "Organisms grow and replace damaged tissues through mitosis in the cell cycle.",
  coreModel:
    "Interphase (DNA replication) → Prophase → Metaphase → Anaphase → Telophase → Two identical daughter cells",
  keyExamples: [
    "Growth of multicellular organisms",
    "Repair of skin after injury",
    "Asexual reproduction in some organisms",
    "Replacement of worn-out cells",
  ],
  examVocabulary: [
    "mitosis",
    "cell cycle",
    "chromosome",
    "chromatid",
    "spindle",
    "equator",
    "daughter cell",
    "interphase",
    "replication",
  ],
  keyWordsTerms: [
    "mitosis",
    "cell cycle",
    "chromosome",
    "chromatid",
    "spindle fibres",
    "equator",
    "daughter cell",
    "interphase",
    "replication",
    "genetically identical",
  ],
  definitionMatchTerms: [
    "mitosis",
    "cell division",
    "genetically identical",
    "daughter cells",
  ],
  whyMatchTerms: ["growth", "repair", "damaged", "replace", "why it matters", "matters"],
  coreModelMatchTerms: [
    "interphase",
    "prophase",
    "metaphase",
    "anaphase",
    "telophase",
    "replication",
    "chromosome",
    "daughter cell",
  ],
  examVocabMatchTerms: [
    "chromosome",
    "chromatid",
    "spindle",
    "equator",
    "daughter cell",
    "interphase",
    "replication",
    "genetically identical",
  ],
};

const HOW_MATERIALS_CYCLED_OPENING = {
  taxonomyKey: "how-materials-cycled",
  subjectKey: "biology",
  topicKeyPatterns: [/how-materials-cycled/i, /carbon-cycle/i],
  displayPatterns: [
    /how materials are cycled/i,
    /carbon cycle/i,
    /recycling (?:carbon|materials)/i,
    /nitrogen cycle/i,
  ],
  definition:
    "Material cycles recycle elements between living organisms and the environment; the carbon cycle moves carbon through photosynthesis, respiration, decomposition, and combustion.",
  whyItMatters:
    "Recycling materials sustains ecosystems and links living and non-living parts of the biosphere.",
  coreModel:
    "CO₂ in atmosphere → Photosynthesis (plants) → Carbon in organisms → Respiration / Decomposition / Combustion → CO₂ returned",
  keyExamples: [
    "Photosynthesis removes CO₂ from the atmosphere",
    "Respiration releases CO₂",
    "Decomposers recycle carbon from dead matter",
    "Combustion of fossil fuels returns CO₂",
  ],
  examVocabulary: [
    "carbon cycle",
    "photosynthesis",
    "respiration",
    "decomposer",
    "combustion",
    "carbon dioxide",
    "fossil fuels",
    "decay",
  ],
  keyWordsTerms: [
    "carbon cycle",
    "photosynthesis",
    "respiration",
    "decomposer",
    "combustion",
    "carbon dioxide",
    "fossil fuels",
    "decay",
    "recycle",
    "atmosphere",
  ],
  definitionMatchTerms: [
    "material cycles",
    "carbon cycle",
    "recycle",
    "photosynthesis",
    "respiration",
  ],
  whyMatchTerms: ["ecosystems", "biosphere", "sustains", "living", "why it matters", "matters"],
  coreModelMatchTerms: [
    "photosynthesis",
    "respiration",
    "decomposition",
    "combustion",
    "carbon dioxide",
    "co2",
    "atmosphere",
    "decomposer",
  ],
  examVocabMatchTerms: [
    "carbon cycle",
    "photosynthesis",
    "respiration",
    "decomposer",
    "combustion",
    "carbon dioxide",
    "fossil fuels",
    "decay",
  ],
};

/** Layer 2 — subject registries. Biology is the first implemented profile set. */
const SUBJECT_TEACHING_PROFILES = {
  biology: {
    subjectKey: "biology",
    label: "Biology",
    implemented: true,
    topicProfiles: [
      NERVOUS_SYSTEM_STRUCTURE_OPENING,
      THE_EYE_OPENING,
      HOMEOSTASIS_OPENING,
      REFLEX_ARC_OPENING,
      CELL_STRUCTURE_OPENING,
      CONTROL_BLOOD_GLUCOSE_OPENING,
      MITOSIS_CELL_CYCLE_OPENING,
      HOW_MATERIALS_CYCLED_OPENING,
    ],
  },
  chemistry: {
    subjectKey: "chemistry",
    label: "Chemistry",
    implemented: false,
    topicProfiles: [],
  },
  physics: {
    subjectKey: "physics",
    label: "Physics",
    implemented: false,
    topicProfiles: [],
  },
  maths: {
    subjectKey: "maths",
    label: "Maths",
    implemented: false,
    topicProfiles: [],
  },
  history: {
    subjectKey: "history",
    label: "History",
    implemented: false,
    topicProfiles: [],
  },
  geography: {
    subjectKey: "geography",
    label: "Geography",
    implemented: false,
    topicProfiles: [],
  },
  english: {
    subjectKey: "english",
    label: "English",
    implemented: false,
    topicProfiles: [],
  },
};

const SUBJECT_ALIASES = {
  biology: "biology",
  bio: "biology",
  chemistry: "chemistry",
  chem: "chemistry",
  physics: "physics",
  maths: "maths",
  mathematics: "maths",
  math: "maths",
  history: "history",
  geography: "geography",
  geo: "geography",
  english: "english",
};

function normalizeSubjectKey(subject = "") {
  const key = String(subject || "").trim().toLowerCase();
  return SUBJECT_ALIASES[key] || null;
}

function subjectKeyFromTopicKey(topicKey = "") {
  const raw = String(topicKey || "").trim().toLowerCase();
  if (!raw) return null;
  const match = raw.match(
    /-(biology|chemistry|physics|maths|mathematics|history|geography|english)(?::|$)/
  );
  return match ? normalizeSubjectKey(match[1]) : null;
}

function leafKeyFromTopicKey(topicKey = "") {
  const raw = String(topicKey || "").trim().toLowerCase();
  if (!raw) return "";
  const idx = raw.lastIndexOf(":");
  return idx >= 0 ? raw.slice(idx + 1) : raw;
}

/**
 * Resolve Layer 2 subject registry.
 * @param {object} [input]
 * @returns {SubjectTeachingProfile|null}
 */
function resolveSubjectTeachingProfile(input = {}) {
  const subjectKey =
    normalizeSubjectKey(input.subject) ||
    subjectKeyFromTopicKey(input.topicKey) ||
    normalizeSubjectKey(input.subjectKey);

  if (!subjectKey) return null;
  return SUBJECT_TEACHING_PROFILES[subjectKey] || null;
}

function findTopicProfileInSubject(subjectProfile, input = {}) {
  if (!subjectProfile?.implemented || !subjectProfile.topicProfiles?.length) {
    return null;
  }

  const leaf = leafKeyFromTopicKey(input.topicKey);
  const subTopic = String(input.subTopic || "").trim();
  const topic = String(input.topic || "").trim();

  if (input.taxonomyKey) {
    const byKey = subjectProfile.topicProfiles.find((p) => p.taxonomyKey === input.taxonomyKey);
    if (byKey) return byKey;
  }

  for (const profile of subjectProfile.topicProfiles) {
    if (leaf && profile.topicKeyPatterns.some((re) => re.test(leaf))) {
      return profile;
    }
  }

  for (const profile of subjectProfile.topicProfiles) {
    if (subTopic && profile.displayPatterns.some((re) => re.test(subTopic))) {
      return profile;
    }
    if (topic && profile.displayPatterns.some((re) => re.test(topic))) {
      return profile;
    }
  }

  const heuristic = matchTopicProfileHeuristic(topic || subTopic, subjectProfile);
  if (heuristic) return heuristic;

  return null;
}

/**
 * Fallback topic matching for generator display titles that do not match spec displayPatterns.
 * @param {string} label
 * @param {import("./teacherFirstKnowledgeProfiles").SubjectTeachingProfile} subjectProfile
 */
function matchTopicProfileHeuristic(label, subjectProfile) {
  if (!subjectProfile?.implemented || !subjectProfile.topicProfiles?.length) return null;
  const t = String(label || "")
    .toLowerCase()
    .replace(/[^\w\s:&-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;

  if (subjectProfile.subjectKey === "biology") {
    if (
      /nervous\s+system/.test(t) &&
      /structure|function|basic|basics|neurone|neuron|receptor|synapse|cns|pns|&/.test(t)
    ) {
      return (
        subjectProfile.topicProfiles.find((p) => p.taxonomyKey === "nervous-system-structure") ||
        null
      );
    }
    if (/^the eye$/.test(t) || (/\beye\b/.test(t) && /structure|vision|accommodation|cornea|retina/.test(t))) {
      return subjectProfile.topicProfiles.find((p) => p.taxonomyKey === "the-eye") || null;
    }
    if (/control of blood glucose|blood glucose concentration|blood glucose regulation/.test(t)) {
      return (
        subjectProfile.topicProfiles.find((p) => p.taxonomyKey === "control-blood-glucose") ||
        null
      );
    }
    if (/^reflex arc$|reflex arc pathway|the reflex arc/.test(t)) {
      return subjectProfile.topicProfiles.find((p) => p.taxonomyKey === "reflex-arc") || null;
    }
    if (/^cell structure$|structure of (?:animal|plant|bacterial )?cells/.test(t)) {
      return subjectProfile.topicProfiles.find((p) => p.taxonomyKey === "cell-structure") || null;
    }
    if (/mitosis|cell cycle/.test(t)) {
      return (
        subjectProfile.topicProfiles.find((p) => p.taxonomyKey === "mitosis-cell-cycle") || null
      );
    }
    if (/carbon cycle|how materials are cycled|recycling carbon/.test(t)) {
      return (
        subjectProfile.topicProfiles.find((p) => p.taxonomyKey === "how-materials-cycled") ||
        null
      );
    }
    if (/homeostasis|thermoregulation|body temperature/.test(t)) {
      return subjectProfile.topicProfiles.find((p) => p.taxonomyKey === "homeostasis") || null;
    }
  }

  return null;
}

/**
 * Resolve Layer 2 topic profile within a subject registry.
 * @param {object} [input]
 * @returns {TeacherFirstKnowledgeProfile|null}
 */
function resolveTeacherFirstKnowledgeProfile(input = {}) {
  if (input.profile) return input.profile;

  const { isRequiredPracticalMode } = require("./requiredPracticalMode");
  if (isRequiredPracticalMode(input)) return null;

  const subjectProfile = resolveSubjectTeachingProfile(input);
  if (!subjectProfile) return null;

  return findTopicProfileInSubject(subjectProfile, input);
}

module.exports = {
  UNIVERSAL_TEACHER_FIRST_FRAMEWORK,
  SUBJECT_TEACHING_PROFILES,
  HOMEOSTASIS_OPENING,
  NERVOUS_SYSTEM_STRUCTURE_OPENING,
  THE_EYE_OPENING,
  REFLEX_ARC_OPENING,
  CELL_STRUCTURE_OPENING,
  CONTROL_BLOOD_GLUCOSE_OPENING,
  MITOSIS_CELL_CYCLE_OPENING,
  HOW_MATERIALS_CYCLED_OPENING,
  OPENING_PROFILES: [
    NERVOUS_SYSTEM_STRUCTURE_OPENING,
    THE_EYE_OPENING,
    HOMEOSTASIS_OPENING,
    REFLEX_ARC_OPENING,
    CELL_STRUCTURE_OPENING,
    CONTROL_BLOOD_GLUCOSE_OPENING,
    MITOSIS_CELL_CYCLE_OPENING,
    HOW_MATERIALS_CYCLED_OPENING,
  ],
  normalizeSubjectKey,
  subjectKeyFromTopicKey,
  leafKeyFromTopicKey,
  resolveSubjectTeachingProfile,
  resolveTeacherFirstKnowledgeProfile,
  matchTopicProfileHeuristic,
};
