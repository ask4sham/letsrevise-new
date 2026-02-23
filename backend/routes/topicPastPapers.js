/**
 * PR-PP1: Topic Past Paper Bank — URLs + file uploads.
 */
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const TopicPastPaper = require("../models/TopicPastPaper");
const FileAsset = require("../models/FileAsset");
const auth = require("../middleware/auth");
const { isValidTopicForSpec } = require("../utils/topicTaxonomy");
const { buildTopicKey, parseTopicKey, queryCandidates, DEFAULT_SPEC_LEGACY } = require("../utils/topicKey");
const { fingerprintUrl, fingerprintFile, dedupeIncoming } = require("../utils/pastPaperDedupe");
const { parseValidateDedupe, MAX_ITEMS } = require("../utils/parseBulkPastPapers");
const { saveUploadAndHash, ALLOWED_MIMES, MAX_SIZE } = require("../utils/saveUploadAndHash");
const { MAX_FILES_PER_REQUEST } = require("../config/limits");
const { getOfficialSourceFromUrl } = require("../utils/officialSource");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
});

function isTeacherOrAdmin(req) {
  if (!req.user) return false;
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user.isAdmin === true;
}

function getOwnerId(req) {
  return req.user._id || req.user.userId || req.user.id;
}

function resolveStoredTopicKey(specKeyFromReq, topicKeyFromReq) {
  if (!topicKeyFromReq || typeof topicKeyFromReq !== "string") return { error: "topicKey is required" };
  const trimmed = topicKeyFromReq.trim();
  if (!trimmed) return { error: "topicKey is required" };
  const specKey = (specKeyFromReq && String(specKeyFromReq).trim()) || DEFAULT_SPEC_LEGACY;
  const { specKey: parsedSpec, topicKey: rawTopic, isNamespaced } = parseTopicKey(trimmed);
  if (isNamespaced && parsedSpec && rawTopic) {
    if (!isValidTopicForSpec(parsedSpec, rawTopic)) return { error: `Invalid topicKey for spec ${parsedSpec}` };
    return { storedKey: trimmed };
  }
  const topicOnly = rawTopic || trimmed;
  if (!isValidTopicForSpec(specKey, topicOnly)) return { error: `Invalid topicKey for spec ${specKey}` };
  return { storedKey: buildTopicKey(specKey, topicOnly) };
}

function resolveTopicKeyForQuery(specKeyFromReq, topicKeyFromReq) {
  if (!topicKeyFromReq || typeof topicKeyFromReq !== "string") return null;
  const trimmed = topicKeyFromReq.trim();
  if (!trimmed) return null;
  const specKey = (specKeyFromReq && String(specKeyFromReq).trim()) || DEFAULT_SPEC_LEGACY;
  const { topicKey: rawTopic } = parseTopicKey(trimmed);
  return queryCandidates(specKey, rawTopic || trimmed);
}

// GET /api/topic-past-papers?topicKey=...&specKey=...&status=...&mineOnly=1
router.get("/", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    const { topicKey, specKey: specKeyQ, status, mineOnly } = req.query;
    if (!topicKey) return res.status(400).json({ error: "topicKey query is required" });
    const candidates = resolveTopicKeyForQuery(specKeyQ, topicKey);
    if (!candidates || candidates.length === 0) return res.status(400).json({ error: "Invalid topicKey" });

    const query = { topicKey: { $in: candidates } };
    if (String(mineOnly) === "1" || String(mineOnly) === "true" || !isAdmin) query.ownerId = ownerId;
    if (status && String(status).toLowerCase() === "all") { /* no filter */ }
    else if (status && ["draft", "published"].includes(String(status).toLowerCase())) query.status = String(status).toLowerCase();
    else query.status = { $in: ["draft", "published"] };

    const items = await TopicPastPaper.find(query).sort({ updatedAt: -1 }).lean();
    return res.json({ items });
  } catch (err) {
    console.error("TopicPastPapers GET error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/topic-past-papers/bulk/preview (URLs only)
router.post("/bulk/preview", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const ownerId = getOwnerId(req);
    const { topicKey, specKey: specKeyBody, format, text, dedupeMode, csvOptions } = req.body;
    const resolved = resolveStoredTopicKey(specKeyBody, topicKey);
    if (resolved.error) return res.status(400).json({ error: resolved.error });
    const validKey = resolved.storedKey;
    if (!text || typeof text !== "string") return res.status(400).json({ error: "text is required" });
    const { BULK_MAX_TEXT_LENGTH } = require("../config/limits");
    if (text.length > BULK_MAX_TEXT_LENGTH) return res.status(413).json({ error: "Text too long", maxLength: BULK_MAX_TEXT_LENGTH });

    const fmt = ["json", "csv"].includes(String(format || "").toLowerCase()) ? String(format).toLowerCase() : "json";
    const mode = ["skip", "error", "allow"].includes(String(dedupeMode || "").toLowerCase()) ? String(dedupeMode).toLowerCase() : "skip";
    const opts = csvOptions && typeof csvOptions === "object" ? csvOptions : {};

    let validItems, invalid, duplicatesInPayload, totalParsed;
    try {
      const result = parseValidateDedupe(fmt, text, opts);
      validItems = result.validItems;
      invalid = result.invalid;
      duplicatesInPayload = result.duplicatesInPayload || [];
      totalParsed = result.totalParsed;
    } catch (e) {
      return res.status(400).json({ error: e.message || "Parse failed" });
    }

    const fps = validItems.map((x) => x.fingerprint);
    const spec = (specKeyBody && String(specKeyBody).trim()) || DEFAULT_SPEC_LEGACY;
    const parsed = parseTopicKey(topicKey || "");
    const queryKeys = queryCandidates(spec, parsed.topicKey || String(topicKey || "").trim());
    const existing = await TopicPastPaper.find({ ownerId, topicKey: { $in: queryKeys }, fingerprint: { $in: fps } }).lean();
    const existingFps = new Set(existing.map((e) => e.fingerprint));
    const duplicatesInDb = validItems.filter((x) => existingFps.has(x.fingerprint));
    const wouldCreate = validItems.filter((x) => !existingFps.has(x.fingerprint));

    if (mode === "error" && (duplicatesInPayload.length > 0 || duplicatesInDb.length > 0)) {
      return res.status(400).json({
        ok: false,
        error: "Duplicates found (dedupeMode=error)",
        topicKey: validKey,
        summary: { totalParsed, validCount: validItems.length, invalidCount: invalid.length, duplicatesInPayload: duplicatesInPayload.length, duplicatesInDb: duplicatesInDb.length, wouldCreate: wouldCreate.length },
        invalid,
        duplicates: { inPayload: duplicatesInPayload, inDb: duplicatesInDb },
      });
    }

    const previewItems = wouldCreate.slice(0, 200).map((x) => {
      const { officialSource, officialHost } = getOfficialSourceFromUrl(x.url);
      return { ...x, officialSource: officialSource || false, officialHost: officialHost || "" };
    });
    return res.json({
      ok: true,
      topicKey: validKey,
      summary: { totalParsed, validCount: validItems.length, invalidCount: invalid.length, duplicatesInPayload: duplicatesInPayload.length, duplicatesInDb: duplicatesInDb.length, wouldCreate: wouldCreate.length },
      invalid,
      duplicates: { inPayload: duplicatesInPayload, inDb: duplicatesInDb },
      previewItems,
    });
  } catch (err) {
    console.error("TopicPastPapers preview error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST /api/topic-past-papers/bulk (URLs only)
router.post("/bulk", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const ownerId = getOwnerId(req);
    const { topicKey, specKey: specKeyBody, items, dedupeMode } = req.body;
    const resolved = resolveStoredTopicKey(specKeyBody, topicKey);
    if (resolved.error) return res.status(400).json({ error: resolved.error });
    const storedTopicKey = resolved.storedKey;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items array is required" });
    if (items.length > MAX_ITEMS) return res.status(400).json({ error: `Too many items (max ${MAX_ITEMS})` });

    const { valid, invalid } = (() => {
      const v = [];
      const inv = [];
      for (let i = 0; i < items.length; i++) {
        const x = items[i];
        const title = (x.title || "").trim();
        const url = (x.url || "").trim();
        if (!title) { inv.push({ index: i, reason: "Missing title", raw: "" }); continue; }
        if (!/^https?:\/\/[^\s]+$/i.test(url)) { inv.push({ index: i, reason: "Invalid URL", raw: url }); continue; }
        v.push({ ...x, title, url });
      }
      return { valid: v, invalid: inv };
    })();

    const { uniqueItems, duplicatesInPayload } = dedupeIncoming(valid, fingerprintUrl);
    const fps = uniqueItems.map((x) => x.fingerprint);
    const spec = (specKeyBody && String(specKeyBody).trim()) || DEFAULT_SPEC_LEGACY;
    const parsed = parseTopicKey(topicKey || "");
    const queryKeys = queryCandidates(spec, parsed.topicKey || String(topicKey || "").trim());
    const existing = await TopicPastPaper.find({ ownerId, topicKey: { $in: queryKeys }, fingerprint: { $in: fps } }).lean();
    const existingFps = new Set(existing.map((e) => e.fingerprint));
    const toInsert = uniqueItems.filter((x) => !existingFps.has(x.fingerprint));
    const duplicatesInDb = uniqueItems.filter((x) => existingFps.has(x.fingerprint));

    const mode = ["skip", "error", "allow"].includes(String(dedupeMode || "").toLowerCase()) ? String(dedupeMode).toLowerCase() : "skip";
    if (mode === "error" && (duplicatesInPayload.length > 0 || duplicatesInDb.length > 0 || invalid.length > 0)) {
      return res.status(400).json({ ok: false, error: "Duplicates or invalid (dedupeMode=error)", summary: { duplicatesInPayload: duplicatesInPayload.length, duplicatesInDb: duplicatesInDb.length, invalid: invalid.length } });
    }

    const createdIds = [];
    for (const x of toInsert) {
      try {
        const { officialSource, officialHost } = getOfficialSourceFromUrl(x.url);
        const doc = await TopicPastPaper.create({
          ownerId,
          topicKey: validKey,
          title: x.title,
          url: x.url,
          officialSource: officialSource || false,
          officialHost: officialHost || "",
          examBoard: x.examBoard || "",
          qualification: x.qualification || "",
          subject: x.subject || "",
          year: x.year,
          paper: x.paper || "",
          session: x.session || "",
          tier: x.tier || "",
          type: x.type || "",
          tags: x.tags || [],
          sourceType: "url",
          status: "draft",
          fingerprint: x.fingerprint,
        });
        createdIds.push(String(doc._id));
      } catch (e) {
        if (e.code !== 11000) throw e;
      }
    }

    return res.json({
      ok: true,
      createdCount: createdIds.length,
      createdIds,
      skipped: { duplicatesInPayload: duplicatesInPayload.length, duplicatesInDb: duplicatesInDb.length, invalid: invalid.length },
    });
  } catch (err) {
    console.error("TopicPastPapers bulk error:", err);
    return res.status(400).json({ error: err.message || "Bad request" });
  }
});

// POST /api/topic-past-papers/upload (files)
router.post("/upload", auth, upload.array("files", 20), async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const ownerId = getOwnerId(req);
    const topicKey = req.body.topicKey;
    const specKeyBody = req.body.specKey;
    const resolved = resolveStoredTopicKey(specKeyBody, topicKey);
    if (resolved.error) return res.status(400).json({ error: resolved.error });
    const validKey = resolved.storedKey;

    let meta = {};
    try {
      if (req.body.metadata && typeof req.body.metadata === "string") meta = JSON.parse(req.body.metadata);
    } catch {}
    const dedupeMode = req.body.dedupeMode || meta.dedupeMode || "skip";

    // PR-COMP-AQA-1: Block AQA file uploads (compliance)
    const examBoard = (meta.examBoard || "").toString().trim().toUpperCase();
    const title = (meta.title || "").toString();
    if (examBoard === "AQA") {
      return res.status(400).json({ error: "AQA past papers must be linked from aqa.org.uk and cannot be uploaded." });
    }
    if (/aqa/i.test(title) && /paper/i.test(title)) {
      return res.status(400).json({ error: "AQA past papers must be linked from aqa.org.uk and cannot be uploaded." });
    }
    const files = Array.isArray(req.files) ? req.files : [];
    for (const f of files) {
      if (f.originalname && /aqa/i.test(f.originalname)) {
        return res.status(400).json({ error: "AQA past papers must be linked from aqa.org.uk and cannot be uploaded." });
      }
    }
    const createdIds = [];
    const rejected = [];
    const processed = [];

    for (const file of files) {
      if (!file.buffer || file.size > MAX_SIZE) {
        rejected.push({ name: file.originalname, reason: "Too large or invalid" });
        continue;
      }
      const mime = (file.mimetype || "").toLowerCase();
      if (!ALLOWED_MIMES.includes(mime)) {
        return res.status(400).json({ error: "Invalid file type. Allowed: pdf, doc, docx", file: file.originalname });
      }

      try {
        const saved = saveUploadAndHash(file.buffer, { originalName: file.originalname, mimetype: file.mimetype }, ownerId);
        const fa = await FileAsset.create({
          ownerId,
          storage: "local",
          path: saved.path,
          originalName: saved.originalName,
          mimeType: saved.mimeType,
          size: saved.size,
          sha256: saved.sha256,
        });

        const title = meta.title || (saved.originalName ? path.basename(saved.originalName, path.extname(saved.originalName)) : "Past paper");
        const item = {
          title,
          year: meta.year,
          paper: meta.paper || "",
          session: meta.session || "",
          tier: meta.tier || "",
          type: meta.type || "",
          sha256: saved.sha256,
          file: { fileId: fa._id, originalName: saved.originalName, mimeType: saved.mimeType, size: saved.size, sha256: saved.sha256 },
        };
        const fp = fingerprintFile(item);
        item.fingerprint = fp;

        const queryKeys = queryCandidates((specKeyBody && String(specKeyBody).trim()) || DEFAULT_SPEC_LEGACY, parseTopicKey(topicKey || "").topicKey || topicKey);
        const exists = await TopicPastPaper.findOne({ ownerId, topicKey: { $in: queryKeys }, fingerprint: fp }).lean();
        if (exists && dedupeMode === "error") {
          rejected.push({ name: file.originalname, reason: "Duplicate (dedupeMode=error)" });
          continue;
        }
        if (exists && dedupeMode === "skip") {
          rejected.push({ name: file.originalname, reason: "Duplicate in DB" });
          continue;
        }

        const doc = await TopicPastPaper.create({
          ownerId,
          topicKey: validKey,
          title: item.title,
          examBoard: meta.examBoard || "",
          qualification: meta.qualification || "",
          subject: meta.subject || "",
          year: item.year,
          paper: item.paper,
          session: item.session,
          tier: item.tier,
          type: item.type,
          tags: Array.isArray(meta.tags) ? meta.tags : [],
          sourceType: "file",
          file: item.file,
          status: "draft",
          fingerprint: fp,
        });
        createdIds.push(String(doc._id));
        processed.push(file.originalname);
      } catch (e) {
        rejected.push({ name: file.originalname, reason: e.message || "Save failed" });
      }
    }

    return res.json({
      ok: true,
      createdCount: createdIds.length,
      createdIds,
      skipped: { duplicatesInPayload: 0, duplicatesInDb: rejected.filter((r) => r.reason?.includes("Duplicate")).length, invalid: rejected.filter((r) => !r.reason?.includes("Duplicate")).length },
      uploaded: { totalFiles: files.length, acceptedFiles: processed.length, rejectedFiles: rejected.length },
      rejected,
    });
  } catch (err) {
    console.error("TopicPastPapers upload error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

const BULK_IDS_MAX = 500;

// PR-EDGE-2: POST /api/topic-past-papers/bulk/publish
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
    const permitted = await TopicPastPaper.countDocuments(query);
    if (!isAdmin && permitted === 0) return res.status(404).json({ error: "Not found" });
    const result = await TopicPastPaper.updateMany(query, { $set: { status: "published" } });
    return res.json({ ok: true, matchedCount: result.matchedCount, updatedCount: result.modifiedCount });
  } catch (err) {
    console.error("TopicPastPapers bulk publish error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// PR-EDGE-2: POST /api/topic-past-papers/bulk/unpublish
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
    const permitted = await TopicPastPaper.countDocuments(query);
    if (!isAdmin && permitted === 0) return res.status(404).json({ error: "Not found" });
    const result = await TopicPastPaper.updateMany(query, { $set: { status: "draft" } });
    return res.json({ ok: true, matchedCount: result.matchedCount, updatedCount: result.modifiedCount });
  } catch (err) {
    console.error("TopicPastPapers bulk unpublish error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/topic-past-papers/file/:fileId (download)
router.get("/file/:fileId", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const fileId = req.params.fileId;
    if (!mongoose.Types.ObjectId.isValid(fileId)) return res.status(400).json({ error: "Invalid file id" });
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;

    const asset = await FileAsset.findById(fileId).lean();
    if (!asset) return res.status(404).json({ error: "File not found" });
    if (!isAdmin && String(asset.ownerId) !== String(ownerId)) return res.status(404).json({ error: "File not found" });

    const filePath = path.isAbsolute(asset.path) ? asset.path : path.join(__dirname, "..", asset.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found on disk" });

    res.setHeader("Content-Type", asset.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${(asset.originalName || "file").replace(/"/g, "'")}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    console.error("TopicPastPapers file download error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// POST publish / unpublish
router.post("/:id/publish", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const id = req.params.id;
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });
    const doc = await TopicPastPaper.findOne({ _id: id });
    if (!doc) return res.status(404).json({ error: "Past paper not found" });
    if (!isAdmin && String(doc.ownerId) !== String(ownerId)) return res.status(404).json({ error: "Past paper not found" });
    doc.status = "published";
    await doc.save();
    return res.json({ pastPaper: doc.toObject() });
  } catch (err) {
    console.error("TopicPastPapers publish error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/unpublish", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const id = req.params.id;
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });
    const doc = await TopicPastPaper.findOne({ _id: id });
    if (!doc) return res.status(404).json({ error: "Past paper not found" });
    if (!isAdmin && String(doc.ownerId) !== String(ownerId)) return res.status(404).json({ error: "Past paper not found" });
    doc.status = "draft";
    await doc.save();
    return res.json({ pastPaper: doc.toObject() });
  } catch (err) {
    console.error("TopicPastPapers unpublish error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  if (!isTeacherOrAdmin(req)) return res.status(403).json({ error: "Teachers and admins only" });
  try {
    const id = req.params.id;
    const ownerId = getOwnerId(req);
    const isAdmin = (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user.isAdmin === true;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });
    const doc = await TopicPastPaper.findOne({ _id: id });
    if (!doc) return res.status(404).json({ error: "Past paper not found" });
    if (!isAdmin && String(doc.ownerId) !== String(ownerId)) return res.status(404).json({ error: "Past paper not found" });
    await TopicPastPaper.deleteOne({ _id: id });
    return res.json({ ok: true });
  } catch (err) {
    console.error("TopicPastPapers DELETE error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
