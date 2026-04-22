/**
 * Question Bank Audit Service — single source of truth for coverage + sprint order.
 * Used by: GET /api/audit/question-bank (Content Coverage page) and docs generation scripts.
 * Platform-wide counts (no owner filter). No external calls (no OpenAI).
 */
const { queryCandidates } = require("../utils/topicKey");
const { isTopicGroup } = require("../utils/topicTaxonomy");
const { getMergedTaxonomyBySpecKey } = require("./adminTaxonomyService");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const TopicFlashcard = require("../models/TopicFlashcard");
const ExamQuestion = require("../models/ExamQuestion");
const PastPaperQuestion = require("../models/PastPaperQuestion");

const OK_MIN_MCQ = 10;
const OK_MIN_SHORT = 5;
const OK_MIN_FLASHCARDS = 5;
const DOD_MIN_MCQ = 10;
const DOD_MIN_SHORT = 5;
const DOD_MIN_MISCONCEPTION = 1;

async function aggregateCountsByTopicKey(Model, candidateKeys, extraMatch = {}) {
  const validKeys = candidateKeys.filter((k) => typeof k === "string" && k !== "");
  const match = {
    $and: [
      { topicKey: { $in: validKeys } },
      { topicKey: { $exists: true } },
      { topicKey: { $nin: [null, ""] } },
    ],
    isArchived: { $ne: true },
    ...extraMatch,
  };
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: "$topicKey", count: { $sum: 1 } } },
  ]);
  const map = new Map();
  for (const r of rows) map.set(r._id, r.count);
  return map;
}

function sumFrom(map, candidateKeys) {
  return candidateKeys.reduce((acc, k) => acc + (map.get(k) || 0), 0);
}

/**
 * Run question bank audit for a spec. Caller must have mongoose connected.
 * @param {{ specKey: string }} options
 * @returns {Promise<{ specKey: string, rows: Array, summary: { emptyCount: number, gapCount: number, okCount: number } }>}
 */
async function runQuestionBankAudit({ specKey }) {
  if (!specKey || typeof specKey !== "string") {
    throw new Error("specKey is required");
  }

  const taxonomy = await getMergedTaxonomyBySpecKey(specKey);
  if (!taxonomy || !Array.isArray(taxonomy.units)) {
    throw new Error(`Taxonomy not found for specKey: ${specKey}`);
  }

  const subject = taxonomy.subject || "Unknown";
  const allTopics = [];
  for (const unit of taxonomy.units) {
    for (const t of unit.topics || []) {
      if (isTopicGroup(t)) continue;
      allTopics.push({
        subject,
        mainTopicTitle: unit.unit,
        subTopicTitle: t.topic,
        topicSlug: t.key,
        topicKey: t.key,
        topicIndex: allTopics.length,
      });
    }
  }

  const candidateKeysAll = Array.from(
    new Set(allTopics.flatMap((row) => queryCandidates(specKey, row.topicKey)))
  );

  const [
    quizMcqMap,
    quizShortMap,
    quizRecallMap,
    quizApplicationMap,
    quizMisconceptionMap,
    flashMap,
    examMap,
    pastPaperMap,
  ] = await Promise.all([
    aggregateCountsByTopicKey(TopicQuizQuestion, candidateKeysAll, {
      type: "mcq",
      status: { $in: ["draft", "published"] },
    }),
    aggregateCountsByTopicKey(TopicQuizQuestion, candidateKeysAll, {
      type: "short-answer",
      status: { $in: ["draft", "published"] },
    }),
    aggregateCountsByTopicKey(TopicQuizQuestion, candidateKeysAll, {
      skill: "recall",
      status: { $in: ["draft", "published"] },
    }),
    aggregateCountsByTopicKey(TopicQuizQuestion, candidateKeysAll, {
      skill: "application",
      status: { $in: ["draft", "published"] },
    }),
    TopicQuizQuestion.aggregate([
      {
        $match: {
          $and: [
            { topicKey: { $in: candidateKeysAll.filter((k) => typeof k === "string" && k !== "") } },
            { topicKey: { $exists: true } },
            { topicKey: { $nin: [null, ""] } },
          ],
          isArchived: { $ne: true },
          status: { $in: ["draft", "published"] },
        },
      },
      { $project: { topicKey: 1, tags: 1 } },
      { $unwind: { path: "$tags", preserveNullAndEmptyArrays: true } },
      { $match: { $or: [{ tags: /misconception/i }, { tags: /distractor/i }] } },
      { $group: { _id: "$topicKey", count: { $sum: 1 } } },
    ]).then((rows) => {
      const m = new Map();
      for (const r of rows) m.set(r._id, r.count);
      return m;
    }),
    aggregateCountsByTopicKey(TopicFlashcard, candidateKeysAll, {
      status: { $in: ["draft", "published"] },
    }),
    aggregateCountsByTopicKey(ExamQuestion, candidateKeysAll, {
      status: { $in: ["draft", "published"] },
      ...(taxonomy.subject && { subject: taxonomy.subject }),
    }),
    aggregateCountsByTopicKey(PastPaperQuestion, candidateKeysAll, {
      specKey,
    }),
  ]);

  const rows = [];
  for (const row of allTopics) {
    const candidates = queryCandidates(specKey, row.topicKey);
    const mcq = sumFrom(quizMcqMap, candidates);
    const short = sumFrom(quizShortMap, candidates);
    const recall = sumFrom(quizRecallMap, candidates);
    const application = sumFrom(quizApplicationMap, candidates);
    const flashcards = sumFrom(flashMap, candidates);
    const examQuestions = examMap.get(row.topicKey) || 0;
    const pastPaperQuestions = pastPaperMap.get(row.topicKey) || 0;
    const misconceptionTag = sumFrom(quizMisconceptionMap, candidates);

    const totalQuiz = mcq + short;
    let status;
    if (
      mcq === 0 &&
      short === 0 &&
      flashcards === 0 &&
      examQuestions === 0 &&
      pastPaperQuestions === 0
    ) {
      status = "EMPTY";
    } else if (
      mcq >= OK_MIN_MCQ &&
      short >= OK_MIN_SHORT &&
      flashcards >= OK_MIN_FLASHCARDS
    ) {
      status = "OK";
    } else {
      status = "GAP";
    }

    const dod =
      mcq >= DOD_MIN_MCQ &&
      short >= DOD_MIN_SHORT &&
      misconceptionTag >= DOD_MIN_MISCONCEPTION
        ? "DONE"
        : "INCOMPLETE";

    rows.push({
      subject,
      mainTopicTitle: row.mainTopicTitle,
      subTopicTitle: row.subTopicTitle,
      topicSlug: row.topicSlug,
      topicKey: row.topicKey,
      topicIndex: row.topicIndex,
      counts: {
        mcq,
        short,
        flashcards,
        examQuestions,
        pastPaperQuestions,
      },
      recall,
      application,
      misconceptionTag,
      status,
      dod,
    });
  }

  const emptyCount = rows.filter((r) => r.status === "EMPTY").length;
  const gapCount = rows.filter((r) => r.status === "GAP").length;
  const okCount = rows.filter((r) => r.status === "OK").length;

  const examCounts = rows.map((r) => r.counts.examQuestions);
  if (examCounts.length) {
    console.log(
      "[coverage] examQs min/max",
      Math.min(...examCounts),
      Math.max(...examCounts)
    );
  }

  function rowTotal(r) {
    const c = r.counts || {};
    return (
      (c.flashcards || 0) +
      (c.mcq || 0) +
      (c.short || 0) +
      (c.examQuestions || 0) +
      (c.pastPaperQuestions || 0)
    );
  }
  const zeroRows = rows.filter((r) => rowTotal(r) === 0);
  console.log("[coverage] rows", rows.length, "zeroRows", zeroRows.length);
  console.log(
    "[coverage] sample zero topicKeys",
    zeroRows.slice(0, 15).map((r) => r.topicKey)
  );

  return {
    specKey,
    rows,
    summary: { emptyCount, gapCount, okCount },
  };
}

module.exports = { runQuestionBankAudit };
