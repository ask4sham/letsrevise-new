/**
 * PR-014.1: Publish gate — check and publish generated content.
 */
const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");
const ContentGenerationJob = require("../models/ContentGenerationJob");
const { validatePublishableContent, validateStarterPackPublishability } = require("../services/publishGate/validatePublishableContent");
const { sendInternalError } = require("../utils/safeErrorResponse");

function requireTeacherOrAdmin(req, res) {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  if (t !== "teacher" && t !== "admin") {
    res.status(403).json({ error: "Teacher or admin only" });
    return false;
  }
  return true;
}

/**
 * GET /api/publish-gate/check?jobId=...
 * PR-014.1a: Uses validateStarterPackPublishability (ownership check, fixLink in response).
 * Also supports scope=starterPack&jobId=... for backward compatibility.
 */
async function getCheck(req, res) {
  if (!requireTeacherOrAdmin(req, res)) return;

  const { scope, jobId, lessonId, topicKey, specKey } = req.query || {};
  const jid = jobId ? String(jobId).trim() : null;

  if (!jid) {
    return res.status(400).json({ error: "jobId is required" });
  }

  try {
    const result = await validateStarterPackPublishability({
      jobId: jid,
      user: req.user,
    });
    return res.json(result);
  } catch (err) {
    console.error("[publishGate] check error:", err);
    return sendInternalError("publish-gate/check", err, res, { extra: { error: "Check failed" } });
  }
}

/**
 * POST /api/publish-gate/publish
 * Body: { jobId }  — PR-014.1b: jobId only
 */
async function postPublish(req, res) {
  if (!requireTeacherOrAdmin(req, res)) return;

  const { jobId } = req.body || {};
  const jid = jobId ? String(jobId).trim() : null;

  if (!jid) {
    return res.status(400).json({ error: "jobId is required" });
  }

  if (!mongoose.Types.ObjectId.isValid(jid)) {
    return res.status(400).json({ error: "Invalid jobId" });
  }

  const userId = req.user._id || req.user.userId || req.user.id;

  try {
    const check = await validateStarterPackPublishability({ jobId: jid, user: req.user });
    if (!check.ok || check.blocks > 0) {
      return res.status(400).json({
        error: "Fix issues first",
        blocks: check.blocks,
        issues: check.issues,
        summaryByType: check.summaryByType,
      });
    }

    const job = await ContentGenerationJob.findById(jid);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Verify user can publish (creator or admin)
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user?.isAdmin === true;
    const isCreator = String(job.requestedBy) === String(userId);
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: "Only job creator or admin can publish" });
    }

    let lessonCount = 0;
    let flashcardCount = 0;
    let quizCount = 0;
    let examCount = 0;

    if (job.outputs?.lessonId) {
      const lesson = await Lesson.findById(job.outputs.lessonId);
      if (lesson && lesson.status === "draft") {
        lesson.status = "published";
        lesson.isPublished = true;
        await lesson.save();
        lessonCount = 1;
      }
    }

    if (Array.isArray(job.outputs?.flashcardIds) && job.outputs.flashcardIds.length > 0) {
      const r = await TopicFlashcard.updateMany(
        { _id: { $in: job.outputs.flashcardIds }, status: "draft" },
        { $set: { status: "published", publishedBy: userId, publishedAt: new Date() } }
      );
      flashcardCount = r.modifiedCount;
    }

    if (Array.isArray(job.outputs?.quizQuestionIds) && job.outputs.quizQuestionIds.length > 0) {
      const r = await TopicQuizQuestion.updateMany(
        { _id: { $in: job.outputs.quizQuestionIds }, status: "draft" },
        { $set: { status: "published", publishedBy: userId, publishedAt: new Date() } }
      );
      quizCount = r.modifiedCount;
    }

    if (Array.isArray(job.outputs?.examQuestionIds) && job.outputs.examQuestionIds.length > 0) {
      const r = await ExamQuestion.updateMany(
        { _id: { $in: job.outputs.examQuestionIds }, status: "draft" },
        { $set: { status: "published" } }
      );
      examCount = r.modifiedCount;
    }

    job.publishedAt = new Date();
    job.publishedBy = userId;
    await job.save();

    // PR-015: Enqueue knowledge refresh (async, non-blocking)
    const { enqueueKnowledgeRefresh } = require("../services/jobs/enqueueKnowledgeRefresh");
    enqueueKnowledgeRefresh({ specKey: job.specKey, topicKey: job.topicKey, sourceTypes: ["lessonBlock", "specStatement"], userId }).catch((e) =>
      console.error("[publishGate] enqueueKnowledgeRefresh error:", e?.message)
    );

    return res.json({
      ok: true,
      published: {
        lesson: lessonCount > 0,
        flashcards: flashcardCount,
        quiz: quizCount,
        exam: examCount,
      },
      lessonId: job.outputs?.lessonId ? String(job.outputs.lessonId) : null,
      topicKey: job.topicKey,
    });
  } catch (err) {
    console.error("[publishGate] publish error:", err);
    return sendInternalError("publish-gate/publish", err, res, { extra: { error: "Publish failed" } });
  }
}

module.exports = { getCheck, postPublish };
