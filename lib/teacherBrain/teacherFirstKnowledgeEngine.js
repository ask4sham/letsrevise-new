/**
 * Phase 3H.1 — Teacher-First Knowledge Delivery Engine.
 *
 * Layer 1: Universal teacher-first framework (definition → why → model → examples → vocab).
 * Layer 2: Subject-specific teaching profiles (Biology implemented first).
 * Prompt and Coverage Review only — does not mutate saved lesson blocks.
 */

const {
  flattenPagesToBlocks,
  normalizeText,
  blockHaystack,
  classifyBlockToArchitectureSlot,
} = require("../lessonBlockAnalysis");
const { TEACHER_FIRST_KNOWLEDGE_SLOTS, getSs1BlockNumber } = require("./teacherFirstSs1Architecture");
const {
  UNIVERSAL_TEACHER_FIRST_FRAMEWORK,
  resolveSubjectTeachingProfile,
  resolveTeacherFirstKnowledgeProfile,
} = require("./teacherFirstKnowledgeProfiles");
const { collectProfileKeyWordsTerms, formatKeywordTerm } = require("./keyWordsAuthority");
const { EARLY_BLOCK_LIMIT } = require("./conceptCompressionEngine");
const {
  isRequiredPracticalMode,
  buildRequiredPracticalOpeningPlan,
  formatRequiredPracticalAppendix,
  REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS,
} = require("./requiredPracticalMode");
const { buildSubjectIntelligenceTeacherFirstSupplement } = require("./subjectIntelligenceEngine");

const OPENING_MARKER = "TEACHER-FIRST KNOWLEDGE DELIVERY";

const DEFAULT_OPENING_ORDER = [...UNIVERSAL_TEACHER_FIRST_FRAMEWORK.openingOrder];

const SCENARIO_OPENING_PATTERNS = [
  /\bimagine\b/i,
  /\bpicture yourself\b/i,
  /\bquestion to carry\b/i,
  /\bone day\b/i,
  /\bsuppose\b/i,
  /\bscenario\b/i,
  /\bstory\b/i,
];

function isTeacherFirstOpeningEnabled() {
  return String(process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING || "0").trim() === "1";
}

/**
 * Build scenario policy for early lesson section.
 */
function buildScenarioPolicy() {
  return {
    allowScenarioOnlyAfterCoreModel: true,
    maxShortScenariosOnFirstPage: 1,
    forbidImagineOpening: true,
    forbidQuestionToCarryBeforeDefinition: true,
    scenarioMustSupportCoreModel: true,
    shortScenarioMaxSentences: 3,
    rules: [
      "Scenario allowed only after definition and core model are clear.",
      "Scenario must be short and support the core model.",
      "Scenario must not replace explicit teaching.",
      "Maximum one short scenario on the first page.",
    ],
  };
}

/**
 * Layer 1 universal framework plan (no topic-specific content).
 */
function buildUniversalFrameworkPlan() {
  return {
    layer: UNIVERSAL_TEACHER_FIRST_FRAMEWORK.layer,
    openingOrder: [...UNIVERSAL_TEACHER_FIRST_FRAMEWORK.openingOrder],
    sections: [...UNIVERSAL_TEACHER_FIRST_FRAMEWORK.sections],
    promptInstructions: UNIVERSAL_TEACHER_FIRST_FRAMEWORK.promptInstructions.join("\n"),
  };
}

/**
 * @param {import("./teacherFirstKnowledgeProfiles").TeacherFirstKnowledgeProfile} topicProfile
 */
function planFromTopicProfile(topicProfile) {
  return {
    definition: topicProfile.definition,
    whyItMatters: topicProfile.whyItMatters,
    coreModel: topicProfile.coreModel,
    keyExamples: topicProfile.keyExamples || [],
    examVocabulary: topicProfile.examVocabulary || [],
    keyWordsTerms: topicProfile.keyWordsTerms || collectProfileKeyWordsTerms(topicProfile),
    taxonomyKey: topicProfile.taxonomyKey,
    subjectKey: topicProfile.subjectKey || null,
    profile: topicProfile,
  };
}

function buildIntelligenceMeta(input = {}) {
  return {
    subject: input.subject,
    subjectKey: input.subjectKey,
    topic: input.topic,
    title: input.title,
    subTopic: input.subTopic,
    topicKey: input.topicKey,
    lessonType: input.lessonType,
    examBoard: input.examBoard,
  };
}

/**
 * @param {object} input
 */
function buildTeacherFirstOpeningPlan(input = {}) {
  const enabled = isTeacherFirstOpeningEnabled();
  const scenarioPolicy = buildScenarioPolicy();
  const framework = buildUniversalFrameworkPlan();
  const openingOrder = framework.openingOrder;

  if (!enabled) {
    return {
      enabled: false,
      framework,
      subjectProfile: null,
      topicProfile: null,
      subjectKey: null,
      openingOrder,
      definition: "",
      whyItMatters: "",
      coreModel: "",
      keyExamples: [],
      examVocabulary: [],
      keyWordsTerms: [],
      scenarioPolicy,
      promptInstructions: "",
    };
  }

  if (isRequiredPracticalMode(input)) {
    const rp = buildRequiredPracticalOpeningPlan(input);
    const subjectProfile = resolveSubjectTeachingProfile(input);
    return {
      enabled: true,
      mode: "requiredPractical",
      framework,
      subjectProfile: subjectProfile
        ? {
            subjectKey: subjectProfile.subjectKey,
            label: subjectProfile.label,
            implemented: subjectProfile.implemented,
          }
        : null,
      topicProfile: null,
      subjectKey: subjectProfile?.subjectKey || null,
      openingOrder: REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS.map((s) => s.title),
      definition: "",
      whyItMatters: "",
      coreModel: rp.scientificBackground,
      keyExamples: rp.profile.equipment || [],
      examVocabulary: rp.examVocabulary,
      keyWordsTerms: rp.keyWordsTerms,
      scenarioPolicy,
      promptInstructions:
        "Required Practical Mode: investigation lesson (method, variables, equipment, results, analysis, evaluation) — NOT a general theory overview.",
      taxonomyKey: rp.profile.taxonomyKey,
      profile: rp.profile,
      usesUniversalFrameworkOnly: false,
      requiredPractical: rp,
      topicLabel: rp.topicLabel,
      topicKey: rp.topicKey,
      intelligenceMeta: buildIntelligenceMeta(input),
    };
  }

  const subjectProfile = resolveSubjectTeachingProfile(input);
  const topicProfile =
    input.profile ||
    resolveTeacherFirstKnowledgeProfile({
      topicKey: input.topicKey,
      subTopic: input.subTopic,
      topic: input.topic,
      taxonomyKey: input.taxonomyKey,
      subject: input.subject,
    });

  const promptLines = [...UNIVERSAL_TEACHER_FIRST_FRAMEWORK.promptInstructions];

  if (!topicProfile) {
    return {
      enabled: true,
      framework,
      subjectProfile: subjectProfile
        ? {
            subjectKey: subjectProfile.subjectKey,
            label: subjectProfile.label,
            implemented: subjectProfile.implemented,
          }
        : null,
      topicProfile: null,
      subjectKey: subjectProfile?.subjectKey || null,
      openingOrder,
      definition: "",
      whyItMatters: "",
      coreModel: "",
      keyExamples: [],
      examVocabulary: [],
      keyWordsTerms: [],
      scenarioPolicy,
      promptInstructions: promptLines.join("\n"),
      taxonomyKey: null,
      profile: null,
      usesUniversalFrameworkOnly: true,
      intelligenceMeta: buildIntelligenceMeta(input),
    };
  }

  const planned = planFromTopicProfile(topicProfile);

  if (input.referenceLessonMaterial) {
    promptLines.push(
      "Use teacher reference material for factual accuracy, but still follow teacher-first opening order."
    );
  }

  return {
    enabled: true,
    framework,
    subjectProfile: subjectProfile
      ? {
          subjectKey: subjectProfile.subjectKey,
          label: subjectProfile.label,
          implemented: subjectProfile.implemented,
        }
      : null,
    topicProfile: planned.profile,
    subjectKey: planned.subjectKey || subjectProfile?.subjectKey || null,
    openingOrder,
    definition: planned.definition,
    whyItMatters: planned.whyItMatters,
    coreModel: planned.coreModel,
    keyExamples: planned.keyExamples,
    examVocabulary: planned.examVocabulary,
    keyWordsTerms: planned.keyWordsTerms,
    scenarioPolicy,
    promptInstructions: promptLines.join("\n"),
    taxonomyKey: planned.taxonomyKey,
    profile: planned.profile,
    usesUniversalFrameworkOnly: false,
    intelligenceMeta: buildIntelligenceMeta(input),
  };
}

/**
 * @param {ReturnType<buildTeacherFirstOpeningPlan>} plan
 */
function formatTeacherFirstOpeningAppendix(plan) {
  if (!plan?.enabled) return "";

  if (plan.mode === "requiredPractical") {
    return formatRequiredPracticalAppendix({
      topic: plan.topicLabel,
      subTopic: plan.topicLabel,
      topicKey: plan.topicKey,
    });
  }

  const lines = [
    OPENING_MARKER,
    "",
    "Open the lesson like strong GCSE teaching notes (Save My Exams / CGP style) — not a long story.",
    "",
    "LAYER 1 — UNIVERSAL TEACHER-FIRST FRAMEWORK:",
    ...plan.framework.sections.map((section, i) => `${i + 1}. ${section.label}`),
    "",
    "REQUIRED OPENING ORDER (first page / first 30–40% of teaching blocks):",
    ...plan.openingOrder.map((step, i) => `${i + 1}. ${step}`),
    "",
    plan.promptInstructions,
    "",
    "SCENARIO POLICY (early section):",
    ...plan.scenarioPolicy.rules.map((r) => `- ${r}`),
  ];

  if (plan.topicProfile) {
    lines.push(
      "",
      `LAYER 2 — SUBJECT PROFILE (${plan.subjectProfile?.label || plan.subjectKey || "subject"}):`,
      plan.topicProfile.taxonomyKey
    );
  } else {
    lines.push(
      "",
      "LAYER 2 — SUBJECT PROFILE:",
      "No topic profile matched. Use Layer 1 universal framework only — derive definition, core model, examples, and exam vocabulary from the sub-topic."
    );
  }

  if (plan.definition) {
    lines.push(
      "",
      "Definition:",
      plan.definition,
      "",
      "Why it matters:",
      plan.whyItMatters,
      "",
      "Core GCSE model:",
      plan.coreModel
    );
  }

  if (plan.keyExamples?.length) {
    lines.push("", "Key examples:", ...plan.keyExamples.map((e) => `- ${e}`));
  }

  if (plan.examVocabulary?.length) {
    lines.push("", "Exam vocabulary:", plan.examVocabulary.join(", "));
  }

  if (plan.usesUniversalFrameworkOnly && plan.intelligenceMeta) {
    const siSupplement = buildSubjectIntelligenceTeacherFirstSupplement(plan.intelligenceMeta);
    if (siSupplement) lines.push(siSupplement);
  }

  return lines.join("\n");
}

/**
 * Mandatory SS1 opening-slot fill instructions from Layer 2 plan (prompt only).
 * @param {ReturnType<buildTeacherFirstOpeningPlan>} plan
 */
function buildSs1Layer2MandatoryOpeningSection(plan) {
  if (!plan?.enabled || plan.mode === "requiredPractical" || !plan.coreModel) return "";

  const coreBlock = getSs1BlockNumber("coreModel") || 5;
  const examplesBlock = getSs1BlockNumber("keyExamples") || 6;
  const vocabBlock = getSs1BlockNumber("examVocabulary") || 7;

  const lines = [
    "--------------------------------",
    "TEACHER-FIRST LAYER 2 — MANDATORY OPENING SLOTS (SS1)",
    "--------------------------------",
    "",
    "Populate blocks 3–7 with REAL GCSE content from the profile below.",
    "Do NOT output bracket placeholders such as [example 1], [term 1], [prior idea 1], or [The key GCSE model...].",
    "",
    `Block ${coreBlock} CORE MODEL — must teach this pathway (adapt wording, keep all steps):`,
    plan.coreModel,
  ];

  if (plan.keyExamples?.length) {
    lines.push(
      "",
      `Block ${examplesBlock} KEY EXAMPLES — must include:`,
      ...plan.keyExamples.map((e) => `- ${e}`)
    );
  }

  if (plan.examVocabulary?.length) {
    lines.push(
      "",
      `Block ${vocabBlock} EXAM VOCABULARY — must include all terms:`,
      plan.examVocabulary.join(", ")
    );
  }

  lines.push(
    "",
    "QUALITY RULE: If any bracket placeholder would appear, replace it with topic-specific GCSE content before output."
  );

  return lines.join("\n");
}

/**
 * Mandatory SS1 Key Words block instructions from Layer 2 plan (prompt only).
 * @param {ReturnType<buildTeacherFirstOpeningPlan>} plan
 */
function buildSs1Layer2MandatoryKeywordsSection(plan) {
  if (!plan?.enabled || !plan.topicProfile || !plan.keyWordsTerms?.length) return "";

  const keywordsBlock = getSs1BlockNumber("keywords") || 24;
  const terms = plan.keyWordsTerms.slice(0, 15);

  const lines = [
    "--------------------------------",
    "TEACHER-FIRST LAYER 2 — MANDATORY KEY WORDS (SS1)",
    "--------------------------------",
    "",
    `Block ${keywordsBlock} KEY WORDS — must contain exactly 10 GCSE ${plan.subjectProfile?.label || "Biology"} terms for this topic.`,
    "",
    "Use topic-specific subject vocabulary from this list (choose the 10 most essential):",
    ...terms.map((t) => `- ${formatKeywordTerm(t)}`),
    "",
    "FORMAT (one per line): <strong>Term</strong> – GCSE-friendly definition",
    "",
    "FORBIDDEN as Key Words (exam-framework meta-terms, not subject vocabulary):",
    "Cause, Effect, Structure, Function, Keyword, Explain, Compare, Evidence, Misconception, Mark scheme.",
  ];

  return lines.join("\n");
}

function haystackIncludesAny(hay, terms = []) {
  const h = normalizeText(hay);
  if (!h) return false;
  return terms.some((term) => {
    const t = normalizeText(term);
    return t && h.includes(t);
  });
}

function countVocabMatches(hay, terms = []) {
  const h = normalizeText(hay);
  const matched = [];
  for (const term of terms) {
    const t = normalizeText(term);
    if (t && h.includes(t) && !matched.includes(term)) matched.push(term);
  }
  return { matched, count: matched.length };
}

function blockHasScenarioOpening(block) {
  const hay = blockHaystack(block);
  return SCENARIO_OPENING_PATTERNS.some((re) => re.test(hay));
}

function blockHasDefinitionSignals(block, profile) {
  const hay = blockHaystack(block);
  const terms = profile?.definitionMatchTerms || [];
  return haystackIncludesAny(hay, terms) || /\bdefinition\b/i.test(hay);
}

function isScenarioBlock(block) {
  return classifyBlockToArchitectureSlot(block) === "scenario" || blockHasScenarioOpening(block);
}

function blockMatchesKnowledgeSlot(block, slot, profile) {
  if (classifyBlockToArchitectureSlot(block) === slot) return true;
  const hay = blockHaystack(block);
  if (slot === "definition") return blockHasDefinitionSignals(block, profile);
  if (slot === "whyItMatters") {
    return profile
      ? haystackIncludesAny(hay, profile.whyMatchTerms)
      : /why it matters|important because|matters because/i.test(hay);
  }
  if (slot === "coreModel") {
    return profile
      ? haystackIncludesAny(hay, profile.coreModelMatchTerms)
      : /core model|model:/i.test(hay);
  }
  if (slot === "keyExamples") return /key examples/i.test(hay);
  if (slot === "examVocabulary") return /exam vocabulary/i.test(hay);
  return false;
}

/**
 * @param {object} input
 * @param {object[]} [input.pages]
 * @param {ReturnType<buildTeacherFirstOpeningPlan>} [input.plan]
 */
function scoreTeacherFirstOpeningCoverage(input = {}) {
  const plan = input.plan || buildTeacherFirstOpeningPlan(input);
  if (!plan.enabled) {
    return {
      enabled: false,
      openingScorePct: 0,
      definitionAppearsEarly: false,
      whyItMattersAppearsEarly: false,
      coreModelAppearsEarly: false,
      examVocabularyPresent: false,
      examVocabularyMatched: [],
      examVocabularyTotal: 0,
      scenarioBeforeDefinition: false,
      scenarioBeforeCoreKnowledge: false,
      openingTooScenarioHeavy: false,
      definitionDelayed: false,
      coreModelDelayed: false,
      examVocabularyMissing: false,
      keyExamplesAppearsEarly: false,
      flags: [],
      warnings: [],
    };
  }

  const profile = plan.profile || resolveTeacherFirstKnowledgeProfile(input);
  const blocks = flattenPagesToBlocks(input.pages);
  const earlyBlocks = blocks.slice(0, EARLY_BLOCK_LIMIT);
  const earlyHay = normalizeText(earlyBlocks.map((b) => blockHaystack(b)).join(" "));

  const definitionAppearsEarly = profile
    ? haystackIncludesAny(earlyHay, profile.definitionMatchTerms)
    : /\bdefinition\b/i.test(earlyHay);
  const whyItMattersAppearsEarly = profile
    ? haystackIncludesAny(earlyHay, profile.whyMatchTerms)
    : /why it matters|important because|matters because/i.test(earlyHay);
  const coreModelAppearsEarly = profile
    ? haystackIncludesAny(earlyHay, profile.coreModelMatchTerms)
    : /core model|model:/i.test(earlyHay);

  const vocabTerms = plan.examVocabulary?.length
    ? plan.examVocabulary
    : profile?.examVocabMatchTerms || [];
  const { matched, count } = countVocabMatches(earlyHay, vocabTerms);
  const examVocabularyTotal = vocabTerms.length;
  const examVocabularyPresent = profile
    ? count >= Math.min(3, examVocabularyTotal || 3)
    : count >= 3 || /exam vocabulary|key terms/i.test(earlyHay);

  let scenarioBeforeDefinition = false;
  let scenarioBeforeCoreKnowledge = false;
  let openingTooScenarioHeavy = false;
  let definitionBlockIndex = -1;
  let firstScenarioBlockIndex = -1;
  const knowledgeIndices = Object.fromEntries(
    TEACHER_FIRST_KNOWLEDGE_SLOTS.map((slot) => [slot, -1])
  );

  earlyBlocks.forEach((block, idx) => {
    if (definitionBlockIndex < 0 && blockHasDefinitionSignals(block, profile)) {
      definitionBlockIndex = idx;
    }
    if (firstScenarioBlockIndex < 0 && isScenarioBlock(block)) {
      firstScenarioBlockIndex = idx;
    }
    for (const slot of TEACHER_FIRST_KNOWLEDGE_SLOTS) {
      if (knowledgeIndices[slot] < 0 && blockMatchesKnowledgeSlot(block, slot, profile)) {
        knowledgeIndices[slot] = idx;
      }
    }
  });

  const keyExamplesAppearsEarly =
    knowledgeIndices.keyExamples >= 0 || /key examples/i.test(earlyHay);

  if (firstScenarioBlockIndex >= 0) {
    if (definitionBlockIndex < 0 || firstScenarioBlockIndex < definitionBlockIndex) {
      scenarioBeforeDefinition = true;
    }
    scenarioBeforeCoreKnowledge = !TEACHER_FIRST_KNOWLEDGE_SLOTS.every(
      (slot) => knowledgeIndices[slot] >= 0 && knowledgeIndices[slot] < firstScenarioBlockIndex
    );
    if (firstScenarioBlockIndex <= 2) {
      openingTooScenarioHeavy = true;
    }
  }

  if (earlyBlocks[0] && isScenarioBlock(earlyBlocks[0])) {
    openingTooScenarioHeavy = true;
  }

  const definitionDelayed = !definitionAppearsEarly;
  const coreModelDelayed = !coreModelAppearsEarly;
  const examVocabularyMissing = profile ? !examVocabularyPresent : false;

  const checks = [
    definitionAppearsEarly,
    whyItMattersAppearsEarly,
    coreModelAppearsEarly,
    keyExamplesAppearsEarly,
    profile ? examVocabularyPresent : true,
    !scenarioBeforeDefinition,
    !scenarioBeforeCoreKnowledge,
  ];
  const passed = checks.filter(Boolean).length;
  let openingScorePct = Math.round((passed / checks.length) * 100);
  if (scenarioBeforeCoreKnowledge) {
    openingScorePct = Math.min(openingScorePct, 25);
  }

  const flags = [];
  if (openingTooScenarioHeavy) flags.push("Opening too scenario-heavy");
  if (definitionDelayed) flags.push("Definition delayed");
  if (coreModelDelayed) flags.push("Core model delayed");
  if (examVocabularyMissing) flags.push("Exam vocabulary missing");
  if (scenarioBeforeDefinition) flags.push("Scenario before definition");
  if (scenarioBeforeCoreKnowledge) flags.push("Scenario before core knowledge");

  return {
    enabled: true,
    taxonomyKey: plan.taxonomyKey || profile?.taxonomyKey || null,
    subjectKey: plan.subjectKey || profile?.subjectKey || null,
    usesUniversalFrameworkOnly: plan.usesUniversalFrameworkOnly ?? !profile,
    openingScorePct,
    definitionAppearsEarly,
    whyItMattersAppearsEarly,
    coreModelAppearsEarly,
    examVocabularyPresent,
    examVocabularyMatched: matched,
    examVocabularyTotal,
    scenarioBeforeDefinition,
    scenarioBeforeCoreKnowledge,
    keyExamplesAppearsEarly,
    openingTooScenarioHeavy,
    definitionDelayed,
    coreModelDelayed,
    examVocabularyMissing,
    flags,
    warnings: flags,
    expectedOpening: {
      definition: plan.definition,
      whyItMatters: plan.whyItMatters,
      coreModel: plan.coreModel,
      keyExamples: plan.keyExamples,
      examVocabulary: plan.examVocabulary,
    },
  };
}

module.exports = {
  OPENING_MARKER,
  DEFAULT_OPENING_ORDER,
  UNIVERSAL_TEACHER_FIRST_FRAMEWORK,
  isTeacherFirstOpeningEnabled,
  buildScenarioPolicy,
  buildUniversalFrameworkPlan,
  buildTeacherFirstOpeningPlan,
  formatTeacherFirstOpeningAppendix,
  buildSs1Layer2MandatoryOpeningSection,
  buildSs1Layer2MandatoryKeywordsSection,
  scoreTeacherFirstOpeningCoverage,
  blockHasScenarioOpening,
};
