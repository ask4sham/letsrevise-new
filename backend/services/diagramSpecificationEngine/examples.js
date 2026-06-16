/**
 * P3.0A — Canonical diagram specification examples.
 * Each example validates against schema v3.0a.
 */
const { SCHEMA_VERSION } = require("./schema");

/** @type {import("./schema").DiagramSpecification} */
const REFLEX_ARC_SPEC = {
  schemaVersion: SCHEMA_VERSION,
  id: "reflex-arc",
  subject: "GCSE Biology",
  examBoard: "AQA",
  tier: "Higher",
  topic: "Structure and Function of the Nervous System",
  subtopic: "Reflex Arc",
  learningGoal:
    "Students can describe the ordered components of a reflex arc and the direction of nerve impulse transmission from stimulus to response.",
  diagramType: "process",
  interactionTypes: ["view", "hotspot", "drag-drop", "exam-question"],
  title: "Reflex Arc Pathway",
  instruction:
    "Exam-ready labelled pathway diagram from stimulus to response. Show receptor, sensory neurone, relay neurone in spinal cord cross-section, motor neurone, and effector with impulse direction arrows.",
  examFocus: [
    "Name components of the reflex arc in order",
    "Explain why reflexes are rapid and involuntary",
    "Identify the role of the spinal cord as coordinator",
  ],
  difficulty: "higher",
  teacherNotes:
    "Prefer left-to-right pathway with spinal cord central. Colour-code neurone types. Hotspot letters A–H map to drag-drop cards in a follow-up activity.",
  labels: [
    { id: "stimulus", text: "STIMULUS", role: "process-step", order: 1, hotspotId: "A", mapsTo: "sharp object or change detected" },
    { id: "receptor", text: "RECEPTOR", role: "structure", order: 2, hotspotId: "B", mapsTo: "receptor cell in skin" },
    { id: "sensory-neurone", text: "SENSORY NEURONE", role: "process-step", order: 3, hotspotId: "C", mapsTo: "carries impulse to CNS" },
    { id: "relay-neurone", text: "RELAY NEURONE", role: "process-step", order: 4, hotspotId: "D", mapsTo: "synapse in spinal cord grey matter" },
    { id: "spinal-cord", text: "SPINAL CORD", role: "structure", order: 5, hotspotId: "E", mapsTo: "CNS coordinator" },
    { id: "motor-neurone", text: "MOTOR NEURONE", role: "process-step", order: 6, hotspotId: "F", mapsTo: "carries impulse to effector" },
    { id: "effector", text: "EFFECTOR", role: "structure", order: 7, hotspotId: "G", mapsTo: "muscle or gland" },
    { id: "response", text: "RESPONSE", role: "process-step", order: 8, hotspotId: "H", mapsTo: "muscle contraction or gland secretion" },
  ],
  layout: {
    orientation: "landscape",
    flow: "left-to-right",
    processType: "pathway",
    composition: "single-panel",
    regions: ["stimulus-site", "spinal-cord", "effector-site"],
  },
  activities: {
    hotspots: [
      { id: "A", labelId: "stimulus", region: "stimulus-site" },
      { id: "B", labelId: "receptor", region: "stimulus-site" },
      { id: "C", labelId: "sensory-neurone", region: "stimulus-site" },
      { id: "D", labelId: "relay-neurone", region: "spinal-cord" },
      { id: "E", labelId: "spinal-cord", region: "spinal-cord" },
      { id: "F", labelId: "motor-neurone", region: "effector-site" },
      { id: "G", labelId: "effector", region: "effector-site" },
      { id: "H", labelId: "response", region: "effector-site" },
    ],
    dragDrop: [
      { pairId: "dd-1", prompt: "Carries impulse from receptor to CNS", labelId: "sensory-neurone" },
      { pairId: "dd-2", prompt: "Connects neurones inside the spinal cord", labelId: "relay-neurone" },
      { pairId: "dd-3", prompt: "Muscle or gland that produces the response", labelId: "effector" },
    ],
    examQuestions: [
      {
        id: "eq-order",
        type: "label-order",
        prompt: "Place these in the correct order for a reflex arc: relay neurone, receptor, motor neurone, stimulus.",
        labelIds: ["stimulus", "receptor", "relay-neurone", "motor-neurone"],
        correctAnswer: "stimulus → receptor → relay neurone → motor neurone",
      },
    ],
  },
  visualStyle: {
    examDiagram: true,
    whiteBackground: true,
    flatVector: true,
    highContrast: true,
    uppercaseLabels: true,
    minimalColour: true,
    letsReviseFrame: true,
  },
  status: "validated",
};

/** @type {import("./schema").DiagramSpecification} */
const REACTION_TIME_PRACTICAL_SPEC = {
  schemaVersion: SCHEMA_VERSION,
  id: "reaction-time-practical",
  subject: "GCSE Biology",
  examBoard: "AQA",
  tier: "Higher",
  topic: "Required Practical — Reaction Time",
  subtopic: "Ruler Drop Method",
  learningGoal:
    "Students can describe the ruler-drop setup, identify key measurements, and explain how reaction time is derived from drop distance.",
  diagramType: "practical-setup",
  interactionTypes: ["view", "hotspot", "drag-drop", "tti", "exam-question"],
  title: "Reaction Time — Ruler Drop Method",
  instruction:
    "Vertical cm ruler with 0 cm at bottom aligned with top of catcher's thumb (AQA convention). Show dropper hand, catcher hand, drop distance, and how reaction time is calculated.",
  examFocus: [
    "Describe the ruler-drop method",
    "Identify control variables",
    "Explain how drop distance relates to reaction time",
  ],
  difficulty: "standard",
  teacherNotes:
    "AQA uses 0 cm at thumb. Include repeats and mean calculation in a side panel if multi-panel layout is used.",
  labels: [
    { id: "ruler", text: "RULER", role: "structure", order: 1, hotspotId: "A", mapsTo: "vertical centimetre ruler" },
    { id: "zero-mark", text: "ZERO MARK", role: "measurement", order: 2, hotspotId: "B", mapsTo: "0 cm aligned with thumb top" },
    { id: "catchers-hand", text: "CATCHER'S HAND", role: "structure", order: 3, hotspotId: "C", mapsTo: "hand ready to catch" },
    { id: "drop-distance", text: "DROP DISTANCE", role: "measurement", order: 4, hotspotId: "D", mapsTo: "distance fallen in cm" },
    { id: "reaction-time", text: "REACTION TIME", role: "measurement", order: 5, hotspotId: "E", mapsTo: "derived from drop distance" },
    { id: "repeats", text: "REPEATS", role: "annotation", order: 6, hotspotId: "F", mapsTo: "repeat readings and calculate mean" },
  ],
  layout: {
    orientation: "portrait",
    flow: "top-to-bottom",
    processType: "practical-setup",
    composition: "single-panel",
    regions: ["ruler", "hands", "calculation-panel"],
  },
  activities: {
    hotspots: [
      { id: "A", labelId: "ruler", region: "ruler" },
      { id: "B", labelId: "zero-mark", region: "ruler" },
      { id: "C", labelId: "catchers-hand", region: "hands" },
      { id: "D", labelId: "drop-distance", region: "ruler" },
      { id: "E", labelId: "reaction-time", region: "calculation-panel" },
      { id: "F", labelId: "repeats", region: "calculation-panel" },
    ],
    dragDrop: [
      { pairId: "dd-1", prompt: "Aligned with the top of the thumb", labelId: "zero-mark" },
      { pairId: "dd-2", prompt: "Distance the ruler falls before being caught", labelId: "drop-distance" },
      { pairId: "dd-3", prompt: "Calculated from drop distance using s = ½at²", labelId: "reaction-time" },
    ],
    examQuestions: [
      {
        id: "eq-controls",
        type: "short-answer",
        prompt: "State two control variables for the ruler-drop investigation.",
        labelIds: ["repeats"],
      },
    ],
  },
  visualStyle: {
    examDiagram: true,
    whiteBackground: true,
    flatVector: true,
    highContrast: true,
    uppercaseLabels: true,
    minimalColour: true,
    letsReviseFrame: true,
  },
  status: "validated",
};

/** @type {import("./schema").DiagramSpecification} */
const PHOTOSYNTHESIS_SPEC = {
  schemaVersion: SCHEMA_VERSION,
  id: "photosynthesis",
  subject: "GCSE Biology",
  examBoard: "AQA",
  tier: "Higher",
  topic: "Photosynthesis",
  subtopic: "Reactants and Products",
  learningGoal:
    "Students can identify the inputs and outputs of photosynthesis and state that the process occurs in chloroplasts.",
  diagramType: "labelled",
  interactionTypes: ["view", "hotspot", "label-overlay", "exam-question"],
  title: "Photosynthesis Reaction",
  instruction:
    "Leaf cross-section with magnified chloroplast inset. Show sunlight, carbon dioxide, water as inputs and glucose and oxygen as outputs with arrows indicating flow.",
  examFocus: [
    "State the word equation for photosynthesis",
    "Identify where photosynthesis occurs",
    "Distinguish reactants from products",
  ],
  difficulty: "standard",
  teacherNotes:
    "Inputs left, chloroplast centre, outputs right. Equation may be implied visually rather than written as symbols at Foundation tier.",
  labels: [
    { id: "sunlight", text: "SUNLIGHT", role: "input", order: 1, hotspotId: "A", mapsTo: "light energy" },
    { id: "chlorophyll", text: "CHLOROPHYLL", role: "structure", order: 2, hotspotId: "B", mapsTo: "pigment in chloroplast" },
    { id: "chloroplast", text: "CHLOROPLAST", role: "structure", order: 3, hotspotId: "C", mapsTo: "site of photosynthesis" },
    { id: "carbon-dioxide", text: "CARBON DIOXIDE", role: "input", order: 4, hotspotId: "D", mapsTo: "CO₂ from air via stomata" },
    { id: "water", text: "WATER", role: "input", order: 5, hotspotId: "E", mapsTo: "H₂O via xylem" },
    { id: "glucose", text: "GLUCOSE", role: "output", order: 6, hotspotId: "F", mapsTo: "C₆H₁₂O₆ product" },
    { id: "oxygen", text: "OXYGEN", role: "output", order: 7, hotspotId: "G", mapsTo: "O₂ released" },
  ],
  layout: {
    orientation: "landscape",
    flow: "left-to-right",
    processType: "reactants-to-products",
    composition: "single-panel-with-inset",
    regions: ["inputs", "chloroplast-inset", "outputs"],
  },
  activities: {
    hotspots: [
      { id: "A", labelId: "sunlight", region: "inputs" },
      { id: "B", labelId: "chlorophyll", region: "chloroplast-inset" },
      { id: "C", labelId: "chloroplast", region: "chloroplast-inset" },
      { id: "D", labelId: "carbon-dioxide", region: "inputs" },
      { id: "E", labelId: "water", region: "inputs" },
      { id: "F", labelId: "glucose", region: "outputs" },
      { id: "G", labelId: "oxygen", region: "outputs" },
    ],
    examQuestions: [
      {
        id: "eq-reactants",
        type: "mcq",
        prompt: "Which of these is a reactant in photosynthesis?",
        labelIds: ["carbon-dioxide", "glucose", "oxygen"],
        options: ["Glucose", "Oxygen", "Carbon dioxide", "Chlorophyll"],
        correctAnswer: "Carbon dioxide",
      },
    ],
  },
  visualStyle: {
    examDiagram: true,
    whiteBackground: true,
    flatVector: true,
    highContrast: true,
    uppercaseLabels: true,
    minimalColour: true,
    letsReviseFrame: true,
  },
  status: "validated",
};

/** @type {import("./schema").DiagramSpecification} */
const DIFFUSION_SPEC = {
  schemaVersion: SCHEMA_VERSION,
  id: "diffusion-membrane",
  subject: "GCSE Biology",
  examBoard: "AQA",
  tier: "Higher",
  topic: "Cell Biology",
  subtopic: "Diffusion",
  learningGoal:
    "Students can explain diffusion as the net movement of particles down a concentration gradient through a partially permeable membrane.",
  diagramType: "compare-contrast",
  interactionTypes: ["view", "hotspot", "label-overlay", "exam-question"],
  title: "Diffusion across a Partially Permeable Membrane",
  instruction:
    "Show high and low concentration regions separated by a partially permeable membrane. Small particles pass through; large particles blocked. Net movement arrow down the gradient.",
  examFocus: [
    "Define diffusion",
    "Explain net movement down a concentration gradient",
    "Describe partially permeable membranes",
  ],
  difficulty: "standard",
  teacherNotes:
    "Use particle dots not arrows for individual random motion; one net-movement arrow is sufficient. Suitable for TTI label placement later.",
  labels: [
    { id: "high-concentration", text: "HIGH CONCENTRATION", role: "annotation", order: 1, hotspotId: "A", mapsTo: "more particles per unit volume" },
    { id: "low-concentration", text: "LOW CONCENTRATION", role: "annotation", order: 2, hotspotId: "B", mapsTo: "fewer particles per unit volume" },
    { id: "membrane", text: "PARTIALLY PERMEABLE MEMBRANE", role: "structure", order: 3, hotspotId: "C", mapsTo: "allows small particles through" },
    { id: "small-particles", text: "SMALL PARTICLES", role: "structure", order: 4, hotspotId: "D", mapsTo: "particles that can diffuse through" },
    { id: "net-movement", text: "NET MOVEMENT", role: "process-step", order: 5, hotspotId: "E", mapsTo: "overall movement down gradient" },
    { id: "gradient", text: "CONCENTRATION GRADIENT", role: "annotation", order: 6, hotspotId: "F", mapsTo: "difference in concentration" },
  ],
  layout: {
    orientation: "landscape",
    flow: "left-to-right",
    processType: "particle-movement",
    composition: "single-panel",
    regions: ["high-side", "membrane", "low-side"],
  },
  activities: {
    hotspots: [
      { id: "A", labelId: "high-concentration", region: "high-side" },
      { id: "B", labelId: "low-concentration", region: "low-side" },
      { id: "C", labelId: "membrane", region: "membrane" },
      { id: "D", labelId: "small-particles", region: "high-side" },
      { id: "E", labelId: "net-movement", region: "membrane" },
      { id: "F", labelId: "gradient", region: "high-side" },
    ],
    examQuestions: [
      {
        id: "eq-define",
        type: "short-answer",
        prompt: "Define diffusion.",
        labelIds: ["net-movement", "gradient"],
      },
    ],
  },
  visualStyle: {
    examDiagram: true,
    whiteBackground: true,
    flatVector: true,
    highContrast: true,
    uppercaseLabels: true,
    minimalColour: true,
    letsReviseFrame: true,
  },
  status: "validated",
};

const EXAMPLE_SPECS = [
  REFLEX_ARC_SPEC,
  REACTION_TIME_PRACTICAL_SPEC,
  PHOTOSYNTHESIS_SPEC,
  DIFFUSION_SPEC,
];

const EXAMPLE_SPECS_BY_ID = Object.fromEntries(EXAMPLE_SPECS.map((s) => [s.id, s]));

module.exports = {
  REFLEX_ARC_SPEC,
  REACTION_TIME_PRACTICAL_SPEC,
  PHOTOSYNTHESIS_SPEC,
  DIFFUSION_SPEC,
  EXAMPLE_SPECS,
  EXAMPLE_SPECS_BY_ID,
};
