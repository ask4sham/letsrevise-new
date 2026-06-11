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
const { resolveSubTopicProfile } = require("./subTopicProfiles");
const { resolveTeachingQualityProfile } = require("./teachingQualityProfiles");
const { profileObjectiveBullets } = require("./objectivesAuthority");
const {
  isRequiredPracticalMode,
  REQUIRED_PRACTICAL_DASHBOARD_SLOTS,
  buildRequiredPracticalDashboardPromptSection,
  buildRequiredPracticalOpeningPlan,
  slotContentForPlan,
  stripForbiddenTeacherFirstBlocks,
  stripDuplicateSpecialistBlocksFromRemainder,
  enforceMandatorySpecialistBlocks,
  enforceReactionTimeInteractiveDiagram,
} = require("./requiredPracticalMode");

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

function openingSlotMatchScoreForDef(block, slotDef) {
  const role = String(block?.role || "").toLowerCase();
  const title = String(block?.title || "").toLowerCase().trim();
  const slotTitle = String(slotDef.title || "").toLowerCase().trim();
  const slotRole = String(slotDef.role || "").toLowerCase();

  if (title === slotTitle) return 4;
  if (role === slotRole && slotRole) return 3;
  if (slotTitle && (title.includes(slotTitle) || slotTitle.includes(title))) return 2;
  return 0;
}

function pickOpeningBlockForSlot(blocks, slotKey, used, slotDef = null) {
  let best = null;
  let bestScore = 0;
  let bestIdx = -1;

  blocks.forEach((block, index) => {
    if (used.has(index)) return;
    const score = slotDef
      ? openingSlotMatchScoreForDef(block, slotDef)
      : openingSlotMatchScore(block, slotKey);
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

function normalizePlaceholderHaystack(content = "") {
  return String(content)
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const UNIVERSAL_OPENING_PLACEHOLDER_PHRASES = [
  "state the definition of",
  "in clear gcse language",
  "clearly at gcse level",
  "using spec vocabulary",
  "examiners reward",
  "examiners expect",
  "examiners recognise",
  "examiners recognize",
  "exam-style answers",
  "step by step using the definition and core model above",
  "apply the core model taught above",
  "something you already understand",
];

const SLOT_OPENING_PLACEHOLDER_PHRASES = {
  objectives: ["by the end of this lesson you will", "apply the core model in exam-style answers"],
  priorKnowledge: [
    "how organisms detect and respond to changes",
    "recall what you already know about how organisms",
  ],
  definition: ["state the precise gcse definition", "— state the precise gcse definition"],
  whyItMatters: [
    "is tested because examiners reward clear explanation",
    "why the process matters for organisms",
  ],
  coreModel: ["state the main pathway or comparison for", "that examiners expect"],
  keyExamples: ["one comparison or application examiners"],
  examVocabulary: ["use precise spec terms for", "in every exam answer", "exam vocabulary: use precise spec terms"],
  scenario: ["a short context linking", "then apply the core model taught above"],
  coreTeaching: [
    "now build your understanding of",
    "step by step using the definition and core model above",
  ],
};

function hasOpeningProfile(plan) {
  return Boolean(plan?.profile || plan?.topicProfile || (plan?.definition && plan?.usesUniversalFrameworkOnly === false));
}

function openingContentLooksSubstantive(content, slotKey, ctx = {}) {
  const hay = normalizePlaceholderHaystack(content);
  if (hay.length < 25) return false;

  const plan = ctx.plan;
  const vocabTerms = plan?.profile?.examVocabMatchTerms || plan?.examVocabulary || [];
  if (vocabTerms.length >= 2) {
    const matched = vocabTerms.filter((term) => hay.includes(String(term).toLowerCase()));
    if (matched.length >= 2) return true;
  }

  if (slotKey === "definition" && /\b(is|are|means)\b/.test(hay) && hay.length > 40) {
    if (!/state the (?:precise )?gcse definition|state the definition of/.test(hay)) {
      return true;
    }
  }

  if (slotKey === "coreModel" && /→|->/.test(hay) && hay.length > 30) {
    return true;
  }

  return false;
}

/**
 * Detect generic opening-slot scaffolding (createOpeningBlockFromPlan or LLM meta-instructions).
 * @param {string} content
 * @param {string} slotKey
 * @param {{ plan?: object, topicLabel?: string }} [ctx]
 */
function openingBlockIsPlaceholder(content, slotKey, ctx = {}) {
  const raw = String(content ?? "").trim();
  if (!raw) return true;
  if (openingContentLooksSubstantive(raw, slotKey, ctx)) return false;

  const hay = normalizePlaceholderHaystack(raw);
  if (hay.length < 25) return true;

  const topic = normalizePlaceholderHaystack(ctx.topicLabel || "this topic");
  const phrases = [
    ...UNIVERSAL_OPENING_PLACEHOLDER_PHRASES,
    ...(SLOT_OPENING_PLACEHOLDER_PHRASES[slotKey] || []),
  ];

  if (phrases.some((phrase) => hay.includes(phrase))) return true;

  if (slotKey === "objectives" && hay.includes("explain why it matters") && raw.length <= 120) {
    return true;
  }

  if (slotKey === "keyExamples" && new RegExp(`one concrete ${topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} example`).test(hay)) {
    return true;
  }

  if (slotKey === "examVocabulary" && hay.includes(`use precise spec terms for ${topic}`)) {
    return true;
  }

  if (slotKey === "definition" && hay.includes(`definition: ${topic}`) && hay.includes("state the precise")) {
    return true;
  }

  return false;
}

function buildProfileObjectivesContent(plan, topicLabel, ctx = {}) {
  const subProfile = resolveSubTopicProfile({
    topicKey: ctx.topicKey,
    topic: ctx.topic,
    subTopic: ctx.subTopic || topicLabel,
  });
  const bullets = profileObjectiveBullets(subProfile);
  if (bullets.length >= 2) {
    return (
      "By the end of this lesson you will:\n" +
      bullets.map((b) => `• ${String(b).replace(/^👉\s*/, "").trim()}`).join("\n")
    );
  }

  if (plan.definition && plan.whyItMatters && plan.coreModel) {
    const defLead = plan.definition.split(".")[0].trim();
    return (
      "By the end of this lesson you will:\n" +
      `• Define and explain: ${defLead}\n` +
      `• Explain why it matters: ${plan.whyItMatters}\n` +
      `• Apply this model in exam answers: ${plan.coreModel}`
    );
  }

  return null;
}

function buildProfilePriorKnowledgeContent(plan, topicLabel) {
  const terms = (plan.keyWordsTerms || plan.examVocabulary || []).slice(0, 4);
  if (terms.length >= 2) {
    return `Before we start, recall what you already know about ${topicLabel}: ${terms.slice(0, 3).join(", ")}.`;
  }
  return null;
}

function buildProfileScenarioContent(plan, topicLabel, ctx = {}) {
  const tqp = resolveTeachingQualityProfile({
    topic: ctx.topic,
    subTopic: ctx.subTopic || topicLabel,
  });
  const chain = tqp?.reasoningChains?.[0];
  if (chain?.steps?.length >= 2) {
    const steps = chain.steps.slice(0, 2).join(". ");
    const model = plan.coreModel ? ` Apply ${plan.coreModel}.` : "";
    return `${chain.label}: ${steps}.${model}`;
  }

  if ((plan.keyExamples || []).length > 0) {
    const model = plan.coreModel || "the core model";
    return `Consider ${plan.keyExamples[0]} — a familiar context for ${topicLabel}. Use ${model} to explain the response.`;
  }

  return null;
}

function buildProfileCoreTeachingContent(plan, topicLabel, ctx = {}) {
  const subProfile = resolveSubTopicProfile({
    topicKey: ctx.topicKey,
    topic: ctx.topic,
    subTopic: ctx.subTopic || topicLabel,
  });
  if (Array.isArray(subProfile?.summaryBullets) && subProfile.summaryBullets.length >= 3) {
    return (
      `Let's build ${topicLabel} step by step:\n` +
      subProfile.summaryBullets.slice(0, 5).map((b, i) => `${i + 1}. ${b}`).join("\n")
    );
  }

  const tqp = resolveTeachingQualityProfile({
    topic: ctx.topic,
    subTopic: ctx.subTopic || topicLabel,
  });
  const chain = tqp?.reasoningChains?.[0];
  if (chain?.steps?.length >= 3) {
    return (
      `Let's build ${topicLabel} step by step:\n` +
      chain.steps.slice(0, 4).map((step, i) => `${i + 1}. ${step}`).join("\n")
    );
  }

  if (plan.definition && plan.coreModel) {
    return (
      `Let's build ${topicLabel} step by step:\n` +
      `1. ${plan.definition}\n` +
      `2. Key pathway: ${plan.coreModel}\n` +
      "3. Apply this to exam-style explanations."
    );
  }

  return null;
}

function resolveOpeningSlotContent(slotKey, plan, topicLabel, ctx = {}) {
  const topic = String(topicLabel || "this topic").trim() || "this topic";
  const profiled = hasOpeningProfile(plan);

  switch (slotKey) {
    case "objectives": {
      if (profiled) {
        const built = buildProfileObjectivesContent(plan, topic, ctx);
        if (built) return built;
      }
      return (
        `By the end of this lesson you will:\n` +
        `• State the definition of ${topic}\n` +
        `• Explain why it matters\n` +
        `• Apply the core model in exam-style answers`
      );
    }
    case "priorKnowledge": {
      if (profiled) {
        const built = buildProfilePriorKnowledgeContent(plan, topic);
        if (built) return built;
      }
      return "Before we start, recall what you already know about how organisms detect and respond to changes.";
    }
    case "definition":
      return (
        plan.definition ||
        `**Definition:** ${topic} — state the precise GCSE definition using spec vocabulary.`
      );
    case "whyItMatters":
      return (
        plan.whyItMatters ||
        `**Why it matters:** ${topic} is tested because examiners reward clear explanation of why the process matters for organisms.`
      );
    case "coreModel":
      return (
        plan.coreModel ||
        `**Core model:** State the main pathway or comparison for ${topic} that examiners expect.`
      );
    case "keyExamples":
      return (plan.keyExamples || []).length > 0
        ? (plan.keyExamples || []).map((e) => `• ${e}`).join("\n")
        : `• One concrete ${topic} example\n• One comparison or application examiners recognise`;
    case "examVocabulary":
      return (plan.examVocabulary || []).length > 0
        ? `**Exam vocabulary:** ${(plan.examVocabulary || []).join(", ")}`
        : `**Exam vocabulary:** Use precise spec terms for ${topic} in every exam answer.`;
    case "scenario": {
      if (profiled) {
        const built = buildProfileScenarioContent(plan, topic, ctx);
        if (built) return built;
      }
      return `A short context linking ${topic} to something you already understand — then apply the core model taught above.`;
    }
    case "coreTeaching": {
      if (profiled) {
        const built = buildProfileCoreTeachingContent(plan, topic, ctx);
        if (built) return built;
      }
      return `Now build your understanding of ${topic} step by step using the definition and core model above.`;
    }
    default:
      return "";
  }
}

function createOpeningBlockFromPlan(slotDef, plan, topicLabel, ctx = {}) {
  if (plan?.mode === "requiredPractical") {
    return dashboardBlockShape({
      type: slotDef.type,
      title: slotDef.title,
      role: slotDef.role,
      content: slotContentForPlan(slotDef.key, plan),
    });
  }

  const content = resolveOpeningSlotContent(slotDef.key, plan, topicLabel, ctx);

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
  if (isRequiredPracticalMode(ctx)) {
    return buildRequiredPracticalDashboardPromptSection(ctx);
  }

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
  if (!draft?.pages?.length) return draft;

  const rpMode = isRequiredPracticalMode(ctx);
  if (!rpMode && !isDashboardTeacherFirstEnabled()) return draft;

  const openingSlots = rpMode ? REQUIRED_PRACTICAL_DASHBOARD_SLOTS : DASHBOARD_OPENING_SLOTS;
  const plan = rpMode
    ? buildRequiredPracticalOpeningPlan({
        topic: ctx.topic,
        topicKey: ctx.topicKey,
        subTopic: ctx.subTopic || ctx.topic,
        subject: ctx.subject,
      })
    : buildTeacherFirstOpeningPlan({
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

    for (const slotDef of openingSlots) {
      const picked = pickOpeningBlockForSlot(blocks, slotDef.key, used, rpMode ? slotDef : null);
      if (picked) bySlot[slotDef.key] = picked;
    }

    const opening = openingSlots.map((slotDef) => {
      const existing = bySlot[slotDef.key];
      if (rpMode) {
        if (existing) return normalizeOpeningBlock(existing, slotDef);
        return createOpeningBlockFromPlan(slotDef, plan, topicLabel, ctx);
      }

      const fallbackBlock = createOpeningBlockFromPlan(slotDef, plan, topicLabel, ctx);
      if (!existing) return fallbackBlock;

      const normalized = normalizeOpeningBlock(existing, slotDef);
      const placeholderCtx = { ...ctx, topicLabel, plan };
      if (openingBlockIsPlaceholder(normalized.content, slotDef.key, placeholderCtx)) {
        return { ...normalized, content: fallbackBlock.content };
      }
      return normalized;
    });

    let remainder = blocks.filter((_, i) => !used.has(i));
    if (rpMode) {
      remainder = stripForbiddenTeacherFirstBlocks(remainder);
      remainder = stripDuplicateSpecialistBlocksFromRemainder(remainder);
    }
    page.blocks = enforceMandatorySpecialistBlocks([...opening, ...remainder], plan);
    if (rpMode) {
      page.blocks = enforceReactionTimeInteractiveDiagram(page.blocks, {
        topic: ctx.topic,
        topicKey: ctx.topicKey,
        subTopic: ctx.subTopic || ctx.topic,
      });
    }
  }

  return draft;
}

/**
 * RP structural enforcement — runs even when Teacher-First V1 flag is off.
 * @param {object} draft
 * @param {{ topic?: string, topicKey?: string, subTopic?: string, subject?: string }} ctx
 */
function enforceRequiredPracticalLessonStructure(draft, ctx = {}) {
  if (!isRequiredPracticalMode(ctx) || !draft?.pages?.length) return draft;
  return enforceDashboardTeacherFirstOpening(draft, ctx);
}

module.exports = {
  DASHBOARD_OPENING_SLOTS,
  DASHBOARD_OPENING_SLOT_KEYS,
  REQUIRED_PRACTICAL_DASHBOARD_SLOTS,
  isDashboardTeacherFirstEnabled,
  buildDashboardTeacherFirstPromptSection,
  enforceDashboardTeacherFirstOpening,
  enforceRequiredPracticalLessonStructure,
  resolveOpeningSlot,
  resolveOpeningSlotStrict,
  openingSlotMatchScore,
  openingSlotMatchScoreForDef,
  openingBlockIsPlaceholder,
  resolveOpeningSlotContent,
  createOpeningBlockFromPlan,
};
