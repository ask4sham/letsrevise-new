/**
 * PR16: Shared logic for attaching exam questions by topicKey.
 * Used by: POST /api/lessons/:id/exam-questions/attach-by-topic and POST /api/reports/lessons/:lessonId/one-click-fix.
 * PR-CHEM-3: Query by $in candidates so both namespaced and legacy ExamQuestions are found.
 */
const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");
const { findTopicByKey } = require("./topicTaxonomy");
const { resolveLessonTopicKeyForAttach } = require("./resolveLessonTopicKeyForAttach");
const { parseTopicKey, queryCandidates, DEFAULT_SPEC_LEGACY, buildTopicKey } = require("./topicKey");
const { assertValidNamespacedTopicKey } = require("./specTopicValidation");
const { resolveQuestionBankNamespacedTopicKey } = require("./resolveTopicRuntimeKeys");
const { EXCLUDE_SANDBOX_MANUAL_TEST } = require("./examQuestionSandboxFilter");

/**
 * Attach top N exam questions by topicKey to a lesson (only those not already attached).
 * @param {Object} lesson - Lean lesson doc with _id, teacherId, organisationId, examQuestions, topic, topicKey?
 * @param {Object} options - { topicKey?: string, limit?: number }
 * @returns {Promise<{ topicKey: string, topic: string|null, requested: number, added: number, addedIds: string[] }>}
 * @throws never; returns added: 0 and empty addedIds on invalid topic or no candidates.
 */
async function attachExamQuestionsByTopic(lesson, options = {}) {
  const limit = typeof options.limit === "number" ? options.limit : parseInt(String(options.limit || "10"), 10);
  const requested = Number.isFinite(limit) && limit >= 1 ? Math.min(20, Math.max(1, limit)) : 10;

  let rawTopic;
  if (options.topicKey != null && String(options.topicKey).trim() !== "") {
    const resolved = resolveLessonTopicKeyForAttach(lesson, options.topicKey);
    if (!resolved) {
      const err = new Error("Invalid topicKey");
      err.code = "INVALID_TOPIC_KEY";
      throw err;
    }
    rawTopic = resolved;
  } else {
    const resolved = resolveLessonTopicKeyForAttach(lesson);
    if (!resolved) {
      const err = new Error("Lesson topic isn't mapped to Biology taxonomy yet — set a valid topic.");
      err.code = "INVALID_TOPIC";
      throw err;
    }
    rawTopic = resolved;
  }

  const parsed = parseTopicKey(rawTopic);
  const specKey = parsed.specKey || DEFAULT_SPEC_LEGACY;
  const topicOnly = (parsed.topicKey || rawTopic).toLowerCase();
  const namespaced = rawTopic.includes(":") ? rawTopic : buildTopicKey(specKey, topicOnly);
  try {
    const nsSpec = parseTopicKey(namespaced).specKey || specKey;
    assertValidNamespacedTopicKey(nsSpec, namespaced);
  } catch (e) {
    const err = new Error(
      options.topicKey != null && String(options.topicKey).trim() !== ""
        ? "Invalid topicKey"
        : "Lesson topic isn't mapped to Biology taxonomy yet — set a valid topic."
    );
    err.code = options.topicKey != null && String(options.topicKey).trim() !== "" ? "INVALID_TOPIC_KEY" : "INVALID_TOPIC";
    throw err;
  }
  const nsSpec = parseTopicKey(namespaced).specKey || specKey;
  const bankNs = resolveQuestionBankNamespacedTopicKey(nsSpec, namespaced);
  const bankParsed = parseTopicKey(bankNs);
  const bankSpec = bankParsed.specKey || nsSpec;
  const bankTopicOnly = bankParsed.topicKey || topicOnly;
  const queryCands = queryCandidates(bankSpec, bankTopicOnly);
  const examTopicFilter =
    queryCands.length > 0 ? { topicKey: { $in: queryCands } } : { topicKey: bankNs };

  const topicKeyToUse = namespaced;
  const topicTitle =
    findTopicByKey(namespaced)?.topic ??
    findTopicByKey(bankNs)?.topic ??
    null;

  const existingRefs = Array.isArray(lesson.examQuestions) ? lesson.examQuestions : [];
  const existingIds = new Set(existingRefs.map((r) => String(r.questionId)));

  const ownershipFilter = {
    $or: [
      { teacherId: lesson.teacherId },
      ...(lesson.organisationId ? [{ scope: "organisation", organisationId: lesson.organisationId }] : []),
      { scope: "platform" },
    ],
  };
  const sandboxExcludeFilter = EXCLUDE_SANDBOX_MANUAL_TEST;
  const candidates = await ExamQuestion.find({
    ...examTopicFilter,
    ...ownershipFilter,
    ...sandboxExcludeFilter,
  })
    .select("_id marks createdAt")
    .sort({ marks: -1, createdAt: -1 })
    .limit(requested * 3)
    .lean();

  const toAdd = [];
  for (const q of candidates) {
    if (toAdd.length >= requested) break;
    const qid = String(q._id);
    if (!existingIds.has(qid)) {
      toAdd.push(qid);
      existingIds.add(qid);
    }
  }

  if (toAdd.length === 0) {
    return {
      topicKey: topicKeyToUse,
      topic: findTopicByKey(topicKeyToUse)?.topic ?? null,
      requested,
      added: 0,
      addedIds: [],
    };
  }

  const lessonDoc = await Lesson.findById(lesson._id);
  if (!lessonDoc) {
    return {
      topicKey: topicKeyToUse,
      topic: findTopicByKey(topicKeyToUse)?.topic ?? null,
      requested,
      added: 0,
      addedIds: [],
    };
  }
  const refs = Array.isArray(lessonDoc.examQuestions) ? lessonDoc.examQuestions : [];
  for (const qid of toAdd) {
    refs.push({ questionId: new mongoose.Types.ObjectId(qid), addedAt: new Date() });
  }
  lessonDoc.examQuestions = refs;
  await lessonDoc.save();

  return {
    topicKey: topicKeyToUse,
    topic: topicTitle,
    requested,
    added: toAdd.length,
    addedIds: toAdd,
  };
}

module.exports = { attachExamQuestionsByTopic };
