/**
 * Phase 3H.1.6 — Dashboard (JSON) teacher-first opening alignment.
 * When TEACHER_BRAIN_TEACHER_FIRST_OPENING=1, generate-and-save uses the same
 * knowledge-before-scenario order as SS1 without changing the JSON schema.
 */

const {
  classifyBlockToArchitectureSlot,
  blockHaystack,
} = require("../lessonBlockAnalysis");
const { isTeacherFirstOpeningEnabled, buildTeacherFirstOpeningPlan } = require("./teacherFirstKnowledgeEngine");

const DASHBOARD_OPENING_SLOTS = [
  { key: "objectives", title: "Revision Objectives", type: "text", role: "lessonObjectives" },
  { key: "priorKnowledge", title: "Prior Knowledge", type: "text", role: "priorKnowledge" },
  { key: "definition", title: "Definition", type: "text", role: "definition" },
  { key: "whyItMatters", title: "Why it matters", type: "text", role: "whyItMatters" },
  { key: "coreModel", title: "Core model", type: "keyIdea", role: "coreRule" },
  { key: "keyExamples", title: "Key examples", type: "text", role: "keyExamples" },
  { key: "examVocabulary", title: "Exam vocabulary", type: "text", role: "examVocabulary" },
  { key: "scenario", title: "Scenario", type: "text", role: "hook" },
  { key: "coreTeaching", title: "Core Teaching", type: "text", role: "concept" },
];

const DASHBOARD_OPENING_SLOT_KEYS = DASHBOARD_OPENING_SLOTS.map((s) => s.key);

const PROTECTED_TRIM_ROLES = new Set([
  "hook",
  "coreRule",
  "commonMistake",
  "patternRecognition",
  "workedExample",
  "synthesis",
  "finalMemoryRule",
  "lessonObjectives",
  "priorKnowledge",
  "definition",
  "whyItMatters",
  "keyExamples",
  "examVocabulary",
  "whatToNotice",
]);

function trimDashboardBlocks(blocks, maxBlocks = 24) {
  if (blocks.length <= maxBlocks) return blocks;
  const out = [...blocks];
  while (out.length > maxBlocks) {
    let removeIdx = -1;
    for (let i = DASHBOARD_OPENING_SLOTS.length; i < out.length; i++) {
      const role = String(out[i]?.role || "");
      const type = String(out[i]?.type || "").toLowerCase();
      if (type === "diagram" || type === "checkpoint" || type === "examtip") continue;
      if (PROTECTED_TRIM_ROLES.has(role)) continue;
      if (type === "text" && role === "concept") {
        removeIdx = i;
        break;
      }
    }
    if (removeIdx < 0) {
      for (let i = DASHBOARD_OPENING_SLOTS.length; i < out.length; i++) {
        const role = String(out[i]?.role || "");
        if (!PROTECTED_TRIM_ROLES.has(role)) {
          removeIdx = i;
          break;
        }
      }
    }
    if (removeIdx < 0) break;
    out.splice(removeIdx, 1);
  }
  return out;
}

function isDashboardTeacherFirstEnabled() {
  return isTeacherFirstOpeningEnabled();
}

function dashboardBlockShape({ type, title, role, content, source = {} }) {
  const base = {
    type: type || source.type || "text",
    title: title || source.title || "",
    role: role || source.role || "",
    content: String(content ?? source.content ?? "").trim(),
  };
  if (base.type === "diagram") {
    base.caption = source.caption || base.content || "image here";
    base.content = source.content || base.caption || "image here";
  }
  if (base.type === "checkpoint") {
    return {
      ...base,
      prompt: source.prompt || source.question || "Quick check",
      questionType: source.questionType === "mcq" ? "mcq" : "short",
      options: Array.isArray(source.options) ? source.options : [],
      correctAnswer: source.correctAnswer || source.answer || "",
      explanation: source.explanation || "",
      question: source.question || source.prompt || "",
      answer: source.answer || source.correctAnswer || "",
    };
  }
  if (base.type === "keyIdea" && !base.title) {
    base.title = "Key Idea";
  }
  return base;
}

function normalizeOpeningBlock(block, slotDef) {
  return dashboardBlockShape({
    type: slotDef.type || block.type || "text",
    title: slotDef.title,
    role: slotDef.role,
    content: block.content,
    source: block,
  });
}

/**
 * Title/role-first slot resolver for opening enforcement.
 * Avoids haystack "definition" matches on Core Teaching / objectives bodies stealing the slot.
 */
function resolveOpeningSlotStrict(block) {
  const role = String(block?.role || "").toLowerCase();
  const title = String(block?.title || "").toLowerCase().trim();

  if (
    role === "lessonobjectives" ||
    role === "objectives" ||
    /revision objectives|lesson objectives/.test(title)
  ) {
    return "objectives";
  }
  if (role === "priorknowledge" || /prior knowledge/.test(title)) return "priorKnowledge";
  if (role === "definition" || title === "definition" || /^definition\b/.test(title)) {
    return "definition";
  }
  if (role === "whyitmatters" || /why it matters/.test(title)) return "whyItMatters";
  if (
    role === "coremodel" ||
    (role === "corerule" && isDashboardTeacherFirstEnabled()) ||
    /core model/.test(title)
  ) {
    return "coreModel";
  }
  if (role === "keyexamples" || /key examples/.test(title)) return "keyExamples";
  if (role === "examvocabulary" || /exam vocabulary/.test(title)) return "examVocabulary";
  if (role === "hook" || role === "scenario" || /^scenario\b/.test(title)) return "scenario";
  if (role === "concept" || role === "coreteaching" || /core teaching/.test(title)) {
    return "coreTeaching";
  }

  const slot = classifyBlockToArchitectureSlot(block);
  if (slot === "coreRule" && isDashboardTeacherFirstEnabled()) return "coreModel";
  if (slot === "definition" && (role === "concept" || /core teaching/.test(title))) {
    return "coreTeaching";
  }
  return slot;
}

/** Higher score = stronger claim on an opening slot (title/role beats body-text heuristics). */
function openingSlotMatchScore(block, slotKey) {
  const role = String(block?.role || "").toLowerCase();
  const title = String(block?.title || "").toLowerCase().trim();

  const titleExact = {
    objectives:
      title === "revision objectives" ||
      title === "lesson objectives" ||
      /revision objectives|lesson objectives/.test(title),
    priorKnowledge: title === "prior knowledge" || /prior knowledge/.test(title),
    definition: title === "definition" || /^definition\b/.test(title),
    whyItMatters: title === "why it matters" || /why it matters/.test(title),
    coreModel: title === "core model" || /core model/.test(title),
    keyExamples: title === "key examples" || /key examples/.test(title),
    examVocabulary: title === "exam vocabulary" || /exam vocabulary/.test(title),
    scenario: title === "scenario" || /^scenario\b/.test(title),
    coreTeaching: title === "core teaching" || /core teaching/.test(title),
  };

  const roleExact = {
    objectives: role === "lessonobjectives" || role === "objectives",
    priorKnowledge: role === "priorknowledge",
    definition: role === "definition",
    whyItMatters: role === "whyitmatters",
    coreModel: role === "coremodel" || role === "corerule",
    keyExamples: role === "keyexamples",
    examVocabulary: role === "examvocabulary",
    scenario: role === "hook" || role === "scenario",
    coreTeaching: role === "concept" || role === "coreteaching",
  };

  if (roleExact[slotKey] && titleExact[slotKey]) return 4;
  if (roleExact[slotKey] || titleExact[slotKey]) return 3;
  if (resolveOpeningSlotStrict(block) === slotKey) return 2;
  return 0;
}

function pickOpeningBlockForSlot(blocks, slotKey, used) {
  let best = null;
  let bestScore = 0;
  let bestIdx = -1;

  blocks.forEach((block, index) => {
    if (used.has(index)) return;
    const score = openingSlotMatchScore(block, slotKey);
    if (score > bestScore) {
      bestScore = score;
      best = block;
      bestIdx = index;
    }
  });

  if (bestIdx >= 0) used.add(bestIdx);
  return best;
}

function resolveOpeningSlot(block) {
  return resolveOpeningSlotStrict(block);
}

function createOpeningBlockFromPlan(slotDef, plan, topicLabel) {
  const topic = String(topicLabel || "this topic").trim() || "this topic";
  let content = "";

  switch (slotDef.key) {
    case "objectives":
      content =
        `By the end of this lesson you will:\n` +
        `• State the definition of ${topic}\n` +
        `• Explain why it matters\n` +
        `• Apply the core model in exam-style answers`;
      break;
    case "priorKnowledge":
      content =
        "Before we start, recall what you already know about how organisms detect and respond to changes.";
      break;
    case "definition":
      content =
        plan.definition ||
        `**Definition:** ${topic} — state the precise GCSE definition using spec vocabulary.`;
      break;
    case "whyItMatters":
      content =
        plan.whyItMatters ||
        `**Why it matters:** ${topic} is tested because examiners reward clear explanation of why the process matters for organisms.`;
      break;
    case "coreModel":
      content =
        plan.coreModel ||
        `**Core model:** State the main pathway or comparison for ${topic} that examiners expect.`;
      break;
    case "keyExamples":
      content =
        (plan.keyExamples || []).length > 0
          ? (plan.keyExamples || []).map((e) => `• ${e}`).join("\n")
          : `• One concrete ${topic} example\n• One comparison or application examiners recognise`;
      break;
    case "examVocabulary":
      content =
        (plan.examVocabulary || []).length > 0
          ? `**Exam vocabulary:** ${(plan.examVocabulary || []).join(", ")}`
          : `**Exam vocabulary:** Use precise spec terms for ${topic} in every exam answer.`;
      break;
    case "scenario":
      content =
        `A short context linking ${topic} to something you already understand — then apply the core model taught above.`;
      break;
    case "coreTeaching":
      content =
        `Now build your understanding of ${topic} step by step using the definition and core model above.`;
      break;
    default:
      content = "";
  }

  return dashboardBlockShape({
    type: slotDef.type,
    title: slotDef.title,
    role: slotDef.key === "scenario" ? "hook" : slotDef.role,
    content,
  });
}

/**
 * Prompt section for Dashboard JSON generate-and-save (supersedes classic hook-first stencil).
 */
function buildDashboardTeacherFirstPromptSection(ctx = {}) {
  if (!isDashboardTeacherFirstEnabled()) return "";

  const topic = ctx.topic || ctx.subTopic || "this topic";
  const lines = [
    "",
    "## DASHBOARD TEACHER-FIRST OPENING (MANDATORY — OVERRIDES CLASSIC HOOK-FIRST OPENING)",
    "",
    "When this section is present you MUST NOT begin with a hook/scenario.",
    "The first nine blocks in pages[0].blocks MUST appear in this exact order with these titles and roles:",
    "",
    '1. type "text", title "Revision Objectives", role "lessonObjectives"',
    '2. type "text", title "Prior Knowledge", role "priorKnowledge"',
    '3. type "text", title "Definition", role "definition" — start with the precise GCSE definition',
    '4. type "text", title "Why it matters", role "whyItMatters"',
    '5. type "keyIdea", title "Core model", role "coreRule"',
    '6. type "text", title "Key examples", role "keyExamples"',
    '7. type "text", title "Exam vocabulary", role "examVocabulary"',
    '8. type "text", title "Scenario", role "hook" — SHORT scenario only AFTER blocks 3–7',
    '9. type "text", title "Core Teaching", role "concept"',
    "",
    "Then continue with commonMistake, patternRecognition, diagrams, checkpoints, synthesis, and final memory rule.",
    "Do NOT put Scenario (hook) before block 8.",
    'Do NOT open with "Imagine..." or a long story before Definition.',
    `Teach core knowledge for **${topic}** before any scenario.`,
    "",
  ];
  return lines.join("\n");
}

/**
 * Structural enforcement for sanitized JSON lesson drafts (generate-and-save path).
 * @param {object} draft
 * @param {{ topic?: string, topicKey?: string, subTopic?: string, subject?: string }} ctx
 */
function enforceDashboardTeacherFirstOpening(draft, ctx = {}) {
  if (!isDashboardTeacherFirstEnabled() || !draft?.pages?.length) return draft;

  const plan = buildTeacherFirstOpeningPlan({
    topic: ctx.topic,
    topicKey: ctx.topicKey,
    subTopic: ctx.subTopic || ctx.topic,
    subject: ctx.subject,
  });
  const topicLabel = ctx.subTopic || ctx.topic || "this topic";

  for (const page of draft.pages) {
    const blocks = Array.isArray(page.blocks) ? page.blocks : [];
    if (!blocks.length) continue;

    const used = new Set();
    const bySlot = {};

    for (const slotDef of DASHBOARD_OPENING_SLOTS) {
      const picked = pickOpeningBlockForSlot(blocks, slotDef.key, used);
      if (picked) bySlot[slotDef.key] = picked;
    }

    const opening = DASHBOARD_OPENING_SLOTS.map((slotDef) => {
      const existing = bySlot[slotDef.key];
      if (existing) return normalizeOpeningBlock(existing, slotDef);
      return createOpeningBlockFromPlan(slotDef, plan, topicLabel);
    });

    const remainder = blocks.filter((_, i) => !used.has(i));
    page.blocks = [...opening, ...remainder];
  }

  return draft;
}

module.exports = {
  DASHBOARD_OPENING_SLOTS,
  DASHBOARD_OPENING_SLOT_KEYS,
  isDashboardTeacherFirstEnabled,
  buildDashboardTeacherFirstPromptSection,
  enforceDashboardTeacherFirstOpening,
  resolveOpeningSlot,
  resolveOpeningSlotStrict,
  openingSlotMatchScore,
};
