/**
 * Evidence-Aware Autopilot Gating — decision logic only.
 * Uses readiness, evidence, and gap to gate autopilot execution.
 * Deterministic and explainable. No generation redesign.
 */
const topicEvidenceService = require("./topicEvidenceService");
const autopilotReadinessService = require("./autopilotReadinessService");
const curriculumGapDetectionService = require("./curriculumGapDetectionService");

const HIGH_ISSUE_THRESHOLD = 3;
const LOW_APPROVAL_THRESHOLD = 60;
const MIN_REVIEWED_FOR_APPROVAL_RATE = 3;

const ALL_ACTIONS = ["generate_flashcards", "generate_quiz", "generate_exam_questions"];
const LIMITED_ACTIONS = ["generate_flashcards", "generate_quiz"];

/**
 * Decide gate status from evidence, readiness, and gap.
 * Order: block first, then review_required, then limited, then allow.
 */
function decideAutopilotGateFromEvidence(evidence, readiness, gap) {
  const ready = readiness?.ready ?? false;
  const evidenceHealth = evidence?.derivedMetrics?.evidenceHealth ?? "unknown";
  const openIssues = evidence?.evidenceCounts?.lessonIssues ?? gap?.counts?.openIssues ?? 0;
  const approvalRate = evidence?.derivedMetrics?.approvalRate ?? null;
  const reviewedItems =
    (evidence?.evidenceCounts?.autopilotApprovals ?? 0) + (evidence?.evidenceCounts?.autopilotRejections ?? 0);
  const hasLowApprovalRate =
    reviewedItems >= MIN_REVIEWED_FOR_APPROVAL_RATE && approvalRate !== null && approvalRate < LOW_APPROVAL_THRESHOLD;

  const reasons = [];
  let gateStatus = "allow";
  let allowedActions = [...ALL_ACTIONS];
  let blockedActions = [];

  // 1. block: topic not autopilot-ready
  if (!ready) {
    gateStatus = "block";
    allowedActions = [];
    blockedActions = [...ALL_ACTIONS];
    reasons.push("Topic is not autopilot-ready.");
    if (readiness?.blockers?.length) {
      reasons.push(...readiness.blockers.slice(0, 2));
    }
    return buildGateResult(gateStatus, reasons, allowedActions, blockedActions);
  }

  // 2. block: weak evidence and high issues
  if (evidenceHealth === "weak" && openIssues >= HIGH_ISSUE_THRESHOLD) {
    gateStatus = "block";
    allowedActions = [];
    blockedActions = [...ALL_ACTIONS];
    reasons.push("Evidence health is weak and open issues are high; review content first.");
    return buildGateResult(gateStatus, reasons, allowedActions, blockedActions);
  }

  // 3. review_required: weak evidence or low approval rate
  if (evidenceHealth === "weak" || hasLowApprovalRate) {
    gateStatus = "review_required";
    allowedActions = [];
    blockedActions = [...ALL_ACTIONS];
    if (evidenceHealth === "weak") reasons.push("Evidence health is weak.");
    if (hasLowApprovalRate) reasons.push("Autopilot approval rate is low; inspect rejection reasons.");
    reasons.push("No automatic execution; admin can inspect.");
    return buildGateResult(gateStatus, reasons, allowedActions, blockedActions);
  }

  // 4. limited: mixed evidence — allow only flashcards and quiz
  if (evidenceHealth === "mixed") {
    gateStatus = "limited";
    allowedActions = [...LIMITED_ACTIONS];
    blockedActions = ["generate_exam_questions"];
    reasons.push("Evidence is mixed; exam question generation is blocked.");
    return buildGateResult(gateStatus, reasons, allowedActions, blockedActions);
  }

  // 5. allow: ready and (strong or unknown) evidence
  if (evidenceHealth === "strong") {
    reasons.push("Evidence is strong; all actions allowed.");
  } else if (evidenceHealth === "unknown") {
    reasons.push("Evidence is unknown; all actions allowed.");
  }
  return buildGateResult(gateStatus, reasons, allowedActions, blockedActions);
}

function buildGateResult(gateStatus, reasons, allowedActions, blockedActions) {
  const summary =
    gateStatus === "allow"
      ? "Autopilot can run all actions."
      : gateStatus === "limited"
      ? "Autopilot limited to flashcards and quiz; exam questions blocked."
      : gateStatus === "review_required"
      ? "Autopilot requires review; no automatic execution."
      : "Autopilot is blocked for this topic.";
  return {
    gateStatus,
    reasons,
    allowedActions,
    blockedActions,
    summary,
  };
}

/**
 * Get full gate decision for a topic.
 */
async function getAutopilotGate(specKey, topicKey) {
  const topicOnly = (topicKey || "").split(":").pop() || topicKey;
  const topicFull = (topicKey || "").includes(":") ? topicKey : `${specKey}:${(topicOnly || "").trim()}`;

  const [evidence, readiness, gap] = await Promise.all([
    topicEvidenceService.getTopicEvidence(specKey, topicOnly),
    autopilotReadinessService.getTopicAutopilotReadiness(specKey, topicOnly),
    curriculumGapDetectionService.detectSingleTopicGap(specKey, topicOnly),
  ]);

  if (!gap) {
    return {
      specKey: specKey || "",
      topicKey: topicFull,
      gateStatus: "block",
      reasons: ["Topic not found."],
      allowedActions: [],
      blockedActions: [...ALL_ACTIONS],
      summary: "Topic not found.",
    };
  }

  const gate = decideAutopilotGateFromEvidence(evidence, readiness, gap);
  return {
    specKey: specKey || "",
    topicKey: topicFull,
    ...gate,
  };
}

module.exports = {
  getAutopilotGate,
  decideAutopilotGateFromEvidence,
  ALL_ACTIONS,
  LIMITED_ACTIONS,
};
