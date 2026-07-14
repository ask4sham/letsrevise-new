/**
 * Phase 1 — Lesson Brain.
 *
 * Produces teaching content only (V1 pedagogical strengths: objectives → teach →
 * misconceptions → exam tips → summary). Does NOT finalise questions or image prompts.
 *
 * Deterministic for reliable CI; topic packs enrich common GCSE Biology topics.
 * Optional override via opts.phase1Override (tests / future LLM adapter).
 */

const { STAGE_STATUS } = require("./schemas");
const { PHASE1_REQUIRED_PLACEHOLDERS } = require("./placeholders");
const { validatePhase1Lesson } = require("./validatePhase1Lesson");

function titleCaseTopic(topic) {
  return String(topic || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeKey(topic) {
  return String(topic || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Topic-aware teaching packs — reuse V1-style GCSE Biology teaching angles.
 */
function resolveTopicPack(topic) {
  const n = normalizeKey(topic);
  if (/\bcell structure\b|\beukaryot|\bprokaryot|\borganelle/.test(n)) {
    return {
      keyTerms: ["nucleus", "cytoplasm", "cell membrane", "mitochondria", "chloroplast", "ribosome", "cell wall"],
      priorKnowledge:
        "Students should already know that living organisms are made of cells and that microscopes are used to study cell structure.",
      objectives: [
        "Describe the main organelles in animal and plant cells and state their functions",
        "Compare eukaryotic and prokaryotic cells using exam-style differences",
        "Explain why structure is linked to function for at least two organelles",
      ],
      sections: [
        {
          id: "core",
          title: "Core teaching",
          content:
            "Eukaryotic cells have a nucleus and membrane-bound organelles. The nucleus contains genetic material and controls cell activities. Cytoplasm is where most chemical reactions occur. The cell membrane controls what enters and leaves the cell. Mitochondria release energy from respiration. Plant cells also have a cell wall, chloroplasts for photosynthesis, and a permanent vacuole.",
        },
        {
          id: "examples",
          title: "Key examples",
          content:
            "Animal cell example: muscle cells contain many mitochondria because they need lots of energy for contraction. Plant cell example: palisade mesophyll cells contain many chloroplasts to maximise light absorption for photosynthesis. Comparison point: both cell types have a nucleus, cytoplasm and cell membrane, but only plant cells typically have a cell wall and chloroplasts.",
        },
        {
          id: "exam-link",
          title: "Exam thinking",
          content:
            "Exam questions often ask you to compare plant and animal cells or to link an organelle to its function. Use precise terms (nucleus, mitochondria, chloroplast) and state one clear difference per mark. Avoid saying prokaryotes have a nucleus.",
        },
      ],
      misconceptions: [
        {
          wrong: "Prokaryotic cells have a nucleus.",
          correct:
            "Prokaryotes have DNA in the cytoplasm (nucleoid region), not a membrane-bound nucleus.",
        },
      ],
      examTips: [
        "In compare questions, state one difference per mark and use command words such as describe and explain.",
        "Always link organelle structure to function (e.g. mitochondria → respiration → energy release).",
      ],
      summary:
        "Cell structure is about knowing organelles and linking each to function, then comparing plant, animal and prokaryotic cells with precise exam language.",
    };
  }

  if (/\bhomeostasis\b|\bnegative feedback\b|\bthermoregul|\bblood glucose\b/.test(n)) {
    return {
      keyTerms: [
        "homeostasis",
        "negative feedback",
        "receptor",
        "coordination centre",
        "effector",
        "optimum",
      ],
      priorKnowledge:
        "Students should recall that cells work best in stable conditions and that receptors detect changes in the internal environment.",
      objectives: [
        "Define homeostasis and explain why it matters for enzyme activity",
        "Describe the negative feedback model using receptor, coordination centre and effector",
        "Apply the model to thermoregulation during exercise",
      ],
      sections: [
        {
          id: "core",
          title: "Core teaching",
          content:
            "Homeostasis is the regulation of internal conditions to maintain optimum levels for cells. Negative feedback returns conditions towards the optimum after a change is detected. Receptors detect the change, a coordination centre processes the information, and effectors carry out the response.",
        },
        {
          id: "examples",
          title: "Key examples",
          content:
            "Thermoregulation: during exercise core temperature rises; sweating and vasodilation increase heat loss so temperature returns towards optimum. Blood glucose: after a meal glucose rises; insulin helps restore the optimum range so cells can respire steadily.",
        },
        {
          id: "exam-link",
          title: "Exam thinking",
          content:
            "Homeostasis exam answers usually need the sequence receptor → coordination centre → effector, plus a named response. Do not claim homeostasis only controls temperature.",
        },
      ],
      misconceptions: [
        {
          wrong: "Homeostasis only controls body temperature.",
          correct: "Homeostasis regulates multiple internal conditions, including temperature and blood glucose.",
        },
      ],
      examTips: [
        "Name the receptor, coordination centre and effector in order for full marks.",
        "Link each effector response to the change detected (because → therefore).",
      ],
      summary:
        "Homeostasis keeps internal conditions near optimum using negative feedback between receptors, coordination centres and effectors.",
    };
  }

  // Generic GCSE Biology teaching scaffold — still topic-specific via injected topic label.
  const label = titleCaseTopic(topic) || "this topic";
  return {
    keyTerms: [label, "mechanism", "outcome", "exam command word", "misconception"],
    priorKnowledge: `Students should recall related biology ideas that link to ${label}, including key vocabulary and simple cause → effect thinking.`,
    objectives: [
      `Define the core idea of ${label} in precise GCSE Biology language`,
      `Explain one important mechanism or process linked to ${label}`,
      `Apply ${label} to an exam-style example and avoid a common misconception`,
    ],
    sections: [
      {
        id: "core",
        title: "Core teaching",
        content: `${label} is a GCSE Biology idea that students must explain with precise terms, not keywords alone. Teach the core model first: what it is, why it matters for living organisms, and how one step leads to a clear biological outcome. Keep explanations short and sequential so each idea prepares the next.`,
      },
      {
        id: "examples",
        title: "Key examples",
        content: `Use at least two concrete biology examples for ${label}. Example 1 should show the normal process. Example 2 should show what changes when a factor is altered. In both cases, force a because → therefore link so students practise exam explanation style.`,
      },
      {
        id: "exam-link",
        title: "Exam thinking",
        content: `For ${label}, examiners reward accurate definitions, clear comparisons, and explanations that connect mechanism to outcome. Remind students to use command words carefully (describe vs explain) and to avoid vague everyday language.`,
      },
    ],
    misconceptions: [
      {
        wrong: `A common error is treating ${label} as a single keyword with no mechanism.`,
        correct: `Students must explain ${label} with a clear cause → effect chain and precise biological terms.`,
      },
    ],
    examTips: [
      `State the definition of ${label} before giving examples in longer answers.`,
      `Use because → therefore when explaining processes linked to ${label}.`,
    ],
    summary: `${label} should be taught as definition → mechanism → example → exam link, so students can explain biology clearly rather than memorise isolated words.`,
  };
}

/**
 * Build a Phase 1 lesson object (teaching only).
 * @param {{ topic: string, subject: string, level: string, board?: string, examBoard?: string, topicKey?: string, tier?: string }} ctx
 * @param {{ phase1Override?: object }} [opts]
 */
function buildPhase1Lesson(ctx, opts = {}) {
  if (opts.phase1Override && typeof opts.phase1Override === "object") {
    return {
      ...opts.phase1Override,
      status: opts.phase1Override.status || STAGE_STATUS.COMPLETE,
    };
  }

  const topic = titleCaseTopic(ctx.topic);
  const subject = String(ctx.subject || "Biology").trim();
  const level = String(ctx.level || "GCSE").trim();
  const examBoard = String(ctx.board || ctx.examBoard || "AQA").trim();
  const tier = String(ctx.tier || "").trim();
  const pack = resolveTopicPack(topic);

  return {
    status: STAGE_STATUS.COMPLETE,
    title: `${topic} (${examBoard} ${level})`,
    topic,
    subject,
    examBoard,
    board: examBoard,
    level,
    tier,
    topicKey: String(ctx.topicKey || "").trim(),
    objectives: pack.objectives,
    priorKnowledge: pack.priorKnowledge,
    sections: pack.sections,
    keyTerms: pack.keyTerms,
    misconceptions: pack.misconceptions,
    examTips: pack.examTips,
    summary: pack.summary,
    placeholders: [...PHASE1_REQUIRED_PLACEHOLDERS],
    questionsFinalised: false,
    imagePromptsFinalised: false,
    selfCheck: [],
    checkpoint: [],
    quiz: [],
    imagePrompts: [],
    activityPrompts: [],
    notes:
      "Phase 1 Lesson Brain: teaching content only. Questions and image/activity prompts deferred to later phases.",
  };
}

/**
 * @param {{ topic: string, subject: string, level: string, board?: string, topicKey?: string, tier?: string }} ctx
 * @param {object} staged
 * @param {{ phase1Override?: object }} [opts]
 */
async function runLessonBrain(ctx, staged, opts = {}) {
  const phase1 = buildPhase1Lesson(ctx, opts);
  const check = validatePhase1Lesson(phase1);
  if (!check.ok) {
    staged.phase1Lesson = {
      ...phase1,
      status: STAGE_STATUS.FAILED,
      validationIssues: check.issues,
    };
    const err = new Error(
      `Lesson Generator V2 Phase 1 failed: ${(check.issues || []).slice(0, 5).join("; ")}`
    );
    err.status = 422;
    err.code = "LESSON_V2_PHASE1_FAILED";
    err.details = { issues: check.issues };
    throw err;
  }

  staged.phase1Lesson = phase1;
  return staged;
}

module.exports = {
  runLessonBrain,
  buildPhase1Lesson,
  validatePhase1Lesson,
  resolveTopicPack,
};
