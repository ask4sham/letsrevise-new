#!/usr/bin/env node
/**
 * PR-BULK-INGEST-2: Convert exam-question CSV to JSON payload for POST /api/admin/bulk-import/exam-questions.
 *
 * Expected CSV columns: topicKey, question, answer, marks, source, year
 * (answer can be empty if using markScheme elsewhere; marks/source/year optional)
 *
 * Usage:
 *   node backend/scripts/convertExamCsvToJson.js < path/to/questions.csv
 *   node backend/scripts/convertExamCsvToJson.js path/to/questions.csv
 *
 * Output: JSON to stdout, ready to paste into body or use with curl:
 *   {"specKey":"aqa-gcse-biology","dryRun":true,"items":[...]}
 *
 * Set SPEC_KEY env or pass as first arg (after script name) to override default aqa-gcse-biology.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_SPEC_KEY = process.env.SPEC_KEY || "aqa-gcse-biology";

function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && (c === "," || c === "\t")) {
      out.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  out.push(current.trim());
  return out;
}

function csvToItems(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], items: [] };

  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine).map((h) => h.replace(/^\s*|\s*$/g, "").toLowerCase());
  const topicKeyIdx = headers.indexOf("topickey");
  const questionIdx = headers.indexOf("question");
  const answerIdx = headers.indexOf("answer");
  const marksIdx = headers.indexOf("marks");
  const sourceIdx = headers.indexOf("source");
  const yearIdx = headers.indexOf("year");

  if (topicKeyIdx === -1 || questionIdx === -1) {
    throw new Error("CSV must have at least 'topicKey' and 'question' columns");
  }

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const topicKey = values[topicKeyIdx] != null ? String(values[topicKeyIdx]).trim() : "";
    const question = values[questionIdx] != null ? String(values[questionIdx]).trim() : "";
    if (!topicKey || !question) continue;

    const item = {
      topicKey,
      question,
    };
    if (answerIdx !== -1 && values[answerIdx] != null && String(values[answerIdx]).trim() !== "") {
      item.answer = String(values[answerIdx]).trim();
    }
    if (marksIdx !== -1 && values[marksIdx] != null && values[marksIdx] !== "") {
      const m = Number(values[marksIdx]);
      if (Number.isFinite(m)) item.marks = m;
    }
    if (sourceIdx !== -1 && values[sourceIdx] != null && String(values[sourceIdx]).trim() !== "") {
      item.source = String(values[sourceIdx]).trim();
    }
    if (yearIdx !== -1 && values[yearIdx] != null && String(values[yearIdx]).trim() !== "") {
      item.year = String(values[yearIdx]).trim();
    }
    items.push(item);
  }

  return { headers, items };
}

function main() {
  let specKey = DEFAULT_SPEC_KEY;
  let csvText;

  const arg = process.argv[2];
  if (arg) {
    const p = path.isAbsolute(arg) ? arg : path.join(process.cwd(), arg);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      csvText = fs.readFileSync(p, "utf8");
    } else {
      specKey = arg;
      csvText = fs.readFileSync(0, "utf8");
    }
  } else {
    csvText = fs.readFileSync(0, "utf8");
  }

  const { items } = csvToItems(csvText);
  const payload = {
    specKey,
    dryRun: true,
    items,
  };
  console.log(JSON.stringify(payload, null, 2));
}

main();
