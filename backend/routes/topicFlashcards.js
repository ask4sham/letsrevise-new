/**
 * PR-F1: Topic-level Flashcard Bank — teacher/admin only.
 * GET list, POST create, POST bulk, PUT :id, DELETE :id.
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const TopicFlashcard = require("../models/TopicFlashcard");
const auth = require("../middleware/auth");
const { isValidTopicForSpec } = require("../utils/topicTaxonomy");
const { buildTopicKey, parseTopicKey, queryCandidates, DEFAULT_SPEC_LEGACY } = require("../utils/topicKey");
const { fingerprint, dedupeIncoming } = require("../utils/flashcardDedupe");
const { parseValidateDedupe, validateBulkItems, MAX_ITEMS } = require("../utils/parseBulkFlashcards");

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

function getOwnerId(req) {
  return req.user._id || req.user.userId || req.user.id;
}

/**
 * PR-CHEM-3: Resolve request topicKey + specKey to stored namespaced key. Validates against taxonomy.
 * @returns {{ storedKey: string } | { error: string }}
 */
function resolveStoredTopicKey(specKeyFromReq, topicKeyFromReq) {
  if (!topicKeyFromReq || typeof topicKeyFromReq !== "string") {
    return { error: "topicKey is required" };
  }
  const trimmed = topicKeyFromReq.trim();
  if (!trimmed) return { error: "topicKey is required" };

  const specKey = (specKeyFromReq && String(specKeyFromReq).trim()) || DEFAULT_SPEC_LEGACY;
  const { specKey: parsedSpec, topicKey: rawTopic, isNamespaced } = parseTopicKey(trimmed);

  if (isNamespaced && parsedSpec && rawTopic) {
    if (!isValidTopicForSpec(parsedSpec, rawTopic)) {
      return { error: `Invalid topicKey for spec ${parsedSpec}` };
    }
    return { storedKey: trimmed };
  }

  const topicOnly = rawTopic || trimmed;
  if (!isValidTopicForSpec(specKey, topicOnly)) {
    return { error: `Invalid topicKey for spec ${specKey}` };
  }
  return { storedKey: buildTopicKey(specKey, topicOnly) };
}

/** Return short (topic-only) topicKey for API responses. */
function responseTopicKey(storedKey) {
  return parseTopicKey(storedKey || "").topicKey || storedKey || "";
}

/** Resolve topicKey + specKey for GET list: return array for $in query (namespaced + legacy). */
function resolveTopicKeyForQuery(specKeyFromReq, topicKeyFromReq) {
  if (!topicKeyFromReq || typeof topicKeyFromReq !== "string") return null;
  const trimmed = topicKeyFromReq.trim();
  if (!trimmed) return null;
  const specKey = (specKeyFromReq && String(specKeyFromReq).trim()) || DEFAULT_SPEC_LEGACY;
  const { topicKey: rawTopic, isNamespaced } = parseTopicKey(trimmed);
  const topicOnly = rawTopic || trimmed;
  return queryCandidates(specKey, topicOnly);
}

// GET /api/topic-flashcards?topicKey=cell-structure&status=draft|published|all&mineOnly=1
router.get("/", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) {
    return res.status(403).json({ error: "Teachers and admins only" });
  }
  try {
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    const { topicKey, specKey: specKeyQ, status, mineOnly } = req.query;

    if (!topicKey) {
      return res.status(400).json({ error: "topicKey query is required" });
    }
    const candidates = resolveTopicKeyForQuery(specKeyQ, topicKey);
    if (!candidates || candidates.length === 0) return res.status(400).json({ error: "Invalid topicKey" });

    const query = { topicKey: { $in: candidates }, isArchived: { $ne: true } };
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

    const items = await TopicFlashcard.find(query).sort({ updatedAt: -1 }).lean();
    return res.json({ items });
  } catch (err) {
    console.error("TopicFlashcards GET error:", err);
    return res.status(500).json({ error: "Server error" });
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
    const resolved = resolveStoredTopicKey(specKeyBody, topicKey);
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
    const resolved = resolveStoredTopicKey(specKeyBody, topicKey);
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
    return res.status(500).json({ error: "Server error" });
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
      const resolved = resolveStoredTopicKey(raw.specKey, raw.topicKey);
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
      const resolved = resolveStoredTopicKey(specKeyBody, topicKey);
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
    return res.status(500).json({ error: "Server error" });
  }
});

// PR-EDGE-2: POST /api/topic-flashcards/bulk/unpublish
router.post("/bulk/unpublish", auth, async (req, res) => {
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
    const result = await TopicFlashcard.updateMany(query, { $set: { status: "draft" } });
    return res.json({ ok: true, matchedCount: result.matchedCount, updatedCount: result.modifiedCount });
  } catch (err) {
    console.error("TopicFlashcards bulk unpublish error:", err);
    return res.status(500).json({ error: "Server error" });
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
    card.status = "published";
    await card.save();
    return res.json({ flashcard: card.toObject() });
  } catch (err) {
    console.error("TopicFlashcards publish error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/topic-flashcards/:id/unpublish — owner/admin only
router.post("/:id/unpublish", auth, async (req, res) => {
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
    card.status = "draft";
    await card.save();
    return res.json({ flashcard: card.toObject() });
  } catch (err) {
    console.error("TopicFlashcards unpublish error:", err);
    return res.status(500).json({ error: "Server error" });
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
    if (!isAdmin && String(item.ownerId) !== String(ownerId)) return res.status(403).json({ error: "Forbidden" });
    const patch = req.body || {};
    if (patch.front != null) item.front = String(patch.front).trim().slice(0, 500) || item.front;
    if (patch.back != null) item.back = String(patch.back).trim().slice(0, 2000) || item.back;
    if (patch.isArchived != null) item.isArchived = !!patch.isArchived;
    await item.save();
    return res.json({ item: item.toObject ? item.toObject() : item });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message || "Update failed" });
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
      card.status = String(req.body.status).toLowerCase();
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

// DELETE /api/topic-flashcards/:id
router.delete("/:id", auth, async (req, res) => {
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
    await TopicFlashcard.deleteOne({ _id: id });
    return res.json({ ok: true });
  } catch (err) {
    console.error("TopicFlashcards DELETE error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
