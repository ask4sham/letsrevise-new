/**
 * P2.1 — Diagram Asset Library routes (prototype).
 * Flag: DIAGRAM_ASSET_LIBRARY=1
 *
 * POST   /api/diagram-assets          — register asset (JSON metadata + imageUrl from prior upload)
 * POST   /api/diagram-assets/upload   — upload file + metadata (multipart)
 * GET    /api/diagram-assets          — list assets
 * GET    /api/diagram-assets/:id      — get one
 * POST   /api/diagram-assets/:id/attach — attach to lesson diagram block
 */
const express = require("express");
const multer = require("multer");
const auth = require("../middleware/auth");
const { isDiagramAssetLibraryEnabled } = require("../config/diagramAssetFlags");
const {
  createDiagramAsset,
  getDiagramAssetById,
  listDiagramAssets,
  attachDiagramAssetToLessonBlock,
} = require("../services/diagramAssetService");
const { finishImageUploadToStorage } = require("../routes/uploads");
const Lesson = require("../models/Lesson");
const { getLessonOwnerId } = require("../utils/lessonPayload");
const { sendInternalError } = require("../utils/safeErrorResponse");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

function requireLibraryEnabled(req, res, next) {
  if (!isDiagramAssetLibraryEnabled()) {
    return res.status(404).json({ error: "Diagram Asset Library is not enabled" });
  }
  return next();
}

function requireTeacherOrAdmin(req, res) {
  const t = String(req.user?.userType || req.user?.role || "").toLowerCase();
  if (t !== "teacher" && t !== "admin") {
    res.status(403).json({ error: "Only teachers or admins can manage diagram assets" });
    return false;
  }
  return true;
}

function parseMetadataField(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

router.use(requireLibraryEnabled);

router.post("/", auth, async (req, res) => {
  try {
    if (!requireTeacherOrAdmin(req, res)) return;
    const ownerId = String(req.user._id || req.user.id);
    const asset = await createDiagramAsset(req.body || {}, ownerId);
    return res.status(201).json({ asset });
  } catch (err) {
    if (err.statusCode === 422) return res.status(422).json({ error: err.message });
    return sendInternalError("diagram-assets/create", err, res);
  }
});

router.post("/upload", auth, upload.single("file"), async (req, res) => {
  try {
    if (!requireTeacherOrAdmin(req, res)) return;
    if (!req.file) return res.status(400).json({ error: "No file uploaded (field: file)" });

    const ownerId = String(req.user._id || req.user.id);
    const meta = parseMetadataField(req.body?.metadata);
    const safeFolder = `diagram-assets/${ownerId}`.replace(/\\/g, "/");
    const filename = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

    const stored = await finishImageUploadToStorage(
      req.file.buffer,
      req.file.mimetype,
      safeFolder,
      filename
    );

    const asset = await createDiagramAsset(
      {
        title: meta.title || req.body?.title || "Untitled diagram",
        subject: meta.subject || req.body?.subject || "Biology",
        topic: meta.topic || req.body?.topic || "",
        examBoard: meta.examBoard || req.body?.examBoard || "AQA",
        tier: meta.tier || req.body?.tier || "Higher",
        keywords: meta.keywords || req.body?.keywords,
        activityTypes: meta.activityTypes || req.body?.activityTypes,
        source: meta.source || req.body?.source || "chatgpt",
        imageUrl: stored.url,
        originalImageUrl: stored.originalUrl || null,
        mimeType: req.file.mimetype,
        storage: stored.storage,
        metadata: meta,
      },
      ownerId
    );

    return res.status(201).json({ asset, upload: stored });
  } catch (err) {
    return sendInternalError("diagram-assets/upload", err, res);
  }
});

router.get("/", auth, async (req, res) => {
  try {
    if (!requireTeacherOrAdmin(req, res)) return;
    const ownerId = String(req.user._id || req.user.id);
    const assets = await listDiagramAssets({
      ownerId,
      subject: req.query.subject,
      topic: req.query.topic,
      limit: req.query.limit,
    });
    return res.json({ assets, count: assets.length });
  } catch (err) {
    return sendInternalError("diagram-assets/list", err, res);
  }
});

router.get("/:id", auth, async (req, res) => {
  try {
    if (!requireTeacherOrAdmin(req, res)) return;
    const ownerId = String(req.user._id || req.user.id);
    const asset = await getDiagramAssetById(req.params.id, ownerId);
    if (!asset) return res.status(404).json({ error: "Diagram asset not found" });
    return res.json({ asset });
  } catch (err) {
    return sendInternalError("diagram-assets/get", err, res);
  }
});

router.post("/:id/attach", auth, async (req, res) => {
  try {
    if (!requireTeacherOrAdmin(req, res)) return;
    const ownerId = String(req.user._id || req.user.id);
    const lessonId = String(req.body?.lessonId || "").trim();
    const pageIndex = Number(req.body?.pageIndex);
    const blockIndex = Number(req.body?.blockIndex);

    if (!lessonId) return res.status(400).json({ error: "lessonId is required" });

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    const lessonOwner = getLessonOwnerId(lesson);
    const isOwner = lessonOwner === ownerId;
    const isAdmin = String(req.user?.userType || req.user?.role || "").toLowerCase() === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Only the lesson owner can attach diagram assets" });
    }

    const { pages, asset } = await attachDiagramAssetToLessonBlock({
      lesson,
      pageIndex,
      blockIndex,
      assetId: req.params.id,
      ownerId,
    });

    lesson.pages = pages;
    await lesson.save();

    return res.json({
      ok: true,
      asset,
      lessonId: String(lesson._id),
      pageIndex,
      blockIndex,
      block: pages[pageIndex]?.blocks?.[blockIndex] || null,
    });
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    return sendInternalError("diagram-assets/attach", err, res);
  }
});

module.exports = router;
