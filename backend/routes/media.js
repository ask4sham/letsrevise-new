const express = require("express");
const router = express.Router();
const multer = require("multer");
const auth = require("../middleware/auth");
const Lesson = require("../models/Lesson");

const { createClient } = require("@supabase/supabase-js");

// service role key ONLY on backend
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const upload = multer({ storage: multer.memoryStorage() });

router.post("/lesson-block", auth, upload.single("file"), async (req, res) => {
  try {
    const { lessonId, pageId, blockIndex } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ msg: "No file uploaded" });
    if (!lessonId || !pageId) return res.status(400).json({ msg: "Missing metadata" });

    // optionally validate lesson exists
    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });

    const bucket = process.env.SUPABASE_MEDIA_BUCKET || "lesson-media";

    const safeName = (file.originalname || "upload")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9.\-_]/g, "");

    const uploaderId = String(req.user._id || req.user.id || "unknown");

    const path = `uploader_${uploaderId}/lesson_${lessonId}/page_${pageId}/block_${blockIndex}/${Date.now()}_${safeName}`;

    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

    if (error) return res.status(400).json({ msg: error.message });

    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);

    return res.json({
      success: true,
      publicUrl: data.publicUrl,
      path,
    });
  } catch (err) {
    console.error("media upload error", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
