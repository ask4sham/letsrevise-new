/**
 * P1 GCSE Visual Explanation — POST /api/visual-explanations/generate
 * Response-only v1: no Mongo persistence.
 */
const express = require("express");
const crypto = require("crypto");
const auth = require("../middleware/auth");
const { isVisualExplanationEnabled } = require("../config/visualExplanationFlags");
const {
  buildVisualExplanation,
  ValueError,
} = require("../services/visualExplanation");

const router = express.Router();

const VISUAL_TIMEOUT_MS = 120_000;

function safeStr(v, fallback = "") {
  const s = v === undefined || v === null ? "" : String(v);
  return s.trim() ? s.trim() : fallback;
}

function requireTeacherOrAdmin(req, res) {
  const t = safeStr(req.user?.userType, "").toLowerCase();
  if (t !== "teacher" && t !== "admin") {
    res.status(403).json({ error: "Only teachers/admin can use visual explanations" });
    return false;
  }
  return true;
}

function validateRequest(body) {
  const topic = safeStr(body?.topic);
  if (topic.length < 2) {
    return { ok: false, status: 422, body: { code: "INVALID_VISUAL_EXPLANATION", message: "topic must be at least 2 characters" } };
  }
  if (topic.length > 200) {
    return { ok: false, status: 422, body: { code: "INVALID_VISUAL_EXPLANATION", message: "topic must be at most 200 characters" } };
  }
  const context = body?.context != null ? safeStr(body.context) : null;
  if (context && context.length > 600) {
    return { ok: false, status: 422, body: { code: "INVALID_VISUAL_EXPLANATION", message: "context must be at most 600 characters" } };
  }
  return {
    ok: true,
    payload: {
      topic,
      context: context || null,
      subject: safeStr(body?.subject, "GCSE Biology"),
      examBoard: safeStr(body?.exam_board ?? body?.examBoard, "AQA"),
      tier: safeStr(body?.tier, "Higher"),
      lessonId: body?.lesson_id != null ? safeStr(body.lesson_id) || null : null,
      blockKey: body?.block_key != null ? safeStr(body.block_key) || null : null,
    },
  };
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error("LLM_TIMEOUT");
      err.code = "LLM_TIMEOUT";
      reject(err);
    }, ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

router.post("/generate", auth, async (req, res) => {
  if (!isVisualExplanationEnabled()) {
    return res.status(404).json({
      code: "FEATURE_DISABLED",
      message: "Visual explanation is not enabled on this server.",
    });
  }

  if (!requireTeacherOrAdmin(req, res)) return;

  if (process.env.DISABLE_OPENAI === "1") {
    return res.status(503).json({
      code: "LLM_PROVIDER_UNAVAILABLE",
      message: "The AI service is temporarily unavailable. Please try again.",
      retryable: true,
      _disabled: true,
    });
  }

  const validated = validateRequest(req.body);
  if (!validated.ok) {
    return res.status(validated.status).json(validated.body);
  }

  const { topic, context, subject, examBoard, tier, lessonId, blockKey } = validated.payload;

  try {
    const { explanation, image, providerStatus } = await withTimeout(
      buildVisualExplanation({
        topic,
        subject,
        examBoard,
        tier,
        context,
      }),
      VISUAL_TIMEOUT_MS
    );

    const { image_prompt: _strip, ...clientExplanation } = explanation;
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    return res.json({
      id,
      lesson_id: lessonId,
      block_key: blockKey,
      topic,
      subject,
      exam_board: examBoard,
      tier,
      explanation: clientExplanation,
      image_data_url: image?.data_url ?? null,
      image_mime_type: image?.mime_type ?? null,
      provider_status: providerStatus,
      created_at: createdAt,
    });
  } catch (e) {
    if (e?.code === "LLM_TIMEOUT" || e?.message === "LLM_TIMEOUT") {
      return res.status(503).json({
        code: "LLM_TIMEOUT",
        message: "The AI service took too long to respond. Please try again.",
        retryable: true,
      });
    }
    if (e instanceof ValueError || e?.name === "ValueError") {
      return res.status(422).json({
        code: "INVALID_VISUAL_EXPLANATION",
        message: "The AI returned a malformed explanation. Please try again.",
      });
    }
    if (e?.code === "LLM_NOT_CONFIGURED") {
      return res.status(503).json({
        code: "LLM_PROVIDER_UNAVAILABLE",
        message: "The AI service is temporarily unavailable. Please try again.",
        retryable: true,
      });
    }
    console.error("[visual-explanation] generate failed:", e?.message || e);
    return res.status(503).json({
      code: "LLM_PROVIDER_UNAVAILABLE",
      message: "The AI service is temporarily unavailable. Please try again.",
      retryable: true,
    });
  }
});

module.exports = router;
