/**
 * Teacher Brain Phase 4 — Lesson Coverage Intelligence.
 *
 * Tracks concepts taught / tested, misconceptions addressed, and exam skills assessed.
 * Gates and balances generation so no concept dominates unless it is the central objective.
 */

const {
  flattenPagesToBlocks,
  normalizeText,
  blockHaystack,
  isTeachBlock,
  isInteractionBlock,
} = require("../lessonBlockAnalysis");
const {
  rerankCoveragePoolByPriority,
  isPriorityEngineEnabled,
  getPriorityTier,
} = require("./conceptPriorityEngine");

const COGNITIVE_SKILLS = ["Recall", "Explain", "Apply", "Analyse", "Evaluate"];

const GENERATION_KINDS = new Set([
  "activity",
  "checkpoint",
  "quiz",
  "hotspot",
  "practice",
  "retrieval",
  "exam",
]);

/** Tested this many times → deprioritise unless central concept. */
const OVER_TESTED_THRESHOLD = 2;

/** Share of lesson tests above this → dominance warning (non-central only). */
const DOMINANCE_TEST_SHARE = 0.35;

const LEGACY_COGNITIVE_TO_SKILL = {
  recall: "Recall",
  understanding: "Explain",
  application: "Apply",
  "exam thinking": "Evaluate",
  analyse: "Analyse",
  analyze: "Analyse",
  evaluate: "Evaluate",
  explain: "Explain",
  apply: "Apply",
};

const SKILL_TO_LEGACY_LEVEL = {
  Recall: "recall",
  Explain: "understanding",
  Apply: "application",
  Analyse: "application",
  Evaluate: "exam thinking",
};

function emptySkillCounts() {
  return Object.fromEntries(COGNITIVE_SKILLS.map((s) => [s, 0]));
}

function cloneSkillCounts(src = {}) {
  const out = emptySkillCounts();
  for (const s of COGNITIVE_SKILLS) {
    out[s] = Number(src[s]) || 0;
  }
  return out;
}

function normalizeCognitiveSkill(value) {
  const raw = String(value || "").trim();
  if (COGNITIVE_SKILLS.includes(raw)) return raw;
  const key = raw.toLowerCase();
  return LEGACY_COGNITIVE_TO_SKILL[key] || "Recall";
}

function cognitiveSkillToLegacyLevel(skill) {
  return SKILL_TO_LEGACY_LEVEL[skill] || "recall";
}

function resolveCentralConcept(coreConcepts = []) {
  const critical = coreConcepts.find((c) => c.importance === "critical");
  return critical || coreConcepts[0] || null;
}

/**
 * @param {object} concept
 * @returns {string[]}
 */
function conceptMatchTerms(concept) {
  if (!concept) return [];
  const terms = new Set();
  if (concept.id) terms.add(String(concept.id).replace(/_/g, " "));
  if (concept.name) terms.add(String(concept.name).toLowerCase());
  for (const link of concept.linksTo || []) {
    terms.add(String(link).replace(/_/g, " "));
  }
  return [...terms].map((t) => normalizeText(t)).filter(Boolean);
}

/**
 * @param {string} hay
 * @param {object[]} coreConcepts
 * @returns {string[]}
 */
function matchConceptIdsInHaystack(hay, coreConcepts) {
  const hits = new Set();
  for (const c of coreConcepts) {
    for (const term of conceptMatchTerms(c)) {
      if (term && hay.includes(term)) {
        hits.add(c.id);
        break;
      }
    }
  }
  return [...hits];
}

/**
 * @param {object} block
 */
function inferCognitiveSkillFromBlock(block) {
  const hay = blockHaystack(block);
  const type = String(block.type || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  if (/evaluate|grade\s*9|to what extent|justify/i.test(hay)) return "Evaluate";
  if (/analys|analyze|compare|contrast|suggest|pattern|trend|graph/i.test(hay)) return "Analyse";
  if (
    /apply|calculate|complete the table|drag|match|sequence|label|sort/i.test(hay) ||
    ["dragdropmatch", "interactivesequence", "hotspot", "labeldiagram", "graph"].includes(type)
  ) {
    return "Apply";
  }
  if (/explain|describe|why|how|because/i.test(hay)) return "Explain";
  return "Recall";
}

function isMisconceptionBlock(block) {
  const type = String(block.type || "").toLowerCase();
  const role = String(block.role || "").toLowerCase();
  return type === "commonmistake" || role === "commonmistake";
}

function isExamSkillBlock(block) {
  const type = String(block.type || "").toLowerCase();
  const role = String(block.role || "").toLowerCase();
  const title = String(block.title || "").toLowerCase();
  const hay = blockHaystack(block);
  if (type === "examtip" || role === "examtechnique" || role === "exampractice") return true;
  if (title.includes("exam practice") || /exam\s*style|\d\s*mark/i.test(hay)) return true;
  if (Number(block.marks) > 0 || Number(block.markAllocation) > 0) return true;
  return false;
}

function isTestBlock(block) {
  const type = String(block.type || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (type === "checkpoint" || type === "selfcheck" || type === "selfcheckquestion") return true;
  if (isInteractionBlock(block) && !isTeachBlock(block)) return true;
  return false;
}

/**
 * @param {object[]} flashcards
 * @param {object[]} coreConcepts
 */
function scanFlashcardItems(flashcards = [], coreConcepts = []) {
  const events = [];
  if (!Array.isArray(flashcards)) return events;
  for (const fc of flashcards) {
    const hay = normalizeText(
      [fc.front, fc.back, fc.question, fc.term, fc.text].filter(Boolean).join(" ")
    );
    const conceptIds = matchConceptIdsInHaystack(hay, coreConcepts);
    events.push({
      kind: "tested",
      conceptIds: conceptIds.length ? conceptIds : ["unmapped"],
      cognitiveSkill: "Recall",
      source: "flashcard",
    });
  }
  return events;
}

/**
 * @param {object[]} practiceQuestions
 * @param {object[]} coreConcepts
 */
function scanPracticeQuestionItems(practiceQuestions = [], coreConcepts = []) {
  const events = [];
  if (!Array.isArray(practiceQuestions)) return events;
  for (const item of practiceQuestions) {
    const hay = normalizeText(
      [
        item.question,
        item.questionText,
        item.stem,
        item.prompt,
        item.text,
        item.front,
        item.back,
        ...(Array.isArray(item.options) ? item.options : []),
        ...(Array.isArray(item.choices) ? item.choices : []),
      ]
        .filter(Boolean)
        .join(" ")
    );
    const conceptIds = matchConceptIdsInHaystack(hay, coreConcepts);
    const skill = inferCognitiveSkillFromBlock(item);
    events.push({
      kind: "tested",
      conceptIds: conceptIds.length ? conceptIds : ["unmapped"],
      cognitiveSkill: skill,
      source: "practice",
    });
    if (/exam|mark/i.test(hay)) {
      events.push({ kind: "exam", conceptIds, source: "practice" });
    }
  }
  return events;
}

/**
 * @param {object[]} quiz
 */
function scanQuizItems(quiz = [], coreConcepts = [], misconceptions = []) {
  const events = [];
  if (!Array.isArray(quiz)) return events;

  for (const item of quiz) {
    const hay = normalizeText(
      [item.question, item.stem, item.prompt, item.text, item.title, item.topic].filter(Boolean).join(" ")
    );
    const conceptIds = matchConceptIdsInHaystack(hay, coreConcepts);
    const skill = inferCognitiveSkillFromBlock(item);
    events.push({
      kind: "tested",
      conceptIds: conceptIds.length ? conceptIds : ["unmapped"],
      cognitiveSkill: skill,
      source: "quiz",
    });
    if (/misconception|common mistake|students often/i.test(hay)) {
      events.push({ kind: "misconception", conceptIds, source: "quiz" });
    }
    if (/mark|exam|command word/i.test(hay)) {
      events.push({ kind: "exam", conceptIds, source: "quiz" });
    }
  }

  return events;
}

/**
 * @param {object[]} pages
 * @param {object[]} coreConcepts
 */
function scanLessonBlockEvents(pages = [], coreConcepts = []) {
  const events = [];
  const blocks = flattenPagesToBlocks(pages);

  for (const block of blocks) {
    const hay = blockHaystack(block);
    let conceptIds = matchConceptIdsInHaystack(hay, coreConcepts);
    if (!conceptIds.length && block.conceptId) {
      conceptIds = [String(block.conceptId)];
    }
    if (!conceptIds.length) conceptIds = ["unmapped"];

    const cognitiveSkill = inferCognitiveSkillFromBlock(block);

    if (isTeachBlock(block)) {
      events.push({ kind: "taught", conceptIds, cognitiveSkill, source: "block" });
    }
    if (isTestBlock(block)) {
      events.push({ kind: "tested", conceptIds, cognitiveSkill, source: "block" });
    }
    if (isMisconceptionBlock(block)) {
      events.push({ kind: "misconception", conceptIds, cognitiveSkill, source: "block" });
    }
    if (isExamSkillBlock(block)) {
      events.push({ kind: "exam", conceptIds, cognitiveSkill, source: "block" });
    }
  }

  return events;
}

/**
 * @param {{
 *   pages?: object[],
 *   quiz?: object[],
 *   flashcards?: object[],
 *   practiceQuestions?: object[],
 *   coreConcepts?: object[],
 *   misconceptions?: object[],
 *   lessonId?: string
 * }} input
 */
function buildLessonCoverageMap(input = {}) {
  const coreConcepts = Array.isArray(input.coreConcepts) ? input.coreConcepts : [];
  const misconceptions = Array.isArray(input.misconceptions) ? input.misconceptions : [];
  const central = resolveCentralConcept(coreConcepts);
  const centralConceptId = central?.id || coreConcepts[0]?.id || null;
  const centralConceptName = central?.name || coreConcepts[0]?.name || null;

  const conceptRows = new Map();
  for (const c of coreConcepts) {
    conceptRows.set(c.id, {
      id: c.id,
      name: c.name,
      importance: c.importance,
      teachingOrder: c.teachingOrder,
      taughtCount: 0,
      testedCount: 0,
      misconceptionAddressedCount: 0,
      examSkillCount: 0,
      cognitiveSkills: emptySkillCounts(),
      isCentral: c.id === centralConceptId,
    });
  }

  const quizItems = Array.isArray(input.quiz)
    ? input.quiz
    : Array.isArray(input.quiz?.questions)
      ? input.quiz.questions
      : [];

  const events = [
    ...scanLessonBlockEvents(input.pages, coreConcepts),
    ...scanQuizItems(quizItems, coreConcepts, misconceptions),
    ...scanFlashcardItems(input.flashcards, coreConcepts),
    ...scanPracticeQuestionItems(input.practiceQuestions, coreConcepts),
  ];

  const misconceptionsAddressed = new Map();
  const examSkillsAssessed = new Map();
  const lessonCognitive = emptySkillCounts();

  function bumpConcept(id, field, skill) {
    if (!conceptRows.has(id)) return;
    const row = conceptRows.get(id);
    row[field] = (row[field] || 0) + 1;
    if (skill && row.cognitiveSkills[skill] !== undefined) {
      row.cognitiveSkills[skill] += 1;
      lessonCognitive[skill] += 1;
    }
  }

  for (const ev of events) {
    const skill = ev.cognitiveSkill || "Recall";
    for (const conceptId of ev.conceptIds) {
      if (ev.kind === "taught") bumpConcept(conceptId, "taughtCount", skill);
      if (ev.kind === "tested") bumpConcept(conceptId, "testedCount", skill);
      if (ev.kind === "misconception") {
        bumpConcept(conceptId, "misconceptionAddressedCount", skill);
        const key = conceptId;
        misconceptionsAddressed.set(key, (misconceptionsAddressed.get(key) || 0) + 1);
      }
      if (ev.kind === "exam") {
        bumpConcept(conceptId, "examSkillCount", skill);
        examSkillsAssessed.set(skill, (examSkillsAssessed.get(skill) || 0) + 1);
      }
    }
  }

  const lessonTotals = { taught: 0, tested: 0, misconception: 0, exam: 0 };
  for (const row of conceptRows.values()) {
    lessonTotals.taught += row.taughtCount;
    lessonTotals.tested += row.testedCount;
    lessonTotals.misconception += row.misconceptionAddressedCount;
    lessonTotals.exam += row.examSkillCount;
  }

  const dominanceWarnings = [];
  const concepts = [...conceptRows.values()].map((row) => {
    const exposureScore =
      row.taughtCount + row.testedCount * 2 + row.examSkillCount + row.misconceptionAddressedCount * 0.5;
    const dominanceRatio =
      lessonTotals.tested > 0 ? row.testedCount / lessonTotals.tested : 0;
    const isOverTested =
      row.id !== centralConceptId && row.testedCount >= OVER_TESTED_THRESHOLD;

    if (
      row.id !== centralConceptId &&
      row.testedCount >= OVER_TESTED_THRESHOLD &&
      dominanceRatio >= DOMINANCE_TEST_SHARE
    ) {
      dominanceWarnings.push(
        `"${row.name}" is tested ${row.testedCount} times (${Math.round(dominanceRatio * 100)}% of lesson checks) — deprioritise unless central objective.`
      );
    }

    return {
      ...row,
      coverageScore: exposureScore,
      dominanceRatio,
      isOverTested,
    };
  });

  return {
    phase: 4,
    lessonId: input.lessonId || null,
    centralConceptId,
    centralConceptName,
    concepts,
    misconceptionsAddressed: [...misconceptionsAddressed.entries()].map(([conceptId, count]) => ({
      conceptId,
      count,
    })),
    examSkillsAssessed: [...examSkillsAssessed.entries()].map(([skill, count]) => ({ skill, count })),
    lessonTotals,
    cognitiveSkillBalance: lessonCognitive,
    dominanceWarnings,
    generatedAt: new Date().toISOString(),
  };
}

function exposureScoreForRow(row) {
  return (
    (row.taughtCount || 0) +
    (row.testedCount || 0) * 2 +
    (row.examSkillCount || 0) +
    (row.misconceptionAddressedCount || 0) * 0.5
  );
}

/**
 * Pick the cognitive skill used least in the lesson so far.
 * @param {object} coverageMap
 * @param {string} [preferSkill]
 */
function pickLeastUsedCognitiveSkill(coverageMap, preferSkill) {
  if (preferSkill && COGNITIVE_SKILLS.includes(preferSkill)) {
    return preferSkill;
  }
  const balance = coverageMap?.cognitiveSkillBalance || emptySkillCounts();
  let best = COGNITIVE_SKILLS[0];
  let min = Infinity;
  for (const skill of COGNITIVE_SKILLS) {
    const n = balance[skill] || 0;
    if (n < min) {
      min = n;
      best = skill;
    }
  }
  return best;
}

/**
 * @param {object} coverageMap
 * @param {{
 *   generationKind?: string,
 *   suggestedConceptId?: string,
 *   suggestedCognitiveSkill?: string,
 *   allowOverTested?: boolean
 * }} [request]
 */
function selectNextGenerationSlot(coverageMap, request = {}) {
  const kind = GENERATION_KINDS.has(request.generationKind)
    ? request.generationKind
    : "activity";
  const concepts = coverageMap?.concepts || [];
  const centralId = coverageMap?.centralConceptId;

  if (!concepts.length) {
    return {
      allowed: true,
      conceptId: null,
      conceptName: null,
      cognitiveSkill: pickLeastUsedCognitiveSkill(coverageMap, request.suggestedCognitiveSkill),
      generationKind: kind,
      warnings: [],
      rationale: "No concept profile — use lesson objectives.",
    };
  }

  let pool = concepts.filter((c) => c.id !== "unmapped");
  if (!pool.length) pool = concepts;

  if (Array.isArray(request.excludedConceptIds) && request.excludedConceptIds.length) {
    const excluded = new Set(request.excludedConceptIds);
    pool = pool.filter((c) => !excluded.has(c.id));
  }

  if (request.suggestedConceptId && request.suggestedConceptId !== "end") {
    const suggested = pool.find((c) => c.id === request.suggestedConceptId);
    if (
      suggested &&
      (!suggested.isOverTested || suggested.id === centralId || request.allowOverTested)
    ) {
      const cognitiveSkill = pickLeastUsedCognitiveSkill(
        coverageMap,
        request.suggestedCognitiveSkill || normalizeCognitiveSkill(request.cognitiveLevel)
      );
      return {
        allowed: true,
        conceptId: suggested.id,
        conceptName: suggested.name,
        cognitiveSkill,
        cognitiveLevel: cognitiveSkillToLegacyLevel(cognitiveSkill),
        generationKind: kind,
        warnings: coverageMap?.dominanceWarnings || [],
        rationale: `Use planned concept "${suggested.name}" (${suggested.testedCount} prior tests).`,
      };
    }
  }

  let ranked = pool
    .filter((c) => {
      if (request.allowOverTested) return true;
      if (c.isOverTested && c.id !== centralId) return false;
      return true;
    })
    .sort((a, b) => {
      const expA = exposureScoreForRow(a);
      const expB = exposureScoreForRow(b);
      if (expA !== expB) return expA - expB;
      if (a.taughtCount > 0 && a.testedCount === 0 && !(b.taughtCount > 0 && b.testedCount === 0)) {
        return -1;
      }
      if (b.taughtCount > 0 && b.testedCount === 0 && !(a.taughtCount > 0 && a.testedCount === 0)) {
        return 1;
      }
      return (a.teachingOrder || 99) - (b.teachingOrder || 99);
    });

  if (request.priorityProfile && isPriorityEngineEnabled()) {
    ranked = rerankCoveragePoolByPriority(ranked, request.priorityProfile);
  }

  const chosen = ranked[0] || pool.find((c) => c.id === centralId) || pool[0];
  const overTestedBlocked =
    chosen?.isOverTested && chosen.id !== centralId && !request.allowOverTested;

  const cognitiveSkill = pickLeastUsedCognitiveSkill(
    coverageMap,
    request.suggestedCognitiveSkill
  );

  return {
    allowed: !overTestedBlocked,
    conceptId: chosen?.id || null,
    conceptName: chosen?.name || null,
    cognitiveSkill,
    cognitiveLevel: cognitiveSkillToLegacyLevel(cognitiveSkill),
    generationKind: kind,
    warnings: [
      ...(coverageMap?.dominanceWarnings || []),
      ...(overTestedBlocked
        ? [`"${chosen.name}" already tested ${chosen.testedCount} times — pick another concept.`]
        : []),
    ],
    rationale: chosen
      ? request.priorityProfile && isPriorityEngineEnabled()
        ? `Priority tier ${request.priorityTier || "n/a"} — "${chosen.name}" (taught ${chosen.taughtCount}, tested ${chosen.testedCount}). Rotate ${cognitiveSkill}.`
        : `Prefer lowest coverage: "${chosen.name}" (taught ${chosen.taughtCount}, tested ${chosen.testedCount}). Rotate ${cognitiveSkill}.`
      : "No eligible concept.",
    priorityTier:
      request.priorityProfile && chosen?.id
        ? getPriorityTier(chosen.id, request.priorityProfile)
        : undefined,
  };
}

/**
 * Gate before generating checkpoint / quiz / hotspot / practice / activity.
 * @param {object} coverageMap
 * @param {object} request
 */
function checkCoverageBeforeGeneration(coverageMap, request = {}) {
  const slot = selectNextGenerationSlot(coverageMap, request);
  return {
    ...slot,
    coverageChecked: true,
  };
}

/**
 * Shallow-clone coverage map for simulated planning passes.
 * @param {object} coverageMap
 */
function cloneCoverageMapForPlanning(coverageMap) {
  if (!coverageMap) return null;
  return {
    ...coverageMap,
    concepts: (coverageMap.concepts || []).map((c) => ({
      ...c,
      cognitiveSkills: cloneSkillCounts(c.cognitiveSkills),
    })),
    cognitiveSkillBalance: cloneSkillCounts(coverageMap.cognitiveSkillBalance),
    dominanceWarnings: [...(coverageMap.dominanceWarnings || [])],
  };
}

/**
 * Record a planned test on the working coverage map (mutates).
 * @param {object} workingMap
 * @param {string} conceptId
 * @param {string} cognitiveSkill
 */
function recordPlannedExposure(workingMap, conceptId, cognitiveSkill) {
  if (!workingMap || !conceptId) return;
  const row = (workingMap.concepts || []).find((c) => c.id === conceptId);
  if (!row) return;
  row.testedCount = (row.testedCount || 0) + 1;
  row.coverageScore = exposureScoreForRow(row);
  const skill = normalizeCognitiveSkill(cognitiveSkill);
  if (row.cognitiveSkills[skill] !== undefined) {
    row.cognitiveSkills[skill] += 1;
  }
  workingMap.cognitiveSkillBalance[skill] =
    (workingMap.cognitiveSkillBalance[skill] || 0) + 1;
  workingMap.lessonTotals.tested = (workingMap.lessonTotals.tested || 0) + 1;

  const centralId = workingMap.centralConceptId;
  const totalTested = workingMap.lessonTotals.tested || 1;
  row.dominanceRatio = row.testedCount / totalTested;
  row.isOverTested =
    row.id !== centralId && row.testedCount >= OVER_TESTED_THRESHOLD;
  if (
    row.id !== centralId &&
    row.testedCount >= OVER_TESTED_THRESHOLD &&
    row.dominanceRatio >= DOMINANCE_TEST_SHARE
  ) {
    const msg = `"${row.name}" would dominate planned checks — deprioritise.`;
    if (!workingMap.dominanceWarnings.includes(msg)) {
      workingMap.dominanceWarnings.push(msg);
    }
  }
}

/**
 * @param {object[]} recommendations
 * @param {object|null} coverageMap
 * @param {object[]} coreConcepts
 */
function applyCoverageToActivityRecommendations(recommendations = [], coverageMap, coreConcepts = []) {
  const working = cloneCoverageMapForPlanning(coverageMap) ||
    buildLessonCoverageMap({ coreConcepts, misconceptions: [] });

  return recommendations.map((rec) => {
    if (rec.afterConcept === "end") {
      const slot = selectNextGenerationSlot(working, {
        generationKind: "exam",
        suggestedConceptId: working.centralConceptId,
        allowOverTested: true,
      });
      return {
        ...rec,
        cognitiveSkill: slot.cognitiveSkill,
        cognitiveLevel: slot.cognitiveLevel || rec.cognitiveLevel,
        coverageRationale: slot.rationale,
      };
    }

    const slot = checkCoverageBeforeGeneration(working, {
      generationKind: "activity",
      suggestedConceptId: rec.afterConcept,
      suggestedCognitiveSkill: normalizeCognitiveSkill(rec.cognitiveLevel),
    });

    if (slot.conceptId) {
      recordPlannedExposure(working, slot.conceptId, slot.cognitiveSkill);
    }

    return {
      ...rec,
      afterConcept: slot.conceptId || rec.afterConcept,
      cognitiveSkill: slot.cognitiveSkill,
      cognitiveLevel: slot.cognitiveLevel || rec.cognitiveLevel,
      coverageRationale: slot.rationale,
      coverageWarnings: slot.warnings,
    };
  });
}

/**
 * @param {object[]} retrievalPlan
 * @param {object|null} coverageMap
 */
function applyCoverageToRetrievalPlan(retrievalPlan = [], coverageMap) {
  const working = cloneCoverageMapForPlanning(coverageMap);
  if (!working) return retrievalPlan;

  return retrievalPlan.map((item) => {
    const firstConceptName = Array.isArray(item.concepts) ? item.concepts[0] : null;
    const match = (working.concepts || []).find(
      (c) => c.name === firstConceptName || c.id === firstConceptName
    );
    const slot = checkCoverageBeforeGeneration(working, {
      generationKind: "retrieval",
      suggestedConceptId: match?.id,
    });
    if (slot.conceptId) {
      recordPlannedExposure(working, slot.conceptId, slot.cognitiveSkill);
    }
    const concepts =
      slot.conceptName && Array.isArray(item.concepts)
        ? [slot.conceptName, ...item.concepts.slice(1)]
        : item.concepts;
    return {
      ...item,
      concepts,
      cognitiveSkill: slot.cognitiveSkill,
      coverageRationale: slot.rationale,
    };
  });
}

/**
 * @param {object} coverageMap
 */
function formatCoverageMapForPrompt(coverageMap) {
  if (!coverageMap || !Array.isArray(coverageMap.concepts) || !coverageMap.concepts.length) {
    return "";
  }

  const lines = [
    "LESSON COVERAGE MAP (Phase 4 — balance assessment across concepts):",
    `Central learning objective: ${coverageMap.centralConceptName || "see chain"}`,
    "",
    "Concept coverage (taught / tested / misconceptions / exam):",
  ];

  for (const c of coverageMap.concepts) {
    const flag = c.isOverTested ? " [over-tested — avoid more checks]" : "";
    const central = c.isCentral ? " [central]" : "";
    lines.push(
      `- ${c.name}: taught ${c.taughtCount}, tested ${c.testedCount}, misconceptions ${c.misconceptionAddressedCount}, exam ${c.examSkillCount}${central}${flag}`
    );
  }

  lines.push("", "Cognitive skill balance (prefer least-used):");
  for (const skill of COGNITIVE_SKILLS) {
    lines.push(`- ${skill}: ${coverageMap.cognitiveSkillBalance[skill] || 0}`);
  }

  if (coverageMap.dominanceWarnings?.length) {
    lines.push("", "Coverage warnings:");
    for (const w of coverageMap.dominanceWarnings) {
      lines.push(`- ${w}`);
    }
  }

  lines.push(
    "",
    "Before each checkpoint, quiz, hotspot, or practice item: check coverage;",
    "avoid concepts tested multiple times; prefer lowest-covered concepts;",
    "rotate Recall → Explain → Apply → Analyse → Evaluate.",
    "No concept should dominate unless it is the central learning objective."
  );

  return lines.join("\n");
}

module.exports = {
  COGNITIVE_SKILLS,
  GENERATION_KINDS,
  OVER_TESTED_THRESHOLD,
  matchConceptIdsInHaystack,
  buildLessonCoverageMap,
  checkCoverageBeforeGeneration,
  selectNextGenerationSlot,
  applyCoverageToActivityRecommendations,
  applyCoverageToRetrievalPlan,
  formatCoverageMapForPrompt,
  normalizeCognitiveSkill,
  cognitiveSkillToLegacyLevel,
  cloneCoverageMapForPlanning,
  recordPlannedExposure,
};
