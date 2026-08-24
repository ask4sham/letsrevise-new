/**
 * CSV invitation syntax preview — no User lookups, no DB writes.
 */
"use strict";

const { parse } = require("csv-parse/sync");
const { normaliseEmail, MAX_UNIQUE_VALID_EMAILS } = require("../utils/studentEmail");

const CSV_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Find the email column key (case-insensitive, trimmed).
 * @param {string[]} headers
 * @returns {string|null}
 */
function findEmailColumn(headers) {
  for (const h of headers || []) {
    if (String(h || "").trim().toLowerCase() === "email") return h;
  }
  return null;
}

/**
 * Parse CSV buffer/string into invitation preview result.
 * @param {Buffer|string} input
 * @param {{ maxUnique?: number }} [opts]
 */
function parseStudentInvitationCsv(input, opts = {}) {
  const maxUnique = opts.maxUnique != null ? opts.maxUnique : MAX_UNIQUE_VALID_EMAILS;

  if (input == null) {
    return { ok: false, error: "File is required", code: "FILE_REQUIRED" };
  }

  let raw;
  if (Buffer.isBuffer(input)) {
    if (input.length === 0) {
      return { ok: false, error: "File is empty", code: "FILE_EMPTY" };
    }
    if (input.length > CSV_MAX_BYTES) {
      return { ok: false, error: "File exceeds 5 MB limit", code: "FILE_TOO_LARGE" };
    }
    raw = input.toString("utf8");
  } else if (typeof input === "string") {
    if (!input.trim()) {
      return { ok: false, error: "File is empty", code: "FILE_EMPTY" };
    }
    raw = input;
  } else {
    return { ok: false, error: "Invalid file", code: "FILE_INVALID" };
  }

  // Strip UTF-8 BOM if present (csv-parse bom option also handles this)
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }

  let records;
  try {
    records = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    });
  } catch (e) {
    return {
      ok: false,
      error: e.message || "Malformed CSV",
      code: "CSV_MALFORMED",
    };
  }

  if (!Array.isArray(records) || records.length === 0) {
    // Could be header-only
    const headerProbe = parse(raw, {
      columns: false,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      to_line: 1,
    });
    const headers = (headerProbe[0] || []).map((h) => String(h || "").trim());
    if (!findEmailColumn(headers)) {
      return { ok: false, error: "CSV must include an email column", code: "EMAIL_COLUMN_MISSING" };
    }
    return {
      ok: true,
      summary: { totalRows: 0, validCount: 0, duplicateCount: 0, invalidCount: 0 },
      validEmails: [],
      duplicateEntries: [],
      invalidEntries: [],
    };
  }

  const headers = Object.keys(records[0] || {});
  const emailKey = findEmailColumn(headers);
  if (!emailKey) {
    return { ok: false, error: "CSV must include an email column", code: "EMAIL_COLUMN_MISSING" };
  }

  const validEmails = [];
  const duplicateEntries = [];
  const invalidEntries = [];
  const seen = new Set();
  let totalRows = 0;

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2; // header is row 1
    const rawValue = row[emailKey];
    const value = rawValue == null ? "" : String(rawValue).trim();
    if (!value) continue; // blank rows ignored
    totalRows += 1;

    const norm = normaliseEmail(value);
    if (!norm.ok) {
      invalidEntries.push({
        row: rowNum,
        value,
        reason: norm.error || "Invalid email format",
      });
      continue;
    }
    if (seen.has(norm.email)) {
      duplicateEntries.push(norm.email);
      continue;
    }
    seen.add(norm.email);
    validEmails.push(norm.email);
  }

  if (validEmails.length > maxUnique) {
    return {
      ok: false,
      error: `Maximum ${maxUnique} unique valid emails allowed`,
      code: "EMAIL_LIMIT_EXCEEDED",
      summary: {
        totalRows,
        validCount: validEmails.length,
        duplicateCount: duplicateEntries.length,
        invalidCount: invalidEntries.length,
      },
      validEmails: validEmails.slice(0, maxUnique),
      duplicateEntries,
      invalidEntries,
      maxUnique,
    };
  }

  return {
    ok: true,
    summary: {
      totalRows,
      validCount: validEmails.length,
      duplicateCount: duplicateEntries.length,
      invalidCount: invalidEntries.length,
    },
    validEmails,
    duplicateEntries,
    invalidEntries,
  };
}

module.exports = {
  CSV_MAX_BYTES,
  parseStudentInvitationCsv,
  findEmailColumn,
};
