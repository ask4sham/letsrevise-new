/**
 * PR12: Record student practice/checkpoint attempts.
 * PR12.3: confidence 1-3, duplicate guard.
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const PracticeAttempt = require("../models/PracticeAttempt");

const MAX_SELECTED = 120;
const MAX_ANSWER_TEXT = 500;
const MAX_PAGE_ID_LEN = 320;
const DEDUPE_WINDOW_PRACTICE_MS = 10 * 1000;
const DEDUPE_WINDOW_CHECKPOINT_MS = 5 * 1000;

/**
 * Normalize optional checkpointRevision (string | number only).
 * @returns {{ ok: true, value: string|number|null } | { ok: false, error: string }}
 */
function parseCheckpointRevision(raw) {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return { ok: false, error: "checkpointRevision must be a finite number" };
    return { ok: true, value: raw };
  }
  if (typeof raw === "string") {
    const s = raw.trim().slice(0, 64);
    if (!s) return { ok: true, value: null };
    return { ok: true, value: s };
  }
  return { ok: false, error: "checkpointRevision must be a string or number" };
}

/**
 * POST /api/attempts
 * Body: { lessonId, source, questionType, questionId?, selected?, answerText?, isCorrect, confidence?, pageId?, checkpointRevision? }
 */
router.post("/", auth, async (req, res) => {
  try {
    const { lessonId, source, questionType, questionId, selected, answerText, isCorrect, confidence, pageId, checkpointRevision } =
      req.body || {};

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Invalid lessonId" });
    }
    if (!["checkpoint", "practice"].includes(String(source))) {
      return res.status(400).json({ error: "Invalid source" });
    }
    if (!["mcq", "short"].includes(String(questionType))) {
      return res.status(400).json({ error: "Invalid questionType" });
    }
    if (typeof isCorrect !== "boolean") {
      return res.status(400).json({ error: "isCorrect must be boolean" });
    }
    if (source === "practice" && !mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({ error: "practice source requires questionId" });
    }

    let pageIdStr;
    let revParsed = { ok: true, value: null };
    if (source === "checkpoint") {
      if (pageId !== undefined && pageId !== null && pageId !== "") {
        if (typeof pageId !== "string") {
          return res.status(400).json({ error: "pageId must be a string when provided" });
        }
        pageIdStr = pageId.trim().slice(0, MAX_PAGE_ID_LEN);
        if (!pageIdStr) {
          return res.status(400).json({ error: "pageId cannot be empty when provided" });
        }
      }
      revParsed = parseCheckpointRevision(checkpointRevision);
      if (!revParsed.ok) {
        return res.status(400).json({ error: revParsed.error });
      }
    }

    let confidenceFinal = 2;
    if (confidence !== undefined && confidence !== null) {
      const n = typeof confidence === "string" ? parseInt(confidence, 10) : Number(confidence);
      if (n !== 1 && n !== 2 && n !== 3) {
        return res.status(400).json({ error: "confidence must be 1, 2, or 3" });
      }
      confidenceFinal = n;
    }

    const selectedStr = typeof selected === "string" ? selected.slice(0, MAX_SELECTED) : "";
    const answerTextStr = typeof answerText === "string" ? answerText.slice(0, MAX_ANSWER_TEXT) : "";

    const userId = req.user._id;
    const lessonOid = new mongoose.Types.ObjectId(lessonId);
    const questionOid = source === "practice" && questionId ? new mongoose.Types.ObjectId(questionId) : null;

    if (source === "practice" && questionOid) {
      const since = new Date(Date.now() - DEDUPE_WINDOW_PRACTICE_MS);
      const dup = await PracticeAttempt.findOne({
        userId,
        lessonId: lessonOid,
        questionId: questionOid,
        createdAt: { $gte: since },
      }).lean();
      if (dup) return res.json({ ok: true, duplicate: true });
    } else {
      const since = new Date(Date.now() - DEDUPE_WINDOW_CHECKPOINT_MS);
      const dupAnd = [
        { userId },
        { lessonId: lessonOid },
        { source: "checkpoint" },
        { questionType },
        { createdAt: { $gte: since } },
      ];
      if (pageIdStr) {
        dupAnd.push({ pageId: pageIdStr });
      } else {
        dupAnd.push({
          $or: [{ pageId: { $exists: false } }, { pageId: null }, { pageId: "" }],
        });
      }
      if (revParsed.value != null) {
        dupAnd.push({ checkpointRevision: revParsed.value });
      } else {
        dupAnd.push({
          $or: [{ checkpointRevision: { $exists: false } }, { checkpointRevision: null }],
        });
      }
      const dup = await PracticeAttempt.findOne({ $and: dupAnd }).lean();
      if (dup) return res.json({ ok: true, duplicate: true });
    }

    const createPayload = {
      userId,
      lessonId: lessonOid,
      source,
      questionType,
      questionId: questionOid || undefined,
      selected: selectedStr,
      answerText: answerTextStr,
      isCorrect,
      confidence: confidenceFinal,
    };
    if (pageIdStr) createPayload.pageId = pageIdStr;
    if (revParsed.value != null) createPayload.checkpointRevision = revParsed.value;

    await PracticeAttempt.create(createPayload);

    return res.json({ ok: true });
  } catch (err) {
    console.error("POST /attempts error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
/** @private tests only */
module.exports._parseCheckpointRevision = parseCheckpointRevision;
