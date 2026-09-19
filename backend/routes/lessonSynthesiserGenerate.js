"use strict";

/**
 * Phase P1 — feature-gated Teacher Dashboard → Lesson Synthesiser → draft lesson.
 * Does not replace /api/ai/generate-and-save.
 */

const express = require("express");
const auth = require("../middleware/auth");
const { isLessonSynthesiserV1Enabled } = require("../config/lessonSynthesiserV1");
const { mapTeacherBodyToSynthesiseInput } = require("../services/lessonSynthesiser/supportedTopics");
const {
  callLessonSynthesiser,
  buildDraftEnvelopeFromPipelinePayload,
} = require("../services/lessonSynthesiser/synthesiserClient");
const {
  createLessonFromSynthesiserEnvelope,
} = require("../services/lessonSynthesiser/createLessonFromSynthesiserEnvelope");

const router = express.Router();

function requireTeacherOrAdmin(req, res) {
  if (req.user?.userType === "teacher" || req.user?.userType === "admin") {
    return true;
  }
  res.status(403).json({
    ok: false,
    code: "FORBIDDEN",
    message: "Only teachers and admins can generate lessons.",
  });
  return false;
}

function fail(res, status, code, message, errors = []) {
  return res.status(status).json({ ok: false, code, message, errors });
}

router.get("/lesson-synthesiser-v1/status", auth, (req, res) => {
  if (!req.user) return fail(res, 401, "UNAUTHENTICATED", "Not authenticated.");
  return res.json({
    ok: true,
    enabled: isLessonSynthesiserV1Enabled(),
    supportedTopics: require("../services/lessonSynthesiser/supportedTopics")
      .listP1SupportedTopicIdentities()
      .map((t) => ({
        specKey: t.specKey,
        topicKey: t.topicKey,
        teacherTopicKey: t.teacherTopicKey,
        tierMode: t.tierMode,
      })),
  });
});

router.post("/generate-with-lesson-synthesiser-v1", auth, async (req, res) => {
  if (!req.user) return fail(res, 401, "UNAUTHENTICATED", "Not authenticated.");
  if (!requireTeacherOrAdmin(req, res)) return;

  if (!isLessonSynthesiserV1Enabled()) {
    return fail(
      res,
      404,
      "LESSON_SYNTHESISER_V1_DISABLED",
      "Lesson Synthesiser generation is not enabled on this environment."
    );
  }

  const mapped = mapTeacherBodyToSynthesiseInput(req.body || {});
  if (!mapped.ok) {
    const status = mapped.code === "SYNTHESISER_TOPIC_UNSUPPORTED" ? 422 : 400;
    return fail(res, status, mapped.code, mapped.message);
  }

  console.info("[LessonSynthesiserV1] synthesise requested", {
    userId: String(req.user._id),
    specKey: mapped.synthesiseInput.specKey,
    topicKey: mapped.synthesiseInput.topicKey,
    tier: mapped.synthesiseInput.tier ?? null,
  });

  const synth = await callLessonSynthesiser(mapped.synthesiseInput, {
    fetchImpl: req.lessonSynthesiserFetchImpl,
  });

  if (!synth.ok) {
    console.warn("[LessonSynthesiserV1] synthesise call failed", {
      code: synth.code,
      userId: String(req.user._id),
    });
    const status =
      synth.code === "SYNTHESISER_TIMEOUT" || synth.code === "SYNTHESISER_UNREACHABLE"
        ? 503
        : 502;
    return fail(res, status, synth.code, synth.message, synth.details ? [synth.details] : []);
  }

  const pipeline = synth.payload;
  if (!pipeline?.ok) {
    console.warn("[LessonSynthesiserV1] pipeline quality failure", {
      code: pipeline?.code,
      userId: String(req.user._id),
    });
    return fail(
      res,
      422,
      pipeline?.code || "SYNTHESISER_GENERATION_FAILED",
      pipeline?.message || "Lesson Synthesiser generation failed quality checks.",
      Array.isArray(pipeline?.errors) ? pipeline.errors : []
    );
  }

  const envelope = buildDraftEnvelopeFromPipelinePayload(pipeline);
  if (!envelope?.draft) {
    return fail(
      res,
      502,
      "SYNTHESISER_EXPORT_MISSING",
      "Lesson Synthesiser succeeded but returned no export draft."
    );
  }

  const teacherName =
    [req.user.firstName, req.user.lastName].filter(Boolean).join(" ").trim() ||
    req.user.email ||
    "Teacher";

  const saved = await createLessonFromSynthesiserEnvelope(envelope, {
    ownerTeacherId: req.user._id,
    teacherName,
    generationProvenance: {
      generationEngine: "lesson-synthesiser",
      path: "teacher-dashboard-generate-with-lesson-synthesiser-v1",
      generatedAt: new Date().toISOString(),
      synthesiserCode: pipeline.code || null,
      synthesiserMode: pipeline.mode || null,
    },
  });

  if (!saved.ok) {
    console.error("[LessonSynthesiserV1] ingest failed", {
      code: saved.code,
      userId: String(req.user._id),
    });
    return fail(res, 422, saved.code, saved.message, saved.errors || []);
  }

  console.info("[LessonSynthesiserV1] lesson created", {
    lessonId: saved.lessonId,
    userId: String(req.user._id),
  });

  return res.status(201).json({
    ok: true,
    lessonId: saved.lessonId,
    editPath: saved.editPath,
    status: saved.status,
    isPublished: saved.isPublished,
    generationEngine: "lesson-synthesiser",
    synthesiser: {
      code: pipeline.code,
      mode: pipeline.mode,
      specKey: mapped.synthesiseInput.specKey,
      topicKey: mapped.synthesiseInput.topicKey,
    },
  });
});

module.exports = router;
