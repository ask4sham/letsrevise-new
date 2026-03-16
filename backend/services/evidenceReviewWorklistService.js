/**
 * Evidence Review Worklist — admin worklist for blocked/review_required topics.
 * Aggregates from autopilot gating and topic evidence. Workflow only; no new evidence sources.
 */
const autopilotGatingService = require("./autopilotGatingService");
const topicEvidenceService = require("./topicEvidenceService");
const contentCoverageService = require("./contentCoverageService");

const HIGH_ISSUE_THRESHOLD = 3;
const LOW_APPROVAL_THRESHOLD = 60;
const MIN_REVIEWED_FOR_APPROVAL_RATE = 3;

const PRIORITY_BLOCK = 40;
const PRIORITY_REVIEW_REQUIRED = 25;
const PRIORITY_HIGH_ISSUES = 20;
const PRIORITY_LOW_APPROVAL = 20;
const PRIORITY_TEACHER_REVISIONS = 10;
const PRIORITY_AUTOPILOT_REJECTIONS = 15;

/**
 * Compute priority score for a review item.
 */
function computePriorityScore(item) {
  let score = 0;
  if (item.gateStatus === "block") score += PRIORITY_BLOCK;
  if (item.gateStatus === "review_required") score += PRIORITY_REVIEW_REQUIRED;
  const es = item.evidenceSummary || {};
  if ((es.openIssues ?? 0) >= HIGH_ISSUE_THRESHOLD) score += PRIORITY_HIGH_ISSUES;
  const reviewed = (es.autopilotApprovals ?? 0) + (es.autopilotRejections ?? 0);
  if (reviewed >= MIN_REVIEWED_FOR_APPROVAL_RATE && (es.approvalRate ?? 100) < LOW_APPROVAL_THRESHOLD) {
    score += PRIORITY_LOW_APPROVAL;
  }
  if ((es.teacherRevisions ?? 0) > 0) score += PRIORITY_TEACHER_REVISIONS;
  if ((es.autopilotRejections ?? 0) >= 3) score += PRIORITY_AUTOPILOT_REJECTIONS;
  return score;
}

/**
 * Build recommended actions for a review item.
 */
function buildReviewActions(item) {
  const actions = [];
  const es = item.evidenceSummary || {};
  const reasons = item.reasons || [];

  if ((es.openIssues ?? 0) > 0) {
    actions.push({
      type: "resolve_open_issues",
      label: "Resolve open issues",
      reason: `${es.openIssues} open lesson issue(s) need resolution.`,
    });
    actions.push({
      type: "review_content",
      label: "Review content",
      reason: "Review lesson content for quality and accuracy.",
    });
  }

  const reviewed = (es.autopilotApprovals ?? 0) + (es.autopilotRejections ?? 0);
  if (reviewed >= MIN_REVIEWED_FOR_APPROVAL_RATE && (es.approvalRate ?? 100) < LOW_APPROVAL_THRESHOLD) {
    actions.push({
      type: "inspect_rejections",
      label: "Inspect rejections",
      reason: "Autopilot approval rate is low; inspect rejection reasons.",
    });
    actions.push({
      type: "improve_prompt_pack",
      label: "Improve prompt pack",
      reason: "Consider improving prompt pack based on rejection patterns.",
    });
  }

  if (reasons.some((r) => r.includes("not autopilot-ready") || r.includes("Topic graph node") || r.includes("mapping"))) {
    actions.push({
      type: "fix_topic_mapping",
      label: "Fix topic mapping",
      reason: "Topic graph or taxonomy mapping may need correction.",
    });
    actions.push({
      type: "rebuild_graph",
      label: "Rebuild graph",
      reason: "Rebuild content graph for this topic.",
    });
  }

  if (actions.length === 0) {
    actions.push({
      type: "review_content",
      label: "Review content",
      reason: "Manual review recommended.",
    });
  }

  return actions;
}

/**
 * Build a single review item from gate and evidence.
 */
function buildReviewItem(gate, evidence) {
  const topicFull = gate.topicKey || evidence?.topicKey || "";
  const topicTitle = evidence?.topicTitle || (topicFull.split(":").pop() || topicFull);
  const evidenceHealth = evidence?.derivedMetrics?.evidenceHealth ?? "unknown";
  const counts = evidence?.evidenceCounts || {};

  const evidenceSummary = {
    openIssues: counts.lessonIssues ?? 0,
    teacherRevisions: counts.teacherRevisions ?? 0,
    approvalRate: evidence?.derivedMetrics?.approvalRate ?? null,
    autopilotRuns: counts.autopilotRuns ?? 0,
    autopilotApprovals: counts.autopilotApprovals ?? 0,
    autopilotRejections: counts.autopilotRejections ?? 0,
  };

  const item = {
    specKey: gate.specKey || "",
    topicKey: topicFull,
    topicTitle,
    gateStatus: gate.gateStatus,
    evidenceHealth,
    reasons: gate.reasons || [],
    evidenceSummary,
  };

  item.priorityScore = computePriorityScore(item);
  item.recommendedActions = buildReviewActions(item);

  const summaryParts = [];
  summaryParts.push(`Gate: ${gate.gateStatus}.`);
  summaryParts.push(`Evidence: ${evidenceHealth}.`);
  if ((evidenceSummary.openIssues ?? 0) > 0) summaryParts.push(`${evidenceSummary.openIssues} open issue(s).`);
  if (evidenceSummary.approvalRate != null)
    summaryParts.push(`Approval rate: ${evidenceSummary.approvalRate}%.`);
  item.summary = summaryParts.join(" ") || "No summary available.";

  return item;
}

/**
 * Rank items by priority (higher first), then by topicKey for stability.
 */
function rankEvidenceReviewItems(items) {
  return [...items].sort((a, b) => {
    const pa = a.priorityScore ?? 0;
    const pb = b.priorityScore ?? 0;
    if (pa !== pb) return pb - pa;
    return (a.topicKey || "").localeCompare(b.topicKey || "");
  });
}

/**
 * Get full evidence review worklist for a spec.
 */
async function getEvidenceReviewWorklist(specKey, options = {}) {
  const { limit } = options;
  const specCoverage = await contentCoverageService.getSpecCoverage(specKey);
  if (!specCoverage || !specCoverage.topics) {
    return {
      specKey: specKey || "",
      summary: { totalItems: 0, blockedItems: 0, reviewRequiredItems: 0 },
      items: [],
    };
  }

  const topics = specCoverage.topics;
  const items = [];

  for (const t of topics) {
    const topicKey = t.topicKey || "";
    const topicOnly = topicKey.split(":").pop() || topicKey;
    if (!topicKey) continue;

    const gate = await autopilotGatingService.getAutopilotGate(specKey, topicOnly);
    if (gate.gateStatus !== "block" && gate.gateStatus !== "review_required") continue;

    const evidence = await topicEvidenceService.getTopicEvidence(specKey, topicOnly);
    const item = buildReviewItem(gate, evidence);
    items.push(item);
  }

  const ranked = rankEvidenceReviewItems(items);
  const limited = limit > 0 ? ranked.slice(0, limit) : ranked;

  const summary = {
    totalItems: limited.length,
    blockedItems: limited.filter((i) => i.gateStatus === "block").length,
    reviewRequiredItems: limited.filter((i) => i.gateStatus === "review_required").length,
  };

  return {
    specKey: specKey || "",
    summary,
    items: limited,
  };
}

/**
 * Get a single evidence review item for a topic.
 * Returns null if topic is not block/review_required.
 */
async function getEvidenceReviewItem(specKey, topicKey) {
  const topicOnly = (topicKey || "").split(":").pop() || topicKey;
  const gate = await autopilotGatingService.getAutopilotGate(specKey, topicOnly);

  if (gate.gateStatus !== "block" && gate.gateStatus !== "review_required") {
    return null;
  }

  const evidence = await topicEvidenceService.getTopicEvidence(specKey, topicOnly);
  return buildReviewItem(gate, evidence);
}

module.exports = {
  getEvidenceReviewWorklist,
  getEvidenceReviewItem,
  rankEvidenceReviewItems,
  buildReviewActions,
  computePriorityScore,
};
