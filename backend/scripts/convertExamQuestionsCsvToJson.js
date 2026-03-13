#!/usr/bin/env node
/**
 * PR-BULK-INGEST-2: Convert exam-question CSV into the exact JSON payload expected by
 * POST /api/admin/bulk-import/exam-questions.
 *
 * Required columns: topicKey, question, markScheme
 * Optional: marks, paper, year, source
 *
 * Usage:
 *   node scripts/convertExamQuestionsCsvToJson.js <specKey> <path/to/file.csv>
 *   npm run convert:exam-csv -- aqa-gcse-biology ./imports/exam_questions.csv > payload.json
 */
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

function parseCsvLine(line) {
  return line.split(",").map((s) => s.trim());
}

function main() {
  const [, , specKey, csvPath] = process.argv;

  if (!specKey || !csvPath) {
    console.error("Usage: node scripts/convertExamQuestionsCsvToJson.js <specKey> <path/to/file.csv>");
    process.exit(1);
  }

  const abs = path.resolve(csvPath);
  const raw = fs.readFileSync(abs, "utf8").trim();
  const lines = raw.split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) {
    console.error("CSV must include a header row and at least one data row.");
    process.exit(1);
  }

  const headers = parseCsvLine(lines[0]);
  const idx = (name) => headers.indexOf(name);

  const required = ["topicKey", "question", "markScheme"];
  for (const r of required) {
    if (idx(r) === -1) {
      console.error(`Missing required column: ${r}`);
      process.exit(1);
    }
  }

  const items = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);

    const item = {
      topicKey: cols[idx("topicKey")] || "",
      question: cols[idx("question")] || "",
      markScheme: cols[idx("markScheme")] || "",
    };

    if (idx("marks") !== -1) item.marks = cols[idx("marks")] ? Number(cols[idx("marks")]) : null;
    if (idx("paper") !== -1) item.paper = cols[idx("paper")] || null;
    if (idx("year") !== -1) item.year = cols[idx("year")] || null;
    if (idx("source") !== -1) item.source = cols[idx("source")] || "original";

    items.push(item);
  }

  const payload = { specKey, dryRun: true, items };
  console.log(JSON.stringify(payload, null, 2));
}

main();
