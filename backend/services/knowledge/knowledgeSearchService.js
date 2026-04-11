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
 * @param {{ query: string, specKey: string, topicKey?: string, sourceType?: string, sourceTypes?: string[], limit?: number, topK?: number }}
 * @returns {Promise<Array<{ knowledgeDocumentId, sourceType, sourceId, title, text, topicKey, score, metadata }>>}
 */
async function searchKnowledge({ query, specKey, topicKey, sourceType, sourceTypes, limit = 10, topK = 50 }) {
  const queryText = (query || "").trim();
  if (!queryText) return [];
  const spec = (specKey || "").trim();
  if (!spec) return [];

  let queryEmbedding;
  try {
    [queryEmbedding] = await embedText([queryText]);
  } catch (e) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[knowledgeSearch] embedText failed:", e && e.message ? e.message : e);
    }
    return [];
  }
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
  const topicKeyTrim = topicKey && String(topicKey).trim() ? String(topicKey).trim() : "";

  const validTypes = ["specStatement", "lessonBlock", "lessonDiagram", "externalTrusted", "teacherNote"];

  function buildMongoQuery(includeTopicKey) {
    const q = {
      _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
      specKey: { $in: specVariants },
    };
    if (includeTopicKey && topicKeyTrim) q.topicKey = topicKeyTrim;
    if (Array.isArray(sourceTypes) && sourceTypes.length > 0) {
      const filtered = sourceTypes.filter((t) => validTypes.includes(String(t)));
      if (filtered.length > 0) q.sourceType = { $in: filtered };
    } else if (sourceType && validTypes.includes(String(sourceType))) {
      q.sourceType = sourceType;
    }
    return q;
  }

  let mongoQuery = buildMongoQuery(true);
  let docs = await KnowledgeDocument.find(mongoQuery).lean();

  // Lesson topic often ≠ where content was indexed (e.g. heart content under organisation vs lesson on another sub-topic).
  // If strict topic filter removes every vector hit, fall back to spec-wide retrieval from the same embedding candidates.
  if (docs.length === 0 && topicKeyTrim) {
    mongoQuery = buildMongoQuery(false);
    docs = await KnowledgeDocument.find(mongoQuery).lean();
  }
  const scoreMap = new Map(vectorResults.map((r) => [r.knowledgeDocumentId, r.score]));

  const diagramBoostTerms = ["diagram", "label", "identify", "structure", "parts", "draw", "look at"];
  const queryLower = queryText.toLowerCase();
  const hasDiagramIntent = diagramBoostTerms.some((t) => queryLower.includes(t));

  return docs
    .map((d) => {
      const id = String(d._id);
      const score = scoreMap.get(id) || 0;
      let boost =
        d.sourceType === "specStatement" ? 0.05 : d.sourceType === "teacherNote" ? 0.02 : 0;
      if (d.sourceType === "lessonDiagram" && hasDiagramIntent) boost += 0.03;
      if (topicKeyTrim && String(d.topicKey || "").trim() === topicKeyTrim) boost += 0.02;
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
