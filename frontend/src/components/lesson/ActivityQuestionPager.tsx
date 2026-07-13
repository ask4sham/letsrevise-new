import React, { useState } from "react";

type ActivityQuestionPagerProps = {
  total: number;
  /** 0-based index */
  index: number;
  onChange: (next: number) => void;
  label?: string;
};

/**
 * Minimal pager for multi-question self-check / checkpoint activities.
 * Only renders when total > 1 (legacy 1-question lessons stay unchanged).
 */
export function ActivityQuestionPager({
  total,
  index,
  onChange,
  label = "Question",
}: ActivityQuestionPagerProps): React.ReactElement | null {
  if (total <= 1) return null;
  const safeIndex = Math.min(Math.max(index, 0), total - 1);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 10,
        flexWrap: "wrap",
      }}
      data-testid="activity-question-pager"
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
        {label} {safeIndex + 1}/{total}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          disabled={safeIndex <= 0}
          onClick={() => onChange(safeIndex - 1)}
          style={{
            fontSize: 13,
            padding: "4px 10px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: safeIndex <= 0 ? "#f1f5f9" : "#fff",
            cursor: safeIndex <= 0 ? "not-allowed" : "pointer",
          }}
        >
          Previous
        </button>
        <button
          type="button"
          disabled={safeIndex >= total - 1}
          onClick={() => onChange(safeIndex + 1)}
          style={{
            fontSize: 13,
            padding: "4px 10px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: safeIndex >= total - 1 ? "#f1f5f9" : "#fff",
            cursor: safeIndex >= total - 1 ? "not-allowed" : "pointer",
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
