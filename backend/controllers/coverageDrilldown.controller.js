/**
 * PR-013: Coverage drill-down — missing spec, lessons, weak questions per topicKey.
 */
const mongoose = require("mongoose");
const SpecStatement = require("../models/SpecStatement");
const KnowledgeDocument = require("../models/KnowledgeDocument");
const Lesson = require("../models/Lesson");
const EnquiryLog = require("../models/EnquiryLog");
const { normalizeSpecKey } = require("../config/featureFlags");

function getSpecVariants(specKey) {
  const normalized = normalizeSpecKey(specKey);
  const withUnderscores = normalized.replace(/-/g, "_");
  return [...new Set([normalized, withUnderscores])];
}

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

/**
 * GET /api/coverage/drilldown?specKey=...&topicKey=...&windowDays=14
 */
async function getDrilldown(req, res) {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }

  const specKey = req.query.specKey?.trim();
  const topicKey = req.query.topicKey?.trim();
  const windowDays = Math.min(90, Math.max(1, parseInt(req.query.windowDays, 10) || 14));

  if (!specKey || !topicKey) {
    return res.status(400).json({ error: "specKey and topicKey are required" });
  }

  const specVariants = getSpecVariants(specKey);
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  try {
    // 1) Spec coverage — all SpecStatements, find which have KnowledgeDocuments
    const specStatements = await SpecStatement.find({
      specKey: { $in: specVariants },
      topicKey,
    }).lean();

    const coveredCodes = await KnowledgeDocument.distinct("metadata.statementCode", {
      sourceType: "specStatement",
      specKey: { $in: specVariants },
      topicKey,
      "metadata.statementCode": { $exists: true, $ne: "" },
    });

    const coveredSet = new Set(coveredCodes.map((c) => String(c).trim()).filter(Boolean));
    const indexedCount = coveredSet.size;
    const missing = specStatements
      .filter((s) => !coveredSet.has(String(s.statementCode || "").trim()))
      .map((s) => ({
        _id: s._id?.toString(),
        statementCode: s.statementCode,
        statementText: s.statementText,
        tier: s.tier || null,
        tags: s.tags || [],
      }));

    // 2) Lesson contributions — KD with sourceType=lessonBlock, group by lessonId
    const kdByLesson = await KnowledgeDocument.aggregate([
      {
        $match: {
          sourceType: "lessonBlock",
          specKey: { $in: specVariants },
          topicKey,
        },
      },
      {
        $group: {
          _id: "$metadata.lessonId",
          knowledgeDocs: { $sum: 1 },
        },
      },
    ]);

    const lessonIds = kdByLesson
      .map((r) => r._id)
      .filter(Boolean)
      .map((id) => (typeof id === "string" ? id : String(id)))
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    const lessons = await Lesson.find({ _id: { $in: lessonIds } })
      .select("_id title updatedAt")
      .lean();

    const lessonMap = new Map(lessons.map((l) => [String(l._id), l]));
    const lessonsResult = kdByLesson
      .map((r) => {
        const lid = r._id ? String(r._id) : null;
        const lesson = lid ? lessonMap.get(lid) : null;
        return {
          lessonId: lid,
          title: lesson?.title || "Untitled",
          knowledgeDocs: r.knowledgeDocs,
          lastUpdated: lesson?.updatedAt ? lesson.updatedAt.toISOString() : null,
          links: {
            student: `/lesson/${lid}`,
            edit: `/edit-lesson/${lid}`,
          },
        };
      })
      .filter((r) => r.lessonId)
      .sort((a, b) => {
        const da = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
        const db = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
        return db - da;
      });

    // 3) Weak questions — EnquiryLog with Insufficient trusted sources
    const weakLogs = await EnquiryLog.find({
      specKey: { $in: specVariants },
      topicKey,
      createdAt: { $gte: since },
      "response.warnings": "Insufficient trusted sources",
    })
      .select("question")
      .lean();

    const questionCounts = {};
    for (const log of weakLogs) {
      const q = String(log.question || "").trim().slice(0, 500);
      if (q) {
        questionCounts[q] = (questionCounts[q] || 0) + 1;
      }
    }

    const totalWeak = weakLogs.length;
    const weakQuestions = Object.entries(questionCounts)
      .map(([question, count]) => ({ question, enquiries: count }))
      .sort((a, b) => b.enquiries - a.enquiries)
      .slice(0, 20);

    const normalized = normalizeSpecKey(specKey);
    res.json({
      specKey: normalized,
      topicKey,
      computedAt: new Date().toISOString(),
      specStatements: {
        total: specStatements.length,
        indexed: indexedCount,
        missing,
      },
      lessons: lessonsResult,
      weakQuestions,
    });
  } catch (err) {
    console.error("[coverageDrilldown] Error:", err);
    res.status(500).json({ error: err.message || "Failed to load drill-down" });
  }
}

module.exports = { getDrilldown };
