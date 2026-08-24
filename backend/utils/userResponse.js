/**
 * Allowlisted current-user / self-profile response DTOs.
 * Prefer explicit inclusion over blacklist projections.
 */

const { hasStripeLetsReviseProAccess } = require("./stripeBillingAccess");

/** Fields required for toCurrentUserDto (+ isDeleted for route checks only). */
const CURRENT_USER_PROJECTION = [
  "_id",
  "email",
  "userType",
  "staffRole",
  "firstName",
  "lastName",
  "schoolName",
  "institution",
  "verificationStatus",
  "yearGroup",
  "stageKey",
  "referralCode",
  "subscription",
  "subscriptionEndDate",
  "subscriptionV2",
  "stripeBilling",
  "isDeleted",
].join(" ");

/** Fields required for toSelfProfileDto (+ isDeleted for route checks only). */
const SELF_PROFILE_PROJECTION = [
  CURRENT_USER_PROJECTION,
  "earnings",
  "purchasedLessons",
].join(" ");

/**
 * @param {unknown} value
 * @returns {string}
 */
function idString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value.toString === "function") return value.toString();
  return String(value);
}

/**
 * @param {unknown} dateVal
 * @returns {string|null}
 */
function toIsoOrNull(dateVal) {
  if (dateVal == null || dateVal === "") return null;
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Safe subscriptionV2 subset — never include provider / planId.
 * @param {unknown} sub
 * @returns {{ plan: unknown, status: unknown, expiresAt: string|null, cancelAtPeriodEnd: boolean }|undefined}
 */
function toSafeSubscriptionV2(sub) {
  if (!sub || typeof sub !== "object") return undefined;
  const s = /** @type {Record<string, unknown>} */ (sub);
  return {
    plan: s.plan ?? undefined,
    status: s.status ?? undefined,
    expiresAt: toIsoOrNull(s.expiresAt),
    cancelAtPeriodEnd: Boolean(s.cancelAtPeriodEnd),
  };
}

/**
 * Map purchasedLessons to the shape frontend consumers use (ids + timestamps).
 * Does not spread populated lesson documents.
 * @param {unknown} list
 * @returns {Array<{ lessonId: string, purchasedAt: string|null }>}
 */
function toPurchasedLessonsDto(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((entry) => {
      if (entry == null) return null;
      if (typeof entry === "string" || typeof entry === "number") {
        return { lessonId: String(entry), purchasedAt: null };
      }
      const raw = /** @type {Record<string, unknown>} */ (entry);
      let lessonId = raw.lessonId;
      if (lessonId && typeof lessonId === "object") {
        const nested = /** @type {Record<string, unknown>} */ (lessonId);
        lessonId = nested._id ?? nested.id ?? null;
      }
      const id = idString(lessonId);
      if (!id) return null;
      return {
        lessonId: id,
        purchasedAt: toIsoOrNull(raw.purchasedAt),
      };
    })
    .filter(Boolean);
}

/**
 * Slim authenticated self-user DTO for GET /api/users/me and GET /api/auth/user.
 * @param {Record<string, unknown>|null|undefined} userDoc
 * @returns {Record<string, unknown>|null}
 */
function toCurrentUserDto(userDoc) {
  if (!userDoc) return null;

  const id = idString(userDoc._id ?? userDoc.id);
  const status = String(userDoc.verificationStatus || "pending").toLowerCase();
  const emailVerified =
    typeof userDoc.emailVerified === "boolean"
      ? userDoc.emailVerified
      : status === "verified";

  /** @type {Record<string, unknown>} */
  const dto = {
    id,
    _id: id,
    email: userDoc.email,
    firstName: userDoc.firstName,
    lastName: userDoc.lastName || "",
    userType: userDoc.userType,
    staffRole: userDoc.staffRole ?? null,
    verificationStatus: userDoc.verificationStatus || "pending",
    emailVerified,
    schoolName: userDoc.schoolName ?? null,
    institution: userDoc.institution ?? null,
    yearGroup: userDoc.yearGroup ?? null,
    stageKey: userDoc.stageKey ?? null,
    referralCode: userDoc.referralCode ?? null,
    subscription: userDoc.subscription ?? undefined,
    subscriptionEndDate: toIsoOrNull(userDoc.subscriptionEndDate),
  };

  const subV2 = toSafeSubscriptionV2(userDoc.subscriptionV2);
  if (subV2) dto.subscriptionV2 = subV2;

  dto.hasLetsReviseProAccess = hasStripeLetsReviseProAccess(userDoc);

  return dto;
}

/**
 * Self-profile DTO for GET /api/users/profile — extends current-user DTO.
 * @param {Record<string, unknown>|null|undefined} userDoc
 * @returns {Record<string, unknown>|null}
 */
function toSelfProfileDto(userDoc) {
  const base = toCurrentUserDto(userDoc);
  if (!base) return null;

  return {
    ...base,
    earnings: Number(userDoc.earnings ?? 0),
    purchasedLessons: toPurchasedLessonsDto(userDoc.purchasedLessons),
  };
}

module.exports = {
  CURRENT_USER_PROJECTION,
  SELF_PROFILE_PROJECTION,
  toCurrentUserDto,
  toSelfProfileDto,
  toPurchasedLessonsDto,
  toSafeSubscriptionV2,
};
