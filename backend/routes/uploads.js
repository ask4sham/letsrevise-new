// /backend/routes/uploads.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const router = express.Router();

// Base folder where uploads live (served by server.js at /uploads)
const UPLOADS_BASE = path.join(__dirname, "..", "uploads");

// Ensure base exists
if (!fs.existsSync(UPLOADS_BASE)) {
  fs.mkdirSync(UPLOADS_BASE, { recursive: true });
}

/**
 * Folder can be provided in TWO ways:
 *  1) Querystring (recommended):  POST /api/uploads/image?folder=images/gcse
 *  2) Multipart field (fallback): -F "folder=images/gcse"
 */
function sanitizeFolder(folderValue) {
  const safe = (folderValue || "images")
    .toString()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.\./g, ""); // basic traversal guard

  const abs = path.join(UPLOADS_BASE, safe);
  fs.mkdirSync(abs, { recursive: true });

  return { safe, abs };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      // ✅ Use querystring FIRST (always available during destination)
      const folderValue = req.query?.folder || req.body?.folder || "images";
      const { safe, abs } = sanitizeFolder(folderValue);

      // store for later response
      req._uploadSafeFolder = safe;

      cb(null, abs);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
    const base = path
      .basename(file.originalname || "upload", ext)
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const stamp = Date.now();
    cb(null, `${base || "file"}-${stamp}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    const ok = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
    ].includes(file.mimetype);
    if (!ok)
      return cb(
        new Error("Only image files are allowed (png/jpg/webp/gif).")
      );
    cb(null, true);
  },
});

// Ping endpoint
router.get("/", (req, res) => {
  res.json({
    ok: true,
    message:
      "Uploads API ready. POST /api/uploads/image?folder=images/gcse (multipart field name: file)",
  });
});

// Generic upload endpoint (field name: file)
router.post("/image", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No file uploaded. Use form field name: file" });
    }

    // ✅ Use folder chosen during destination (always correct)
    const safeFolder = req._uploadSafeFolder || "images";
    const publicUrl = `/uploads/${safeFolder}/${req.file.filename}`.replace(
      /\\/g,
      "/"
    );

    return res.json({
      ok: true,
      url: publicUrl,
      filename: req.file.filename,
      folder: safeFolder,
    });
  } catch (e) {
    console.error("Upload handler error:", e);
    return res
      .status(500)
      .json({ error: "Upload failed", details: e?.message || String(e) });
  }
});

/**
 * ✅ NEW: Lesson image upload endpoint for CreateLessonPage
 *
 * Frontend calls:
 *   POST /api/uploads/lesson-image
 *   field name: "image"
 *
 * We default folder to "lesson-images" so files go under:
 *   /uploads/lesson-images/...
 */
router.post(
  "/lesson-image",
  (req, res, next) => {
    // If caller didn't specify folder, default to "lesson-images"
    if (!req.query.folder && !req.body?.folder) {
      req.query.folder = "lesson-images";
    }
    next();
  },
  upload.single("image"),
  (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ error: "No file uploaded. Use form field name: image" });
      }

      const safeFolder = req._uploadSafeFolder || "lesson-images";
      const publicUrl = `/uploads/${safeFolder}/${req.file.filename}`.replace(
        /\\/g,
        "/"
      );

      return res.json({
        ok: true,
        url: publicUrl,
        filename: req.file.filename,
        folder: safeFolder,
      });
    } catch (e) {
      console.error("Lesson-image upload handler error:", e);
      return res.status(500).json({
        error: "Upload failed",
        details: e?.message || String(e),
      });
    }
  }
);

// Friendly errors
router.use((err, req, res, next) => {
  console.error("Uploads route error:", err);
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File too large (max 8MB)." });
  }
  return res.status(400).json({ error: err?.message || "Upload error" });
});

module.exports = router;
