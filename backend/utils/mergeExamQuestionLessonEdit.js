/**
 * Merge lesson-specific exam question edits over master ExamQuestion records.
 * Used by GET /practice and GET /exam-questions (editor read).
 */

const SUPPORTED_PRACTICE_TYPES = new Set(["mcq", "short"]);

function trimStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((o) => trimStr(o)).filter(Boolean);
}

function deriveCorrectIndex(options, correctAnswer) {
  const ca = trimStr(correctAnswer);
  if (!ca || options.length === 0) return -1;
  const idx = options.findIndex((o) => trimStr(o) === ca);
  return idx >= 0 ? idx : -1;
}

function masterCorrectAnswer(master) {
  const options = Array.isArray(master?.options) ? master.options : [];
  if (master?.correctAnswer != null && trimStr(master.correctAnswer)) {
    return trimStr(master.correctAnswer);
  }
  if (
    typeof master?.correctIndex === "number" &&
    master.correctIndex >= 0 &&
    options[master.correctIndex] != null
  ) {
    return trimStr(options[master.correctIndex]);
  }
  return "";
}

function explanationFromMarkScheme(markScheme, explanation) {
  const expl = trimStr(explanation);
  if (expl) return expl;
  if (Array.isArray(markScheme) && markScheme.length > 0) {
    return markScheme.map((l) => trimStr(l)).filter(Boolean).join("\n");
  }
  return "";
}

/**
 * Map master-only document to practice API shape (legacy behaviour).
 * @param {object} master
 * @returns {object}
 */
function mapMasterToPracticeShape(master) {
  const options = Array.isArray(master.options) ? master.options : [];
  const correctAnswer = masterCorrectAnswer(master);
  const markScheme = Array.isArray(master.markScheme) ? master.markScheme : undefined;
  return {
    id: String(master._id),
    question: master.question != null ? String(master.question) : "",
    type: master.type || "short",
    marks: typeof master.marks === "number" ? master.marks : 1,
    options: options.length > 0 ? options : undefined,
    correctAnswer: correctAnswer || undefined,
    explanation: explanationFromMarkScheme(markScheme, undefined) || undefined,
    markScheme,
    topicKey: master.topicKey != null ? String(master.topicKey) : undefined,
    topic: master.topic != null ? String(master.topic) : undefined,
    imageUrl: master.imageUrl != null ? String(master.imageUrl) : undefined,
  };
}

/**
 * Build effective practice payload from master + optional attachment.lessonEdit.
 * @param {object|null|undefined} master - populated ExamQuestion or lean doc
 * @param {object} attachment - { questionId, addedAt?, lessonEdit? }
 * @returns {object|null} practice shape or null when unavailable
 */
function mergeExamQuestionForPractice(master, attachment) {
  const rawQuestionId =
    master?._id != null
      ? String(master._id)
      : attachment?.questionId != null
        ? String(attachment.questionId)
        : "";

  const lessonEdit =
    attachment?.lessonEdit && typeof attachment.lessonEdit === "object"
      ? attachment.lessonEdit
      : null;

  if (!lessonEdit) {
    if (!master || !master._id) return null;
    return mapMasterToPracticeShape(master);
  }

  const masterType = master?.type ? String(master.type) : null;
  const editType = String(lessonEdit.type || "");

  if (masterType && editType && masterType !== editType) {
    throw new Error("lessonEdit.type must match master ExamQuestion.type");
  }

  const effectiveType = masterType || editType;
  if (!SUPPORTED_PRACTICE_TYPES.has(effectiveType)) {
    return null;
  }

  const effectiveQuestion = trimStr(lessonEdit.question) || (master ? String(master.question ?? "") : "");
  const effectiveMarks =
    typeof lessonEdit.marks === "number" && lessonEdit.marks >= 1
      ? lessonEdit.marks
      : typeof master?.marks === "number"
        ? master.marks
        : 1;

  let effectiveOptions;
  if (effectiveType === "mcq") {
    const opts = normalizeOptions(lessonEdit.options);
    effectiveOptions = opts.length > 0 ? opts : normalizeOptions(master?.options);
  }

  const effectiveCorrectAnswer =
    lessonEdit.correctAnswer != null && trimStr(lessonEdit.correctAnswer)
      ? trimStr(lessonEdit.correctAnswer)
      : masterCorrectAnswer(master);

  const effectiveMarkScheme = Array.isArray(lessonEdit.markScheme)
    ? lessonEdit.markScheme.map((l) => trimStr(l)).filter(Boolean)
    : Array.isArray(master?.markScheme)
      ? master.markScheme.map((l) => trimStr(l)).filter(Boolean)
      : undefined;

  const effectiveExplanation = explanationFromMarkScheme(
    effectiveMarkScheme,
    lessonEdit.explanation
  );

  const out = {
    id: rawQuestionId,
    question: effectiveQuestion,
    type: effectiveType,
    marks: effectiveMarks,
    correctAnswer: effectiveCorrectAnswer || undefined,
    explanation: effectiveExplanation || undefined,
    markScheme: effectiveMarkScheme && effectiveMarkScheme.length > 0 ? effectiveMarkScheme : undefined,
    topicKey: master?.topicKey != null ? String(master.topicKey) : undefined,
    topic: master?.topic != null ? String(master.topic) : undefined,
    imageUrl: master?.imageUrl != null ? String(master.imageUrl) : undefined,
  };

  if (effectiveType === "mcq" && effectiveOptions && effectiveOptions.length > 0) {
    out.options = effectiveOptions;
  }

  return out;
}

function isEditableMasterType(type) {
  return SUPPORTED_PRACTICE_TYPES.has(String(type || ""));
}

const UNSUPPORTED_TYPE_MESSAGE = "This question type is managed in the Question Bank.";
const UNAVAILABLE_MESSAGE = "Question unavailable — remove from lesson";

/**
 * Editor attachment row for GET /exam-questions.
 */
function buildEditorAttachmentRow(master, attachment, slotIndex) {
  const questionId =
    attachment?.questionId != null
      ? String(attachment.questionId)
      : master?._id
        ? String(master._id)
        : "";

  const hasLessonEdit = Boolean(
    attachment?.lessonEdit && typeof attachment.lessonEdit === "object"
  );

  const masterType = master?.type ? String(master.type) : null;
  const editable = master ? isEditableMasterType(masterType) : hasLessonEdit;

  let unsupportedReason;
  if (!master && !hasLessonEdit) {
    unsupportedReason = UNAVAILABLE_MESSAGE;
  } else if (master && !isEditableMasterType(masterType)) {
    unsupportedReason = UNSUPPORTED_TYPE_MESSAGE;
  }

  let effective = null;
  try {
    effective = mergeExamQuestionForPractice(master, attachment);
  } catch (_) {
    effective = null;
  }

  const masterPayload = master
    ? {
        _id: String(master._id),
        question: master.question != null ? String(master.question) : "",
        type: master.type,
        marks: master.marks,
        options: master.options,
        correctAnswer: masterCorrectAnswer(master) || undefined,
        markScheme: master.markScheme,
        topicKey: master.topicKey,
        topic: master.topic,
        imageUrl: master.imageUrl,
      }
    : null;

  return {
    questionId,
    slotIndex,
    addedAt: attachment?.addedAt ? new Date(attachment.addedAt).toISOString() : undefined,
    editable,
    unsupportedReason,
    hasLessonEdit,
    available: Boolean(effective),
    master: masterPayload,
    effective,
    lessonEdit: hasLessonEdit ? attachment.lessonEdit : null,
  };
}

module.exports = {
  SUPPORTED_PRACTICE_TYPES,
  UNSUPPORTED_TYPE_MESSAGE,
  UNAVAILABLE_MESSAGE,
  mergeExamQuestionForPractice,
  mapMasterToPracticeShape,
  buildEditorAttachmentRow,
  isEditableMasterType,
  deriveCorrectIndex,
};
