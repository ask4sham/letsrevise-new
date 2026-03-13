/**
 * PR-EDGE-3: Teacher overview dashboard — actionable summary.
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const WorksheetAssignment = require("../models/WorksheetAssignment");
const WorksheetAttempt = require("../models/WorksheetAttempt");
const Worksheet = require("../models/Worksheet");
const ExamQuestion = require("../models/ExamQuestion");
const PracticeAttempt = require("../models/PracticeAttempt");
const AssessmentPaper = require("../models/AssessmentPaper");
const AssessmentAttempt = require("../models/AssessmentAttempt");
const QuizAssignment = require("../models/QuizAssignment");
const QuizAttempt = require("../models/QuizAttempt");
const Lesson = require("../models/Lesson");

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

// GET /api/teacher/overview — teacher/admin only; returns needsMarking, awaitingRelease, dueSoon, recentActivity
router.get("/overview", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const userId = (req.user._id || req.user.userId || req.user.id).toString();
    const teacherOid = new mongoose.Types.ObjectId(userId);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // For now: teacher and admin both see own data only (spec: recommend teacher-only for now)
    const [assignments, teacherLessons, teacherPapers, quizAssignments] = await Promise.all([
      WorksheetAssignment.find({ ownerId: userId }).select("_id title worksheetId dueAt ownerId").lean(),
      Lesson.find({ teacherId: teacherOid }).select("_id title").lean(),
      AssessmentPaper.find({ createdBy: teacherOid }).select("_id title").lean(),
      QuizAssignment.find({ ownerId: userId }).select("_id title kind isActive dueAt ownerId").lean(),
    ]);
    const assignmentIds = assignments.map((a) => a._id);
    const lessonIds = teacherLessons.map((l) => l._id);
    const paperIds = teacherPapers.map((p) => p._id);
    const quizAssignmentIds = quizAssignments.map((a) => a._id);
    const assignmentMap = new Map(assignments.map((a) => [a._id.toString(), a]));
    const quizAssignmentMap = new Map(quizAssignments.map((a) => [a._id.toString(), a]));

    let needsMarkingCount = 0;
    let awaitingReleaseWorksheets = 0;
    const dueSoonWorksheets = new Set();
    const recentActivity = [];

    if (assignmentIds.length > 0) {
      const attempts = await WorksheetAttempt.find({
        assignmentId: { $in: assignmentIds },
        status: { $in: ["SUBMITTED", "MARKED"] },
      })
        .select("_id assignmentId worksheetId studentName status isReleased submittedAt updatedAt answers")
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean();

      const worksheetIds = [...new Set(attempts.map((a) => a.worksheetId))];
      const worksheets = await Worksheet.find({ _id: { $in: worksheetIds } }).select("_id title questionItems").lean();
      const worksheetMap = new Map(worksheets.map((w) => [w._id.toString(), w]));
      const allQIds = new Set();
      worksheets.forEach((w) => (w.questionItems || []).forEach((it) => allQIds.add(it.examQuestionId)));
      const examQuestions = await ExamQuestion.find({ _id: { $in: [...allQIds] } }).select("_id type").lean();
      const shortByWorksheet = new Map();
      worksheets.forEach((w) => {
        const eqMap = new Map(examQuestions.filter((eq) => (w.questionItems || []).some((it) => it.examQuestionId.toString() === eq._id.toString())).map((eq) => [eq._id.toString(), eq]));
        const shortIds = new Set((w.questionItems || []).filter((it) => eqMap.get(it.examQuestionId.toString())?.type !== "mcq").map((it) => it.examQuestionId.toString()));
        shortByWorksheet.set(w._id.toString(), shortIds);
      });

      for (const a of attempts) {
        if (a.status === "MARKED" && !a.isReleased) awaitingReleaseWorksheets++;

        if (a.status === "SUBMITTED") {
          const ws = worksheetMap.get(a.worksheetId?.toString());
          const shortIds = ws ? shortByWorksheet.get(a.worksheetId.toString()) : new Set();
          if (shortIds && shortIds.size > 0) {
            let unmarked = 0;
            (a.answers || []).forEach((ans) => {
              if (shortIds.has(String(ans.examQuestionId)) && ans.awardedMarks == null) unmarked++;
            });
            if (unmarked > 0) needsMarkingCount++;
          }
        }

        if (recentActivity.length < 10) {
          const ass = assignmentMap.get(a.assignmentId?.toString());
          const label = a.studentName ? `${a.studentName} submitted ${ass?.title || "worksheet"}` : `Worksheet submitted: ${ass?.title || "assignment"}`;
          recentActivity.push({
            type: "worksheet",
            submittedAt: (a.submittedAt || a.updatedAt || a.createdAt)?.toISOString?.() || null,
            label,
            link: `/teacher/worksheet-assignments/${a.assignmentId}/report`,
          });
        }
      }

      const now = new Date();
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      for (const a of assignments) {
        if (a.dueAt && a.dueAt >= now && a.dueAt <= sevenDays) {
          dueSoonWorksheets.add(a._id.toString());
        }
      }
    }

    // PR-EDGE-3.1: Quiz/Assessment counts from QuizAssignment + QuizAttempt
    let awaitingReleaseQuizzes = 0;
    let awaitingReleaseAssessments = 0;
    let dueSoonQuizzes = 0;
    let dueSoonAssessments = 0;
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (quizAssignmentIds.length > 0) {
      const quizAttempts = await QuizAttempt.find({
        assignmentId: { $in: quizAssignmentIds },
        status: { $in: ["SUBMITTED", "MARKED"] },
        isReleased: false,
      })
        .select("_id assignmentId submittedAt status")
        .lean();

      for (const qa of quizAttempts) {
        const assign = quizAssignmentMap.get(qa.assignmentId?.toString());
        if (!assign) continue;
        if (assign.kind === "quiz") awaitingReleaseQuizzes++;
        else if (assign.kind === "assessment") awaitingReleaseAssessments++;
      }

      for (const qa of quizAssignments) {
        if (!qa.isActive || !qa.dueAt) continue;
        if (qa.dueAt >= now && qa.dueAt <= sevenDaysFromNow) {
          if (qa.kind === "quiz") dueSoonQuizzes++;
          else if (qa.kind === "assessment") dueSoonAssessments++;
        }
      }
    }

    // Fallback: PracticeAttempt / AssessmentAttempt for recentActivity if no QuizAttempt
    const lessonMap = new Map(teacherLessons.map((l) => [l._id.toString(), l]));
    if (quizAssignmentIds.length > 0) {
      const recentQuizAttempts = await QuizAttempt.find({
        assignmentId: { $in: quizAssignmentIds },
        status: { $in: ["SUBMITTED", "MARKED"] },
      })
        .select("assignmentId submittedAt studentName")
        .sort({ submittedAt: -1 })
        .limit(20)
        .lean();
      for (const qa of recentQuizAttempts) {
        const assign = quizAssignmentMap.get(qa.assignmentId?.toString());
        if (!assign) continue;
        const label =
          assign.kind === "quiz"
            ? `Quiz submitted: ${assign.title || "quiz"}`
            : `Assessment submitted: ${assign.title || "assessment"}`;
        recentActivity.push({
          type: assign.kind,
          submittedAt: (qa.submittedAt || qa.updatedAt || qa.createdAt)?.toISOString?.() || null,
          label,
          link: "/teacher/reports/attempts",
        });
      }
    }
    if (lessonIds.length > 0 && recentActivity.filter((a) => a.type === "quiz").length === 0) {
      const recentPractice = await PracticeAttempt.find({ lessonId: { $in: lessonIds } })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("userId", "firstName lastName")
        .lean();
      for (const pa of recentPractice) {
        if (recentActivity.length >= 10) break;
        const lesson = lessonMap.get(pa.lessonId?.toString());
        const studentName = pa.userId ? [pa.userId.firstName, pa.userId.lastName].filter(Boolean).join(" ") : "Student";
        recentActivity.push({
          type: "quiz",
          submittedAt: pa.createdAt?.toISOString?.() || null,
          label: `${studentName} completed practice on ${lesson?.title || "lesson"}`,
          link: "/teacher/reports/attempts",
        });
      }
    }
    if (paperIds.length > 0 && recentActivity.filter((a) => a.type === "assessment").length === 0) {
      const recentAssessments = await AssessmentAttempt.find({
        paperId: { $in: paperIds },
        status: "submitted",
      })
        .sort({ submittedAt: -1 })
        .limit(5)
        .populate("studentId", "firstName lastName")
        .populate("paperId", "title")
        .lean();
      for (const aa of recentAssessments) {
        const studentName = aa.studentId
          ? [aa.studentId.firstName, aa.studentId.lastName].filter(Boolean).join(" ")
          : "Student";
        const paperTitle = aa.paperId?.title || "assessment";
        recentActivity.push({
          type: "assessment",
          submittedAt: aa.submittedAt?.toISOString?.() || null,
          label: `${studentName} submitted ${paperTitle}`,
          link: "/teacher/reports/attempts",
        });
      }
    }
    recentActivity.sort((a, b) => {
      const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return tb - ta;
    });

    // PR-EDGE-5: quiz submissions today, low score (< 40%) count
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let quizSubmissionsToday = 0;
    let lowScoreCount = 0;

    if (quizAssignmentIds.length > 0) {
      const todayQuizAttempts = await QuizAttempt.find({
        assignmentId: { $in: quizAssignmentIds },
        status: { $in: ["SUBMITTED", "MARKED"] },
        submittedAt: { $gte: todayStart },
      }).select("_id score maxScore").lean();
      quizSubmissionsToday = todayQuizAttempts.length;
      for (const qa of todayQuizAttempts) {
        if (qa.maxScore > 0 && (qa.score ?? 0) / qa.maxScore < 0.4) lowScoreCount++;
      }
    }
    if (assignmentIds.length > 0) {
      const releasedWorksheets = await WorksheetAttempt.find({
        assignmentId: { $in: assignmentIds },
        status: "MARKED",
        isReleased: true,
      })
        .select("score maxScore")
        .lean();
      for (const wa of releasedWorksheets) {
        if (wa.maxScore > 0 && (wa.score ?? 0) / wa.maxScore < 0.4) lowScoreCount++;
      }
    }
    const allReleasedQuiz = await QuizAttempt.find({
      assignmentId: { $in: quizAssignmentIds },
      status: { $in: ["SUBMITTED", "MARKED"] },
      isReleased: true,
    })
      .select("score maxScore")
      .lean();
    for (const qa of allReleasedQuiz) {
      if (qa.maxScore > 0 && (qa.score ?? 0) / qa.maxScore < 0.4) lowScoreCount++;
    }

    const awaitingReleaseTotal =
      awaitingReleaseWorksheets + awaitingReleaseQuizzes + awaitingReleaseAssessments;

    return res.json({
      ok: true,
      needsMarking: {
        worksheets: { count: needsMarkingCount, link: "/teacher/worksheets/needs-marking" },
      },
      awaitingRelease: {
        worksheets: { count: awaitingReleaseWorksheets, link: "/teacher/worksheets" },
        quizzes: { count: awaitingReleaseQuizzes, link: "/teacher/reports/attempts" },
        assessments: { count: awaitingReleaseAssessments, link: "/teacher/reports/attempts" },
      },
      dueSoon: {
        worksheets: { count: dueSoonWorksheets.size, link: "/teacher/worksheets" },
        quizzes: { count: dueSoonQuizzes, link: "/teacher/reports/attempts" },
        assessments: { count: dueSoonAssessments, link: "/teacher/reports/attempts" },
      },
      recentActivity: recentActivity.slice(0, 10),
      // PR-EDGE-5: at-risk + today signals
      quizSubmissionsToday,
      lowScoreCount,
      awaitingReleaseTotal,
    });
  } catch (err) {
    console.error("Teacher overview error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =========================================
   PR-EDGE-5.1: GET /api/teacher/at-risk — Low-score drill-down (actionable list)
   ========================================= */
router.get("/at-risk", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const userId = (req.user._id || req.user.userId || req.user.id).toString();
    const teacherOid = new mongoose.Types.ObjectId(userId);

    const threshold = parseFloat(req.query.threshold) || 0.4;
    const days = parseInt(req.query.days, 10) || 7;
    const typeFilter = (req.query.type || "all").toString().toLowerCase();
    let limit = parseInt(req.query.limit, 10) || 50;
    if (limit > 200) limit = 200;
    if (limit < 1) limit = 50;

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const items = [];

    if (typeFilter === "all" || typeFilter === "worksheet") {
      const assignments = await WorksheetAssignment.find({ ownerId: userId }).select("_id title worksheetId").lean();
      const assignmentIds = assignments.map((a) => a._id);
      const assMap = new Map(assignments.map((a) => [a._id.toString(), a]));
      if (assignmentIds.length > 0) {
        const attempts = await WorksheetAttempt.find({
          assignmentId: { $in: assignmentIds },
          status: "MARKED",
          maxScore: { $gt: 0 },
          submittedAt: { $gte: since },
        })
          .select("_id assignmentId worksheetId score maxScore submittedAt isReleased")
          .sort({ submittedAt: -1 })
          .limit(limit * 2)
          .lean();
        const worksheets = await Worksheet.find({ _id: { $in: [...new Set(attempts.map((a) => a.worksheetId))] } })
          .select("_id title topicKey")
          .lean();
        const wsMap = new Map(worksheets.map((w) => [w._id.toString(), w]));
        for (const a of attempts) {
          const ratio = (a.score || 0) / a.maxScore;
          if (ratio >= threshold) continue;
          const ass = assMap.get(a.assignmentId?.toString());
          const ws = wsMap.get(a.worksheetId?.toString());
          items.push({
            type: "worksheet",
            attemptId: String(a._id),
            submittedAt: a.submittedAt?.toISOString?.() || null,
            score: a.score || 0,
            maxScore: a.maxScore,
            ratio: Math.round(ratio * 1000) / 1000,
            title: `Worksheet: ${ws?.title || ass?.title || "—"}`,
            topicKey: ws?.topicKey || "",
            isReleased: !!a.isReleased,
            link: `/teacher/worksheet-assignments/${a.assignmentId}/report`,
          });
          if (items.length >= limit) break;
        }
      }
    }

    if ((typeFilter === "all" || typeFilter === "quiz" || typeFilter === "assessment") && items.length < limit) {
      const quizAssignments = await QuizAssignment.find({ ownerId: userId })
        .select("_id title kind lessonId")
        .lean();
      const quizAssIds = quizAssignments.map((a) => a._id);
      const qaMap = new Map(quizAssignments.map((a) => [a._id.toString(), a]));
      const lessonIds = [...new Set(quizAssignments.map((a) => a.lessonId).filter(Boolean))];
      const lessons = await Lesson.find({ _id: { $in: lessonIds } }).select("_id topic").lean();
      const lessonMap = new Map(lessons.map((l) => [l._id.toString(), l]));

      if (quizAssIds.length > 0) {
        const attempts = await QuizAttempt.find({
          assignmentId: { $in: quizAssIds },
          status: { $in: ["SUBMITTED", "MARKED"] },
          maxScore: { $gt: 0 },
          submittedAt: { $gte: since },
        })
          .select("_id assignmentId score maxScore submittedAt isReleased")
          .sort({ submittedAt: -1 })
          .limit(limit * 2)
          .lean();
        for (const a of attempts) {
          const ratio = (a.score || 0) / a.maxScore;
          if (ratio >= threshold) continue;
          const qa = qaMap.get(a.assignmentId?.toString());
          const kind = qa?.kind || "quiz";
          if (typeFilter === "quiz" && kind !== "quiz") continue;
          if (typeFilter === "assessment" && kind !== "assessment") continue;
          const lesson = qa?.lessonId ? lessonMap.get(qa.lessonId.toString()) : null;
          items.push({
            type: kind,
            attemptId: String(a._id),
            submittedAt: a.submittedAt?.toISOString?.() || null,
            score: a.score || 0,
            maxScore: a.maxScore,
            ratio: Math.round(ratio * 1000) / 1000,
            title: `${kind === "quiz" ? "Quiz" : "Assessment"}: ${qa?.title || "—"}`,
            topicKey: lesson?.topic ? String(lesson.topic).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") : "",
            isReleased: !!a.isReleased,
            link: "/teacher/reports/attempts",
          });
          if (items.length >= limit) break;
        }
      }
    }

    if ((typeFilter === "all" || typeFilter === "assessment") && items.length < limit) {
      const papers = await AssessmentPaper.find({ createdBy: teacherOid }).select("_id title subject").lean();
      const paperIds = papers.map((p) => p._id);
      const paperMap = new Map(papers.map((p) => [p._id.toString(), p]));
      if (paperIds.length > 0) {
        const attempts = await AssessmentAttempt.find({
          paperId: { $in: paperIds },
          status: "submitted",
          submittedAt: { $gte: since },
        })
          .select("_id paperId submittedAt score")
          .sort({ submittedAt: -1 })
          .limit(limit * 2)
          .lean();
        for (const a of attempts) {
          const score = a.score || {};
          const total = score.totalQuestions || 0;
          const correct = score.correct || 0;
          const pct = score.percentage;
          const ratio = total > 0 ? correct / total : (typeof pct === "number" ? pct / 100 : 0);
          if (ratio >= threshold) continue;
          const paper = paperMap.get(a.paperId?.toString());
          items.push({
            type: "assessment",
            attemptId: String(a._id),
            submittedAt: a.submittedAt?.toISOString?.() || null,
            score: correct,
            maxScore: total,
            ratio: Math.round(ratio * 1000) / 1000,
            title: `Assessment: ${paper?.title || "—"}`,
            topicKey: paper?.subject || "",
            isReleased: true,
            link: "/teacher/reports/attempts",
          });
          if (items.length >= limit) break;
        }
      }
    }

    items.sort((a, b) => {
      const ta = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const tb = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return tb - ta;
    });

    return res.json({
      ok: true,
      threshold,
      days,
      items: items.slice(0, limit),
    });
  } catch (err) {
    console.error("Teacher at-risk error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// PR-EDGE-5.2: POST /api/teacher/at-risk/assign — one-click remedial assignment from topicKey
router.post("/at-risk/assign", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const topicKey = (req.body?.topicKey || "").toString().trim();
    const kind = (req.body?.kind || "").toString().toLowerCase();
    const dueAt = req.body?.dueAt;

    if (!topicKey) {
      return res.status(400).json({ error: "topicKey is required" });
    }
    if (kind !== "quiz" && kind !== "assessment") {
      return res.status(400).json({ error: "kind must be quiz or assessment" });
    }

    const { createRemedialAssignmentFromTopic } = require("../services/createRemedialAssignmentFromTopic");
    const result = await createRemedialAssignmentFromTopic({
      owner: req.user,
      topicKey,
      kind,
      dueAt: dueAt || undefined,
    });

    return res.status(200).json({
      ok: true,
      topicKey: result.topicKey || topicKey,
      kind,
      lessonId: result.lessonId,
      assignmentId: result.assignmentId,
      shareId: result.shareId,
      shareUrl: result.shareUrl,
      generated: result.generated,
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    console.error("Teacher at-risk assign error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// PR-EDGE-5: GET /api/teacher/analytics/questions?topicKey=... — question-level attempts, % correct
router.get("/analytics/questions", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers only" });
  }
  try {
    const topicKey = (req.query.topicKey || "").toString().trim().toLowerCase();
    if (!topicKey) {
      return res.status(400).json({ error: "topicKey query is required" });
    }
    const teacherId = (req.user._id || req.user.userId || req.user.id).toString();
    const teacherOid = new mongoose.Types.ObjectId(teacherId);
    const days = parseInt(req.query.days || "30", 10) || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const examQIds = await ExamQuestion.find({
      teacherId: teacherOid,
      topicKey,
    })
      .select("_id question")
      .lean();
    const questionIds = examQIds.map((eq) => eq._id);
    if (questionIds.length === 0) {
      return res.json({ items: [], topicKey });
    }

    const agg = await PracticeAttempt.aggregate([
      { $match: { source: "practice", questionId: { $in: questionIds }, createdAt: { $gte: since } } },
      {
        $group: {
          _id: "$questionId",
          attempts: { $sum: 1 },
          correct: { $sum: { $cond: [{ $eq: ["$isCorrect", true] }, 1, 0] } },
        },
      },
      { $lookup: { from: "examquestions", localField: "_id", foreignField: "_id", as: "eq" } },
      { $unwind: { path: "$eq", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          questionId: { $toString: "$_id" },
          questionPreview: { $substr: ["$eq.question", 0, 80] },
          attempts: 1,
          correct: 1,
          percentCorrect: { $cond: [{ $eq: ["$attempts", 0] }, null, { $multiply: [{ $divide: ["$correct", "$attempts"] }, 100] }] },
        },
      },
      { $sort: { percentCorrect: 1, attempts: -1 } },
    ]);

    return res.json({
      topicKey,
      items: agg.map((a) => ({
        questionId: a.questionId,
        questionPreview: (a.questionPreview || "").trim() || "(unknown)",
        attempts: a.attempts,
        correct: a.correct,
        percentCorrect: a.percentCorrect != null ? Math.round(a.percentCorrect * 10) / 10 : null,
      })),
    });
  } catch (err) {
    console.error("Teacher analytics questions error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
