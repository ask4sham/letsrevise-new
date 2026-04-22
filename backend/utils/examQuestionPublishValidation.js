/**
 * Exam Question Bank — publish readiness (distinct from Topic Quiz Bank quick-check MCQs).
 * Applied on PUT when status → published.
 */

/**
 * @param {Object} doc - ExamQuestion-like (type, marks, markScheme, question, correctAnswer, metadata)
 * @returns {{ ok: boolean, msg?: string }}
 */
function validateExamQuestionPublishReadiness(doc) {
  const topicKey = String(doc.topicKey || "").trim();
  if (!topicKey) {
    return {
      ok: false,
      msg:
        "Cannot publish: this item needs a canonical topic from the taxonomy so it can match lessons in Exam Practice.",
    };
  }
  const type = String(doc.type || "short").toLowerCase();
  const marks = Number(doc.marks);
  const qText = String(doc.question || "").trim();
  const ms = Array.isArray(doc.markScheme) ? doc.markScheme.map((s) => String(s || "").trim()).filter(Boolean) : [];
  const substantial = ms.filter((l) => l.length >= 10);
  const modelAns = String(doc.correctAnswer || doc.metadata?.modelAnswer || "").trim();

  if (type === "mcq") {
    return {
      ok: false,
      msg: "Exam Question Bank does not support multiple choice. Use the Topic Quiz Bank for MCQs.",
    };
  }

  if (substantial.length < 2) {
    return {
      ok: false,
      msg: "Publishing requires at least two substantive mark-scheme points (about a sentence each).",
    };
  }

  if (type === "short") {
    if (qText.length > 0 && qText.length < 25) {
      return { ok: false, msg: "Question stem looks too short for an exam-style prompt—expand the stem before publishing." };
    }
    if (modelAns.length < 20 && substantial.length < 3) {
      return {
        ok: false,
        msg: "Add a clearer model answer or a third mark-scheme bullet before publishing this short answer.",
      };
    }
  }

  return { ok: true };
}

/**
 * Creating a new Exam Question Bank row (POST) — stricter than legacy edits: no new MCQs, min 2 marks, then same gates as publish.
 * @param {Object} body - req.body for ExamQuestion.create
 * @returns {{ ok: boolean, msg?: string }}
 */
function validateNewExamQuestionBankDraft(body) {
  const topicKey = String(body?.topicKey || "").trim();
  if (!topicKey) {
    return {
      ok: false,
      msg:
        "Cannot save: selected topic is not linked to a canonical topicKey. Choose a topic from the taxonomy list.",
    };
  }
  const type = String(body?.type || "short").toLowerCase();
  if (type === "mcq") {
    return {
      ok: false,
      msg: "New Exam Question Bank items cannot be multiple choice. Use the Topic Quiz Bank for MCQs.",
    };
  }
  const marks = Number(body?.marks);
  if (!Number.isFinite(marks) || marks < 2) {
    return { ok: false, msg: "Exam Question Bank entries need at least 2 marks." };
  }
  return validateExamQuestionPublishReadiness(body);
}

module.exports = { validateExamQuestionPublishReadiness, validateNewExamQuestionBankDraft };
