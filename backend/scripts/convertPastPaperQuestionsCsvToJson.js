#!/usr/bin/env node
/**
 * PR-BULK-INGEST-4: Convert past paper questions CSV to JSON for POST /api/admin/bulk-import/past-paper-questions.
 * Required: pastPaperId, topicKey, question. Optional: questionNumber, marks, markScheme.
 */
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

function parseCsvLine(line) {
  return line.split(",").map((s) => {
    let cell = s.trim();
    if (cell.length >= 2 && cell.startsWith('"') && cell.endsWith('"')) {
      cell = cell.slice(1, -1).replace(/""/g, '"');
    }
    return cell;
  });
}

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
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    console.error("CSV must include a header row and at least one data row.");
    process.exit(1);
  }

  const headers = parseCsvLine(lines[0]);
  const idx = (name) => headers.indexOf(name);

  const required = ["pastPaperId", "topicKey", "question"];
  for (const r of required) {
    if (idx(r) === -1) {
      console.error(`Missing required column: ${r}`);
      process.exit(1);
    }
  }

  const items = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);

    items.push({
      pastPaperId: cols[idx("pastPaperId")],
      topicKey: cols[idx("topicKey")],
      questionNumber: idx("questionNumber") !== -1 ? (cols[idx("questionNumber")] || null) : null,
      marks: idx("marks") !== -1 && cols[idx("marks")] ? Number(cols[idx("marks")]) : null,
      question: cols[idx("question")],
      markScheme: idx("markScheme") !== -1 ? (cols[idx("markScheme")] || "") : "",
    });
  }

  console.log(JSON.stringify({ specKey, dryRun: true, items }, null, 2));
}

main();
