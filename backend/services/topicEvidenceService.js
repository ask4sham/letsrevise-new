/**
 * Topic Evidence Service — aggregates evidence signals for content quality.
 * Uses existing platform data: issues, revisions, autopilot runs, approval outcomes.
 * Deterministic, null-safe. No student mastery data yet.
 */
const mongoose = require("mongoose");
const LessonIssueReport = require("../models/LessonIssueReport");
const LessonRevisionDraft = require("../models/LessonRevisionDraft");
const AutopilotRun = require("../models/AutopilotRun");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");
const contentCoverageService = require("./contentCoverageService");
const contentGraphService = require("./contentGraphService");
const adminTaxonomyService = require("./adminTaxonomyService");

const AUTOPILOT_META = "metadata.generatedBy";
const AUTOPILOT_VALUE = "autopilot";
const HIGH_ISSUE_THRESHOLD = 3;
const LOW_APPROVAL_THRESHOLD = 60;
const STRONG_APPROVAL_THRESHOLD = 80;
const MIN_REVIEWED_FOR_APPROVAL_RATE = 3;

/**
 * Get lesson IDs linked to a topic via content graph.
 */
async function getLessonIdsForTopic(specKey, topicKey) {
  const graph = await contentGraphService.getTopicGraph(specKey, topicKey);
  if (!graph || !graph.linkedNodes) return [];
  const lessonNodes = graph.linkedNodes.filter((n) => n.nodeType === "lesson" && n.lessonId);
  return lessonNodes.map((n) => n.lessonId).filter(Boolean);
}

/**
 * Get topic title from taxonomy.
 */
async function getTopicTitle(specKey, topicKey) {
  const taxonomy = await adminTaxonomyService.getMergedTaxonomyBySpecKey(specKey);
  if (!taxonomy?.units) return (topicKey || "").split(":").pop() || topicKey || "";
  const topicOnly = (topicKey || "").split(":").pop() || topicKey;
  for (const u of taxonomy.units) {
    const t = (u.topics || []).find((tp) => (tp.key || "").toLowerCase() === (topicOnly || "").toLowerCase());
    if (t) return t.topic || t.key || topicOnly;
  }
  return topicOnly;
}

/**
 * Classify evidence health from counts and approval rate.
 * Deterministic, easy to tune.
 */
function classifyEvidenceHealth(openIssues, approvalRate, reviewedItems, teacherRevisions) {
  const issues = openIssues ?? 0;
  const rate = approvalRate ?? null;
  const reviewed = reviewedItems ?? 0;

  if (issues >= HIGH_ISSUE_THRESHOLD) return "weak";
  if (reviewed >= MIN_REVIEWED_FOR_APPROVAL_RATE && rate !== null && rate < LOW_APPROVAL_THRESHOLD) return "weak";

  if (issues > 0) return "mixed";
  if (reviewed >= MIN_REVIEWED_FOR_APPROVAL_RATE && rate !== null && rate >= LOW_APPROVAL_THRESHOLD && rate < STRONG_APPROVAL_THRESHOLD) return "mixed";
  if ((teacherRevisions ?? 0) > 0 && issues === 0 && (reviewed < MIN_REVIEWED_FOR_APPROVAL_RATE || rate === null)) return "mixed";

  if (issues === 0 && reviewed >= MIN_REVIEWED_FOR_APPROVAL_RATE && rate !== null && rate >= STRONG_APPROVAL_THRESHOLD) return "strong";
  if (issues === 0 && reviewed < MIN_REVIEWED_FOR_APPROVAL_RATE && (teacherRevisions ?? 0) === 0) return "unknown";

  return "mixed";
}

/**
 * Classify issue rate level.
 */
function classifyIssueRateLevel(openIssues) {
  const n = openIssues ?? 0;
  if (n >= HIGH_ISSUE_THRESHOLD) return "high";
  if (n > 0) return "medium";
  return "low";
}

/**
 * Build topic evidence for one topic.
 */
async function getTopicEvidence(specKey, topicKey) {
  const topicOnly = (topicKey || "").split(":").pop() || topicKey;
  const topicFull = (topicKey || "").includes(":") ? topicKey : `${specKey}:${(topicOnly || "").trim()}`;

  const [lessonIds, coverage, title] = await Promise.all([
    getLessonIdsForTopic(specKey, topicOnly),
    contentCoverageService.getTopicCoverage(specKey, topicOnly),
    getTopicTitle(specKey, topicOnly),
  ]);

  const lessonIssueCount =
    lessonIds.length > 0
      ? await LessonIssueReport.countDocuments({
          lessonId: { $in: lessonIds.map((id) => new mongoose.Types.ObjectId(id)) },
          status: "open",
        })
      : (coverage?.issueCount ?? 0);

  const teacherRevisionCount =
    lessonIds.length > 0
      ? await LessonRevisionDraft.countDocuments({
          lessonId: { $in: lessonIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
      : 0;

  const specPattern = (specKey || "").replace(/-/g, "[-_]");
  const topicEscaped = (topicOnly || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const topicRegex = topicEscaped ? new RegExp(topicEscaped, "i") : null;
  const topicFullRegex = specPattern && topicEscaped ? new RegExp(`^${specPattern}.*${topicEscaped}`, "i") : topicRegex;

  const runOr = [];
  if (topicRegex) runOr.push({ topicKey: topicRegex }, { "topicResults.topicKey": topicRegex });
  if (topicFullRegex && topicFullRegex !== topicRegex) runOr.push({ topicKey: topicFullRegex }, { "topicResults.topicKey": topicFullRegex });

  const autopilotRuns = await AutopilotRun.countDocuments({
    specKey: specPattern ? new RegExp(`^${specPattern}`, "i") : /.*/,
    ...(runOr.length > 0 ? { $or: runOr } : {}),
    dryRun: false,
  });

  const baseAutopilot = { [AUTOPILOT_META]: AUTOPILOT_VALUE };
  const contentOr = [];
  if (topicRegex) contentOr.push({ topicKey: topicRegex });
  if (topicFullRegex && topicFullRegex !== topicRegex) contentOr.push({ topicKey: topicFullRegex });
  const topicFilter = contentOr.length > 0 ? { $or: contentOr } : {};
  const [approvedFc, rejectedFc, approvedQq, rejectedQq, approvedEq, rejectedEq] = await Promise.all([
    TopicFlashcard.countDocuments({ ...baseAutopilot, ...topicFilter, status: "published" }),
    TopicFlashcard.countDocuments({ ...baseAutopilot, ...topicFilter, isArchived: true }),
    TopicQuizQuestion.countDocuments({ ...baseAutopilot, ...topicFilter, status: "published" }),
    TopicQuizQuestion.countDocuments({ ...baseAutopilot, ...topicFilter, isArchived: true }),
    ExamQuestion.countDocuments({ ...baseAutopilot, ...topicFilter, status: "published" }),
    ExamQuestion.countDocuments({ ...baseAutopilot, ...topicFilter, isArchived: true }),
  ]);

  const autopilotApprovals = approvedFc + approvedQq + approvedEq;
  const autopilotRejections = rejectedFc + rejectedQq + rejectedEq;
  const reviewedItems = autopilotApprovals + autopilotRejections;
  const approvalRate = reviewedItems > 0 ? Math.round((autopilotApprovals / reviewedItems) * 100) : null;

  const evidenceCounts = {
    lessonIssues: lessonIssueCount,
    teacherRevisions: teacherRevisionCount,
    autopilotRuns,
    autopilotApprovals,
    autopilotRejections,
  };

  const evidenceSignals = {
    hasOpenIssues: lessonIssueCount > 0,
    hasHighIssueVolume: lessonIssueCount >= HIGH_ISSUE_THRESHOLD,
    hasTeacherRevisionActivity: teacherRevisionCount > 0,
    hasAutopilotHistory: autopilotRuns > 0,
    hasLowApprovalRate: reviewedItems >= MIN_REVIEWED_FOR_APPROVAL_RATE && approvalRate !== null && approvalRate < LOW_APPROVAL_THRESHOLD,
  };

  const evidenceHealth = classifyEvidenceHealth(lessonIssueCount, approvalRate, reviewedItems, teacherRevisionCount);
  const issueRateLevel = classifyIssueRateLevel(lessonIssueCount);

  const derivedMetrics = {
    approvalRate,
    issueRateLevel,
    evidenceHealth,
  };

  return buildTopicEvidenceSummary({
    specKey: specKey || "",
    topicKey: topicFull,
    topicTitle: title || topicOnly,
    evidenceCounts,
    evidenceSignals,
    derivedMetrics,
  });
}

/**
 * Build full evidence object with blockers, recommendations, summary.
 */
function buildTopicEvidenceSummary(raw) {
  const counts = raw.evidenceCounts || {};
  const signals = raw.evidenceSignals || {};
  const metrics = raw.derivedMetrics || {};
  const health = metrics.evidenceHealth || "unknown";

  const blockers = [];
  if (signals.hasHighIssueVolume) blockers.push("High open issue count on linked lessons.");
  if (signals.hasLowApprovalRate) blockers.push("Autopilot output has low approval rate.");
  if (signals.hasOpenIssues && !signals.hasHighIssueVolume) blockers.push("Some open issues on linked lessons.");

  const recommendations = [];
  if (signals.hasHighIssueVolume || (signals.hasOpenIssues && (counts.lessonIssues ?? 0) >= 2)) {
    recommendations.push("Review lesson content due to repeated open issues.");
  }
  if (signals.hasLowApprovalRate) {
    recommendations.push("Autopilot output quality is low for this topic; inspect rejection reasons.");
  }
  if (health === "unknown" && (counts.autopilotRuns ?? 0) === 0 && (counts.teacherRevisions ?? 0) === 0) {
    recommendations.push("Topic has little evidence yet; monitor after more usage.");
  }
  if (health === "strong") {
    recommendations.push("Evidence is healthy; topic appears stable.");
  }
  if (health === "mixed" && recommendations.length === 0) {
    recommendations.push("Some evidence signals; review if issues persist.");
  }

  const summaryParts = [];
  if (health === "strong") summaryParts.push("Evidence is strong.");
  else if (health === "mixed") summaryParts.push("Evidence is mixed.");
  else if (health === "weak") summaryParts.push("Evidence indicates problems.");
  else summaryParts.push("Not enough evidence yet.");

  if ((counts.lessonIssues ?? 0) > 0) summaryParts.push(`${counts.lessonIssues} open issue(s).`);
  if ((counts.teacherRevisions ?? 0) > 0) summaryParts.push(`${counts.teacherRevisions} revision draft(s).`);
  if ((counts.autopilotRuns ?? 0) > 0) {
    summaryParts.push(`${counts.autopilotRuns} autopilot run(s).`);
    if (metrics.approvalRate !== null) summaryParts.push(`Approval rate: ${metrics.approvalRate}%.`);
  }

  const summary = summaryParts.join(" ") || "No evidence data available.";

  return {
    specKey: raw.specKey || "",
    topicKey: raw.topicKey || "",
    topicTitle: raw.topicTitle || "",
    evidenceCounts: { ...counts },
    evidenceSignals: { ...signals },
    derivedMetrics: { ...metrics },
    blockers,
    recommendations,
    summary: summary.trim(),
  };
}

/**
 * Get evidence for all topics in a spec.
 */
async function getSpecEvidence(specKey) {
  const specCoverage = await contentCoverageService.getSpecCoverage(specKey);
  if (!specCoverage || !specCoverage.topics) {
    return { specKey, summary: { totalTopics: 0, strongTopics: 0, mixedTopics: 0, weakTopics: 0, unknownTopics: 0 }, topics: [] };
  }

  const topics = await Promise.all(
    specCoverage.topics.map((t) => {
      const tk = t.topicKey || "";
      const sk = t.specKey || specKey;
      return getTopicEvidence(sk, tk);
    })
  );

  const summary = {
    totalTopics: topics.length,
    strongTopics: topics.filter((x) => (x.derivedMetrics?.evidenceHealth || "") === "strong").length,
    mixedTopics: topics.filter((x) => (x.derivedMetrics?.evidenceHealth || "") === "mixed").length,
    weakTopics: topics.filter((x) => (x.derivedMetrics?.evidenceHealth || "") === "weak").length,
    unknownTopics: topics.filter((x) => (x.derivedMetrics?.evidenceHealth || "") === "unknown").length,
  };

  return { specKey, summary, topics };
}

/**
 * Get topics with weak evidence for a spec.
 */
async function getWeakEvidenceTopics(specKey, options = {}) {
  const { limit = 50 } = options;
  const { topics } = await getSpecEvidence(specKey);
  const weak = topics.filter((t) => (t.derivedMetrics?.evidenceHealth || "") === "weak");
  return weak.slice(0, limit);
}

module.exports = {
  getTopicEvidence,
  getSpecEvidence,
  buildTopicEvidenceSummary,
  getWeakEvidenceTopics,
  classifyEvidenceHealth,
  classifyIssueRateLevel,
};
