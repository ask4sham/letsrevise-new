// frontend/src/components/LessonAccessBadge.tsx
// Badge for lesson cards: Included | Free preview | Locked (priority order).

import React from "react";

export type LessonAccessBadgeProps = {
  /** Full access (subscription / unlock / purchased) */
  hasAccess?: boolean;
  /** Paywall locked, not entitled */
  locked?: boolean;
  /** Backend reason e.g. NOT_ENTITLED, FREE_PREVIEW */
  reason?: string;
  /** Preview-enabled lesson (first page only) */
  isFreePreview?: boolean;
};

const badgeStyle = (
  variant: "included" | "preview" | "locked"
): React.CSSProperties => {
  const base = {
    padding: "4px 10px",
    borderRadius: 20,
    fontSize: "0.8rem",
    fontWeight: 600,
  };
  if (variant === "included") {
    return {
      ...base,
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid rgba(22,101,52,0.35)",
    };
  }
  if (variant === "preview") {
    return {
      ...base,
      background: "#e0f2fe",
      color: "#0369a1",
      border: "1px solid rgba(3,105,161,0.35)",
    };
  }
  return {
    ...base,
    background: "#e5e7eb",
    color: "#4b5563",
    border: "1px solid rgba(75,85,99,0.25)",
  };
};

/** Priority: Included > Free preview > Locked */
export function LessonAccessBadge({
  hasAccess,
  locked,
  reason,
  isFreePreview,
}: LessonAccessBadgeProps) {
  const included = hasAccess === true;
  const freePreview =
    reason === "FREE_PREVIEW" || (Boolean(isFreePreview) && hasAccess !== true);

  let variant: "included" | "preview" | "locked" = "locked";
  let label = "Locked";

  if (included) {
    variant = "included";
    label = "Included";
  } else if (freePreview) {
    variant = "preview";
    label = "Free preview";
  } else {
    variant = "locked";
    label = "Locked";
  }

  return (
    <span style={badgeStyle(variant)} title={variant === "included" ? "Included with subscription" : undefined}>
      {label}
    </span>
  );
}

/** One-line legend for badge meanings. Show once under "Available Lessons". */
export function LessonAccessBadgeLegend() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px 16px",
        alignItems: "center",
        fontSize: "0.75rem",
        color: "#6b7280",
        marginTop: "6px",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={badgeStyle("included")}>Included</span>
        <span>= full access</span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={badgeStyle("preview")}>Free preview</span>
        <span>= first page only</span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={badgeStyle("locked")}>Locked</span>
        <span>= subscription required</span>
      </span>
    </div>
  );
}

export default LessonAccessBadge;
