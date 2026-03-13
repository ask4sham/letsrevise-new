/**
 * PR-002: Index SpecStatements as KnowledgeDocuments.
 * One chunk per statement.
 */
const crypto = require("crypto");
const SpecStatement = require("../../../models/SpecStatement");
const KnowledgeDocument = require("../../../models/KnowledgeDocument");

function hash(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex").slice(0, 32);
}

/**
 * Build candidate KnowledgeDocuments from SpecStatements.
 * @param {{ specKey?: string }} opts - optional specKey filter
 * @returns {Promise<Array<{ doc: object, sourceId: object, chunkIndex: number }>>}
 */
async function buildCandidates(opts = {}) {
  const query = {};
  if (opts.specKey && String(opts.specKey).trim()) {
    query.specKey = String(opts.specKey).trim();
  }
  if (opts.topicKey && String(opts.topicKey).trim()) {
    query.topicKey = String(opts.topicKey).trim();
  }
  const statements = await SpecStatement.find(query).lean();
  const candidates = [];
  for (const s of statements) {
    const text = (s.statementText || "").trim();
    if (!text) continue;
    const contentHash = hash(`${s.specKey}|${s.topicKey}|${s.statementCode}|${text}`);
    const doc = {
      sourceType: "specStatement",
      sourceId: s._id,
      specKey: s.specKey,
      examBoard: s.examBoard || null,
      level: s.level || null,
      topicKey: s.topicKey,
      tier: s.tier || null,
      title: `${s.statementCode} — ${s.topicKey}`,
      text,
      chunkIndex: 0,
      metadata: { statementCode: s.statementCode },
      contentHash,
    };
    candidates.push({ doc, sourceId: s._id, chunkIndex: 0 });
  }
  return candidates;
}

module.exports = { buildCandidates };
