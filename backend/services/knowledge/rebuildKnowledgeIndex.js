/**
 * PR-015: Programmatic rebuild of KnowledgeDocument index.
 * Wraps specStatementIndexer and lessonBlockIndexer. Scoped by specKey/topicKey/sourceTypes.
 */
const KnowledgeDocument = require("../../models/KnowledgeDocument");
const specStatementIndexer = require("./indexers/specStatementIndexer");
const lessonBlockIndexer = require("./indexers/lessonBlockIndexer");
const { normalizeSpecKey } = require("../../config/featureFlags");

const INDEXERS = {
  specStatement: specStatementIndexer,
  lessonBlock: lessonBlockIndexer,
};

/**
 * Rebuild KnowledgeDocument index for given scope.
 * @param {{ specKey: string, topicKey?: string, sourceTypes?: string[] }} opts
 * @returns {{ created: number, updated: number, skipped: number, errors: string[] }}
 */
async function rebuildKnowledgeIndex(opts = {}) {
  const specKey = opts?.specKey ? String(opts.specKey).trim() : null;
  if (!specKey) return { created: 0, updated: 0, skipped: 0, errors: ["specKey required"] };

  const normalizedSpec = normalizeSpecKey(specKey) || specKey;
  const topicKey = opts?.topicKey ? String(opts.topicKey).trim() : null;
  const sourceTypes = Array.isArray(opts?.sourceTypes) && opts.sourceTypes.length > 0
    ? opts.sourceTypes
    : ["specStatement", "lessonBlock"];

  const report = { created: 0, updated: 0, skipped: 0, errors: [] };
  const indexerOpts = { specKey: normalizedSpec };
  if (topicKey) indexerOpts.topicKey = topicKey;

  for (const src of sourceTypes) {
    const indexer = INDEXERS[src];
    if (!indexer) continue;

    const candidates = await indexer.buildCandidates(indexerOpts);

    for (const { doc, sourceId, chunkIndex } of candidates) {
      try {
        const existing = await KnowledgeDocument.findOne({
          sourceType: doc.sourceType,
          sourceId: doc.sourceId,
          chunkIndex: doc.chunkIndex,
        }).lean();

        if (!existing) {
          await KnowledgeDocument.create(doc);
          report.created++;
        } else if (existing.contentHash !== doc.contentHash) {
          await KnowledgeDocument.updateOne(
            { sourceType: doc.sourceType, sourceId: doc.sourceId, chunkIndex: doc.chunkIndex },
            { $set: { ...doc, updatedAt: new Date() } }
          );
          report.updated++;
        } else {
          report.skipped++;
        }
      } catch (err) {
        report.errors.push(`${src}:${String(sourceId)}: ${err?.message || String(err)}`);
        if (report.errors.length >= 20) break;
      }
    }
  }

  return report;
}

module.exports = { rebuildKnowledgeIndex };
