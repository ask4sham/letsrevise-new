/**
 * Autopilot 0 — System Brief V1 (L0 observe-only).
 * Read-only aggregation of existing LR platform signals. No writes.
 */
const mongoose = require("mongoose");
const revisionMetrics = require("../revisionMetrics");
const opsSignals = require("../opsSignals");
const adminTaxonomyService = require("../adminTaxonomyService");
const { isTopicGroup } = require("../../utils/topicTaxonomy");
const { queryCandidates } = require("../../utils/topicKey");
const Lesson = require("../../models/Lesson");
const LessonIssueReport = require("../../models/LessonIssueReport");
const BackgroundJob = require("../../models/BackgroundJob");
const ExamQuestion = require("../../models/ExamQuestion");
const WorksheetAttempt = require("../../models/WorksheetAttempt");
const LearningEvidenceEvent = require("../../models/LearningEvidenceEvent");
const StudentTopicProgress = require("../../models/StudentTopicProgress");
const Event = require("../../models/Event");

const VERSION = "autopilot0-system-brief-v1";
const LEVEL = "L0";
const DEFAULT_SPEC_KEY = "aqa-gcse-biology";
const TOP_GAP_LIMIT = 5;

const STATUS_ORDER = { RED: 0, AMBER: 1, UNKNOWN: 2, GREEN: 3 };

function getDeployCommit() {
  return process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || "unknown";
}

function makeDomain(status, evidence, action, confidence) {
  return {
    status,
    evidence: Array.isArray(evidence) ? evidence : [],
    action,
    confidence,
  };
}

function worstStatus(statuses) {
  const list = (statuses || []).filter(Boolean);
  if (!list.length) return "UNKNOWN";
  return list.reduce((worst, current) =>
    (STATUS_ORDER[current] ?? STATUS_ORDER.UNKNOWN) < (STATUS_ORDER[worst] ?? STATUS_ORDER.UNKNOWN)
      ? current
      : worst
  );
}

function classifyPlatformHealth({ mongoConnected, revisionAlertCount, backgroundFailureCount, sentryConfigured }) {
  const evidence = [
    { code: "MONGO_CONNECTED", detail: String(!!mongoConnected) },
    { code: "REVISION_ALERT_COUNT", detail: String(revisionAlertCount) },
    { code: "BACKGROUND_JOB_FAILURE_COUNT", detail: String(backgroundFailureCount) },
    { code: "SENTRY_CONFIGURED", detail: String(!!sentryConfigured) },
  ];

  if (!mongoConnected) {
    return makeDomain("RED", evidence, "HUMAN_REVIEW", "HIGH");
  }
  if (revisionAlertCount > 0 || backgroundFailureCount > 0) {
    return makeDomain("AMBER", evidence, "INVESTIGATE", "HIGH");
  }
  if (mongoConnected) {
    return makeDomain("GREEN", evidence, "NONE", "HIGH");
  }
  return makeDomain("UNKNOWN", evidence, "INVESTIGATE", "MEDIUM");
}

function classifyContentHealth({
  publishedLessonCount,
  draftLessonCount,
  openContentIssueCount,
  lessonsMissingTaxonomyCount,
}) {
  const evidence = [
    { code: "PUBLISHED_LESSON_COUNT", detail: String(publishedLessonCount) },
    { code: "DRAFT_LESSON_COUNT", detail: String(draftLessonCount) },
    { code: "OPEN_CONTENT_ISSUE_COUNT", detail: String(openContentIssueCount) },
    { code: "LESSONS_MISSING_TAXONOMY_COUNT", detail: String(lessonsMissingTaxonomyCount) },
  ];

  if (openContentIssueCount >= 10) {
    return makeDomain("AMBER", evidence, "INVESTIGATE", "HIGH");
  }
  if (lessonsMissingTaxonomyCount > 0) {
    return makeDomain("AMBER", evidence, "INVESTIGATE", "MEDIUM");
  }
  if (publishedLessonCount > 0) {
    return makeDomain("GREEN", evidence, "NONE", "HIGH");
  }
  if (publishedLessonCount === 0 && draftLessonCount === 0) {
    return makeDomain("UNKNOWN", evidence, "INVESTIGATE", "LOW");
  }
  return makeDomain("GREEN", evidence, "NONE", "MEDIUM");
}

function classifyCurriculumCoverage({
  specKey,
  totalTopics,
  curatedTopics,
  missingTopics,
  topPriorityGaps,
}) {
  const evidence = [
    { code: "SPEC_KEY", detail: specKey },
    { code: "TOTAL_TOPICS", detail: String(totalTopics) },
    { code: "CURATED_TOPICS", detail: String(curatedTopics) },
    { code: "MISSING_TOPICS", detail: String(missingTopics) },
    {
      code: "TOP_PRIORITY_GAPS",
      detail: topPriorityGaps.map((g) => `${g.topicKey}:${g.reason}`).join("; ") || "none",
    },
  ];

  if (totalTopics === 0) {
    return makeDomain("UNKNOWN", evidence, "INVESTIGATE", "MEDIUM");
  }
  const coverageRatio = curatedTopics / totalTopics;
  if (coverageRatio < 0.5) {
    return makeDomain("AMBER", evidence, "INVESTIGATE", "HIGH");
  }
  if (missingTopics > 0) {
    return makeDomain("AMBER", evidence, "INVESTIGATE", "HIGH");
  }
  return makeDomain("GREEN", evidence, "NONE", "HIGH");
}

function classifyAssessmentHealth({
  unmarkedWorksheetCount,
  questionsWithoutMarkSchemeCount,
  questionsWithoutTopicLinkCount,
}) {
  const evidence = [
    { code: "UNMARKED_WORKSHEET_COUNT", detail: String(unmarkedWorksheetCount) },
    { code: "QUESTIONS_WITHOUT_MARK_SCHEME_COUNT", detail: String(questionsWithoutMarkSchemeCount) },
    { code: "QUESTIONS_WITHOUT_TOPIC_LINK_COUNT", detail: String(questionsWithoutTopicLinkCount) },
  ];

  if (
    unmarkedWorksheetCount === null ||
    questionsWithoutMarkSchemeCount === null ||
    questionsWithoutTopicLinkCount === null
  ) {
    return makeDomain("UNKNOWN", evidence, "INVESTIGATE", "MEDIUM");
  }
  if (unmarkedWorksheetCount > 0 || questionsWithoutMarkSchemeCount > 0) {
    return makeDomain("AMBER", evidence, "INVESTIGATE", "HIGH");
  }
  return makeDomain("GREEN", evidence, "NONE", "MEDIUM");
}

function classifyLearningSignals({
  learningEvidenceEventCount,
  topicProgressCount,
  weakTopicAggregateCount,
}) {
  const evidence = [
    { code: "LEARNING_EVIDENCE_EVENT_COUNT", detail: String(learningEvidenceEventCount) },
    { code: "TOPIC_PROGRESS_COUNT", detail: String(topicProgressCount) },
    { code: "WEAK_TOPIC_AGGREGATE_COUNT", detail: String(weakTopicAggregateCount) },
  ];

  if (
    learningEvidenceEventCount === null ||
    topicProgressCount === null ||
    weakTopicAggregateCount === null
  ) {
    return makeDomain("UNKNOWN", evidence, "INVESTIGATE", "MEDIUM");
  }
  return makeDomain("GREEN", evidence, "NONE", "MEDIUM");
}

function classifySecurity() {
  const evidence = [
    { code: "AUTH_MIDDLEWARE_PRESENT", detail: "control presence; not a live incident assessment" },
    { code: "ADMIN_GUARD_ON_AUTOPILOT0_ROUTE", detail: "control presence; not a live incident assessment" },
    { code: "RATE_LIMITER_CONFIGURED", detail: "control presence; not a live incident assessment" },
    { code: "SENTRY_CONFIGURED", detail: String(!!process.env.SENTRY_DSN) },
    { code: "CORS_CONFIGURED", detail: "control presence; not a live incident assessment" },
  ];
  return makeDomain("GREEN", evidence, "NONE", "HIGH");
}

function classifyDependencies() {
  return makeDomain(
    "UNKNOWN",
    [
      {
        code: "DEPENDENCY_RUNTIME_AUDIT_NOT_WIRED",
        detail: "Dependency audit exists in CI but is not stored as a runtime signal.",
      },
    ],
    "INVESTIGATE",
    "HIGH"
  );
}

function classifyProductExperience({ paywallEventCount, totalLessonViews }) {
  const evidence = [
    { code: "PRODUCT_ANALYTICS_LIMITED", detail: "true" },
    { code: "PAYWALL_EVENT_COUNT", detail: String(paywallEventCount) },
    { code: "TOTAL_LESSON_VIEWS", detail: String(totalLessonViews) },
  ];
  return makeDomain("UNKNOWN", evidence, "INVESTIGATE", "HIGH");
}

function classifyRelease(commit) {
  const evidence = [{ code: "DEPLOY_COMMIT", detail: commit || "unknown" }];
  if (!commit || commit === "unknown") {
    return makeDomain("UNKNOWN", evidence, "INVESTIGATE", "MEDIUM");
  }
  return makeDomain("GREEN", evidence, "NONE", "HIGH");
}

async function safeCount(model, filter, code) {
  try {
    return await model.countDocuments(filter);
  } catch (err) {
    return { error: code, message: err.message };
  }
}

async function collectPlatformHealth() {
  const mongoConnected = mongoose.connection.readyState === 1;
  let revisionAlertCount = 0;
  let backgroundFailureCount = 0;

  try {
    const alerts =
      typeof revisionMetrics.evaluateAlerts === "function"
        ? revisionMetrics.evaluateAlerts()
        : { alerts: [] };
    revisionAlertCount = Array.isArray(alerts.alerts) ? alerts.alerts.length : 0;
  } catch {
    revisionAlertCount = null;
  }

  try {
    opsSignals.getSignalSnapshot();
  } catch {
    // optional read-only signal; ignore failures
  }

  const failedJobs = await safeCount(BackgroundJob, { status: "failed" }, "BACKGROUND_JOB_COUNT");
  backgroundFailureCount = typeof failedJobs === "number" ? failedJobs : 0;

  return classifyPlatformHealth({
    mongoConnected,
    revisionAlertCount: revisionAlertCount ?? 0,
    backgroundFailureCount,
    sentryConfigured: !!process.env.SENTRY_DSN,
  });
}

async function collectContentHealth() {
  const [published, draft, openIssues, missingTaxonomy] = await Promise.all([
    safeCount(Lesson, { status: "published", isPublished: true }, "PUBLISHED_LESSONS"),
    safeCount(Lesson, { status: "draft" }, "DRAFT_LESSONS"),
    safeCount(LessonIssueReport, { status: "open" }, "OPEN_ISSUES"),
    safeCount(
      Lesson,
      {
        status: { $ne: "archived" },
        $or: [{ specKey: { $exists: false } }, { specKey: "" }, { specKey: null }],
      },
      "MISSING_TAXONOMY"
    ),
  ]);

  return classifyContentHealth({
    publishedLessonCount: typeof published === "number" ? published : 0,
    draftLessonCount: typeof draft === "number" ? draft : 0,
    openContentIssueCount: typeof openIssues === "number" ? openIssues : 0,
    lessonsMissingTaxonomyCount: typeof missingTaxonomy === "number" ? missingTaxonomy : 0,
  });
}

async function collectCurriculumCoverage(specKey = DEFAULT_SPEC_KEY) {
  try {
    const taxonomy = await adminTaxonomyService.getMergedTaxonomyBySpecKey(specKey);
    const leafTopics = [];
    for (const unit of taxonomy?.units || []) {
      for (const t of unit.topics || []) {
        if (isTopicGroup(t)) continue;
        const slug = (t.key || t.topicKey || "").trim();
        if (!slug) continue;
        leafTopics.push({ slug, label: t.topic || slug });
      }
    }

    const lessonRows = await Lesson.aggregate([
      {
        $match: {
          specKey,
          status: "published",
          isPublished: true,
          topicKey: { $exists: true, $nin: [null, ""] },
        },
      },
      { $group: { _id: "$topicKey", count: { $sum: 1 } } },
    ]);
    const lessonCountByKey = new Map(lessonRows.map((r) => [r._id, r.count]));

    let curatedTopics = 0;
    const missingGapCandidates = [];
    for (const topic of leafTopics) {
      const candidates = queryCandidates(specKey, topic.slug);
      const hasLesson = candidates.some((key) => (lessonCountByKey.get(key) || 0) > 0);
      if (hasLesson) curatedTopics += 1;
      else missingGapCandidates.push({ topicKey: topic.slug, reason: "missingLesson" });
    }

    const totalTopics = leafTopics.length;
    const missingTopics = Math.max(0, totalTopics - curatedTopics);
    const topPriorityGaps = missingGapCandidates.slice(0, TOP_GAP_LIMIT);

    return classifyCurriculumCoverage({
      specKey,
      totalTopics,
      curatedTopics,
      missingTopics,
      topPriorityGaps,
    });
  } catch {
    return makeDomain(
      "UNKNOWN",
      [{ code: "CURRICULUM_COVERAGE_UNAVAILABLE", detail: `specKey=${specKey}` }],
      "INVESTIGATE",
      "MEDIUM"
    );
  }
}

async function collectAssessmentHealth() {
  try {
    const [unmarked, noScheme, noTopic] = await Promise.all([
      WorksheetAttempt.countDocuments({
        status: "SUBMITTED",
        answers: { $elemMatch: { awardedMarks: null } },
      }),
      ExamQuestion.countDocuments({
        $or: [{ markScheme: { $exists: false } }, { markScheme: { $size: 0 } }, { markScheme: null }],
      }),
      ExamQuestion.countDocuments({
        $or: [{ topicKey: { $exists: false } }, { topicKey: null }, { topicKey: "" }],
      }),
    ]);
    return classifyAssessmentHealth({
      unmarkedWorksheetCount: unmarked,
      questionsWithoutMarkSchemeCount: noScheme,
      questionsWithoutTopicLinkCount: noTopic,
    });
  } catch {
    return makeDomain(
      "UNKNOWN",
      [{ code: "ASSESSMENT_HEALTH_UNAVAILABLE", detail: "aggregate query failed" }],
      "INVESTIGATE",
      "MEDIUM"
    );
  }
}

async function collectLearningSignals() {
  try {
    const [events, progress, weak] = await Promise.all([
      LearningEvidenceEvent.countDocuments(),
      StudentTopicProgress.countDocuments(),
      StudentTopicProgress.countDocuments({
        masteryScore: { $lt: 70 },
        "signals.practiceAttempts": { $gte: 1 },
      }),
    ]);
    return classifyLearningSignals({
      learningEvidenceEventCount: events,
      topicProgressCount: progress,
      weakTopicAggregateCount: weak,
    });
  } catch {
    return makeDomain(
      "UNKNOWN",
      [{ code: "LEARNING_SIGNALS_UNAVAILABLE", detail: "aggregate query failed" }],
      "INVESTIGATE",
      "MEDIUM"
    );
  }
}

async function collectProductExperience() {
  try {
    const [paywallEvents, viewsAgg] = await Promise.all([
      Event.countDocuments({
        type: { $in: ["PAYWALL_NOT_ENTITLED", "FREE_PREVIEW_VIEW", "SUBSCRIBE_CTA_CLICK"] },
      }),
      Lesson.aggregate([{ $group: { _id: null, totalViews: { $sum: "$views" } } }]),
    ]);
    const totalLessonViews = viewsAgg?.[0]?.totalViews ?? 0;
    return classifyProductExperience({
      paywallEventCount: paywallEvents,
      totalLessonViews,
    });
  } catch {
    return makeDomain(
      "UNKNOWN",
      [{ code: "PRODUCT_EXPERIENCE_UNAVAILABLE", detail: "aggregate query failed" }],
      "INVESTIGATE",
      "MEDIUM"
    );
  }
}

async function buildSystemBrief() {
  const commit = getDeployCommit();
  const releaseDomain = classifyRelease(commit);

  const [
    platformHealth,
    contentHealth,
    curriculumCoverage,
    assessmentHealth,
    learningSignals,
    security,
    dependencies,
    productExperience,
  ] = await Promise.all([
    collectPlatformHealth(),
    collectContentHealth(),
    collectCurriculumCoverage(),
    collectAssessmentHealth(),
    collectLearningSignals(),
    Promise.resolve(classifySecurity()),
    Promise.resolve(classifyDependencies()),
    collectProductExperience(),
  ]);

  const domainStatuses = [
    platformHealth.status,
    contentHealth.status,
    curriculumCoverage.status,
    assessmentHealth.status,
    learningSignals.status,
    security.status,
    dependencies.status,
    productExperience.status,
    releaseDomain.status,
  ];
  const overallStatus = worstStatus(domainStatuses);
  const humanReviewRequired = overallStatus !== "GREEN";

  return {
    version: VERSION,
    level: LEVEL,
    generatedAt: new Date().toISOString(),
    release: {
      commit,
      status: releaseDomain.status,
      confidence: releaseDomain.confidence,
      evidence: releaseDomain.evidence,
    },
    summary: {
      overallStatus,
      humanReviewRequired,
    },
    domains: {
      platformHealth,
      contentHealth,
      curriculumCoverage,
      assessmentHealth,
      learningSignals,
      security,
      dependencies,
      productExperience,
    },
  };
}

module.exports = {
  VERSION,
  LEVEL,
  DEFAULT_SPEC_KEY,
  buildSystemBrief,
  worstStatus,
  makeDomain,
  classifyPlatformHealth,
  classifyContentHealth,
  classifyCurriculumCoverage,
  classifyAssessmentHealth,
  classifyLearningSignals,
  classifySecurity,
  classifyDependencies,
  classifyProductExperience,
  classifyRelease,
  getDeployCommit,
};
