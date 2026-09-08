/**
 * Block 28 Integrity Census V2 — read-only scanner (no write capability).
 */
const { buildEditorAttachmentRow } = require("../../utils/mergeExamQuestionLessonEdit");
const {
  isBlock28SupportedType,
  validateShortMarksMarkSchemeInvariant,
  normalizeMarkSchemeLines,
} = require("../../../lib/block28PracticePolicy");
const { simulateLessonPractice } = require("./practiceSimulator");
const { assessConceptualOverlap } = require("./conceptualOverlap");
const { normalizeText } = require("../../../lib/teacherBrain/examAwarePractice");

function deriveSpecKey(lesson) {
  const tk = lesson?.topicKey ? String(lesson.topicKey) : "";
  const idx = tk.indexOf(":");
  return idx > 0 ? tk.slice(0, idx).toLowerCase() : "";
}

function scanLessonBlock28Integrity(lesson, mastersById, usageCount, opts = {}) {
  const limit = opts.practiceLimit ?? 10;
  const refs = Array.isArray(lesson.examQuestions) ? lesson.examQuestions : [];
  const sim = simulateLessonPractice(lesson, mastersById, limit);
  const servedIds = new Set(sim.practiceIds.map(String));

  let unsupportedAttachments = 0;
  let invalidServedQuestions = 0;
  let missingSchemes = 0;
  let invalidLessonEdits = 0;
  let duplicateExactIds = 0;
  const conceptualDuplicateRisks = [];
  const sharedMasterRisks = [];
  const servedRows = [];

  const attachmentRows = refs.map((ref, idx) => {
    const master = ref?.questionId ? mastersById.get(String(ref.questionId)) : null;
    const editor = buildEditorAttachmentRow(master, ref, idx);
    const effective = editor.effective;
    const type = effective?.type || master?.type || "unknown";
    const supported = isBlock28SupportedType(type);
    const usage = ref?.questionId ? usageCount.get(String(ref.questionId)) || 0 : 0;
    if (!supported && editor.available) unsupportedAttachments += 1;
    if (usage > 1) sharedMasterRisks.push({ questionId: String(ref.questionId), usageCount: usage });

    let invalidLessonEdit = false;
    if (ref?.lessonEdit && master) {
      try {
        const { validateExamQuestionLessonEdit } = require("../../utils/validateExamQuestionLessonEdit");
        validateExamQuestionLessonEdit(master, ref.lessonEdit);
      } catch {
        invalidLessonEdit = true;
        invalidLessonEdits += 1;
      }
    }

    const scheme = normalizeMarkSchemeLines(effective?.markScheme);
    const inv =
      supported && String(type).toLowerCase() === "short" && effective
        ? validateShortMarksMarkSchemeInvariant(effective.marks, effective.markScheme)
        : null;

    const studentServed = servedIds.has(String(ref.questionId));
    if (studentServed) {
      servedRows.push({
        questionId: String(ref.questionId),
        invariantPass: inv?.ok === true,
        schemeCount: scheme.length,
      });
      if (inv && !inv.ok) invalidServedQuestions += 1;
      if (scheme.length === 0) missingSchemes += 1;
    }

    return {
      questionId: ref?.questionId ? String(ref.questionId) : null,
      supported,
      studentServed,
      invariant: inv ? (inv.ok ? "PASS" : "FAIL") : "N/A",
      invalidLessonEdit,
    };
  });

  const servedIdList = sim.practiceIds.map(String);
  duplicateExactIds = servedIdList.length - new Set(servedIdList).size;

  for (let i = 0; i < servedIdList.length; i += 1) {
    for (let j = i + 1; j < servedIdList.length; j += 1) {
      const a = mastersById.get(servedIdList[i]);
      const b = mastersById.get(servedIdList[j]);
      if (!a || !b) continue;
      const refA = refs.find((r) => String(r.questionId) === servedIdList[i]);
      const refB = refs.find((r) => String(r.questionId) === servedIdList[j]);
      const editorA = buildEditorAttachmentRow(a, refA, 0);
      const editorB = buildEditorAttachmentRow(b, refB, 0);
      const qa = editorA.effective?.question || a.question;
      const qb = editorB.effective?.question || b.question;
      if (normalizeText(qa) === normalizeText(qb)) {
        conceptualDuplicateRisks.push({
          questionIdA: servedIdList[i],
          questionIdB: servedIdList[j],
          severity: "EXACT_TEXT",
        });
        continue;
      }
      const overlap = assessConceptualOverlap(qa, qb);
      if (overlap.severity === "HIGH" || overlap.severity === "MEDIUM") {
        conceptualDuplicateRisks.push({
          questionIdA: servedIdList[i],
          questionIdB: servedIdList[j],
          severity: overlap.severity,
          similarity: overlap.similarity,
          reason: overlap.reason,
        });
      }
    }
  }

  return {
    lessonId: String(lesson._id),
    title: lesson.title || "",
    topicKey: lesson.topicKey,
    specKey: deriveSpecKey(lesson),
    status: lesson.status,
    rawAttachmentCount: refs.length,
    servedQuestions: servedIdList.length,
    invalidServedQuestions,
    unsupportedAttachments,
    duplicateExactIds,
    conceptualDuplicateRisks,
    missingSchemes,
    invalidLessonEdits,
    sharedMasterRisks,
    servedRows,
  };
}

/**
 * @param {object[]} lessons
 * @param {Map<string, object>} mastersById
 * @param {Map<string, number>} usageCount
 * @param {object} [filter]
 */
function runBlock28IntegrityCensus(lessons, mastersById, usageCount, filter = {}) {
  let rows = lessons.filter((l) => Array.isArray(l.examQuestions) && l.examQuestions.length > 0);

  if (filter.specKey) {
    rows = rows.filter((l) => deriveSpecKey(l) === String(filter.specKey).toLowerCase());
  }
  if (filter.publishedOnly) {
    rows = rows.filter((l) => String(l.status || "").toLowerCase() === "published" || l.isPublished === true);
  }
  if (filter.lessonIds?.length) {
    const set = new Set(filter.lessonIds.map(String));
    rows = rows.filter((l) => set.has(String(l._id)));
  }
  if (filter.examBoard) {
    const board = String(filter.examBoard).toLowerCase();
    rows = rows.filter(
      (l) =>
        String(l.board || l.examBoard || "").toLowerCase().includes(board) ||
        String(l.topicKey || "").toLowerCase().includes(board)
    );
  }

  const lessonReports = rows.map((lesson) => scanLessonBlock28Integrity(lesson, mastersById, usageCount, filter));

  const totals = {
    lessonsScanned: lessonReports.length,
    servedQuestions: lessonReports.reduce((s, r) => s + r.servedQuestions, 0),
    invalidServedQuestions: lessonReports.reduce((s, r) => s + r.invalidServedQuestions, 0),
    unsupportedAttachments: lessonReports.reduce((s, r) => s + r.unsupportedAttachments, 0),
    duplicateExactIds: lessonReports.reduce((s, r) => s + r.duplicateExactIds, 0),
    conceptualDuplicateRisks: lessonReports.reduce((s, r) => s + r.conceptualDuplicateRisks.length, 0),
    missingSchemes: lessonReports.reduce((s, r) => s + r.missingSchemes, 0),
    invalidLessonEdits: lessonReports.reduce((s, r) => s + r.invalidLessonEdits, 0),
    sharedMasterRisks: lessonReports.reduce((s, r) => s + r.sharedMasterRisks.length, 0),
  };

  return {
    generatedAt: new Date().toISOString(),
    mode: "READ_ONLY",
    filter,
    totals,
    lessons: lessonReports,
  };
}

module.exports = {
  deriveSpecKey,
  scanLessonBlock28Integrity,
  runBlock28IntegrityCensus,
};
