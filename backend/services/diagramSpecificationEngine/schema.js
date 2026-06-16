/**
 * P3.0A — Diagram Specification Engine schema (foundation only).
 *
 * A DiagramSpecification is the source of truth for diagram content and
 * interaction intent. Image providers, prompt composers, and lesson blocks
 * are downstream consumers — not the spec itself.
 */

const SCHEMA_VERSION = "3.0a";

/** @readonly */
const DIAGRAM_TYPES = Object.freeze([
  "hotspot", // click-to-reveal regions on a single image
  "process", // ordered stages / pathway with arrows
  "labelled", // static labelled anatomical or conceptual diagram
  "practical-setup", // required practical apparatus and procedure setup
  "compare-contrast", // side-by-side or before/after comparison
  "flowchart", // decision or process flow with branches
]);

/** @readonly */
const INTERACTION_TYPES = Object.freeze([
  "view", // static display
  "hotspot", // interactiveDiagram
  "drag-drop", // dragDropMatch (text or diagram mode)
  "tti", // text-to-image drag-drop match
  "label-overlay", // draggable or revealable labels on diagram
  "exam-question", // MCQ / short answer derived from spec labels
]);

/** @readonly */
const DIFFICULTY_LEVELS = Object.freeze(["foundation", "standard", "higher"]);

/** @readonly */
const EXAM_BOARDS = Object.freeze(["AQA", "Edexcel", "OCR", "WJEC", "CCEA", "Other"]);

/** @readonly */
const ORIENTATIONS = Object.freeze(["landscape", "portrait", "square"]);

/** @readonly */
const FLOW_DIRECTIONS = Object.freeze([
  "left-to-right",
  "right-to-left",
  "top-to-bottom",
  "bottom-to-top",
  "radial",
  "none",
]);

/** @readonly */
const LABEL_ROLES = Object.freeze([
  "structure",
  "process-step",
  "input",
  "output",
  "measurement",
  "control-variable",
  "annotation",
]);

/**
 * P3.0C — Cognitive task type for drag-and-drop / TTI activities.
 * Controls image brief strategy (what appears on image vs concept cards).
 * @readonly
 */
const ACTIVITY_PEDAGOGY_TYPES = Object.freeze([
  "structure-to-function",
  "function-to-structure",
  "label-to-structure",
  "process-step-to-order",
  "cause-to-effect",
  "variable-to-definition",
]);

/** Topics that require numbered hotspot mapping (not alignment-only). @readonly */
const COMPLEX_ANATOMY_TOPIC_HINTS = Object.freeze([
  "brain",
  "eye",
  "heart",
  "nephron",
  "reflex",
  "endocrine",
  "hormonal",
]);

/**
 * @typedef {object} DiagramSpecLayout
 * @property {string} orientation — landscape | portrait | square
 * @property {string} [flow] — primary process direction
 * @property {string} [processType] — e.g. pathway, reactants-to-products, practical-setup
 * @property {string} [composition] — e.g. single-panel, multi-panel, inset-detail
 * @property {string[]} [regions] — named layout regions for hotspot/drag-drop placement
 * @property {boolean} [complexAnatomy] — use numbered hotspot mapping rule (brain, eye, heart, etc.)
 */

/**
 * @typedef {object} DiagramSpecLabel
 * @property {string} id — stable slug within spec (e.g. "sensory-neurone")
 * @property {string} text — display label (typically UPPERCASE for GCSE diagrams)
 * @property {string} [role] — one of LABEL_ROLES
 * @property {number} [order] — sequence for process/flow diagrams
 * @property {boolean} [required=true] — must appear on final diagram
 * @property {boolean} [examinable=true] — may be tested in exam questions
 * @property {string} [mapsTo] — what structure or concept this label identifies
 * @property {string} [hotspotId] — letter id (A, B, C…) linking to activity seed
 * @property {string} [description] — student-facing explanation when revealed
 */

/**
 * @typedef {object} DiagramSpecHotspotSeed
 * @property {string} id — letter or slug (A, B, C…)
 * @property {string} labelId — references DiagramSpecLabel.id
 * @property {string} [region] — layout region hint before x/y placement
 */

/**
 * @typedef {object} DiagramSpecDragDropSeed
 * @property {string} pairId
 * @property {string} prompt — card text
 * @property {string} labelId — correct label reference
 * @property {string} [dropZoneId]
 */

/**
 * @typedef {object} DiagramSpecExamQuestionSeed
 * @property {string} id
 * @property {string} type — mcq | short-answer | label-order
 * @property {string} prompt
 * @property {string[]} [labelIds] — labels tested
 * @property {string} [correctAnswer]
 * @property {string[]} [options]
 */

/**
 * @typedef {object} DiagramSpecActivities
 * @property {DiagramSpecHotspotSeed[]} [hotspots]
 * @property {DiagramSpecDragDropSeed[]} [dragDrop]
 * @property {DiagramSpecExamQuestionSeed[]} [examQuestions]
 */

/**
 * @typedef {object} DiagramSpecVisualStyle
 * @property {boolean} [examDiagram]
 * @property {boolean} [whiteBackground]
 * @property {boolean} [flatVector]
 * @property {boolean} [highContrast]
 * @property {boolean} [uppercaseLabels]
 * @property {boolean} [minimalColour]
 * @property {boolean} [letsReviseFrame]
 */

/**
 * @typedef {object} DiagramSpecification
 * @property {string} schemaVersion — must be "3.0a"
 * @property {string} id — stable slug (e.g. "reflex-arc")
 * @property {string} subject — e.g. "GCSE Biology"
 * @property {string} examBoard — AQA, Edexcel, …
 * @property {string} tier — Foundation | Higher
 * @property {string} topic — lesson topic name
 * @property {string} [subtopic]
 * @property {string} learningGoal — what the student must understand after viewing
 * @property {string} diagramType — one of DIAGRAM_TYPES
 * @property {string[]} interactionTypes — intended downstream activity modes
 * @property {string} [activityPedagogyType] — cognitive task (required for drag-drop / tti)
 * @property {string[]} [imageElements] — visual elements on image (not card text)
 * @property {string[]} [conceptCards] — draggable card text (never rendered in image)
 * @property {string} title — diagram title for display and image brief
 * @property {string} [instruction] — image-provider brief (optional; derived from spec if omitted)
 * @property {string[]} [examFocus] — examinable skills or command words
 * @property {string} [difficulty] — foundation | standard | higher
 * @property {string} [teacherNotes] — teacher-only design notes
 * @property {DiagramSpecLabel[]} labels
 * @property {DiagramSpecLayout} layout
 * @property {DiagramSpecActivities} [activities]
 * @property {DiagramSpecVisualStyle} [visualStyle]
 * @property {string} [status] — draft | validated
 */

module.exports = {
  SCHEMA_VERSION,
  DIAGRAM_TYPES,
  INTERACTION_TYPES,
  ACTIVITY_PEDAGOGY_TYPES,
  COMPLEX_ANATOMY_TOPIC_HINTS,
  DIFFICULTY_LEVELS,
  EXAM_BOARDS,
  ORIENTATIONS,
  FLOW_DIRECTIONS,
  LABEL_ROLES,
};
