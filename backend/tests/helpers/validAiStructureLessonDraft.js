/**
 * LLM mock payload that passes validateLessonStructure + activity-count contract
 * for generate-and-save integration tests.
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

/**
 * Enrich Cell Structure teaching blocks so the LLM mock already satisfies the
 * fail-closed activity-question count/variety contract (without weakening production).
 * Keeps worked-example checkpoint; replaces single-question quick-checks.
 */
function getContractValidCellStructureBlocks() {
  const teaching = getValidCellStructureBlocks().filter(
    (b) => !(b.type === "checkpoint" && b.role === "quickCheck")
  );

  const selfCheckQuestions = [
    {
      prompt: "Define what is meant by a eukaryotic cell in cell structure.",
      questionType: "short",
      options: [],
      correctAnswer: "A cell with a nucleus and membrane-bound organelles.",
      explanation: "State nucleus + membrane-bound organelles for the definition mark.",
      purpose: "definition",
    },
    {
      prompt:
        "A student says prokaryotic cells have a nucleus. Explain why this is a misconception.",
      questionType: "short",
      options: [],
      correctAnswer:
        "Prokaryotes have DNA in the cytoplasm (nucleoid), not a membrane-bound nucleus.",
      explanation: "Contrast prokaryote nucleoid with eukaryotic nucleus.",
      purpose: "misconception",
    },
    {
      prompt: "Explain why mitochondria are important for cell function.",
      questionType: "short",
      options: [],
      correctAnswer: "Mitochondria release energy from respiration for cell processes.",
      explanation: "Link organelle to energy release / respiration.",
      purpose: "explain",
    },
  ];

  const checkpointQuestions = [
    {
      prompt: "Which organelle contains DNA in a typical eukaryotic cell?",
      questionType: "mcq",
      options: ["Nucleus", "Cytoplasm", "Ribosome", "Cell wall"],
      correctAnswer: "Nucleus",
      explanation: "DNA is stored in the nucleus of eukaryotic cells.",
      purpose: "recall",
    },
    {
      prompt:
        "In a cell that cannot carry out photosynthesis, which organelle is most likely missing?",
      questionType: "mcq",
      options: ["Chloroplast", "Nucleus", "Mitochondria", "Ribosome"],
      correctAnswer: "Chloroplast",
      explanation: "Chloroplasts are required for photosynthesis in plant cells.",
      purpose: "application",
    },
    {
      prompt: "Why do plant cells need chloroplasts but animal cells do not?",
      questionType: "mcq",
      options: [
        "Plant cells photosynthesise to make glucose; animal cells do not",
        "Animal cells already contain chlorophyll in the cytoplasm",
        "Chloroplasts store DNA only in animal cells",
        "Plant cells lack mitochondria so chloroplasts release energy",
      ],
      correctAnswer: "Plant cells photosynthesise to make glucose; animal cells do not",
      explanation: "Link chloroplasts to photosynthesis, which animals do not perform.",
      purpose: "explain",
    },
  ];

  const selfCheck = {
    type: "selfCheck",
    role: "selfCheck",
    prompt: selfCheckQuestions[0].prompt,
    questionType: "short",
    options: [],
    correctAnswer: selfCheckQuestions[0].correctAnswer,
    explanation: selfCheckQuestions[0].explanation,
    questions: selfCheckQuestions,
  };

  const checkpoint = {
    type: "checkpoint",
    role: "quickCheck",
    prompt: checkpointQuestions[0].prompt,
    questionType: "mcq",
    options: checkpointQuestions[0].options,
    correctAnswer: checkpointQuestions[0].correctAnswer,
    explanation: checkpointQuestions[0].explanation,
    questions: checkpointQuestions,
  };

  // Keep a strong real-world/medical application in the later half of the lesson
  // so structure validation still passes after multi-page collapse + activity banks.
  const lateMedicalApplication = {
    type: "text",
    role: "concept",
    content:
      "In medicine, hospital pathologists use microscopes on patient samples — a real-world medical application of cell structure knowledge in diagnosis.",
  };

  const insertAt = teaching.findIndex((b) => b.role === "finalMemoryRule");
  const at = insertAt >= 0 ? insertAt : teaching.length;
  return [
    ...teaching.slice(0, at),
    selfCheck,
    checkpoint,
    ...teaching.slice(at),
    lateMedicalApplication,
  ];
}

function getContractValidQuiz() {
  return {
    timeSeconds: 600,
    questions: [
      {
        id: "q1",
        type: "mcq",
        question: "Which option correctly defines a eukaryotic cell?",
        options: [
          "A cell with a nucleus and membrane-bound organelles",
          "A cell with DNA only in the cytoplasm and no membrane systems",
          "A cell that never contains mitochondria",
          "A cell wall-only structure without cytoplasm",
        ],
        correctAnswer: "A cell with a nucleus and membrane-bound organelles",
        explanation: "Eukaryotic cells have a nucleus and membrane-bound organelles.",
        purpose: "definition",
      },
      {
        id: "q2",
        type: "mcq",
        question: "Which statement shows a common misconception about prokaryotes?",
        options: [
          "Prokaryotes have a membrane-bound nucleus",
          "Prokaryotes have DNA in the cytoplasm",
          "Prokaryotes lack membrane-bound organelles",
          "Prokaryotes are usually smaller than eukaryotic cells",
        ],
        correctAnswer: "Prokaryotes have a membrane-bound nucleus",
        explanation: "Prokaryotes do not have a membrane-bound nucleus.",
        purpose: "misconception",
      },
      {
        id: "q3",
        type: "mcq",
        question:
          "If a plant cell loses its chloroplasts, what is the most likely effect on the cell?",
        options: [
          "It can no longer photosynthesise to make glucose",
          "It immediately gains a nucleus for the first time",
          "It stops having a cell membrane",
          "It becomes a prokaryotic cell",
        ],
        correctAnswer: "It can no longer photosynthesise to make glucose",
        explanation: "Chloroplasts are the site of photosynthesis.",
        purpose: "application",
      },
      {
        id: "q4",
        type: "mcq",
        question: "How do plant cells and animal cells differ in cell structure?",
        options: [
          "Plant cells have a cell wall and chloroplasts; animal cells do not",
          "Animal cells have chloroplasts; plant cells never do",
          "Only animal cells have a nucleus",
          "Plant cells lack cytoplasm entirely",
        ],
        correctAnswer: "Plant cells have a cell wall and chloroplasts; animal cells do not",
        explanation: "Classic plant vs animal cell comparison point.",
        purpose: "comparison",
      },
      {
        id: "q5",
        type: "mcq",
        question:
          "Which answer would earn a mark for explaining mitochondria in cell structure (not just naming them)?",
        options: [
          "Mitochondria release energy from respiration for cell processes",
          "Mitochondria",
          "They are green",
          "They are only found in prokaryotes",
        ],
        correctAnswer: "Mitochondria release energy from respiration for cell processes",
        explanation: "Explanation must link structure/organelle to function.",
        purpose: "exam_style",
      },
    ],
  };
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
      correctAnswer:
        "Thermoreceptors detect the rise. The coordination centre triggers sweating and vasodilation. Heat is lost so temperature returns towards the optimum.",
      explanation: "Award marks for receptor, coordination centre, named effectors and negative feedback.",
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
      type: "selfCheck",
      role: "selfCheck",
      prompt: "Define homeostasis.",
      questionType: "short",
      options: [],
      correctAnswer: "Regulation of internal conditions to maintain optimum levels for cells.",
      explanation: "",
      purpose: "definition",
      questions: [
        {
          prompt: "Define homeostasis.",
          questionType: "short",
          options: [],
          correctAnswer: "Regulation of internal conditions to maintain optimum levels for cells.",
          explanation: "",
          purpose: "definition",
        },
        {
          prompt:
            "A student says homeostasis only controls temperature. Explain why this is a misconception.",
          questionType: "short",
          options: [],
          correctAnswer:
            "Homeostasis also regulates other conditions such as blood glucose, not only temperature.",
          explanation: "",
          purpose: "misconception",
        },
        {
          prompt: "Explain why negative feedback is important in homeostasis.",
          questionType: "short",
          options: [],
          correctAnswer:
            "Negative feedback returns conditions towards the optimum after a change is detected.",
          explanation: "",
          purpose: "explain",
        },
      ],
    },
    {
      type: "checkpoint",
      role: "quickCheck",
      prompt: "Which term describes return to optimum after a change?",
      questionType: "mcq",
      options: ["Negative feedback", "Positive feedback", "Diffusion", "Osmosis"],
      correctAnswer: "Negative feedback",
      explanation: "",
      purpose: "recall",
      questions: [
        {
          prompt: "Which term describes return to optimum after a change?",
          questionType: "mcq",
          options: ["Negative feedback", "Positive feedback", "Diffusion", "Osmosis"],
          correctAnswer: "Negative feedback",
          explanation: "",
          purpose: "recall",
        },
        {
          prompt:
            "During exercise core temperature rises. Which response is most likely as part of homeostasis?",
          questionType: "mcq",
          options: [
            "Sweating and vasodilation to increase heat loss",
            "Shivering to generate more heat",
            "Stopping all receptor activity",
            "Ignoring the temperature change",
          ],
          correctAnswer: "Sweating and vasodilation to increase heat loss",
          explanation: "",
          purpose: "application",
        },
        {
          prompt: "Why must effectors act after receptors detect a change?",
          questionType: "mcq",
          options: [
            "Effectors carry out the response that returns conditions towards optimum",
            "Effectors detect the change before receptors",
            "Effectors store DNA for homeostasis",
            "Effectors only work in plants",
          ],
          correctAnswer: "Effectors carry out the response that returns conditions towards optimum",
          explanation: "",
          purpose: "explain",
        },
      ],
    },
    {
      type: "text",
      role: "concept",
      content:
        "In medicine, doctors monitor fever and thermoregulation in patients — a real-world medical application of homeostasis and negative feedback.",
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
    quiz: getContractValidHomeostasisQuiz(),
    ...overrides,
  });
}

function getContractValidHomeostasisQuiz() {
  return {
    timeSeconds: 600,
    questions: [
      {
        id: "h1",
        type: "mcq",
        question: "Which option correctly defines homeostasis?",
        options: [
          "Regulation of internal conditions to maintain optimum levels for cells",
          "Only the control of breathing rate during sleep",
          "A process that always increases temperature",
          "Diffusion of oxygen into the blood only",
        ],
        correctAnswer: "Regulation of internal conditions to maintain optimum levels for cells",
        explanation: "Homeostasis maintains optimum internal conditions.",
        purpose: "definition",
      },
      {
        id: "h2",
        type: "mcq",
        question: "Which statement shows a common misconception about homeostasis?",
        options: [
          "Homeostasis only controls body temperature",
          "Homeostasis uses negative feedback",
          "Receptors detect changes in internal conditions",
          "Effectors carry out responses",
        ],
        correctAnswer: "Homeostasis only controls body temperature",
        explanation: "Homeostasis controls more than temperature.",
        purpose: "misconception",
      },
      {
        id: "h3",
        type: "mcq",
        question: "During exercise, what is the most likely homeostatic response to rising core temperature?",
        options: [
          "Sweating and vasodilation to increase heat loss",
          "Shivering to generate more heat",
          "Stopping receptor detection",
          "Ignoring the temperature change",
        ],
        correctAnswer: "Sweating and vasodilation to increase heat loss",
        explanation: "Heat loss responses restore optimum temperature.",
        purpose: "application",
      },
      {
        id: "h4",
        type: "mcq",
        question: "How do receptors and effectors differ in homeostasis?",
        options: [
          "Receptors detect change; effectors carry out the response",
          "Effectors detect change; receptors carry out the response",
          "Both only store glucose",
          "Neither is involved in negative feedback",
        ],
        correctAnswer: "Receptors detect change; effectors carry out the response",
        explanation: "Classic role comparison in the homeostasis model.",
        purpose: "comparison",
      },
      {
        id: "h5",
        type: "mcq",
        question:
          "Which answer would earn a mark for explaining negative feedback (not just naming it)?",
        options: [
          "A change is detected and responses return conditions towards the optimum",
          "Negative feedback",
          "It is the same as positive feedback",
          "It only happens in plants",
        ],
        correctAnswer: "A change is detected and responses return conditions towards the optimum",
        explanation: "Explain the mechanism, not only the keyword.",
        purpose: "exam_style",
      },
    ],
  };
}

function getValidCellStructureDraft(overrides = {}) {
  const blocks = overrides.blocks ?? getContractValidCellStructureBlocks();
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
  const draft = {
    title: overrides.title ?? "Cell Structure",
    description: overrides.description ?? "Eukaryotic and prokaryotic cells.",
    estimatedDuration: overrides.estimatedDuration ?? 40,
    tags: overrides.tags ?? ["cells", "biology"],
    board: overrides.board ?? "AQA",
    tier: overrides.tier ?? "foundation",
    pages,
    quiz: overrides.quiz ?? getContractValidQuiz(),
  };
  return draft;
}

module.exports = {
  getValidCellStructureBlocks,
  getContractValidCellStructureBlocks,
  getContractValidQuiz,
  getContractValidHomeostasisQuiz,
  getValidHomeostasisTeacherFirstBlocks,
  getValidHomeostasisTeacherFirstDraft,
  getValidCellStructureDraft,
};
