/**
 * Coverage-gated question generation — plan slots before each AI assessment item.
 */

const { extractCoreConcepts } = require("./conceptExtractor");
const { planMisconceptions } = require("./misconceptionEngine");
const {
  buildLessonCoverageMap,
  cloneCoverageMapForPlanning,
  recordPlannedExposure,
  COGNITIVE_SKILLS,
} = require("./lessonCoverageIntelligence");
const {
  buildSubTopicBoundaryContext,
  mergePrimaryConceptsIntoCore,
  selectNextGenerationSlotWithBoundary,
  attachBoundaryToDiagnostic,
  attachReplacementPlanToBoundary,
} = require("./subTopicBoundaryPlanning");

function snapshotConceptCounts(coverageMap) {
  return (coverageMap?.concepts || []).map((c) => ({
    id: c.id,
    name: c.name,
    taughtCount: c.taughtCount,
    testedCount: c.testedCount,
    isOverTested: c.isOverTested,
  }));
}

function listAvoidedDuplicates(workingMap) {
  const centralId = workingMap?.centralConceptId;
  return (workingMap?.concepts || [])
    .filter((c) => c.isOverTested && c.id !== centralId)
    .map((c) => ({
      conceptId: c.id,
      conceptName: c.name,
      testedCount: c.testedCount,
    }));
}

/**
 * @param {object} [options]
 * @param {string} [options.topic]
 * @param {object[]} [options.pages]
 * @param {object[]|object} [options.quiz]
 * @param {object[]} [options.flashcards]
 * @param {object[]} [options.practiceQuestions]
 * @param {object[]} [options.coreConcepts]
 * @param {object[]} [options.misconceptions]
 * @param {string} [options.lessonId]
 */
function createCoverageGenerationGate(options = {}) {
  const topic = String(options.topic || "").trim();
  let coreConcepts = Array.isArray(options.coreConcepts) ? options.coreConcepts : [];
  let misconceptions = Array.isArray(options.misconceptions) ? options.misconceptions : [];

  const boundary = buildSubTopicBoundaryContext({
    topicKey: options.topicKey,
    subTopic: options.subTopic,
    topic,
  });

  if (!coreConcepts.length && topic) {
    const normalized = {
      topic,
      topicKey: options.topicKey || "",
      subTopic: options.subTopic || "",
      subject: options.subject || "Biology",
      examBoard: options.examBoard || "AQA",
      tier: options.tier || "Higher",
    };
    coreConcepts = extractCoreConcepts(normalized);
    if (boundary.active) {
      coreConcepts = mergePrimaryConceptsIntoCore(coreConcepts, boundary.subTopicProfile);
    }
    misconceptions = planMisconceptions(normalized, coreConcepts);
  }

  const coverageMap = buildLessonCoverageMap({
    pages: options.pages,
    quiz: options.quiz,
    flashcards: options.flashcards,
    practiceQuestions: options.practiceQuestions,
    coreConcepts,
    misconceptions,
    lessonId: options.lessonId,
  });

  const working = cloneCoverageMapForPlanning(coverageMap);
  if (boundary.active && boundary.subTopicProfile?.centralConceptId) {
    const central = boundary.subTopicProfile.centralConceptId;
    const row = (working.concepts || []).find((c) => c.id === central);
    if (row) {
      working.centralConceptId = central;
      working.centralConceptName = row.name;
    }
  }

  const boundaryEnriched = attachReplacementPlanToBoundary(
    boundary,
    {
      topic,
      topicKey: options.topicKey,
      subTopic: options.subTopic,
      pages: options.pages,
      quiz: options.quiz,
      flashcards: options.flashcards,
      practiceQuestions: options.practiceQuestions,
      bankFlashcards: options.bankFlashcards,
      bankQuizQuestions: options.bankQuizQuestions,
      bankExamQuestions: options.bankExamQuestions,
    },
    coverageMap,
    "practice"
  );

  return {
    topic,
    coreConcepts,
    misconceptions,
    coverageMap,
    working,
    boundary: boundaryEnriched,
    replacementPlan: boundaryEnriched.replacementPlan || null,
    priorityProfile: boundaryEnriched.priorityProfile || null,
    priorityEngineEnabled: boundaryEnriched.priorityEngineEnabled || false,
    diagnostics: [],
  };
}

/**
 * Plan one assessment item with coverage gate (mutates gate.working).
 * @param {object} gate
 * @param {object} request
 */
function planCoverageGatedQuestion(gate, request = {}) {
  const avoidedDuplicates = listAvoidedDuplicates(gate.working);
  const coverageBefore = snapshotConceptCounts(gate.working);

  const boundaryResult = selectNextGenerationSlotWithBoundary(
    gate.working,
    {
      ...request,
      priorityProfile: gate.priorityProfile || request.priorityProfile,
    },
    gate.boundary
  );
  const slot = {
    ...boundaryResult.slot,
    coverageChecked: true,
  };

  if (slot.conceptId && slot.allowed !== false) {
    recordPlannedExposure(gate.working, slot.conceptId, slot.cognitiveSkill);
  }

  const coverageAfter = snapshotConceptCounts(gate.working);

  const diagnostic = attachBoundaryToDiagnostic(
    {
      generationKind: request.generationKind || "practice",
      conceptId: slot.conceptId,
      conceptName: slot.conceptName,
      cognitiveSkill: slot.cognitiveSkill,
      reasonSelected: slot.rationale,
      avoidedDuplicates,
      coverageBefore,
      coverageAfter,
      warnings: [
        ...(slot.warnings || []),
        ...(boundaryResult.outOfScopeWarnings || []),
      ],
      allowed: slot.allowed !== false,
    },
    gate.boundary,
    boundaryResult
  );

  gate.diagnostics.push(diagnostic);
  logCoverageDiagnostic(diagnostic);

  return { slot, diagnostic };
}

/**
 * @param {object} gate
 * @param {number} count
 * @param {string} generationKind
 * @param {object} [extraRequest]
 */
function planCoverageGatedQuestionBatch(gate, count, generationKind, extraRequest = {}) {
  const n = Math.max(0, Number(count) || 0);
  const plans = [];
  for (let i = 0; i < n; i++) {
    plans.push(
      planCoverageGatedQuestion(gate, {
        generationKind,
        ...extraRequest,
      })
    );
  }
  return plans;
}

/**
 * @param {object} diagnostic
 */
function formatCoverageAssignmentLine(diagnostic, index = 0) {
  const n = index + 1;
  const avoid =
    diagnostic.avoidedDuplicates?.length > 0
      ? ` Do NOT re-test: ${diagnostic.avoidedDuplicates.map((a) => `${a.conceptName} (${a.testedCount}×)`).join("; ")}.`
      : "";
  return `${n}. Concept: ${diagnostic.conceptName || "lesson objective"} | Cognitive skill: ${diagnostic.cognitiveSkill} | ${diagnostic.reasonSelected}${avoid}`;
}

/**
 * @param {object[]} plans — array of { diagnostic } from planCoverageGatedQuestionBatch
 */
function formatCoveragePlanForPrompt(plans = [], heading = "LESSON COVERAGE INTELLIGENCE") {
  if (!plans.length) return "";
  const lines = [
    `${heading} — required per-item assignments (follow exactly):`,
    ...plans.map((p, i) => formatCoverageAssignmentLine(p.diagnostic, i)),
    "",
    "Each generated question MUST target its assigned concept and cognitive skill.",
    "Do not duplicate pathway/definition questions for concepts already tested in drag-drop, step-by-step, or checkpoints.",
  ];
  return lines.join("\n");
}

function logCoverageDiagnostic(diagnostic) {
  const enabled =
    process.env.TEACHER_BRAIN_COVERAGE_LOG === "1" ||
    process.env.NODE_ENV !== "production";
  if (!enabled) return;
  console.log("[CoverageGate]", JSON.stringify({
    generationKind: diagnostic.generationKind,
    conceptId: diagnostic.conceptId,
    cognitiveSkill: diagnostic.cognitiveSkill,
    reasonSelected: diagnostic.reasonSelected,
    avoidedDuplicates: diagnostic.avoidedDuplicates,
    boundaryProfileKey: diagnostic.boundaryProfileKey,
    boundaryMode: diagnostic.boundaryMode,
    avoidedBoundaryConcepts: diagnostic.avoidedBoundaryConcepts,
  }));
}

/**
 * Attach coverage diagnostics to item metadata (schema-safe additive fields).
 * @param {object} item
 * @param {object} diagnostic
 */
function attachCoverageMetadata(item, diagnostic) {
  if (!item || !diagnostic) return item;
  return {
    ...item,
    coverage: {
      conceptId: diagnostic.conceptId,
      conceptName: diagnostic.conceptName,
      cognitiveSkill: diagnostic.cognitiveSkill,
      reasonSelected: diagnostic.reasonSelected,
      avoidedDuplicates: diagnostic.avoidedDuplicates,
      coverageBefore: diagnostic.coverageBefore,
      coverageAfter: diagnostic.coverageAfter,
      generationKind: diagnostic.generationKind,
      boundaryProfileKey: diagnostic.boundaryProfileKey,
      boundaryMode: diagnostic.boundaryMode,
      boundaryStatus: diagnostic.boundaryStatus,
      avoidedBoundaryConcepts: diagnostic.avoidedBoundaryConcepts,
      outOfScopeWarnings: diagnostic.outOfScopeWarnings,
    },
  };
}

/**
 * Build gate from a lesson document (pages, quiz, flashcards, assessment).
 * @param {object} lesson
 */
function createCoverageGateFromLesson(lesson = {}) {
  const topic = String(lesson.subTopic || lesson.topic || lesson.title || "").trim();
  const practiceQuestions = [
    ...(lesson.quiz?.questions || []),
    ...(lesson.assessment?.questions || []),
  ];

  return createCoverageGenerationGate({
    topic,
    topicKey: lesson.topicKey,
    subTopic: lesson.subTopic,
    subject: lesson.subject,
    examBoard: lesson.board || lesson.examBoard,
    tier: lesson.level,
    lessonId: lesson._id ? String(lesson._id) : lesson.id,
    pages: lesson.pages,
    quiz: lesson.quiz,
    flashcards: lesson.flashcards,
    practiceQuestions,
  });
}

/**
 * Prepend coverage directive to an explain-chunk / LLM user prompt.
 * @param {string} userPrompt
 * @param {object} diagnostic
 */
function prependCoverageDirectiveToPrompt(userPrompt, diagnostic) {
  if (!diagnostic?.conceptName) return userPrompt;
  const avoid =
    diagnostic.avoidedDuplicates?.length > 0
      ? `\nAvoid re-testing these concepts: ${diagnostic.avoidedDuplicates.map((a) => a.conceptName).join(", ")}.`
      : "";
  const header = [
    "COVERAGE ASSIGNMENT (required):",
    `Target concept: ${diagnostic.conceptName} (${diagnostic.conceptId || "n/a"})`,
    `Cognitive skill: ${diagnostic.cognitiveSkill}`,
    diagnostic.reasonSelected,
    avoid,
    "",
  ].join("\n");
  return `${header}${userPrompt}`;
}

module.exports = {
  COGNITIVE_SKILLS,
  createCoverageGenerationGate,
  createCoverageGateFromLesson,
  planCoverageGatedQuestion,
  planCoverageGatedQuestionBatch,
  formatCoveragePlanForPrompt,
  formatCoverageAssignmentLine,
  attachCoverageMetadata,
  prependCoverageDirectiveToPrompt,
  logCoverageDiagnostic,
  snapshotConceptCounts,
  listAvoidedDuplicates,
};
