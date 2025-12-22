const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { createClient } = require("@supabase/supabase-js");

// ---------------------------------------------
// Supabase client (service role is recommended)
// ---------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "⚠️ Supabase env vars missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env"
  );
}

const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");

// ---------------------------------------------
// Table name config (change here if needed)
// ---------------------------------------------
const TABLE_LESSONS = "lessons";
const TABLE_REVIEWS = "reviews";
const TABLE_PURCHASES = "purchases"; // if your table is named differently, change this

// ---------------------------------------------
// Helpers
// ---------------------------------------------
function isValidRating(rating) {
  const n = Number(rating);
  return Number.isFinite(n) && n >= 1 && n <= 5;
}

async function hasPurchasedLesson(studentId, lessonId) {
  // Expecting a purchases table with columns: student_id, lesson_id
  const { data, error } = await supabase
    .from(TABLE_PURCHASES)
    .select("id")
    .eq("student_id", studentId)
    .eq("lesson_id", lessonId)
    .limit(1);

  if (error) {
    // If this table doesn't exist yet, surface a clear error
    throw new Error(
      `Purchase check failed. Ensure Supabase table "${TABLE_PURCHASES}" exists with columns student_id + lesson_id. (${error.message})`
    );
  }

  return Array.isArray(data) && data.length > 0;
}

async function updateLessonRatings(lessonId) {
  // Pull all ratings for the lesson
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

  // Update the lesson aggregates
  const { error: lessonUpdateError } = await supabase
    .from(TABLE_LESSONS)
    .update({
      averageRating,
      totalRatings,
    })
    .eq("id", lessonId);

  if (lessonUpdateError) {
    throw new Error(`Failed to update lesson ratings: ${lessonUpdateError.message}`);
  }

  return { averageRating, totalRatings };
}

// -------------------------------------------------------
// @route   POST /api/reviews/:lessonId
// @desc    Add a review/rating for a lesson (Supabase)
// @access  Private (Students only who purchased the lesson)
// -------------------------------------------------------
router.post("/:lessonId", auth, async (req, res) => {
  try {
    const { rating, review } = req.body;
    const lessonId = req.params.lessonId; // UUID
    const studentId = req.user.id;

    // Validate input
    if (!isValidRating(rating)) {
      return res.status(400).json({ msg: "Please provide a valid rating (1-5)" });
    }

    // Get lesson (Supabase)
    const { data: lesson, error: lessonError } = await supabase
      .from(TABLE_LESSONS)
      .select("id,title,teacherId")
      .eq("id", lessonId)
      .single();

    if (lessonError) {
      return res.status(404).json({ msg: "Lesson not found", error: lessonError.message });
    }

    // Check purchase
    const purchased = await hasPurchasedLesson(studentId, lessonId);
    if (!purchased) {
      return res.status(403).json({ msg: "You must purchase the lesson before reviewing it" });
    }

    // Check already reviewed (one review per student per lesson)
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

    // Create review
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

    // Update lesson rating stats
    const aggregates = await updateLessonRatings(lessonId);

    // Optional notification hook (only if you already have this system)
    // Keep it safe: don't crash if notifications aren't configured.
    try {
      // If your project still uses createNotification elsewhere and it exists, you can require it:
      // const { createNotification } = require("./notifications");
      // if (lesson.teacherId) { await createNotification(...) }
    } catch (e) {
      // ignore
    }

    res.json({
      msg: "Review submitted successfully",
      review: inserted,
      aggregates,
    });
  } catch (err) {
    console.error("Review submission error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// -------------------------------------------------------
// @route   GET /api/reviews/lesson/:lessonId
// @desc    Get reviews for a lesson
// @access  Public
// -------------------------------------------------------
router.get("/lesson/:lessonId", async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = "newest" } = req.query;
    const lessonId = req.params.lessonId;

    // Verify lesson exists
    const { data: lesson, error: lessonError } = await supabase
      .from(TABLE_LESSONS)
      .select("id")
      .eq("id", lessonId)
      .single();

    if (lessonError || !lesson) {
      return res.status(404).json({ msg: "Lesson not found" });
    }

    // Build sort
    let orderColumn = "created_at";
    let ascending = false;

    switch (sort) {
      case "newest":
        orderColumn = "created_at";
        ascending = false;
        break;
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

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
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
      return res.status(500).json({ msg: "Server error", error: reviewsError.message });
    }

    const { count, error: countError } = await supabase
      .from(TABLE_REVIEWS)
      .select("*", { count: "exact", head: true })
      .eq("lesson_id", lessonId)
      .eq("reported", false);

    if (countError) {
      return res.status(500).json({ msg: "Server error", error: countError.message });
    }

    const totalReviews = count || 0;

    res.json({
      reviews: reviews || [],
      totalReviews,
      totalPages: Math.ceil(totalReviews / limitNum),
      currentPage: pageNum,
    });
  } catch (err) {
    console.error("Get reviews error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// -------------------------------------------------------
// @route   PUT /api/reviews/:reviewId/helpful
// @desc    Mark a review as helpful
// @access  Private
// -------------------------------------------------------
router.put("/:reviewId/helpful", auth, async (req, res) => {
  try {
    const reviewId = req.params.reviewId;

    // Get current helpful_count
    const { data: review, error: getError } = await supabase
      .from(TABLE_REVIEWS)
      .select("id,helpful_count")
      .eq("id", reviewId)
      .single();

    if (getError || !review) {
      return res.status(404).json({ msg: "Review not found" });
    }

    const newCount = Number(review.helpful_count || 0) + 1;

    const { error: updateError } = await supabase
      .from(TABLE_REVIEWS)
      .update({ helpful_count: newCount })
      .eq("id", reviewId);

    if (updateError) {
      return res.status(500).json({ msg: "Server error", error: updateError.message });
    }

    res.json({ msg: "Marked as helpful", helpfulCount: newCount });
  } catch (err) {
    console.error("Helpful vote error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// -------------------------------------------------------
// @route   GET /api/reviews/teacher/:teacherId
// @desc    Get latest reviews for a teacher's lessons + avg rating
// @access  Public
// -------------------------------------------------------
router.get("/teacher/:teacherId", async (req, res) => {
  try {
    const teacherId = req.params.teacherId;
    const { limit = 5 } = req.query;

    const limitNum = parseInt(limit);

    const { data: reviews, error } = await supabase
      .from(TABLE_REVIEWS)
      .select("*")
      .eq("teacher_id", teacherId)
      .eq("reported", false)
      .order("created_at", { ascending: false })
      .limit(limitNum);

    if (error) {
      return res.status(500).json({ msg: "Server error", error: error.message });
    }

    const all = reviews || [];
    const avgRating =
      all.length > 0 ? all.reduce((sum, r) => sum + Number(r.rating || 0), 0) / all.length : 0;

    res.json({
      reviews: all,
      averageRating: avgRating.toFixed(1),
      totalReviews: all.length,
    });
  } catch (err) {
    console.error("Get teacher reviews error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = router;
