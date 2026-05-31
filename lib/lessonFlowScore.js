/**
 * Lesson flow score — aggregates architecture, retrieval, activity, duplication, exam readiness.
 */

const { validateLessonArchitecture } = require("./lessonArchitectureValidator");
const { validateTeachTestRhythm } = require("./teachTestRhythmValidator");
const { analyzeActivitySpacing, scoreActivityPlacement } = require("./activitySpacingEngine");
const { auditDuplication, scoreDuplication } = require("./duplicationAuditor");
const { assessExamReadiness } = require("./examReadinessEngine");
const { flattenPagesToBlocks } = require("./lessonBlockAnalysis");
const { analyzeTeachingJourney } = require("./lessonGeneratorV4/teachingJourneyEngine");
const { analyzeExplanationQuality } = require("./lessonGeneratorV4/explanationQualityEngine");
const { analyzeExaminerIntelligence } = require("./lessonGeneratorV4/examinerIntelligenceEngine");
const { analyzeRetrievalJourney } = require("./lessonGeneratorV4/retrievalJourneyEngine");
const { analyzeTeacherVoice } = require("./lessonGeneratorV4/teacherVoiceEngine");

const DEFAULT_THRESHOLDS = {
  architecture: 70,
  retrieval: 70,
  duplication: 70,
  overall: 70,
};

/**
 * @param {object[]} pages
 * @param {object} [ctx] — blueprint, subject, archetype
 */
function computeLessonFlowScore(pages, ctx = {}) {
  const blueprint = ctx.blueprint || null;
  const arch = validateLessonArchitecture(pages, blueprint);
  const rhythm = validateTeachTestRhythm(pages);
  const spacing = analyzeActivitySpacing(pages);
  const dup = auditDuplication(pages);
  const exam = assessExamReadiness(pages, {
    lessonArchetype: ctx.lessonArchetype || blueprint?.lessonArchetype,
    subject: ctx.subject,
  });

  const architectureScore =
    arch.architectureScore ??
    Math.round(
      (arch.missingBlocks.length === 0 ? 90 : 50) * (rhythm.valid ? 1 : 0.7)
    );

  const blocks = flattenPagesToBlocks(pages);
  const checkpointCount = blocks.filter(
    (b) => String(b.type || "").toLowerCase() === "checkpoint"
  ).length;
  const retrievalScore = Math.min(
    100,
    Math.round(
      (rhythm.valid ? 70 : 40) +
        checkpointCount * 8 +
        (spacing.valid ? 15 : 0)
    )
  );

  const activityPlacementScore = scoreActivityPlacement(pages);
  const duplicationScore = scoreDuplication(pages);
  const examReadinessScore = exam.score;

  const overallFlowScore = Math.round(
    architectureScore * 0.25 +
      retrievalScore * 0.2 +
      activityPlacementScore * 0.2 +
      duplicationScore * 0.15 +
      examReadinessScore * 0.2
  );

  return {
    overallFlowScore,
    architectureScore,
    retrievalScore,
    activityPlacementScore,
    duplicationScore,
    examReadinessScore,
    details: {
      architecture: arch,
      rhythm,
      spacing,
      duplication: dup,
      exam,
    },
  };
}

/**
 * Quality gate — block export if key scores below threshold.
 * @param {object[]} pages
 * @param {object} [ctx]
 */
function runLessonQualityGate(pages, ctx = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...ctx.thresholds };
  const scores = computeLessonFlowScore(pages, ctx);
  const failures = [];

  if (scores.architectureScore < thresholds.architecture) {
    failures.push(`architectureScore ${scores.architectureScore} < ${thresholds.architecture}`);
  }
  if (scores.retrievalScore < thresholds.retrieval) {
    failures.push(`retrievalScore ${scores.retrievalScore} < ${thresholds.retrieval}`);
  }
  if (scores.duplicationScore < thresholds.duplication) {
    failures.push(`duplicationScore ${scores.duplicationScore} < ${thresholds.duplication}`);
  }

  return {
    passed: failures.length === 0,
    blockExport: failures.length > 0 && ctx.strict !== false,
    failures,
    scores,
    thresholds,
  };
}

/**
 * Lesson flow score V2 — V3 architecture + V4 teaching intelligence.
 * @param {object[]} pages
 * @param {object} [ctx]
 */
function computeLessonFlowScoreV2(pages, ctx = {}) {
  const base = computeLessonFlowScore(pages, ctx);
  const blueprint = ctx.blueprint || null;

  const journey = analyzeTeachingJourney(pages);
  const explanation = analyzeExplanationQuality(pages);
  const examiner = analyzeExaminerIntelligence(pages);
  const retrieval = analyzeRetrievalJourney(pages, blueprint);
  const voice = analyzeTeacherVoice(pages);

  const teachingFlowScore = journey.teachingFlowScore;
  const explanationScore = explanation.explanationScore;
  const examReadinessScore = Math.round(
    (base.examReadinessScore + examiner.examReadinessScore) / 2
  );
  const retrievalJourneyScore = retrieval.retrievalJourneyScore;
  const teacherVoiceScore = voice.teacherVoiceScore;

  const overallTeachingScore = Math.round(
    teachingFlowScore * 0.22 +
      explanationScore * 0.28 +
      examReadinessScore * 0.22 +
      retrievalJourneyScore * 0.18 +
      teacherVoiceScore * 0.1
  );

  const overallFlowScoreV2 = Math.round(
    base.overallFlowScore * 0.45 + overallTeachingScore * 0.55
  );

  return {
    ...base,
    overallFlowScore: overallFlowScoreV2,
    teachingFlowScore,
    explanationScore,
    examReadinessScore,
    retrievalJourneyScore,
    teacherVoiceScore,
    overallTeachingScore,
    v4: {
      journey,
      explanation,
      examiner,
      retrieval,
      voice,
    },
  };
}

module.exports = {
  DEFAULT_THRESHOLDS,
  computeLessonFlowScore,
  computeLessonFlowScoreV2,
  runLessonQualityGate,
};
