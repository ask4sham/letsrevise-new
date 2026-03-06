/**
 * PR-015: Refresh CoverageSnapshot for a specKey from computeCoverage.
 */
const { computeCoverage } = require("./coverageEngine");
const CoverageSnapshot = require("../../models/CoverageSnapshot");
const { normalizeSpecKey } = require("../../config/featureFlags");

/**
 * Recompute coverage and upsert CoverageSnapshot rows.
 * @param {{ specKey: string, windowDays?: number }} opts
 * @returns {{ rowsUpserted: number, computedAt: Date }}
 */
async function refreshCoverageSnapshot(opts = {}) {
  const specKey = opts?.specKey ? String(opts.specKey).trim() : null;
  if (!specKey) return { rowsUpserted: 0, computedAt: new Date() };

  const normalizedSpec = normalizeSpecKey(specKey) || specKey;
  const windowDays = typeof opts?.windowDays === "number" && opts.windowDays > 0 ? opts.windowDays : 14;

  const computedAt = new Date();
  const rows = await computeCoverage({ specKey: normalizedSpec, windowDays });

  if (rows.length === 0) return { rowsUpserted: 0, computedAt };

  const bulkOps = rows.map((r) => ({
    updateOne: {
      filter: { specKey: normalizedSpec, topicKey: r.topicKey, computedAt },
      update: {
        $set: {
          specKey: normalizedSpec,
          topicKey: r.topicKey,
          computedAt,
          windowDays,
          specStatementsTotal: r.specStatementsTotal,
          knowledgeDocsSpec: r.knowledgeDocsSpec,
          knowledgeDocsLesson: r.knowledgeDocsLesson,
          knowledgeDocsTotal: r.knowledgeDocsTotal,
          score: r.score,
          status: r.status,
          enquiriesTotal: r.enquiriesTotal,
          enquiriesWeakEvidence: r.enquiriesWeakEvidence,
          weakRate: r.weakRate,
          topWeakQuestions: r.topWeakQuestions || [],
        },
      },
      upsert: true,
    },
  }));

  const result = await CoverageSnapshot.bulkWrite(bulkOps);
  const rowsUpserted = result.upsertedCount + result.modifiedCount;

  return { rowsUpserted, computedAt };
}

module.exports = { refreshCoverageSnapshot };
