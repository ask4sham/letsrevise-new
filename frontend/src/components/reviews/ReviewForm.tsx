// src/components/reviews/ReviewForm.tsx
import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Card } from "../ui";

interface ReviewFormProps {
  lessonId: string;
  onReviewSubmitted: () => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ lessonId, onReviewSubmitted }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const getLocalUserId = (): string | null => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return null;
      const u = JSON.parse(userStr);
      // prefer email if present; fallback to _id
      return u?.email || u?._id || null;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      setError("Please select a rating");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const user_id = getLocalUserId();

      const { error: sbError } = await supabase.from("lesson_reviews").insert([
        {
          lesson_id: lessonId,
          rating,
          comment: review.trim() || null,
          user_id,
        },
      ]);

      if (sbError) {
        console.error("Supabase insert error:", sbError);
        setError(sbError.message || "Failed to submit review");
        return;
      }

      setRating(0);
      setReview("");
      setHoverRating(0);

      onReviewSubmitted();
      alert("Thank you for your review!");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  const getStarColor = (star: number) => {
    const displayRating = hoverRating || rating;

    if (star <= displayRating) {
      if (displayRating >= 4) return "#ffc107";
      if (displayRating >= 3) return "#f59e0b";
      return "#fbbf24";
    }
    return "#e5e7eb";
  };

  const getStarGlow = (star: number) => {
    const displayRating = hoverRating || rating;
    if (star <= displayRating) return `0 0 15px ${getStarColor(star)}`;
    return "none";
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <Card padding="lg">
        <h3
          style={{
            marginBottom: "1.5rem",
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "#1f2937",
            textAlign: "center",
          }}
        >
          ⭐ Write a Review
        </h3>

        {error && (
          <div
            style={{
              backgroundColor: "#fed7d7",
              color: "#742a2a",
              padding: "0.75rem",
              borderRadius: "0.5rem",
              marginBottom: "1.5rem",
              border: "1px solid #fc8181",
              fontWeight: 500,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div
            style={{
              marginBottom: "2rem",
              backgroundColor: "#f8fafc",
              padding: "1.5rem",
              borderRadius: "0.75rem",
              border: "1px solid #e2e8f0",
            }}
          >
            <label
              style={{
                display: "block",
                marginBottom: "1rem",
                fontWeight: 600,
                fontSize: "1.1rem",
                color: "#374151",
              }}
            >
              Your Rating *
            </label>

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1rem",
              }}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{
                    fontSize: "3.5rem",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: getStarColor(star),
                    padding: "0.5rem",
                    lineHeight: 1,
                    transition: "all 0.2s ease",
                    transform: hoverRating >= star ? "scale(1.2)" : "scale(1)",
                    textShadow: getStarGlow(star),
                    filter: hoverRating >= star ? "brightness(1.2)" : "brightness(1)",
                  }}
                >
                  ★
                </button>
              ))}
            </div>

            <div style={{ textAlign: "center", marginTop: "1rem" }}>
              <div
                style={{
                  fontSize: "1.25rem",
                  color: rating > 0 ? "#059669" : "#6b7280",
                  fontWeight: 600,
                  marginBottom: "0.25rem",
                }}
              >
                {rating === 0 ? "Click stars to rate" : `${rating} out of 5 stars`}
              </div>
              <div
                style={{
                  fontSize: "0.875rem",
                  color: "#9ca3af",
                  display: "flex",
                  justifyContent: "center",
                  gap: "1rem",
                }}
              >
                <span>⭐ Poor</span>
                <span>⭐⭐⭐⭐⭐ Excellent</span>
              </div>
            </div>
          </div>

          <div
            style={{
              marginBottom: "2rem",
              backgroundColor: "#f8fafc",
              padding: "1.5rem",
              borderRadius: "0.75rem",
              border: "1px solid #e2e8f0",
            }}
          >
            <label
              style={{
                display: "block",
                marginBottom: "0.75rem",
                fontWeight: 600,
                fontSize: "1.1rem",
                color: "#374151",
              }}
            >
              Your Review (Optional)
            </label>

            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Share your experience with this lesson... What did you like? What could be improved?"
              style={{
                width: "100%",
                minHeight: "150px",
                padding: "1rem",
                border: "2px solid #d1d5db",
                borderRadius: "0.5rem",
                fontSize: "1rem",
                resize: "vertical",
                fontFamily: "inherit",
                transition: "border-color 0.2s ease",
                backgroundColor: "white",
              }}
              maxLength={1000}
              onFocus={(e) => (e.target.style.borderColor = "#667eea")}
              onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "0.5rem",
              }}
            >
              <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                Tips: Be specific about what you liked or suggestions for improvement
              </div>
              <div
                style={{
                  fontSize: "0.875rem",
                  color: review.length === 1000 ? "#dc2626" : "#6b7280",
                  fontWeight: review.length === 1000 ? 600 : 400,
                }}
              >
                {review.length}/1000 characters
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <button
              type="submit"
              disabled={submitting || rating === 0}
              style={{
                padding: "0.875rem 2rem",
                fontSize: "1.1rem",
                fontWeight: 600,
                background:
                  rating === 0
                    ? "#9ca3af"
                    : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: rating === 0 ? "not-allowed" : "pointer",
                opacity: rating === 0 ? 0.6 : 1,
                transition: "all 0.2s ease",
              }}
            >
              {submitting ? (
                <>
                  <span style={{ marginRight: "0.5rem" }}>⏳</span>
                  Submitting...
                </>
              ) : (
                <>
                  <span style={{ marginRight: "0.5rem" }}>📝</span>
                  Submit Review
                </>
              )}
            </button>
          </div>

          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              backgroundColor: "#f0f9ff",
              borderRadius: "0.5rem",
              border: "1px solid #bae6fd",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#0369a1", textAlign: "center" }}>
              💡 Your review helps other students and helps teachers improve their lessons!
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default ReviewForm;
