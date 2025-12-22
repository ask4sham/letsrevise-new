import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { supabase } from "../lib/supabaseClient";
import { ReviewList, ReviewForm, RatingDisplay } from "../components/reviews";
import TestYourKnowledge from "../components/quizzes/TestYourKnowledge";

interface Lesson {
  id: string;

  title: string;
  description: string;
  content: string;

  subject: string;
  level: string;
  topic: string;

  // ✅ NEW
  examBoardName: string | null;

  teacherName: string;
  teacherId: string;

  estimatedDuration: number;
  shamCoinPrice: number;

  isPublished: boolean;
  views: number;

  averageRating: number;
  totalRatings: number;

  createdAt: string;
}

interface User {
  _id: string;
  userType: string;
  shamCoins: number;
  purchasedLessons: Array<{
    lessonId: string;
    purchasedAt: string;
  }>;
}

type ExamBoardRow = { name: string };

function getBoardName(
  exam_board: ExamBoardRow[] | ExamBoardRow | null | undefined
): string | null {
  if (Array.isArray(exam_board)) return exam_board[0]?.name ?? null;
  if (exam_board && typeof exam_board === "object" && "name" in exam_board) {
    return (exam_board as ExamBoardRow).name ?? null;
  }
  return null;
}

// ✅ Mongo ObjectId is 24 hex chars. Supabase UUID is different.
function isMongoObjectId(value: string | undefined) {
  if (!value) return false;
  return /^[a-f0-9]{24}$/i.test(value);
}

function isUuid(value: string | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

const LessonViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // ✅ Only enable legacy reviews when lessonId is a Mongo ObjectId.
  const reviewsEnabled = isMongoObjectId(id);

  useEffect(() => {
    fetchLessonFromSupabase();
    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchLessonFromSupabase = async () => {
    try {
      setLoading(true);
      setError("");

      if (!id) {
        setError("Lesson id missing");
        return;
      }

      // ✅ IMPORTANT: your lessons table does NOT have `content` or `description`
      const { data, error } = await supabase
        .from("lessons")
        .select(
          `
            id,
            title,
            subject,
            level,
            stage,
            years,
            lesson_notes,
            teacher_id,
            is_published,
            created_at,
            exam_board:exam_boards(name)
          `
        )
        .eq("id", id)
        .single();

      if (error) {
        console.error("Supabase error:", error);
        setError(error.message || "Failed to load lesson");
        return;
      }

      const examBoardName = getBoardName((data as any)?.exam_board);

      const safeTitle = String((data as any)?.title ?? "Untitled Lesson");
      const safeSubject = String((data as any)?.subject ?? "Not set");
      const safeLevel = String((data as any)?.level ?? "Not set");
      const safeCreatedAt = String(
        (data as any)?.created_at ?? new Date().toISOString()
      );

      const rawNotes = String((data as any)?.lesson_notes ?? "");
      const resolvedContent = rawNotes.trim() || "No lesson content yet.";

      // ✅ Description: use a short snippet of notes (NOT the exam board)
      const resolvedDescription = rawNotes.trim()
        ? rawNotes.trim().slice(0, 220) +
          (rawNotes.trim().length > 220 ? "…" : "")
        : "—";

      const mapped: Lesson = {
        id: String((data as any).id),

        title: safeTitle,
        subject: safeSubject,
        level: safeLevel,

        topic: "Not set",

        // ✅ NEW
        examBoardName: examBoardName ?? null,

        description: resolvedDescription,
        content: resolvedContent,

        teacherName: "Teacher",
        teacherId: String((data as any)?.teacher_id ?? ""),

        estimatedDuration: 0,
        shamCoinPrice: 0,

        isPublished: Boolean((data as any)?.is_published),
        views: 0,

        averageRating: 0,
        totalRatings: 0,

        createdAt: safeCreatedAt,
      };

      setLesson(mapped);
    } catch (err: any) {
      console.error("Error fetching lesson:", err);
      setError("Failed to load lesson");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = () => {
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch (err) {
        console.error("Error parsing user data:", err);
      }
    }
  };

  const hasPurchasedLesson = () => {
    if (!user || !lesson) return false;
    if (user.userType !== "student") return false;
    return user.purchasedLessons?.some(
      (purchase) => String(purchase.lessonId) === String(lesson.id)
    );
  };

  const handleReviewSubmitted = () => {
    setReviewSubmitted(true);
    setShowReviewForm(false);
    fetchLessonFromSupabase();
  };

  const handlePurchase = async () => {
    if (!user || !lesson) return;

    // ✅ Supabase UUID lessons: route to subscription for now (until we wire purchases)
    if (isUuid(lesson.id)) {
      navigate("/subscription");
      return;
    }

    // Legacy Mongo purchase route (kept)
    if (user.userType !== "student") {
      alert("Only students can purchase lessons");
      return;
    }

    if (hasPurchasedLesson()) {
      alert("You have already purchased this lesson!");
      return;
    }

    if (user.shamCoins < lesson.shamCoinPrice) {
      alert(
        `You need ${lesson.shamCoinPrice} ShamCoins to purchase this lesson. You have ${user.shamCoins} ShamCoins.`
      );
      return;
    }

    if (
      !window.confirm(
        `Purchase "${lesson.title}" for ${lesson.shamCoinPrice} ShamCoins?`
      )
    )
      return;

    try {
      const token = localStorage.getItem("token");

      const response = await axios.post(
        `http://localhost:5000/api/lessons/${lesson.id}/purchase`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success === false)
        throw new Error(response.data.error || "Purchase failed");

      const updatedUser = response.data.user || {
        ...user,
        shamCoins: response.data.remainingShamCoins,
        purchasedLessons:
          response.data.purchasedLessons || user.purchasedLessons,
      };

      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);

      alert(
        `✅ Purchase successful! You now have ${updatedUser.shamCoins} ShamCoins remaining.`
      );
      fetchLessonFromSupabase();
    } catch (error: any) {
      console.error("Purchase failed:", error);
      if (error.response?.data?.msg) alert(`❌ ${error.response.data.msg}`);
      else if (error.response?.data?.error)
        alert(`❌ ${error.response.data.error}`);
      else if (error.message) alert(`❌ ${error.message}`);
      else alert("❌ Purchase failed. Please try again.");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h2>Loading Lesson...</h2>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h2>{error || "Lesson not found"}</h2>
        <Link
          to="/dashboard"
          style={{ color: "#667eea", textDecoration: "none" }}
        >
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}>
      <Link
        to="/dashboard"
        style={{ color: "#667eea", textDecoration: "none" }}
      >
        ← Back to Dashboard
      </Link>

      <div
        style={{
          marginTop: "30px",
          background: "white",
          padding: "30px",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "20px",
          }}
        >
          <div>
            <h1 style={{ marginBottom: "10px", color: "#333" }}>
              {lesson.title}
            </h1>
            <p style={{ color: "#666" }}>By {lesson.teacherName}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span
              style={{
                padding: "6px 16px",
                borderRadius: "20px",
                background: lesson.isPublished ? "#d4edda" : "#fff3cd",
                color: lesson.isPublished ? "#155724" : "#856404",
                fontWeight: "bold",
                fontSize: "0.9rem",
              }}
            >
              {lesson.isPublished ? "Published" : "Draft"}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "20px",
              color: "#666",
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong>Subject:</strong> {lesson.subject}
            </div>
            <div>
              <strong>Level:</strong> {lesson.level}
            </div>

            {/* ✅ NEW: Exam board shown clearly */}
            <div>
              <strong>Exam board:</strong> {lesson.examBoardName ?? "Not set"}
            </div>

            <div>
              <strong>Topic:</strong> {lesson.topic}
            </div>
            <div>
              <strong>Duration:</strong> {lesson.estimatedDuration} min
            </div>
            <div>
              <strong>Price:</strong> {lesson.shamCoinPrice} ShamCoins
            </div>
          </div>

          <div>
            <RatingDisplay
              rating={lesson.averageRating}
              totalRatings={lesson.totalRatings}
              size="md"
              showCount={true}
            />
          </div>
        </div>

        {/* Purchase CTA (safe) */}
        {user?.userType === "student" &&
          !hasPurchasedLesson() &&
          lesson.shamCoinPrice > 0 && (
            <div
              style={{
                backgroundColor: "#fff3cd",
                color: "#856404",
                padding: "1rem",
                borderRadius: "0.375rem",
                marginBottom: "1.5rem",
                border: "1px solid #ffeaa7",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0 }}>
                Purchase this lesson to unlock full access.
              </p>
              <button
                onClick={handlePurchase}
                style={{
                  marginTop: "0.75rem",
                  padding: "0.5rem 1.5rem",
                  background: "#ed8936",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Get Access / Purchase
              </button>
            </div>
          )}

        <div style={{ marginBottom: "30px" }}>
          <h3 style={{ color: "#333", marginBottom: "10px" }}>Description</h3>
          <p style={{ color: "#666", lineHeight: "1.6" }}>
            {lesson.description || "—"}
          </p>
        </div>

        <div style={{ marginBottom: "30px" }}>
          <h3 style={{ color: "#333", marginBottom: "10px" }}>Lesson Content</h3>
          <div
            style={{
              background: "#f8f9fa",
              padding: "20px",
              borderRadius: "8px",
              lineHeight: "1.6",
              minHeight: "200px",
            }}
          >
            <ReactMarkdown
              components={{
                img: ({ ...props }) => (
                  <img
                    {...props}
                    style={{
                      maxWidth: "100%",
                      height: "auto",
                      borderRadius: 10,
                      display: "block",
                      margin: "12px auto",
                      background: "white",
                    }}
                    alt={props.alt || "Lesson image"}
                  />
                ),
                a: ({ ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer">
                    {props.children}
                  </a>
                ),
              }}
            >
              {lesson.content || ""}
            </ReactMarkdown>
          </div>
        </div>

        {/* ✅ NEW: Test your knowledge block */}
        <TestYourKnowledge lesson={lesson} />

        {/* ✅ Reviews block: only render legacy Reviews for Mongo ObjectId lessons */}
        <div
          style={{
            marginTop: "40px",
            paddingTop: "30px",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <h2 style={{ color: "#333", fontSize: "1.5rem" }}>
              Student Reviews
            </h2>

            {reviewsEnabled ? (
              <button
                onClick={() => setShowReviewForm(true)}
                style={{
                  padding: "10px 20px",
                  background: "#48bb78",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                ✏️ TEST: Write a Review
              </button>
            ) : null}
          </div>

          {!reviewsEnabled && (
            <div
              style={{
                padding: "14px",
                borderRadius: "10px",
                background: "#f7f7ff",
                color: "rgba(0,0,0,0.75)",
                border: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              Reviews are coming soon for these lessons.
            </div>
          )}

          {reviewsEnabled && showReviewForm && (
            <div style={{ marginBottom: "30px" }}>
              <ReviewForm
                lessonId={lesson.id}
                onReviewSubmitted={handleReviewSubmitted}
              />
              <div style={{ textAlign: "right", marginTop: "10px" }}>
                <button
                  onClick={() => setShowReviewForm(false)}
                  style={{
                    padding: "8px 16px",
                    background: "#e2e8f0",
                    color: "#4a5568",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {reviewsEnabled && reviewSubmitted && (
            <div
              style={{
                backgroundColor: "#d4edda",
                color: "#155724",
                padding: "1rem",
                borderRadius: "0.375rem",
                marginBottom: "1.5rem",
                border: "1px solid #c3e6cb",
              }}
            >
              ✅ Thank you for your review!
            </div>
          )}

          {reviewsEnabled ? <ReviewList lessonId={lesson.id} /> : null}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "20px",
            marginTop: "30px",
            borderTop: "1px solid #e2e8f0",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ color: "#666", fontSize: "0.9rem" }}>
            Created: {new Date(lesson.createdAt).toLocaleDateString()} • Views:{" "}
            {lesson.views} •{" "}
            {lesson.totalRatings > 0 ? (
              <span>
                Rating: {lesson.averageRating.toFixed(1)}/5 (
                {lesson.totalRatings} reviews)
              </span>
            ) : (
              <span>No reviews yet</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonViewPage;
