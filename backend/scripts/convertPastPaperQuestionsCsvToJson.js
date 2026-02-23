#!/usr/bin/env node
/**
 * PR-BULK-INGEST-4: Convert past paper questions CSV to JSON for POST /api/admin/bulk-import/past-paper-questions.
 * Uses csv-parse/sync for safe handling of commas inside quoted fields (e.g. markScheme).
 * Required: pastPaperId, topicKey, question. Optional: questionNumber, marks, markScheme.
 */
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

function main() {
  const [, , specKey, csvPath] = process.argv;
  if (!specKey || !csvPath) {
    console.error(
      "Usage: node scripts/convertPastPaperQuestionsCsvToJson.js <specKey> <path/to/past_paper_questions.csv>"
    );
    process.exit(1);
  }

  const abs = path.resolve(process.cwd(), csvPath);
  let raw;
  try {
    raw = fs.readFileSync(abs, "utf8").trim();
  } catch (e) {
    if (e.code === "ENOENT") {
      console.error(`File not found: ${abs}`);
      console.error("Example: npm run convert:past-paper-questions-csv -- aqa-gcse-biology ./imports/past_paper_questions.csv");
    } else throw e;
    process.exit(1);
  }

  let records;
  try {
    records = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      trim: true,
    });
  } catch (e) {
    console.error("CSV parse error:", e.message);
    process.exit(1);
  }

  if (!records.length) {
    console.error("CSV must include a header row and at least one data row.");
    process.exit(1);
  }

  const first = records[0];
  const required = ["pastPaperId", "topicKey", "question"];
  for (const r of required) {
    if (!(r in first)) {
      console.error(`Missing required column: ${r}`);
      process.exit(1);
    }
  }

  const items = records.map((row) => {
    const marksVal = row.marks != null && String(row.marks).trim() !== "" ? Number(row.marks) : null;
    return {
      pastPaperId: String(row.pastPaperId ?? "").trim(),
      topicKey: String(row.topicKey ?? "").trim(),
      questionNumber: row.questionNumber != null && String(row.questionNumber).trim() !== "" ? String(row.questionNumber).trim() : null,
      marks: marksVal != null && !Number.isNaN(marksVal) ? marksVal : null,
      question: String(row.question ?? "").trim(),
      markScheme: row.markScheme != null ? String(row.markScheme).trim() : "",
    };
  });

  console.log(JSON.stringify({ specKey, dryRun: true, items }, null, 2));
}

main();
