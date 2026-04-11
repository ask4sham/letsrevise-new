// backend/routes/reviews.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { canAccessContent } = require("../middleware");
const Lesson = require("../models/Lesson");
const LessonReview = require("../models/LessonReview");

const mongoose = require("mongoose");
const { createClient } = require("@supabase/supabase-js");
const { sendInternalError } = require("../utils/safeErrorResponse");

/* =========================================================
   1) Mongo Review model (for Mongo lessonId = ObjectId)
   - This fixes your current 404 "Lesson not found"
     because your lessons are Mongo ObjectIds, NOT UUIDs.
========================================================= */

const ReviewSchema = new mongoose.Schema(
  {
    lessonId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    studentName: { type: String, default: "Student" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, default: "" },
    helpful_count: { type: Number, default: 0 },
    reported: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ReviewSchema.index({ lessonId: 1, studentId: 1 }, { unique: true });

const Review = mongoose.models.Review || mongoose.model("Review", ReviewSchema);

function isValidRating(rating) {
  const n = Number(rating);
  return Number.isFinite(n) && n >= 1 && n <= 5;
}

function isMongoObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(id).length === 24;
}

function isAdmin(user) {
  const t = (user?.userType || user?.role || "").toString().toLowerCase();
  return t === "admin";
}
function isReviewer(user) {
  const t = (user?.userType || user?.role || "").toString().toLowerCase();
  return t === "reviewer";
}
function canReviewLesson(user) {
  return isAdmin(user) || isReviewer(user);
}

/* =========================================================
   2) Supabase client (kept for compatibility)
   - If lessonId is UUID style, we keep the old behaviour.
========================================================= */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "⚠️ Supabase env vars missing. (Only needed if you still use UUID lessons in Supabase)"
  );
}

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

const TABLE_LESSONS = "lessons";
const TABLE_REVIEWS = "reviews";
const TABLE_PURCHASES = "purchases";

async function hasPurchasedLessonSupabase(studentId, lessonId) {
  const { data, error } = await supabase
    .from(TABLE_PURCHASES)
    .select("id")
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId)
    .limit(1);

  if (error) {
    throw new Error(
      `Purchase check failed. Ensure Supabase table "${TABLE_PURCHASES}" exists with columns student_id + lesson_id. (${error.message})`
    );
  }

  return Array.isArray(data) && data.length > 0;
}

async function updateLessonRatingsSupabase(lessonId) {
  if (!supabase) return { averageRating: 0, totalRatings: 0 };
  const { data: reviews, error: reviewsError } = await supabase
    .from(TABLE_REVIEWS)
    .select("rating")
    .eq("lesson_id", lessonId);

  if (reviewsError) throw new Error(`Failed to fetch reviews: ${reviewsError.message}`);

  const totalRatings = reviews?.length || 0;
  const averageRating =
    totalRatings > 0
      ? reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / totalRatings
      : 0;

  const { error: lessonUpdateError } = await supabase
    .from(TABLE_LESSONS)
    .update({ averageRating, totalRatings })
    .eq("id", lessonId);

  if (lessonUpdateError) {
    throw new Error(`Failed to update lesson ratings: ${lessonUpdateError.message}`);
  }

  return { averageRating, totalRatings };
}

/* =========================================================
   Phase 9D: Approve / Reject lesson (admin/reviewer only)
   POST /api/reviews/lesson/:lessonId/approve | /reject
========================================================= */
router.post("/lesson/:lessonId/approve", auth, async (req, res) => {
  try {
    const lessonId = req.params.lessonId;
    if (!isMongoObjectId(lessonId)) {
      return res.status(400).json({ error: "Invalid lesson id" });
    }
    if (!canReviewLesson(req.user)) {
      return res.status(403).json({ error: "Only admin or reviewer can approve lessons" });
    }
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });
    const status = String(lesson.status || "").toLowerCase();
    if (status !== "in_review") {
      return res.status(409).json({
        success: false,
        code: "INVALID_STATE",
        error: "Only lessons in review can be approved",
      });
    }
    const updatedReview = await LessonReview.findOneAndUpdate(
      { lessonId: lesson._id, status: "PENDING" },
      {
        $set: {
          status: "APPROVED",
          reviewedBy: req.user._id,
          notes: (req.body?.notes || "").toString(),
        },
      },
      { sort: { createdAt: -1 }, new: true }
    );
    if (!updatedReview) {
      return res.status(409).json({
        success: false,
        code: "NO_PENDING_REVIEW",
        error: "No pending review found for this lesson",
      });
    }
    lesson.status = "published";
    lesson.isPublished = true;
    await lesson.save({ runValidators: true });
    return res.json({
      success: true,
      msg: "Lesson approved and published",
      lesson: { id: lesson._id, status: lesson.status },
    });
  } catch (err) {
    return sendInternalError("reviews/approve", err, res);
  }
});

router.post("/lesson/:lessonId/reject", auth, async (req, res) => {
  try {
    const lessonId = req.params.lessonId;
    if (!isMongoObjectId(lessonId)) {
      return res.status(400).json({ error: "Invalid lesson id" });
    }
    if (!canReviewLesson(req.user)) {
      return res.status(403).json({ error: "Only admin or reviewer can reject lessons" });
    }
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });
    const status = String(lesson.status || "").toLowerCase();
    if (status !== "in_review") {
      return res.status(409).json({
        success: false,
        code: "INVALID_STATE",
        error: "Only lessons in review can be rejected",
      });
    }
    const updatedReview = await LessonReview.findOneAndUpdate(
      { lessonId: lesson._id, status: "PENDING" },
      {
        $set: {
          status: "REJECTED",
          reviewedBy: req.user._id,
          notes: (req.body?.notes || "").toString(),
        },
      },
      { sort: { createdAt: -1 }, new: true }
    );
    if (!updatedReview) {
      return res.status(409).json({
        success: false,
        code: "NO_PENDING_REVIEW",
        error: "No pending review found for this lesson",
      });
    }
    lesson.status = "draft";
    lesson.isPublished = false;
    await lesson.save({ runValidators: true });
    return res.json({
      success: true,
      msg: "Lesson rejected and reverted to draft",
      lesson: { id: lesson._id, status: lesson.status },
    });
  } catch (err) {
    return sendInternalError("reviews/reject", err, res);
  }
});

/* =========================================================
   GET /api/reviews/lesson/:lessonId
   Gated: auth + canAccessContent (only entitled users see reviews for a lesson).
========================================================= */
router.get("/lesson/:lessonId", auth, canAccessContent({ requirePublished: true }), async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = "newest" } = req.query;
    const lessonId = req.params.lessonId;

    // ---------- Mongo path (your current system) ----------
    if (isMongoObjectId(lessonId)) {
      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.max(1, parseInt(limit, 10));

      let sortObj = { createdAt: -1 };
      const s = String(sort);
      if (s === "oldest") sortObj = { createdAt: 1 };
      if (s === "highest") sortObj = { rating: -1, createdAt: -1 };
      if (s === "lowest") sortObj = { rating: 1, createdAt: -1 };
      if (s === "helpful") sortObj = { helpful_count: -1, createdAt: -1 };

      const query = {
        lessonId: new mongoose.Types.ObjectId(lessonId),
        reported: false,
      };

      const totalReviews = await Review.countDocuments(query);
      const totalPages = Math.max(1, Math.ceil(totalReviews / limitNum));

      const docs = await Review.find(query)
        .sort(sortObj)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean();

      // Shape matches your frontend mapping
      const reviews = docs.map((r) => ({
        id: String(r._id),
        rating: Number(r.rating || 0),
        comment: r.review || "",
        user_id: String(r.studentId || ""),
        created_at: r.createdAt,
      }));

      return res.json({
        reviews,
        totalReviews,
        totalPages,
        currentPage: pageNum,
      });
    }

    // ---------- Supabase fallback (legacy UUID lessons) ----------
    // If supabase isn't configured, return empty (don't 500).
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.json({
        reviews: [],
        totalReviews: 0,
        totalPages: 1,
        currentPage: 1,
      });
    }

    const { data: lesson, error: lessonError } = await supabase
      .from(TABLE_LESSONS)
      .select("id")
      .eq("id", lessonId)
      .single();

    if (lessonError || !lesson) {
      // IMPORTANT: do NOT 404 in mixed systems; just return empty.
      return res.json({
        reviews: [],
        totalReviews: 0,
        totalPages: 1,
        currentPage: parseInt(page, 10) || 1,
      });
    }

    let orderColumn = "created_at";
    let ascending = false;

    switch (String(sort)) {
      case "oldest":
        orderColumn = "created_at";
        ascending = true;
        break;
      case "highest":
        orderColumn = "rating";
        ascending = false;
        break;
      case "lowest":
        orderColumn = "rating";
        ascending = true;
        break;
      case "helpful":
        orderColumn = "helpful_count";
        ascending = false;
        break;
      default:
        orderColumn = "created_at";
        ascending = false;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    const { data: reviews, error: reviewsError } = await supabase
      .from(TABLE_REVIEWS)
      .select("*")
      .eq("lesson_id", lessonId)
      .eq("reported", false)
      .order(orderColumn, { ascending })
      .range(from, to);

    if (reviewsError) {
      return res.json({
        reviews: [],
        totalReviews: 0,
        totalPages: 1,
        currentPage: pageNum,
      });
    }

    const { count, error: countError } = await supabase
      .from(TABLE_REVIEWS)
      .select("*", { count: "exact", head: true })
      .eq("lesson_id", lessonId)
      .eq("reported", false);

    if (countError) {
      return res.json({
        reviews: reviews || [],
        totalReviews: (reviews || []).length,
        totalPages: 1,
        currentPage: pageNum,
      });
    }

    const totalReviews = count || 0;

    return res.json({
      reviews: reviews || [],
      totalReviews,
      totalPages: Math.max(1, Math.ceil(totalReviews / limitNum)),
      currentPage: pageNum,
    });
  } catch (err) {
    return sendInternalError("reviews/lesson-list", err, res);
  }
});

/* =========================================================
   POST /api/reviews/:lessonId — submit review (Supabase + Mongo)
   Gated: auth + canAccessContent (entitled users only).
========================================================= */
router.post("/:lessonId", auth, canAccessContent({ requirePublished: true }), async (req, res) => {
  try {
    const { rating, review } = req.body || {};
    const lessonId = req.params.lessonId;

    if (!isValidRating(rating)) {
      return res.status(400).json({ msg: "Please provide a valid rating (1-5)" });
    }

    // Mongo path
    if (isMongoObjectId(lessonId)) {
      const studentId = req.user?._id;
      const studentName =
        req.user?.firstName && req.user?.lastName
          ? `${req.user.firstName} ${req.user.lastName}`
          : req.user?.email || "Student";

      const doc = await Review.create({
        lessonId: new mongoose.Types.ObjectId(lessonId),
        studentId: new mongoose.Types.ObjectId(studentId),
        studentName,
        rating: Number(rating),
        review: String(review || ""),
      });

      return res.json({
        msg: "Review submitted successfully",
        review: {
          id: String(doc._id),
          rating: doc.rating,
          comment: doc.review,
          user_id: String(doc.studentId),
          created_at: doc.createdAt,
        },
      });
    }

    // Supabase fallback
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(400).json({ msg: "Supabase not configured for UUID reviews" });
    }

    const studentId = req.user.id;

    const { data: lesson, error: lessonError } = await supabase
      .from(TABLE_LESSONS)
      .select("id,title,teacherId")
      .eq("id", lessonId)
      .single();

    if (lessonError) {
      console.error("[reviews] supabase lesson lookup:", lessonError.message);
      return res.status(404).json({ msg: "Lesson not found" });
    }

    const purchased = await hasPurchasedLessonSupabase(studentId, lessonId);
    if (!purchased) {
      return res.status(403).json({ msg: "You must purchase the lesson before reviewing it" });
    }

    const { data: existing, error: existingError } = await supabase
      .from(TABLE_REVIEWS)
      .select("id")
      .eq("lesson_id", lessonId)
      .eq("student_id", studentId)
      .limit(1);

    if (existingError) {
      console.error("[reviews] supabase existing review check:", existingError.message);
      return sendInternalError("reviews/supabase-existing", existingError, res);
    }

    if (existing && existing.length > 0) {
      return res.status(400).json({ msg: "You have already reviewed this lesson" });
    }

    const studentName =
      req.user.firstName && req.user.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user.email || "Student";

    const { data: inserted, error: insertError } = await supabase
      .from(TABLE_REVIEWS)
      .insert([
        {
          lesson_id: lessonId,
          teacher_id: lesson.teacherId || null,
          student_id: studentId,
          student_name: studentName,
          rating: Number(rating),
          review: review || "",
          helpful_count: 0,
          reported: false,
        },
      ])
      .select("*")
      .single();

    if (insertError) {
      console.error("[reviews] supabase insert:", insertError.message);
      return sendInternalError("reviews/supabase-insert", insertError, res);
    }

    const aggregates = await updateLessonRatingsSupabase(lessonId);

    return res.json({
      msg: "Review submitted successfully",
      review: inserted,
      aggregates,
    });
  } catch (err) {
    // Mongo duplicate (same student already reviewed)
    if (err && err.code === 11000) {
      return res.status(400).json({ msg: "You have already reviewed this lesson" });
    }
    return sendInternalError("reviews/submit", err, res);
  }
});

module.exports = router;
