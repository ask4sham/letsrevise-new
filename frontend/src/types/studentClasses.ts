/**
 * Teacher class-linking V1 types — opaque publicIds only (no Mongo _id).
 */

export type StudentClassStatus = "active" | "archived";

export type InvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "expired";

export type StudentClassSummary = {
  publicId: string;
  name: string;
  description?: string;
  status: StudentClassStatus;
  subject?: string | null;
  board?: string | null;
  specKey?: string | null;
  tier?: string | null;
  academicYear?: string | null;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string | null;
};

export type StudentClassDetail = StudentClassSummary;

export type CreateClassPayload = {
  name: string;
  description?: string;
  subject?: string;
  board?: string;
  specKey?: string;
  tier?: string;
  academicYear?: string;
};

export type UpdateClassPayload = {
  name?: string;
  description?: string;
  subject?: string | null;
  board?: string | null;
  examBoard?: string | null;
  specKey?: string | null;
  tier?: string | null;
  academicYear?: string | null;
};

export type InvitationPreviewSummary = {
  totalSubmitted?: number;
  totalRows?: number;
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
};

export type InvitationPreviewInvalidEntry =
  | string
  | {
      row?: number;
      value: string;
      reason?: string;
    };

export type InvitationPreview = {
  ok: true;
  summary: InvitationPreviewSummary;
  validEmails: string[];
  duplicateEntries: string[];
  invalidEntries: InvitationPreviewInvalidEntry[];
};

export type CreateInvitationsResult = {
  ok: true;
  message: string;
  summary: {
    submitted: number;
    invalid: number;
    duplicates: number;
  };
};

export type StudentClassInvitation = {
  publicId: string;
  targetEmail: string;
  status: InvitationStatus;
  requestedAt?: string;
  expiresAt?: string;
  respondedAt?: string | null;
  cancelledAt?: string | null;
  student?: {
    displayName: string;
  };
};

export type StudentClassMember = {
  membershipPublicId: string;
  status: "active";
  joinedAt?: string;
  student: {
    displayName: string;
  };
};

export type RemovedMembership = {
  publicId: string;
  status: "removed";
  leftAt?: string | null;
};
