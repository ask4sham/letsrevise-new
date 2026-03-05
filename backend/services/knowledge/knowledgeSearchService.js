/**
 * PR-004: Reusable knowledge search service.
 * Used by /api/knowledge/search and /api/enquiry.
 */
const mongoose = require("mongoose");
const KnowledgeDocument = require("../../models/KnowledgeDocument");
const { embedText } = require("../embeddings/provider");
const { searchEmbeddings } = require("../vector/pgvectorClient");

/**
 * Semantic search over KnowledgeDocuments.
 * @param {{ query: string, specKey: string, topicKey?: string, sourceType?: string, limit?: number, topK?: number }}
 * @returns {Promise<Array<{ knowledgeDocumentId, sourceType, sourceId, title, text, topicKey, score, metadata }>>}
 */
async function searchKnowledge({ query, specKey, topicKey, sourceType, limit = 10, topK = 50 }) {
  const queryText = (query || "").trim();
  if (!queryText) return [];
  const spec = (specKey || "").trim();
  if (!spec) return [];

  const [queryEmbedding] = await embedText([queryText]);
  if (!queryEmbedding) return [];

  let vectorResults = [];
  try {
    vectorResults = await searchEmbeddings({ queryEmbedding, limit: topK });
  } catch (e) {
    if (process.env.NODE_ENV !== "test") console.warn("[knowledgeSearch] Vector search failed:", e.message);
    return [];
  }
  const ids = vectorResults
    .map((r) => r.knowledgeDocumentId)
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (ids.length === 0) return [];

  const specVariants = [spec, spec.replace(/_/g, "-").toLowerCase()];
  const mongoQuery = {
    _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
    specKey: { $in: specVariants },
  };
  if (topicKey && String(topicKey).trim()) mongoQuery.topicKey = String(topicKey).trim();
  if (sourceType && ["specStatement", "lessonBlock", "externalTrusted", "teacherNote"].includes(String(sourceType))) mongoQuery.sourceType = sourceType;

  const docs = await KnowledgeDocument.find(mongoQuery).lean();
  const scoreMap = new Map(vectorResults.map((r) => [r.knowledgeDocumentId, r.score]));

  return docs
    .map((d) => {
      const id = String(d._id);
      const score = scoreMap.get(id) || 0;
      const boost =
        d.sourceType === "specStatement" ? 0.05 : d.sourceType === "teacherNote" ? 0.02 : 0;
      return {
        knowledgeDocumentId: id,
        sourceType: d.sourceType,
        sourceId: String(d.sourceId),
        title: d.title || "",
        text: d.text || "",
        topicKey: d.topicKey,
        score: score + boost,
        metadata: d.metadata || {},
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { searchKnowledge };
