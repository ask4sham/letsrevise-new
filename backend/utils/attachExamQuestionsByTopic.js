/**
 * PR16: Shared logic for attaching exam questions by topicKey.
 * Used by: POST /api/lessons/:id/exam-questions/attach-by-topic and POST /api/reports/lessons/:lessonId/one-click-fix.
 * PR-CHEM-3: Query by $in candidates so both namespaced and legacy ExamQuestions are found.
 */
const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");
const { findTopicByKey, findTopicBySpecAndKey, topicToKey } = require("./topicTaxonomy");
const { parseTopicKey, queryCandidates, DEFAULT_SPEC_LEGACY } = require("./topicKey");

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

  let topicKeyToUse;
  let specKey = DEFAULT_SPEC_LEGACY;
  let topicOnly;

  if (options.topicKey != null && String(options.topicKey).trim() !== "") {
    const raw = String(options.topicKey).trim();
    const parsed = parseTopicKey(raw);
    specKey = parsed.specKey || DEFAULT_SPEC_LEGACY;
    topicOnly = (parsed.topicKey || raw).toLowerCase();
    const found = findTopicBySpecAndKey(specKey, topicOnly) || findTopicByKey(raw);
    if (!found) {
      const err = new Error("Invalid topicKey");
      err.code = "INVALID_TOPIC_KEY";
      throw err;
    }
    topicKeyToUse = found.key;
  } else {
    const lessonKey = (lesson.topicKey && String(lesson.topicKey).trim()) || topicToKey(lesson.topic || "");
    if (!lessonKey) {
      const err = new Error("Lesson topic isn't mapped to Biology taxonomy yet — set a valid topic.");
      err.code = "INVALID_TOPIC";
      throw err;
    }
    const parsed = parseTopicKey(lessonKey);
    specKey = parsed.specKey || DEFAULT_SPEC_LEGACY;
    topicOnly = (parsed.topicKey || lessonKey).toLowerCase();
    const found = findTopicBySpecAndKey(specKey, topicOnly) || findTopicByKey(lessonKey);
    if (!found) {
      const err = new Error("Lesson topic isn't mapped to Biology taxonomy yet — set a valid topic.");
      err.code = "INVALID_TOPIC";
      throw err;
    }
    topicKeyToUse = found.key;
  }

  const queryCands = queryCandidates(specKey, topicOnly || topicKeyToUse);
  if (!queryCands.length) {
    return {
      topicKey: topicKeyToUse,
      topic: findTopicByKey(topicKeyToUse)?.topic ?? null,
      requested,
      added: 0,
      addedIds: [],
    };
  }

  const existingRefs = Array.isArray(lesson.examQuestions) ? lesson.examQuestions : [];
  const existingIds = new Set(existingRefs.map((r) => String(r.questionId)));

  const ownershipFilter = {
    $or: [
      { teacherId: lesson.teacherId },
      ...(lesson.organisationId ? [{ scope: "organisation", organisationId: lesson.organisationId }] : []),
      { scope: "platform" },
    ],
  };
  const candidates = await ExamQuestion.find({
    topicKey: { $in: queryCands },
    ...ownershipFilter,
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
    topic: findTopicByKey(topicKeyToUse)?.topic ?? null,
    requested,
    added: toAdd.length,
    addedIds: toAdd,
  };
}

module.exports = { attachExamQuestionsByTopic };
