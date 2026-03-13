#!/usr/bin/env node
/**
 * PR-BULK-INGEST-4: Convert past papers CSV to JSON for POST /api/admin/bulk-import/past-papers.
 * Uses csv-parse/sync for safe handling of commas inside quoted fields.
 * Required: examBoard, level, year, paperCode. Optional: series, tier, title, notes, pdfUrl, pdfMediaId.
 */
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

function main() {
  const [, , specKey, csvPath] = process.argv;
  if (!specKey || !csvPath) {
    console.error("Usage: node scripts/convertPastPapersCsvToJson.js <specKey> <path/to/past_papers.csv>");
    process.exit(1);
  }

  const abs = path.resolve(process.cwd(), csvPath);
  let raw;
  try {
    raw = fs.readFileSync(abs, "utf8").trim();
  } catch (e) {
    if (e.code === "ENOENT") {
      console.error(`File not found: ${abs}`);
      console.error("Example: npm run convert:past-papers-csv -- aqa-gcse-biology ./imports/past_papers.csv");
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
  const required = ["examBoard", "level", "year", "paperCode"];
  for (const r of required) {
    if (!(r in first)) {
      console.error(`Missing required column: ${r}`);
      process.exit(1);
    }
  }

  const items = records.map((row) => {
    const pdfMediaId = row.pdfMediaId != null && String(row.pdfMediaId).trim() !== "" ? String(row.pdfMediaId).trim() : null;
    const pdfUrl = row.pdfUrl != null && String(row.pdfUrl).trim() !== "" ? String(row.pdfUrl).trim() : null;
    return {
      examBoard: String(row.examBoard ?? "").trim(),
      level: String(row.level ?? "").trim(),
      year: String(row.year ?? "").trim(),
      paperCode: String(row.paperCode ?? "").trim(),
      series: row.series != null && String(row.series).trim() !== "" ? String(row.series).trim() : null,
      tier: row.tier != null && String(row.tier).trim() !== "" ? String(row.tier).trim() : null,
      title: row.title != null && String(row.title).trim() !== "" ? String(row.title).trim() : null,
      notes: row.notes != null && String(row.notes).trim() !== "" ? String(row.notes).trim() : null,
      pdf: {
        mediaId: pdfMediaId,
        url: pdfUrl,
        mimeType: "application/pdf",
      },
    };
  });

  console.log(JSON.stringify({ specKey, dryRun: true, items }, null, 2));
}

main();
