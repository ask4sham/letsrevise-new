import React from "react";
import { ADD_BLOCK_OPTIONS, BLOCK_META, type AddBlockOption } from "../../types/lessonBlocks";

export type AddBlockByRoleSelectProps = {
  /** Fired when the user picks a role/type from {@link ADD_BLOCK_OPTIONS}. */
  onChoose: (opt: AddBlockOption) => void;
  /** First (placeholder) option label — use "+ Add block by role…" for page-level, "+ Add below" for per-block. */
  placeholderLabel?: string;
  /** Tighter padding and width for per-block toolbars. */
  compact?: boolean;
  /** When true, checkpoint rows are disabled (same semantics as page-level add on Edit Lesson). */
  disableCheckpointBlocks?: boolean;
  selectStyle?: React.CSSProperties;
  id?: string;
};

/**
 * Single dropdown for “add block by role” — uses {@link ADD_BLOCK_OPTIONS} only (no duplicated role list).
 */
export function AddBlockByRoleSelect({
  onChoose,
  placeholderLabel = "+ Add block by role…",
  compact = false,
  disableCheckpointBlocks = false,
  selectStyle,
  id,
}: AddBlockByRoleSelectProps) {
  return (
    <select
      id={id}
      value=""
      aria-label={placeholderLabel}
      onChange={(e) => {
        const val = e.target.value;
        if (!val) return;
        e.target.value = "";
        const opt = ADD_BLOCK_OPTIONS.find((o) => `${o.role}:${o.type}` === val);
        if (opt) {
          if (disableCheckpointBlocks && opt.type === "checkpoint") return;
          onChoose(opt);
        }
      }}
      style={{
        ...(compact
          ? {
              padding: "4px 8px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              border: "2px solid rgba(0,0,0,0.14)",
              minWidth: 118,
              maxWidth: 160,
              background: "white",
            }
          : {
              minWidth: 200,
              padding: "8px 12px",
              fontWeight: 600,
            }),
        ...selectStyle,
      }}
    >
      <option value="">{placeholderLabel}</option>
      {ADD_BLOCK_OPTIONS.map((opt) => {
        const isCheckpointDisabled = disableCheckpointBlocks && opt.type === "checkpoint";
        const dropdownHint = BLOCK_META[opt.type]?.subtitle;
        return (
          <option
            key={`${opt.role}:${opt.type}`}
            value={`${opt.role}:${opt.type}`}
            disabled={isCheckpointDisabled}
            title={dropdownHint ?? undefined}
          >
            {opt.label}
            {isCheckpointDisabled ? " (page checkpoint in use)" : ""}
          </option>
        );
      })}
    </select>
  );
}
