// ============================
// Phase 1 Parent Progress — LOCKED
// Do NOT add raw scores, percentages,
// timings, or curriculum coverage here.
// See PHASE_1_INVARIANTS.md
// ============================
// /backend/routes/parent.js

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const auth = require("../middleware/auth");
const User = require("../models/User");
const ParentLinkRequest = require("../models/ParentLinkRequest");

// Robust Supabase import
const supabaseModule = require("../supabaseClient");
const supabase = supabaseModule?.supabase || supabaseModule;

console.log("✅ LOADED: backend/routes/parent.js");

/**
 * Guard: only allow parents
 */
function requireParent(req, res, next) {
  if (!req.user || req.user.userType !== "parent") {
    return res.status(403).json({ msg: "Parent access only" });
  }
  return next();
}

/**
 * Helpers
 */
function toNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function normaliseSubjectName(name) {
  if (!name) return "Other";
  const s = String(name).trim().toLowerCase();
  if (!s) return "Other";
  if (s.startsWith("math")) return "Mathematics";
  if (s === "english") return "English";
  if (s === "science") return "Science";
  if (s === "languages" || s === "language") return "Languages";
  if (["humanities", "history", "geography"].includes(s)) return "Humanities";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isValidObjectIdString(idStr) {
  return typeof idStr === "string" && mongoose.Types.ObjectId.isValid(idStr);
}

/**
 * A "valid attempt" means we have enough information to compute accuracy.
 * This prevents Phase 1 from inventing signals when there is no real attempt data yet.
 */
function isValidAttempt(a) {
  const ca = a?.correct_answers ?? null;
  const tq = a?.total_questions ?? null;
  return ca != null && tq != null && toNumber(tq) > 0;
}

function computeAccuracyPercent(attempts) {
  let correct = 0;
  let total = 0;

  for (const a of attempts) {
    if (!isValidAttempt(a)) continue;
    correct += toNumber(a.correct_answers);
    total += toNumber(a.total_questions);
  }

  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

function computeTrend(recentPct, previousPct) {
  const delta = recentPct - previousPct;
  if (delta >= 5) return "improving";
  if (delta <= -5) return "declining";
  return "stable";
}

function statusFromAccuracy(pct, trend) {
  if (pct >= 75 && trend !== "declining") return "strength";
  if (pct < 65 || trend === "declining") return "needs_attention";
  return "neutral";
}

/**
 * Fetch approved child ObjectIds for a given parentId
 */
async function getApprovedChildIdsForParent(parentId) {
  const approved = await ParentLinkRequest.find({
    parentId: new mongoose.Types.ObjectId(parentId),
    status: "approved",
  })
    .select("studentId")
    .lean();

  const ids = (approved || [])
    .map((r) => r.studentId)
    .filter(Boolean)
    .map((id) => id.toString())
    .filter(isValidObjectIdString);

  const unique = Array.from(new Set(ids));
  return unique.map((s) => new mongoose.Types.ObjectId(s));
}

/**
 * GET /api/parent/children
 * ✅ Approved children only
 */
router.get("/children", auth, requireParent, async (req, res) => {
  try {
    const parentId = req.user?.userId || req.user?._id;
    if (!parentId) return res.status(401).json({ msg: "Unauthorized" });

    const parent = await User.findById(parentId).select("userType").lean();
    if (!parent) return res.status(404).json({ msg: "Parent not found" });
    if (parent.userType !== "parent")
      return res.status(403).json({ msg: "Parent access only" });

    const childObjectIds = await getApprovedChildIdsForParent(parentId);

    if (!childObjectIds.length) {
      return res.json({ children: [] });
    }

    const children = await User.find({
      _id: { $in: childObjectIds },
      userType: "student",
    })
      .select("_id firstName lastName email yearGroup updatedAt")
      .lean();

    return res.json({
      children: (children || []).map((c) => ({
        id: String(c._id),
        firstName: c.firstName || "",
        lastName: c.lastName || "",
        email: c.email,
        yearGroup: c.yearGroup,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (err) {
    console.error("GET /api/parent/children error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

/**
 * GET /api/parent/children/:childId/progress
 * Phase 1 — Parent-safe signals ONLY
 */
router.get("/children/:childId/progress", auth, requireParent, async (req, res) => {
  try {
    const parentId = req.user?.userId || req.user?._id;
    const { childId } = req.params;

    if (!parentId) return res.status(401).json({ msg: "Unauthorized" });
    if (!isValidObjectIdString(String(childId))) {
      return res.status(400).json({ msg: "Invalid childId" });
    }

    const approvedLink = await ParentLinkRequest.findOne({
      parentId: new mongoose.Types.ObjectId(parentId),
      studentId: new mongoose.Types.ObjectId(childId),
      status: "approved",
    })
      .select("_id")
      .lean();

    if (!approvedLink) {
      return res
        .status(403)
        .json({ msg: "Parent not authorised to access this child" });
    }

    const child = await User.findById(childId)
      .select("_id userType")
      .lean();
    if (!child || child.userType !== "student") {
      return res.status(404).json({ msg: "Student not found" });
    }

    if (!supabase || typeof supabase.from !== "function") {
      return res.json({
        childId: String(child._id),
        overall: { status: "neutral", trend: "stable" },
        subjects: [],
        updatedAt: new Date().toISOString(),
      });
    }

    const { data: attempts, error } = await supabase
      .from("quiz_attempts")
      .select("quiz_id, total_questions, correct_answers, created_at")
      .eq("user_id", String(childId))
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase quiz_attempts error:", error);
      return res.status(500).json({ msg: "Failed to fetch quiz attempts" });
    }

    if (!attempts || attempts.length === 0) {
      return res.json({
        childId: String(child._id),
        overall: { status: "neutral", trend: "stable" },
        subjects: [],
        updatedAt: new Date().toISOString(),
      });
    }

    const validAttempts = attempts.filter(isValidAttempt);
    if (!validAttempts.length) {
      return res.json({
        childId: String(child._id),
        overall: { status: "neutral", trend: "stable" },
        subjects: [],
        updatedAt: new Date().toISOString(),
      });
    }

    const quizIds = [...new Set(validAttempts.map((a) => a.quiz_id))];
    const quizSubjectById = {};

    const { data: quizzes, error: quizErr } = await supabase
      .from("quizzes")
      .select("id, subject")
      .in("id", quizIds);

    if (quizErr) {
      console.error("Supabase quizzes error:", quizErr);
      return res.status(500).json({ msg: "Failed to fetch quiz metadata" });
    }

    (quizzes || []).forEach((q) => {
      quizSubjectById[q.id] = normaliseSubjectName(q.subject);
    });

    const bySubject = new Map();
    for (const a of validAttempts) {
      const subject = quizSubjectById[a.quiz_id] || "Other";
      if (!bySubject.has(subject)) bySubject.set(subject, []);
      bySubject.get(subject).push(a);
    }

    const subjects = [];

    for (const [name, group] of bySubject.entries()) {
      const recent = group.slice(0, 10);
      const previous = group.slice(10, 20);

      const recentPct = computeAccuracyPercent(recent);
      const previousPct = previous.length
        ? computeAccuracyPercent(previous)
        : recentPct;

      const trend = computeTrend(recentPct, previousPct);
      const status = statusFromAccuracy(
        computeAccuracyPercent(group),
        trend
      );

      subjects.push({ name, status, trend });
    }

    const strengths = subjects.filter((s) => s.status === "strength").length;
    const needs = subjects.filter(
      (s) => s.status === "needs_attention"
    ).length;

    const overallStatus =
      strengths > needs
        ? "strength"
        : needs > strengths
        ? "needs_attention"
        : "neutral";

    const improving = subjects.filter(
      (s) => s.trend === "improving"
    ).length;
    const declining = subjects.filter(
      (s) => s.trend === "declining"
    ).length;

    const overallTrend =
      improving - declining >= 2
        ? "improving"
        : declining - improving >= 2
        ? "declining"
        : "stable";

    return res.json({
      childId: String(child._id),
      overall: { status: overallStatus, trend: overallTrend },
      subjects,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Parent progress error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

/**
 * GET /api/parent/children/:childId/summary
 * Phase 2 — Parent-safe SUMMARY (placeholder, no raw scores)
 */
router.get("/children/:childId/summary", auth, requireParent, async (req, res) => {
  try {
    const parentId = req.user?.userId || req.user?._id;
    const { childId } = req.params;

    if (!parentId) return res.status(401).json({ msg: "Unauthorized" });
    if (!isValidObjectIdString(String(childId))) {
      return res.status(400).json({ msg: "Invalid childId" });
    }

    const approvedLink = await ParentLinkRequest.findOne({
      parentId: new mongoose.Types.ObjectId(parentId),
      studentId: new mongoose.Types.ObjectId(childId),
      status: "approved",
    })
      .select("_id")
      .lean();

    if (!approvedLink) {
      return res
        .status(403)
        .json({ msg: "Parent not authorised to access this child" });
    }

    return res.json({
      childId: String(childId),
      weeklyMinutesBand: "0–15",
      currentStreak: 0,
      lastActive: null,
      topSubjects: [],
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Parent summary error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
