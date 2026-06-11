/**
 * Phase 5B.1 — Framework routing layer (read-only definitions).
 *
 * Maps Framework Classifier V1 `framework` keys to teaching-structure patterns.
 * Does NOT alter prompts, generation, or Teacher-First behaviour unless explicitly
 * Phase 5B.3 adds prompt appendix + metadata attachment (flag-gated).
 * Does not change block order, Teacher-First shell, or post-processing.
 *
 * Flag: TEACHER_BRAIN_FRAMEWORK_ROUTING=1 (default OFF)
 */

/** @typedef {keyof typeof FRAMEWORK_ROUTING_TABLE} FrameworkRoutingKey */

/**
 * @typedef {object} FrameworkRoutingPlan
 * @property {string} framework
 * @property {string} openingPattern
 * @property {string} teachingPattern
 * @property {string} visualPattern
 * @property {string} reasoningPattern
 */

const FRAMEWORK_ROUTING_VERSION = "5B.3";

const FRAMEWORK_ROUTING_APPENDIX_MARKER = "FRAMEWORK ROUTING (Phase 5B.3):";

const FRAMEWORK_ROUTING_TABLE = Object.freeze({
  signal_pathway: Object.freeze({
    openingPattern: "PATHWAY_FIRST",
    teachingPattern: "FOLLOW_THE_SIGNAL",
    visualPattern: "SIGNAL_FLOW_MAP",
    reasoningPattern: "STEP_BY_STEP_CAUSAL",
  }),
  structure_function: Object.freeze({
    openingPattern: "STRUCTURE_FIRST",
    teachingPattern: "STRUCTURE_TO_FUNCTION",
    visualPattern: "LABELLED_STRUCTURE_MAP",
    reasoningPattern: "ADAPTATION_REASONING",
  }),
  system_flow: Object.freeze({
    openingPattern: "SYSTEM_JOURNEY",
    teachingPattern: "FOLLOW_THE_PROCESS",
    visualPattern: "SYSTEM_FLOW_MAP",
    reasoningPattern: "FLOW_REASONING",
  }),
  comparison: Object.freeze({
    openingPattern: "COMPARE_FIRST",
    teachingPattern: "SIMILARITIES_AND_DIFFERENCES",
    visualPattern: "COMPARISON_GRID",
    reasoningPattern: "COMPARATIVE_REASONING",
  }),
  classification: Object.freeze({
    openingPattern: "GROUPING_FIRST",
    teachingPattern: "CLASSIFY_AND_JUSTIFY",
    visualPattern: "CLASSIFICATION_GRID",
    reasoningPattern: "TAXONOMY_REASONING",
  }),
  cause_effect: Object.freeze({
    openingPattern: "CAUSE_FIRST",
    teachingPattern: "CHAIN_OF_CONSEQUENCES",
    visualPattern: "CAUSE_EFFECT_CHAIN",
    reasoningPattern: "CAUSAL_REASONING",
  }),
  cellular_sequence: Object.freeze({
    openingPattern: "SEQUENCE_FIRST",
    teachingPattern: "STAGE_BY_STAGE",
    visualPattern: "SEQUENCE_MAP",
    reasoningPattern: "PROCESS_REASONING",
  }),
  cycle_pathway: Object.freeze({
    openingPattern: "CYCLE_FIRST",
    teachingPattern: "FOLLOW_THE_CYCLE",
    visualPattern: "CYCLE_MAP",
    reasoningPattern: "CIRCULAR_REASONING",
  }),
  feedback_loop: Object.freeze({
    openingPattern: "CONTROL_SYSTEM_FIRST",
    teachingPattern: "DETECT_CORRECT_RETURN",
    visualPattern: "FEEDBACK_LOOP",
    reasoningPattern: "CONTROL_REASONING",
  }),
  practical_method: Object.freeze({
    openingPattern: "INVESTIGATION_FIRST",
    teachingPattern: "METHOD_AND_REASONING",
    visualPattern: "PRACTICAL_FLOW",
    reasoningPattern: "EXPERIMENTAL_REASONING",
  }),
  inheritance_model: Object.freeze({
    openingPattern: "GENETIC_FLOW_FIRST",
    teachingPattern: "ALLELE_TO_OUTCOME",
    visualPattern: "INHERITANCE_FLOW",
    reasoningPattern: "GENETIC_REASONING",
  }),
  application_comparison: Object.freeze({
    openingPattern: "OPTIONS_FIRST",
    teachingPattern: "COMPARE_APPLICATIONS",
    visualPattern: "APPLICATION_GRID",
    reasoningPattern: "DECISION_REASONING",
  }),
  data_interpretation: Object.freeze({
    openingPattern: "EVIDENCE_FIRST",
    teachingPattern: "INTERPRET_AND_EVALUATE",
    visualPattern: "EVIDENCE_GRID",
    reasoningPattern: "EVIDENCE_REASONING",
  }),
});

const FRAMEWORK_ROUTING_KEYS = Object.freeze(Object.keys(FRAMEWORK_ROUTING_TABLE));

function isFrameworkRoutingEnabled() {
  return String(process.env.TEACHER_BRAIN_FRAMEWORK_ROUTING || "0").trim() === "1";
}

function normalizeFrameworkKey(framework) {
  return framework === undefined || framework === null ? "" : String(framework).trim();
}

/**
 * @param {string} framework
 * @returns {FrameworkRoutingPlan|null}
 */
function buildFrameworkRoutingPlan(framework) {
  const key = normalizeFrameworkKey(framework);
  const row = FRAMEWORK_ROUTING_TABLE[key];
  if (!row) return null;

  return {
    framework: key,
    openingPattern: row.openingPattern,
    teachingPattern: row.teachingPattern,
    visualPattern: row.visualPattern,
    reasoningPattern: row.reasoningPattern,
  };
}

/**
 * Resolve routing for a classifier framework key.
 * Returns null when the flag is OFF or the framework is unmapped.
 *
 * @param {string} framework
 * @returns {FrameworkRoutingPlan|null}
 */
function resolveFrameworkRouting(framework) {
  if (!isFrameworkRoutingEnabled()) return null;
  return buildFrameworkRoutingPlan(framework);
}

/**
 * @param {{ framework?: string }|string|null|undefined} input
 * @returns {FrameworkRoutingPlan|null}
 */
function resolveFrameworkRoutingFromClassification(input) {
  if (!isFrameworkRoutingEnabled()) return null;
  if (input === null || input === undefined) return null;
  if (typeof input === "string") return buildFrameworkRoutingPlan(input);
  return buildFrameworkRoutingPlan(input.framework);
}

/**
 * Audit helper — all defined routing rows (ignores feature flag).
 * @returns {FrameworkRoutingPlan[]}
 */
function listFrameworkRoutingDefinitions() {
  return FRAMEWORK_ROUTING_KEYS.map((framework) => buildFrameworkRoutingPlan(framework));
}

/**
 * Prompt-only appendix for framework-native teaching emphasis.
 * Does not alter block order or Teacher-First architecture.
 *
 * @param {FrameworkRoutingPlan|null|undefined} plan
 * @returns {string}
 */
function formatFrameworkRoutingAppendix(plan) {
  if (!plan) return "";

  return [
    FRAMEWORK_ROUTING_APPENDIX_MARKER,
    "",
    `Framework: ${plan.framework}`,
    "",
    "OPENING PATTERN:",
    plan.openingPattern,
    "",
    "TEACHING PATTERN:",
    plan.teachingPattern,
    "",
    "VISUAL PATTERN:",
    plan.visualPattern,
    "",
    "REASONING PATTERN:",
    plan.reasoningPattern,
    "",
    "PROMPT-ONLY: Use these patterns to shape vocabulary and reasoning emphasis within existing blocks.",
    "Do NOT change the mandated Teacher-First block order, section titles, or Required Practical shell.",
  ].join("\n");
}

/**
 * Resolve routing from classifier output and return prompt appendix when flag ON.
 *
 * @param {{ framework?: string }|string|null|undefined} classification
 * @returns {string}
 */
function buildFrameworkRoutingPromptSection(classification) {
  const plan = resolveFrameworkRoutingFromClassification(classification);
  if (!plan) return "";
  return formatFrameworkRoutingAppendix(plan);
}

module.exports = {
  FRAMEWORK_ROUTING_VERSION,
  FRAMEWORK_ROUTING_APPENDIX_MARKER,
  FRAMEWORK_ROUTING_TABLE,
  FRAMEWORK_ROUTING_KEYS,
  isFrameworkRoutingEnabled,
  buildFrameworkRoutingPlan,
  resolveFrameworkRouting,
  resolveFrameworkRoutingFromClassification,
  listFrameworkRoutingDefinitions,
  formatFrameworkRoutingAppendix,
  buildFrameworkRoutingPromptSection,
};
