/**
 * Draft-only AI curriculum alignment review for lessons.
 * - Suggestions only; never mutates lesson body here.
 * - Uses spec points from syllabusAlignment when specKey + topicKey exist.
 * Separate from: heuristic qualityScore, CheckpointGenerationJob (post-publish checkpoints).
 */
const axios = require("axios");
const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");
const { getSpecPointsForTopic } = require("./syllabusAlignment");

const PROMPT_VERSION = "v1";

/** Feature flags (opt-in). */
function isCurriculumAiReviewEnabled() {
  return String(process.env.CURRICULUM_AI_REVIEW_ENABLED || "").toLowerCase() === "true";
}

function isAutoRunOnDraftSaveEnabled() {
  return String(process.env.CURRICULUM_AI_REVIEW_ON_DRAFT_SAVE || "").toLowerCase() === "true";
}

/** Phase 1: single auto-run on first qualifying draft save (new lesson / first edit path). */
function isPhase1AutoOnceEnabled() {
  return String(process.env.CURRICULUM_AI_REVIEW_PHASE1_AUTO_ONCE || "").toLowerCase() === "true";
}

/** Soft publish warnings (never blocks publish in v1). */
function isPublishCurriculumWarningEnabled() {
  return String(process.env.CURRICULUM_AI_REVIEW_PUBLISH_WARNINGS || "").toLowerCase() === "true";
}

function getCurriculumPublishMinScore() {
  const n = Number(process.env.CURRICULUM_AI_REVIEW_MIN_PUBLISH_SCORE);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : 60;
}

/**
 * Non-blocking publish hint: missing review or match score below threshold.
 * @returns {null | { code: string, message: string, severity: string, curriculumMatchScore?: number, minScore?: number }}
 */
function getCurriculumReviewPublishWarning(lesson) {
  if (!isCurriculumAiReviewEnabled() || !isPublishCurriculumWarningEnabled()) return null;
  const cr = lesson.curriculumAiReview;
  const minScore = getCurriculumPublishMinScore();
  if (!cr || cr.status !== "completed" || !cr.result || typeof cr.result !== "object") {
    return {
      code: "CURRICULUM_REVIEW_MISSING_OR_INCOMPLETE",
      message:
        "No completed curriculum AI review yet. Run “Check against curriculum” for spec-aligned feedback before publishing.",
      severity: "warning",
    };
  }
  const score = Number(cr.result.curriculumMatchScore);
  if (Number.isFinite(score) && score < minScore) {
    return {
      code: "CURRICULUM_REVIEW_BELOW_THRESHOLD",
      message: `Curriculum match score (${score}) is below the recommended minimum (${minScore}). You can still publish.`,
      severity: "warning",
      curriculumMatchScore: Math.round(score),
      minScore,
    };
  }
  return null;
}

const _running = new Set();

/**
 * Phase 4 — controlled auto-run on draft save (PUT) when CURRICULUM_AI_REVIEW_ON_DRAFT_SAVE=true.
 * Safe conditions: lesson.status==="draft", not published, feature flags on; skips if review running/queued,
 * if last completed review is within CURRICULUM_AI_REVIEW_AUTO_MIN_INTERVAL_* (default 6h), or within
 * CURRICULUM_AI_REVIEW_DRAFT_SAVE_DEBOUNCE_MS since last scheduled run (default 2m). Concurrent runs use _running.
 * Logging: set CURRICULUM_AI_REVIEW_LOG_AUTO=true for JSON lines on schedule/skip in all environments.
 */
const _draftSaveDebounceLast = new Map();

function getDraftSaveDebounceMs() {
  const n = Number(process.env.CURRICULUM_AI_REVIEW_DRAFT_SAVE_DEBOUNCE_MS);
  if (Number.isFinite(n) && n >= 0) return Math.min(n, 600000);
  return 120000;
}

/** Minimum time after a completed review before auto draft_save runs again (Phase 4). */
function getAutoMinIntervalMs() {
  const h = Number(process.env.CURRICULUM_AI_REVIEW_AUTO_MIN_INTERVAL_HOURS);
  if (Number.isFinite(h) && h >= 0) return Math.min(h * 3600000, 168 * 3600000);
  const ms = Number(process.env.CURRICULUM_AI_REVIEW_AUTO_MIN_INTERVAL_MS);
  if (Number.isFinite(ms) && ms >= 0) return ms;
  return 6 * 3600000;
}

function shouldLogCurriculumAuto() {
  return String(process.env.CURRICULUM_AI_REVIEW_LOG_AUTO || "").toLowerCase() === "true";
}

function logCurriculumAuto(message, meta = {}) {
  if (!shouldLogCurriculumAuto() && process.env.NODE_ENV === "production") return;
  const payload = { msg: message, ...meta };
  if (shouldLogCurriculumAuto()) {
    console.info("[curriculumAiReview:auto]", JSON.stringify(payload));
  } else if (process.env.NODE_ENV !== "production") {
    console.info("[curriculumAiReview:auto]", message, meta);
  }
}

/**
 * Phase 4: safe auto-run on draft save — only status=draft, not published, not if review recent or debounced.
 * @returns {{ skip: boolean, reason?: string }}
 */
function shouldSkipAutoDraftSaveReview(lesson) {
  if (!lesson) return { skip: true, reason: "no_lesson" };
  if (lesson.isPublished === true) return { skip: true, reason: "published" };
  const st = String(lesson.status || "draft").toLowerCase();
  if (st === "published") return { skip: true, reason: "published" };
  if (st !== "draft") {
    return { skip: true, reason: "not_draft" };
  }
  const cr = lesson.curriculumAiReview;
  if (cr && (cr.status === "running" || cr.status === "queued")) {
    return { skip: true, reason: "already_running" };
  }
  if (cr && cr.status === "completed" && cr.generatedAt) {
    const t = new Date(cr.generatedAt).getTime();
    if (Number.isFinite(t) && Date.now() - t < getAutoMinIntervalMs()) {
      return { skip: true, reason: "recent_completed_review" };
    }
  }
  return { skip: false };
}

function isDebouncedDraftSave(lessonId) {
  const id = String(lessonId);
  const ms = getDraftSaveDebounceMs();
  if (ms === 0) return false;
  const last = _draftSaveDebounceLast.get(id);
  return !!(last && Date.now() - last < ms);
}

function markDraftSaveScheduled(lessonId) {
  _draftSaveDebounceLast.set(String(lessonId), Date.now());
}

/**
 * Phase 4: controlled draft_save auto-run — debounce, skip if recent success, reuse _running.
 * @returns {Promise<{ scheduled: boolean, reason?: string }>}
 */
async function scheduleDraftSaveCurriculumReviewIfEligible(lessonId) {
  const id = String(lessonId);
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { scheduled: false, reason: "invalid_id" };
  }
  if (_running.has(id)) {
    logCurriculumAuto("skip_draft_save", { lessonId: id, reason: "concurrent_in_running_set" });
    return { scheduled: false, reason: "concurrent_in_running_set" };
  }

  const lesson = await Lesson.findById(id).select("status isPublished curriculumAiReview").lean();
  const skip = shouldSkipAutoDraftSaveReview(lesson);
  if (skip.skip) {
    logCurriculumAuto("skip_draft_save", { lessonId: id, reason: skip.reason });
    return { scheduled: false, reason: skip.reason };
  }

  if (isDebouncedDraftSave(id)) {
    logCurriculumAuto("skip_draft_save", { lessonId: id, reason: "debounce" });
    return { scheduled: false, reason: "debounce" };
  }

  markDraftSaveScheduled(id);

  setImmediate(() => {
    runCurriculumAiReviewForLesson({
      lessonId,
      trigger: "draft_save",
      internal: true,
    })
      .then(() => {
        logCurriculumAuto("draft_save_completed", { lessonId: id });
      })
      .catch((e) => {
        const msg = e?.message || String(e);
        if (msg.includes("already running")) {
          logCurriculumAuto("draft_save_race", { lessonId: id, error: msg });
        } else {
          console.error("[curriculumAiReview] draft_save:", msg);
        }
      });
  });

  logCurriculumAuto("draft_save_scheduled", { lessonId: id });
  return { scheduled: true };
}

function safeStr(v, fb = "") {
  const s = v === undefined || v === null ? "" : String(v);
  return s.trim() ? s.trim() : fb;
}

/**
 * Flatten lesson pages + legacy content into a single text block for the model (bounded).
 */
function extractLessonTextForReview(lesson, maxChars = 48000) {
  const parts = [];
  parts.push(`TITLE: ${safeStr(lesson.title)}\n`);
  parts.push(`DESCRIPTION: ${safeStr(lesson.description)}\n`);
  parts.push(`SUBJECT: ${safeStr(lesson.subject)} | LEVEL: ${safeStr(lesson.level)} | TOPIC: ${safeStr(lesson.topic)}\n`);
  if (lesson.specKey) parts.push(`SPEC_KEY: ${lesson.specKey}\n`);
  if (lesson.topicKey) parts.push(`TOPIC_KEY: ${lesson.topicKey}\n`);
  if (lesson.mainTopic) parts.push(`MAIN_TOPIC: ${lesson.mainTopic}\n`);
  if (lesson.subTopic) parts.push(`SUB_TOPIC: ${lesson.subTopic}\n`);
  if (lesson.tier) parts.push(`TIER: ${lesson.tier}\n`);
  if (lesson.board) parts.push(`BOARD: ${lesson.board}\n`);

  const legacy = safeStr(lesson.content);
  if (legacy) parts.push(`\n--- LEGACY CONTENT ---\n${legacy.slice(0, 12000)}\n`);

  if (Array.isArray(lesson.pages) && lesson.pages.length) {
    lesson.pages.forEach((p, i) => {
      parts.push(`\n--- PAGE ${i + 1} (${safeStr(p.pageId, "?")}) ${safeStr(p.title, "Untitled")} ---\n`);
      const blocks = Array.isArray(p.blocks) ? p.blocks : [];
      blocks.forEach((b, bi) => {
        const type = safeStr(b.type, "text");
        let chunk = "";
        if (type === "checkpoint" || type === "pageQuiz") {
          chunk = `[${type}] ${safeStr(b.prompt || b.question)}\nOptions: ${(b.options || []).join("; ")}`;
        } else if (type === "diagram") {
          chunk = `[diagram] ${safeStr(b.caption)} ${safeStr(b.note)}`;
        } else {
          chunk = `[${type}] ${safeStr(b.title)} ${safeStr(b.content)}\n${safeStr(b.explanation)}`;
        }
        parts.push(chunk.slice(0, 4000) + (chunk.length > 4000 ? "…" : ""));
      });
      if (p.checkpoint && typeof p.checkpoint === "object") {
        const ck = p.checkpoint;
        parts.push(
          `[page checkpoint] Q: ${safeStr(ck.question)} | A: ${safeStr(ck.answer)} | type: ${safeStr(ck.type, "mcq")}\n`
        );
      }
    });
  }

  let out = parts.join("\n");
  if (out.length > maxChars) out = out.slice(0, maxChars) + "\n…[truncated]";
  return out;
}

function parseTopicSlugFromTopicKey(topicKey) {
  if (!topicKey || typeof topicKey !== "string") return null;
  const t = topicKey.trim();
  if (!t) return null;
  const idx = t.indexOf(":");
  if (idx === -1) return t;
  return t.slice(idx + 1).trim() || null;
}

/**
 * Build curriculum context from bundled spec points (optional).
 */
function buildSpecContextBlock(specKey, topicKey) {
  const slug = parseTopicSlugFromTopicKey(topicKey) || topicKey;
  const points = getSpecPointsForTopic(specKey, slug);
  if (!points.length) {
    return "No bundled specification bullet list was found for this spec/topic. Base review on lesson metadata, UK GCSE expectations, and the lesson text only. Do not invent official spec statement codes.";
  }
  const lines = points.slice(0, 80).map((p, i) => `${i + 1}. ${p}`);
  return `REFERENCE SPEC POINTS (bundled — use as alignment guide only; do not claim official exam board wording unless it appears in the lesson):\n${lines.join("\n")}`;
}

/**
 * Validate and normalise LLM JSON into a stable shape for persistence.
 */
function validateAndNormalizeReviewResult(raw) {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Empty or non-object response" };
  }
  const curriculumMatchScore = Number(raw.curriculumMatchScore);
  const lessonQualityScore = Number(raw.lessonQualityScore);
  if (!Number.isFinite(curriculumMatchScore) || curriculumMatchScore < 0 || curriculumMatchScore > 100) {
    return { ok: false, error: "Invalid curriculumMatchScore (expect 0–100)" };
  }
  if (!Number.isFinite(lessonQualityScore) || lessonQualityScore < 0 || lessonQualityScore > 100) {
    return { ok: false, error: "Invalid lessonQualityScore (expect 0–100)" };
  }

  const arr = (v) => (Array.isArray(v) ? v : []);
  const strArr = (v) => arr(v).map((x) => (typeof x === "string" ? x : JSON.stringify(x))).slice(0, 100);

  const out = {
    status: "completed",
    curriculumMatchScore: Math.round(curriculumMatchScore),
    lessonQualityScore: Math.round(lessonQualityScore),
    issues: strArr(raw.issues).slice(0, 50),
    warnings: strArr(raw.warnings).slice(0, 50),
    missingCoverage: strArr(raw.missingCoverage).slice(0, 40),
    terminologyFixes: arr(raw.terminologyFixes)
      .filter((x) => x && typeof x === "object")
      .slice(0, 30)
      .map((x) => ({
        from: safeStr(x.from || x.term),
        to: safeStr(x.to || x.suggestion),
        note: safeStr(x.note || x.reason),
      })),
    suggestedRewrites: arr(raw.suggestedRewrites)
      .filter((x) => x && typeof x === "object")
      .slice(0, 25)
      .map((x) => ({
        section: safeStr(x.section || x.location),
        originalSnippet: safeStr(x.originalSnippet || x.original).slice(0, 2000),
        suggestion: safeStr(x.suggestion).slice(0, 2000),
        note: safeStr(x.note || x.reason),
      })),
    suggestedObjectives: strArr(raw.suggestedObjectives).slice(0, 15),
    suggestedPriorKnowledge: strArr(raw.suggestedPriorKnowledge).slice(0, 15),
    suggestedKeywords: strArr(raw.suggestedKeywords).slice(0, 40),
    examAlignmentNotes: strArr(raw.examAlignmentNotes).slice(0, 20),
    checkpointAlignmentNotes: strArr(raw.checkpointAlignmentNotes).slice(0, 20),
  };

  return { ok: true, data: out };
}

async function callOpenAiCurriculumReview({ lessonText, specContext }) {
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error("LLM_API_KEY or OPENAI_API_KEY required for curriculum AI review");
  }
  const model = process.env.CURRICULUM_AI_REVIEW_MODEL || process.env.LLM_MODEL || "gpt-4o-mini";

  const system = `You are a UK GCSE curriculum alignment reviewer for lesson drafts on LetsRevise.
Your job is to help teachers improve accuracy and exam readiness. You do NOT replace the teacher; you flag issues and suggest improvements.

Rules:
- Output a single JSON object only (no markdown fences).
- Be precise about UK GCSE tier/level when lesson.level or tier suggests foundation vs higher.
- Use the REFERENCE SPEC POINTS only as a guide when provided; do not invent statutory requirements not implied by those points or the lesson metadata.
- Do not claim the lesson "must" include a point unless it is clearly required for the stated topic/spec alignment.
- Flag factual risks as issues; pedagogical gaps as warnings or missingCoverage.
- suggestedRewrites: short, targeted alternatives — not full lesson rewrites.
- Keep terminologyFixes to real exam-language improvements.
- If checkpoints/quizzes appear misaligned with teaching blocks, note under checkpointAlignmentNotes.
- Scores: curriculumMatchScore and lessonQualityScore are integers 0–100.

JSON shape (all keys required; use empty arrays where nothing applies):
{
  "curriculumMatchScore": number,
  "lessonQualityScore": number,
  "issues": string[],
  "warnings": string[],
  "missingCoverage": string[],
  "terminologyFixes": [{ "from": string, "to": string, "note": string }],
  "suggestedRewrites": [{ "section": string, "originalSnippet": string, "suggestion": string, "note": string }],
  "suggestedObjectives": string[],
  "suggestedPriorKnowledge": string[],
  "suggestedKeywords": string[],
  "examAlignmentNotes": string[],
  "checkpointAlignmentNotes": string[]
}`;

  const user = `${specContext}\n\n--- LESSON DRAFT TEXT ---\n${lessonText}`;

  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.25,
      max_tokens: 4096,
    },
    { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 120000 }
  );

  const content = res.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error("Invalid JSON from model: " + e.message);
  }

  const norm = validateAndNormalizeReviewResult(parsed);
  if (!norm.ok) {
    throw new Error(norm.error || "Validation failed");
  }

  return {
    result: norm.data,
    usage: res.data?.usage || null,
    model,
    provider: "openai",
  };
}

/**
 * Run review and persist on lesson.curriculumAiReview.
 */
async function runCurriculumAiReviewForLesson({
  lessonId,
  userId,
  isAdmin = false,
  trigger = "manual",
  /** Set true for server-triggered draft_save (already authorized via PUT). */
  internal = false,
}) {
  const id = typeof lessonId === "string" ? lessonId : lessonId?.toString?.();
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid lesson id");
  }

  if (_running.has(id)) {
    throw new Error("A curriculum review is already running for this lesson");
  }
  _running.add(id);

  try {
    const lesson = await Lesson.findById(id);
    if (!lesson) throw new Error("Lesson not found");

    const status = String(lesson.status || "draft").toLowerCase();
    if (lesson.isPublished || status === "published") {
      throw new Error("Curriculum AI review is only available for draft lessons");
    }
    if (status !== "draft" && status !== "in_review") {
      throw new Error("Curriculum AI review is only available for draft or in_review lessons");
    }

    if (!internal && userId) {
      const isOwner = String(lesson.teacherId) === String(userId);
      if (!isOwner && !isAdmin) throw new Error("Not authorized");
    }

    lesson.curriculumAiReview = lesson.curriculumAiReview || {};
    lesson.curriculumAiReview.status = "running";
    lesson.curriculumAiReview.trigger = trigger;
    lesson.curriculumAiReview.startedAt = new Date();
    lesson.curriculumAiReview.lastError = null;
    lesson.curriculumAiReview.promptVersion = PROMPT_VERSION;
    await lesson.save();

    const lessonText = extractLessonTextForReview(lesson);
    const specContext = buildSpecContextBlock(lesson.specKey, lesson.topicKey);

    const { result, usage, model, provider } = await callOpenAiCurriculumReview({
      lessonText,
      specContext,
    });

    lesson.curriculumAiReview.status = "completed";
    lesson.curriculumAiReview.generatedAt = new Date();
    lesson.curriculumAiReview.result = {
      ...result,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          }
        : undefined,
    };
    lesson.curriculumAiReview.model = model;
    lesson.curriculumAiReview.provider = provider;
    await lesson.save();

    return lesson;
  } catch (err) {
    const lesson = await Lesson.findById(id);
    if (lesson) {
      lesson.curriculumAiReview = lesson.curriculumAiReview || {};
      lesson.curriculumAiReview.status = "failed";
      lesson.curriculumAiReview.lastError = safeStr(err?.message, "Unknown error").slice(0, 2000);
      lesson.curriculumAiReview.generatedAt = new Date();
      await lesson.save().catch(() => {});
    }
    throw err;
  } finally {
    _running.delete(id);
  }
}

module.exports = {
  PROMPT_VERSION,
  isCurriculumAiReviewEnabled,
  isAutoRunOnDraftSaveEnabled,
  isPhase1AutoOnceEnabled,
  isPublishCurriculumWarningEnabled,
  getCurriculumPublishMinScore,
  getCurriculumReviewPublishWarning,
  shouldSkipAutoDraftSaveReview,
  scheduleDraftSaveCurriculumReviewIfEligible,
  getDraftSaveDebounceMs,
  getAutoMinIntervalMs,
  extractLessonTextForReview,
  validateAndNormalizeReviewResult,
  buildSpecContextBlock,
  runCurriculumAiReviewForLesson,
};
