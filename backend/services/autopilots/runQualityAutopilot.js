/**
 * Quality autopilot — conservative AI rewrites for weak draft bank items (flashcards + quiz MCQ).
 * Uses heuristic quality scores: low / flagged → improve; high scores skipped.
 */
const TopicFlashcard = require("../../models/TopicFlashcard");
const TopicQuizQuestion = require("../../models/TopicQuizQuestion");
const {
  scoreFlashcardDraft,
  scoreQuizMcqDraft,
  eligibleForQualityRewrite,
} = require("../../utils/draftQualityScoring");
const {
  applyFlashcardAiRewrite,
  applyQuizMcqAiRewrite,
} = require("../aiRewriteDraftAsset");

const DEFAULT_MAX_ITEMS = 20;

function pickFlashcardAction(flags) {
  if (!flags || flags.length === 0) return null;
  if (flags.includes("likely_duplicate_concept")) return "improve_recall_prompt";
  if (flags.includes("answer_too_short")) return "simplify_answer";
  if (flags.includes("answer_too_long")) return "shorten_answer";
  if (flags.includes("vague_front")) return "improve_recall_prompt";
  return "improve_recall_prompt";
}

function pickQuizAction(flags) {
  if (!flags || flags.length === 0) return null;
  if (flags.includes("question_too_short_or_unclear")) return "reword_question";
  if (flags.includes("explanation_too_short")) return "improve_explanation";
  if (flags.includes("weak_distractors")) return "improve_distractors";
  if (flags.includes("likely_duplicate_concept")) return "reword_question";
  if (flags.includes("duplicate_concept")) return "reword_question";
  return "improve_explanation";
}

async function patchQualityAudit(Model, id) {
  await Model.findByIdAndUpdate(id, {
    $set: {
      "metadata.qualityImproved": true,
      "metadata.qualityImprovedAt": new Date().toISOString(),
      "metadata.improvedByAutopilot": true,
      "metadata.autopilotSource": "quality",
    },
  });
}

/**
 * @param {{ maxItems?: number, specKey?: string }} opts
 */
async function runQualityAutopilot(opts) {
  const maxItems = Math.min(50, Math.max(1, opts.maxItems ?? DEFAULT_MAX_ITEMS));
  const { specKey } = opts;

  const base = {
    status: "draft",
    isArchived: { $ne: true },
    "metadata.qualityImproved": { $ne: true },
    $or: [{ "metadata.aiGenerated": true }, { "metadata.generatedBy": "autopilot" }, { "metadata.source": "ai_lesson_assets" }],
  };
  if (specKey) {
    base.topicKey = new RegExp(`^${(specKey || "").replace(/-/g, "[-_]")}`, "i");
  }

  const topicResults = [];
  let improved = 0;
  let skipped = 0;
  let errors = 0;

  const fcDocs = await TopicFlashcard.find(base).sort({ updatedAt: 1 }).limit(maxItems * 2).exec();
  const qqDocs = await TopicQuizQuestion.find(base).sort({ updatedAt: 1 }).limit(maxItems * 2).exec();

  let processed = 0;

  for (const card of fcDocs) {
    if (processed >= maxItems) break;
    const scored = scoreFlashcardDraft({ front: card.front, back: card.back, pageId: card.metadata?.pageId });
    const score = scored.qualityScore ?? 100;
    const effFlags = scored.qualityFlags || [];
    if (!eligibleForQualityRewrite(score, effFlags)) {
      skipped += 1;
      continue;
    }
    const action = pickFlashcardAction(effFlags);
    if (!action) {
      skipped += 1;
      continue;
    }
    try {
      await applyFlashcardAiRewrite(card, action);
      await patchQualityAudit(TopicFlashcard, card._id);
      improved += 1;
      processed += 1;
      topicResults.push({
        topicKey: (card.topicKey || "").split(":").pop() || card.topicKey,
        executedActions: [{ type: "quality_flashcard", status: "generated", reason: action }],
      });
    } catch (e) {
      errors += 1;
      topicResults.push({
        topicKey: (card.topicKey || "").split(":").pop() || card.topicKey,
        executedActions: [{ type: "quality_flashcard", status: "failed", reason: String(e.message || e).slice(0, 200) }],
      });
      processed += 1;
    }
  }

  for (const q of qqDocs) {
    if (processed >= maxItems) break;
    const flags = quizMcqFlags({
      questionText: q.questionText,
      choices: q.choices,
      explanation: q.explanation,
    });
    const scored =
      q.metadata?.qualityScore != null
        ? { qualityScore: q.metadata.qualityScore, qualityFlags: flags }
        : scoreQuizMcqDraft({
            questionText: q.questionText,
            choices: q.choices,
            explanation: q.explanation,
            correctIndex: q.correctIndex,
          });
    const score = scored.qualityScore ?? 100;
    const effFlags = scored.qualityFlags || flags;
    if (!eligibleForQualityRewrite(score, effFlags)) {
      skipped += 1;
      continue;
    }
    const action = pickQuizAction(effFlags);
    if (!action) {
      skipped += 1;
      continue;
    }
    try {
      await applyQuizMcqAiRewrite(q, action);
      await patchQualityAudit(TopicQuizQuestion, q._id);
      improved += 1;
      processed += 1;
      topicResults.push({
        topicKey: (q.topicKey || "").split(":").pop() || q.topicKey,
        executedActions: [{ type: "quality_quiz", status: "generated", reason: action }],
      });
    } catch (e) {
      errors += 1;
      topicResults.push({
        topicKey: (q.topicKey || "").split(":").pop() || q.topicKey,
        executedActions: [{ type: "quality_quiz", status: "failed", reason: String(e.message || e).slice(0, 200) }],
      });
      processed += 1;
    }
  }

  return { ok: true, improved, skipped, errors, topicResults };
}

module.exports = { runQualityAutopilot };
