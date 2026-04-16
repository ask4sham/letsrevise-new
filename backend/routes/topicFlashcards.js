/**
 * PR-F1: Topic-level Flashcard Bank — teacher/admin only.
 * GET list, POST create, POST bulk, PUT :id, DELETE :id.
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const TopicFlashcard = require("../models/TopicFlashcard");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const { parseTopicKey, queryCandidates, DEFAULT_SPEC_LEGACY } = require("../utils/topicKey");
const { resolveStoredTopicKeyWithAdmin } = require("../services/adminTaxonomyService");
const { fingerprint, dedupeIncoming } = require("../utils/flashcardDedupe");
const { parseValidateDedupe, validateBulkItems, MAX_ITEMS } = require("../utils/parseBulkFlashcards");
const { sendInternalError } = require("../utils/safeErrorResponse");
const { enrichFlashcardItems } = require("../utils/reviewQualityFlags");
const { ensureLeanFlashcardScored } = require("../utils/draftQualityScoring");
const { applyFlashcardAiRewrite, FLASHCARD_ACTIONS } = require("../services/aiRewriteDraftAsset");

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

function getOwnerId(req) {
  return req.user._id || req.user.userId || req.user.id;
}

/** Return short (topic-only) topicKey for API responses. */
function responseTopicKey(storedKey) {
  return parseTopicKey(storedKey || "").topicKey || storedKey || "";
}

/** Resolve topicKey + specKey for GET list: return array for $in query (namespaced + legacy + unit__topic). */
function resolveTopicKeyForQuery(specKeyFromReq, topicKeyFromReq, unitKeyFromReq) {
  if (!topicKeyFromReq || typeof topicKeyFromReq !== "string") return null;
  const trimmed = topicKeyFromReq.trim();
  if (!trimmed) return null;
  const specKey = (specKeyFromReq && String(specKeyFromReq).trim()) || DEFAULT_SPEC_LEGACY;
  const { topicKey: rawTopic } = parseTopicKey(trimmed);
  const topicOnly = rawTopic || trimmed;
  const unitKey = (unitKeyFromReq && String(unitKeyFromReq).trim()) || null;
  return queryCandidates(specKey, topicOnly, unitKey);
}

// GET /api/topic-flashcards?topicKey=cell-structure&status=draft|published|all&mineOnly=1
router.get("/", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    const {
      topicKey,
      specKey: specKeyQ,
      status,
      mineOnly,
      unitKey: unitKeyQ,
      metadataSource,
      lessonId,
      generationType,
      sortBy,
      qualityBand: qualityBandQ,
    } = req.query;

    if (!topicKey) {
      return res.status(400).json({ error: "topicKey query is required" });
    }
    const candidates = resolveTopicKeyForQuery(specKeyQ, topicKey, unitKeyQ);
    if (!candidates || candidates.length === 0) return res.status(400).json({ error: "Invalid topicKey" });

    const query = { topicKey: { $in: candidates }, isArchived: { $ne: true } };
    if (metadataSource && String(metadataSource).trim()) {
      query["metadata.source"] = String(metadataSource).trim();
    }
    if (lessonId && mongoose.Types.ObjectId.isValid(String(lessonId))) {
      query["metadata.lessonId"] = String(lessonId);
    }
    if (generationType && ["flashcard", "quiz", "exam"].includes(String(generationType).toLowerCase())) {
      query["metadata.generationType"] = String(generationType).toLowerCase();
    }
    if (String(mineOnly) === "1" || String(mineOnly) === "true" || !isAdmin) {
      query.ownerId = ownerId;
    }
    if (status && String(status).toLowerCase() === "all") {
      // no status filter
    } else if (status && ["draft", "published"].includes(String(status).toLowerCase())) {
      query.status = String(status).toLowerCase();
    } else {
      query.status = { $in: ["draft", "published"] };
    }

    let items = await TopicFlashcard.find(query).sort({ updatedAt: -1 }).lean();
    items = items.map((doc) => ensureLeanFlashcardScored(doc));
    if (qualityBandQ && ["high", "medium", "low"].includes(String(qualityBandQ).toLowerCase())) {
      const b = String(qualityBandQ).toLowerCase();
      items = items.filter((d) => d.metadata && d.metadata.qualityBand === b);
    }
    const sortKey = (sortBy && String(sortBy).toLowerCase()) || "updatedAt";
    if (sortKey === "qualityscore") {
      items.sort((a, b) => (b.metadata?.qualityScore ?? -1) - (a.metadata?.qualityScore ?? -1));
    } else {
      items.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    }
    const withReviewFlags = enrichFlashcardItems(items);
    return res.json({ items: withReviewFlags });
  } catch (err) {
    console.error("TopicFlashcards GET error:", err);
    return sendInternalError("topic-flashcards/list", err, res);
  }
});

// POST /api/topic-flashcards
router.post("/", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const ownerId = getOwnerId(req);
    let { topicKey, specKey: specKeyBody, topic, front, back, status } = req.body;
    if (!topicKey || typeof front !== "string" || typeof back !== "string") {
      return res.status(400).json({ error: "topicKey, front, and back are required" });
    }
    const resolved = await resolveStoredTopicKeyWithAdmin(specKeyBody, topicKey);
    if (resolved.error) return res.status(400).json({ error: resolved.error });
    const storedTopicKey = resolved.storedKey;
    front = String(front).trim();
    back = String(back).trim();
    if (!front || front.length > 500) return res.status(400).json({ error: "front must be 1–500 characters" });
    if (!back || back.length > 2000) return res.status(400).json({ error: "back must be 1–2000 characters" });
    const statusVal = status === "published" ? "published" : "draft";
    const fp = fingerprint(front, back);

    const card = await TopicFlashcard.create({
      ownerId,
      topicKey: storedTopicKey,
      topic: topic != null ? String(topic).trim() : "",
      front,
      back,
      status: statusVal,
      fingerprint: fp,
    });
    return res.status(201).json({ flashcard: card.toObject() });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Duplicate front for this topic" });
    console.error("TopicFlashcards POST error:", err);
    return res.status(400).json({ error: err.message || "Bad request" });
  }
});

// POST /api/topic-flashcards/bulk/preview — PR-FLOW-4: preview without writing
router.post("/bulk/preview", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  if (!req.body.topicKey || typeof req.body.topicKey !== "string" || !req.body.topicKey.trim()) {
    return res.status(400).json({ error: "topicKey is required. Select a Topic before importing." });
  }
  try {
    const ownerId = getOwnerId(req);
    const { topicKey, specKey: specKeyBody, format, text, csvBase64, filename, csvOptions, dedupeMode } = req.body;
    const resolved = await resolveStoredTopicKeyWithAdmin(specKeyBody, topicKey);
    if (resolved.error) return res.status(400).json({ error: resolved.error });
    const validKey = resolved.storedKey;

    let inputText = text;
    if (format === "csv" && csvBase64 && typeof csvBase64 === "string") {
      try {
        inputText = Buffer.from(csvBase64, "base64").toString("utf8");
      } catch {
        return res.status(400).json({ error: "Invalid csvBase64" });
      }
    }
    if (!inputText || typeof inputText !== "string") {
      return res.status(400).json({ error: "text or csvBase64 is required" });
    }
    const { BULK_MAX_TEXT_LENGTH } = require("../config/limits");
    if (inputText.length > BULK_MAX_TEXT_LENGTH) {
      return res.status(413).json({ error: "Text too long", maxLength: BULK_MAX_TEXT_LENGTH });
    }

    const fmt = ["json", "newline", "csv"].includes(String(format || "").toLowerCase()) ? String(format).toLowerCase() : "newline";
    const mode = ["skip", "error", "allow"].includes(String(dedupeMode || "").toLowerCase()) ? String(dedupeMode).toLowerCase() : "skip";
    const opts = (csvOptions && typeof csvOptions === "object") ? csvOptions : {};

    let validItems, invalid, duplicatesInPayload, totalParsed;
    try {
      const result = parseValidateDedupe(fmt, inputText, opts);
      validItems = result.validItems;
      invalid = result.invalid;
      duplicatesInPayload = result.duplicatesInPayload || [];
      totalParsed = result.totalParsed ?? (validItems.length + invalid.length + duplicatesInPayload.length);
    } catch (e) {
      return res.status(400).json({ error: e.message || "Parse failed" });
    }

    const fps = validItems.map((x) => x.fingerprint);
    const spec = (specKeyBody && String(specKeyBody).trim()) || DEFAULT_SPEC_LEGACY;
    const parsed = parseTopicKey(topicKey || "");
    const topicOnly = parsed.topicKey || String(topicKey || "").trim();
    const queryKeys = queryCandidates(spec, topicOnly);
    const existing = await TopicFlashcard.find({ ownerId, topicKey: { $in: queryKeys }, fingerprint: { $in: fps } }).lean();
    const existingFps = new Set(existing.map((e) => e.fingerprint));
    const duplicatesInDb = validItems.filter((x) => existingFps.has(x.fingerprint));
    const wouldCreate = validItems.filter((x) => !existingFps.has(x.fingerprint));

    if (mode === "error" && (duplicatesInPayload.length > 0 || duplicatesInDb.length > 0)) {
      return res.status(400).json({
        ok: false,
        error: "Duplicates found (dedupeMode=error)",
        topicKey: validKey,
        summary: {
          totalParsed: validItems.length + invalid.length + duplicatesInPayload.length,
          validCount: validItems.length,
          invalidCount: invalid.length,
          duplicatesInPayload: duplicatesInPayload.length,
          duplicatesInDb: duplicatesInDb.length,
          wouldCreate: wouldCreate.length,
        },
        invalid,
        duplicates: {
          inPayload: duplicatesInPayload.map((d) => ({ index: d.index, front: d.front, back: d.back })),
          inDb: duplicatesInDb.map((d) => ({ front: d.front, back: d.back })),
        },
      });
    }

    const previewItems = wouldCreate.slice(0, 200).map((x) => ({ front: x.front, back: x.back, tags: x.tags || [], fingerprint: x.fingerprint }));

    return res.json({
      ok: true,
      topicKey: responseTopicKey(validKey),
      summary: {
        totalParsed,
        validCount: validItems.length,
        invalidCount: invalid.length,
        duplicatesInPayload: duplicatesInPayload.length,
        duplicatesInDb: duplicatesInDb.length,
        wouldCreate: wouldCreate.length,
      },
      invalid,
      duplicates: {
        inPayload: duplicatesInPayload.map((d) => ({ index: d.index, front: d.front, back: d.back })),
        inDb: duplicatesInDb.map((d) => ({ front: d.front, back: d.back })),
      },
      previewItems,
    });
  } catch (err) {
    console.error("TopicFlashcards preview error:", err);
    return sendInternalError("topic-flashcards/bulk-preview", err, res);
  }
});

// POST /api/topic-flashcards/bulk — accepts { topicKey, items: [...] } OR { topicKey, format, text, ... }
router.post("/bulk", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  const raw = req.body;
  if (!raw.topicKey || typeof raw.topicKey !== "string" || !raw.topicKey.trim()) {
    return res.status(400).json({ error: "topicKey is required. Select a Topic before importing." });
  }
  try {
    const ownerId = getOwnerId(req);
    const items = Array.isArray(raw.items) ? raw.items : null;
    const hasCards = raw && Array.isArray(raw.cards);
    if (hasCards && !items) {
      return res.status(400).json({
        error: "Use 'items' not 'cards'. Bulk payload must be { topicKey, items: [{ front, back }, ...] }",
      });
    }

    let uniqueItems, duplicatesInPayload, invalid;
    let topicKey, specKeyBody, topicStr, mode, storedTopicKey;

    // Path 1: format + text (parse server-side, same as preview then insert)
    if (raw.format && raw.text && typeof raw.text === "string" && !items) {
      const resolved = await resolveStoredTopicKeyWithAdmin(raw.specKey, raw.topicKey);
      if (resolved.error) return res.status(400).json({ error: resolved.error });
      storedTopicKey = resolved.storedKey;
      topicKey = raw.topicKey;
      specKeyBody = raw.specKey;
      topicStr = raw.topic != null ? String(raw.topic).trim() : "";
      mode = ["skip", "error", "allow"].includes(String((raw.dedupeMode || "skip")).toLowerCase()) ? String(raw.dedupeMode).toLowerCase() : "skip";

      const { BULK_MAX_TEXT_LENGTH } = require("../config/limits");
      if (raw.text.length > BULK_MAX_TEXT_LENGTH) {
        return res.status(413).json({ error: "Text too long", maxLength: BULK_MAX_TEXT_LENGTH });
      }
      const fmt = ["json", "newline", "csv"].includes(String(raw.format).toLowerCase()) ? String(raw.format).toLowerCase() : "newline";
      const opts = (raw.csvOptions && typeof raw.csvOptions === "object") ? raw.csvOptions : {};
      let parseResult;
      try {
        parseResult = parseValidateDedupe(fmt, raw.text.trim(), opts);
      } catch (e) {
        return res.status(400).json({ error: e.message || "Parse failed" });
      }
      invalid = parseResult.invalid || [];
      uniqueItems = parseResult.validItems;
      duplicatesInPayload = parseResult.duplicatesInPayload || [];
    } else {
      // Path 2: items array
      if (!items || items.length === 0 || !raw.topicKey) {
        return res.status(400).json({ error: "topicKey and items array are required (or topicKey + format + text)" });
      }
      if (items.length > MAX_ITEMS) {
        return res.status(400).json({ error: `Too many items (max ${MAX_ITEMS})` });
      }
      const { topicKey: tk, specKey: specKeyBodyFromRaw, topic, dedupeMode } = raw;
      topicKey = tk;
      specKeyBody = specKeyBodyFromRaw;
      const resolved = await resolveStoredTopicKeyWithAdmin(specKeyBody, topicKey);
      if (resolved.error) return res.status(400).json({ error: resolved.error });
      storedTopicKey = resolved.storedKey;
      topicStr = topic != null ? String(topic).trim() : "";
      mode = ["skip", "error", "allow"].includes(String(dedupeMode || "").toLowerCase()) ? String(dedupeMode).toLowerCase() : "skip";

      const rawItems = items.map((c, i) => ({ ...c, _index: i, _raw: JSON.stringify(c) }));
      const validateResult = validateBulkItems(rawItems);
      invalid = validateResult.invalid;
      const deduped = dedupeIncoming(validateResult.valid);
      uniqueItems = deduped.uniqueItems;
      duplicatesInPayload = deduped.duplicatesInPayload;
    }

    const fps = uniqueItems.map((x) => x.fingerprint);
    const spec = (specKeyBody && String(specKeyBody).trim()) || DEFAULT_SPEC_LEGACY;
    const parsed = parseTopicKey(topicKey || "");
    const queryKeys = queryCandidates(spec, parsed.topicKey || String(topicKey || "").trim());
    const existing = await TopicFlashcard.find({ ownerId, topicKey: { $in: queryKeys }, fingerprint: { $in: fps } }).lean();
    const existingFps = new Set(existing.map((e) => e.fingerprint));
    const toInsert = uniqueItems.filter((x) => !existingFps.has(x.fingerprint));
    const duplicatesInDb = uniqueItems.filter((x) => existingFps.has(x.fingerprint));

    if (mode === "error" && (duplicatesInPayload.length > 0 || duplicatesInDb.length > 0)) {
      return res.status(400).json({
        ok: false,
        error: "Duplicates or invalid items (dedupeMode=error)",
        summary: {
          duplicatesInPayload: duplicatesInPayload.length,
          duplicatesInDb: duplicatesInDb.length,
          invalid: invalid.length,
        },
      });
    }

    const createdIds = [];
    let createdCount = 0;
    for (const x of toInsert) {
      try {
        const displayTopic = (x.topic != null && String(x.topic).trim()) ? String(x.topic).trim() : topicStr;
        const doc = await TopicFlashcard.create({
          ownerId,
          topicKey: storedTopicKey,
          topic: displayTopic,
          front: x.front,
          back: x.back,
          status: "draft",
          fingerprint: x.fingerprint,
        });
        createdCount += 1;
        createdIds.push(String(doc._id));
      } catch (e) {
        if (e.code === 11000) {
          // unique index blocked - count as duplicate
        } else throw e;
      }
    }

    return res.json({
      ok: true,
      createdCount,
      skipped: {
        duplicatesInPayload: duplicatesInPayload.length,
        duplicatesInDb: duplicatesInDb.length,
        invalid: invalid.length,
      },
      createdIds,
    });
  } catch (err) {
    console.error("TopicFlashcards bulk error:", err);
    return res.status(400).json({ error: err.message || "Bad request" });
  }
});

const BULK_IDS_MAX = 500;

// PR-EDGE-2: POST /api/topic-flashcards/bulk/publish
router.post("/bulk/publish", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ error: "ids array is required and must not be empty" });
    if (ids.length > BULK_IDS_MAX) return res.status(400).json({ error: `Too many ids (max ${BULK_IDS_MAX})` });
    const validIds = ids.filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)));
    if (validIds.length !== ids.length) return res.status(400).json({ error: "All ids must be valid ObjectIds" });
    const objIds = validIds.map((id) => new mongoose.Types.ObjectId(id));
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    const query = { _id: { $in: objIds } };
    if (!isAdmin) query.ownerId = ownerId;
    const permitted = await TopicFlashcard.countDocuments(query);
    if (!isAdmin && permitted === 0) return res.status(404).json({ error: "Not found" });
    const result = await TopicFlashcard.updateMany(query, { $set: { status: "published" } });
    return res.json({ ok: true, matchedCount: result.matchedCount, updatedCount: result.modifiedCount });
  } catch (err) {
    console.error("TopicFlashcards bulk publish error:", err);
    return sendInternalError("topic-flashcards/bulk-publish", err, res);
  }
});

// PR-EDGE-2: POST /api/topic-flashcards/bulk/unpublish — admin only
router.post("/bulk/unpublish", auth, requireAdmin, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ error: "ids array is required and must not be empty" });
    if (ids.length > BULK_IDS_MAX) return res.status(400).json({ error: `Too many ids (max ${BULK_IDS_MAX})` });
    const validIds = ids.filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)));
    if (validIds.length !== ids.length) return res.status(400).json({ error: "All ids must be valid ObjectIds" });
    const objIds = validIds.map((id) => new mongoose.Types.ObjectId(id));
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    const query = { _id: { $in: objIds } };
    if (!isAdmin) query.ownerId = ownerId;
    const permitted = await TopicFlashcard.countDocuments(query);
    if (!isAdmin && permitted === 0) return res.status(404).json({ error: "Not found" });
    const result = await TopicFlashcard.updateMany(query, { $set: { status: "draft" } });
    return res.json({ ok: true, matchedCount: result.matchedCount, updatedCount: result.modifiedCount });
  } catch (err) {
    console.error("TopicFlashcards bulk unpublish error:", err);
    return sendInternalError("topic-flashcards/bulk-unpublish", err, res);
  }
});

// POST /api/topic-flashcards/bulk/delete — teachers delete own drafts; admins may delete any selected
router.post("/bulk/delete", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ error: "ids array is required and must not be empty" });
    if (ids.length > BULK_IDS_MAX) return res.status(400).json({ error: `Too many ids (max ${BULK_IDS_MAX})` });
    const validIds = ids.filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)));
    if (validIds.length !== ids.length) return res.status(400).json({ error: "All ids must be valid ObjectIds" });
    const objIds = validIds.map((id) => new mongoose.Types.ObjectId(id));
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    const query = { _id: { $in: objIds } };
    if (!isAdmin) {
      query.ownerId = ownerId;
      query.status = "draft";
    }
    const permitted = await TopicFlashcard.countDocuments(query);
    if (!isAdmin && permitted === 0) return res.status(404).json({ error: "Not found" });
    const result = await TopicFlashcard.deleteMany(query);
    return res.json({ ok: true, deletedCount: result.deletedCount });
  } catch (err) {
    console.error("TopicFlashcards bulk delete error:", err);
    return sendInternalError("topic-flashcards/bulk-delete", err, res);
  }
});

// POST /api/topic-flashcards/:id/ai-rewrite — draft only; LLM JSON patch (owner/admin)
router.post("/:id/ai-rewrite", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const id = req.params.id;
    const action = String(req.body?.action || "").trim();
    if (!action || !FLASHCARD_ACTIONS.has(action)) {
      return res.status(400).json({ error: `Invalid action. Allowed: ${[...FLASHCARD_ACTIONS].join(", ")}` });
    }
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });
    const card = await TopicFlashcard.findById(id);
    if (!card) return res.status(404).json({ error: "Flashcard not found" });
    if (!isAdmin && String(card.ownerId) !== String(ownerId)) return res.status(404).json({ error: "Flashcard not found" });
    if (String(card.status) !== "draft") return res.status(400).json({ error: "AI rewrite is only for drafts" });
    await applyFlashcardAiRewrite(card, action);
    const lean = card.toObject ? card.toObject() : card;
    return res.json({ flashcard: enrichFlashcardItems([lean])[0] });
  } catch (err) {
    if (err.code === "LLM_NOT_CONFIGURED" || err.code === "LLM_EMPTY" || err.code === "LLM_BAD_JSON") {
      return res.status(503).json({ error: err.message || "LLM unavailable" });
    }
    const code = err.statusCode || 400;
    if (code >= 500) return sendInternalError("topic-flashcards/ai-rewrite", err, res);
    return res.status(code).json({ error: err.message || "Bad request" });
  }
});

// POST /api/topic-flashcards/:id/publish — owner/admin only
router.post("/:id/publish", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const id = req.params.id;
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const card = await TopicFlashcard.findOne({ _id: id });
    if (!card) return res.status(404).json({ error: "Flashcard not found" });
    if (!isAdmin && String(card.ownerId) !== String(ownerId)) return res.status(404).json({ error: "Flashcard not found" });
    const { checkPublishGateForGenerated } = require("../middleware/requirePublishGateIfGenerated");
    const gate = await checkPublishGateForGenerated(card.toObject ? card.toObject() : card, req.user);
    if (!gate.ok) {
      return res.status(400).json({ error: "Fix issues first", issues: gate.issues, blocks: gate.blocks });
    }
    card.status = "published";
    await card.save();

    // PR-015: Enqueue knowledge refresh (async, non-blocking)
    if (card.topicKey) {
      const specKey = String(card.topicKey).split(":")[0];
      if (specKey) {
        const { enqueueKnowledgeRefresh } = require("../services/jobs/enqueueKnowledgeRefresh");
        enqueueKnowledgeRefresh({ specKey, topicKey: card.topicKey, userId: req.user?._id }).catch((e) =>
          console.error("[topicFlashcards] enqueueKnowledgeRefresh error:", e?.message)
        );
      }
    }
    return res.json({ flashcard: card.toObject() });
  } catch (err) {
    console.error("TopicFlashcards publish error:", err);
    return sendInternalError("topic-flashcards/publish", err, res);
  }
});

// POST /api/topic-flashcards/:id/unpublish — admin only (teachers cannot unpublish)
router.post("/:id/unpublish", auth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const card = await TopicFlashcard.findOne({ _id: id });
    if (!card) return res.status(404).json({ error: "Flashcard not found" });
    if (!isAdmin && String(card.ownerId) !== String(ownerId)) return res.status(404).json({ error: "Flashcard not found" });
    card.status = "draft";
    await card.save();
    return res.json({ flashcard: card.toObject() });
  } catch (err) {
    console.error("TopicFlashcards unpublish error:", err);
    return sendInternalError("topic-flashcards/unpublish", err, res);
  }
});

// POST /api/topic-flashcards/:id/reassign — admin only: move card to another topic
router.post("/:id/reassign", auth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { topicKey: newTopicKey, specKey: specKeyBody, topic: topicDisplay } = req.body || {};
    if (!newTopicKey || typeof newTopicKey !== "string" || !newTopicKey.trim()) {
      return res.status(400).json({ error: "topicKey is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });
    const card = await TopicFlashcard.findById(id);
    if (!card) return res.status(404).json({ error: "Flashcard not found" });
    const resolved = await resolveStoredTopicKeyWithAdmin(specKeyBody, newTopicKey.trim());
    if (resolved.error) return res.status(400).json({ error: resolved.error });
    card.topicKey = resolved.storedKey;
    if (topicDisplay != null && typeof topicDisplay === "string") card.topic = topicDisplay.trim();
    await card.save();
    return res.json({ flashcard: card.toObject ? card.toObject() : card });
  } catch (err) {
    console.error("TopicFlashcards reassign error:", err);
    return sendInternalError("topic-flashcards/reassign", err, res);
  }
});

// PATCH /api/topic-flashcards/:id — partial update (teacher owner or admin)
router.patch("/:id", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const id = req.params.id;
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });
    const item = await TopicFlashcard.findById(id);
    if (!item) return res.status(404).json({ error: "Not found" });
    if (!isAdmin && String(item.ownerId) !== String(ownerId)) return res.status(404).json({ error: "Not found" });
    const patch = req.body || {};
    if (patch.front != null) item.front = String(patch.front).trim().slice(0, 500) || item.front;
    if (patch.back != null) item.back = String(patch.back).trim().slice(0, 2000) || item.back;
    if (patch.isArchived != null) item.isArchived = !!patch.isArchived;
    await item.save();
    return res.json({ item: item.toObject ? item.toObject() : item });
  } catch (err) {
    const st = err.status || 400;
    if (st >= 500) return sendInternalError("topic-flashcards/patch", err, res);
    return res.status(st).json({ error: err.message || "Update failed" });
  }
});

// PUT /api/topic-flashcards/:id
router.put("/:id", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const id = req.params.id;
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const card = await TopicFlashcard.findOne({ _id: id });
    if (!card) return res.status(404).json({ error: "Flashcard not found" });
    if (!isAdmin && String(card.ownerId) !== String(ownerId)) return res.status(404).json({ error: "Flashcard not found" });
    if (req.body.front !== undefined) {
      const v = String(req.body.front).trim();
      if (v.length > 500) return res.status(400).json({ error: "front max 500 characters" });
      card.front = v || card.front;
    }
    if (req.body.back !== undefined) {
      const v = String(req.body.back).trim();
      if (v.length > 2000) return res.status(400).json({ error: "back max 2000 characters" });
      card.back = v || card.back;
    }
    if (req.body.status !== undefined && ["draft", "published"].includes(String(req.body.status).toLowerCase())) {
      const newStatus = String(req.body.status).toLowerCase();
      if (newStatus === "draft") {
        const isAdminUser = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
        if (!isAdminUser) {
          return res.status(403).json({ error: "Only admins can unpublish or revert status." });
        }
      }
      card.status = newStatus;
    }
    card.fingerprint = fingerprint(card.front, card.back);
    await card.save();
    return res.json({ flashcard: card.toObject() });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Duplicate front for this topic" });
    console.error("TopicFlashcards PUT error:", err);
    return res.status(400).json({ error: err.message || "Bad request" });
  }
});

// DELETE /api/topic-flashcards/:id — admin only (teachers cannot delete). Return 404 for non-admins (no existence leak).
router.delete("/:id", auth, async (req, res) => {
  try {
    const id = req.params.id;
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const card = await TopicFlashcard.findOne({ _id: id });
    if (!card) return res.status(404).json({ error: "Flashcard not found" });
    if (!isAdmin) return res.status(404).json({ error: "Flashcard not found" });
    await TopicFlashcard.deleteOne({ _id: id });
    return res.json({ ok: true });
  } catch (err) {
    console.error("TopicFlashcards DELETE error:", err);
    return sendInternalError("topic-flashcards/delete", err, res);
  }
});

module.exports = router;
