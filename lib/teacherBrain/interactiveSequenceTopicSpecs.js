/**
 * Topic-specific interactive sequence (step-by-step) briefs.
 */

const BRIEF_MARKER = "--- TEACHER BRAIN DESIGN BRIEF ---";

/** @type {Record<string, { briefHeader: string, title: string, sequence: string[], studentQuestions: string[], teachingNote: string }>} */
const SEQUENCE_SPECS = {
  reflexArc: {
    briefHeader: "REFLEX ARC STEP-BY-STEP BRIEF",
    title: "The Reflex Arc — Stimulus to Response",
    sequence: [
      "Stimulus detected by receptor",
      "Sensory neurone carries impulse to spinal cord",
      "Relay neurone passes impulse across synapse",
      "Motor neurone carries impulse to effector",
      "Effector produces response",
    ],
    studentQuestions: [
      "Where is the impulse passed across a synapse?",
      "Why is the spinal cord involved?",
      "Why is the response rapid and automatic?",
      "Which part acts as the effector?",
    ],
    teachingNote:
      "Use GCSE AQA sequence language: stimulus → receptor → sensory neurone → relay neurone → motor neurone → effector → response",
  },
  brain: {
    briefHeader: "NERVOUS SYSTEM STEP-BY-STEP BRIEF",
    title: "Nervous System Response Pathway",
    sequence: [
      "Stimulus detected by receptor",
      "Electrical impulse travels along sensory neurone",
      "CNS processes the information",
      "Motor neurone carries impulse to effector",
      "Effector produces response",
    ],
    studentQuestions: [
      "What is the role of the CNS in this pathway?",
      "How does a motor neurone differ from a sensory neurone?",
      "Give one example of an effector.",
      "Why must impulses travel in one direction along a neurone?",
    ],
    teachingNote:
      "Link structure to function: receptors detect, neurones conduct, CNS coordinates, effectors respond.",
  },
  homeostasis: {
    briefHeader: "HOMEOSTASIS STEP-BY-STEP BRIEF",
    title: "Homeostasis — Detect, Process, Correct",
    sequence: [
      "Change in internal condition detected (receptor / sensor)",
      "Information sent to coordination centre (CNS or gland)",
      "Corrective mechanism activated (effector response)",
      "Internal condition returned towards set point",
      "Negative feedback reduces the original stimulus",
    ],
    studentQuestions: [
      "What is meant by the set point?",
      "Why is this an example of negative feedback?",
      "Name the receptor and effector in your example system.",
      "What would happen if the corrective response overshot the set point?",
    ],
    teachingNote:
      "Emphasise coordination: detect → process → respond → restore balance. Use precise AQA vocabulary.",
  },
  mitosis: {
    briefHeader: "MITOSIS STEP-BY-STEP BRIEF",
    title: "Mitosis — Cell Division for Growth and Repair",
    sequence: [
      "DNA replicates so each chromosome consists of two identical chromatids",
      "Chromosomes condense and become visible",
      "Chromosomes line up at the centre of the cell",
      "Chromatids pulled to opposite poles of the cell",
      "Two genetically identical daughter cells form",
    ],
    studentQuestions: [
      "Why must DNA replicate before mitosis begins?",
      "How many daughter cells are produced?",
      "Why are the daughter cells genetically identical?",
      "Where in the body does mitosis occur continuously?",
    ],
    teachingNote:
      "Use stage order clearly; distinguish mitosis from cell growth (increase in cytoplasm) where relevant.",
  },
  digestion: {
    briefHeader: "DIGESTION STEP-BY-STEP BRIEF",
    title: "Digestion — From Food to Absorbed Nutrients",
    sequence: [
      "Food ingested and mechanically broken down (e.g. teeth, churning)",
      "Chemical digestion by enzymes produces smaller soluble molecules",
      "Absorption of small molecules through the wall of the small intestine",
      "Assimilation into body cells for growth, repair, or respiration",
      "Indigestible material eliminated as faeces",
    ],
    studentQuestions: [
      "Where are most molecules absorbed?",
      "What is the difference between digestion and absorption?",
      "Name one digestive enzyme and its product.",
      "Why is mechanical digestion still important?",
    ],
    teachingNote:
      "Trace the journey through the alimentary canal; link enzymes to specific locations where appropriate.",
  },
  photosynthesis: {
    briefHeader: "PHOTOSYNTHESIS STEP-BY-STEP BRIEF",
    title: "Photosynthesis — Light Energy to Glucose",
    sequence: [
      "Light absorbed by chlorophyll in chloroplasts",
      "Water split — oxygen released as a by-product",
      "Energy transferred to combine carbon dioxide and water",
      "Glucose produced (and may be converted to starch for storage)",
      "Glucose used in respiration or for growth (e.g. cellulose, proteins)",
    ],
    studentQuestions: [
      "What are the two main reactants in photosynthesis?",
      "Why do plants need light for this process?",
      "What happens to the glucose produced?",
      "How is photosynthesis linked to food chains?",
    ],
    teachingNote:
      "Word equations and balanced symbol equations at Higher tier; stress energy transfer, not energy creation.",
  },
};

/**
 * @param {string} topicKind
 * @returns {typeof SEQUENCE_SPECS[string] | null}
 */
function getInteractiveSequenceTopicSpec(topicKind) {
  if (!topicKind || topicKind === "generic" || topicKind === "metabolism") return null;
  return SEQUENCE_SPECS[topicKind] || null;
}

/**
 * @param {typeof SEQUENCE_SPECS[string]} spec
 */
function formatInteractiveSequenceTopicBrief(spec) {
  return [
    BRIEF_MARKER,
    "",
    spec.briefHeader,
    "",
    `Title:\n${spec.title}`,
    "",
    "Sequence:",
    spec.sequence.map((step, i) => `${i + 1}. ${step}`).join("\n"),
    "",
    "Student Questions:",
    spec.studentQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
    "",
    `Teaching note:\n${spec.teachingNote}`,
    "",
    "Do NOT use placeholder step images. One clear visual per step or one multi-step board diagram.",
  ].join("\n");
}

module.exports = {
  BRIEF_MARKER,
  SEQUENCE_SPECS,
  getInteractiveSequenceTopicSpec,
  formatInteractiveSequenceTopicBrief,
};
