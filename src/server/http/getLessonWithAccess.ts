import { canAccessContent } from "../entitlements/canAccessContent";
import { applyAccessMode } from "../content/applyAccessMode";

/**
 * Thin orchestration layer:
 * - fetch entitlements
 * - fetch lesson metadata
 * - enforce access
 * - shape payload
 *
 * This is intentionally framework-agnostic.
 */
export async function getLessonWithAccess(opts: {
  lessonId: string;
  user: {
    userId: string;
    subscriptionActive: boolean;
    purchasedLessons: string[];
  } | null;
  getLessonMeta: (lessonId: string) => Promise<{ lessonId: string; isFreePreview: boolean }>;
  getLessonPayload: (lessonId: string) => Promise<any>;
}) {
  const lessonMeta = await opts.getLessonMeta(opts.lessonId);
  if (!lessonMeta.isPublished) {
    return {
      ok: false as const,
      error: "NOT_PUBLISHED",
    };
  }
  const decision = canAccessContent(opts.user, lessonMeta);

  if (!decision.allow) {
    return {
      ok: false as const,
      error: decision.reason,
    };
  }

  const payload = await opts.getLessonPayload(opts.lessonId);
  return {
    ok: true as const,
    data: applyAccessMode(payload, decision.mode),
    mode: decision.mode,
  };
}
