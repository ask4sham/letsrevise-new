/**
 * Student dashboard service — unified aggregation for GET /api/student/dashboard.
 * Reuses: studentTopicEvidenceService, studyCoachService, studentRecommendationsService.
 */
const studentTopicEvidenceService = require("./studentTopicEvidenceService");
const studyCoachService = require("./studyCoachService");
const studentRecommendationsService = require("./studentRecommendationsService");
const adaptiveRevisionService = require("./adaptiveRevisionService");
const StudentTeacherLink = require("../models/StudentTeacherLink");
const User = require("../models/User");
const { normalizeSpecKey } = require("../config/featureFlags");

const DEFAULT_SPEC = "aqa-gcse-biology";

/**
 * Get weak topics from LearningEvidenceEvent (canonical mastery source).
 * Topics with masteryScore < 70 and at least one attempt.
 */
function getWeakTopicsFromEvidence(topics) {
  return topics
    .filter((t) => {
      const score = t.derivedMetrics?.masteryScore;
      const attempts =
        (t.quizStats?.attempts ?? 0) + (t.examStats?.attempts ?? 0);
      return attempts >= 1 && score !== null && score < 70;
    })
    .map((t) => ({
      topicKey: t.topicKey,
      topicName: (t.topicKey || "").split(":").pop()?.replace(/-/g, " ") || t.topicKey,
      percentage: t.derivedMetrics?.masteryScore ?? 0,
      correct: (t.quizStats?.correct ?? 0) + (t.examStats?.correct ?? 0),
      total: (t.quizStats?.attempts ?? 0) + (t.examStats?.attempts ?? 0),
    }))
    .sort((a, b) => a.percentage - b.percentage);
}

/**
 * Build revision focus summary (static; no LLM for dashboard speed).
 */
function buildRevisionSummary(weakTopics) {
  if (!weakTopics || weakTopics.length === 0) {
    return "Keep practising to see personalised revision focus.";
  }
  const names = weakTopics.map((w) => w.topicName || w.topicKey).join(", ");
  return `Focus your revision on: ${names}.`;
}

/**
 * Get unified dashboard data for a student.
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @param {{ specKey?: string, days?: number, limit?: number }} [opts]
 * @returns {Promise<{ ok: boolean, summary: object, weakTopics: Array, recentActivity: Array, studyPlan: object, recommendations: object }>}
 */
async function getDashboard(userId, opts = {}) {
  const specKey = normalizeSpecKey(opts.specKey || DEFAULT_SPEC) || DEFAULT_SPEC;
  const days = opts.days ?? 14;
  const limit = opts.limit ?? 6;

  const [specEvidence, recentActivity, studyPlan, recommendations, links] = await Promise.all([
    studentTopicEvidenceService.getSpecLearningEvidence(specKey, userId),
    studentTopicEvidenceService.getStudentRecentActivity(userId, 10),
    studyCoachService.getPlanData(userId, specKey),
    studentRecommendationsService.getRecommendations(userId, { days, limit }),
    StudentTeacherLink.find({ studentId: userId }).select("teacherId").limit(5).lean(),
  ]);

  let linkedTeachers = [];
  if (links && links.length > 0) {
    const teacherIds = links.map((l) => l.teacherId).filter(Boolean);
    const teachers = await User.find({ _id: { $in: teacherIds } }).select("_id firstName lastName").lean();
    linkedTeachers = teachers.map((t) => ({
      teacherId: String(t._id),
      teacherName: [t.firstName, t.lastName].filter(Boolean).join(" ") || "Teacher",
    }));
  }

  const weakTopics = getWeakTopicsFromEvidence(specEvidence.topics || []);
  const revisionFocus = buildRevisionSummary(weakTopics);

  const adaptive = await adaptiveRevisionService.getAdaptiveRevisionData(userId, specKey, specEvidence);

  // Enrich study plan with adaptive reasons and recommended actions
  const adaptiveMap = new Map((adaptive.adaptiveRecommendations || []).map((a) => [a.topicKey, a]));
  const enrichedPlan = (studyPlan.plan || []).map((p) => {
    const ad = adaptiveMap.get(p.topicKey);
    return {
      ...p,
      reason: ad?.reason ?? p.reason,
      recommendedAction: ad?.recommendedAction ?? "viewLesson",
    };
  });

  return {
    ok: true,
    summary: {
      revisionFocus,
    },
    weakTopics,
    recentActivity,
    specEvidence: {
      specKey: specEvidence.specKey,
      topics: specEvidence.topics || [],
    },
    studyPlan: {
      specKey: studyPlan.specKey,
      generatedAt: studyPlan.generatedAt,
      plan: enrichedPlan,
    },
    recommendations: {
      topics: recommendations.topics || [],
      lessons: recommendations.lessons || [],
      days: recommendations.days,
    },
    linkedTeachers,
    dueToday: adaptive.dueToday,
    overdueTopics: adaptive.overdueTopics,
    adaptiveRecommendations: adaptive.adaptiveRecommendations,
  };
}

module.exports = { getDashboard, getWeakTopicsFromEvidence, buildRevisionSummary };
