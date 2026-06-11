/**
 * LLM mock payload that passes validateLessonStructure for generate-and-save integration tests.
 * Test-only fixture — not used in production.
 */

function getValidCellStructureBlocks() {
  return [
    {
      type: "text",
      title: "Revision Objectives",
      role: "lessonObjectives",
      content:
        "By the end of this lesson you will:\n• Describe cell structure in animal and plant cells\n• Compare eukaryotic and prokaryotic cells\n• Explain organelle functions in exams",
    },
    {
      type: "text",
      title: "Prior Knowledge",
      role: "priorKnowledge",
      content: "Recall that cells are the basic units of life and that organisms are made of cells.",
    },
    {
      type: "text",
      title: "Definition",
      role: "definition",
      content:
        "**Definition:** Eukaryotic cells contain a nucleus and membrane-bound organelles; prokaryotic cells are smaller and lack a nucleus.",
    },
    {
      type: "text",
      title: "Why it matters",
      role: "whyItMatters",
      content:
        "**Why it matters:** Cell structure questions test whether you can link organelles to their functions in plant and animal cells.",
    },
    {
      type: "keyIdea",
      title: "Core model",
      role: "coreRule",
      content: "Nucleus → cytoplasm → membrane → specialised organelles (e.g. mitochondria, chloroplasts in plant cells).",
    },
    {
      type: "text",
      title: "Key examples",
      role: "keyExamples",
      content: "• Animal cell: nucleus, mitochondria, cell membrane\n• Plant cell: adds cell wall, chloroplasts, large vacuole",
    },
    {
      type: "text",
      title: "Exam vocabulary",
      role: "examVocabulary",
      content: "**Exam vocabulary:** nucleus, cytoplasm, mitochondria, chloroplast, cell membrane, cell wall, organelle",
    },
    {
      type: "text",
      title: "Scenario",
      role: "hook",
      content: "A student views cheek cells and onion cells under a microscope — what structural differences would they expect?",
    },
    {
      type: "text",
      title: "Core Teaching",
      role: "concept",
      content: "Cells are the basic units of life. The nucleus controls activities; cytoplasm is where reactions occur.",
    },
    {
      type: "commonMistake",
      role: "commonMistake",
      content:
        "Wrong: Prokaryotes have a nucleus.\nCorrect: Prokaryotes have DNA in the cytoplasm (nucleoid), not a membrane-bound nucleus.\nExam link: You lose marks if you say prokaryotes have a nucleus.",
    },
    {
      type: "keyIdea",
      role: "patternRecognition",
      content: "Exam questions often ask you to compare plant and animal cells.",
    },
    { type: "diagram", role: "concept", caption: "image here", content: "image here" },
    {
      type: "keyIdea",
      role: "whatToNotice",
      title: "What to Notice",
      content:
        "- Cell structure: nucleus controls activities\n- Cytoplasm is where reactions occur\n- Membrane controls entry and exit",
    },
    { type: "text", role: "concept", content: "The nucleus controls the cell. Cytoplasm is where reactions happen." },
    { type: "examTip", role: "concept", content: "Describe the function of each organelle in exams." },
    { type: "diagram", role: "concept", caption: "image here", content: "image here" },
    {
      type: "keyIdea",
      role: "whatToNotice",
      title: "What to Notice",
      content:
        "- Chloroplasts only in plant cell structure\n- Site of photosynthesis in plant cells\n- Often asked in compare questions",
    },
    { type: "text", role: "concept", content: "Plant cells have chloroplasts for photosynthesis." },
    {
      type: "examTip",
      role: "concept",
      content: "In compare questions, state one difference per mark and use exam command words.",
    },
    {
      type: "checkpoint",
      role: "workedExample",
      prompt: "Explain why plant cells have chloroplasts but animal cells do not. (3 marks)",
      questionType: "short",
      options: [],
      correctAnswer: "Plant cells photosynthesise; chloroplasts are the site; animal cells do not photosynthesise.",
      explanation:
        "- Plant cells carry out photosynthesis to make glucose.\n" +
        "- Chloroplasts contain chlorophyll because light energy must be trapped for photosynthesis.\n" +
        "- Animal cells do not photosynthesise therefore they do not need chloroplasts.",
    },
    {
      type: "keyIdea",
      role: "synthesis",
      content: "Plant cells: chloroplasts, cell wall, large vacuole. Animal cells: no cell wall, small vacuoles.",
    },
    {
      type: "text",
      role: "concept",
      content:
        "In medicine, microscopes are used in hospitals to diagnose disease — a real-world application linking cell structure to patient care.",
    },
    {
      type: "checkpoint",
      role: "quickCheck",
      prompt: "Which organelle contains DNA?",
      questionType: "mcq",
      options: ["Nucleus", "Cytoplasm", "Ribosome", "Mitochondria"],
      correctAnswer: "Nucleus",
      explanation: "",
    },
    {
      type: "checkpoint",
      role: "quickCheck",
      prompt: "Describe the function of the mitochondria.",
      questionType: "short",
      options: [],
      correctAnswer: "Releases energy in respiration.",
      explanation: "",
    },
    {
      type: "keyIdea",
      role: "finalMemoryRule",
      content: "Cell structure: eukaryotic cells have a nucleus; prokaryotes do not.",
    },
  ];
}

/**
 * Homeostasis draft for teacher-first opening integration tests.
 * Includes pre-built opening slots (3H.1.6) and ≥2 distinct diagram blocks that survive compression.
 */
function getValidHomeostasisTeacherFirstBlocks() {
  return [
    {
      type: "text",
      title: "Revision Objectives",
      role: "lessonObjectives",
      content:
        "By the end of this lesson you will:\n• Define homeostasis\n• Explain negative feedback\n• Apply the model in exam answers",
    },
    {
      type: "text",
      title: "Prior Knowledge",
      role: "priorKnowledge",
      content: "Recall that cells need stable conditions and that receptors detect changes in the internal environment.",
    },
    {
      type: "text",
      title: "Definition",
      role: "definition",
      content:
        "**Definition:** Homeostasis is the regulation of internal conditions to maintain optimum levels for cells.",
    },
    {
      type: "text",
      title: "Why it matters",
      role: "whyItMatters",
      content:
        "**Why it matters:** Homeostasis keeps core temperature and blood glucose within ranges that allow enzymes to work efficiently.",
    },
    {
      type: "keyIdea",
      title: "Core model",
      role: "coreRule",
      content:
        "**Core model:** Receptor detects change → coordination centre → effector response → return towards optimum (negative feedback).",
    },
    {
      type: "text",
      title: "Key examples",
      role: "keyExamples",
      content: "• Thermoregulation during exercise\n• Blood glucose control after a meal",
    },
    {
      type: "text",
      title: "Exam vocabulary",
      role: "examVocabulary",
      content:
        "**Exam vocabulary:** homeostasis, negative feedback, receptor, effector, coordination centre, optimum",
    },
    {
      type: "text",
      title: "Scenario",
      role: "hook",
      content:
        "After a long run, your body temperature rises. Use the homeostasis model to explain how your body responds.",
    },
    {
      type: "text",
      title: "Core Teaching",
      role: "concept",
      content:
        "Homeostasis uses receptors, coordination centres and effectors to return internal conditions towards optimum levels.",
    },
    {
      type: "commonMistake",
      role: "commonMistake",
      content:
        "Wrong: Homeostasis only controls temperature.\nCorrect: Homeostasis regulates multiple internal conditions including temperature and blood glucose.\nExam link: State the full definition before giving examples.",
    },
    {
      type: "keyIdea",
      role: "patternRecognition",
      content:
        "Homeostasis exam questions often ask you to describe or explain negative feedback pathways step by step.",
    },
    {
      type: "diagram",
      role: "concept",
      title: "Negative feedback overview",
      caption: "Negative feedback overview diagram",
      content: "Homeostasis negative feedback loop diagram placeholder",
    },
    {
      type: "keyIdea",
      role: "whatToNotice",
      title: "What to Notice",
      content:
        "- In homeostasis, receptors detect changes in core temperature\n- The coordination centre triggers sweating during thermoregulation\n- Negative feedback returns conditions towards the optimum",
    },
    {
      type: "text",
      role: "concept",
      content:
        "Thermoreceptors detect rising core temperature. The coordination centre activates sweating so heat is lost by evaporation.",
    },
    { type: "examTip", role: "concept", content: "Name the receptor, coordination centre and effector in order for full marks." },
    {
      type: "diagram",
      role: "concept",
      title: "Thermoregulation diagram",
      caption: "Thermoregulation diagram",
      content: "Thermoregulation sweating and vasodilation diagram placeholder",
    },
    {
      type: "keyIdea",
      role: "whatToNotice",
      title: "What to Notice",
      content:
        "- Homeostasis uses sweating to increase heat loss by evaporation\n- Vasodilation transfers heat to the skin during thermoregulation\n- Link each effector response to the temperature change detected",
    },
    {
      type: "text",
      role: "concept",
      content:
        "In exams, compare responses when temperature rises versus when it falls — effectors differ but the negative feedback pattern is the same.",
    },
    {
      type: "checkpoint",
      role: "workedExample",
      prompt: "Explain how the body responds when core temperature rises during exercise. (4 marks)",
      questionType: "short",
      options: [],
      correctAnswer: "Thermoreceptors detect rise; coordination centre triggers effectors; temperature returns to optimum.",
      explanation:
        "- Core temperature rises above the optimum during exercise.\n" +
        "- Thermoreceptors detect the change because levels move away from the set point.\n" +
        "- Sweat glands and vasodilation increase heat loss therefore temperature returns towards optimum.",
    },
    {
      type: "keyIdea",
      role: "synthesis",
      content:
        "Homeostasis depends on negative feedback: receptors detect change, coordination centres process information, effectors restore optimum conditions.",
    },
    {
      type: "text",
      role: "concept",
      content:
        "Athletes train in hot conditions partly because efficient thermoregulation supports sustained enzyme activity during exercise.",
    },
    {
      type: "checkpoint",
      role: "quickCheck",
      prompt: "Which term describes return to optimum after a change?",
      questionType: "mcq",
      options: ["Negative feedback", "Positive feedback", "Diffusion", "Osmosis"],
      correctAnswer: "Negative feedback",
      explanation: "",
    },
    {
      type: "checkpoint",
      role: "quickCheck",
      prompt: "State one effector used in temperature control.",
      questionType: "short",
      options: [],
      correctAnswer: "Sweat glands or muscles controlling shivering.",
      explanation: "",
    },
    {
      type: "keyIdea",
      role: "finalMemoryRule",
      content:
        "Remember: homeostasis maintains optimum internal conditions using negative feedback between receptors, coordination centres and effectors.",
    },
  ];
}

function getValidHomeostasisTeacherFirstDraft(overrides = {}) {
  return getValidCellStructureDraft({
    title: "Homeostasis",
    description: "Homeostasis and negative feedback in GCSE Biology.",
    tags: ["homeostasis", "biology"],
    blocks: getValidHomeostasisTeacherFirstBlocks(),
    ...overrides,
  });
}

function getValidCellStructureDraft(overrides = {}) {
  const blocks = overrides.blocks ?? getValidCellStructureBlocks();
  const pages =
    overrides.pages ??
    [
      {
        title: overrides.pageTitle || "Page 1",
        order: 1,
        pageType: "",
        blocks,
      },
    ];
  return {
    title: overrides.title ?? "Cell Structure",
    description: overrides.description ?? "Eukaryotic and prokaryotic cells.",
    estimatedDuration: overrides.estimatedDuration ?? 40,
    tags: overrides.tags ?? ["cells", "biology"],
    board: overrides.board ?? "AQA",
    tier: overrides.tier ?? "foundation",
    pages,
  };
}

module.exports = {
  getValidCellStructureBlocks,
  getValidHomeostasisTeacherFirstBlocks,
  getValidHomeostasisTeacherFirstDraft,
  getValidCellStructureDraft,
};
