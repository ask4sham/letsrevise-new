/**
 * PR-023: Teacher notes listing — topic scoped, teacher/admin only.
 */
const KnowledgeDocument = require("../models/KnowledgeDocument");

function isTeacherOrAdmin(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user?.isAdmin === true;
}

/**
 * GET /api/teacher-notes?specKey=...&topicKey=...&limit=20
 */
async function listTeacherNotes(req, res) {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const { specKey, topicKey, limit = 20 } = req.query || {};
    const spec = (specKey || "").trim();
    const topic = (topicKey || "").trim();
    if (!spec) {
      return res.status(400).json({ error: "specKey is required" });
    }

    const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const query = { sourceType: "teacherNote", specKey: spec };
    if (topic) query.topicKey = topic;

    const docs = await KnowledgeDocument.find(query)
      .sort({ updatedAt: -1 })
      .limit(lim)
      .lean();

    const items = docs.map((d) => ({
      knowledgeDocumentId: String(d._id),
      title: d.title || "Teacher note",
      textSnippet: (d.text || "").slice(0, 300),
      metadata: d.metadata || {},
      updatedAt: d.updatedAt,
    }));

    return res.json({ items });
  } catch (err) {
    console.error("[teacherNotes] list:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

module.exports = { listTeacherNotes };
