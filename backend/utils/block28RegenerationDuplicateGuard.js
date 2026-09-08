/**
 * Block 28 — regeneration / attach duplicate defence (scoped to Practice attachments).
 * Does not affect PR #172 attached semantic dedup at serve time.
 */
const { mergeExamQuestionForPractice } = require("./mergeExamQuestionLessonEdit");
const { isBlock28SupportedType } = require("../../lib/block28PracticePolicy");
const { assessConceptualOverlap } = require("../services/block28Phase2/conceptualOverlap");
const { normalizeText } = require("../../lib/teacherBrain/examAwarePractice");

function collectAttachedEffectiveShorts(lesson, mastersById) {
  const rows = [];
  for (const ref of lesson?.examQuestions || []) {
    const qid = ref?.questionId ? String(ref.questionId) : null;
    if (!qid) continue;
    const master = mastersById.get(qid);
    if (!master || !isBlock28SupportedType(master.type)) continue;
    if (String(master.type).toLowerCase() !== "short") continue;
    const effective = mergeExamQuestionForPractice(master, ref);
    rows.push({ questionId: qid, question: String(effective.question || "") });
  }
  return rows;
}

/**
 * Prevent attaching another conceptual copy to Block 28 Practice attachments.
 * @param {object} lesson
 * @param {object} candidateMaster
 * @param {Map<string, object>} mastersById
 * @param {object|null} candidateRef
 */
function wouldBlock28RegenerationDuplicateAttach(lesson, candidateMaster, mastersById, candidateRef = null) {
  if (!candidateMaster || !isBlock28SupportedType(candidateMaster.type)) {
    return { duplicate: false };
  }
  if (String(candidateMaster.type).toLowerCase() !== "short") {
    return { duplicate: false };
  }

  const candidateId = String(candidateMaster._id);
  const existingRefs = lesson?.examQuestions || [];
  if (existingRefs.some((r) => String(r.questionId) === candidateId)) {
    return { duplicate: true, reason: "EXACT_ID", duplicateOf: candidateId };
  }

  const candidateEffective = mergeExamQuestionForPractice(candidateMaster, candidateRef || {});
  const candidateQ = String(candidateEffective.question || "").trim();
  if (!candidateQ) return { duplicate: false };

  for (const row of collectAttachedEffectiveShorts(lesson, mastersById)) {
    if (row.questionId === candidateId) continue;
    const existingQ = String(row.question || "").trim();
    if (!existingQ) continue;
    if (normalizeText(candidateQ) === normalizeText(existingQ)) {
      return { duplicate: true, reason: "EXACT_TEXT", duplicateOf: row.questionId };
    }
    const overlap = assessConceptualOverlap(candidateQ, existingQ);
    if (overlap.severity === "HIGH") {
      return {
        duplicate: true,
        reason: "CONCEPTUAL_HIGH",
        duplicateOf: row.questionId,
        similarity: overlap.similarity,
        overlapReason: overlap.reason,
      };
    }
  }

  return { duplicate: false };
}

module.exports = {
  collectAttachedEffectiveShorts,
  wouldBlock28RegenerationDuplicateAttach,
};
