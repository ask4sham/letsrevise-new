/**
 * PR-F1: Flashcard Bank (topic-level) — GET by topicKey, POST import, POST copy-to-lesson.
 * PR-CHEM-3: GET/copy use queryCandidates so legacy and namespaced banks match; import accepts specKey and stores namespaced.
 */
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const auth = require("../middleware/auth");
const FlashcardBank = require("../models/FlashcardBank");
const Lesson = require("../models/Lesson");
const { findTopicByKey } = require("../utils/topicTaxonomy");
const { isValidTopicSlugForSpec } = require("../utils/specTopicRegistry");
const { validateAndNormalizeRevision } = require("../services/validateRevision");
const { parseTopicKey, queryCandidates, DEFAULT_SPEC_LEGACY, buildTopicKey } = require("../utils/topicKey");
const { assertValidSpecKey, assertValidNamespacedTopicKey } = require("../utils/specTopicValidation");

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

function getOwnerId(req) {
  return req.user._id || req.user.userId || req.user.id;
}

function validateTopicKey(topicKey) {
  if (!topicKey || typeof topicKey !== "string") return null;
  const k = topicKey.trim().toLowerCase();
  if (!k) return null;
  const found = findTopicByKey(k);
  return found ? k : null;
}

/** PR-CONTENT-TARGETING-1: Resolve topicKey (namespaced or legacy) to candidates for query. */
function resolveTopicKeyForQuery(topicKey) {
  if (!topicKey || typeof topicKey !== "string") return null;
  const trimmed = topicKey.trim();
  if (!trimmed) return null;
  const { specKey: parsedSpec, topicKey: topicOnly, isNamespaced } = parseTopicKey(trimmed);
  const specKey = (parsedSpec && String(parsedSpec).trim()) || DEFAULT_SPEC_LEGACY;
  const slug = (topicOnly && topicOnly.trim()) || trimmed;
  if (!isValidTopicSlugForSpec(specKey, slug)) return null;
  const candidates = queryCandidates(specKey, slug);
  const storedKey = isNamespaced && parsedSpec ? trimmed : buildTopicKey(specKey, slug);
  return { candidates, storedKey };
}

/** Return short (topic-only) topicKey for API responses. */
function responseTopicKey(storedKey) {
  return parseTopicKey(storedKey || "").topicKey || storedKey || "";
}

/** Normalize bank cards to lesson flashcard shape (id, front, back, tags, difficulty). */
function bankCardsToLessonFlashcards(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return [];
  return cards.map((c, i) => ({
    id: `fc_${Date.now()}_${i}`,
    front: (c.front && String(c.front).trim()) || "",
    back: (c.back && String(c.back).trim()) || "",
    tags: Array.isArray(c.tags) ? c.tags.filter((t) => typeof t === "string").map((t) => t.trim()).filter(Boolean) : [],
    difficulty: 1,
  })).filter((fc) => fc.front && fc.back);
}

// GET /api/flashcard-bank?topicKey=cell-structure or topicKey=aqa-gcse-biology:cell-structure
router.get("/", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    const { topicKey } = req.query;
    if (!topicKey || typeof topicKey !== "string") {
      return res.status(400).json({ error: "topicKey query is required" });
    }
    const trimmed = topicKey.trim();
    if (!trimmed.includes(":")) {
      return res.status(400).json({ error: "topicKey must be namespaced (specKey:topicSlug)" });
    }
    const prefix = trimmed.slice(0, trimmed.indexOf(":"));
    try {
      assertValidSpecKey(prefix);
      assertValidNamespacedTopicKey(prefix, trimmed);
    } catch (err) {
      if (err.code === "INVALID_SPEC_KEY" || err.code === "INVALID_TOPIC_KEY") {
        return res.status(400).json({ error: err.message || "Invalid topicKey" });
      }
      throw err;
    }
    const resolved = resolveTopicKeyForQuery(trimmed);
    if (!resolved || !resolved.candidates.length) return res.status(400).json({ error: "Invalid topicKey" });

    const query = { topicKey: { $in: resolved.candidates } };
    if (!isAdmin) query.ownerId = ownerId;
    const bank = await FlashcardBank.findOne(query).lean();
    if (!bank) {
      return res.json({ cards: [], topicKey: responseTopicKey(resolved.storedKey) });
    }
    return res.json({ cards: bank.cards || [], topicKey: responseTopicKey(bank.topicKey), topicName: bank.topicName });
  } catch (err) {
    console.error("FlashcardBank GET error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/flashcard-bank/import — body: { topicKey, specKey?, topicName?, cards: [{ front, back, tags? }] }
router.post("/import", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const ownerId = getOwnerId(req);
    let { topicKey, specKey: specKeyBody, topicName, cards } = req.body;
    if (!topicKey || !Array.isArray(cards)) {
      return res.status(400).json({ error: "topicKey and cards array are required" });
    }
    const validKey = validateTopicKey(topicKey);
    if (!validKey) return res.status(400).json({ error: "Invalid topicKey" });

    const specKey = (specKeyBody && String(specKeyBody).trim()) || DEFAULT_SPEC_LEGACY;
    const storedKey = buildTopicKey(specKey, validKey);
    const candidates = queryCandidates(specKey, validKey);

    const normalized = cards
      .map((c) => ({
        front: (c.front && String(c.front).trim()) || "",
        back: (c.back && String(c.back).trim()) || "",
        tags: Array.isArray(c.tags) ? c.tags.filter((t) => typeof t === "string").map((t) => t.trim()).filter(Boolean).slice(0, 20) : [],
      }))
      .filter((c) => c.front && c.back)
      .slice(0, 500);

    const existing = await FlashcardBank.findOne({ ownerId, topicKey: { $in: candidates } }).lean();
    const bank = existing
      ? await FlashcardBank.findOneAndUpdate(
          { _id: existing._id },
          {
            $set: {
              topicKey: storedKey,
              topicName: (topicName && String(topicName).trim()) || "",
              cards: normalized,
              updatedAt: new Date(),
            },
          },
          { new: true }
        ).then((b) => b.toObject?.() ?? b)
      : await FlashcardBank.create({
          ownerId,
          topicKey: storedKey,
          topicName: (topicName && String(topicName).trim()) || "",
          cards: normalized,
          updatedAt: new Date(),
        }).then((b) => b.toObject?.() ?? b);
    return res.json({ ok: true, cardsCount: (bank.cards || []).length, topicKey: responseTopicKey(bank.topicKey) });
  } catch (err) {
    console.error("FlashcardBank import error:", err);
    return res.status(400).json({ error: err.message || "Bad request" });
  }
});

// POST /api/flashcard-bank/:topicKey/copy-to-lesson/:lessonId — topicKey may be namespaced (specKey:topicSlug)
router.post("/:topicKey/copy-to-lesson/:lessonId", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const ownerId = getOwnerId(req);
    const paramTopicKey = decodeURIComponent(req.params.topicKey || "").trim();
    const lessonId = req.params.lessonId;
    const force = String(req.query.force) === "1" || String(req.body?.force) === "1";

    if (!paramTopicKey || !paramTopicKey.includes(":")) {
      return res.status(400).json({ error: "topicKey must be namespaced (specKey:topicSlug)" });
    }
    const prefix = paramTopicKey.slice(0, paramTopicKey.indexOf(":"));
    try {
      assertValidSpecKey(prefix);
      assertValidNamespacedTopicKey(prefix, paramTopicKey);
    } catch (err) {
      if (err.code === "INVALID_SPEC_KEY" || err.code === "INVALID_TOPIC_KEY") {
        return res.status(400).json({ error: err.message || "Invalid topicKey" });
      }
      throw err;
    }
    const resolved = resolveTopicKeyForQuery(paramTopicKey);
    if (!resolved || !resolved.candidates.length) return res.status(400).json({ error: "Invalid topicKey" });
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Invalid lessonId" });
    }

    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });
    const lessonOwnerId = (lesson.teacherId || lesson.createdBy || lesson.teacher)?.toString?.() || String(lesson.teacherId || lesson.createdBy);
    if (String(lessonOwnerId) !== String(ownerId) && (req.user.userType || req.user.role || "").toString().toLowerCase() !== "admin" && !req.user.isAdmin) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    const existingFlashcards = Array.isArray(lesson.flashcards) ? lesson.flashcards : [];
    if (existingFlashcards.length > 0 && !force) {
      return res.json({ ok: true, copied: 0, message: "Lesson already has flashcards; use force=1 to replace" });
    }

    const bank = await FlashcardBank.findOne({ ownerId, topicKey: { $in: resolved.candidates } }).lean();
    if (!bank || !Array.isArray(bank.cards) || bank.cards.length === 0) {
      return res.status(404).json({ error: "No flashcard bank found for this topic" });
    }

    const flashcards = bankCardsToLessonFlashcards(bank.cards);
    const { flashcards: validated } = validateAndNormalizeRevision({ flashcards });
    await Lesson.updateOne(
      { _id: lessonId },
      { $set: { flashcards: validated, updatedAt: new Date() } }
    );
    return res.json({ ok: true, copied: validated.length });
  } catch (err) {
    console.error("FlashcardBank copy-to-lesson error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

module.exports = router;
