import React from "react";
import { getCatalogueApprovalUi } from "../../utils/lessonCatalogueApproval";

type Props = {
  isPublished: boolean;
  teacherLibraryStatus?: string | null;
  catalogueVersion?: number | null;
  approvedAt?: string | null;
  rejectionNotes?: string | null;
  submitting?: boolean;
  onSubmit: () => void;
};

const LR_GREEN = "#48bb78";
const LR_GREEN_DARK = "#16a34a";

const LessonCatalogueApprovalSection: React.FC<Props> = ({
  isPublished,
  teacherLibraryStatus,
  catalogueVersion,
  approvedAt,
  rejectionNotes,
  submitting = false,
  onSubmit,
}) => {
  const ui = getCatalogueApprovalUi({
    isPublished,
    teacherLibraryStatus,
    catalogueVersion,
    approvedAt,
    rejectionNotes,
  });

  const showAction = ui.showSubmit || ui.showResubmit;

  return (
    <div
      style={{
        marginTop: 12,
        padding: "14px 16px",
        borderRadius: 10,
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#334155",
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        LetsRevise Review Status
      </div>

      {ui.showCertifiedBadge ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            borderRadius: 8,
            background: LR_GREEN,
            color: "#ffffff",
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
            ✓
          </span>
          LetsRevise Approved
        </div>
      ) : null}

      {!ui.showCertifiedBadge && ui.headline ? (
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>
          {ui.headline}
        </div>
      ) : null}

      {ui.status === "approved" && ui.version != null ? (
        <div style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
          Version {ui.version}
        </div>
      ) : null}

      {ui.status === "approved" && ui.approvedDateLabel ? (
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 10, lineHeight: 1.5 }}>
          <span style={{ fontWeight: 600, color: "#334155" }}>Approved:</span>
          <br />
          {ui.approvedDateLabel}
        </div>
      ) : null}

      {ui.description ? (
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
          {ui.description}
        </p>
      ) : null}

      {ui.status === "rejected" && ui.rejectionNotes ? (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            fontSize: 13,
            color: "#991b1b",
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Feedback</div>
          {ui.rejectionNotes}
        </div>
      ) : null}

      {showAction ? (
        <button
          type="button"
          disabled={submitting}
          onClick={onSubmit}
          style={{
            width: "100%",
            maxWidth: 280,
            padding: "12px 20px",
            borderRadius: 8,
            border: "none",
            background: submitting ? "#86efac" : LR_GREEN,
            color: "#ffffff",
            fontWeight: 700,
            fontSize: 14,
            cursor: submitting ? "wait" : "pointer",
            boxShadow: submitting ? "none" : `0 1px 2px rgba(22, 163, 74, 0.25)`,
          }}
          onMouseEnter={(e) => {
            if (!submitting) e.currentTarget.style.background = LR_GREEN_DARK;
          }}
          onMouseLeave={(e) => {
            if (!submitting) e.currentTarget.style.background = LR_GREEN;
          }}
        >
          {submitting ? "Submitting…" : ui.submitButtonLabel}
        </button>
      ) : null}
    </div>
  );
};

export default LessonCatalogueApprovalSection;
