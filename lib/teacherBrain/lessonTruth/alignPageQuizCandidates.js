/**
 * Phase 3 — Page Quiz shadow alignment orchestrator (observation only).
 * Reuses Phase 1/2 Lesson Truth, planner, and alignment gate without mutation.
 */

const { buildLessonTruth } = require("./buildLessonTruth");
const { planAssessmentTargets } = require("./planAssessmentTargets");
const { assessQuestionAlignment } = require("./assessQuestionAlignment");
const {
  TARGET_MODE_SINGLE,
  emptyUsageLedger,
  inferObservedCognitiveLevel,
} = require("./assessmentTargetTypes");

const SHADOW_VERSION = "pagequiz-shadow-v1";
const PAGE_QUIZ_SURFACE = "page_quiz";

function questionStem(question) {
  return String(question?.prompt || question?.question || "").trim();
}

function buildPageQuizRequirements(questionCount) {
  return Array.from({ length: questionCount }, (_, slotIndex) => ({
    surface: PAGE_QUIZ_SURFACE,
    slotIndex,
    targetMode: TARGET_MODE_SINGLE,
  }));
}

function mapTargetsBySlot(plan) {
  const map = new Map();
  for (const target of plan?.semantic?.targets || []) {
    map.set(target.priority, target);
  }
  return map;
}

function discoveredConceptIdsFromAlignment(alignment) {
  const discovery = alignment?.discovery;
  if (!discovery) return [];
  const ids = [
    ...(discovery.confidentDirectConcepts || []).map((c) => c.conceptId),
    ...(discovery.contextConcepts || [])
      .filter((c) => c.confidence === "CONFIDENT")
      .map((c) => c.conceptId),
  ];
  return [...new Set(ids)].sort();
}

/**
 * @param {{ lesson: object, questions: object[] }} input
 */
function alignPageQuizCandidates({ lesson, questions }) {
  const qs = Array.isArray(questions) ? questions : [];
  if (!qs.length) {
    return {
      version: SHADOW_VERSION,
      status: "skipped",
      reason: "NO_QUESTIONS",
      lessonTruthHash: null,
      targets: [],
      results: [],
      summary: { total: 0, accept: 0, review: 0, regenerate: 0 },
    };
  }

  const lessonTruth = buildLessonTruth(lesson);
  const requirements = buildPageQuizRequirements(qs.length);
  const assessmentPlan = planAssessmentTargets(lessonTruth, requirements);
  const targetsBySlot = mapTargetsBySlot(assessmentPlan);

  const results = qs.map((question, slotIndex) => {
    const assignedTarget = targetsBySlot.get(slotIndex) || null;
    const stem = questionStem(question);
    const observedCognitiveLevel = inferObservedCognitiveLevel(stem);

    const alignment = assessQuestionAlignment({
      lessonTruth,
      assessmentPlan,
      stem,
      options: question?.options,
      modelAnswer: question?.correctAnswer,
      assignedTargetId: assignedTarget?.targetId ?? null,
      observedCognitiveLevel: observedCognitiveLevel || null,
      usageLedger: emptyUsageLedger(),
    });

    return {
      questionId: question?.id ?? null,
      slotIndex,
      assignedTargetId: assignedTarget?.targetId ?? null,
      verdict: alignment.verdict,
      reasonCodes: alignment.reasons,
      discoveredConceptIds: discoveredConceptIdsFromAlignment(alignment),
    };
  });

  const summary = {
    total: results.length,
    accept: results.filter((r) => r.verdict === "ACCEPT").length,
    review: results.filter((r) => r.verdict === "REVIEW").length,
    regenerate: results.filter((r) => r.verdict === "REGENERATE").length,
  };

  return {
    version: SHADOW_VERSION,
    status: "ok",
    lessonTruthHash: lessonTruth.meta?.contentHash ?? null,
    targets: (assessmentPlan.semantic?.targets || []).map((target) => ({
      targetId: target.targetId,
      slotIndex: target.priority,
      primaryConceptIds: target.primaryConceptIds,
      cognitiveLevel: target.cognitiveLevel,
    })),
    results,
    summary,
  };
}

module.exports = {
  SHADOW_VERSION,
  PAGE_QUIZ_SURFACE,
  alignPageQuizCandidates,
  questionStem,
  buildPageQuizRequirements,
};
