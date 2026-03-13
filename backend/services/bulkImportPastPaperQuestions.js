/**
 * PR-BULK-INGEST-4: Bulk import past paper questions — spec/topic validation, namespaced topicKey, dedupe.
 */
const { assertValidSpecKey, assertValidSpecTopic } = require("../utils/specTopicValidation");
const { buildTopicKey } = require("../utils/topicKey");
const { pastPaperQuestionFingerprint } = require("../utils/pastPaperQuestionDedupe");
const { normalizeMetadata } = require("../utils/metadataValidation");
const PastPaper = require("../models/PastPaper");
const PastPaperQuestion = require("../models/PastPaperQuestion");

async function bulkImportPastPaperQuestions({ specKey, items, dryRun = false, actorId = null }) {
  if (!specKey || typeof specKey !== "string") throw new Error("specKey is required");
  assertValidSpecKey(specKey);
  if (!Array.isArray(items) || items.length === 0) throw new Error("items must be a non-empty array");

  const report = {
    specKey,
    dryRun,
    total: items.length,
    valid: 0,
    invalid: 0,
    inserted: 0,
    skippedDuplicates: 0,
    errors: [],
    preview: [],
  };

  const prepared = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    try {
      if (!it || typeof it !== "object") throw new Error("item must be an object");
      if (!it.pastPaperId) throw new Error("pastPaperId is required");
      if (!it.topicKey || typeof it.topicKey !== "string") throw new Error("topicKey is required");
      if (!it.question || typeof it.question !== "string") throw new Error("question is required");

      const paper = await PastPaper.findOne({
        _id: it.pastPaperId,
        ownerId: actorId,
      }).lean();
      if (!paper) {
        const err = new Error(`Unknown pastPaperId (or not owned): ${it.pastPaperId}`);
        err.code = "INVALID_PAST_PAPER_ID";
        throw err;
      }

      assertValidSpecTopic({ specKey, topicKey: it.topicKey });

      let meta = { difficulty: null, skill: null, estimatedTimeSec: null };
      if (it.difficulty != null || it.skill != null || it.estimatedTimeSec != null) {
        meta = normalizeMetadata({ difficulty: it.difficulty, skill: it.skill, estimatedTimeSec: it.estimatedTimeSec });
      }

      const namespacedTopicKey = buildTopicKey(specKey, it.topicKey);

      const msArray = Array.isArray(it.markScheme)
        ? it.markScheme
        : typeof it.markScheme === "string"
          ? it.markScheme
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

      const fingerprint = pastPaperQuestionFingerprint({
        pastPaperId: String(it.pastPaperId),
        topicKey: namespacedTopicKey,
        questionNumber: it.questionNumber,
        question: it.question,
        markScheme: msArray.join("\n"),
      });

      prepared.push({
        index: i,
        raw: it,
        namespacedTopicKey,
        msArray,
        fingerprint,
        metadata: meta,
      });

      report.valid++;
    } catch (e) {
      report.invalid++;
      report.errors.push({ index: i, code: e.code || "INVALID_ITEM", message: e.message });
    }
  }

  if (prepared.length === 0) return report;

  const fps = prepared.map((p) => p.fingerprint);
  const existing = await PastPaperQuestion.find(
    { ownerId: actorId, fingerprint: { $in: fps } },
    { fingerprint: 1 }
  ).lean();
  const existingSet = new Set(existing.map((d) => d.fingerprint));

  const toInsert = [];

  for (const p of prepared) {
    if (existingSet.has(p.fingerprint)) {
      report.skippedDuplicates++;
      if (report.preview.length < 25) report.preview.push({ index: p.index, action: "skip_duplicate" });
      continue;
    }

    const assets = Array.isArray(p.raw.assets)
      ? p.raw.assets.map((a) => ({
          type: a && typeof a.type === "string" ? a.type : "image",
          mediaId: a && a.mediaId != null ? a.mediaId : null,
          url: a && typeof a.url === "string" ? a.url : null,
          alt: a && typeof a.alt === "string" ? a.alt : null,
        }))
      : [];

    const doc = {
      ownerId: actorId || null,
      pastPaperId: p.raw.pastPaperId,
      specKey,
      topicKey: p.namespacedTopicKey,
      questionNumber: p.raw.questionNumber || null,
      marks: Number.isFinite(Number(p.raw.marks)) ? Number(p.raw.marks) : null,
      question: p.raw.question.trim(),
      markScheme: p.msArray,
      assets,
      fingerprint: p.fingerprint,
      difficulty: p.metadata?.difficulty ?? null,
      skill: p.metadata?.skill ?? null,
      estimatedTimeSec: p.metadata?.estimatedTimeSec ?? null,
    };

    toInsert.push(doc);
    if (report.preview.length < 25)
      report.preview.push({
        index: p.index,
        action: dryRun ? "would_insert" : "insert",
        topicKey: p.namespacedTopicKey,
        difficulty: p.metadata?.difficulty ?? undefined,
        skill: p.metadata?.skill ?? undefined,
        estimatedTimeSec: p.metadata?.estimatedTimeSec ?? undefined,
      });
  }

  if (dryRun) {
    report.inserted = toInsert.length;
    return report;
  }

  if (!actorId) throw new Error("actorId is required for non-dryRun imports");
  if (toInsert.length) await PastPaperQuestion.insertMany(toInsert, { ordered: false });
  report.inserted = toInsert.length;

  return report;
}

module.exports = { bulkImportPastPaperQuestions };
