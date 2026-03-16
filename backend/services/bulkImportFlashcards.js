/**
 * PR-BULK-INGEST-1: Bulk import flashcards with taxonomy validation, namespacing, dedupe, dry-run.
 */
const { assertValidSpecKey, assertValidSpecTopic } = require("../utils/specTopicValidation");
const { buildTopicKey } = require("../utils/topicKey");
const { fingerprint } = require("../utils/flashcardDedupe");
const TopicFlashcard = require("../models/TopicFlashcard");

/**
 * Payload format:
 * {
 *   specKey: string,
 *   items: [
 *     {
 *       topicKey: string,  // taxonomy slug, NON-namespaced
 *       question: string, // maps to front
 *       answer: string,   // maps to back
 *       front?: string,   // optional override
 *       back?: string,
 *       difficulty?: "easy"|"medium"|"hard",
 *       tags?: string[],
 *       assets?: [{ type: "image"|"diagram"|"table", url: string, alt?: string }]
 *     }
 *   ],
 *   dryRun?: boolean
 * }
 */
async function bulkImportFlashcards({ specKey, items, dryRun = false, actorId = null, importMetadata = null }) {
  if (!specKey || typeof specKey !== "string") {
    throw new Error("specKey is required");
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("items must be a non-empty array");
  }

  // Fail fast for unknown specKey (return 400 from route)
  assertValidSpecKey(specKey);

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
      if (!it.topicKey || typeof it.topicKey !== "string") throw new Error("topicKey is required");
      const front = (it.front != null ? it.front : it.question);
      const back = (it.back != null ? it.back : it.answer);
      if (typeof front !== "string" || !front.trim()) throw new Error("question/front is required");
      if (typeof back !== "string" || !back.trim()) throw new Error("answer/back is required");

      assertValidSpecTopic({ specKey, topicKey: it.topicKey });

      const namespacedTopicKey = buildTopicKey(specKey, it.topicKey);
      const fp = fingerprint(front.trim(), back.trim());

      prepared.push({
        index: i,
        raw: it,
        front: front.trim(),
        back: back.trim(),
        namespacedTopicKey,
        fingerprint: fp,
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
  const existing = await TopicFlashcard.find({ fingerprint: { $in: fingerprints } }, { fingerprint: 1 }).lean();
  const existingSet = new Set(existing.map((d) => d.fingerprint));

  const toInsert = [];

  for (const p of prepared) {
    if (existingSet.has(p.fingerprint)) {
      report.skippedDuplicates++;
      if (report.preview.length < 25) {
        report.preview.push({ index: p.index, action: "skip_duplicate", fingerprint: p.fingerprint });
      }
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
      ownerId: actorId,
      topicKey: p.namespacedTopicKey,
      front: p.front,
      back: p.back,
      status: "draft",
      fingerprint: p.fingerprint,
      assets,
      ...(importMetadata && typeof importMetadata === "object"
        ? { metadata: { ...importMetadata } }
        : {}),
    };

    toInsert.push(doc);
    if (report.preview.length < 25) {
      report.preview.push({
        index: p.index,
        action: dryRun ? "would_insert" : "insert",
        topicKey: p.namespacedTopicKey,
      });
    }
  }

  if (dryRun) {
    report.inserted = toInsert.length;
    return report;
  }

  if (toInsert.length > 0) {
    if (!actorId) {
      throw new Error("actorId (ownerId) is required for insert");
    }
    await TopicFlashcard.insertMany(toInsert, { ordered: false });
  }

  report.inserted = toInsert.length;
  return report;
}

module.exports = { bulkImportFlashcards };
