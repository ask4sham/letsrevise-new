// /backend/routes/uploads.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const auth = require("../middleware/auth");
const { uploadToR2, isR2Enabled } = require("../services/r2Storage");
const { uploadToSupabase, isSupabaseStorageEnabled } = require("../services/supabaseStorage");
const {
  isPngMime,
  displayFilenameForPng,
  createLessonPngDisplayBuffer,
} = require("../services/lessonPngDisplay");

const router = express.Router();

// Base folder where uploads live (configurable via FILE_STORAGE_PATH)
const { FILE_STORAGE_PATH } = require("../config/paths");
const UPLOADS_BASE = FILE_STORAGE_PATH;

/**
 * LOCKED: Canonical video upload path. All video uploads MUST go here.
 * - Path: backend/public/visuals/biology/aqa-gcse/cell-biology/cell-structure
 * - Public URL: /visuals/biology/aqa-gcse/cell-biology/cell-structure/{filename}
 * Do NOT add or change video upload destinations. This is the only route for videos.
 */
const VIDEOS_DIR = path.join(__dirname, "..", "public", "visuals", "biology", "aqa-gcse", "cell-biology", "cell-structure");
const VIDEO_PUBLIC_URL_PREFIX = "/visuals/biology/aqa-gcse/cell-biology/cell-structure";

// Ensure base and video dir exist at load
try {
  fs.mkdirSync(UPLOADS_BASE, { recursive: true });
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
} catch (e) {
  console.error("[uploads] Failed to create uploads dirs:", e);
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

function makeFilename(file) {
  const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
  const base = path
    .basename(file.originalname || "upload", ext)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const stamp = Date.now();
  return `${base || "file"}-${stamp}${ext}`;
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const folderValue = req.query?.folder || req.body?.folder || "images";
      const { safe, abs } = sanitizeFolder(folderValue);
      req._uploadSafeFolder = safe;
      cb(null, abs);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    cb(null, makeFilename(file));
  },
});

const memoryStorage = multer.memoryStorage();

// Always use memory for image uploads so we can try Supabase/R2 first; fallback writes buffer to disk
const storage = memoryStorage;

/** Set upload folder/filename for memory uploads — multer memoryStorage doesn't set these */
function setUploadMeta(req, res, next) {
  const folderValue = req.query?.folder || req.body?.folder || "images";
  const safe = (folderValue || "images")
    .toString()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.\./g, "");
  req._uploadSafeFolder = safe;
  if (req.file && !req.file.filename) {
    req.file.filename = makeFilename(req.file);
  }
  next();
}

// ---------- IMAGE UPLOAD (images only)
const imageMimeTypes = [
  "image/png",
  "image/x-png",
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/webp",
  "image/gif",
];
const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

function imageFileFilter(req, file, cb) {
  const mt = (file.mimetype || "").toLowerCase().split(";")[0].trim();
  const ext = (path.extname(file.originalname || "") || "").toLowerCase();
  const ok =
    imageMimeTypes.includes(mt) ||
    (mt && mt.startsWith("image/")) ||
    imageExtensions.includes(ext);
  if (ok) return cb(null, true);
  return cb(
    new Error("Only image files are allowed (png/jpg/jpeg/webp/gif).")
  );
}

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB for images
  fileFilter: imageFileFilter,
});

// ---------- VIDEO UPLOAD (videos only)
const videoMimeTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-mp4",
  "application/mp4",
  "application/octet-stream",
]);
const videoExtensions = new Set([".mp4", ".webm", ".mov"]);

function videoFileFilter(req, file, cb) {
  try {
    const mime = (file.mimetype || "").toLowerCase().split(";")[0].trim();
    const ext = (path.extname(file.originalname || "") || "").toLowerCase();

    const mimeOk = videoMimeTypes.has(mime) || (mime && mime.startsWith("video/"));
    const extOk = videoExtensions.has(ext);

    if (extOk && (mimeOk || mime === "application/octet-stream")) {
      return cb(null, true);
    }

    return cb(new Error("Only video files are allowed (mp4/webm/mov)."), false);
  } catch (err) {
    return cb(err, false);
  }
}

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      fs.mkdirSync(VIDEOS_DIR, { recursive: true });
      req._uploadSafeFolder = "videos";
      cb(null, VIDEOS_DIR);
    } catch (err) {
      console.error("[video upload] folder creation failed:", err);
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    try {
      const ext = (path.extname(file.originalname || "") || "").toLowerCase() || ".mp4";
      const base = path
        .basename(file.originalname || "video", ext)
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80);
      cb(null, `${Date.now()}-${base || "video"}${ext}`);
    } catch (err) {
      cb(err);
    }
  },
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB for videos
  fileFilter: videoFileFilter,
});

// Lesson-media: image only (video uploads go to /api/uploads/video → public/visuals/biology/aqa-gcse/cell-biology/cell-structure)
const uploadLessonMedia = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB for images
  fileFilter: imageFileFilter,
});

/**
 * Persist image buffer (Supabase → R2 → local). For PNG, also writes a normalised `*.display.png` sibling.
 * Response `url` is the display PNG when that variant exists (lesson canonical), else the original.
 */
async function finishImageUploadToStorage(buffer, mimetype, safeFolder, filename) {
  const storagePath = `${safeFolder}/${filename}`.replace(/\\/g, "/");
  const displayName = displayFilenameForPng(filename);
  let displayBuffer = null;
  let displayPath = null;
  if (displayName && isPngMime(mimetype)) {
    displayBuffer = await createLessonPngDisplayBuffer(buffer);
    if (displayBuffer) {
      displayPath = `${safeFolder}/${displayName}`.replace(/\\/g, "/");
    }
  }

  if (isSupabaseStorageEnabled()) {
    const origUrl = await uploadToSupabase(buffer, storagePath, mimetype || "image/png");
    if (origUrl) {
      let dispUrl = null;
      if (displayBuffer && displayPath) {
        dispUrl = await uploadToSupabase(displayBuffer, displayPath, "image/png");
      }
      return {
        ok: true,
        url: dispUrl || origUrl,
        ...(dispUrl ? { originalUrl: origUrl, displayUrl: dispUrl } : {}),
        filename,
        folder: safeFolder,
        storage: "supabase",
      };
    }
    console.warn("[uploads] Supabase upload failed, trying fallback");
  }

  if (isR2Enabled()) {
    const origUrl = await uploadToR2(buffer, storagePath, mimetype || "image/png");
    if (origUrl) {
      let dispUrl = null;
      if (displayBuffer && displayPath) {
        dispUrl = await uploadToR2(displayBuffer, displayPath, "image/png");
      }
      return {
        ok: true,
        url: dispUrl || origUrl,
        ...(dispUrl ? { originalUrl: origUrl, displayUrl: dispUrl } : {}),
        filename,
        folder: safeFolder,
        storage: "r2",
      };
    }
    console.warn("[uploads] R2 upload failed, falling back to local");
  }

  try {
    const { abs } = sanitizeFolder(safeFolder);
    fs.writeFileSync(path.join(abs, filename), buffer);
    if (displayBuffer && displayName) {
      fs.writeFileSync(path.join(abs, displayName), displayBuffer);
    }
  } catch (writeErr) {
    console.error("[uploads] Fallback disk write failed:", writeErr.message);
    throw writeErr;
  }

  const origPublic = `/uploads/${safeFolder}/${filename}`.replace(/\\/g, "/");
  const dispPublic =
    displayBuffer && displayName
      ? `/uploads/${safeFolder}/${displayName}`.replace(/\\/g, "/")
      : null;

  return {
    ok: true,
    url: dispPublic || origPublic,
    ...(dispPublic ? { originalUrl: origPublic, displayUrl: dispPublic } : {}),
    filename,
    folder: safeFolder,
  };
}

// Ping endpoint
router.get("/", (req, res) => {
  const storageType = isSupabaseStorageEnabled()
    ? "supabase"
    : isR2Enabled()
      ? "r2"
      : "local";
  res.json({
    ok: true,
    message:
      "Uploads API ready. POST /api/uploads/image (images) or POST /api/uploads/video (videos)",
    storage: storageType,
  });
});

// Debug: verify router is mounted — GET /api/uploads/__ping
router.get("/__ping", (req, res) => {
  const storageType = isSupabaseStorageEnabled()
    ? "supabase"
    : isR2Enabled()
      ? "r2"
      : "local";
  res.json({
    ok: true,
    route: "uploads",
    hasVideo: true,
    storage: storageType,
  });
});

/**
 * Robust video upload handler: catches multer errors (400), missing file (400), route crashes (500).
 * Uses callback pattern so multer errors don't propagate to 500.
 */
function handleVideoUploadSafe(req, res) {
  try {
    if (!req.file) {
      console.warn("[video upload] no file in request");
      return res.status(400).json({ ok: false, error: "No video file uploaded. Use form field name: file" });
    }

    const publicUrl = `${VIDEO_PUBLIC_URL_PREFIX}/${req.file.filename}`.replace(/\\/g, "/");

    console.log("[video upload] success:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      filename: req.file.filename,
      path: req.file.path,
      url: publicUrl,
    });

    return res.status(200).json({
      ok: true,
      url: publicUrl,
      filename: req.file.filename,
      folder: VIDEO_PUBLIC_URL_PREFIX.replace(/^\//, ""),
      type: "video",
    });
  } catch (e) {
    console.error("[video upload] route crash:", e);
    return res.status(500).json({ ok: false, error: "Video upload failed." });
  }
}

/**
 * Middleware + handler: invokes multer with callback so errors return 400, not 500.
 */
function videoUploadRoute(req, res, next) {
  uploadVideo.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error("[video upload] multer error:", err.code, err.message);
      return res.status(400).json({ ok: false, error: err.message || "Upload error" });
    }
    if (err) {
      console.error("[video upload] filter/storage error:", err);
      return res.status(400).json({ ok: false, error: err.message || "Only video files allowed (mp4/webm/mov)." });
    }
    handleVideoUploadSafe(req, res);
  });
}

/**
 * POST /api/uploads/video — Videos only (mp4/webm/mov).
 * Must be before /image to avoid any path ambiguity.
 */
router.post("/video", videoUploadRoute);

/**
 * POST /api/uploads/image — Images only (png/jpg/jpeg/webp/gif).
 * Field name: file. Optional querystring: ?folder=images/gcse
 * When R2 configured: uploads to R2, returns full public URL (https://...r2.dev/...).
 * Otherwise: saves to local disk, returns /uploads/... path.
 */
router.post("/image", upload.single("file"), setUploadMeta, async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No file uploaded. Use form field name: file" });
    }

    const safeFolder = req._uploadSafeFolder || "images";
    const filename = req.file.filename || makeFilename(req.file);

    if (req.file.buffer) {
      const provider = isSupabaseStorageEnabled() ? "Supabase" : isR2Enabled() ? "R2" : "local";
      console.log("[uploads] Upload provider:", provider);
      try {
        const payload = await finishImageUploadToStorage(
          req.file.buffer,
          req.file.mimetype,
          safeFolder,
          filename
        );
        return res.json(payload);
      } catch (writeErr) {
        console.error("[uploads] Fallback disk write failed:", writeErr.message);
        return res.status(500).json({ error: "Upload failed. Storage unavailable." });
      }
    }

    // No buffer (unexpected with memory storage)
    const publicUrl = `/uploads/${safeFolder}/${filename}`.replace(/\\/g, "/");
    return res.json({
      ok: true,
      url: publicUrl,
      filename,
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
 * POST /api/uploads/lesson-media — CreateLessonPage (and draft) image/video upload.
 * Auth required. When R2 configured: returns full R2 URL. Otherwise: /uploads/lesson-media/...
 */
router.post(
  "/lesson-media",
  auth,
  (req, res, next) => {
    const folder = (req.query?.folder || req.body?.folder || "lesson-media").toString().trim();
    if (!folder || folder === "lesson-media") {
      req.query.folder = "lesson-media";
    }
    next();
  },
  uploadLessonMedia.single("file"),
  setUploadMeta,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded. Use form field name: file" });
      }
      const safeFolder = req._uploadSafeFolder || "lesson-media";
      const filename = req.file.filename || makeFilename(req.file);

      if (req.file.buffer) {
        try {
          const payload = await finishImageUploadToStorage(
            req.file.buffer,
            req.file.mimetype,
            safeFolder,
            filename
          );
          return res.json(payload);
        } catch (writeErr) {
          console.error("[uploads] Lesson-media fallback write failed:", writeErr.message);
          return res.status(500).json({ error: "Upload failed. Storage unavailable." });
        }
      }

      const publicUrl = `/uploads/${safeFolder}/${filename}`.replace(/\\/g, "/");
      return res.json({ ok: true, url: publicUrl, filename, folder: safeFolder });
    } catch (e) {
      console.error("Lesson-media upload error:", e);
      return res.status(500).json({ error: "Upload failed", details: e?.message || String(e) });
    }
  }
);

/**
 * POST /api/uploads/lesson-image — CreateLessonPage, field name: "image"
 * When R2 configured: returns full R2 URL. Otherwise: /uploads/lesson-images/...
 */
router.post(
  "/lesson-image",
  (req, res, next) => {
    if (!req.query.folder && !req.body?.folder) {
      req.query.folder = "lesson-images";
    }
    next();
  },
  upload.single("image"),
  setUploadMeta,
  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ error: "No file uploaded. Use form field name: image" });
      }

      const safeFolder = req._uploadSafeFolder || "lesson-images";
      const filename = req.file.filename || makeFilename(req.file);

      if (req.file.buffer) {
        try {
          const payload = await finishImageUploadToStorage(
            req.file.buffer,
            req.file.mimetype,
            safeFolder,
            filename
          );
          return res.json(payload);
        } catch (writeErr) {
          console.error("[uploads] Lesson-image fallback write failed:", writeErr.message);
          return res.status(500).json({ error: "Upload failed. Storage unavailable." });
        }
      }

      const publicUrl = `/uploads/${safeFolder}/${filename}`.replace(/\\/g, "/");
      return res.json({ ok: true, url: publicUrl, filename, folder: safeFolder });
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
    return res.status(400).json({
      error: err.message || "File too large. Images: max 15MB. Videos: max 100MB.",
    });
  }
  return res.status(400).json({ error: err?.message || "Upload error" });
});

module.exports = router;
module.exports.videoUploadRoute = videoUploadRoute;
