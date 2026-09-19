"use strict";

/**
 * Dedicated Lesson Synthesiser draft receiver.
 * POST /drafts only — scoped token auth, draft-only create.
 */

const express = require("express");
const mongoose = require("mongoose");
const lessonSynthesiserAuth = require("../middleware/lessonSynthesiserAuth");
const {
  createLessonFromSynthesiserEnvelope,
} = require("../services/lessonSynthesiser/createLessonFromSynthesiserEnvelope");
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

    const saved = await createLessonFromSynthesiserEnvelope(req.body, {
      ownerTeacherId: owner._id,
      teacherName,
      generationProvenance: {
        generationEngine: "lesson-synthesiser",
        path: "service-push-lesson-synthesiser-drafts",
        generatedAt: new Date().toISOString(),
      },
    });

    if (!saved.ok) {
      const status =
        saved.code === "SYNTHESISER_VALIDATION_FAILED" ||
        (Array.isArray(saved.errors) && saved.errors.length > 0)
          ? 400
          : 422;
      return fail(res, status, saved.code, saved.message, saved.errors || []);
    }

    return res.status(201).json({
      ok: true,
      lessonId: saved.lessonId,
      status: saved.status,
      isPublished: saved.isPublished,
      editPath: saved.editPath,
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
