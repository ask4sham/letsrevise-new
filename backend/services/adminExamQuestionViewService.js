/**
 * Admin read-only Exam Question view DTO.
 * Never writes ExamQuestion / Candidate / Lesson. Never exposes URLs, tokens, or owner email.
 */
const mongoose = require("mongoose");
const ExamQuestion = require("../models/ExamQuestion");

class AdminExamQuestionViewError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "AdminExamQuestionViewError";
    this.status = status;
    this.code = code;
  }
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function mapOptions(options, correctIndex) {
  if (!Array.isArray(options)) return [];
  return options.map((text, index) => ({
    index,
    text: String(text ?? ""),
    isCorrect: correctIndex != null && Number(correctIndex) === index,
  }));
}

function mapPart(part) {
  if (!part || typeof part !== "object") return null;
  const correctIndex = part.correctIndex == null ? null : Number(part.correctIndex);
  return {
    label: String(part.label || ""),
    type: String(part.type || ""),
    marks: part.marks == null ? null : Number(part.marks),
    questionText: String(part.questionText || ""),
    options: mapOptions(part.options, correctIndex),
    correctIndex: Number.isFinite(correctIndex) ? correctIndex : null,
    markScheme: Array.isArray(part.markScheme) ? part.markScheme.map(String) : [],
  };
}

/**
 * Safe media summary — booleans/types only. No URLs, mediaIds, filenames, or alt text.
 */
function buildMediaSummary(question) {
  const hasImageUrl = Boolean(normalizeText(question.imageUrl));
  const assets = Array.isArray(question.assets) ? question.assets : [];
  const safeAssets = [];
  for (const a of assets) {
    if (!a || typeof a !== "object" || Array.isArray(a)) continue;
    const type = normalizeText(a.type).toLowerCase() || "unknown";
    const hasUrl = Boolean(normalizeText(a.url));
    const hasMediaId = a.mediaId != null && String(a.mediaId).trim() !== "";
    if (!hasUrl && !hasMediaId && type === "unknown") continue;
    safeAssets.push({
      type,
      referencePresent: Boolean(hasUrl || hasMediaId),
      hasAlt: Boolean(normalizeText(a.alt)),
    });
  }
  return {
    questionImagePresent: hasImageUrl,
    assetCount: safeAssets.length,
    assets: safeAssets,
  };
}

function toAdminExamQuestionViewDto(doc) {
  const q = doc && doc.toObject ? doc.toObject() : doc;
  const teacher = q.teacherId && typeof q.teacherId === "object" ? q.teacherId : null;
  const ownerName = teacher
    ? [teacher.firstName, teacher.lastName].filter(Boolean).join(" ").trim() || "—"
    : "—";
  const correctIndex = q.correctIndex == null ? null : Number(q.correctIndex);
  const parts = Array.isArray(q.parts)
    ? q.parts.map(mapPart).filter(Boolean)
    : [];

  return {
    id: String(q._id),
    question: String(q.question || ""),
    title: String(q.title || ""),
    sharedStem: String(q.sharedStem || ""),
    subject: String(q.subject || ""),
    examBoard: String(q.examBoard || ""),
    level: String(q.level || ""),
    topic: String(q.topic || ""),
    topicKey: String(q.topicKey || ""),
    type: String(q.type || ""),
    questionMode: String(q.questionMode || ""),
    status: String(q.status || ""),
    marks: q.marks == null ? null : Number(q.marks),
    totalMarks: q.totalMarks == null ? null : Number(q.totalMarks),
    options: mapOptions(q.options, correctIndex),
    correctIndex: Number.isFinite(correctIndex) ? correctIndex : null,
    correctAnswer: q.correctAnswer == null ? null : String(q.correctAnswer),
    markScheme: Array.isArray(q.markScheme) ? q.markScheme.map(String) : [],
    parts,
    mediaSummary: buildMediaSummary(q),
    ownerName,
    createdAt: q.createdAt ? new Date(q.createdAt).toISOString() : null,
    updatedAt: q.updatedAt ? new Date(q.updatedAt).toISOString() : null,
    readOnly: true,
  };
}

/**
 * @param {string} questionId
 */
async function getAdminExamQuestionView(questionId) {
  if (typeof questionId !== "string" || !mongoose.Types.ObjectId.isValid(questionId)) {
    throw new AdminExamQuestionViewError(400, "INVALID_QUESTION_ID", "Valid questionId required");
  }

  const question = await ExamQuestion.findById(questionId)
    .populate("teacherId", "firstName lastName")
    .lean();

  if (!question || question.isArchived) {
    throw new AdminExamQuestionViewError(404, "QUESTION_NOT_FOUND", "Exam question not found");
  }

  return toAdminExamQuestionViewDto(question);
}

module.exports = {
  AdminExamQuestionViewError,
  getAdminExamQuestionView,
  toAdminExamQuestionViewDto,
  buildMediaSummary,
};
