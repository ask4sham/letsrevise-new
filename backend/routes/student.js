/**
 * PR-EDGE-4: Student "My Work" dashboard — worksheets, quizzes, assessments.
 * PR-STU-PROGRESS-1: Student "My Progress" — reflection (quizzes attempted, average score, needs practice).
 * Step 6 LLM: GET /api/student/knowledge-gap — weak areas + LLM revision focus summary.
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const axios = require("axios");
const auth = require("../middleware/auth");
const WorksheetAttempt = require("../models/WorksheetAttempt");
const PracticeAttempt = require("../models/PracticeAttempt");
const WorksheetAssignment = require("../models/WorksheetAssignment");
const Worksheet = require("../models/Worksheet");
const QuizAttempt = require("../models/QuizAttempt");
const QuizAssignment = require("../models/QuizAssignment");
const Lesson = require("../models/Lesson");
const { getBiologyTopics, topicToKey } = require("../utils/topicTaxonomy");

function isStudent(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  return t === "student";
}

// GET /api/student/my-work — student only; returns worksheets, quizzes, assessments
router.get("/my-work", auth, async (req, res) => {
  if (!isStudent(req)) {
    return res.status(403).json({ error: "Students only" });
  }
  try {
    const studentId = (req.user._id || req.user.userId || req.user.id).toString();
    const studentOid = new mongoose.Types.ObjectId(studentId);
    const cap = 50;

    const [worksheetAttempts, quizAttempts] = await Promise.all([
      WorksheetAttempt.find({ studentId: studentOid }).sort({ updatedAt: -1 }).limit(cap).lean(),
      QuizAttempt.find({ studentId: studentOid }).sort({ updatedAt: -1 }).limit(cap * 2).lean(),
    ]);

    const assignmentIds = [...new Set(worksheetAttempts.map((a) => a.assignmentId?.toString()).filter(Boolean))];
    const worksheetIds = [...new Set(worksheetAttempts.map((a) => a.worksheetId?.toString()).filter(Boolean))];
    const quizAssignmentIds = [...new Set(quizAttempts.map((a) => a.assignmentId?.toString()).filter(Boolean))];

    const [assignments, worksheets, quizAssignments] = await Promise.all([
      assignmentIds.length ? WorksheetAssignment.find({ _id: { $in: assignmentIds } }).lean() : [],
      worksheetIds.length ? Worksheet.find({ _id: { $in: worksheetIds } }).select("title").lean() : [],
      quizAssignmentIds.length ? QuizAssignment.find({ _id: { $in: quizAssignmentIds } }).lean() : [],
    ]);
    const lessonIdsFromQuiz = [...new Set((quizAssignments || []).flatMap((q) => (q.lessonId ? [q.lessonId] : [])))];
    const lessons = lessonIdsFromQuiz.length ? await Lesson.find({ _id: { $in: lessonIdsFromQuiz } }).select("title").lean() : [];

    const assignmentMap = new Map(assignments.map((a) => [a._id.toString(), a]));
    const worksheetMap = new Map(worksheets.map((w) => [w._id.toString(), w]));
    const quizAssignmentMap = new Map((quizAssignments || []).map((a) => [a._id.toString(), a]));
    const lessonMap = new Map((lessons || []).map((l) => [l._id.toString(), l]));

    const worksheetsOut = worksheetAttempts.slice(0, cap).map((a) => {
      const ass = assignmentMap.get(a.assignmentId?.toString());
      const ws = worksheetMap.get(a.worksheetId?.toString());
      const status = a.status || "IN_PROGRESS";
      const displayStatus =
        status === "IN_PROGRESS" ? "In progress" : status === "SUBMITTED" ? "Awaiting release" : status === "MARKED" ? "Released" : "Marked";
      const shareId = ass?.shareId;
      const shareLink = shareId ? `/w/${shareId}` : null;
      const attemptViewLink = `/student/worksheet-attempts/${a._id}`;
      return {
        attemptId: a._id.toString(),
        assignmentId: a.assignmentId?.toString(),
        worksheetTitle: ass?.title || ws?.title || "Worksheet",
        dueAt: ass?.dueAt ? ass.dueAt.toISOString() : null,
        status,
        isReleased: !!a.isReleased,
        score: a.isReleased ? (a.score ?? null) : null,
        maxScore: a.isReleased ? (a.maxScore ?? null) : null,
        updatedAt: (a.updatedAt || a.createdAt)?.toISOString?.() || null,
        link: shareLink || attemptViewLink,
        viewLink: attemptViewLink,
        id: a._id.toString(),
        title: ass?.title || ws?.title || "Worksheet",
        rawStatus: status,
        status: displayStatus,
        released: !!a.isReleased,
        submittedAt: a.submittedAt?.toISOString?.() || null,
        linkTo: shareLink || attemptViewLink,
      };
    });

    const quizzesOut = [];
    const assessmentsOut = [];
    for (const a of quizAttempts) {
      const qa = quizAssignmentMap.get(a.assignmentId?.toString());
      if (!qa) continue;
      const lesson = qa.lessonId ? lessonMap.get(qa.lessonId.toString()) : null;
      const lessonTitle = lesson?.title || qa.title || (qa.kind === "quiz" ? "Quiz" : "Assessment");
      const status = a.status || "IN_PROGRESS";
      const displayStatus =
        status === "IN_PROGRESS" ? "In progress" : status === "SUBMITTED" ? "Awaiting release" : status === "MARKED" ? "Released" : "Marked";
      const shareId = qa.shareId || "";
      const item = {
        attemptId: a._id.toString(),
        assignmentId: a.assignmentId?.toString(),
        lessonTitle,
        kind: qa.kind,
        dueAt: qa.dueAt ? qa.dueAt.toISOString() : null,
        status,
        isReleased: !!a.isReleased,
        score: a.isReleased ? (a.score ?? null) : null,
        maxScore: a.isReleased ? (a.maxScore ?? null) : null,
        updatedAt: (a.updatedAt || a.createdAt)?.toISOString?.() || null,
        link: shareId ? `/q/${shareId}` : "/q",
        id: a._id.toString(),
        title: lessonTitle,
        rawStatus: status,
        status: displayStatus,
        released: !!a.isReleased,
        submittedAt: a.submittedAt?.toISOString?.() || null,
        linkTo: shareId ? `/q/${shareId}` : "/q",
      };
      if (qa.kind === "quiz") quizzesOut.push(item);
      else assessmentsOut.push(item);
    }

    return res.json({
      ok: true,
      worksheets: worksheetsOut,
      quizzes: quizzesOut.slice(0, cap),
      assessments: assessmentsOut.slice(0, cap),
    });
  } catch (err) {
    console.error("Student my-work error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/student/progress — PR-STU-PROGRESS-1: reflection (quizzes attempted, avg score, needs practice)
router.get("/progress", auth, async (req, res) => {
  if (!isStudent(req)) {
    return res.status(403).json({ error: "Students only" });
  }
  try {
    const studentId = (req.user._id || req.user.userId || req.user.id).toString();
    const studentOid = new mongoose.Types.ObjectId(studentId);

    const quizAttempts = await QuizAttempt.find({
      studentId: studentOid,
      score: { $ne: null },
      maxScore: { $gt: 0 },
    })
      .select("assignmentId score maxScore submittedAt")
      .lean();

    const quizAssignmentIds = [...new Set(quizAttempts.map((a) => a.assignmentId?.toString()).filter(Boolean))];
    const quizAssignments = quizAssignmentIds.length
      ? await QuizAssignment.find({ _id: { $in: quizAssignmentIds } }).select("lessonId kind").lean()
      : [];
    const lessonIds = [...new Set(quizAssignments.filter((q) => q.lessonId).map((q) => q.lessonId))];
    const lessons = lessonIds.length ? await Lesson.find({ _id: { $in: lessonIds } }).select("subject topic topicKey").lean() : [];

    const qaMap = new Map(quizAssignments.map((a) => [a._id.toString(), a]));
    const lessonMap = new Map(lessons.map((l) => [l._id.toString(), l]));

    const taxonomy = getBiologyTopics();
    const allTopics = (taxonomy?.units || []).flatMap((u) => (u.topics || []).map((t) => ({ topicKey: t.key, topicName: t.topic || t.key })));

    const topicData = new Map();
    for (const t of allTopics) {
      topicData.set(t.topicKey, {
        topicKey: t.topicKey,
        topicName: t.topicName,
        attempted: false,
        quizAttempts: 0,
        totalRatio: 0,
        lastActivityAt: null,
      });
    }

    const subjectRatios = [];
    let lastActivityAt = null;

    for (const a of quizAttempts) {
      const qa = qaMap.get(a.assignmentId?.toString());
      if (!qa || !qa.lessonId) continue;
      const lesson = lessonMap.get(qa.lessonId.toString());
      if (!lesson) continue;

      const ratio = (a.score || 0) / a.maxScore;
      subjectRatios.push(ratio);
      const submittedAt = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      if (submittedAt && (!lastActivityAt || submittedAt > lastActivityAt)) lastActivityAt = submittedAt;

      const topicKey = (lesson.topicKey && String(lesson.topicKey).trim()) || topicToKey(lesson.topic) || "";
      if (!topicKey) continue;
      const data = topicData.get(topicKey);
      if (!data) {
        topicData.set(topicKey, {
          topicKey,
          topicName: lesson.topic || topicKey,
          attempted: true,
          quizAttempts: 1,
          totalRatio: ratio,
          lastActivityAt: a.submittedAt,
        });
      } else {
        data.attempted = true;
        data.quizAttempts += 1;
        data.totalRatio += ratio;
        if (a.submittedAt && (!data.lastActivityAt || new Date(a.submittedAt) > new Date(data.lastActivityAt))) {
          data.lastActivityAt = a.submittedAt;
        }
      }
    }

    const subjects = [];
    if (subjectRatios.length > 0) {
      const avg = subjectRatios.reduce((s, r) => s + r, 0) / subjectRatios.length;
      subjects.push({
        subject: "Biology",
        quizzesAttempted: subjectRatios.length,
        averageScore: Math.round(avg * 1000) / 1000,
        lastActivityAt: lastActivityAt ? new Date(lastActivityAt).toISOString() : null,
      });
    }

    const topics = Array.from(topicData.values()).map((d) => ({
      topicKey: d.topicKey,
      topicName: d.topicName,
      attempted: d.attempted,
      quizAttempts: d.quizAttempts,
      averageScore: d.quizAttempts > 0 ? Math.round((d.totalRatio / d.quizAttempts) * 1000) / 1000 : null,
      needsPractice: d.quizAttempts > 0 && d.totalRatio / d.quizAttempts < 0.4,
    }));

    topics.sort((a, b) => {
      if (a.attempted !== b.attempted) return a.attempted ? -1 : 1;
      return (a.topicName || "").localeCompare(b.topicName || "");
    });

    if (subjects.length === 0) {
      subjects.push({
        subject: "Biology",
        quizzesAttempted: 0,
        averageScore: null,
        lastActivityAt: null,
      });
    }

    return res.json({
      ok: true,
      subjects,
      topics,
    });
  } catch (err) {
    console.error("Student progress error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/student/knowledge-gap — Step 6: weak areas + "Your revision focus" LLM summary
router.get("/knowledge-gap", auth, async (req, res) => {
  if (!isStudent(req)) {
    return res.status(403).json({ error: "Students only" });
  }
  try {
    const studentId = (req.user._id || req.user.userId || req.user.id).toString();
    const studentOid = new mongoose.Types.ObjectId(studentId);

    const taxonomy = getBiologyTopics();
    const allTopics = (taxonomy?.units || []).flatMap((u) => (u.topics || []).map((t) => ({ topicKey: t.key, topicName: t.topic || t.key })));
    const topicNameByKey = new Map(allTopics.map((t) => [t.topicKey, t.topicName]));

    const weakAreas = [];

    // 1) PracticeAttempt: aggregate by topicKey (studentId) — correct vs total
    const practiceAgg = await PracticeAttempt.aggregate([
      { $match: { studentId: studentOid, topicKey: { $exists: true, $ne: "" } } },
      {
        $group: {
          _id: "$topicKey",
          total: { $sum: 1 },
          correct: {
            $sum: {
              $cond: [{ $or: [{ $eq: ["$outcome", "correct"] }, { $eq: ["$isCorrect", true] }] }, 1, 0],
            },
          },
        },
      },
      { $match: { total: { $gte: 1 } } },
    ]);

    for (const row of practiceAgg) {
      const topicKey = row._id;
      const total = row.total || 0;
      const correct = row.correct != null ? row.correct : 0;
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
      if (total >= 1 && pct < 70) {
        weakAreas.push({
          topicKey,
          topicName: topicNameByKey.get(topicKey) || topicKey,
          attempted: total,
          correct,
          total,
          percentage: pct,
        });
      }
    }

    // 2) Quiz attempts (same as progress): topic-level average; add weak topics not already in list
    const quizAttempts = await QuizAttempt.find({
      studentId: studentOid,
      score: { $ne: null },
      maxScore: { $gt: 0 },
    })
      .select("assignmentId score maxScore")
      .lean();
    const quizAssignmentIds = [...new Set(quizAttempts.map((a) => a.assignmentId?.toString()).filter(Boolean))];
    const quizAssignments =
      quizAssignmentIds.length > 0
        ? await QuizAssignment.find({ _id: { $in: quizAssignmentIds } }).select("lessonId").lean()
        : [];
    const lessonIds = [...new Set(quizAssignments.filter((q) => q.lessonId).map((q) => q.lessonId))];
    const lessons = lessonIds.length > 0 ? await Lesson.find({ _id: { $in: lessonIds } }).select("topic topicKey").lean() : [];
    const qaMap = new Map(quizAssignments.map((a) => [a._id.toString(), a]));
    const lessonMap = new Map(lessons.map((l) => [l._id.toString(), l]));

    const topicScores = new Map();
    for (const a of quizAttempts) {
      const qa = qaMap.get(a.assignmentId?.toString());
      if (!qa || !qa.lessonId) continue;
      const lesson = lessonMap.get(qa.lessonId.toString());
      if (!lesson) continue;
      const topicKey = (lesson.topicKey && String(lesson.topicKey).trim()) || topicToKey(lesson.topic) || "";
      if (!topicKey) continue;
      const ratio = (a.score || 0) / a.maxScore;
      if (!topicScores.has(topicKey)) topicScores.set(topicKey, []);
      topicScores.get(topicKey).push(ratio);
    }

    const existingKeys = new Set(weakAreas.map((w) => w.topicKey));
    for (const [topicKey, ratios] of topicScores) {
      if (existingKeys.has(topicKey)) continue;
      const avg = ratios.reduce((s, r) => s + r, 0) / ratios.length;
      const pct = Math.round(avg * 100);
      if (pct < 70) {
        weakAreas.push({
          topicKey,
          topicName: topicNameByKey.get(topicKey) || topicKey,
          attempted: ratios.length,
          correct: Math.round(avg * ratios.length),
          total: ratios.length,
          percentage: pct,
        });
      }
    }

    weakAreas.sort((a, b) => a.percentage - b.percentage);

    let summary = "";
    if (process.env.DISABLE_OPENAI === "1") {
      summary =
        weakAreas.length > 0
          ? `Focus your revision on: ${weakAreas.map((w) => w.topicName || w.topicKey).join(", ")}.`
          : "You have no weak areas identified yet. Keep practising to see personalised revision focus.";
      return res.json({ summary, weakAreas, _disabled: true });
    }

    if (weakAreas.length === 0) {
      return res.json({
        summary: "You have no weak areas identified yet. Keep completing quizzes and practice to see your revision focus here.",
        weakAreas: [],
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = (process.env.OPENAI_MODEL || "gpt-4o-mini").toString();
    const list = weakAreas.map((w) => `${w.topicName || w.topicKey}: ${w.percentage}% (${w.correct}/${w.total})`).join("\n");
    const userPrompt = `The following topics are this student's current weak areas (low scores or many wrong answers):\n\n${list}\n\nWrite 2–4 short, encouraging sentences suggesting where to focus revision. Use British English. Do not mention you are an AI.`;
    const systemPrompt = "You are a supportive UK curriculum tutor. Give brief, actionable revision focus advice.";

    try {
      const resp = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 200,
          temperature: 0.4,
        },
        {
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          timeout: 15000,
        }
      );
      summary = (resp.data?.choices?.[0]?.message?.content || "").trim() || "Focus on the topics listed below.";
    } catch (err) {
      summary = `Focus your revision on: ${weakAreas.map((w) => w.topicName || w.topicKey).join(", ")}.`;
    }

    return res.json({ summary, weakAreas });
  } catch (err) {
    console.error("Student knowledge-gap error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
