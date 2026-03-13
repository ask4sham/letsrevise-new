/**
 * PR-038: Student topic progress service.
 * Deterministic mastery scoring from activity signals; explainable recommendations.
 */
const StudentTopicProgress = require("../../models/StudentTopicProgress");
const CoverageSnapshot = require("../../models/CoverageSnapshot");
const { normalizeSpecKey } = require("../../config/featureFlags");

const SIGNAL_TYPES = [
  "lessonViews",
  "aiEnquiries",
  "weakAiEnquiries",
  "topicSummaries",
  "practiceAttempts",
  "practiceCorrect",
  "flashcardReviews",
];

/**
 * Upsert a progress signal for a student topic.
 * @param {{ userId: import("mongoose").Types.ObjectId, specKey: string, topicKey: string, signalType: string, value?: number, meta?: object }} opts
 */
async function upsertStudentTopicProgressSignal({ userId, specKey, topicKey, signalType, value = 1, meta }) {
  if (!userId || !specKey || !topicKey || !SIGNAL_TYPES.includes(signalType)) return null;

  const spec = normalizeSpecKey(specKey);
  if (!spec) return null;

  const doc = await StudentTopicProgress.findOneAndUpdate(
    { userId, specKey: spec, topicKey: topicKey.trim() },
    {
      $inc: { [`signals.${signalType}`]: typeof value === "number" ? value : 1 },
      $set: { "signals.lastActivityAt": new Date(), updatedAt: new Date() },
    },
    { upsert: true, new: true }
  );

  if (!doc) return null;

  const coverageRow = await getCoverageRow(spec, topicKey);
  const computed = recomputeMastery(doc, coverageRow);
  await StudentTopicProgress.updateOne(
    { _id: doc._id },
    {
      $set: {
        masteryScore: computed.masteryScore,
        confidenceBand: computed.confidenceBand,
        status: computed.status,
        recommendations: {
          nextAction: computed.nextAction,
          reason: computed.reason,
          updatedAt: new Date(),
        },
      },
    }
  );

  return doc;
}

/**
 * Get latest coverage row for a topic (if any).
 */
async function getCoverageRow(specKey, topicKey) {
  const spec = normalizeSpecKey(specKey);
  if (!spec || !topicKey) return null;
  const latest = await CoverageSnapshot.findOne({ specKey: spec }).sort({ computedAt: -1 }).lean();
  if (!latest) return null;
  const row = await CoverageSnapshot.findOne({
    specKey: spec,
    topicKey: topicKey.trim(),
    computedAt: latest.computedAt,
  }).lean();
  return row;
}

/**
 * Recompute mastery score, confidence band, status, and next action.
 * @param {object} progressDoc - StudentTopicProgress document (with signals)
 * @param {object} [coverageRow] - CoverageSnapshot row for topic
 * @returns {{ masteryScore: number, confidenceBand: string, status: string, nextAction?: string, reason?: string }}
 */
function recomputeMastery(progressDoc, coverageRow) {
  const s = progressDoc.signals || {};
  const lessonViews = (s.lessonViews || 0);
  const aiEnquiries = (s.aiEnquiries || 0);
  const weakAiEnquiries = (s.weakAiEnquiries || 0);
  const topicSummaries = (s.topicSummaries || 0);
  const flashcardReviews = (s.flashcardReviews || 0);
  const practiceAttempts = (s.practiceAttempts || 0);
  const practiceCorrect = (s.practiceCorrect || 0);

  // Base score from signals (0–90 max before penalties/caps)
  let score = 0;
  score += Math.min(15, lessonViews * 5); // up to 15 for 3+ views
  score += Math.min(10, aiEnquiries * 5);  // up to 10 for 2+ enquiries
  score += Math.min(10, topicSummaries * 5); // up to 10 for 2+ summaries
  score += Math.min(15, flashcardReviews * 5); // up to 15 for 3+ reviews
  score += Math.min(20, practiceAttempts * 5); // up to 20 for 4+ attempts
  const ratio = practiceAttempts > 0 ? practiceCorrect / practiceAttempts : 0;
  score += Math.min(20, Math.round(ratio * 25)); // up to 20 for 80%+ correct

  // Penalty: weak AI enquiries
  score -= Math.min(15, weakAiEnquiries * 5);

  score = Math.max(0, score);

  // Coverage adjustment: cap if THIN/EMPTY/NO_SPEC
  const coverageStatus = coverageRow?.status || "OK";
  if (["THIN", "EMPTY", "NO_SPEC"].includes(coverageStatus)) {
    score = Math.min(70, score);
  }
  // Allow up to 100 if STRONG and practice is good
  score = Math.min(100, score);

  // ConfidenceBand: low < 35, medium 35–69, high >= 70
  let confidenceBand = "low";
  if (score >= 70) confidenceBand = "high";
  else if (score >= 35) confidenceBand = "medium";

  // Status: new / learning / practising / secure
  const hasMeaningfulSignals = lessonViews > 0 || aiEnquiries > 0 || topicSummaries > 0 || practiceAttempts > 0 || flashcardReviews > 0;
  let status = "new";
  if (hasMeaningfulSignals) {
    if (score >= 70) status = "secure";
    else if (score >= 35) status = "practising";
    else status = "learning";
  }

  // NextAction + reason (explainable)
  let nextAction = "askAi";
  let reason = "Ready to move on. Ask AI if you need help.";
  if (lessonViews === 0) {
    nextAction = "viewLesson";
    reason = "You haven't viewed the lesson yet. Start by reading the content.";
  } else if (weakAiEnquiries > 0 && topicSummaries === 0) {
    nextAction = "summarise";
    reason = "You've asked about this topic several times, but confidence is still low. Try a topic summary to consolidate.";
  } else if (practiceAttempts === 0) {
    nextAction = "practice";
    reason = "You've viewed the lesson, but haven't practised it yet.";
  } else if (ratio < 0.6 && practiceAttempts >= 1) {
    nextAction = "reviseFlashcards";
    reason = "Your practice score is still low. Revise with flashcards to strengthen recall.";
  } else if (["THIN", "EMPTY", "NO_SPEC"].includes(coverageStatus)) {
    reason = "This topic is important and still has thin content coverage.";
  }

  return { masteryScore: score, confidenceBand, status, nextAction, reason };
}

module.exports = {
  upsertStudentTopicProgressSignal,
  recomputeMastery,
  getCoverageRow,
};
