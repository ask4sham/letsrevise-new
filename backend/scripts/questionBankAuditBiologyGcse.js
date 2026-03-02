/**
 * Question Bank Audit — Biology GCSE AQA.
 * Aggregates TopicQuizQuestion, TopicFlashcard, ExamQuestion per sub-topic,
 * computes Status (EMPTY/GAP/OK) and DoD (INCOMPLETE/DONE), outputs audit + sprint order.
 *
 * Usage: node scripts/questionBankAuditBiologyGcse.js
 * Writes: docs/QUESTION_BANK_AUDIT_BIOLOGY_GCSE.md, docs/SPRINT_ORDER_BIOLOGY_GCSE.md
 */
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const { queryCandidates } = require("../utils/topicKey");
const { getTaxonomyBySpecKey } = require("../utils/topicTaxonomy");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const TopicFlashcard = require("../models/TopicFlashcard");
const ExamQuestion = require("../models/ExamQuestion");

const SPEC_KEY = "aqa-gcse-biology";
const SUBJECT = "Biology";
const MAIN_TOPIC_LABEL = "Main topic";
const SUB_TOPIC_LABEL = "Sub-topic";

// Status thresholds (quiz bank only: TopicQuizQuestion + TopicFlashcard)
const OK_MIN_MCQ = 10;
const OK_MIN_SHORT = 5;
const OK_MIN_FLASHCARDS = 5;
// DoD thresholds
const DOD_MIN_MCQ = 10;
const DOD_MIN_SHORT = 5;
const DOD_MIN_MISCONCEPTION = 1;

async function aggregateCountsByTopicKey(Model, candidateKeys, extraMatch = {}) {
  const match = {
    topicKey: { $in: candidateKeys },
    isArchived: { $ne: true },
    ...extraMatch,
  };
  const pipeline = [
    { $match: match },
    { $group: { _id: "$topicKey", count: { $sum: 1 } } },
  ];
  const rows = await Model.aggregate(pipeline);
  const map = new Map();
  for (const r of rows) map.set(r._id, r.count);
  return map;
}

/** Sum counts across candidate keys (namespaced + legacy) for one topic. */
function sumFrom(map, candidateKeys) {
  return candidateKeys.reduce((acc, k) => acc + (map.get(k) || 0), 0);
}

async function run() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) throw new Error("MONGO_URI not set");

  const taxonomy = getTaxonomyBySpecKey(SPEC_KEY);
  if (!taxonomy || !Array.isArray(taxonomy.units)) throw new Error("Biology taxonomy not found");

  await mongoose.connect(MONGO_URI);

  const allTopics = [];
  for (const unit of taxonomy.units) {
    for (const t of unit.topics || []) {
      allTopics.push({
        mainTopic: unit.unit,
        subTopic: t.topic,
        topicKey: t.key,
        topicIndex: allTopics.length,
      });
    }
  }

  const candidateKeysAll = Array.from(
    new Set(allTopics.flatMap((row) => queryCandidates(SPEC_KEY, row.topicKey)))
  );

  // Aggregations: quiz by type; quiz by skill; quiz misconception (tags); flashcards; exam
  const [
    quizMcqMap,
    quizShortMap,
    quizRecallMap,
    quizApplicationMap,
    quizMisconceptionMap,
    flashMap,
    examMap,
  ] = await Promise.all([
    aggregateCountsByTopicKey(TopicQuizQuestion, candidateKeysAll, { type: "mcq", status: { $in: ["draft", "published"] } }),
    aggregateCountsByTopicKey(TopicQuizQuestion, candidateKeysAll, { type: "short-answer", status: { $in: ["draft", "published"] } }),
    aggregateCountsByTopicKey(TopicQuizQuestion, candidateKeysAll, { skill: "recall", status: { $in: ["draft", "published"] } }),
    aggregateCountsByTopicKey(TopicQuizQuestion, candidateKeysAll, { skill: "application", status: { $in: ["draft", "published"] } }),
    TopicQuizQuestion.aggregate([
      { $match: { topicKey: { $in: candidateKeysAll }, isArchived: { $ne: true }, status: { $in: ["draft", "published"] } } },
      { $project: { topicKey: 1, tags: 1 } },
      { $unwind: { path: "$tags", preserveNullAndEmptyArrays: true } },
      { $match: { $or: [{ tags: /misconception/i }, { tags: /distractor/i }] } },
      { $group: { _id: "$topicKey", count: { $sum: 1 } } },
    ]).then((rows) => {
      const m = new Map();
      for (const r of rows) m.set(r._id, r.count);
      return m;
    }),
    aggregateCountsByTopicKey(TopicFlashcard, candidateKeysAll, { status: { $in: ["draft", "published"] } }),
    aggregateCountsByTopicKey(ExamQuestion, candidateKeysAll, { status: { $in: ["draft", "published"] } }),
  ]);

  // Build one row per sub-topic (collapse namespaced keys to canonical)
  const byCanonical = new Map();
  for (const row of allTopics) {
    const candidates = queryCandidates(SPEC_KEY, row.topicKey);
    const mcq = sumFrom(quizMcqMap, candidates);
    const short = sumFrom(quizShortMap, candidates);
    const flashcards = sumFrom(flashMap, candidates);
    const examQ = sumFrom(examMap, candidates);
    const recall = sumFrom(quizRecallMap, candidates);
    const application = sumFrom(quizApplicationMap, candidates);
    const misconceptionTag = sumFrom(quizMisconceptionMap, candidates);

    const totalQuiz = mcq + short;
    let status;
    if (totalQuiz === 0 && flashcards === 0) status = "EMPTY";
    else if (mcq >= OK_MIN_MCQ && short >= OK_MIN_SHORT && flashcards >= OK_MIN_FLASHCARDS) status = "OK";
    else status = "GAP";

    const dodMet =
      mcq >= DOD_MIN_MCQ &&
      short >= DOD_MIN_SHORT &&
      misconceptionTag >= DOD_MIN_MISCONCEPTION;
    const dod = dodMet ? "DONE" : "INCOMPLETE";

    byCanonical.set(row.topicKey, {
      subject: SUBJECT,
      mainTopic: row.mainTopic,
      subTopic: row.subTopic,
      topicKey: row.topicKey,
      topicIndex: row.topicIndex,
      mcq,
      short,
      flashcards,
      examQuestions: examQ,
      recall,
      application,
      misconceptionTag,
      status,
      dod,
    });
  }

  const rows = Array.from(byCanonical.values()).sort((a, b) => a.topicIndex - b.topicIndex);

  // Sprint order: EMPTY first, then GAP, then OK; within group by syllabus order (topicIndex)
  const statusOrder = { EMPTY: 0, GAP: 1, OK: 2 };
  const sprintOrder = [...rows].sort((a, b) => {
    const sa = statusOrder[a.status] ?? 2;
    const sb = statusOrder[b.status] ?? 2;
    if (sa !== sb) return sa - sb;
    return a.topicIndex - b.topicIndex;
  });

  const docsDir = path.resolve(__dirname, "..", "..", "docs");
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  writeAuditMd(path.join(docsDir, "QUESTION_BANK_AUDIT_BIOLOGY_GCSE.md"), rows);
  writeSprintOrderMd(path.join(docsDir, "SPRINT_ORDER_BIOLOGY_GCSE.md"), sprintOrder, rows);

  await mongoose.disconnect();
  return { rows, sprintOrder };
}

function writeAuditMd(filePath, rows) {
  const lines = [
    "# Question Bank Audit — Biology GCSE AQA",
    "",
    "Generated by `backend/scripts/questionBankAuditBiologyGcse.js`. Re-run the script to refresh.",
    "",
    "## Scope",
    "- **Subject:** Biology  \n- **Level:** GCSE  \n- **Exam board:** AQA",
    "- **Collections:** TopicQuizQuestion, TopicFlashcard, ExamQuestion (platform-wide counts)",
    "",
    "## Status rules",
    "- **OK** = usable starter bank (≥10 MCQs, ≥5 short-answer, ≥5 flashcards)",
    "- **GAP** = partially usable; needs topping up",
    "- **EMPTY** = no questions or flashcards; must be built",
    "",
    "## Definition of Done (DoD)",
    "Sub-topic is **DONE** when: ≥10 MCQs, ≥5 short-answer, and ≥1 question tagged for misconception/distractor.",
    "Spec coverage is not auto-checked; verify manually.",
    "",
    "---",
    "",
    "| Subject | Main topic | Sub-topic | MCQ | Short | Flashcards | Exam Qs | Recall | Application | Misconception tag | Status | DoD |",
    "|---------|------------|-----------|-----|-------|------------|--------|--------|--------------|-------------------|--------|-----|",
  ];

  for (const r of rows) {
    lines.push(
      `| ${r.subject} | ${r.mainTopic} | ${r.subTopic} | ${r.mcq} | ${r.short} | ${r.flashcards} | ${r.examQuestions} | ${r.recall} | ${r.application} | ${r.misconceptionTag} | ${r.status} | ${r.dod} |`
    );
  }

  const emptyCount = rows.filter((r) => r.status === "EMPTY").length;
  const gapCount = rows.filter((r) => r.status === "GAP").length;
  const okCount = rows.filter((r) => r.status === "OK").length;
  const doneCount = rows.filter((r) => r.dod === "DONE").length;

  lines.push("");
  lines.push("## Summary");
  lines.push(`- **EMPTY:** ${emptyCount}  \n- **GAP:** ${gapCount}  \n- **OK:** ${okCount}  \n- **DoD DONE:** ${doneCount}  \n- **Total sub-topics:** ${rows.length}`);
  lines.push("");

  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  console.log("Wrote", filePath);
}

function writeSprintOrderMd(filePath, sprintOrder, rows) {
  const lines = [
    "# Sprint Order — Biology GCSE AQA",
    "",
    "Generated by `backend/scripts/questionBankAuditBiologyGcse.js`. Build question banks in this order.",
    "",
    "## Priority",
    "1. **EMPTY** sub-topics first",
    "2. Then **GAP**",
    "3. Then **OK** (top-up only if needed)",
    "Within each group, syllabus order (Cell Biology → Organisation → …).",
    "",
    "---",
    "",
    "| # | Subject | Main topic | Sub-topic | Status | DoD |",
    "|---|---------|------------|-----------|--------|-----|",
  ];

  sprintOrder.forEach((r, i) => {
    lines.push(`| ${i + 1} | ${r.subject} | ${r.mainTopic} | ${r.subTopic} | ${r.status} | ${r.dod} |`);
  });

  const emptyCount = rows.filter((r) => r.status === "EMPTY").length;
  const gapCount = rows.filter((r) => r.status === "GAP").length;

  lines.push("");
  lines.push("## Sprint focus");
  lines.push("Complete **EMPTY** and **GAP** sub-topics first.");
  lines.push(`- **EMPTY to build:** ${emptyCount}`);
  lines.push(`- **GAP to top up:** ${gapCount}`);
  lines.push("");
  lines.push("Do not start lessons until **Stage 1 (Core recall)** question banks are DONE for the topic (see Sprint Plan DoD).");
  lines.push("");
  lines.push("## What to ignore for now");
  lines.push("- Sub-topics already **OK** unless you are refining quality.");
  lines.push("- Creating new lessons before question banks meet the Definition of Done.");
  lines.push("");
  lines.push("## Good enough");
  lines.push("Sub-topics marked **OK** are usable as starter banks. Those marked **DoD DONE** meet the full Definition of Done and are safe for auto-attach and reuse.");
  lines.push("");

  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  console.log("Wrote", filePath);
}

if (require.main === module) {
  run()
    .then(() => {
      console.log("Question bank audit complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { run };
