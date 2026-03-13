/**
 * PR-027: Topic summary logs — list and get one.
 */
const TopicSummaryLog = require("../models/TopicSummaryLog");
const { isAiTutorEnabledForSpec } = require("../config/featureFlags");

function isTeacherOrAdmin(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user?.isAdmin === true;
}

function isStudent(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "student";
}

/**
 * GET /api/topic-summary/logs
 * Query: specKey (required), topicKey (required), limit (default 10 max 50), before (optional ISO)
 */
async function getTopicSummaryLogs(req, res) {
  try {
    if (!isTeacherOrAdmin(req) && !isStudent(req)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const specKey = (req.query.specKey || "").trim();
    const topicKey = (req.query.topicKey || "").trim();
    if (!specKey || !topicKey) {
      return res.status(400).json({ error: "specKey and topicKey are required" });
    }

    if (isStudent(req)) {
      if (!isAiTutorEnabledForSpec(specKey)) {
        return res.status(403).json({ error: "AI Tutor is not enabled for this course." });
      }
    }

    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const before = req.query.before ? new Date(req.query.before) : null;
    if (before && isNaN(before.getTime())) {
      return res.status(400).json({ error: "Invalid before date" });
    }

    const userId = req.user?._id || req.user?.userId || req.user?.id;
    const isTeacher = isTeacherOrAdmin(req);

    const filter = { specKey, topicKey };
    if (isTeacher) {
      const isAdmin = (req.user?.userType || req.user?.role || "").toString().toLowerCase() === "admin" || req.user?.isAdmin;
      if (!isAdmin) {
        filter.userId = userId;
      }
    } else {
      filter.userId = userId;
      filter.role = "student";
      filter.allowExternal = false;
    }

    const query = TopicSummaryLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .select("_id specKey topicKey mode allowExternal createdAt response.confidenceLevel retrieval.sourceCounts")
      .lean();

    if (before) {
      query.where("createdAt").lt(before);
    }

    const docs = await query.exec();
    const hasMore = docs.length > limit;
    const items = (hasMore ? docs.slice(0, limit) : docs).map((d) => {
      const externalUsed = (d.retrieval?.sourceCounts?.external ?? 0) > 0;
      return {
        _id: d._id,
        specKey: d.specKey,
        topicKey: d.topicKey,
        mode: d.mode,
        allowExternal: d.allowExternal,
        externalUsed,
        confidenceLevel: d.response?.confidenceLevel || null,
        createdAt: d.createdAt,
      };
    });

    const oldestReturnedAt = items.length > 0 ? items[items.length - 1].createdAt : null;

    return res.json({
      items,
      pagination: {
        limit,
        hasMore,
        oldestReturnedAt,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[topicSummaryLogs] getLogs:", err);
    }
    return res.status(500).json({ error: "Failed to fetch logs" });
  }
}

/**
 * GET /api/topic-summary/logs/:id
 * Returns full saved response for re-opening modal.
 */
async function getTopicSummaryLogById(req, res) {
  try {
    if (!isTeacherOrAdmin(req) && !isStudent(req)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const mongoose = require("mongoose");
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid log id" });
    }

    const log = await TopicSummaryLog.findById(id).lean();
    if (!log) {
      return res.status(404).json({ error: "Topic summary not found" });
    }

    const userId = req.user?._id || req.user?.userId || req.user?.id;
    const logUserId = String(log.userId || "");
    const reqUserId = String(userId || "");
    const isTeacher = isTeacherOrAdmin(req);

    const canAccess =
      isTeacher
        ? logUserId === reqUserId || req.user?.isAdmin || (req.user?.userType || "").toString().toLowerCase() === "admin"
        : logUserId === reqUserId;

    if (!canAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (isStudent(req)) {
      if (!isAiTutorEnabledForSpec(log.specKey)) {
        return res.status(403).json({ error: "AI Tutor is not enabled for this course." });
      }
    }

    const usedSources = (log.retrieval?.usedSources || []).map((s) => ({
      knowledgeDocumentId: s.knowledgeDocumentId,
      sourceType: s.sourceType,
      sourceId: s.sourceId,
      title: s.title,
      topicKey: s.topicKey,
      score: s.score,
    }));

    const externalUsed = (log.retrieval?.sourceCounts?.external ?? 0) > 0;

    return res.json({
      _id: log._id,
      specKey: log.specKey,
      topicKey: log.topicKey,
      mode: log.mode,
      allowExternal: log.allowExternal,
      externalUsed,
      confidenceLevel: log.response?.confidenceLevel || null,
      confidenceReason: log.response?.confidenceReason || null,
      summary: {
        summary: log.response?.summary || "",
        keyPoints: log.response?.keyPoints || [],
        sections: log.response?.sections || {},
        citations: log.response?.citations || [],
        warnings: log.response?.warnings || [],
      },
      usedSources,
      topicSummaryLogId: String(log._id),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[topicSummaryLogs] getById:", err);
    }
    return res.status(500).json({ error: "Failed to fetch log" });
  }
}

module.exports = { getTopicSummaryLogs, getTopicSummaryLogById };
