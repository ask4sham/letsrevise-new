/**
 * Stable fingerprints for Phase 2 dry-run tooling (no DB writes).
 */
const crypto = require("crypto");
const { examQuestionFingerprint, normalizeText } = require("../../utils/examQuestionDedupe");

function stableJsonHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function deriveSpecKey(master) {
  if (master?.metadata?.specKey) return String(master.metadata.specKey).trim();
  const topicKey = master?.topicKey ? String(master.topicKey) : "";
  const idx = topicKey.indexOf(":");
  return idx > 0 ? topicKey.slice(0, idx) : null;
}

function deriveCanonicalTopicKey(master) {
  if (master?.metadata?.canonicalTopicKey) return String(master.metadata.canonicalTopicKey).trim();
  const topicKey = master?.topicKey ? String(master.topicKey) : "";
  const idx = topicKey.indexOf(":");
  return idx >= 0 && idx < topicKey.length - 1 ? topicKey.slice(idx + 1) : null;
}

function masterFingerprint(master) {
  if (master?.fingerprint) return String(master.fingerprint);
  const markScheme = Array.isArray(master?.markScheme)
    ? master.markScheme.map((l) => String(l ?? "").trim()).filter(Boolean).join("\n")
    : "";
  return examQuestionFingerprint({
    specKey: deriveSpecKey(master) || "",
    topicKey: master?.topicKey || "",
    question: master?.question || "",
    markScheme,
    marks: master?.marks ?? null,
  });
}

function lessonEditFingerprint(lessonEdit) {
  if (!lessonEdit || typeof lessonEdit !== "object") return null;
  const canonical = {
    type: lessonEdit.type ?? null,
    question: lessonEdit.question ?? null,
    marks: lessonEdit.marks ?? null,
    markScheme: Array.isArray(lessonEdit.markScheme)
      ? lessonEdit.markScheme.map((l) => String(l ?? "").trim())
      : null,
    options: Array.isArray(lessonEdit.options)
      ? lessonEdit.options.map((o) => String(o ?? "").trim())
      : null,
    correctAnswer: lessonEdit.correctAnswer ?? null,
    explanation: lessonEdit.explanation ?? null,
    editedAt: lessonEdit.editedAt ? new Date(lessonEdit.editedAt).toISOString() : null,
  };
  return stableJsonHash(canonical);
}

function effectivePracticeFingerprint(effective) {
  if (!effective) return null;
  const markScheme = Array.isArray(effective.markScheme)
    ? effective.markScheme.map((l) => String(l ?? "").trim()).filter(Boolean).join("\n")
    : "";
  return stableJsonHash({
    question: normalizeText(effective.question || ""),
    marks: effective.marks ?? null,
    markScheme,
    type: effective.type ?? null,
  });
}

module.exports = {
  stableJsonHash,
  deriveSpecKey,
  deriveCanonicalTopicKey,
  masterFingerprint,
  lessonEditFingerprint,
  effectivePracticeFingerprint,
};
