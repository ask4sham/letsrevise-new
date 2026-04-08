// backend/routes/admin.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const path = require("path");
const { exec } = require("child_process");

const User = require("../models/User");
const Lesson = require("../models/Lesson");
const LessonUnlock = require("../models/LessonUnlock");
const { auditAdminAction } = require("../utils/auditAdminAction");
const Event = require("../models/Event");
const auth = require("../middleware/auth");
const { isSubscriptionActive } = require("../utils/isSubscriptionActive");
const {
  normalizeSubscriptionV2,
  isEntitledSubscriptionV2,
} = require("../contracts/subscriptionV2");
// AI Generation Jobs admin/public routers (structural mounts only; minimal handlers; groundwork phase)
const adminAiGenerationJobs = require("./adminAiGenerationJobs");
const aiGenerationJobs = require("./aiGenerationJobs");

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
  const userType = (req.user?.userType || req.user?.type || "").toString().toLowerCase();
  if (!req.user || userType !== "admin") {
    return res.status(403).json({ msg: "Admin access required" });
  }
  next();
};

// Admin OR content_manager (for lesson/taxonomy/content routes only)
const requireContentManager = require("../middleware/requireContentManager");

/* =========================================
   PR-015: GET /api/admin/jobs — list background jobs (admin only)
   Query: ?type=KNOWLEDGE_REFRESH&status=queued&limit=20
   ========================================= */
const BackgroundJob = require("../models/BackgroundJob");
router.get("/jobs", auth, checkAdmin, async (req, res) => {
  try {
    const { type, status, limit } = req.query || {};
    const query = {};
    if (type) query.type = String(type).trim();
    if (status) query.status = String(status).trim();
    const lim = Math.min(parseInt(limit, 10) || 20, 100);
    const jobs = await BackgroundJob.find(query).sort({ createdAt: -1 }).limit(lim).lean();
    return res.json({ jobs });
  } catch (err) {
    console.error("GET /api/admin/jobs error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

/* =========================================
   PR-015: POST /api/admin/jobs/enqueue-knowledge-refresh — manual enqueue (admin only)
   Body: { specKey, topicKey? }
   ========================================= */
router.post("/jobs/enqueue-knowledge-refresh", auth, checkAdmin, async (req, res) => {
  try {
    const { specKey, topicKey } = req.body || {};
    const sk = specKey ? String(specKey).trim() : null;
    if (!sk) return res.status(400).json({ msg: "specKey required" });
    const { enqueueKnowledgeRefresh } = require("../services/jobs/enqueueKnowledgeRefresh");
    const job = await enqueueKnowledgeRefresh({
      specKey: sk,
      topicKey: topicKey ? String(topicKey).trim() : null,
      sourceTypes: ["lessonBlock", "specStatement"],
      userId: req.user?._id,
    });
    return res.json({ ok: true, job: job ? { _id: job._id, status: job.status, specKey: job.specKey, topicKey: job.topicKey } : null });
  } catch (err) {
    console.error("POST /api/admin/jobs/enqueue-knowledge-refresh error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

/* =========================================
   POST /api/admin/seed-question-bank
   Admin-only. Runs AQA GCSE Biology question seed (all units) in background.
   Idempotent: existing topics are skipped. Teachers never need to run CLI seeds.
   ========================================= */
router.post("/seed-question-bank", auth, checkAdmin, async (req, res) => {
  const backendDir = path.join(__dirname, "..");
  const scriptPath = path.join(backendDir, "scripts", "aqa_gcse_biology", "seed_all.js");
  exec(
    `node "${scriptPath}"`,
    { cwd: backendDir, env: process.env },
    (err, stdout, stderr) => {
      if (err) {
        console.error("[admin/seed-question-bank] error:", err);
        console.error("[admin/seed-question-bank] stderr:", stderr);
      }
      if (stdout) console.log("[admin/seed-question-bank] stdout:", stdout);
    }
  );
  return res.status(202).json({
    ok: true,
    message: "Question bank seed started in the background. Refresh the Worksheet Builder in a minute.",
  });
});

// Helper: determine lesson status even if schema doesn't have `status`
function getLessonStatus(lesson) {
  if (lesson && typeof lesson.status === "string" && lesson.status.trim()) return lesson.status;
  return lesson?.isPublished ? "published" : "draft";
}

// Helper: build query for status filter safely (works even if `status` isn't in schema)
function applyStatusFilter(query, status) {
  if (!status) return;

  const s = String(status).toLowerCase().trim();

  if (s === "published") {
    query.$or = [{ status: "published" }, { isPublished: true }];
    return;
  }

  if (s === "draft") {
    query.$or = [{ status: "draft" }, { isPublished: false, status: { $exists: false } }];
    return;
  }

  if (["archived", "flagged"].includes(s)) {
    query.status = s;
  }
}

// Helper: whitelist lesson fields an admin is allowed to update safely
function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/* =========================================
   POST /api/admin/grant-lesson-unlock
   Idempotent; admin-only. Body: { userId, lessonId, source? } (source defaults to "admin").
   ========================================= */
router.post("/grant-lesson-unlock", auth, requireContentManager, async (req, res) => {
  try {
    const { userId, lessonId, source = "admin" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Invalid userId or lessonId" });
    }

    const unlock = await LessonUnlock.findOneAndUpdate(
      { userId, lessonId },
      { userId, lessonId, source },
      { upsert: true, new: true }
    );

    return res.json({ ok: true, unlock });
  } catch (err) {
    if (err.code === 11000) {
      return res.json({ ok: true, duplicate: true });
    }
    console.error("grant-lesson-unlock error:", err);
    return res.status(500).json({ error: "Failed to grant lesson unlock" });
  }
});

/* =========================================
   DELETE /api/admin/revoke-lesson-unlock
   Body: { userId, lessonId }. Admin-only. Reversible grant.
   ========================================= */
router.delete("/revoke-lesson-unlock", auth, requireContentManager, async (req, res) => {
  try {
    const { userId, lessonId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Invalid userId or lessonId" });
    }

    const result = await LessonUnlock.deleteOne({ userId, lessonId });

    return res.json({ ok: true, deleted: result.deletedCount === 1 });
  } catch (err) {
    console.error("revoke-lesson-unlock error:", err);
    return res.status(500).json({ error: "Failed to revoke lesson unlock" });
  }
});

/* =========================================
   GET /api/admin/user/:id/unlocks
   Count + recent unlocks for a user (support / auditing).
   ========================================= */
router.get("/user/:id/unlocks", auth, requireContentManager, async (req, res) => {
  try {
    const userId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const [count, recent] = await Promise.all([
      LessonUnlock.countDocuments({ userId }),
      LessonUnlock.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .select("lessonId source createdAt")
        .lean(),
    ]);

    return res.json({ ok: true, userId, count, recent });
  } catch (err) {
    console.error("GET /api/admin/user/:id/unlocks error:", err);
    return res.status(500).json({ error: "Failed to load user unlocks" });
  }
});

/* =========================================
   GET /api/admin/lesson/:id/unlocks
   Count + recent users who unlocked this lesson (support / auditing).
   ========================================= */
router.get("/lesson/:id/unlocks", auth, requireContentManager, async (req, res) => {
  try {
    const lessonId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Invalid lessonId" });
    }

    const [count, recent] = await Promise.all([
      LessonUnlock.countDocuments({ lessonId }),
      LessonUnlock.find({ lessonId })
        .sort({ createdAt: -1 })
        .limit(50)
        .select("userId source createdAt")
        .lean(),
    ]);

    return res.json({ ok: true, lessonId, count, recent });
  } catch (err) {
    console.error("GET /api/admin/lesson/:id/unlocks error:", err);
    return res.status(500).json({ error: "Failed to load lesson unlocks" });
  }
});

// ---------- Paywall conversion metrics (helpers) ----------
function parseDays(value, fallback = 7) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), 90);
}

function startDateFromDays(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/* =========================================
   GET /api/admin/metrics/conversion?days=7
   Counts + daily breakdown for paywall / preview / CTA
   ========================================= */
router.get("/metrics/conversion", auth, checkAdmin, async (req, res) => {
  try {
    const days = parseDays(req.query.days, 7);
    const since = startDateFromDays(days);

    const types = ["PAYWALL_NOT_ENTITLED", "FREE_PREVIEW_VIEW", "SUBSCRIBE_CTA_CLICK"];

    const totalsAgg = await Event.aggregate([
      { $match: { createdAt: { $gte: since }, type: { $in: types } } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);

    const totals = types.reduce((acc, t) => {
      acc[t] = 0;
      return acc;
    }, {});

    for (const row of totalsAgg) totals[row._id] = row.count;

    const dailyAgg = await Event.aggregate([
      { $match: { createdAt: { $gte: since }, type: { $in: types } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            type: "$type",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.day": 1 } },
    ]);

    const byDay = new Map();
    for (const row of dailyAgg) {
      const day = row._id.day;
      if (!byDay.has(day)) {
        byDay.set(day, {
          day,
          PAYWALL_NOT_ENTITLED: 0,
          FREE_PREVIEW_VIEW: 0,
          SUBSCRIBE_CTA_CLICK: 0,
        });
      }
      byDay.get(day)[row._id.type] = row.count;
    }

    // Derived: paywall → CTA click-through; preview → CTA (optional). null when denominator is 0.
    const paywallHits = totals.PAYWALL_NOT_ENTITLED || 0;
    const previewViews = totals.FREE_PREVIEW_VIEW || 0;
    const ctaClicks = totals.SUBSCRIBE_CTA_CLICK || 0;
    const ctr = paywallHits > 0 ? Number((ctaClicks / paywallHits).toFixed(4)) : null;
    const previewToClick = previewViews > 0 ? Number((ctaClicks / previewViews).toFixed(4)) : null;

    return res.json({
      ok: true,
      days,
      since,
      totals,
      ctr,
      previewToClick,
      daily: Array.from(byDay.values()),
    });
  } catch (err) {
    console.error("GET /api/admin/metrics/conversion error:", err);
    return res.status(500).json({ error: "Failed to load conversion metrics" });
  }
});

/* =========================================
   GET /api/admin/metrics/top-paywalled-lessons?days=7&limit=20
   Top lessons by PAYWALL_NOT_ENTITLED count
   ========================================= */
router.get("/metrics/top-paywalled-lessons", auth, checkAdmin, async (req, res) => {
  try {
    const days = parseDays(req.query.days, 7);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const since = startDateFromDays(days);

    const rows = await Event.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          type: "PAYWALL_NOT_ENTITLED",
          lessonId: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: "$lessonId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "lessons",
          localField: "_id",
          foreignField: "_id",
          as: "lessonDoc",
        },
      },
    ]);

    return res.json({
      ok: true,
      days,
      since,
      limit,
      lessons: rows.map((r) => ({
        lessonId: r._id,
        count: r.count,
        title: r.lessonDoc?.[0]?.title ?? null,
        isFreePreview: r.lessonDoc?.[0]?.isFreePreview ?? null,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/metrics/top-paywalled-lessons error:", err);
    return res.status(500).json({ error: "Failed to load top paywalled lessons" });
  }
});

/* =========================================
   GET /api/admin/metrics/top-paywalled-lessons-without-preview?days=7&limit=20
   Top paywalled lessons where isFreePreview !== true (suggest enabling preview)
   ========================================= */
router.get("/metrics/top-paywalled-lessons-without-preview", auth, checkAdmin, async (req, res) => {
  try {
    const days = parseDays(req.query.days, 7);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const since = startDateFromDays(days);

    const rows = await Event.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          type: "PAYWALL_NOT_ENTITLED",
          lessonId: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: "$lessonId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit * 2 },
      {
        $lookup: {
          from: "lessons",
          localField: "_id",
          foreignField: "_id",
          as: "lessonDoc",
        },
      },
    ]);

    const lessons = rows
      .filter((r) => r.lessonDoc?.[0] && r.lessonDoc[0].isFreePreview !== true)
      .slice(0, limit)
      .map((r) => ({
        lessonId: r._id,
        count: r.count,
        title: r.lessonDoc?.[0]?.title ?? null,
        isFreePreview: r.lessonDoc?.[0]?.isFreePreview ?? false,
      }));

    return res.json({
      ok: true,
      days,
      since,
      limit,
      lessons,
    });
  } catch (err) {
    console.error("GET /api/admin/metrics/top-paywalled-lessons-without-preview error:", err);
    return res.status(500).json({ error: "Failed to load suggested previews" });
  }
});

/* =========================================
   GET /api/admin/audit-log
   Admin-only. List recent audit log entries.
   ========================================= */
const AdminAuditLog = require("../models/AdminAuditLog");
router.get("/audit-log", auth, checkAdmin, async (req, res) => {
  try {
    const { limit = 50, action } = req.query;
    const lim = Math.min(parseInt(limit, 10) || 50, 200);
    const query = {};
    if (action) query.action = String(action).trim();

    const logs = await AdminAuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(lim)
      .lean();

    return res.json({ success: true, logs });
  } catch (err) {
    console.error("GET audit-log error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/admin/stats
   ========================================= */
router.get("/stats", auth, checkAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalTeachers = await User.countDocuments({ userType: "teacher" });
    const totalStudents = await User.countDocuments({ userType: "student" });
    const totalLessons = await Lesson.countDocuments();

    const totalPurchasesAgg = await User.aggregate([
      { $unwind: "$purchasedLessons" },
      { $group: { _id: null, total: { $sum: 1 } } },
    ]);
    const totalPurchases = totalPurchasesAgg?.[0]?.total || 0;

    const revenueStats = await User.aggregate([
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.type": { $in: ["purchase", "subscription"] },
          "transactions.status": "completed",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$transactions.amount" },
          todayRevenue: {
            $sum: {
              $cond: [
                { $gte: ["$transactions.date", new Date(new Date().setHours(0, 0, 0, 0))] },
                "$transactions.amount",
                0,
              ],
            },
          },
          monthlyRevenue: {
            $sum: {
              $cond: [
                { $gte: ["$transactions.date", new Date(new Date().setDate(new Date().getDate() - 30))] },
                "$transactions.amount",
                0,
              ],
            },
          },
        },
      },
    ]);

    const lessonStats = await Lesson.aggregate([
      {
        $group: {
          _id: null,
          totalViews: { $sum: "$views" },
          averageRating: { $avg: "$averageRating" },
        },
      },
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const subscriptionStats = await User.aggregate([
      {
        $group: {
          _id: "$subscription",
          count: { $sum: 1 },
          totalShamCoins: { $sum: "$shamCoins" },
        },
      },
    ]);

    const subsMap = subscriptionStats.reduce((acc, stat) => {
      acc[stat._id] = { count: stat.count, totalShamCoins: stat.totalShamCoins };
      return acc;
    }, {});

    const totalShamCoins = subscriptionStats.reduce(
      (sum, stat) => sum + (stat.totalShamCoins || 0),
      0
    );

    const activeUsers = await User.countDocuments({
      $or: [
        { "studentStats.lastActiveDate": { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) } },
        { updatedAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) } },
      ],
    });

    res.json({
      success: true,
      stats: {
        users: { total: totalUsers, teachers: totalTeachers, students: totalStudents, growth: userGrowth },
        lessons: {
          total: totalLessons,
          totalViews: lessonStats?.[0]?.totalViews || 0,
          averageRating: lessonStats?.[0]?.averageRating || 0,
          totalPurchases,
          platformEarnings: 0,
        },
        revenue: {
          total: revenueStats?.[0]?.totalRevenue || 0,
          today: revenueStats?.[0]?.todayRevenue || 0,
          monthly: revenueStats?.[0]?.monthlyRevenue || 0,
        },
        subscriptions: subsMap,
        platform: { totalShamCoins, activeUsers },
      },
    });
  } catch (err) {
    console.error("Get admin stats error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/admin/revision-metrics   Phase 10.1
   Read-only: attempts, COMPLETED/STUB counts, errorCode distribution, lastCompletedAt.
   ========================================= */
router.get("/revision-metrics", auth, checkAdmin, (req, res) => {
  try {
    const revisionMetrics = require("../services/revisionMetrics");
    res.json({ success: true, metrics: revisionMetrics.getSnapshot() });
  } catch (err) {
    console.error("Get revision metrics error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/admin/revision-alerts   Phase 10.2
   Returns { ok, alerts } for polling by alerting systems. Maps to errorCodes only.
   ========================================= */
router.get("/revision-alerts", auth, checkAdmin, (req, res) => {
  try {
    const revisionMetrics = require("../services/revisionMetrics");
    const result = revisionMetrics.evaluateAlerts({
      recentN: 100,
      spawnFailedThreshold: 5,
      openaiFailedThreshold: 15,
      zeroCompletedHours: 4,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Get revision alerts error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// Mount placeholder admin AI generation jobs router (no routes yet)
router.use("/ai-generation-jobs", adminAiGenerationJobs);

// Mount public (non-admin) AI generation jobs router for visibility parity (no routes yet)
router.use("/ai-generation-jobs/public", aiGenerationJobs);

/* =========================================
   GET /api/admin/user-types   ✅ new (helps UI dropdown include parent)
   ========================================= */
router.get("/user-types", auth, checkAdmin, async (req, res) => {
  return res.json({
    success: true,
    userTypes: ["student", "teacher", "parent", "admin"],
  });
});

/** Entitlement summary for admin users list (read-only; derived from subscriptionV2). */
function getEntitlementSummary(user) {
  const sub = user.subscriptionV2;
  if (!sub || !sub.status) return { label: "None", state: "none" };

  const expiresAt = sub.expiresAt ? new Date(sub.expiresAt) : null;
  const isExpired = expiresAt && expiresAt < new Date();

  if (isExpired) {
    return { label: `Expired (${expiresAt.toLocaleDateString()})`, state: "expired" };
  }

  if (sub.status === "trialing") {
    return { label: `Trial (expires ${expiresAt ? expiresAt.toLocaleDateString() : "—"})`, state: "active" };
  }

  if (sub.status === "active") {
    return { label: "Active", state: "active" };
  }

  return { label: sub.status, state: "unknown" };
}

/* =========================================
   GET /api/admin/users
   ========================================= */
router.get("/users", auth, checkAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      userType,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      includeDeleted,
      deletedOnly,
    } = req.query;

    const query = {};

    if (String(deletedOnly) === "true") {
      query.isDeleted = true;
    } else if (String(includeDeleted) !== "true") {
      query.isDeleted = { $ne: true };
    }

    // ✅ includes parent (backend already supported; keeping explicit)
    if (userType && ["teacher", "student", "admin", "parent"].includes(String(userType))) {
      query.userType = String(userType);
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const users = await User.find(query)
      .select("-password")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalUsers = await User.countDocuments(query);

    res.json({
      success: true,
      users: users.map((u) => ({
        id: u._id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        userType: u.userType,
        staffRole: u.staffRole || null,
        verificationStatus: u.verificationStatus,
        shamCoins: u.shamCoins,
        subscription: u.subscription,
        createdAt: u.createdAt,
        lastActive: u.userType === "student" ? u.studentStats?.lastActiveDate : u.updatedAt,
        stats: u.userType === "teacher" ? u.teacherStats : u.studentStats,
        entitlementSummary: getEntitlementSummary(u),
        isDeleted: !!u.isDeleted,
        deletedAt: u.deletedAt || null,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalUsers,
        pages: Math.ceil(totalUsers / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/admin/users/:userId
   ========================================= */
router.get("/users/:userId", auth, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: "Invalid user id" });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });

    return res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        verificationStatus: user.verificationStatus,
        verificationNotes: user.verificationNotes,
        shamCoins: user.shamCoins,
        subscription: user.subscription,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        isDeleted: !!user.isDeleted,
        deletedAt: user.deletedAt || null,
        deletedBy: user.deletedBy || null,
        deleteReason: user.deleteReason || null,
      },
    });
  } catch (err) {
    console.error("Get user detail error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/admin/users/:userId/entitlements-debug
   Diagnose why a user sees Locked: what the backend sees for subscriptionV2.
   ========================================= */
router.get("/users/:userId/entitlements-debug", auth, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: "Invalid user id" });
    }
    const user = await User.findById(userId)
      .select("subscriptionV2 subscription subscriptionV2Snapshot purchasedLessons")
      .lean();
    if (!user) return res.status(404).json({ msg: "User not found" });

    const raw = user.subscriptionV2 || null;
    const normalized = normalizeSubscriptionV2(
      user.subscriptionV2 || user.subscription || user.subscriptionV2Snapshot
    );
    const wouldBeEntitled = isEntitledSubscriptionV2(normalized);

    return res.json({
      success: true,
      userId: String(user._id),
      subscriptionV2FromDb: raw,
      subscriptionLegacy: user.subscription ?? null,
      subscriptionV2Snapshot: user.subscriptionV2Snapshot ?? null,
      purchasedLessonsCount: Array.isArray(user.purchasedLessons) ? user.purchasedLessons.length : 0,
      normalizedSubscriptionV2: normalized,
      wouldBeEntitled,
      hint: wouldBeEntitled
        ? "Backend will grant access; if UI still shows Locked, check lesson status (published) and frontend."
        : "Backend denies access. Re-grant 7-day pass (POST /api/admin/subscription/grant) then check again.",
    });
  } catch (err) {
    console.error("Entitlements debug error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   POST /api/admin/users/:userId/restore
   ========================================= */
router.post("/users/:userId/restore", auth, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: "Invalid user id" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });
    if (user.isDeleted !== true) {
      return res.status(400).json({ msg: "User is not deleted" });
    }

    user.isDeleted = false;
    user.deletedAt = null;
    user.deletedBy = null;
    user.deleteReason = null;
    await user.save();

    const summary = { id: String(user._id), email: user.email, userType: user.userType };
    auditAdminAction({
      action: "user_restore",
      actorId: req.user._id || req.user.id,
      actorEmail: req.user.email,
      targetType: "User",
      targetId: userId,
      details: summary,
      ip: req.ip || req.connection?.remoteAddress,
    });

    console.log("♻️ [Admin] Restored user:", summary, "by admin:", req.user.email);
    return res.json({ success: true, msg: "User restored", user: summary });
  } catch (err) {
    console.error("Admin restore user error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   DELETE /api/admin/users/:userId
   Soft-delete only — keeps User row so Lesson.teacherId and refs stay valid.
   ========================================= */
router.delete("/users/:userId", auth, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: "Invalid user id" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });
    if (user.isDeleted === true) {
      return res.status(400).json({ msg: "User is already deleted" });
    }

    // Optional safety: prevent deleting yourself
    const requesterId = req.user?._id || req.user?.id;
    if (String(user._id) === String(requesterId)) {
      return res.status(400).json({ msg: "You cannot delete your own admin account" });
    }

    const reason = (req.body && typeof req.body.reason === "string" ? req.body.reason : "").trim() || null;

    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletedBy = requesterId || null;
    user.deleteReason = reason;
    await user.save();

    const summary = {
      id: String(user._id),
      email: user.email,
      userType: user.userType,
      softDelete: true,
    };

    auditAdminAction({
      action: "user_soft_delete",
      actorId: req.user._id || req.user.id,
      actorEmail: req.user.email,
      targetType: "User",
      targetId: userId,
      details: summary,
      ip: req.ip || req.connection?.remoteAddress,
    });

    console.log("🧹 [Admin] Soft-deleted user:", summary, "by admin:", req.user.email);

    return res.json({ success: true, msg: "User deactivated (lessons and links preserved)", deleted: summary });
  } catch (err) {
    console.error("Admin delete user error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/admin/lessons
   ========================================= */
router.get("/lessons", auth, requireContentManager, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, subject, search, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const query = {
      isTemplate: { $ne: true }, // ✅ EXCLUDE master templates from lessons list
    };

    applyStatusFilter(query, status);
    if (subject) query.subject = subject;

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const lessons = await Lesson.find(query)
      .select("_id title subject level status isPublished teacherId shamCoinPrice views purchases averageRating createdAt isFreePreview")
      .populate("teacherId", "firstName lastName email")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalLessons = await Lesson.countDocuments(query);

    res.json({
      success: true,
      lessons: lessons.map((lesson) => {
        const statusResolved = getLessonStatus(lesson);

        const purchases = lesson.purchases || 0;
        const price = lesson.shamCoinPrice || 0;

        return {
          id: lesson._id,
          title: lesson.title,
          subject: lesson.subject,
          level: lesson.level,
          status: statusResolved,
          shamCoinPrice: price,
          views: lesson.views || 0,
          purchases,
          averageRating: lesson.averageRating || 0,
          createdAt: lesson.createdAt,
          isFreePreview: !!lesson.isFreePreview,
          teacher: lesson.teacherId
            ? {
                id: lesson.teacherId._id,
                name: `${lesson.teacherId.firstName} ${lesson.teacherId.lastName}`.trim(),
                email: lesson.teacherId.email,
              }
            : null,
          revenue: {
            total: purchases * price,
            platform: purchases * price * 0.3,
            teacher: purchases * price * 0.7,
          },
        };
      }),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalLessons,
        pages: Math.ceil(totalLessons / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error("Get lessons error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/admin/templates
   (admin-only list of MASTER templates)
   ========================================= */
router.get("/templates", auth, requireContentManager, async (req, res) => {
  try {
    const templates = await Lesson.find({ isTemplate: true })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({ success: true, templates });
  } catch (err) {
    console.error("Get admin templates error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/admin/template-clones
   (admin-only list of template clones for monitoring)
   ========================================= */
router.get("/template-clones", auth, requireContentManager, async (req, res) => {
  try {
    const clones = await Lesson.find({
      createdFromTemplate: true,
      isTemplate: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({ success: true, clones });
  } catch (err) {
    console.error("Get admin template clones error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/admin/lessons/:lessonId
   (returns FULL lesson incl. pages/blocks)
   ========================================= */
router.get("/lessons/:lessonId", auth, requireContentManager, async (req, res) => {
  try {
    const { lessonId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }

    const lesson = await Lesson.findById(lessonId).populate("teacherId", "firstName lastName email");
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });

    const obj = lesson.toObject();
    // Ensure isFreePreview is always present so editor and SS2 stay in sync
    if (!Object.prototype.hasOwnProperty.call(obj, "isFreePreview")) {
      obj.isFreePreview = !!lesson.isFreePreview;
    }

    return res.json({
      success: true,
      lesson: {
        ...obj,
        status: getLessonStatus(lesson),
      },
    });
  } catch (err) {
    console.error("Admin get lesson detail error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   PUT /api/admin/lessons/:lessonId   ✅ new
   (admin can edit lesson using same payload shape as teacher editor)
   - does NOT break teacher routes
   - safe whitelist so random fields don't get written
   ========================================= */
router.put("/lessons/:lessonId", auth, requireContentManager, async (req, res) => {
  try {
    const { lessonId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });

    // Allow same core fields teacher editor uses (PR0: accept examBoard or board, store as board)
    const allowed = [
      "title",
      "description",
      "content",
      "subject",
      "level",
      "topic",
      "tags",
      "estimatedDuration",
      "shamCoinPrice",
      "isFreePreview",
      "resources",
      "board",
      "examBoard",
      "tier",
      "uploadedImages",
      "pages",
      "teacherName",
      "isPublished",
      "status",
      "adminNotes",
      "isTemplate", // Allow admin to see/update this field
      "createdFromTemplate", // Allow admin to see/update this field
      "templateSource", // Allow admin to see/update this field
    ];

    const updates = pick(req.body || {}, allowed);

    // PR0: store examBoard as board
    if (updates.examBoard !== undefined) {
      updates.board = updates.examBoard;
      delete updates.examBoard;
    }

    // Coerce isFreePreview so string "true"/"false" from JSON is safe
    if (Object.prototype.hasOwnProperty.call(updates, "isFreePreview")) {
      updates.isFreePreview = updates.isFreePreview === true || updates.isFreePreview === "true";
    }

    // Basic validation to avoid corrupting pages accidentally
    if (Object.prototype.hasOwnProperty.call(updates, "pages")) {
      if (!Array.isArray(updates.pages)) {
        return res.status(400).json({ msg: "pages must be an array" });
      }
    }

    // If status provided, keep isPublished aligned (same logic as status endpoint)
    if (typeof updates.status === "string" && updates.status) {
      const s = String(updates.status).toLowerCase();
      if (!["published", "draft", "archived", "flagged"].includes(s)) {
        return res.status(400).json({ msg: "Invalid status" });
      }
      updates.status = s;
      if (s === "published") updates.isPublished = true;
      if (["draft", "archived", "flagged"].includes(s)) updates.isPublished = false;
    }

    let publishWarningSummary = null;
    let publishValidationMode = null;
    let publishQualityScore = null;

    if (updates.isPublished === true || updates.status === "published") {
      const {
        validateLessonStructureForPublish,
        buildPublishWarningSummary,
        mergeStructureValidationForScoring,
      } = require("../services/lessonDraftValidation");
      const { checkPublishGateForGenerated } = require("../middleware/requirePublishGateIfGenerated");
      const { scoreLessonQuality } = require("../lib/lessonQualityScoring");
      /** Validate the lesson *after* applying updates (same snapshot teacher publish will see once saved). */
      const base = lesson.toObject ? lesson.toObject() : { ...lesson._doc, metadata: lesson.metadata };
      const lessonObj = { ...base, ...updates };
      const gate = await checkPublishGateForGenerated(lessonObj, req.user);
      if (!gate.ok) {
        return res.status(400).json({ success: false, msg: "Fix issues first", issues: gate.issues, blocks: gate.blocks });
      }
      const structureValidation = validateLessonStructureForPublish(lessonObj);
      publishValidationMode = structureValidation.mode;
      const structureIssues = mergeStructureValidationForScoring(structureValidation);
      const qualityResult = scoreLessonQuality(lessonObj, { structureIssues, source: "manual" });
      publishQualityScore = qualityResult.score;

      if (structureValidation.blocking.length > 0) {
        return res.status(400).json({
          success: false,
          error: "Lesson failed structure validation",
          msg: "Lesson failed structure validation",
          structureIssues: structureValidation.blocking,
          structureWarnings: structureValidation.warnings,
          publishValidationMode: structureValidation.mode,
        });
      }

      if (structureValidation.mode === "manual_teacher") {
        publishWarningSummary = buildPublishWarningSummary(structureValidation, qualityResult);
      } else if (qualityResult.score < 70) {
        return res.status(400).json({
          success: false,
          error: "Lesson quality too low to publish",
          msg: "Lesson quality too low to publish",
          score: qualityResult.score,
          band: qualityResult.band,
          topIssues: (qualityResult.issues || []).slice(0, 10),
          topSuggestions: (qualityResult.suggestions || []).slice(0, 10),
          qualityResult,
          publishValidationMode: structureValidation.mode,
        });
      }
    }

    // Prevent writing weird non-objects
    for (const [k, v] of Object.entries(updates)) {
      if (k === "resources" || k === "uploadedImages" || k === "tags" || k === "pages") continue;
      // allow primitives / null
      if (typeof v === "function") {
        return res.status(400).json({ msg: `Invalid field: ${k}` });
      }
    }

    Object.assign(lesson, updates);

    // Step 16: Populate quality metadata on save
    const {
      validateLessonStructure: validateStructure,
      mergeStructureValidationForScoring: mergeStructureForQuality,
    } = require("../services/lessonDraftValidation");
    const lessonObjForQuality = lesson.toObject ? lesson.toObject() : { ...lesson._doc };
    const structureIssuesForQuality = mergeStructureForQuality(
      validateStructure(lessonObjForQuality, { isManual: true })
    );
    const qualityResultForSave = require("../lib/lessonQualityScoring").scoreLessonQuality(
      lessonObjForQuality,
      { structureIssues: structureIssuesForQuality, source: "manual" }
    );
    lesson.qualityScore = qualityResultForSave.score;
    lesson.qualityBand = qualityResultForSave.band;
    lesson.qualityCategories = qualityResultForSave.categories;
    lesson.qualityIssues = qualityResultForSave.issues?.length ? qualityResultForSave.issues : undefined;

    await lesson.save();

    // PR-015: Enqueue knowledge refresh when publishing (async, non-blocking)
    if ((updates.isPublished === true || updates.status === "published") && lesson.topicKey) {
      const specKey = String(lesson.topicKey).split(":")[0];
      if (specKey) {
        const { enqueueKnowledgeRefresh } = require("../services/jobs/enqueueKnowledgeRefresh");
        enqueueKnowledgeRefresh({
          specKey,
          topicKey: lesson.topicKey,
          sourceTypes: ["lessonBlock"],
          userId: req.user?._id,
        }).catch((e) => console.error("[admin] enqueueKnowledgeRefresh error:", e?.message));
      }
    }

    return res.json({
      success: true,
      msg: publishWarningSummary
        ? "Lesson updated — lesson published successfully, with quality warnings."
        : "Lesson updated",
      ...(publishWarningSummary
        ? {
            publishedWithWarnings: true,
            publishWarningSummary,
            publishValidationMode,
            qualityScore: publishQualityScore,
          }
        : {}),
      lesson: {
        ...lesson.toObject(),
        status: getLessonStatus(lesson),
      },
    });
  } catch (err) {
    console.error("Admin update lesson error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   POST /api/admin/lessons/:lessonId/set-free-preview
   Body: { isFreePreview: true | false, note?: string }. Experiment helper.
   ========================================= */
router.post("/lessons/:lessonId/set-free-preview", auth, requireContentManager, async (req, res) => {
  try {
    const lessonId = req.params.lessonId;

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Invalid lessonId" });
    }

    const raw = req.body?.isFreePreview;

    let isFreePreview;
    if (typeof raw === "boolean") isFreePreview = raw;
    else if (typeof raw === "string") isFreePreview = raw.toLowerCase() === "true";
    else return res.status(400).json({ error: "Missing isFreePreview boolean" });

    let note = req.body?.note;
    if (typeof note === "string") {
      note = note.trim().slice(0, 200);
      if (note === "") note = undefined;
    } else {
      note = undefined;
    }

    const existing = await Lesson.findById(lessonId).select("isFreePreview").lean();
    if (!existing) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    const updated = await Lesson.findOneAndUpdate(
      { _id: lessonId },
      { $set: { isFreePreview } },
      { new: true }
    ).select("_id title status isFreePreview").lean();

    const changed = !!existing.isFreePreview !== !!isFreePreview;
    const previous = !!existing.isFreePreview;

    const meta = { isFreePreview, changed, previous };
    if (note != null) meta.note = note;

    await Event.create({
      type: "ADMIN_SET_FREE_PREVIEW",
      userId: req.user?._id,
      lessonId: updated._id,
      meta,
    }).catch((err) => console.error("ADMIN_SET_FREE_PREVIEW event create error:", err));

    const response = {
      ok: true,
      changed,
      lesson: {
        id: String(updated._id),
        title: updated.title || null,
        status: updated.status || null,
        isFreePreview: !!updated.isFreePreview,
      },
    };
    if (note != null) response.note = note;

    return res.json(response);
  } catch (err) {
    console.error("POST /api/admin/lessons/:lessonId/set-free-preview error:", err);
    return res.status(500).json({ error: "Failed to update free preview" });
  }
});

/* =========================================
   PUT /api/admin/lessons/:lessonId/status
   (keeps isPublished aligned)
   ========================================= */
router.put("/lessons/:lessonId/status", auth, requireContentManager, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { status, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }

    if (!status || !["published", "archived", "flagged", "draft"].includes(String(status))) {
      return res.status(400).json({ msg: "Valid status is required" });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });

    const oldStatus = getLessonStatus(lesson);

    let publishWarningSummary = null;
    let publishValidationMode = null;
    let publishQualityScore = null;

    if (String(status).toLowerCase() === "published") {
      if (["archived", "flagged"].includes(String(lesson.status || ""))) {
        return res.status(403).json({ msg: "Lesson is moderated and cannot be published" });
      }

      const { checkPublishGateForGenerated } = require("../middleware/requirePublishGateIfGenerated");
      const {
        validateLessonStructureForPublish,
        buildPublishWarningSummary,
        mergeStructureValidationForScoring,
      } = require("../services/lessonDraftValidation");
      const { scoreLessonQuality } = require("../lib/lessonQualityScoring");

      const lessonObj = lesson.toObject ? lesson.toObject() : { ...lesson._doc, metadata: lesson.metadata };
      const gate = await checkPublishGateForGenerated(lessonObj, req.user);
      if (!gate.ok) {
        return res.status(400).json({
          success: false,
          msg: "Fix issues first",
          issues: gate.issues,
          blocks: gate.blocks,
        });
      }

      const structureValidation = validateLessonStructureForPublish(lessonObj);
      publishValidationMode = structureValidation.mode;
      const structureIssues = mergeStructureValidationForScoring(structureValidation);
      const qualityResult = scoreLessonQuality(lessonObj, { structureIssues, source: "manual" });
      publishQualityScore = qualityResult.score;

      if (structureValidation.blocking.length > 0) {
        return res.status(400).json({
          success: false,
          error: "Lesson failed structure validation",
          msg: "Lesson failed structure validation",
          structureIssues: structureValidation.blocking,
          structureWarnings: structureValidation.warnings,
          publishValidationMode: structureValidation.mode,
        });
      }

      if (structureValidation.mode === "manual_teacher") {
        publishWarningSummary = buildPublishWarningSummary(structureValidation, qualityResult);
      } else if (qualityResult.score < 70) {
        return res.status(400).json({
          success: false,
          error: "Lesson quality too low to publish",
          msg: "Lesson quality too low to publish",
          score: qualityResult.score,
          band: qualityResult.band,
          topIssues: (qualityResult.issues || []).slice(0, 10),
          topSuggestions: (qualityResult.suggestions || []).slice(0, 10),
          qualityResult,
          publishValidationMode: structureValidation.mode,
        });
      }
    }

    lesson.status = status;

    if (status === "published") lesson.isPublished = true;
    if (status === "draft" || status === "archived" || status === "flagged") lesson.isPublished = false;

    if (status === "flagged" && reason) lesson.adminNotes = reason;

    await lesson.save();

    if (String(status).toLowerCase() === "published" && lesson.topicKey) {
      const specKey = String(lesson.topicKey).split(":")[0];
      if (specKey) {
        const { enqueueKnowledgeRefresh } = require("../services/jobs/enqueueKnowledgeRefresh");
        enqueueKnowledgeRefresh({
          specKey,
          topicKey: lesson.topicKey,
          sourceTypes: ["lessonBlock"],
          userId: req.user?._id,
        }).catch((e) => console.error("[admin] enqueueKnowledgeRefresh error:", e?.message));
      }
    }

    auditAdminAction({
      action: "lesson_status",
      actorId: req.user._id || req.user.id,
      actorEmail: req.user.email,
      targetType: "Lesson",
      targetId: lessonId,
      details: { from: oldStatus, to: status, reason },
      ip: req.ip || req.connection?.remoteAddress,
    });

    const msgBase = `Lesson status updated from ${oldStatus} to ${status}`;
    res.json({
      success: true,
      msg: publishWarningSummary
        ? `${msgBase} — lesson published successfully, with quality warnings.`
        : msgBase,
      ...(publishWarningSummary
        ? {
            publishedWithWarnings: true,
            publishWarningSummary,
            publishValidationMode,
            qualityScore: publishQualityScore,
          }
        : {}),
      lesson: {
        id: lesson._id,
        title: lesson.title,
        status: getLessonStatus(lesson),
        adminNotes: lesson.adminNotes,
        isPublished: lesson.isPublished,
      },
    });
  } catch (err) {
    console.error("Update lesson status error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   DELETE /api/admin/lessons/:lessonId
   ========================================= */
router.delete("/lessons/:lessonId", auth, requireContentManager, async (req, res) => {
  try {
    const { lessonId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });

    // ✅ Enhanced safety for deleting master templates
    if (lesson.isTemplate === true) {
      // Check for confirmation in query parameter (since DELETE requests often don't have body)
      const confirmToken = String(req.query?.confirm || "");
      if (confirmToken !== "DELETE") {
        return res.status(400).json({
          msg: 'Deleting a master template requires confirmation. Add ?confirm=DELETE to the URL',
          templateId: lesson._id,
          title: lesson.title,
          hint: 'Master templates are critical admin resources. Use DELETE /api/admin/lessons/' + lessonId + '?confirm=DELETE'
        });
      }
    }

    const summary = {
      id: String(lesson._id),
      title: lesson.title,
      teacherId: lesson.teacherId ? String(lesson.teacherId) : "",
      status: getLessonStatus(lesson),
      isPublished: lesson.isPublished,
      isTemplate: lesson.isTemplate,
      createdFromTemplate: lesson.createdFromTemplate,
    };

    await lesson.deleteOne();

    auditAdminAction({
      action: "lesson_delete",
      actorId: req.user._id || req.user.id,
      actorEmail: req.user.email,
      targetType: "Lesson",
      targetId: lessonId,
      details: summary,
      ip: req.ip || req.connection?.remoteAddress,
    });

    console.log("🧹 [Admin] Deleted lesson:", summary, "by admin:", req.user.email);

    return res.json({ success: true, msg: "Lesson deleted", deleted: summary });
  } catch (err) {
    console.error("Admin delete lesson error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   GET /api/admin/transactions
   ========================================= */
router.get("/transactions", auth, checkAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, type, status, dateFrom, dateTo, sortBy = "date", sortOrder = "desc" } = req.query;

    const pipeline = [];
    pipeline.push({ $unwind: "$transactions" });

    const matchStage = {};
    if (type) matchStage["transactions.type"] = type;
    if (status) matchStage["transactions.status"] = status;

    if (dateFrom || dateTo) {
      matchStage["transactions.date"] = {};
      if (dateFrom) matchStage["transactions.date"].$gte = new Date(dateFrom);
      if (dateTo) matchStage["transactions.date"].$lte = new Date(dateTo);
    }

    if (Object.keys(matchStage).length > 0) pipeline.push({ $match: matchStage });

    pipeline.push({
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "userInfo",
      },
    });

    pipeline.push({ $unwind: "$userInfo" });

    pipeline.push({
      $project: {
        _id: "$transactions._id",
        userId: "$_id",
        userEmail: "$userInfo.email",
        userName: { $concat: ["$userInfo.firstName", " ", "$userInfo.lastName"] },
        userType: "$userInfo.userType",
        type: "$transactions.type",
        amount: "$transactions.amount",
        date: "$transactions.date",
        description: "$transactions.description",
        status: "$transactions.status",
        reference: "$transactions.reference",
        lessonId: "$transactions.lessonId",
      },
    });

    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };
    pipeline.push({ $sort: sort });

    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $skip: (parseInt(page) - 1) * parseInt(limit) }, { $limit: parseInt(limit) }],
      },
    });

    const result = await User.aggregate(pipeline);
    const transactions = result?.[0]?.data || [];
    const total = result?.[0]?.metadata?.[0]?.total || 0;

    res.json({
      success: true,
      transactions,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    console.error("Get transactions error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   PUT /api/admin/users/:userId/verify
   ========================================= */
router.put("/users/:userId/verify", auth, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;

    if (!status || !["verified", "rejected"].includes(status)) {
      return res.status(400).json({ msg: 'Status must be "verified" or "rejected"' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (user.userType !== "teacher") {
      return res.status(400).json({ msg: "Only teachers can be verified" });
    }

    const oldStatus = user.verificationStatus;
    user.verificationStatus = status;

    if (status === "rejected" && reason) user.verificationNotes = reason;

    await user.save();

    auditAdminAction({
      action: "teacher_verify",
      actorId: req.user._id || req.user.id,
      actorEmail: req.user.email,
      targetType: "User",
      targetId: userId,
      details: { from: oldStatus, to: status, reason },
      ip: req.ip || req.connection?.remoteAddress,
    });

    res.json({
      success: true,
      msg: `Teacher ${status === "verified" ? "verified" : "rejected"} successfully`,
      user: {
        id: user._id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        verificationStatus: user.verificationStatus,
        verificationNotes: user.verificationNotes,
      },
      changes: { from: oldStatus, to: status },
    });
  } catch (err) {
    console.error("Verify user error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   PUT /api/admin/users/:userId/staff-role
   Admin-only. Assign content_manager to a user (e.g. teacher).
   ========================================= */
router.put("/users/:userId/staff-role", auth, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { staffRole } = req.body;

    if (staffRole !== undefined && staffRole !== null && staffRole !== "content_manager" && staffRole !== "") {
      return res.status(400).json({ msg: "staffRole must be 'content_manager' or null/empty to clear" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    user.staffRole = staffRole === "content_manager" ? "content_manager" : null;
    await user.save();

    auditAdminAction({
      action: "staff_role_change",
      actorId: req.user._id || req.user.id,
      actorEmail: req.user.email,
      targetType: "User",
      targetId: userId,
      details: { staffRole: user.staffRole },
      ip: req.ip || req.connection?.remoteAddress,
    });

    res.json({
      success: true,
      msg: staffRole ? `Staff role set to ${staffRole}` : "Staff role cleared",
      user: { id: user._id, email: user.email, staffRole: user.staffRole },
    });
  } catch (err) {
    console.error("Update staff-role error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   PUT /api/admin/users/:userId/role
   ========================================= */
router.put("/users/:userId/role", auth, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // ✅ includes parent
    if (!role || !["teacher", "student", "admin", "parent"].includes(role)) {
      return res.status(400).json({ msg: "Valid role is required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const oldRole = user.userType;
    user.userType = role;

    if (role === "admin") user.verificationStatus = "verified";

    await user.save();

    res.json({
      success: true,
      msg: `User role updated from ${oldRole} to ${role}`,
      user: {
        id: user._id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        userType: user.userType,
        verificationStatus: user.verificationStatus,
      },
    });
  } catch (err) {
    console.error("Update role error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   POST /api/admin/shamcoins
   ========================================= */
router.post("/shamcoins", auth, checkAdmin, async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;

    if (!userId || amount === undefined || amount === null) {
      return res.status(400).json({ msg: "User ID and amount are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: "Invalid user id" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const delta = Number(amount);
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ msg: "Amount must be a non-zero number" });
    }

    const oldBalance = user.shamCoins || 0;
    user.shamCoins = oldBalance + delta;

    if (user.shamCoins < 0) {
      return res.status(400).json({ msg: "Cannot set negative sham coins balance" });
    }

    const transactionType = delta > 0 ? "admin_deposit" : "admin_withdrawal";
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: transactionType,
      amount: delta,
      description: reason || `Admin adjustment: ${delta > 0 ? "+" : ""}${delta} ShamCoins`,
      status: "completed",
      reference: `ADMIN-${Date.now()}`,
      date: new Date(),
    });

    await user.save();

    res.json({
      success: true,
      msg: `Sham coins ${delta > 0 ? "added to" : "removed from"} user account`,
      adjustment: {
        userId: user._id,
        userEmail: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        amount: delta,
        oldBalance,
        newBalance: user.shamCoins,
        reason,
        transactionId: user.transactions[user.transactions.length - 1]._id,
      },
    });
  } catch (err) {
    console.error("Adjust sham coins error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   POST /api/admin/subscription/grant
   Dev-only helper to grant a time-limited subscription for testing.
   ========================================= */
router.post("/subscription/grant", auth, checkAdmin, async (req, res) => {
  try {
    const { userId, days } = req.body || {};

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: "Valid userId is required" });
    }

    const daysNum = Number(days);
    if (!Number.isFinite(daysNum) || daysNum <= 0) {
      return res.status(400).json({ msg: "days must be a positive number" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + daysNum * 24 * 60 * 60 * 1000);

    // Write subscriptionV2 so backend entitlement checks pass (active/trialing + future expiresAt).
    user.subscriptionV2 = {
      status: "trialing",
      provider: "admin",
      planId: "admin-pass-7d",
      plan: "trial",
      expiresAt,
      cancelAtPeriodEnd: true,
    };

    await user.save();

    auditAdminAction({
      action: "subscription_grant",
      actorId: req.user._id || req.user.id,
      actorEmail: req.user.email,
      targetType: "User",
      targetId: userId,
      details: { days: daysNum, expiresAt },
      ip: req.ip || req.connection?.remoteAddress,
    });

    const active = isSubscriptionActive(user);

    return res.json({
      success: true,
      userId: String(user._id),
      expiresAt,
      isActive: active,
    });
  } catch (err) {
    console.error("Admin subscription grant error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================
   POST /api/admin/subscription/expire
   Dev-only helper to force a subscription to expire for testing.
   ========================================= */
router.post("/subscription/expire", auth, checkAdmin, async (req, res) => {
  try {
    const { userId } = req.body || {};

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: "Valid userId is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    user.subscriptionV2 = user.subscriptionV2 || {};
    user.subscriptionV2.status = "expired";
    user.subscriptionV2.expiresAt = yesterday;

    await user.save();

    auditAdminAction({
      action: "subscription_expire",
      actorId: req.user._id || req.user.id,
      actorEmail: req.user.email,
      targetType: "User",
      targetId: userId,
      details: {},
      ip: req.ip || req.connection?.remoteAddress,
    });

    const active = isSubscriptionActive(user);

    return res.json({
      success: true,
      userId: String(user._id),
      expiresAt: user.subscriptionV2.expiresAt,
      isActive: active,
    });
  } catch (err) {
    console.error("Admin subscription expire error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = router;