/**
 * Topic-specific interactive diagram plans and brief formatters.
 * Parallel to drag-drop: textMatch | textToImage | imageDropZones.
 */

const BRIEF_MARKER = "--- TEACHER BRAIN DESIGN BRIEF ---";

/** @type {Record<string, { briefHeader: string, diagram: object }>} */
const TOPIC_SPECS = {
  brain: {
    briefHeader: "BRAIN DIAGRAM BRIEF",
    diagram: {
      title: "The Human Brain: Structure and Regions",
      type: "Labelled Structure Diagram",
      purpose:
        "Label major brain regions and link each structure to its function for AQA GCSE Biology.",
      mustShow: [
        "Sagittal or labelled overview of the brain",
        "Cerebral cortex — conscious thought and voluntary movement",
        "Cerebellum — coordination and balance",
        "Medulla — autonomic control (breathing, heart rate)",
        "Spinal cord — continuation of CNS below the brain",
        "Clear labels readable at lesson scale",
      ],
      hotspots: [
        "Cerebral cortex — conscious thought / voluntary movement",
        "Cerebellum — coordination and balance",
        "Medulla — autonomic control",
        "Spinal cord — carries impulses to and from the brain",
      ],
      assessmentFocus: [
        "Describe the function of a named brain region",
        "Explain why damage to the medulla can be life-threatening",
      ],
      studentTask: [
        "Label each region on the diagram.",
        "State one function per labelled region using GCSE wording.",
        "Link structure to function in a 2–3 mark explain answer.",
      ],
    },
  },
  reflexArc: {
    briefHeader: "REFLEX ARC DIAGRAM BRIEF",
    diagram: {
      title: "The Reflex Arc",
      type: "Process Flow Diagram",
      purpose:
        "Show the reflex pathway from stimulus to rapid response without conscious thought in the cerebrum.",
      mustShow: [
        "Stimulus → receptor → sensory neurone → relay neurone (CNS) → motor neurone → effector → response",
        "Direction arrows on every neurone",
        "Spinal cord / CNS shown as relay location",
        "Note: pathway bypasses conscious brain for speed",
      ],
      hotspots: [
        "Receptor — detects stimulus",
        "Sensory neurone — impulse to CNS",
        "Relay neurone — in spinal cord",
        "Motor neurone — impulse to effector",
        "Effector — muscle or gland response",
      ],
      assessmentFocus: [
        "Describe the pathway of a reflex action",
        "Explain why reflexes are faster than conscious responses",
      ],
      studentTask: [
        "Label each component in order.",
        "Trace the pathway with arrows from stimulus to response.",
        "Explain in one sentence why the reflex arc does not involve conscious thought.",
      ],
    },
  },
  eye: {
    briefHeader: "EYE DIAGRAM BRIEF",
    diagram: {
      title: "The Human Eye",
      type: "Labelled Structure Diagram",
      purpose:
        "Label eye structures and link each to light refraction, accommodation, or impulse transmission.",
      mustShow: [
        "Cross-section of the eye",
        "Cornea and lens — light refraction / focussing",
        "Iris and pupil — control of light intensity",
        "Retina — light receptors",
        "Optic nerve — carries impulses to the brain",
        "Ciliary muscles and suspensory ligaments (accommodation)",
      ],
      hotspots: [
        "Cornea — initial refraction",
        "Lens — fine focussing",
        "Iris / pupil — light intensity",
        "Retina — receptors",
        "Optic nerve — to brain",
      ],
      assessmentFocus: [
        "Describe how the eye focuses light on the retina",
        "Explain the role of the iris in bright vs dim light",
      ],
      studentTask: [
        "Label structures on the cross-section.",
        "Link each label to its function in seeing.",
        "Use the diagram to answer a describe / explain question on accommodation or reflex by the iris.",
      ],
    },
  },
  cell: {
    briefHeader: "CELL DIAGRAM BRIEF",
    diagram: {
      title: "Animal or Plant Cell Structure",
      type: "Labelled Structure Diagram",
      purpose:
        "Label organelles and state functions; support comparison of animal and plant cells where needed.",
      mustShow: [
        "Nucleus — contains genetic material",
        "Mitochondria — site of aerobic respiration",
        "Cytoplasm — site of chemical reactions",
        "Cell membrane — controls entry and exit of substances",
        "Plant-only: cell wall, chloroplast, permanent vacuole (if plant cell version)",
        "Scale bar or note that diagram is not to scale",
      ],
      hotspots: [
        "Nucleus — DNA / controls activities",
        "Mitochondria — respiration / ATP",
        "Ribosomes — protein synthesis",
        "Cell membrane — selective barrier",
        "Chloroplast — photosynthesis (plant)",
        "Cell wall — support (plant)",
      ],
      assessmentFocus: [
        "Describe the function of named organelles",
        "Compare animal and plant cells (where relevant)",
      ],
      studentTask: [
        "Label organelles on the correct cell type (animal or plant).",
        "State the function of each labelled structure.",
        "Use precise vocabulary (e.g. selective permeability, aerobic respiration).",
      ],
    },
  },
};

function dotList(items = []) {
  return items.map((item) => `• ${item}`).join("\n");
}

/**
 * @param {string} topicKind
 * @param {{ topic?: string }} [input]
 * @returns {object[]}
 */
function getInteractiveDiagramPlansForTopicKind(topicKind, input = {}) {
  const spec = TOPIC_SPECS[topicKind];
  if (!spec) return [];
  const topic = String(input.topic || "").trim();
  const diagram = { ...spec.diagram };
  if (topic && topicKind === "cell" && /plant/i.test(topic) && !/animal/i.test(topic)) {
    diagram.title = "Plant Cell Structure";
  } else if (topic && topicKind === "cell" && /animal/i.test(topic) && !/plant/i.test(topic)) {
    diagram.title = "Animal Cell Structure";
  }
  return [diagram];
}

/**
 * @param {string} topicKind
 * @returns {{ briefHeader: string, diagram: object } | null}
 */
function getInteractiveDiagramTopicSpec(topicKind) {
  return TOPIC_SPECS[topicKind] || null;
}

/**
 * @param {object} diagram
 * @param {string} topicKind
 */
function formatInteractiveDiagramTopicBrief(diagram, topicKind) {
  const spec = TOPIC_SPECS[topicKind];
  const header = spec?.briefHeader || "DIAGRAM BRIEF";
  const hotspots = (diagram.hotspots || []).map((h, i) => `${i + 1}. ${h}`);
  const studentTask = diagram.studentTask || [
    "Label or trace the pathways on the diagram.",
    "Explain how each labelled part earns marks in an exam answer.",
  ];

  return [
    BRIEF_MARKER,
    "",
    header,
    "",
    `Title:\n${diagram.title || "Diagram"}`,
    "",
    `Purpose:\n${diagram.purpose || "Support GCSE understanding with a clear visual anchor."}`,
    "",
    `Must Show:\n${dotList(diagram.mustShow || [])}`,
    "",
    "Hotspots:",
    hotspots.length ? hotspots.join("\n") : "1. Key label\n2. Process step\n3. Exam-linked part",
    "",
    `Assessment Focus:\n${dotList(diagram.assessmentFocus || [])}`,
    "",
    "Student Task:",
    studentTask.join("\n"),
    "",
    "Do NOT use a placeholder image. Build this visual from the brief above.",
  ].join("\n");
}

module.exports = {
  BRIEF_MARKER,
  TOPIC_SPECS,
  getInteractiveDiagramPlansForTopicKind,
  getInteractiveDiagramTopicSpec,
  formatInteractiveDiagramTopicBrief,
};
