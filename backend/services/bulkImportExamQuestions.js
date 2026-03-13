/**
 * PR-BULK-INGEST-2: Bulk import exam questions with taxonomy validation, namespacing, dedupe (SHA-256), dry-run.
 */
const { assertValidSpecKey, assertValidSpecTopic } = require("../utils/specTopicValidation");
const { buildTopicKey } = require("../utils/topicKey");
const { examQuestionFingerprint } = require("../utils/examQuestionDedupe");
const { normalizeMetadata } = require("../utils/metadataValidation");
const ExamQuestion = require("../models/ExamQuestion");

/**
 * Payload format:
 * {
 *   specKey: string,
 *   items: [
 *     {
 *       topicKey: string,        // taxonomy slug, NON-namespaced
 *       question: string,        // question stem
 *       markScheme: string,      // mark scheme / model answer (required)
 *       marks?: number,
 *       paper?: string,
 *       year?: string|number,
 *       source?: string,
 *       assets?: [{ type, url, alt? }]  // optional; only persisted if schema supports
 *     }
 *   ],
 *   dryRun?: boolean
 * }
 */
async function bulkImportExamQuestions({ specKey, items, dryRun = false, actorId = null }) {
  if (!specKey || typeof specKey !== "string") {
    throw new Error("specKey is required");
  }
  assertValidSpecKey(specKey);

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("items must be a non-empty array");
  }

  const report = {
    specKey,
    dryRun,
    total: items.length,
    valid: 0,
    invalid: 0,
    inserted: 0,
    skippedDuplicates: 0,
    errors: [],
    preview: [], // first 25
  };

  const prepared = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];

    try {
      if (!it || typeof it !== "object") throw new Error("item must be an object");
      if (!it.topicKey || typeof it.topicKey !== "string") throw new Error("topicKey is required");
      if (!it.question || typeof it.question !== "string") throw new Error("question is required");
      if (it.markScheme == null || typeof it.markScheme !== "string") throw new Error("markScheme is required");

      assertValidSpecTopic({ specKey, topicKey: it.topicKey });

      let meta = { difficulty: null, skill: null, estimatedTimeSec: null };
      if (it.difficulty != null || it.skill != null || it.estimatedTimeSec != null) {
        meta = normalizeMetadata({ difficulty: it.difficulty, skill: it.skill, estimatedTimeSec: it.estimatedTimeSec });
      }

      const namespacedTopicKey = buildTopicKey(specKey, it.topicKey);

      const fingerprint = examQuestionFingerprint({
        specKey,
        topicKey: namespacedTopicKey,
        question: it.question,
        markScheme: it.markScheme,
        marks: it.marks,
      });

      prepared.push({
        index: i,
        raw: it,
        namespacedTopicKey,
        fingerprint,
        metadata: meta,
      });

      report.valid++;
    } catch (e) {
      report.invalid++;
      report.errors.push({
        index: i,
        code: e.code || "INVALID_ITEM",
        message: e.message,
      });
    }
  }

  if (prepared.length === 0) return report;

  const fingerprints = prepared.map((p) => p.fingerprint);
  const existing = await ExamQuestion.find({ fingerprint: { $in: fingerprints } }, { fingerprint: 1 }).lean();
  const existingSet = new Set(existing.map((d) => d.fingerprint));

  const toInsert = [];

  for (const p of prepared) {
    if (existingSet.has(p.fingerprint)) {
      report.skippedDuplicates++;
      if (report.preview.length < 25) report.preview.push({ index: p.index, action: "skip_duplicate" });
      continue;
    }

    const markSchemeStr = p.raw.markScheme || "";
    const markSchemeArray = markSchemeStr
      ? markSchemeStr
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const doc = {
      teacherId: actorId,
      topicKey: p.namespacedTopicKey,
      subject: p.raw.subject || "Biology",
      examBoard: p.raw.examBoard || "AQA",
      level: p.raw.level || "GCSE",
      topic: p.raw.topic || null,
      unitKey: p.raw.unitKey || null,
      type: p.raw.type && ["mcq", "short", "label", "table", "data"].includes(String(p.raw.type).toLowerCase())
        ? String(p.raw.type).toLowerCase()
        : "short",
      marks: Number.isFinite(Number(p.raw.marks)) ? Number(p.raw.marks) : null,
      question: p.raw.question.trim(),
      markScheme: markSchemeArray,
      correctAnswer: markSchemeArray[0] ?? null,
      content:
        p.raw.paper != null || p.raw.year != null || p.raw.source != null
          ? { paper: p.raw.paper ?? null, year: p.raw.year ?? null, source: p.raw.source ?? "original" }
          : null,
      status: "draft",
      fingerprint: p.fingerprint,
      difficulty: p.metadata?.difficulty ?? null,
      skill: p.metadata?.skill ?? null,
      estimatedTimeSec: p.metadata?.estimatedTimeSec ?? null,
      assets: Array.isArray(p.raw.assets)
        ? p.raw.assets.map((a) => ({
            type: a && typeof a.type === "string" ? a.type : "image",
            mediaId: a && a.mediaId != null ? a.mediaId : null,
            url: a && typeof a.url === "string" ? a.url : null,
            alt: a && typeof a.alt === "string" ? a.alt : null,
          }))
        : [],
    };

    toInsert.push(doc);
    if (report.preview.length < 25) {
      report.preview.push({
        index: p.index,
        action: dryRun ? "would_insert" : "insert",
        topicKey: p.namespacedTopicKey,
        difficulty: p.metadata?.difficulty ?? undefined,
        skill: p.metadata?.skill ?? undefined,
        estimatedTimeSec: p.metadata?.estimatedTimeSec ?? undefined,
      });
    }
  }

  if (dryRun) {
    report.inserted = toInsert.length;
    return report;
  }

  if (toInsert.length > 0) {
    if (!actorId) throw new Error("actorId is required for non-dryRun imports");
    await ExamQuestion.insertMany(toInsert, { ordered: false });
  }

  report.inserted = toInsert.length;
  return report;
}

module.exports = { bulkImportExamQuestions };
