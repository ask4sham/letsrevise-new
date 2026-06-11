/**
 * Phase 5B.1 — Framework routing layer (read-only definitions).
 *
 * Maps Framework Classifier V1 `framework` keys to teaching-structure patterns.
 * Does NOT alter prompts, generation, or Teacher-First behaviour unless explicitly
 * Phase 5B.3 adds prompt appendix + metadata attachment (flag-gated).
 * Phase 5B.3c adds mandatory framework-native teaching moves to the appendix.
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

const FRAMEWORK_ROUTING_VERSION = "5B.3c";

const FRAMEWORK_ROUTING_APPENDIX_MARKER = "FRAMEWORK ROUTING (Phase 5B.3c):";

/** Mandatory teaching moves per framework (prompt-only; no block-order change). */
const FRAMEWORK_TEACHING_MOVES = Object.freeze({
  signal_pathway: Object.freeze([
    "Identify stimulus and receptor location.",
    "State impulse direction along named neurones or hormone route.",
    "Name each component in order (receptor → sensory → coordination → motor → effector).",
    "Explain the role of each component in the pathway.",
    "Explain what happens if one component fails.",
    "Link the pathway to survival and exam command words (Describe / Explain sequence).",
  ]),
  structure_function: Object.freeze([
    "Identify the structure (label or name the part).",
    "State the adaptation (shape, surface area, length, insulation).",
    'Link adaptation to function ("allows / enables / speeds").',
    "Explain the consequence if the structure is absent or damaged.",
    "Compare with an alternative structure (e.g. myelinated vs unmyelinated).",
    "Exam: structure → function bullet for marks.",
  ]),
  system_flow: Object.freeze([
    "Identify the entry point into the system (e.g. food, blood, stimulus).",
    "Trace the journey through named components in order.",
    "State what changes at each component.",
    "Identify the output or exit from the system.",
    "Explain what happens if one stage is blocked.",
    "Exam: Describe the pathway through the system.",
  ]),
  comparison: Object.freeze([
    "State one similarity (same feature or process).",
    "State one difference (contrasting feature).",
    "Use an explicit linker (whereas / however / unlike).",
    "Link the difference to function or exam context.",
    "Avoid listing features without pairing.",
    "Exam: Compare X and Y (tabulate mentally: feature | A | B).",
  ]),
  classification: Object.freeze([
    "State the grouping criterion (feature used to sort).",
    "Name groups or levels (e.g. kingdom, pathogen type).",
    "Assign an example to a group with justification.",
    "Explain why the criterion matters biologically.",
    "Common mistake: group by appearance not feature.",
    "Exam: Classify / Group / Identify type.",
  ]),
  cause_effect: Object.freeze([
    "Identify the initial cause or trigger.",
    "Mechanism step 1 → step 2 (because / therefore).",
    "State the short-term effect.",
    "State the longer-term or wider consequence.",
    "Human or ecosystem relevance where applicable.",
    "Exam: Explain how X leads to Y (causal chain marks).",
  ]),
  cellular_sequence: Object.freeze([
    "State the purpose of the process (growth / repair / division / variation).",
    "Order stages correctly (e.g. interphase → PMAT → cytokinesis).",
    "State what happens at each stage (chromosomes, cytoplasm).",
    "State the number and genetic identity of daughter cells.",
    "Contrast with a related process (mitosis vs meiosis) if in spec.",
    "Exam: Describe the stages of…",
  ]),
  cycle_pathway: Object.freeze([
    "Name stores or reservoirs (atmosphere, plants, animals, soil, fossil).",
    "Name processes moving material (photosynthesis, respiration, decomposition, combustion).",
    "Trace one atom or molecule round the cycle.",
    "Show return to the starting reservoir (circular logic).",
    "Human activity effect on one process.",
    "Exam: Explain how carbon / water / nitrogen is recycled.",
  ]),
  feedback_loop: Object.freeze([
    "State the normal set point or optimum.",
    "Identify the disturbance (stimulus moving away from set point).",
    "Name the receptor detecting the change.",
    "Name the coordination centre processing information.",
    "Name the effector and corrective mechanism.",
    "Explain return toward set point and negative-feedback switch-off.",
    "Exam: Explain control of [glucose / temperature / osmosis].",
  ]),
  practical_method: Object.freeze([
    "State the investigation question.",
    "Independent, dependent, and control variables.",
    "Method steps in logical order.",
    "How to ensure fair test and reliability (repeat, control).",
    "Process results (mean, graph, units).",
    "Evaluate the method (accuracy, anomalies, improvements).",
  ]),
  inheritance_model: Object.freeze([
    "Define allele and where it is found.",
    "Parent genotypes → gametes produced.",
    "Combine gametes (Punnett / probability logic).",
    "Offspring genotype and phenotype.",
    "Dominant / recessive / heterozygous language.",
    "Exam: Explain inheritance of [trait].",
  ]),
  application_comparison: Object.freeze([
    "Name application options (methods / treatments / techniques).",
    "Mechanism of each briefly.",
    "Advantage of each.",
    "Limitation or risk of each.",
    "Context for choosing one (effectiveness, ethics, cost).",
    "Exam: Compare methods / Evaluate use of…",
  ]),
  data_interpretation: Object.freeze([
    "State what the data shows (trend / pattern).",
    "Identify evidence type (fossil, antibiotic resistance graph, etc.).",
    "What the evidence supports.",
    "Limitation or alternative explanation.",
    "Strength of conclusion (correlation vs causation).",
    "Exam: Evaluate evidence for… / Use data to explain…",
  ]),
});

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
function formatTeachingMovesSection(framework) {
  const moves = FRAMEWORK_TEACHING_MOVES[framework];
  if (!moves?.length) return "";

  const lines = [
    "MANDATORY TEACHING MOVES (framework-native — within existing blocks):",
    "",
    ...moves.map((move, i) => `${i + 1}. ${move}`),
  ];

  if (framework === "practical_method") {
    lines.push(
      "",
      "When Required Practical mode is active, follow the RP V2.2 specialist shell first; these moves supplement only where gaps remain."
    );
  }

  return lines.join("\n");
}

function formatFrameworkRoutingAppendix(plan) {
  if (!plan) return "";

  const teachingMoves = formatTeachingMovesSection(plan.framework);
  const lines = [
    FRAMEWORK_ROUTING_APPENDIX_MARKER,
    "",
    `Framework: ${plan.framework}`,
    "",
    "OPENING PATTERN:",
    plan.openingPattern,
    "",
    "TEACHING PATTERN:",
    plan.teachingPattern,
  ];

  if (teachingMoves) {
    lines.push("", teachingMoves);
  }

  lines.push(
    "",
    "VISUAL PATTERN:",
    plan.visualPattern,
    "",
    "REASONING PATTERN:",
    plan.reasoningPattern,
    "",
    "PROMPT-ONLY: Apply opening, teaching, visual, and reasoning patterns plus mandatory moves to vocabulary and reasoning within existing blocks.",
    "Do NOT change the mandated Teacher-First block order, section titles, or Required Practical shell."
  );

  return lines.join("\n");
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
  FRAMEWORK_TEACHING_MOVES,
  FRAMEWORK_ROUTING_TABLE,
  FRAMEWORK_ROUTING_KEYS,
  formatTeachingMovesSection,
  isFrameworkRoutingEnabled,
  buildFrameworkRoutingPlan,
  resolveFrameworkRouting,
  resolveFrameworkRoutingFromClassification,
  listFrameworkRoutingDefinitions,
  formatFrameworkRoutingAppendix,
  buildFrameworkRoutingPromptSection,
};
