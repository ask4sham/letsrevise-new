#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Create CONTENT_SPRINT_TRACKER.csv from TAXONOMY_TOPIC_LIST.csv.
 * Copies all rows (same order) and appends tracker columns with defaults.
 *
 * Run: cd backend && npm run create:content-sprint-tracker
 */
const fs = require("fs");
const path = require("path");

const DOCS_DIR = path.join(__dirname, "..", "..", "docs");
const INPUT_PATH = path.join(DOCS_DIR, "TAXONOMY_TOPIC_LIST.csv");
const OUTPUT_PATH = path.join(DOCS_DIR, "CONTENT_SPRINT_TRACKER.csv");

const TRACKER_COLUMNS = [
  "mcq_target",
  "mcq_done",
  "short_target",
  "short_done",
  "flashcard_target",
  "flashcard_done",
  "examq_target",
  "examq_done",
  "status",
  "owner",
  "notes",
  "last_updated",
];

const DEFAULTS = {
  mcq_target: "10",
  mcq_done: "0",
  short_target: "5",
  short_done: "0",
  flashcard_target: "10",
  flashcard_done: "0",
  examq_target: "2",
  examq_done: "0",
  status: "NOT_STARTED",
  owner: "",
  notes: "",
  last_updated: "",
};

/** Parse a single CSV line respecting quoted fields ("" = escaped quote). */
function parseCsvLine(line) {
  const out = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let cell = "";
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            cell += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          cell += line[i];
          i++;
        }
      }
      out.push(cell);
    } else {
      let cell = "";
      while (i < line.length && line[i] !== ",") {
        cell += line[i];
        i++;
      }
      out.push(cell);
      if (line[i] === ",") i++;
    }
  }
  return out;
}

/** Parse CSV string to array of row objects; first row is header. */
function parseCsvToRecords(raw) {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]);
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const row = {};
    header.forEach((h, j) => {
      row[h] = cells[j] !== undefined ? cells[j] : "";
    });
    records.push(row);
  }
  return records;
}

function escapeCsvCell(s) {
  const str = String(s ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`Input not found: ${INPUT_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(INPUT_PATH, "utf8");
  const records = parseCsvToRecords(raw);

  const baseColumns =
    records.length > 0
      ? Object.keys(records[0])
      : ["subject", "specKey", "mainTopicTitle", "leafTopicTitle", "topicSlug", "topicKey", "pathTitles"];
  const header = [...baseColumns, ...TRACKER_COLUMNS];

  const rows = records.map((row) => {
    const out = { ...row };
    for (const col of TRACKER_COLUMNS) {
      out[col] = DEFAULTS[col];
    }
    return out;
  });

  const lines = [
    header.join(","),
    ...rows.map((r) => header.map((h) => escapeCsvCell(r[h])).join(",")),
  ];
  const outCsv = lines.join("\n");

  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_PATH, outCsv, "utf8");
  console.log(`Wrote ${OUTPUT_PATH} (${rows.length} rows, ${header.length} columns)`);
}

main();
