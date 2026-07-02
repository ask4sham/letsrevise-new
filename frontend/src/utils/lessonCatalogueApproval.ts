export type CatalogueApprovalStatus =
  | "none"
  | "pending_review"
  | "approved"
  | "rejected"
  | "retired";

export type CatalogueApprovalUi = {
  status: CatalogueApprovalStatus;
  headline: string | null;
  description: string;
  showSubmit: boolean;
  showResubmit: boolean;
  showDraftHelper: boolean;
  version: number | null;
  approvedDateLabel: string | null;
  rejectionNotes: string;
  submitButtonLabel: string;
  /** Filled certification badge (approved only). */
  showCertifiedBadge: boolean;
};

export function normalizeCatalogueApprovalStatus(raw?: string | null): CatalogueApprovalStatus {
  const value = String(raw || "none").toLowerCase();
  if (
    value === "pending_review" ||
    value === "approved" ||
    value === "rejected" ||
    value === "retired"
  ) {
    return value;
  }
  return "none";
}

export function formatCatalogueApprovalDate(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function resolveStatusCopy(
  status: CatalogueApprovalStatus,
  isPublished: boolean
): { headline: string | null; description: string; showDraftHelper: boolean } {
  if (!isPublished) {
    if (status === "rejected") {
      return {
        headline: "Changes requested",
        description: "Publish this lesson before resubmitting for LetsRevise approval.",
        showDraftHelper: true,
      };
    }
    return {
      headline: null,
      description: "Publish this lesson before submitting for LetsRevise approval.",
      showDraftHelper: true,
    };
  }

  switch (status) {
    case "none":
      return {
        headline: "Ready for review",
        description:
          "This lesson is published and can now be submitted for quality review.",
        showDraftHelper: false,
      };
    case "pending_review":
      return {
        headline: "Pending review",
        description: "Waiting for LetsRevise quality review.",
        showDraftHelper: false,
      };
    case "approved":
      return {
        headline: "LetsRevise Approved",
        description:
          "This lesson is now available in the LetsRevise Approved Library.",
        showDraftHelper: false,
      };
    case "rejected":
      return {
        headline: "Changes requested",
        description:
          "Please address the feedback below, then resubmit your lesson for review.",
        showDraftHelper: false,
      };
    case "retired":
      return {
        headline: "Retired",
        description:
          "This lesson is no longer available in the LetsRevise Approved Library.",
        showDraftHelper: false,
      };
    default:
      return { headline: null, description: "", showDraftHelper: false };
  }
}

function resolveBadge(status: CatalogueApprovalStatus): { showCertifiedBadge: boolean } {
  return { showCertifiedBadge: status === "approved" };
}

export function getCatalogueApprovalUi(input: {
  isPublished: boolean;
  teacherLibraryStatus?: string | null;
  catalogueVersion?: number | null;
  approvedAt?: string | null;
  rejectionNotes?: string | null;
}): CatalogueApprovalUi {
  const status = normalizeCatalogueApprovalStatus(input.teacherLibraryStatus);
  const rejectionNotes = (input.rejectionNotes || "").trim();
  const version =
    typeof input.catalogueVersion === "number" && Number.isFinite(input.catalogueVersion)
      ? input.catalogueVersion
      : null;
  const approvedDateLabel = formatCatalogueApprovalDate(input.approvedAt);
  const copy = resolveStatusCopy(status, input.isPublished);
  const { showCertifiedBadge } = resolveBadge(status);

  const showSubmit = input.isPublished && status === "none";
  const showResubmit = input.isPublished && status === "rejected";

  return {
    status,
    headline: copy.headline,
    description: copy.description,
    showSubmit,
    showResubmit,
    showDraftHelper: copy.showDraftHelper,
    version,
    approvedDateLabel,
    rejectionNotes,
    submitButtonLabel: showResubmit ? "Resubmit to LetsRevise" : "Submit to LetsRevise",
    showCertifiedBadge,
  };
}
