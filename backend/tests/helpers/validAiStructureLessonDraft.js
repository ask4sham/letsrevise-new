/**
 * LLM mock payload that passes validateLessonStructure for generate-and-save integration tests.
 * Test-only fixture — not used in production.
 */

function getValidCellStructureBlocks() {
  return [
    { type: "text", role: "hook", content: "Cells are the basic units of life. What makes them work?" },
    { type: "keyIdea", role: "coreRule", content: "Eukaryotic cells have a nucleus and membrane-bound organelles." },
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
      correctAnswer:
        "Plant cells carry out photosynthesis to make glucose. Chloroplasts contain chlorophyll and are the site of photosynthesis. Animal cells do not photosynthesise.",
      explanation: "Full marks for linking structure to function.",
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
  getValidCellStructureDraft,
};
