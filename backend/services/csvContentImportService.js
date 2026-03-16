/**
 * Phase 1: Anki-style CSV import for TopicFlashcards and ExamQuestions.
 * Bulk upload only; no Anki sync, no spaced repetition.
 */
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { bulkImportFlashcards } = require("./bulkImportFlashcards");
const { bulkImportExamQuestions } = require("./bulkImportExamQuestions");
const { assertValidSpecKey, assertValidSpecTopic } = require("../utils/specTopicValidation");
const { buildTopicKey, parseTopicKey } = require("../utils/topicKey");

/** Parse specKey to subject/examBoard/level (e.g. aqa-gcse-biology → AQA, GCSE, Biology) */
function parseSpecToMeta(specKey) {
  const parts = (specKey || "").split("-").filter(Boolean);
  if (parts.length >= 3) {
    return {
      examBoard: (parts[0] || "AQA").toUpperCase(),
      level: (parts[1] || "GCSE").toUpperCase(),
      subject: (parts[2] || "Biology").charAt(0).toUpperCase() + (parts[2] || "").slice(1).toLowerCase(),
    };
  }
  return { examBoard: "AQA", level: "GCSE", subject: "Biology" };
}

/**
 * Parse CSV file to records.
 * @param {string} filePath - Absolute path to CSV file
 * @returns {{ records: Array<Record<string, string>>, parseError?: string }}
 */
function parseCsvFile(filePath) {
  const abs = path.resolve(filePath);
  let raw;
  try {
    raw = fs.readFileSync(abs, "utf8").trim();
  } catch (e) {
    return { records: [], parseError: e.code === "ENOENT" ? "File not found" : e.message };
  }

  try {
    const records = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      trim: true,
    });
    return { records };
  } catch (e) {
    return { records: [], parseError: e.message || "CSV parse failed" };
  }
}

/**
 * Validate flashcard row. Required: front, back. specKey/topicKey from row or defaults.
 * @param {Record<string, string>} row
 * @param {{ defaultSpecKey?: string, defaultTopicKey?: string }} opts
 * @returns {{ valid: boolean, error?: string, specKey?: string, topicKey?: string }}
 */
function validateFlashcardRow(row, opts = {}) {
  const { defaultSpecKey, defaultTopicKey } = opts;
  const front = row && typeof row.front === "string" ? String(row.front).trim() : "";
  const back = row && typeof row.back === "string" ? String(row.back).trim() : "";

  if (!front) return { valid: false, error: "front is required" };
  if (!back) return { valid: false, error: "back is required" };
  if (front.length > 500) return { valid: false, error: "front exceeds 500 characters" };
  if (back.length > 2000) return { valid: false, error: "back exceeds 2000 characters" };

  const specKey = (row.specKey && String(row.specKey).trim()) || defaultSpecKey;
  const topicKey = (row.topicKey && String(row.topicKey).trim()) || defaultTopicKey;

  if (!specKey) return { valid: false, error: "specKey is required (or provide defaultSpecKey)" };
  if (!topicKey) return { valid: false, error: "topicKey is required (or provide defaultTopicKey)" };

  try {
    assertValidSpecKey(specKey);
    assertValidSpecTopic({ specKey, topicKey: parseTopicKey(topicKey).topicKey || topicKey });
  } catch (e) {
    return { valid: false, error: e.message || "Invalid specKey or topicKey" };
  }

  return { valid: true, specKey, topicKey };
}

/**
 * Validate exam question row. Required: questionText, markScheme.
 * @param {Record<string, string>} row
 * @param {{ defaultSpecKey?: string, defaultTopicKey?: string }} opts
 * @returns {{ valid: boolean, error?: string, specKey?: string, topicKey?: string }}
 */
function validateExamQuestionRow(row, opts = {}) {
  const { defaultSpecKey, defaultTopicKey } = opts;
  const questionText = row && typeof row.questionText === "string" ? String(row.questionText).trim() : "";
  const markScheme = row && row.markScheme != null ? String(row.markScheme).trim() : "";

  if (!questionText) return { valid: false, error: "questionText is required" };
  if (markScheme === "" && (!row.questionText || String(row.questionText).trim() === "")) {
    return { valid: false, error: "markScheme is required" };
  }

  const specKey = (row.specKey && String(row.specKey).trim()) || defaultSpecKey;
  const topicKey = (row.topicKey && String(row.topicKey).trim()) || defaultTopicKey;

  if (!specKey) return { valid: false, error: "specKey is required (or provide defaultSpecKey)" };
  if (!topicKey) return { valid: false, error: "topicKey is required (or provide defaultTopicKey)" };

  try {
    assertValidSpecKey(specKey);
    const topicSlug = parseTopicKey(topicKey).topicKey || topicKey;
    assertValidSpecTopic({ specKey, topicKey: topicSlug });
  } catch (e) {
    return { valid: false, error: e.message || "Invalid specKey or topicKey" };
  }

  return { valid: true, specKey, topicKey };
}

/**
 * Convert markScheme CSV value to array (newline or pipe separated).
 */
function parseMarkScheme(value) {
  if (value == null || typeof value !== "string") return [];
  return value
    .split(/\r?\n|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Import flashcards from CSV file.
 * @param {{ filePath: string, dryRun?: boolean, defaultSpecKey?: string, defaultTopicKey?: string, importedByUserId?: string }}
 * @returns {Promise<{ dryRun: boolean, summary: object, errors: Array<{rowNumber, reason, row}>, sampleImported?: Array }>}
 */
async function importFlashcardsFromCsv({
  filePath,
  dryRun = false,
  defaultSpecKey,
  defaultTopicKey,
  importedByUserId,
}) {
  const result = {
    dryRun: !!dryRun,
    summary: {
      parsedRows: 0,
      validRows: 0,
      importedRows: 0,
      skippedRows: 0,
      duplicateRows: 0,
      invalidRows: 0,
    },
    errors: [],
    sampleImported: [],
  };

  const { records, parseError } = parseCsvFile(filePath);
  result.summary.parsedRows = records.length;

  if (parseError) {
    result.errors.push({ rowNumber: 0, reason: parseError, row: null });
    return result;
  }

  if (records.length === 0) {
    result.errors.push({ rowNumber: 0, reason: "CSV has no data rows", row: null });
    return result;
  }

  const items = [];
  const seenKeys = new Set();

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2;

    const validation = validateFlashcardRow(row, { defaultSpecKey, defaultTopicKey });

    if (!validation.valid) {
      result.summary.invalidRows++;
      result.errors.push({ rowNumber: rowNum, reason: validation.error, row });
      continue;
    }

    const front = String(row.front || "").trim();
    const back = String(row.back || "").trim();
    const topicSlug = parseTopicKey(validation.topicKey).topicKey || validation.topicKey;
    const namespacedTopicKey = buildTopicKey(validation.specKey, topicSlug);
    const dedupeKey = `${front}||${back}||${namespacedTopicKey}`;

    if (seenKeys.has(dedupeKey)) {
      result.summary.duplicateRows++;
      result.errors.push({ rowNumber: rowNum, reason: "Duplicate in file (front+back+topicKey)", row });
      continue;
    }
    seenKeys.add(dedupeKey);

    const imageUrl = row.imageUrl && String(row.imageUrl).trim() ? String(row.imageUrl).trim() : null;
    const assets = imageUrl ? [{ type: "image", url: imageUrl, alt: null }] : [];

    items.push({
      specKey: validation.specKey,
      topicKey: topicSlug,
      front,
      back,
      assets,
      tags: row.tags ? String(row.tags).split(",").map((t) => t.trim()).filter(Boolean) : undefined,
      difficulty: row.difficulty || undefined,
      status: row.status && ["draft", "published"].includes(String(row.status).toLowerCase()) ? String(row.status).toLowerCase() : "draft",
    });
    result.summary.validRows++;
  }

  if (items.length === 0) {
    return result;
  }

  const bySpec = new Map();
  for (const it of items) {
    const key = it.specKey;
    if (!bySpec.has(key)) bySpec.set(key, []);
    bySpec.get(key).push(it);
  }

  let totalImported = 0;
  let totalDuplicates = 0;
  let totalSkipped = 0;

  const importMeta = {
    importSource: "csv_import",
    importType: "anki_style",
    importedAt: new Date(),
    importedBy: importedByUserId,
  };

  for (const [specKey, specItems] of bySpec) {
    const bulkItems = specItems.map((it) => ({
      topicKey: it.topicKey,
      front: it.front,
      back: it.back,
      assets: it.assets,
    }));

    const report = await bulkImportFlashcards({
      specKey,
      items: bulkItems,
      dryRun,
      actorId: importedByUserId,
      importMetadata: importMeta,
    });

    totalImported += report.inserted ?? 0;
    totalDuplicates += report.skippedDuplicates ?? 0;
    totalSkipped += (report.invalid ?? 0);

    if (report.preview && report.preview.length > 0 && result.sampleImported.length < 10) {
      for (const p of report.preview) {
        if (p.action === "insert" || p.action === "would_insert") {
          result.sampleImported.push({
            front: specItems[p.index]?.front,
            back: specItems[p.index]?.back,
            topicKey: buildTopicKey(specKey, specItems[p.index]?.topicKey),
          });
          if (result.sampleImported.length >= 10) break;
        }
      }
    }
  }

  result.summary.importedRows = totalImported;
  result.summary.duplicateRows += totalDuplicates;
  result.summary.skippedRows += totalSkipped;

  return result;
}

/**
 * Import exam questions from CSV file.
 * @param {{ filePath: string, dryRun?: boolean, defaultSpecKey?: string, defaultTopicKey?: string, importedByUserId?: string }}
 * @returns {Promise<{ dryRun: boolean, summary: object, errors: Array<{rowNumber, reason, row}>, sampleImported?: Array }>}
 */
async function importExamQuestionsFromCsv({
  filePath,
  dryRun = false,
  defaultSpecKey,
  defaultTopicKey,
  importedByUserId,
}) {
  const result = {
    dryRun: !!dryRun,
    summary: {
      parsedRows: 0,
      validRows: 0,
      importedRows: 0,
      skippedRows: 0,
      duplicateRows: 0,
      invalidRows: 0,
    },
    errors: [],
    sampleImported: [],
  };

  const { records, parseError } = parseCsvFile(filePath);
  result.summary.parsedRows = records.length;

  if (parseError) {
    result.errors.push({ rowNumber: 0, reason: parseError, row: null });
    return result;
  }

  if (records.length === 0) {
    result.errors.push({ rowNumber: 0, reason: "CSV has no data rows", row: null });
    return result;
  }

  const items = [];
  const seenKeys = new Set();

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2;

    const validation = validateExamQuestionRow(row, { defaultSpecKey, defaultTopicKey });

    if (!validation.valid) {
      result.summary.invalidRows++;
      result.errors.push({ rowNumber: rowNum, reason: validation.error, row });
      continue;
    }

    const questionText = String(row.questionText || "").trim();
    const markScheme = parseMarkScheme(row.markScheme);
    const topicSlug = parseTopicKey(validation.topicKey).topicKey || validation.topicKey;
    const namespacedTopicKey = buildTopicKey(validation.specKey, topicSlug);
    const marks = Number.isFinite(Number(row.marks)) ? Number(row.marks) : null;
    const dedupeKey = `${questionText}||${namespacedTopicKey}||${JSON.stringify(markScheme)}||${marks}`;

    if (seenKeys.has(dedupeKey)) {
      result.summary.duplicateRows++;
      result.errors.push({ rowNumber: rowNum, reason: "Duplicate in file (questionText+topicKey)", row });
      continue;
    }
    seenKeys.add(dedupeKey);

    const imageUrl = row.imageUrl && String(row.imageUrl).trim() ? String(row.imageUrl).trim() : null;
    const assets = imageUrl ? [{ type: "image", url: imageUrl, alt: null }] : [];

    const questionType = row.questionType && ["mcq", "short", "label", "table", "data"].includes(String(row.questionType).toLowerCase())
      ? String(row.questionType).toLowerCase()
      : "short";

    items.push({
      specKey: validation.specKey,
      topicKey: topicSlug,
      question: questionText,
      markScheme: markScheme.length > 0 ? markScheme.join("\n") : "",
      marks,
      assets,
      type: questionType,
      status: row.status && ["draft", "published"].includes(String(row.status).toLowerCase()) ? String(row.status).toLowerCase() : "draft",
    });
    result.summary.validRows++;
  }

  if (items.length === 0) {
    return result;
  }

  const bySpec = new Map();
  for (const it of items) {
    const key = it.specKey;
    if (!bySpec.has(key)) bySpec.set(key, []);
    bySpec.get(key).push(it);
  }

  let totalImported = 0;
  let totalDuplicates = 0;
  let totalSkipped = 0;

  const importMeta = {
    importSource: "csv_import",
    importType: "anki_style",
    importedAt: new Date(),
    importedBy: importedByUserId,
  };

  for (const [specKey, specItems] of bySpec) {
    const meta = parseSpecToMeta(specKey);
    const bulkItems = specItems.map((it) => ({
      topicKey: it.topicKey,
      question: it.question,
      markScheme: it.markScheme,
      marks: it.marks,
      type: it.type,
      assets: it.assets,
      subject: meta.subject,
      examBoard: meta.examBoard,
      level: meta.level,
    }));

    const report = await bulkImportExamQuestions({
      specKey,
      items: bulkItems,
      dryRun,
      actorId: importedByUserId,
      importMetadata: importMeta,
    });

    totalImported += report.inserted ?? 0;
    totalDuplicates += report.skippedDuplicates ?? 0;
    totalSkipped += (report.invalid ?? 0);

    if (report.preview && report.preview.length > 0 && result.sampleImported.length < 10) {
      for (const p of report.preview) {
        if (p.action === "insert" || p.action === "would_insert") {
          result.sampleImported.push({
            question: specItems[p.index]?.question?.slice(0, 80),
            topicKey: buildTopicKey(specKey, specItems[p.index]?.topicKey),
          });
          if (result.sampleImported.length >= 10) break;
        }
      }
    }
  }

  result.summary.importedRows = totalImported;
  result.summary.duplicateRows += totalDuplicates;
  result.summary.skippedRows += totalSkipped;

  return result;
}

module.exports = {
  parseCsvFile,
  validateFlashcardRow,
  validateExamQuestionRow,
  importFlashcardsFromCsv,
  importExamQuestionsFromCsv,
  parseSpecToMeta,
};
