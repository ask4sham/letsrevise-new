/**
 * Shared student email normalisation and bulk-paste parsing for class invitations.
 * No User lookups — syntax and dedupe only.
 */
"use strict";

const MAX_UNIQUE_VALID_EMAILS = 200;

/** Conservative syntax check used when validator package is unavailable. */
const FALLBACK_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmailSyntax(email) {
  if (typeof email !== "string" || !email) return false;
  try {
    // express-validator depends on validator; often hoisted after npm ci
    // eslint-disable-next-line global-require
    const validator = require("validator");
    if (validator && typeof validator.isEmail === "function") {
      return validator.isEmail(email, { allow_utf8_local_part: false });
    }
  } catch {
    // fall through
  }
  return FALLBACK_EMAIL_RE.test(email);
}

/**
 * @param {unknown} value
 * @returns {{ ok: true, email: string } | { ok: false, error: string }}
 */
function normaliseEmail(value) {
  if (typeof value !== "string") {
    return { ok: false, error: "Email must be a string" };
  }
  const email = value.trim().toLowerCase();
  if (!email) {
    return { ok: false, error: "Email is required" };
  }
  if (!isValidEmailSyntax(email)) {
    return { ok: false, error: "Invalid email format" };
  }
  return { ok: true, email };
}

/**
 * Parse paste/bulk input: newlines, commas, semicolons.
 * Deduplicates after normalisation; preserves first-occurrence order.
 *
 * @param {unknown} value
 * @param {{ maxUnique?: number }} [opts]
 */
function parseStudentEmailInput(value, opts = {}) {
  const maxUnique = opts.maxUnique != null ? opts.maxUnique : MAX_UNIQUE_VALID_EMAILS;

  if (value == null) {
    return {
      ok: true,
      validEmails: [],
      invalidEntries: [],
      duplicateEntries: [],
      totalSubmitted: 0,
    };
  }

  if (typeof value !== "string" && !Array.isArray(value)) {
    return {
      ok: false,
      error: "Input must be a string or array of emails",
      validEmails: [],
      invalidEntries: [],
      duplicateEntries: [],
      totalSubmitted: 0,
    };
  }

  const rawParts = Array.isArray(value)
    ? value.map((v) => String(v ?? ""))
    : String(value).split(/[\n,;]+/);

  const invalidEntries = [];
  const duplicateEntries = [];
  const validEmails = [];
  const seen = new Set();
  let totalSubmitted = 0;

  for (const part of rawParts) {
    const trimmed = String(part || "").trim();
    if (!trimmed) continue;
    totalSubmitted += 1;
    const norm = normaliseEmail(trimmed);
    if (!norm.ok) {
      invalidEntries.push(trimmed);
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
      validEmails: validEmails.slice(0, maxUnique),
      invalidEntries,
      duplicateEntries,
      totalSubmitted,
      maxUnique,
    };
  }

  return {
    ok: true,
    validEmails,
    invalidEntries,
    duplicateEntries,
    totalSubmitted,
  };
}

module.exports = {
  MAX_UNIQUE_VALID_EMAILS,
  normaliseEmail,
  parseStudentEmailInput,
  isValidEmailSyntax,
};
