/**
 * Lesson Issue Reports — students/teachers report mistakes; admin/teachers manage.
 */
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const LessonIssueReport = require("../models/LessonIssueReport");
const Lesson = require("../models/Lesson");
const User = require("../models/User");

const REPORT_TYPE_MAP = {
  incorrect_information: "Incorrect information",
  typo_spelling: "Typo / spelling",
  image_problem: "Image problem",
  question_incorrect: "Question incorrect",
  other: "Other",
};

function isTeacherOrAdmin(req) {
  const t = (req.user?.userType || req.user?.type || "").toString().toLowerCase();
  return t === "teacher" || t === "admin";
}

function isAdmin(req) {
  return (req.user?.userType || req.user?.type || "").toString().toLowerCase() === "admin";
}

/**
 * POST /api/lesson-issues — create report (student or teacher, auth required)
 */
router.post("/", auth, async (req, res) => {
  try {
    const { lessonId, pageId, pageTitle, pageOrder, blockId, reportType, description, suggestedFix } = req.body || {};
    if (!lessonId || !reportType || !description || typeof description !== "string") {
      return res.status(400).json({ msg: "lessonId, reportType, and description are required" });
    }
    const validTypes = Object.keys(REPORT_TYPE_MAP);
    if (!validTypes.includes(reportType)) {
      return res.status(400).json({ msg: "Invalid reportType" });
    }
    const desc = String(description).trim();
    if (!desc) {
      return res.status(400).json({ msg: "description cannot be empty" });
    }

    const userRole = (req.user?.userType || req.user?.type || "student").toString().toLowerCase();
    const role = ["student", "teacher", "admin"].includes(userRole) ? userRole : "student";

    const report = new LessonIssueReport({
      lessonId,
      pageId: pageId ? String(pageId).trim() : null,
      pageTitle: pageTitle ? String(pageTitle).trim() : null,
      pageOrder: pageOrder != null && !Number.isNaN(Number(pageOrder)) ? Number(pageOrder) : null,
      blockId: blockId ? String(blockId).trim() : null,
      reportType,
      description: desc,
      suggestedFix: suggestedFix ? String(suggestedFix).trim() : "",
      reportedByUserId: req.user._id || req.user.userId,
      userRole: role,
      status: "open",
    });
    await report.save();

    return res.status(201).json({
      ok: true,
      id: report._id,
      msg: "Thank you for reporting. We'll review this issue.",
    });
  } catch (err) {
    console.error("POST /api/lesson-issues error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

/**
 * GET /api/lesson-issues — list reports (teacher or admin only)
 * Query: ?status=open|reviewed|resolved&lessonId=...
 */
router.get("/", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ msg: "Teacher or admin access required" });
  }
  try {
    const { status, lessonId, limit } = req.query || {};
    const query = {};
    if (status) query.status = String(status).trim();
    if (lessonId) query.lessonId = lessonId;

    // Teachers see only reports for lessons they own; admins see all
    if (!isAdmin(req)) {
      const ownedLessonIds = await Lesson.find({ teacherId: req.user._id }).select("_id").lean();
      const ids = ownedLessonIds.map((l) => l._id);
      query.lessonId = query.lessonId ? { $in: ids, $eq: query.lessonId } : { $in: ids };
      if (ids.length === 0) {
        return res.json({ reports: [] });
      }
    }

    const lim = Math.min(parseInt(limit, 10) || 50, 200);

    const reports = await LessonIssueReport.find(query)
      .sort({ createdAt: -1 })
      .limit(lim)
      .populate("lessonId", "title subject level topic")
      .populate("reportedByUserId", "firstName lastName email")
      .populate("resolvedByUserId", "firstName lastName email")
      .lean();

    const lessonIds = [...new Set(reports.map((r) => r.lessonId?._id || r.lessonId).filter(Boolean))];
    const lessons = await Lesson.find({ _id: { $in: lessonIds } })
      .select("_id title teacherId topicKey topic subTopic")
      .lean();
    const lessonMap = Object.fromEntries(lessons.map((l) => [String(l._id), l]));

    const userIds = [...new Set(reports.map((r) => r.reportedByUserId?._id || r.reportedByUserId).filter(Boolean))];
    const users = await User.find({ _id: { $in: userIds } })
      .select("_id firstName lastName email")
      .lean();
    const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]));

    const items = reports.map((r) => {
      const lesson = r.lessonId?._id ? lessonMap[String(r.lessonId._id)] : null;
      const user = r.reportedByUserId?._id ? userMap[String(r.reportedByUserId._id)] : r.reportedByUserId;
      const userName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email || "—"
        : "—";
      const resolvedByName = r.resolvedByUserId
        ? [r.resolvedByUserId.firstName, r.resolvedByUserId.lastName].filter(Boolean).join(" ").trim() || r.resolvedByUserId.email || "—"
        : null;
      return {
        id: r._id,
        lessonId: r.lessonId?._id || r.lessonId,
        lessonTitle: lesson?.title || r.lessonId?.title || "—",
        lessonTopicKey: lesson?.topicKey || r.lessonId?.topicKey || null,
        lessonTopic: lesson?.topic || r.lessonId?.topic || null,
        lessonSubTopic: lesson?.subTopic || r.lessonId?.subTopic || null,
        pageId: r.pageId,
        pageTitle: r.pageTitle,
        pageOrder: r.pageOrder,
        blockId: r.blockId,
        reportType: r.reportType,
        reportTypeLabel: REPORT_TYPE_MAP[r.reportType] || r.reportType,
        description: r.description,
        suggestedFix: r.suggestedFix,
        reportedByUserId: r.reportedByUserId?._id || r.reportedByUserId,
        reportedByName: userName,
        userRole: r.userRole,
        status: r.status,
        createdAt: r.createdAt,
        resolvedByUserId: r.resolvedByUserId?._id || r.resolvedByUserId || null,
        resolvedByName: resolvedByName,
        resolvedAt: r.resolvedAt || null,
      };
    });

    return res.json({ reports: items });
  } catch (err) {
    console.error("GET /api/lesson-issues error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

/**
 * GET /api/lesson-issues/stats — summary stats for Content Quality Dashboard
 * Teacher: own lessons only. Admin: all.
 */
router.get("/stats", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ msg: "Teacher or admin access required" });
  }
  try {
    const query = {};
    if (!isAdmin(req)) {
      const ownedLessonIds = await Lesson.find({ teacherId: req.user._id }).select("_id").lean();
      const ids = ownedLessonIds.map((l) => l._id);
      if (ids.length === 0) {
        return res.json({ openCount: 0, lessonsAffected: 0, topicsAffected: 0, resolvedThisWeek: 0 });
      }
      query.lessonId = { $in: ids };
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [openReports, resolvedThisWeek] = await Promise.all([
      LessonIssueReport.find({ ...query, status: "open" }).select("lessonId").lean(),
      LessonIssueReport.find({
        ...query,
        status: "resolved",
        createdAt: { $gte: oneWeekAgo },
      })
        .select("_id")
        .lean(),
    ]);

    const lessonIds = [...new Set(openReports.map((r) => String(r.lessonId)))];
    const lessons = await Lesson.find({ _id: { $in: lessonIds } })
      .select("topicKey")
      .lean();
    const topicKeys = new Set(lessons.map((l) => l.topicKey).filter(Boolean));

    return res.json({
      openCount: openReports.length,
      lessonsAffected: lessonIds.length,
      topicsAffected: topicKeys.size,
      resolvedThisWeek: resolvedThisWeek.length,
    });
  } catch (err) {
    console.error("GET /api/lesson-issues/stats error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

async function canManageReport(req, report) {
  if (isAdmin(req)) return true;
  const lesson = await Lesson.findById(report.lessonId).select("teacherId").lean();
  return lesson && String(lesson.teacherId) === String(req.user._id);
}

/**
 * PATCH /api/lesson-issues/:id — update status (teacher or admin)
 */
router.patch("/:id", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ msg: "Teacher or admin access required" });
  }
  try {
    const { status } = req.body || {};
    if (!status || !["open", "reviewed", "resolved"].includes(status)) {
      return res.status(400).json({ msg: "Valid status required: open, reviewed, or resolved" });
    }
    const report = await LessonIssueReport.findById(req.params.id);
    if (!report) return res.status(404).json({ msg: "Report not found" });
    if (!(await canManageReport(req, report))) {
      return res.status(403).json({ msg: "You can only manage reports for your own lessons" });
    }
    report.status = status;
    if (status === "resolved") {
      report.resolvedByUserId = req.user._id || req.user.userId;
      report.resolvedAt = new Date();
    }
    await report.save();
    return res.json({ ok: true, status: report.status });
  } catch (err) {
    console.error("PATCH /api/lesson-issues/:id error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

/**
 * DELETE /api/lesson-issues/:id — delete report (teacher or admin)
 */
router.delete("/:id", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ msg: "Teacher or admin access required" });
  }
  try {
    const report = await LessonIssueReport.findById(req.params.id);
    if (!report) return res.status(404).json({ msg: "Report not found" });
    if (!(await canManageReport(req, report))) {
      return res.status(403).json({ msg: "You can only manage reports for your own lessons" });
    }
    await LessonIssueReport.findByIdAndDelete(req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/lesson-issues/:id error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
