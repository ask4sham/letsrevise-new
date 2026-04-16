/**
 * Approval autopilot — labels high-confidence drafts for human review (never publishes).
 * Uses heuristic quality score: suggest when score ≥ 80 and no quality flags.
 */
const TopicFlashcard = require("../../models/TopicFlashcard");
const TopicQuizQuestion = require("../../models/TopicQuizQuestion");
const ExamQuestion = require("../../models/ExamQuestion");
const { scoreLeanDocForItemType } = require("../../utils/draftQualityScoring");

const AUTOPILOT_OR_LESSON_ASSETS = {
  $or: [{ "metadata.generatedBy": "autopilot" }, { "metadata.source": "ai_lesson_assets" }],
};

const APPROVAL_MIN_SCORE = 80;

/** Keep AutopilotRun.topicResults small; full count is in `labeled`. */
const MAX_AUDIT_ROWS = 80;

/**
 * @param {{ specKey?: string, limit?: number }} opts
 */
async function runApprovalAutopilot(opts) {
  const limit = Math.min(500, Math.max(1, opts.limit ?? 120));
  const { specKey } = opts;

  const base = {
    status: "draft",
    isArchived: { $ne: true },
    "metadata.suggestedForApproval": { $ne: true },
    ...AUTOPILOT_OR_LESSON_ASSETS,
  };
  if (specKey) {
    base.topicKey = new RegExp(`^${(specKey || "").replace(/-/g, "[-_]")}`, "i");
  }

  let labeled = 0;
  const topicResults = [];

  async function considerFlashcards() {
    const docs = await TopicFlashcard.find(base).sort({ createdAt: -1 }).limit(limit).lean();
    for (const d of docs) {
      const scored = scoreLeanDocForItemType("flashcard", d);
      if (scored.qualityScore < APPROVAL_MIN_SCORE) continue;
      if (scored.qualityFlags.length > 0) continue;
      if (String(d.front || "").length < 12 || String(d.back || "").length < 20) continue;
      await TopicFlashcard.findByIdAndUpdate(d._id, {
        $set: {
          "metadata.suggestedForApproval": true,
          "metadata.suggestedAt": new Date().toISOString(),
          "metadata.suggestedBy": "autopilot",
          "metadata.autopilotSource": "approval",
          "metadata.approvalConfidence": scored.approvalConfidence,
        },
      });
      labeled += 1;
      if (topicResults.length < MAX_AUDIT_ROWS) {
        topicResults.push({
          topicKey: (d.topicKey || "").split(":").pop() || d.topicKey,
          executedActions: [{ type: "suggest_approval_flashcard", status: "generated", reason: String(d._id) }],
        });
      }
    }
  }

  async function considerQuiz() {
    const docs = await TopicQuizQuestion.find(base).sort({ createdAt: -1 }).limit(limit).lean();
    for (const d of docs) {
      const scored = scoreLeanDocForItemType("quizQuestion", d);
      if (scored.qualityScore < APPROVAL_MIN_SCORE) continue;
      if (scored.qualityFlags.length > 0) continue;
      if (String(d.questionText || "").length < 24) continue;
      await TopicQuizQuestion.findByIdAndUpdate(d._id, {
        $set: {
          "metadata.suggestedForApproval": true,
          "metadata.suggestedAt": new Date().toISOString(),
          "metadata.suggestedBy": "autopilot",
          "metadata.autopilotSource": "approval",
          "metadata.approvalConfidence": scored.approvalConfidence,
        },
      });
      labeled += 1;
      if (topicResults.length < MAX_AUDIT_ROWS) {
        topicResults.push({
          topicKey: (d.topicKey || "").split(":").pop() || d.topicKey,
          executedActions: [{ type: "suggest_approval_quiz", status: "generated", reason: String(d._id) }],
        });
      }
    }
  }

  async function considerExam() {
    const exBase = { ...base };
    const docs = await ExamQuestion.find(exBase).sort({ createdAt: -1 }).limit(Math.min(limit, 80)).lean();
    for (const d of docs) {
      const scored = scoreLeanDocForItemType("examQuestion", d);
      if (scored.qualityScore < APPROVAL_MIN_SCORE) continue;
      if (scored.qualityFlags.length > 0) continue;
      const q = String(d.question || "");
      const ms = Array.isArray(d.markScheme) ? d.markScheme.join("\n") : "";
      if (q.length < 30 || ms.length < 20) continue;
      await ExamQuestion.findByIdAndUpdate(d._id, {
        $set: {
          "metadata.suggestedForApproval": true,
          "metadata.suggestedAt": new Date().toISOString(),
          "metadata.suggestedBy": "autopilot",
          "metadata.autopilotSource": "approval",
          "metadata.approvalConfidence": scored.approvalConfidence,
        },
      });
      labeled += 1;
      if (topicResults.length < MAX_AUDIT_ROWS) {
        topicResults.push({
          topicKey: (d.topicKey || "").split(":").pop() || d.topicKey,
          executedActions: [{ type: "suggest_approval_exam", status: "generated", reason: String(d._id) }],
        });
      }
    }
  }

  await considerFlashcards();
  await considerQuiz();
  await considerExam();

  if (labeled > topicResults.length && topicResults.length >= MAX_AUDIT_ROWS) {
    topicResults.push({
      topicKey: "_audit",
      topicTitle: "",
      executedActions: [
        {
          type: "suggest_approval_summary",
          status: "generated",
          reason: `audit_truncated; labeled=${labeled}; rows_shown=${MAX_AUDIT_ROWS}`,
        },
      ],
    });
  }

  return { ok: true, labeled, topicResults };
}

module.exports = { runApprovalAutopilot };
