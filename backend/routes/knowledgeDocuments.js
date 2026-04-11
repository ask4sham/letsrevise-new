/**
 * PR-002/PR-003: KnowledgeDocument APIs.
 * GET /api/knowledge-documents — admin only (debug)
 * GET /api/knowledge/search — teacher + admin (semantic search)
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const KnowledgeDocument = require("../models/KnowledgeDocument");
const { sendInternalError } = require("../utils/safeErrorResponse");

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
    if (sourceType && ["specStatement", "lessonBlock", "externalTrusted", "teacherNote"].includes(String(sourceType))) query.sourceType = sourceType;
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

    const { searchKnowledge } = require("../services/knowledge/knowledgeSearchService");
    const items = await searchKnowledge({
      query: queryText,
      specKey: spec,
      topicKey: topicKey || undefined,
      sourceType: sourceType || undefined,
      limit: lim,
      topK: 50,
    });

    return res.json({
      items: items.map((r) => ({
        knowledgeDocumentId: r.knowledgeDocumentId,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        title: r.title,
        textSnippet: (r.text || "").slice(0, 300),
        topicKey: r.topicKey,
        score: Math.round(r.score * 1000) / 1000,
        metadata: r.metadata,
      })),
    });
  } catch (err) {
    console.error("Knowledge search error:", err);
    return sendInternalError("knowledge/search", err, res, { extra: { error: "Server error" } });
  }
});

module.exports = router;
