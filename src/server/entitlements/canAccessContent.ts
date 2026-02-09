export type AccessDecision =
  | { allow: true; mode: "full" }
  | { allow: true; mode: "preview" }
  | { allow: false; reason: "NOT_AUTHENTICATED" | "NOT_ENTITLED" };

export type UserEntitlements = {
  userId: string;
  subscriptionActive: boolean;
  purchasedLessons: string[];
};

export type LessonAccessMeta = {
  lessonId: string;
  isFreePreview: boolean;
};

export function canAccessContent(
  user: UserEntitlements | null,
  lesson: LessonAccessMeta
): AccessDecision {
  if (!user) return { allow: false, reason: "NOT_AUTHENTICATED" };
  if (user.subscriptionActive) return { allow: true, mode: "full" };
  if (user.purchasedLessons.includes(lesson.lessonId)) return { allow: true, mode: "full" };
  if (lesson.isFreePreview) return { allow: true, mode: "preview" };
  return { allow: false, reason: "NOT_ENTITLED" };
}

