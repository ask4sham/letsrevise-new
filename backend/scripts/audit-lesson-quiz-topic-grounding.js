#!/usr/bin/env node
/**
 * Quiz Topic Grounding V1 — audit existing lesson.quiz.questions (read-only).
 *
 * Usage:
 *   node backend/scripts/audit-lesson-quiz-topic-grounding.js
 *   node backend/scripts/audit-lesson-quiz-topic-grounding.js --lesson=LESSON_ID
 *   node backend/scripts/audit-lesson-quiz-topic-grounding.js --json=out.json
 *
 * Env: MONGO_URI or MONGODB_URI
 */
if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
  require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
}

const fs = require("fs");
const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");
const { auditLessonQuizGrounding, GROUNDING_RESULT } = require("../utils/quizTopicGrounding");

function parseArgs(argv) {
  const out = { lessonId: null, limit: 200, json: null };
  for (const a of argv) {
    if (a.startsWith("--lesson=")) out.lessonId = a.split("=")[1].trim();
    else if (a.startsWith("--limit=")) out.limit = Number(a.split("=")[1]) || 200;
    else if (a.startsWith("--json=")) out.json = a.split("=")[1].trim();
  }
  return out;
}

async function main() {
  const { lessonId, limit, json } = parseArgs(process.argv.slice(2));
  const uri = (process.env.MONGODB_URI || process.env.MONGO_URI || "").trim();
  if (!uri) {
    console.error("MONGO_URI or MONGODB_URI required");
    process.exit(1);
  }

  await mongoose.connect(uri);

  const query = lessonId ? { _id: lessonId } : { "quiz.questions.0": { $exists: true } };
  const lessons = await Lesson.find(query)
    .select("title topic topicKey specKey quiz pages metadata")
    .limit(lessonId ? 1 : limit)
    .lean();

  const allRows = [];
  let crossTopicCount = 0;

  for (const lesson of lessons) {
    const rows = auditLessonQuizGrounding(lesson);
    for (const row of rows) {
      allRows.push(row);
      if (row.topicBoundaryResult === GROUNDING_RESULT.REJECT_CROSS_TOPIC) {
        crossTopicCount += 1;
        console.log("CROSS_TOPIC", JSON.stringify(row));
      }
    }
  }

  console.log("\n=== audit-lesson-quiz-topic-grounding ===");
  console.log("Lessons scanned:", lessons.length);
  console.log("Quiz questions audited:", allRows.length);
  console.log("Cross-topic flags:", crossTopicCount);

  if (json) {
    fs.writeFileSync(json, JSON.stringify(allRows, null, 2), "utf8");
    console.log("Wrote:", json);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
