import React, { useEffect, useState } from "react";
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
const API_HOST = "http://localhost:5000";

const ReviewList: React.FC<ReviewListProps> = ({ lessonId }) => {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState("newest");

  // Local-only helpful counts (demo)
  const [helpful, setHelpful] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true);

        if (!lessonId) {
          setReviews([]);
          setTotalPages(1);
          return;
        }

        const url = `${API_HOST}/api/reviews/lesson/${lessonId}?page=${page}&limit=${PAGE_SIZE}&sort=${encodeURIComponent(
          sortBy
        )}`;

        const resp = await fetch(url);
        if (!resp.ok) {
          console.error("Backend reviews fetch failed:", resp.status);
          setReviews([]);
          setTotalPages(1);
          return;
        }

        const json = await resp.json();

        const rowsRaw = Array.isArray(json?.reviews) ? json.reviews : [];

        const rows: ReviewRow[] = rowsRaw.map((r: any) => ({
          id: String(r.id || r._id || ""),
          rating: Number(r.rating || 0),
          comment: (r.comment ?? r.review ?? null) as string | null,
          user_id: (r.user_id ?? r.student_id ?? null) as string | null,
          created_at: String(r.created_at || r.createdAt || new Date().toISOString()),
        }));

        setReviews(rows);
        setTotalPages(Number(json?.totalPages || 1));
      } catch (err) {
        console.error("Error fetching reviews:", err);
        setReviews([]);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
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
    if (r.user_id && typeof r.user_id === "string") return r.user_id;
    return "Student";
  };

  if (loading) return <div>Loading reviews...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
          Student Reviews ({reviews.length})
        </h3>

        <select
          value={sortBy}
          onChange={(e) => {
            setPage(1);
            setSortBy(e.target.value);
          }}
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="highest">Highest Rating</option>
          <option value="lowest">Lowest Rating</option>
          <option value="helpful">Most Helpful (demo)</option>
        </select>
      </div>

      {reviews.length === 0 ? (
        <Card padding="lg">
          <p style={{ textAlign: "center" }}>No reviews yet.</p>
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
              <Card key={review.id} padding="md">
                <strong>{displayName(review)}</strong>
                <div>
                  {[...Array(5)].map((_, i) => (
                    <span key={i} style={{ color: i < review.rating ? "#fbbf24" : "#d1d5db" }}>
                      ★
                    </span>
                  ))}
                  <span style={{ marginLeft: 8 }}>{formatDate(review.created_at)}</span>
                </div>

                {review.comment && <p>{review.comment}</p>}

                <Button variant="ghost" size="sm" onClick={() => handleHelpful(review.id)}>
                  👍 Helpful ({helpful[review.id] ?? 0})
                </Button>
              </Card>
            ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ marginTop: "1rem" }}>
          <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>
          <span style={{ margin: "0 1rem" }}>
            Page {page} of {totalPages}
          </span>
          <Button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default ReviewList;
