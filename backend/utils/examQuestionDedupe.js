/**
 * PR-BULK-INGEST-2: Stable, deterministic fingerprint for exam question dedupe.
 * SHA-256 over canonical fields; no DB calls.
 */
const crypto = require("crypto");

function normalizeText(v) {
  return String(v || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Build a stable fingerprint for exam questions.
 * Keep this strict and deterministic. Any change to canonical fields changes fingerprint.
 * @param {Object} opts
 * @param {string} opts.specKey
 * @param {string} opts.topicKey - namespaced topicKey
 * @param {string} opts.question - question stem
 * @param {string} opts.markScheme - mark scheme / model answer
 * @param {number|null} opts.marks
 */
function examQuestionFingerprint({ specKey, topicKey, question, markScheme, marks }) {
  const payload = {
    specKey: normalizeText(specKey),
    topicKey: normalizeText(topicKey),
    question: normalizeText(question),
    markScheme: normalizeText(markScheme),
    marks: Number.isFinite(Number(marks)) ? Number(marks) : null,
  };

  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

module.exports = { examQuestionFingerprint, normalizeText };
