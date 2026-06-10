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

/** Layer 2 — subject registries. Biology is the first implemented profile set. */
const SUBJECT_TEACHING_PROFILES = {
  biology: {
    subjectKey: "biology",
    label: "Biology",
    implemented: true,
    topicProfiles: [NERVOUS_SYSTEM_STRUCTURE_OPENING, THE_EYE_OPENING, HOMEOSTASIS_OPENING],
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
    if (/homeostasis|thermoregulation|blood glucose|body temperature/.test(t)) {
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
  OPENING_PROFILES: [
    NERVOUS_SYSTEM_STRUCTURE_OPENING,
    THE_EYE_OPENING,
    HOMEOSTASIS_OPENING,
  ],
  normalizeSubjectKey,
  subjectKeyFromTopicKey,
  leafKeyFromTopicKey,
  resolveSubjectTeachingProfile,
  resolveTeacherFirstKnowledgeProfile,
  matchTopicProfileHeuristic,
};
