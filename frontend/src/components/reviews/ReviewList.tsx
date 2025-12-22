// components/reviews/ReviewList.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Card, Button } from "../ui";

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  user_id: string | null;
  created_at: string;
};

interface ReviewListProps {
  lessonId: string;
}

const PAGE_SIZE = 5;

const ReviewList: React.FC<ReviewListProps> = ({ lessonId }) => {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [sortBy, setSortBy] = useState("newest");

  // Local-only helpful counts (demo)
  const [helpful, setHelpful] = useState<Record<string, number>>({});

  const sortSpec = useMemo(() => {
    // We only have rating + created_at right now.
    // "helpful" is local-only, so we keep newest for DB and sort on UI if needed later.
    if (sortBy === "oldest") return { col: "created_at" as const, asc: true };
    if (sortBy === "highest") return { col: "rating" as const, asc: false };
    if (sortBy === "lowest") return { col: "rating" as const, asc: true };
    // newest/default
    return { col: "created_at" as const, asc: false };
  }, [sortBy]);

  const fetchReviews = async () => {
    try {
      setLoading(true);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from("lesson_reviews")
        .select("id,rating,comment,user_id,created_at", { count: "exact" })
        .eq("lesson_id", lessonId)
        .order(sortSpec.col, { ascending: sortSpec.asc })
        .range(from, to);

      if (error) {
        console.error("Supabase review select error:", error);
        setReviews([]);
        setTotalPages(1);
        return;
      }

      const rows = (data ?? []) as ReviewRow[];
      setReviews(rows);

      const total = count ?? rows.length;
      setTotalPages(Math.max(1, Math.ceil(total / PAGE_SIZE)));
    } catch (err) {
      console.error("Error fetching reviews:", err);
      setReviews([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!lessonId) return;
    fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, page, sortBy]);

  const handleHelpful = (reviewId: string) => {
    setHelpful((prev) => ({
      ...prev,
      [reviewId]: (prev[reviewId] ?? 0) + 1,
    }));
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const displayName = (r: ReviewRow) => {
    // show something stable without breaking your UI
    if (r.user_id && typeof r.user_id === "string") return r.user_id;
    return "Student";
  };

  if (loading) return <div>Loading reviews...</div>;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h3 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
          Student Reviews ({reviews.length})
        </h3>

        <div>
          <label style={{ marginRight: "0.5rem" }}>Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => {
              setPage(1);
              setSortBy(e.target.value);
            }}
            style={{
              padding: "0.5rem",
              border: "1px solid #d1d5db",
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
            }}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest">Highest Rating</option>
            <option value="lowest">Lowest Rating</option>
            <option value="helpful">Most Helpful (demo)</option>
          </select>
        </div>
      </div>

      {reviews.length === 0 ? (
        <Card padding="lg">
          <div style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⭐</div>
            <p>No reviews yet. Be the first to review this lesson!</p>
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {reviews
            .slice()
            .sort((a, b) => {
              if (sortBy !== "helpful") return 0;
              const ha = helpful[a.id] ?? 0;
              const hb = helpful[b.id] ?? 0;
              return hb - ha;
            })
            .map((review) => (
              <Card key={review.id} padding="md" hoverable>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <div>
                    <strong>{displayName(review)}</strong>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        marginTop: "0.25rem",
                      }}
                    >
                      {[...Array(5)].map((_, i) => (
                        <span
                          key={i}
                          style={{
                            color: i < review.rating ? "#fbbf24" : "#d1d5db",
                            fontSize: "1rem",
                          }}
                        >
                          ★
                        </span>
                      ))}
                      <span style={{ marginLeft: "0.5rem", fontSize: "0.875rem", color: "#6b7280" }}>
                        {formatDate(review.created_at)}
                      </span>
                    </div>
                  </div>

                  <Button variant="ghost" size="sm" onClick={() => handleHelpful(review.id)}>
                    👍 Helpful ({helpful[review.id] ?? 0})
                  </Button>
                </div>

                {review.comment && (
                  <p style={{ marginTop: "0.75rem", lineHeight: 1.6, color: "#374151" }}>
                    {review.comment}
                  </p>
                )}
              </Card>
            ))}
        </div>
      )}

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.5rem",
            marginTop: "2rem",
          }}
        >
          <Button variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>

          <span style={{ display: "flex", alignItems: "center", padding: "0.5rem 1rem" }}>
            Page {page} of {totalPages}
          </span>

          <Button
            variant="ghost"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default ReviewList;
