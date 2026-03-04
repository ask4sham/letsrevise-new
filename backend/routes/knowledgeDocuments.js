/**
 * PR-002/PR-003: KnowledgeDocument APIs.
 * GET /api/knowledge-documents — admin only (debug)
 * GET /api/knowledge/search — teacher + admin (semantic search)
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const KnowledgeDocument = require("../models/KnowledgeDocument");

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

router.get("/", auth, requireAdmin, async (req, res) => {
  try {
    const { specKey, topicKey, sourceType, limit, q } = req.query;
    const query = {};
    if (specKey && String(specKey).trim()) query.specKey = String(specKey).trim();
    if (topicKey && String(topicKey).trim()) query.topicKey = String(topicKey).trim();
    if (sourceType && ["specStatement", "lessonBlock"].includes(String(sourceType))) query.sourceType = sourceType;
    if (q && String(q).trim()) query.text = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const lim = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const items = await KnowledgeDocument.find(query).sort({ specKey: 1, topicKey: 1, chunkIndex: 1 }).limit(lim).lean();
    return res.json({ items });
  } catch (err) {
    console.error("KnowledgeDocuments GET error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PR-003: GET /api/knowledge/search — semantic search (teacher + admin).
 * Params: q (required), specKey (required), topicKey, sourceType, limit
 */
router.get("/search", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const { q, specKey, topicKey, sourceType, limit } = req.query;
    const queryText = q != null ? String(q).trim() : "";
    if (!queryText) {
      return res.status(400).json({ error: "q (query) is required" });
    }
    const spec = specKey != null ? String(specKey).trim() : "";
    if (!spec) {
      return res.status(400).json({ error: "specKey is required" });
    }
    const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

    const { embedText } = require("../services/embeddings/provider");
    const { searchEmbeddings } = require("../services/vector/pgvectorClient");

    const [queryEmbedding] = await embedText([queryText]);
    if (!queryEmbedding) {
      return res.status(500).json({ error: "Failed to embed query" });
    }

    const vectorResults = await searchEmbeddings({ queryEmbedding, limit: 50 });
    const ids = vectorResults.map((r) => r.knowledgeDocumentId).filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (ids.length === 0) {
      return res.json({ items: [] });
    }

    const specVariants = [spec, spec.replace(/_/g, "-").toLowerCase()];
    const mongoQuery = { _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) }, specKey: { $in: specVariants } };
    if (topicKey && String(topicKey).trim()) mongoQuery.topicKey = String(topicKey).trim();
    if (sourceType && ["specStatement", "lessonBlock"].includes(String(sourceType))) mongoQuery.sourceType = sourceType;

    const docs = await KnowledgeDocument.find(mongoQuery).lean();
    const docMap = new Map(docs.map((d) => [String(d._id), d]));
    const scoreMap = new Map(vectorResults.map((r) => [r.knowledgeDocumentId, r.score]));

    const items = docs
      .map((d) => {
        const id = String(d._id);
        const score = scoreMap.get(id) || 0;
        const boost = d.sourceType === "specStatement" ? 0.05 : 0;
        return { doc: d, score: score + boost };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, lim)
      .map(({ doc, score }) => ({
        knowledgeDocumentId: String(doc._id),
        sourceType: doc.sourceType,
        sourceId: String(doc.sourceId),
        title: doc.title || "",
        textSnippet: (doc.text || "").slice(0, 300),
        topicKey: doc.topicKey,
        score: Math.round(score * 1000) / 1000,
        metadata: doc.metadata || {},
      }));

    return res.json({ items });
  } catch (err) {
    console.error("Knowledge search error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

module.exports = router;
