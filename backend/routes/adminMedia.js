/**
 * PR-BULK-INGEST-3: Admin media upload — local storage, SHA-256 dedupe.
 */
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const auth = require("../middleware/auth");
const Media = require("../models/Media");
const { sha256Buffer } = require("../utils/mediaHash");

const router = express.Router();

const { FILE_STORAGE_PATH } = require("../config/paths");
const UPLOAD_DIR = FILE_STORAGE_PATH;
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

function extFromMime(mime) {
  switch (mime) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "application/pdf":
      return ".pdf";
    default:
      return "";
  }
}

router.post("/upload", auth, upload.single("file"), async (req, res) => {
  try {
    const actorId = req.user?._id || req.user?.id || req.user?.userId || null;
    if (!actorId) return res.status(401).json({ error: "Unauthorized" });

    // PR-PAST-PAPERS-UI-1: Hard guardrail — must confirm upload rights (multipart sends string "true"/"false")
    const confirm = req.body?.confirmCopyright;
    const confirmed = confirm === true || confirm === "true";
    if (!confirmed) {
      return res.status(400).json({
        error: "You must confirm you have permission to upload and use this material.",
      });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: "Missing file" });

    const allowed = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
    if (!allowed.has(file.mimetype)) {
      return res.status(400).json({ error: `Unsupported file type: ${file.mimetype}` });
    }

    const sha256 = sha256Buffer(file.buffer);
    const ext = extFromMime(file.mimetype);
    const filename = `${sha256}${ext}`;
    const relPath = path.join("uploads", filename);
    const absPath = path.join(__dirname, "..", relPath);
    const url = `/${relPath.replace(/\\/g, "/")}`;

    const existing = await Media.findOne({ ownerId: actorId, sha256 }).lean();
    if (existing) {
      return res.status(200).json({
        mediaId: existing._id,
        url: existing.url,
        sha256: existing.sha256,
        mimeType: existing.mimeType,
        size: existing.size,
        originalName: existing.originalName,
      });
    }

    if (!fs.existsSync(absPath)) {
      fs.writeFileSync(absPath, file.buffer);
    }

    const doc = await Media.create({
      ownerId: actorId,
      sha256,
      mimeType: file.mimetype,
      size: file.size,
      originalName: file.originalname,
      storage: "local",
      path: relPath.replace(/\\/g, "/"),
      url,
    });

    return res.status(201).json({
      mediaId: doc._id,
      url: doc.url,
      sha256: doc.sha256,
      mimeType: doc.mimeType,
      size: doc.size,
      originalName: doc.originalName,
    });
  } catch (e) {
    return res.status(400).json({ error: e.message || "Upload failed" });
  }
});

module.exports = router;
