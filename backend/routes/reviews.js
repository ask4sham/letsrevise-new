// backend/routes/reviews.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const mongoose = require("mongoose");
const { createClient } = require("@supabase/supabase-js");

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

const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");

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
   ✅ FIXED ENDPOINT
   GET /api/reviews/lesson/:lessonId

   - If lessonId is Mongo ObjectId: return Mongo reviews (200)
   - Otherwise: fallback to Supabase UUID logic (legacy)
========================================================= */
router.get("/lesson/:lessonId", async (req, res) => {
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
    console.error("Get reviews error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/* =========================================================
   OPTIONAL: POST review (kept as-is for Supabase + Mongo)
   - If lessonId is Mongo ObjectId: write to Mongo
   - Else: write to Supabase (legacy)
========================================================= */
router.post("/:lessonId", auth, async (req, res) => {
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
      return res.status(404).json({ msg: "Lesson not found", error: lessonError.message });
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
      return res.status(500).json({ msg: "Server error", error: existingError.message });
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
      return res.status(500).json({ msg: "Server error", error: insertError.message });
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
    console.error("Review submission error:", err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = router;
