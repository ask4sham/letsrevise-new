#!/usr/bin/env node
/**
 * Content Graph — live-data verification helper.
 * Usage: node backend/scripts/verifyContentGraphSample.js <specKey> [topicKey1 topicKey2 ...]
 * Up to 5 topicKeys; defaults to cell-structure if none given (for aqa-gcse-biology).
 * Output: topic node, linked lessons/flashcards/exam questions, open issues, coverage.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const contentGraphService = require("../services/contentGraphService");
const contentCoverageService = require("../services/contentCoverageService");
const Lesson = require("../models/Lesson");
const TopicFlashcard = require("../models/TopicFlashcard");
const ExamQuestion = require("../models/ExamQuestion");
const LessonIssueReport = require("../models/LessonIssueReport");

const MAX_TOPICS = 5;

function truncate(s, len = 60) {
  if (!s || typeof s !== "string") return "";
  return s.length <= len ? s : s.slice(0, len) + "...";
}

async function verifyTopic(specKey, topicKey) {
  const topicOnly = (topicKey || "").split(":").pop() || topicKey;
  const topicNode = await contentGraphService.resolveTopicNode(specKey, topicOnly);
  if (!topicNode) {
    return { topicKey: topicKey || topicOnly, resolved: false, error: "Topic not found in taxonomy" };
  }

  const graph = await contentGraphService.getTopicGraph(specKey, topicOnly);
  const coverage = await contentCoverageService.getTopicCoverage(specKey, topicOnly);

  const lessonIds = (graph?.linkedNodes || [])
    .filter((n) => n.nodeType === "lesson" && n.lessonId)
    .map((n) => n.lessonId);
  const flashcardIds = (graph?.linkedNodes || [])
    .filter((n) => n.nodeType === "flashcard" && n.flashcardId)
    .map((n) => n.flashcardId);
  const examIds = (graph?.linkedNodes || [])
    .filter((n) => n.nodeType === "examQuestion" && n.examQuestionId)
    .map((n) => n.examQuestionId);

  const lessons = lessonIds.length ? await Lesson.find({ _id: { $in: lessonIds } }).select("title _id").lean() : [];
  const flashcards = flashcardIds.length ? await TopicFlashcard.find({ _id: { $in: flashcardIds } }).select("front _id").lean() : [];
  const examQuestions = examIds.length ? await ExamQuestion.find({ _id: { $in: examIds } }).select("question _id").lean() : [];

  let openIssueCount = 0;
  if (lessonIds.length) {
    openIssueCount = await LessonIssueReport.countDocuments({
      lessonId: { $in: lessonIds },
      status: "open",
    });
  }

  return {
    topicKey: topicKey || topicOnly,
    resolved: true,
    topicNodeId: topicNode._id,
    lessonCount: lessons.length,
    lessons: lessons.map((l) => ({ id: l._id, title: truncate(l.title) })),
    flashcardCount: flashcards.length,
    flashcards: flashcards.slice(0, 5).map((f) => ({ id: f._id, front: truncate(f.front, 40) })),
    examQuestionCount: examQuestions.length,
    examQuestions: examQuestions.slice(0, 3).map((e) => ({ id: e._id, question: truncate(e.question, 50) })),
    openIssueCount,
    coverage: coverage ? { score: coverage.coverageScore, status: coverage.status } : null,
  };
}

async function run() {
  const args = process.argv.slice(2);
  const specKey = args[0] || "aqa-gcse-biology";
  const topicKeys = args.slice(1, 1 + MAX_TOPICS);
  const topicsToVerify = topicKeys.length ? topicKeys : ["cell-structure"];

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017/letsrevise");

  console.log(`\n=== Content Graph Verification: ${specKey} ===\n`);

  for (const topicKey of topicsToVerify) {
    const result = await verifyTopic(specKey, topicKey);
    console.log(`--- ${result.topicKey} ---`);
    if (!result.resolved) {
      console.log(`  Error: ${result.error}\n`);
      continue;
    }
    console.log(`  Topic node: ${result.topicNodeId}`);
    console.log(`  Lessons: ${result.lessonCount}`);
    result.lessons?.forEach((l) => console.log(`    - ${l.id} | ${l.title}`));
    console.log(`  Flashcards: ${result.flashcardCount}`);
    result.flashcards?.forEach((f) => console.log(`    - ${f.id} | ${f.front}`));
    console.log(`  Exam questions: ${result.examQuestionCount}`);
    result.examQuestions?.forEach((e) => console.log(`    - ${e.id} | ${e.question}`));
    console.log(`  Open issues: ${result.openIssueCount}`);
    console.log(`  Coverage: score=${result.coverage?.score ?? "?"} status=${result.coverage?.status ?? "?"}`);
    console.log("");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
