"use strict";

/**
 * Dedicated Lesson Synthesiser draft receiver.
 * POST /drafts only — scoped token auth, draft-only create.
 */

const express = require("express");
const mongoose = require("mongoose");
const lessonSynthesiserAuth = require("../middleware/lessonSynthesiserAuth");
const {
  validateLessonSynthesiserDraftEnvelope,
} = require("../utils/lessonSynthesiserDraftValidator");
const {
  adaptSynthesiserDraftToLessonCreate,
} = require("../utils/lessonSynthesiserDraftAdapter");
const { groundLessonQuizBeforePersist } = require("../utils/groundLessonQuizBeforePersist");
const {
  auditAndLogSynthesiserPageQuizShadow,
} = require("../utils/synthesiserPageQuizAlignmentAudit");
const Lesson = require("../models/Lesson");
const User = require("../models/User");

const router = express.Router();

function fail(res, status, code, message, errors = []) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    errors,
  });
}

router.post("/drafts", lessonSynthesiserAuth, async (req, res) => {
  try {
    const validation = validateLessonSynthesiserDraftEnvelope(req.body);
    if (!validation.ok) {
      return fail(
        res,
        400,
        validation.errors[0]?.code || "SYNTHESISER_VALIDATION_FAILED",
        "Lesson Synthesiser draft validation failed.",
        validation.errors
      );
    }

    const ownerTeacherIdRaw = process.env.LETSREVISE_SYNTHESISER_OWNER_TEACHER_ID;
    if (ownerTeacherIdRaw == null || !String(ownerTeacherIdRaw).trim()) {
      return fail(
        res,
        500,
        "SYNTHESISER_OWNER_CONFIG",
        "Lesson Synthesiser owner teacher id is not configured."
      );
    }

    const ownerTeacherId = String(ownerTeacherIdRaw).trim();
    if (!mongoose.Types.ObjectId.isValid(ownerTeacherId)) {
      return fail(
        res,
        500,
        "SYNTHESISER_OWNER_CONFIG",
        "Lesson Synthesiser owner teacher id is invalid."
      );
    }

    const owner = await User.findById(ownerTeacherId)
      .select("_id userType firstName lastName email")
      .lean();
    if (!owner) {
      return fail(
        res,
        500,
        "SYNTHESISER_OWNER_CONFIG",
        "Lesson Synthesiser owner teacher was not found."
      );
    }
    if (owner.userType !== "teacher" && owner.userType !== "admin") {
      return fail(
        res,
        500,
        "SYNTHESISER_OWNER_CONFIG",
        "Lesson Synthesiser owner must be a teacher or admin user."
      );
    }

    const teacherName =
      [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim() ||
      "Lesson Synthesiser";

    const createDoc = adaptSynthesiserDraftToLessonCreate(req.body.draft, {
      ownerTeacherId: owner._id,
      teacherName,
    });

    groundLessonQuizBeforePersist(createDoc);

    try {
      auditAndLogSynthesiserPageQuizShadow(createDoc);
    } catch (shadowAuditError) {
      console.warn("[TeacherBrain][PageQuizShadow] audit failed (fail-open)", {
        message: shadowAuditError?.message || String(shadowAuditError),
        topicKey: createDoc?.topicKey || null,
        specKey: createDoc?.specKey || null,
      });
    }

    // Force draft / unpublished immediately before save (defence in depth).
    createDoc.status = "draft";
    createDoc.isPublished = false;

    const lesson = new Lesson(createDoc);
    lesson.status = "draft";
    lesson.isPublished = false;
    await lesson.save();

    // Re-read alignment after pre-save hook.
    if (lesson.status !== "draft" || lesson.isPublished !== false) {
      lesson.status = "draft";
      lesson.isPublished = false;
      await lesson.save();
    }

    const lessonId = String(lesson._id);
    return res.status(201).json({
      ok: true,
      lessonId,
      status: "draft",
      isPublished: false,
      editPath: `/edit-lesson/${lessonId}`,
    });
  } catch (err) {
    return fail(
      res,
      500,
      "SYNTHESISER_DRAFT_CREATE_FAILED",
      err?.message || "Failed to create Lesson Synthesiser draft.",
      []
    );
  }
});

module.exports = router;
