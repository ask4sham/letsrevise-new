const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Lesson = require("../models/Lesson");

/* =========================
   Helpers
========================= */
function normalizeTier(tier) {
  if (tier === undefined || tier === null) return undefined;

  const t = String(tier).trim().toLowerCase();

  // allow a few common variants
  if (t === "" || t === "none" || t === "all") return undefined;
  if (t.includes("foundation")) return "foundation";
  if (t.includes("higher")) return "higher";

  // if someone sends exact enum already
  if (t === "foundation" || t === "higher") return t;

  // unknown value -> let schema validation reject it if GCSE
  return t;
}

function sanitizeTierByLevel(level, tier) {
  if (level !== "GCSE") return undefined;
  return normalizeTier(tier);
}

/* =========================
   Routes
========================= */

/**
 * @route   POST /api/lessons
 * @desc    Create a new lesson (Teacher)
 * @access  Private
 */
router.post("/", auth, async (req, res) => {
  try {
    if (req.user.userType !== "teacher") {
      return res.status(403).json({ success: false, msg: "Only teachers can create lessons" });
    }

    const {
      title,
      description,
      content,
      subject,
      level,
      tier, // ✅ NEW: GCSE tier
      topic,
      tags,
      estimatedDuration,
      shamCoinPrice,
      resources,
    } = req.body;

    const lesson = new Lesson({
      title,
      description,
      content,
      teacherId: req.user._id,
      teacherName: `${req.user.firstName} ${req.user.lastName}`,
      subject,
      level,

      // ✅ Only set tier when GCSE
      tier: sanitizeTierByLevel(level, tier),

      topic,
      tags: Array.isArray(tags) ? tags : [],
      estimatedDuration,
      shamCoinPrice,
      resources: Array.isArray(resources) ? resources : [],
      isPublished: false,
    });

    await lesson.save();

    return res.json({ success: true, lesson });
  } catch (err) {
    console.error("POST /api/lessons error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
});

/**
 * @route   PUT /api/lessons/:id
 * @desc    Update a lesson (Teacher owns it)
 * @access  Private
 */
router.put("/:id", auth, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ success: false, msg: "Lesson not found" });

    // Teacher only, and must own it
    if (req.user.userType !== "teacher") {
      return res.status(403).json({ success: false, msg: "Only teachers can edit lessons" });
    }
    if (lesson.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, msg: "Not authorised" });
    }

    // Update allowed fields (keep it safe)
    const up = req.body || {};

    if (typeof up.title === "string") lesson.title = up.title;
    if (typeof up.description === "string") lesson.description = up.description;
    if (typeof up.content === "string") lesson.content = up.content;
    if (typeof up.subject === "string") lesson.subject = up.subject;
    if (typeof up.level === "string") lesson.level = up.level;
    if (typeof up.topic === "string") lesson.topic = up.topic;

    if (Array.isArray(up.tags)) lesson.tags = up.tags;
    if (Array.isArray(up.resources)) lesson.resources = up.resources;

    if (up.estimatedDuration !== undefined) lesson.estimatedDuration = up.estimatedDuration;
    if (up.shamCoinPrice !== undefined) lesson.shamCoinPrice = up.shamCoinPrice;

    // ✅ Tier update (must obey GCSE-only rule)
    // If level is changed to non-GCSE, tier gets cleared automatically.
    // If level is GCSE, tier must be foundation/higher (your model enforces it).
    const newLevel = typeof up.level === "string" ? up.level : lesson.level;
    const requestedTier = up.tier !== undefined ? up.tier : lesson.tier;
    lesson.tier = sanitizeTierByLevel(newLevel, requestedTier);

    await lesson.save();

    return res.json({ success: true, lesson });
  } catch (err) {
    console.error("PUT /api/lessons/:id error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
});

/**
 * @route   GET /api/lessons
 * @desc    Get published lessons (optional filters)
 * @access  Public
 *
 * Optional query:
 *  - subject
 *  - level
 *  - tier (GCSE only)
 */
router.get("/", async (req, res) => {
  try {
    const { subject, level, tier } = req.query;

    const query = { isPublished: true };

    if (subject) query.subject = subject;
    if (level) query.level = level;

    // ✅ If level is GCSE and tier provided, include it. Otherwise ignore tier filter.
    if (level === "GCSE" && tier) query.tier = normalizeTier(tier);

    const lessons = await Lesson.find(query).sort({ createdAt: -1 });
    return res.json({ success: true, lessons });
  } catch (err) {
    console.error("GET /api/lessons error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
});

/**
 * @route   GET /api/lessons/teacher
 * @desc    Get lessons created by logged-in teacher
 * @access  Private
 */
router.get("/teacher", auth, async (req, res) => {
  try {
    if (req.user.userType !== "teacher") {
      return res.status(403).json({ success: false, msg: "Only teachers can access this" });
    }

    const lessons = await Lesson.find({ teacherId: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, lessons });
  } catch (err) {
    console.error("GET /api/lessons/teacher error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
});

/**
 * @route   GET /api/lessons/:id
 * @desc    Get single lesson (authenticated)
 * @access  Private
 */
router.get("/:id", auth, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ success: false, msg: "Lesson not found" });

    return res.json({ success: true, lesson });
  } catch (err) {
    console.error("GET /api/lessons/:id error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
});

/**
 * @route   PUT /api/lessons/:id/publish
 * @desc    Publish a lesson (Teacher owns it)
 * @access  Private
 */
router.put("/:id/publish", auth, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) return res.status(404).json({ success: false, msg: "Lesson not found" });

    if (req.user.userType !== "teacher") {
      return res.status(403).json({ success: false, msg: "Only teachers can publish lessons" });
    }
    if (lesson.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, msg: "Not authorised" });
    }

    lesson.isPublished = true;
    await lesson.save();

    return res.json({ success: true, msg: "Lesson published" });
  } catch (err) {
    console.error("PUT /api/lessons/:id/publish error:", err);
    return res.status(500).json({ success: false, msg: "Server error" });
  }
});

module.exports = router;
