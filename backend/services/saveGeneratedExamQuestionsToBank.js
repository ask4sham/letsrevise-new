/**
 * Persist AI-generated exam questions to the Exam Question Bank with mark-scheme recovery.
 */
const ExamQuestion = require("../models/ExamQuestion");
const { examQuestionFingerprint } = require("../utils/examQuestionDedupe");
const { persistGeneratedExamQuestionBatch } = require("../utils/examQuestionGeneratedMarkSchemeRecovery");

/**
 * @param {{ items: object[], expectedCount?: number, teacherId: *, meta: object, topic: string, topicDisplay: string, normalizedSpec: string, generatedFrom: object, allowCorrectiveRetry?: boolean, regenerate?: Function }} opts
 */
async function saveGeneratedExamQuestionsToBank(opts) {
  const {
    items = [],
    expectedCount,
    teacherId,
    meta,
    topic,
    topicDisplay,
    normalizedSpec,
    generatedFrom,
    allowCorrectiveRetry = true,
    regenerate,
  } = opts;

  return persistGeneratedExamQuestionBatch({
    items,
    expectedCount,
    allowCorrectiveRetry,
    regenerate,
    persist: async (normalized) => {
      const { question, marks, markScheme, modelAnswer } = normalized;
      const msJoin = [...(markScheme || []), modelAnswer].filter(Boolean).join("\n");
      const fp = examQuestionFingerprint({
        specKey: normalizedSpec,
        topicKey: topic,
        question,
        markScheme: msJoin,
        marks,
      });
      const doc = new ExamQuestion({
        teacherId,
        subject: meta.subject,
        examBoard: meta.examBoard,
        level: meta.level,
        topic: topicDisplay,
        topicKey: topic,
        type: "short",
        marks,
        question,
        markScheme,
        correctAnswer: modelAnswer,
        status: "draft",
        fingerprint: fp,
        metadata: { ...generatedFrom, modelAnswer },
      });
      await doc.save();
      return doc._id;
    },
  });
}

module.exports = { saveGeneratedExamQuestionsToBank };
