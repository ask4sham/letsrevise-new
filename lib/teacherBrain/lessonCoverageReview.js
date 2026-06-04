/**
 * Teacher Coverage Review — live diagnostics for Edit Lesson (no persistence).
 */

const {
  flattenPagesToBlocks,
  normalizeText,
  blockHaystack,
} = require("../lessonBlockAnalysis");
const { extractCoreConcepts } = require("./conceptExtractor");
const {
  buildLessonCoverageMap,
  matchConceptIdsInHaystack,
} = require("./lessonCoverageIntelligence");
const {
  buildSubTopicBoundaryContext,
  buildBoundaryReviewFromLesson,
} = require("./subTopicBoundaryPlanning");
const { auditLessonBoundary } = require("./lessonBoundaryAudit");
const { planBoundaryReplacements } = require("./boundaryReplacementPlanner");
const { analyzeObjectiveBoundaryFromLesson } = require("./objectiveBoundaryEnforcer");
const {
  buildConceptPriorityDistribution,
  resolveConceptPriorityProfile,
  isPriorityEngineEnabled,
} = require("./conceptPriorityEngine");
const { scorePedagogicalCoverage, resolvePedagogyProfile, isPedagogyEngineEnabled } = require("./structureFunctionPedagogyEngine");

function normalizeBlockType(block) {
  return String(block.type || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

/**
 * @param {object} block
 * @returns {string}
 */
function classifyBlockAppearanceLabel(block) {
  const type = normalizeBlockType(block);
  const role = String(block.role || "").toLowerCase();
  if (type === "checkpoint" || role === "checkpoint" || role === "quickcheck") {
    return "Checkpoint";
  }
  if (role === "selfcheck" || type === "selfcheck" || type === "selfcheckquestion") {
    return "Self-check";
  }
  if (type === "dragdropmatch") return "Drag & Drop";
  if (type === "interactivesequence") return "Step-by-Step";
  if (type === "interactivediagram" || type === "hotspot" || type === "labeldiagram") {
    return "Interactive Diagram";
  }
  if (type === "diagram") return "Diagram";
  if (role === "exampractice" || (type === "text" && String(block.title || "").toLowerCase().includes("exam"))) {
    return "Exam Practice";
  }
  if (type === "examtip") return "Exam Tip";
  if (type === "commonmistake") return "Common Mistake";
  return "Teaching block";
}

function recordAppearance(map, conceptId, label, detail) {
  if (!conceptId || conceptId === "unmapped") return;
  if (!map.has(conceptId)) map.set(conceptId, []);
  const list = map.get(conceptId);
  const key = `${label}|${detail || ""}`;
  if (!list.some((x) => `${x.label}|${x.detail || ""}` === key)) {
    list.push({ label, detail: detail || undefined });
  }
}

function scanPagesForAppearances(pages, coreConcepts) {
  const appearances = new Map();
  const blocks = flattenPagesToBlocks(pages);
  for (const block of blocks) {
    const hay = blockHaystack(block);
    const ids = matchConceptIdsInHaystack(hay, coreConcepts);
    const label = classifyBlockAppearanceLabel(block);
    const detail = String(block.title || block.question || "").slice(0, 80) || undefined;
    for (const id of ids.length ? ids : []) {
      recordAppearance(appearances, id, label, detail);
    }
  }
  return appearances;
}

function scanItemsForAppearances(items, coreConcepts, defaultLabel) {
  const appearances = new Map();
  if (!Array.isArray(items)) return appearances;
  for (const item of items) {
    const hay = normalizeText(
      [
        item.question,
        item.questionText,
        item.front,
        item.back,
        item.prompt,
        item.text,
        item.stem,
      ]
        .filter(Boolean)
        .join(" ")
    );
    const ids = matchConceptIdsInHaystack(hay, coreConcepts);
    const detail = String(
      item.question || item.questionText || item.front || item.prompt || ""
    ).slice(0, 80);
    for (const id of ids) {
      recordAppearance(appearances, id, defaultLabel, detail || undefined);
    }
  }
  return appearances;
}

function mergeAppearanceMaps(target, source) {
  for (const [id, list] of source.entries()) {
    for (const entry of list) {
      recordAppearance(target, id, entry.label, entry.detail);
    }
  }
}

/**
 * Suggest replacement focuses for an over-tested concept.
 * @param {string} conceptId
 * @param {object[]} concepts — coverage map rows
 * @param {object[]} coreConcepts
 */
function suggestReplacementFocus(conceptId, concepts, coreConcepts) {
  const under = (concepts || [])
    .filter((c) => c.id !== conceptId && c.id !== "unmapped" && c.testedCount <= 1)
    .sort((a, b) => a.testedCount - b.testedCount)
    .slice(0, 4);

  if (under.length) {
    return under.map((c) => {
      const profile = coreConcepts.find((p) => p.id === c.id);
      if (c.testedCount === 0) return `Use "${c.name}"`;
      return `Extend "${c.name}" (${profile?.summary ? profile.summary.slice(0, 60) : "deeper skill"})`;
    });
  }

  return coreConcepts
    .filter((c) => c.id !== conceptId)
    .slice(0, 3)
    .map((c) => `Use "${c.name}"`);
}

/**
 * @param {object} input
 * @param {string} input.topic
 * @param {object[]} [input.pages]
 * @param {object[]} [input.flashcards] — lesson + bank
 * @param {object[]|object} [input.quiz]
 * @param {object[]} [input.practiceQuestions]
 * @param {object[]} [input.bankFlashcards]
 * @param {object[]} [input.bankQuizQuestions]
 * @param {object[]} [input.bankExamQuestions]
 */
function buildLessonCoverageReview(input = {}) {
  const topic = String(input.topic || "").trim();
  const normalized = {
    topic,
    topicKey: input.topicKey || "",
    subTopic: input.subTopic || "",
    subject: input.subject || "Biology",
    examBoard: input.examBoard || "AQA",
    tier: input.tier || "Higher",
  };
  const coreConcepts = extractCoreConcepts(normalized);

  const appearances = new Map();
  mergeAppearanceMaps(appearances, scanPagesForAppearances(input.pages, coreConcepts));

  const lessonFlash = Array.isArray(input.flashcards) ? input.flashcards : [];
  const bankFlash = Array.isArray(input.bankFlashcards) ? input.bankFlashcards : [];
  mergeAppearanceMaps(
    appearances,
    scanItemsForAppearances([...lessonFlash, ...bankFlash], coreConcepts, "Flashcard")
  );

  const quizItems = Array.isArray(input.quiz)
    ? input.quiz
    : Array.isArray(input.quiz?.questions)
      ? input.quiz.questions
      : [];
  const bankQuiz = Array.isArray(input.bankQuizQuestions) ? input.bankQuizQuestions : [];
  mergeAppearanceMaps(
    appearances,
    scanItemsForAppearances([...quizItems, ...bankQuiz], coreConcepts, "Quiz")
  );

  const practice = [
    ...(Array.isArray(input.practiceQuestions) ? input.practiceQuestions : []),
    ...(Array.isArray(input.bankExamQuestions) ? input.bankExamQuestions : []),
  ];
  mergeAppearanceMaps(
    appearances,
    scanItemsForAppearances(practice, coreConcepts, "Practice / Exam draft")
  );

  const coverageMap = buildLessonCoverageMap({
    pages: input.pages,
    quiz: [...quizItems, ...bankQuiz],
    flashcards: [...lessonFlash, ...bankFlash],
    practiceQuestions: practice,
    coreConcepts,
  });

  const conceptsTaught = coverageMap.concepts
    .filter((c) => c.taughtCount > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      taughtCount: c.taughtCount,
      appearances: appearances.get(c.id) || [],
    }));

  const conceptsTested = coverageMap.concepts
    .filter((c) => c.testedCount > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      testedCount: c.testedCount,
      appearances: appearances.get(c.id) || [],
      isCentral: c.isCentral,
    }));

  const overTested = coverageMap.concepts
    .filter(
      (c) =>
        c.id !== "unmapped" &&
        (c.isOverTested || c.testedCount >= 2 || (appearances.get(c.id)?.length || 0) >= 3)
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      count: c.testedCount,
      appearances: appearances.get(c.id) || [],
      suggestedReplacement: suggestReplacementFocus(c.id, coverageMap.concepts, coreConcepts),
      isCentral: c.isCentral,
    }));

  const underTested = coverageMap.concepts
    .filter((c) => c.id !== "unmapped" && c.testedCount <= 1 && !c.isOverTested)
    .sort((a, b) => a.testedCount - b.testedCount)
    .map((c) => ({
      id: c.id,
      name: c.name,
      count: c.testedCount,
      appearances: appearances.get(c.id) || [],
    }));

  const hiddenSources = {
    flashcards: lessonFlash.length + bankFlash.length,
    quizDrafts: quizItems.length + bankQuiz.length,
    practiceExamDrafts: practice.length,
    bankFlashcards: bankFlash.length,
    bankQuizQuestions: bankQuiz.length,
    bankExamQuestions: Array.isArray(input.bankExamQuestions) ? input.bankExamQuestions.length : 0,
  };

  const boundaryContext = buildSubTopicBoundaryContext(normalized);
  const boundary = buildBoundaryReviewFromLesson(boundaryContext, input.pages);
  const boundaryAudit = auditLessonBoundary({
    topic: normalized.topic,
    topicKey: normalized.topicKey,
    subTopic: normalized.subTopic,
    pages: input.pages,
    quiz: input.quiz,
    flashcards: input.flashcards,
    practiceQuestions: input.practiceQuestions,
    bankFlashcards: input.bankFlashcards,
    bankQuizQuestions: input.bankQuizQuestions,
    bankExamQuestions: input.bankExamQuestions,
  });

  const boundaryReplacementPlan = planBoundaryReplacements({
    boundaryAudit,
    subTopicProfile: boundaryContext?.subTopicProfile || null,
    coverageMap,
  });

  const objectiveBoundary =
    boundaryContext?.active
      ? analyzeObjectiveBoundaryFromLesson({
          topicKey: normalized.topicKey,
          subTopic: normalized.subTopic,
          topic: normalized.topic,
          pages: input.pages,
        })
      : {
          outOfScopeObjectiveCount: 0,
          removedOutOfScopeItems: [],
          replacementItems: [],
          warnings: [],
          boundaryMode: 0,
          changed: false,
        };

  const priorityProfile = resolveConceptPriorityProfile({
    topicKey: normalized.topicKey,
    subTopic: normalized.subTopic,
    subTopicProfile: boundaryContext?.subTopicProfile || null,
  });
  const conceptPriorityDistribution =
    isPriorityEngineEnabled() && priorityProfile
      ? buildConceptPriorityDistribution({
          priorityProfile,
          coverageMap,
          appearancesByConcept: appearances,
        })
      : { enabled: false, tiers: [], underrepresented: [], warnings: [] };

  const pedagogyProfile = resolvePedagogyProfile({
    topicKey: normalized.topicKey,
    subTopic: normalized.subTopic,
    subTopicProfile: boundaryContext?.subTopicProfile || null,
  });
  const pedagogyCoverage =
    isPedagogyEngineEnabled() && pedagogyProfile
      ? scorePedagogicalCoverage({
          pedagogyProfile,
          pages: input.pages,
          topicKey: normalized.topicKey,
          subTopic: normalized.subTopic,
        })
      : {
          enabled: false,
          pedagogyScorePct: 0,
          structureBlocks: 0,
          adaptationBlocks: 0,
          functionBlocks: 0,
          examBlocks: 0,
          gaps: [],
          warnings: [],
        };

  return {
    centralConceptId: coverageMap.centralConceptId,
    centralConceptName: coverageMap.centralConceptName,
    cognitiveSkillBalance: coverageMap.cognitiveSkillBalance,
    conceptsTaught,
    conceptsTested,
    overTested,
    underTested,
    hiddenSources,
    dominanceWarnings: coverageMap.dominanceWarnings || [],
    boundaryProfileKey: boundary?.boundaryProfileKey ?? null,
    boundaryMode: boundary?.boundaryMode ?? 0,
    boundaryStatus: boundary?.boundaryStatus ?? "off",
    inScopeConcepts: boundary?.inScopeConcepts ?? [],
    outOfScopeConcepts: boundary?.outOfScopeConcepts ?? [],
    scopeContaminationScore:
      boundaryAudit.boundaryProfileKey != null
        ? boundaryAudit.scopeContaminationScore
        : boundary?.scopeContaminationScore ?? 0,
    boundaryWarnings: boundary?.boundaryWarnings ?? [],
    boundary,
    boundaryAudit,
    boundaryReplacementPlan,
    objectiveBoundary,
    conceptPriorityDistribution,
    pedagogyCoverage,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  buildLessonCoverageReview,
  classifyBlockAppearanceLabel,
};
