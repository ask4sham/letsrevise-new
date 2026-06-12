/**
 * Full-lesson access gating. Single source of truth: backend accessDecision.allowed === true.
 * Fallbacks only when backend accessDecision is missing or not yet loaded.
 */

export interface AccessDecision {
  allowed?: boolean;
  reason?: string;
}

export interface UserForAccess {
  userType?: string;
  isAdmin?: boolean;
  adminPassActive?: boolean;
  subscriptionActive?: boolean;
  [key: string]: any;
}

/**
 * True if the user has full access to the lesson (quiz, all pages, no unlock banners).
 * Prefer accessDecision.allowed === true from backend (SUB_ACTIVE, ADMIN_PASS, PURCHASED, OWNER, etc.).
 * Fallback only if backend accessDecision missing: teacher/admin role, adminPassActive, subscriptionActive.
 */
export function hasFullLessonAccess(
  accessDecision: AccessDecision | null | undefined,
  user: UserForAccess | null | undefined
): boolean {
  if (accessDecision?.allowed === true) return true;

  // Fallback only if backend accessDecision missing or allowed !== true
  const isTeacherOrAdmin =
    user?.userType === "admin" ||
    user?.userType === "teacher" ||
    user?.staffRole === "content_manager" ||
    Boolean(user?.isAdmin);
  if (isTeacherOrAdmin) return true;
  if (Boolean(user?.adminPassActive)) return true;
  if (Boolean(user?.subscriptionActive)) return true;

  return false;
}
