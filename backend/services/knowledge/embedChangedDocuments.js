/**
 * PR-015: Embed changed KnowledgeDocuments (programmatic).
 * Only embeds docs with missing or stale embeddings.
 * Returns { embedded, skipped, failed, vectorDbDown }.
 */
const mongoose = require("mongoose");
const KnowledgeDocument = require("../../models/KnowledgeDocument");
const { embedText, getProvider } = require("../embeddings/provider");
const { upsertEmbedding, getEmbeddingMeta, testConnection } = require("../vector/pgvectorClient");
const { normalizeSpecKey } = require("../../config/featureFlags");

const BATCH_SIZE = 16;

function isConnectionError(err) {
  const msg = (err?.message || String(err)).toLowerCase();
  return (
    msg.includes("password") ||
    msg.includes("econnrefused") ||
    msg.includes("does not exist") ||
    msg.includes("extension") ||
    msg.includes("pg_hba") ||
    msg.includes("connection refused")
  );
}

/**
 * Embed KnowledgeDocuments for given scope.
 * @param {{ specKey: string, topicKey?: string, sourceTypes?: string[], limit?: number }} opts
 * @returns {{ embedded: number, skipped: number, failed: number, vectorDbDown?: boolean, errors: string[] }}
 */
async function embedChangedDocuments(opts = {}) {
  const specKey = opts?.specKey ? String(opts.specKey).trim() : null;
  if (!specKey) return { embedded: 0, skipped: 0, failed: 0, errors: ["specKey required"] };

  const normalizedSpec = normalizeSpecKey(specKey) || specKey;
  const topicKey = opts?.topicKey ? String(opts.topicKey).trim() : null;
  const sourceTypes = Array.isArray(opts?.sourceTypes) && opts.sourceTypes.length > 0
    ? opts.sourceTypes
    : ["specStatement", "lessonBlock", "lessonDiagram"];
  const limit = typeof opts?.limit === "number" && opts.limit > 0 ? opts.limit : 10000;

  const query = { specKey: normalizedSpec };
  if (topicKey) query.topicKey = topicKey;
  if (sourceTypes.length > 0) query.sourceType = { $in: sourceTypes };

  const docs = await KnowledgeDocument.find(query)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  let vectorDbDown = false;
  try {
    await testConnection();
  } catch (err) {
    if (isConnectionError(err)) {
      vectorDbDown = true;
      return {
        embedded: 0,
        skipped: 0,
        failed: 0,
        vectorDbDown: true,
        errors: ["Vector DB unavailable: embeddings skipped"],
      };
    }
    throw err;
  }

  const report = { embedded: 0, skipped: 0, failed: 0, errors: [] };

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const toEmbed = [];
    for (const doc of batch) {
      const id = String(doc._id);
      const text = (doc.text || "").trim();
      if (!text) {
        report.failed++;
        if (report.errors.length < 20) report.errors.push(`${id}: empty text`);
        continue;
      }
      try {
        const meta = await getEmbeddingMeta(id);
        if (meta && meta.contentHash === doc.contentHash) {
          report.skipped++;
          continue;
        }
        toEmbed.push({ doc, id });
      } catch (e) {
        if (isConnectionError(e)) {
          vectorDbDown = true;
          return {
            embedded: report.embedded,
            skipped: report.skipped,
            failed: report.failed + (docs.length - i - batch.length) + toEmbed.length,
            vectorDbDown: true,
            errors: [...report.errors, "Vector DB connection lost during embedding"],
          };
        }
        report.failed++;
        if (report.errors.length < 20) report.errors.push(`${id}: ${e?.message || String(e)}`);
      }
    }
    if (toEmbed.length === 0) continue;
    try {
      const texts = toEmbed.map((x) => x.doc.text);
      const embeddings = await embedText(texts);
      if (embeddings.length !== toEmbed.length) {
        for (let j = 0; j < toEmbed.length; j++) {
          report.failed++;
          if (report.errors.length < 20) report.errors.push(`${toEmbed[j].id}: embedding length mismatch`);
        }
        continue;
      }
      for (let j = 0; j < toEmbed.length; j++) {
        try {
          await upsertEmbedding({
            knowledgeDocumentId: toEmbed[j].id,
            contentHash: toEmbed[j].doc.contentHash,
            embedding: embeddings[j],
          });
          report.embedded++;
        } catch (e) {
          if (isConnectionError(e)) {
            vectorDbDown = true;
            return {
              embedded: report.embedded,
              skipped: report.skipped,
              failed: report.failed + (toEmbed.length - j),
              vectorDbDown: true,
              errors: [...report.errors, "Vector DB connection lost during upsert"],
            };
          }
          report.failed++;
          if (report.errors.length < 20) report.errors.push(`${toEmbed[j].id}: ${e?.message || String(e)}`);
        }
      }
    } catch (e) {
      if (isConnectionError(e)) {
        vectorDbDown = true;
        return {
          embedded: report.embedded,
          skipped: report.skipped,
          failed: report.failed + toEmbed.length,
          vectorDbDown: true,
          errors: [...report.errors, "Vector DB error: " + (e?.message || String(e))],
        };
      }
      for (const x of toEmbed) {
        report.failed++;
        if (report.errors.length < 20) report.errors.push(`${x.id}: ${e?.message || String(e)}`);
      }
    }
  }

  return report;
}

module.exports = { embedChangedDocuments };
