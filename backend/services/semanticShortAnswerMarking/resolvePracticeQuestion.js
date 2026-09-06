const mongoose = require("mongoose");
const ExamQuestion = require("../../models/ExamQuestion");
const { mergeExamQuestionForPractice } = require("../../utils/mergeExamQuestionLessonEdit");
const {
  isBlock28SupportedType,
  validateShortMarksMarkSchemeInvariant,
} = require("../../../lib/block28PracticePolicy");
const { topicToKey } = require("../../utils/topicTaxonomy");
const { parseTopicKey, queryCandidates, DEFAULT_SPEC_LEGACY, buildTopicKey } = require("../../utils/topicKey");
const { assertValidNamespacedTopicKey } = require("../../utils/specTopicValidation");
const { resolveQuestionBankNamespacedTopicKey } = require("../../utils/resolveTopicRuntimeKeys");

class PracticeQuestionNotEligibleError extends Error {
  constructor(message = "Question not eligible for practice marking on this lesson") {
    super(message);
    this.code = "QUESTION_NOT_ELIGIBLE";
  }
}

function examBankTopicQueryFromLessonTopicKey(topicKeyRaw) {
  if (!topicKeyRaw || typeof topicKeyRaw !== "string" || !topicKeyRaw.trim()) {
    return { namespacedKey: null, examBankTopicFilter: null };
  }
  const trimmed = topicKeyRaw.trim();
  const parsed = parseTopicKey(trimmed);
  const specKey = parsed.specKey || DEFAULT_SPEC_LEGACY;
  const topicOnly = parsed.topicKey || trimmed.toLowerCase();
  const namespaced = trimmed.includes(":") ? trimmed : buildTopicKey(specKey, topicOnly);
  try {
    const nsSpec = parseTopicKey(namespaced).specKey || specKey;
    assertValidNamespacedTopicKey(nsSpec, namespaced);
  } catch (_) {
    return { namespacedKey: null, examBankTopicFilter: null };
  }
  const nsSpec = parseTopicKey(namespaced).specKey || specKey;
  const bankNs = resolveQuestionBankNamespacedTopicKey(nsSpec, namespaced);
  const bankParsed = parseTopicKey(bankNs);
  const bankSpec = bankParsed.specKey || nsSpec;
  const bankTopicOnly = bankParsed.topicKey || topicOnly;
  const candidates = queryCandidates(bankSpec, bankTopicOnly);
  const examBankTopicFilter =
    candidates.length > 0 ? { topicKey: { $in: candidates } } : { topicKey: bankNs };
  return { namespacedKey: namespaced, examBankTopicFilter };
}

/**
 * @param {object} lesson
 * @param {object} master
 * @returns {boolean}
 */
function isBankEligibleMaster(lesson, master) {
  if (!master || master.status !== "published") return false;
  if (!isBlock28SupportedType(master.type) || String(master.type).toLowerCase() !== "short") {
    return false;
  }
  const topicKey = lesson.topicKey || topicToKey(lesson.topic) || "";
  const { examBankTopicFilter } = examBankTopicQueryFromLessonTopicKey(topicKey);
  if (!examBankTopicFilter) return false;
  const masterTopic = master.topicKey != null ? String(master.topicKey) : "";
  const allowed = examBankTopicFilter.topicKey;
  if (allowed && typeof allowed === "object" && Array.isArray(allowed.$in)) {
    return allowed.$in.some((k) => String(k) === masterTopic);
  }
  return String(allowed) === masterTopic;
}

function attachmentQuestionId(ref) {
  if (!ref?.questionId) return "";
  if (ref.questionId._id) return String(ref.questionId._id);
  return String(ref.questionId);
}

/**
 * Resolve effective practice question for semantic marking.
 * @param {{ lesson: object, questionId: string, attachmentRefId?: string }} input
 */
async function resolvePracticeQuestionForMarking(input) {
  const { lesson, questionId, attachmentRefId } = input;
  if (!mongoose.Types.ObjectId.isValid(questionId)) {
    throw new PracticeQuestionNotEligibleError("Invalid questionId");
  }

  const refs = Array.isArray(lesson.examQuestions) ? lesson.examQuestions : [];
  let ref = null;

  if (attachmentRefId) {
    if (!mongoose.Types.ObjectId.isValid(attachmentRefId)) {
      throw new PracticeQuestionNotEligibleError("Invalid attachmentRefId");
    }
    ref = refs.find((r) => r._id && String(r._id) === String(attachmentRefId));
    if (!ref) throw new PracticeQuestionNotEligibleError("Attachment not found on lesson");
    if (attachmentQuestionId(ref) !== String(questionId)) {
      throw new PracticeQuestionNotEligibleError("attachmentRefId does not match questionId");
    }
  } else {
    ref = refs.find((r) => attachmentQuestionId(r) === String(questionId)) || null;
  }

  let master = null;
  if (ref) {
    if (ref.questionId && ref.questionId._id) {
      master = ref.questionId;
    } else {
      master = await ExamQuestion.findById(questionId).lean();
    }
  } else {
    master = await ExamQuestion.findById(questionId).lean();
    if (!master || !isBankEligibleMaster(lesson, master)) {
      throw new PracticeQuestionNotEligibleError("Question not attached or bank-eligible for lesson");
    }
  }

  if (!master) throw new PracticeQuestionNotEligibleError("ExamQuestion not found");

  const attachment = ref || { questionId };
  let effective;
  try {
    effective = mergeExamQuestionForPractice(master, attachment);
  } catch (_) {
    throw new PracticeQuestionNotEligibleError("Could not merge practice question");
  }

  if (!effective || String(effective.type).toLowerCase() !== "short") {
    throw new PracticeQuestionNotEligibleError("Only short practice questions are supported");
  }

  const invariant = validateShortMarksMarkSchemeInvariant(effective.marks, effective.markScheme);
  if (!invariant.ok) {
    throw new PracticeQuestionNotEligibleError(invariant.msg || "Invalid mark scheme invariant");
  }

  const topicKey = master.topicKey != null ? String(master.topicKey) : undefined;
  const topic = master.topic != null ? String(master.topic) : lesson.topic;

  return {
    effectiveQuestion: effective.question,
    effectiveMarks: invariant.marks,
    effectiveMarkScheme: invariant.markScheme,
    attachmentRefId: ref?._id ? String(ref._id) : undefined,
    questionId: String(questionId),
    subject: lesson.subject || master.subject || "Biology",
    board: lesson.board || master.examBoard || master.board || undefined,
    level: lesson.level || master.level || "GCSE",
    topic: topic || undefined,
    topicKey,
  };
}

module.exports = {
  PracticeQuestionNotEligibleError,
  resolvePracticeQuestionForMarking,
  isBankEligibleMaster,
};
