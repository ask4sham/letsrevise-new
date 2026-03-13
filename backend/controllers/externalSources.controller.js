/**
 * PR-022: External source moderation — policies, recent, promote.
 * Teacher/admin only.
 */
const mongoose = require("mongoose");
const ExternalSourcePolicy = require("../models/ExternalSourcePolicy");
const ExternalSourceReview = require("../models/ExternalSourceReview");
const EnquiryLog = require("../models/EnquiryLog");
const KnowledgeDocument = require("../models/KnowledgeDocument");
const { upsertPolicy, normalizeDomain, normalizeUrl } = require("../services/externalSearch/policyService");
const { enqueueKnowledgeRefresh } = require("../services/jobs/enqueueKnowledgeRefresh");
const crypto = require("crypto");

function sha256(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex").slice(0, 32);
}

function getUserId(req) {
  return req.user?._id || req.user?.userId || req.user?.id;
}

function isTeacherOrAdmin(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user?.isAdmin === true;
}

/**
 * GET /api/external-sources/policies
 */
async function listPolicies(req, res) {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const { status, kind, q } = req.query || {};
    const query = {};
    if (status && ["allowed", "denied"].includes(String(status))) query.status = status;
    if (kind && ["url", "domain"].includes(String(kind))) query.kind = kind;
    if (q && String(q).trim()) {
      query.value = { $regex: String(q).trim().toLowerCase(), $options: "i" };
    }
    const items = await ExternalSourcePolicy.find(query)
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
    return res.json({ items });
  } catch (err) {
    console.error("[externalSources] listPolicies:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

/**
 * POST /api/external-sources/policies
 */
async function upsertPolicyHandler(req, res) {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const userId = getUserId(req);
    const { kind, value, status, reason } = req.body || {};
    if (!kind || !["url", "domain"].includes(String(kind))) {
      return res.status(400).json({ error: "kind must be 'url' or 'domain'" });
    }
    if (!value || typeof value !== "string" || !value.trim()) {
      return res.status(400).json({ error: "value is required" });
    }
    if (!status || !["allowed", "denied"].includes(String(status))) {
      return res.status(400).json({ error: "status must be 'allowed' or 'denied'" });
    }
    const policy = await upsertPolicy({ kind, value, status, reason, userId });
    return res.json(policy);
  } catch (err) {
    console.error("[externalSources] upsertPolicy:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

/**
 * DELETE /api/external-sources/policies/:id
 */
async function deletePolicy(req, res) {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Valid policy id required" });
    }
    const result = await ExternalSourcePolicy.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Policy not found" });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("[externalSources] deletePolicy:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

/**
 * GET /api/external-sources/recent
 */
async function listRecent(req, res) {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const { specKey, topicKey, limit = 50 } = req.query || {};
    const match = { externalUsed: true };
    if (specKey && String(specKey).trim()) match.specKey = String(specKey).trim();
    if (topicKey && String(topicKey).trim()) match.topicKey = String(topicKey).trim();

    const logs = await EnquiryLog.find(match)
      .sort({ createdAt: -1 })
      .limit(100)
      .select("_id question specKey topicKey externalSources createdAt")
      .lean();

    const seen = new Set();
    const rows = [];
    for (const log of logs) {
      const sources = log.externalSources || [];
      for (const s of sources) {
        const url = (s.url || "").trim() || (s.domain ? `https://${s.domain}` : "");
        const key = url || s.domain || "";
        if (!key || seen.has(key)) continue;
        seen.add(key);
        rows.push({
          enquiryLogId: log._id?.toString(),
          question: (log.question || "").slice(0, 100),
          specKey: log.specKey,
          topicKey: log.topicKey,
          url,
          domain: s.domain || normalizeDomain(url),
          title: (s.title || "").slice(0, 200),
          createdAt: log.createdAt,
        });
        if (rows.length >= parseInt(limit, 10) || rows.length >= 50) break;
      }
      if (rows.length >= 50) break;
    }
    return res.json({ items: rows });
  } catch (err) {
    console.error("[externalSources] listRecent:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

/**
 * POST /api/external-sources/promote
 */
async function promoteToTeacherNote(req, res) {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }
    const userId = getUserId(req);
    const isAdmin = (req.user?.userType || req.user?.role || "").toString().toLowerCase() === "admin";
    const { enquiryLogId, url, title, snippet, specKey, topicKey, noteTitle, noteText } = req.body || {};

    if (!enquiryLogId || !specKey || !topicKey) {
      return res.status(400).json({ error: "enquiryLogId, specKey, topicKey required" });
    }
    if (!mongoose.Types.ObjectId.isValid(enquiryLogId)) {
      return res.status(400).json({ error: "Invalid enquiryLogId" });
    }

    const log = await EnquiryLog.findById(enquiryLogId).lean();
    if (!log) return res.status(404).json({ error: "Enquiry not found" });
    const logUserId = String(log.userId || "");
    const reqUserId = String(userId || "");
    if (logUserId !== reqUserId && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to promote from this enquiry" });
    }

    let text = (noteText || snippet || "").trim();
    let docTitle = (noteTitle || title || `Teacher note — ${normalizeDomain(url || "")}`).trim();
    if (!text) {
      const extSource = (log.externalSources || []).find(
        (s) => (s.url || "").trim() === (url || "").trim() || (s.domain && url && url.includes(s.domain))
      );
      if (extSource) {
        const kd = await KnowledgeDocument.findOne({
          sourceType: "externalTrusted",
          specKey,
          topicKey,
          "metadata.url": url || extSource.url,
        }).lean();
        if (kd) text = (kd.text || "").slice(0, 2000);
      }
    }
    if (!text) text = (title || "").slice(0, 500) || "Teacher note";

    const sourceId = sha256(`${url || ""}|${docTitle}|${text}`);
    const contentHash = sha256(`${specKey}|${topicKey}|${sourceId}|${text}`);

    const existing = await KnowledgeDocument.findOne({
      sourceType: "teacherNote",
      specKey,
      topicKey,
      contentHash,
    }).lean();

    if (existing) {
      await ExternalSourceReview.create({
        enquiryLogId,
        specKey,
        topicKey,
        url: url || null,
        domain: normalizeDomain(url || ""),
        title: docTitle,
        decision: "promoted",
        note: "Already existed",
        decidedBy: userId,
      });
      return res.json({ teacherNoteKnowledgeDocumentId: existing._id?.toString(), created: false });
    }

    const doc = await KnowledgeDocument.create({
      sourceType: "teacherNote",
      sourceId,
      specKey,
      topicKey,
      title: docTitle,
      text,
      chunkIndex: 0,
      metadata: {
        url: url || null,
        domain: normalizeDomain(url || ""),
        promotedFrom: "externalTrusted",
        enquiryLogId,
        createdBy: userId,
      },
      contentHash,
    });

    await ExternalSourceReview.create({
      enquiryLogId,
      specKey,
      topicKey,
      url: url || null,
      domain: normalizeDomain(url || ""),
      title: docTitle,
      decision: "promoted",
      decidedBy: userId,
    });

    enqueueKnowledgeRefresh({
      specKey,
      topicKey,
      sourceTypes: ["teacherNote"],
      userId,
    }).catch((e) => console.error("[externalSources] enqueueKnowledgeRefresh:", e?.message));

    return res.json({ teacherNoteKnowledgeDocumentId: doc._id?.toString(), created: true });
  } catch (err) {
    console.error("[externalSources] promote:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

module.exports = {
  listPolicies,
  upsertPolicyHandler,
  deletePolicy,
  listRecent,
  promoteToTeacherNote,
};
