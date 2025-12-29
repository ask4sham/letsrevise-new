// backend/routes/lessons.js

const express = require("express");
const router = express.Router();

const Lesson = require("../models/Lesson");
const User = require("../models/User");
const Purchase = require("../models/Purchase");
const auth = require("../middleware/auth");

console.log("? lessons router file loaded");

/* =========================================
   GCSE TIER HELPERS
   ========================================= */

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
  if (!level) return undefined;
  if (String(level).toUpperCase() !== "GCSE") return undefined;
  return normalizeTier(tier);
}

/* =========================================
   CREATE LESSON HANDLER (teachers only)
   ========================================= */

async function createLessonHandler(req, res) {
  try {
    console.log("?? [Lessons] POST /api/lessons hit");

    if (!req.user) {
      console.error("? [Lessons] No req.user on request");
      return res.status(401).json({ msg: "No user on request" });
    }

    console.log("? [Lessons] Authenticated user:", {
      id: req.user._id || req.user.id,
      email: req.user.email,
      userType: req.user.userType,
    });

    if (req.user.userType !== "teacher") {
      return res
        .status(403)
        .json({ msg: "Only teachers can create lessons" });
    }

    const {
      title,
      description,
      content,
      subject,
      level,
      topic,
      tags,
      estimatedDuration,
      shamCoinPrice,
      resources,
      // new-ish fields coming from the React form:
      board,
      tier,
      externalResources,
      uploadedImages,
    } = req.body || {};

    // ---- Validation ----
    const missing = {};
    if (!title) missing.title = true;
    if (!description) missing.description = true;
    if (!content) missing.content = true;
    if (!subject) missing.subject = true;
    if (!level) missing.level = true;
    if (!topic) missing.topic = true;
    if (estimatedDuration === undefined || estimatedDuration === null) {
      missing.estimatedDuration = true;
    }

    if (Object.keys(missing).length > 0) {
      console.log("? [Lessons] Validation failed, missing:", missing);
      return res.status(400).json({
        msg: "Please fill in all required fields",
        missing,
      });
    }

    // Normalise tags
    const tagsArray =
      typeof tags === "string"
        ? tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : Array.isArray(tags)
        ? tags
        : [];

    // Normalise resources
    const resourcesArray = Array.isArray(resources)
      ? resources
      : typeof externalResources === "string"
      ? externalResources
          .split(",")
          .map((u) => u.trim())
          .filter(Boolean)
      : [];

    const lessonData = {
      title,
      description,
      content,
      teacherId: req.user._id,
      teacherName:
        `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() ||
        req.user.email,
      subject,
      level,
      topic,
      tags: tagsArray,
      estimatedDuration,
      shamCoinPrice: shamCoinPrice || 0,
      resources: resourcesArray,
      isPublished: false,
    };

    // Optional extras – only set if present so we don't break older schemas
    if (board) lessonData.board = board;

    const normalisedTier = sanitizeTierByLevel(level, tier);
    if (normalisedTier) {
      lessonData.tier = normalisedTier;
    }

    if (Array.isArray(uploadedImages) && uploadedImages.length > 0) {
      lessonData.uploadedImages = uploadedImages;
    }

    console.log("?? [Lessons] Saving lesson with payload:", lessonData);

    const lesson = new Lesson(lessonData);
    await lesson.save();
    console.log("? [Lessons] Lesson saved:", lesson._id);

    // Award ShamCoins to the teacher
    let updatedShamCoins = 0;
    try {
      const dbUser = await User.findById(req.user._id);
      if (dbUser) {
        dbUser.shamCoins = (dbUser.shamCoins || 0) + 50;
        await dbUser.save();
        updatedShamCoins = dbUser.shamCoins;
        console.log(
          "? [Lessons] Awarded 50 ShamCoins to teacher:",
          dbUser.email,
          "New balance:",
          updatedShamCoins
        );
      } else {
        console.warn(
          "?? [Lessons] Could not find teacher in DB to award ShamCoins:",
          req.user._id
        );
      }
    } catch (coinErr) {
      console.error("?? [Lessons] Failed to award ShamCoins:", coinErr);
      // Don't fail the request just because coins update failed
    }

    return res.json({
      success: true,
      msg: "Lesson created successfully! You earned 50 ShamCoins!",
      lesson,
      updatedShamCoins,
    });
  } catch (err) {
    console.error("? [Lessons] Lesson creation error details:");
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    console.error("Full error object:", err);

    return res.status(500).json({
      success: false,
      error: "Server error",
      message: err.message,
    });
  }
}

/* =========================================
   ROUTES
   ========================================= */

// Create a lesson
router.post("/", auth, createLessonHandler);

// Get all lessons by a teacher WITH purchase stats
router.get("/teacher", auth, async (req, res) => {
  try {
    if (req.user.userType !== "teacher") {
      return res
        .status(403)
        .json({ msg: "Only teachers can view their lessons" });
    }

    const lessons = await Lesson.find({ teacherId: req.user._id }).sort({
      createdAt: -1,
    });

    const lessonsWithStats = await Promise.all(
      lessons.map(async (lesson) => {
        const lessonObj = lesson.toObject();

        const purchaseCount = await Purchase.countDocuments({
          lessonId: lesson._id,
        });
        lessonObj.purchaseCount = purchaseCount;

        const purchases = await Purchase.find({ lessonId: lesson._id });
        const totalEarnings = purchases.reduce(
          (sum, purchase) => sum + (purchase.teacherEarnings || 0),
          0
        );
        lessonObj.totalEarnings = totalEarnings;

        return lessonObj;
      })
    );

    return res.json(lessonsWithStats);
  } catch (err) {
    console.error("Error fetching teacher lessons:", err);
    return res
      .status(500)
      .json({ msg: "Server error", error: err.message });
  }
});

// Teacher dashboard stats
router.get("/teacher/stats", auth, async (req, res) => {
  try {
    if (req.user.userType !== "teacher") {
      return res.status(403).json({ msg: "Only teachers can view stats" });
    }

    const teacherId = req.user._id;
    const lessons = await Lesson.find({ teacherId });

    const stats = {
      totalLessons: lessons.length,
      publishedLessons: lessons.filter((l) => l.isPublished === true).length,
      draftLessons: lessons.filter((l) => l.isPublished === false).length,
      totalEarnings: 0,
      totalPurchases: 0,
      averageRating: 0,
      monthlyEarnings: [],
    };

    const purchases = await Purchase.find({ teacherId });

    stats.totalPurchases = purchases.length;
    stats.totalEarnings = purchases.reduce(
      (sum, purchase) => sum + (purchase.teacherEarnings || 0),
      0
    );

    const publishedLessons = lessons.filter((l) => l.isPublished === true);
    if (publishedLessons.length > 0) {
      const totalRating = publishedLessons.reduce(
        (sum, lesson) => sum + (lesson.averageRating || 0),
        0
      );
      stats.averageRating = totalRating / publishedLessons.length;
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentPurchases = purchases.filter(
      (p) => p.timestamp >= sixMonthsAgo
    );

    const monthlyData = {};
    recentPurchases.forEach((purchase) => {
      const month = purchase.timestamp.toISOString().slice(0, 7); // YYYY-MM
      monthlyData[month] =
        (monthlyData[month] || 0) + (purchase.teacherEarnings || 0);
    });

    stats.monthlyEarnings = Object.entries(monthlyData)
      .map(([month, earnings]) => ({
        month: new Date(month + "-01").toLocaleString("default", {
          month: "short",
        }),
        earnings,
      }))
      .sort((a, b) => {
        const dateA = new Date(a.month + " 1");
        const dateB = new Date(b.month + " 1");
        return dateA - dateB;
      });

    return res.json(stats);
  } catch (err) {
    console.error("Error fetching teacher stats:", err);
    return res
      .status(500)
      .json({ msg: "Server error", error: err.message });
  }
});

// Get lesson by ID (private)
router.get("/:id", auth, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) {
      return res.status(404).json({ msg: "Lesson not found" });
    }

    // Increment views
    lesson.views += 1;
    await lesson.save();

    return res.json(lesson);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Lesson not found" });
    }
    return res.status(500).send("Server error");
  }
});

// Update lesson (teacher only)
router.put("/:id", auth, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) {
      return res.status(404).json({ msg: "Lesson not found" });
    }

    if (lesson.teacherId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ msg: "User not authorized" });
    }

    const updates = req.body || {};

    Object.keys(updates).forEach((key) => {
      // Prevent arbitrary publish toggling here – use the publish endpoint instead
      if (key === "isPublished") return;
      lesson[key] = updates[key];
    });

    const newLevel =
      typeof updates.level === "string" ? updates.level : lesson.level;
    const requestedTier = Object.prototype.hasOwnProperty.call(updates, "tier")
      ? updates.tier
      : lesson.tier;

    lesson.tier = sanitizeTierByLevel(newLevel, requestedTier);

    await lesson.save();
    return res.json({ msg: "Lesson updated successfully", lesson });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

// Delete lesson (teacher only)
router.delete("/:id", auth, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) {
      return res.status(404).json({ msg: "Lesson not found" });
    }

    if (lesson.teacherId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ msg: "User not authorized" });
    }

    await lesson.deleteOne();
    return res.json({ msg: "Lesson removed" });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

// Publish lesson (teacher only)
router.put("/:id/publish", auth, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) {
      return res.status(404).json({ msg: "Lesson not found" });
    }

    if (lesson.teacherId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ msg: "User not authorized" });
    }

    lesson.isPublished = true;
    await lesson.save();

    return res.json({ msg: "Lesson published successfully", lesson });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

// Purchase lesson (students only)
router.post("/:id/purchase", auth, async (req, res) => {
  try {
    console.log("Purchase attempt for lesson:", req.params.id);
    console.log("User attempting purchase:", req.user.email);

    if (req.user.userType !== "student") {
      return res.status(403).json({ msg: "Only students can purchase lessons" });
    }

    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) {
      return res.status(404).json({ msg: "Lesson not found" });
    }

    if (!lesson.isPublished) {
      return res.status(400).json({ msg: "Lesson is not published" });
    }

    console.log("Fetching user with ID:", req.user._id);
    console.log("req.user object:", req.user);
    const user = await User.findById(req.user._id);

    if (!user) {
      console.error("ERROR: User not found with ID:", req.user._id);
      return res.status(500).json({
        success: false,
        error: "User not found in database",
      });
    }

    const alreadyPurchased = user.purchasedLessons?.some(
      (purchase) => purchase.lessonId.toString() === lesson._id.toString()
    );

    if (alreadyPurchased) {
      return res.status(400).json({
        msg: "You have already purchased this lesson",
        purchasedAt: user.purchasedLessons.find(
          (p) => p.lessonId.toString() === lesson._id.toString()
        ).purchasedAt,
      });
    }

    const studentShamCoins = user.shamCoins || 0;
    if (studentShamCoins < lesson.shamCoinPrice) {
      return res.status(400).json({
        msg: "Insufficient ShamCoins",
        required: lesson.shamCoinPrice,
        available: studentShamCoins,
      });
    }

    user.shamCoins -= lesson.shamCoinPrice;

    const purchaseRecord = {
      lessonId: lesson._id,
      price: lesson.shamCoinPrice,
      purchasedAt: new Date(),
    };

    user.purchasedLessons = user.purchasedLessons || [];
    user.purchasedLessons.push(purchaseRecord);

    const teacherEarnings = Math.floor(lesson.shamCoinPrice * 0.7);

    const teacher = await User.findById(lesson.teacherId);
    if (teacher) {
      teacher.shamCoins = (teacher.shamCoins || 0) + teacherEarnings;
      teacher.earnings = (teacher.earnings || 0) + teacherEarnings;

      teacher.transactions = teacher.transactions || [];
      teacher.transactions.push({
        type: "sale",
        amount: teacherEarnings,
        date: new Date(),
        description: `Lesson sale: ${lesson.title}`,
        lessonId: lesson._id,
        status: "completed",
      });

      await teacher.save();
      console.log(
        `Awarded ${teacherEarnings} ShamCoins and earnings to teacher ${teacher.email}`
      );

      const { createNotification } = require("./notifications");
      await createNotification(
        teacher._id,
        "purchase_success",
        "Lesson Sold!",
        `A student purchased your lesson "${lesson.title}" for ${lesson.shamCoinPrice} ShamCoins`,
        {
          lessonId: lesson._id,
          price: lesson.shamCoinPrice,
          earnings: teacherEarnings,
        },
        `/lesson/${lesson._id}`
      );
    }

    const purchase = new Purchase({
      lessonId: lesson._id,
      studentId: user._id,
      teacherId: lesson.teacherId,
      price: lesson.shamCoinPrice,
      teacherEarnings: teacherEarnings,
      timestamp: new Date(),
    });

    await purchase.save();
    await user.save();

    return res.json({
      success: true,
      msg: "Lesson purchased successfully!",
      lesson: {
        id: lesson._id,
        title: lesson.title,
        price: lesson.shamCoinPrice,
      },
      user: {
        _id: user._id,
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        shamCoins: user.shamCoins,
        purchasedLessons: user.purchasedLessons,
      },
      remainingShamCoins: user.shamCoins,
      teacherEarned: teacherEarnings,
      purchaseRecord: purchaseRecord,
    });
  } catch (err) {
    console.error("Purchase error:", err);
    return res.status(500).json({
      success: false,
      error: "Server error",
      details: err.message,
    });
  }
});

// Get all published lessons (students)
router.get("/", auth, async (req, res) => {
  try {
    const { subject, level, topic, teacher, tier } = req.query;
    const query = { isPublished: true };

    if (subject) query.subject = subject;
    if (level) query.level = level;
    if (topic) {
      query.topic = {
        $regex: topic,
        $options: "i",
      };
    }
    if (teacher) {
      query.teacherName = {
        $regex: teacher,
        $options: "i",
      };
    }

    // GCSE-only tier filter
    if (tier && level && String(level).toUpperCase() === "GCSE") {
      const normalisedTier = normalizeTier(tier);
      if (normalisedTier) {
        query.tier = normalisedTier;
      }
    }

    const lessons = await Lesson.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json(lessons);
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

module.exports = router;
module.exports.createLessonHandler = createLessonHandler;
