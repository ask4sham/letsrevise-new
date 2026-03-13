/**
 * PR-REVIEWS-1: Student lesson reviews — same API client as rest of app (no hardcoded localhost).
 * POST /api/reviews/:lessonId, GET /api/reviews/lesson/:lessonId.
 */
import api from "../services/api";

export type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  user_id: string | null;
  created_at: string;
};

export type CreateReviewPayload = {
  rating: number;
  review?: string;
};

export type CreateReviewResponse = {
  msg: string;
  review: {
    id: string;
    rating: number;
    comment: string;
    user_id: string;
    created_at: string;
  };
};

export type GetLessonReviewsParams = {
  page?: number;
  limit?: number;
  sort?: string;
};

export type GetLessonReviewsResponse = {
  reviews: ReviewRow[];
  totalReviews: number;
  totalPages: number;
  currentPage: number;
};

/** Submit a review for a lesson (student, auth required). Uses shared api client. */
export async function createReview(
  lessonId: string,
  payload: CreateReviewPayload
): Promise<CreateReviewResponse> {
  const { data } = await api.post<CreateReviewResponse>(
    `/reviews/${lessonId}`,
    { rating: payload.rating, review: payload.review ?? "" }
  );
  return data;
}

/** Fetch reviews for a lesson (auth + entitlement required). Uses shared api client. */
export async function getLessonReviews(
  lessonId: string,
  params?: GetLessonReviewsParams
): Promise<GetLessonReviewsResponse> {
  const { data } = await api.get<GetLessonReviewsResponse>(
    `/reviews/lesson/${lessonId}`,
    {
      params: {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        sort: params?.sort ?? "newest",
      },
    }
  );
  return data;
}
