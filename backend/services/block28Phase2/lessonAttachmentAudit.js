/**
 * Block 28 Phase 2 — per-lesson attachment audit (read-only).
 */
const { buildEditorAttachmentRow } = require("../../utils/mergeExamQuestionLessonEdit");
const {
  isBlock28SupportedType,
  validateShortMarksMarkSchemeInvariant,
  normalizeMarkSchemeLines,
} = require("../../../lib/block28PracticePolicy");
const { simulateLessonPractice } = require("./practiceSimulator");
const { jaccardSimilarity, normalizeForCompare } = require("./qualityGates");

function detectGenerationBatch(master) {
  const meta = master?.metadata || {};
  const sources = [
    meta.source,
    meta.generatedFrom?.jobId,
    meta.generatedFrom?.seed,
    meta.batch,
    meta.provenance,
  ]
    .filter(Boolean)
    .map(String);
  if (sources.length) return sources.join("|");
  const created = master?.createdAt ? new Date(master.createdAt).toISOString().slice(0, 10) : null;
  return created ? `created:${created}` : "unknown";
}

function mismatchSource(master, ref) {
  const hasLe = Boolean(ref?.lessonEdit && typeof ref.lessonEdit === "object");
  if (!hasLe) return "master";
  const leScheme = normalizeMarkSchemeLines(ref.lessonEdit.markScheme);
  const masterScheme = normalizeMarkSchemeLines(master?.markScheme);
  const leMarks = Number(ref.lessonEdit.marks);
  const masterMarks = Number(master?.marks);
  const leMismatch =
    Number.isFinite(leMarks) && leScheme.length > 0 && Math.trunc(leMarks) !== leScheme.length;
  const masterMismatch =
    Number.isFinite(masterMarks) && masterScheme.length > 0 && Math.trunc(masterMarks) !== masterScheme.length;
  if (leMismatch && !masterMismatch) return "lessonEdit";
  if (masterMismatch && !leMismatch) return "master";
  if (leMismatch && masterMismatch) return "both";
  return "master";
}

/**
 * @param {object} lesson
 * @param {Map<string, object>} mastersById
 * @param {Map<string, number>} usageCount
 */
function auditLessonAttachments(lesson, mastersById, usageCount) {
  const refs = Array.isArray(lesson.examQuestions) ? lesson.examQuestions : [];
  let studentCounter = 0;
  const practiceSim = simulateLessonPractice(lesson, mastersById, 10);
  const servedIds = new Set(practiceSim.practiceIds);

  const attachments = refs.map((ref, idx) => {
    const rawPosition = idx + 1;
    const questionId = String(ref.questionId);
    const master = mastersById.get(questionId) || null;
    const row = buildEditorAttachmentRow(master, ref, idx);
    const effective = row.effective;
    const masterType = master?.type || null;
    const effectiveType = effective?.type || masterType || "unknown";
    const supported = isBlock28SupportedType(effectiveType);
    const scheme = normalizeMarkSchemeLines(effective?.markScheme);
    let invariant = "N/A";
    if (supported && String(effectiveType).toLowerCase() === "short" && effective) {
      const inv = validateShortMarksMarkSchemeInvariant(effective.marks, effective.markScheme);
      invariant = inv.ok ? "PASS" : "FAIL";
    }
    const shownToStudents = row.available && !(row.unsupportedReason && !row.editable);
    const studentEligible = shownToStudents && supported;
    const studentServedPosition = servedIds.has(questionId) ? ++studentCounter : null;

    return {
      rawPosition,
      attachmentRefId: ref._id ? String(ref._id) : null,
      questionId,
      type: effectiveType,
      question: effective?.question || master?.question || "",
      marks: effective?.marks ?? master?.marks ?? null,
      markSchemeCount: scheme.length,
      markScheme: scheme,
      authority: mismatchSource(master, ref),
      generationBatch: detectGenerationBatch(master),
      supported,
      studentServedPosition: servedIds.has(questionId) ? practiceSim.practiceIds.indexOf(questionId) + 1 : null,
      invariant,
      usageCount: usageCount.get(questionId) || 0,
      shownToStudents,
      unsupportedReason: row.unsupportedReason || null,
      masterStatus: master?.status || null,
      metadata: master?.metadata || null,
    };
  });

  return {
    lessonId: String(lesson._id),
    lessonTitle: lesson.title || "",
    rawAttachmentCount: refs.length,
    supportedCount: attachments.filter((a) => a.supported).length,
    unsupportedCount: attachments.filter((a) => !a.supported).length,
    servedCount: practiceSim.practiceCount,
    servedInvalidCount: attachments.filter((a) => a.studentServedPosition && a.invariant === "FAIL").length,
    practiceSim,
    attachments,
  };
}

function findDuplicatePairs(attachments) {
  const supported = attachments.filter((a) => a.supported && a.type === "short");
  const pairs = [];
  for (let i = 0; i < supported.length; i++) {
    for (let j = i + 1; j < supported.length; j++) {
      const a = supported[i];
      const b = supported[j];
      const sim = jaccardSimilarity(a.question, b.question);
      let severity = "LOW";
      if (sim >= 0.92 || normalizeForCompare(a.question) === normalizeForCompare(b.question)) {
        severity = "HIGH";
      } else if (sim >= 0.72) {
        severity = "MEDIUM";
      }
      if (severity !== "LOW") {
        pairs.push({
          questionIdA: a.questionId,
          questionIdB: b.questionId,
          similarity: sim,
          severity,
          questionA: a.question,
          questionB: b.question,
        });
      }
    }
  }
  return pairs;
}

module.exports = {
  auditLessonAttachments,
  findDuplicatePairs,
  detectGenerationBatch,
};
