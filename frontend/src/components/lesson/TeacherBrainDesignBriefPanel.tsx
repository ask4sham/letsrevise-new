import React, { useCallback, useEffect, useRef, useState } from "react";
import { LessonAutoTextarea } from "./LessonAutoTextarea";
import {
  hasTeacherBrainDesignBrief,
  isTeacherBrainBriefEditorBlock,
  shouldShowTeacherBrainDesignBriefPanel,
  teacherBrainDesignBriefCopyText,
  teacherBrainDesignBriefKindLine,
  teacherBrainDesignBriefPanelText,
} from "../../utils/teacherBrainDesignBrief";
import "./teacherBrainDesignBriefPanel.css";

export type TeacherBrainDesignBriefPanelProps = {
  blockType: string;
  note?: string;
  onNoteChange: (note: string) => void;
  /** When set, shown on eligible blocks that have no brief yet. */
  onRequestInject?: () => void | Promise<void>;
  injectLoading?: boolean;
  /** Bumped after inject/regenerate so panel re-reads note immediately. */
  refreshKey?: number;
};

export function TeacherBrainDesignBriefPanel({
  blockType,
  note,
  onNoteChange,
  onRequestInject,
  injectLoading = false,
  refreshKey = 0,
}: TeacherBrainDesignBriefPanelProps): React.ReactElement | null {
  const block = { type: blockType, note };
  const eligible = isTeacherBrainBriefEditorBlock(block);
  const hasBrief = hasTeacherBrainDesignBrief(note);
  const showBriefPanel = eligible && shouldShowTeacherBrainDesignBriefPanel(block);
  const panelBody = teacherBrainDesignBriefPanelText(note);
  const briefKindLine = teacherBrainDesignBriefKindLine(note);
  const normalNote = String(note ?? "").trim();
  const showTeacherNoteField = eligible && !hasBrief && normalNote.length > 0;

  const [expanded, setExpanded] = useState(true);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const hadBriefRef = useRef(false);

  useEffect(() => {
    if (hasBrief && !hadBriefRef.current) {
      setExpanded(true);
      hadBriefRef.current = true;
    }
    if (!hasBrief) hadBriefRef.current = false;
  }, [hasBrief]);

  useEffect(() => {
    if (hasBrief) setExpanded(true);
  }, [refreshKey, hasBrief]);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const text = teacherBrainDesignBriefCopyText(note);
      if (!text) return;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.position = "fixed";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        setCopyStatus("copied");
        window.setTimeout(() => {
          setExpanded(false);
        }, 500);
        window.setTimeout(() => setCopyStatus("idle"), 2000);
      } catch {
        setCopyStatus("error");
        window.setTimeout(() => setCopyStatus("idle"), 2500);
      }
    },
    [note]
  );

  if (!eligible) return null;

  if (showBriefPanel) {
    return (
      <div
        className={`lr-teacher-brain-brief ${expanded ? "lr-teacher-brain-brief--expanded" : "lr-teacher-brain-brief--collapsed"}`}
        data-testid="teacher-brain-design-brief-panel"
        data-expanded={expanded ? "true" : "false"}
      >
        <div className="lr-teacher-brain-brief__header">
          <div className="lr-teacher-brain-brief__titles">
            <span className="lr-teacher-brain-brief__title">Teacher Brain Design Brief</span>
            {briefKindLine ? (
              <span className="lr-teacher-brain-brief__kind" data-testid="teacher-brain-brief-kind">
                {briefKindLine}
              </span>
            ) : null}
          </div>
          <span className="lr-teacher-brain-brief__badge">Teacher only</span>
          <div className="lr-teacher-brain-brief__actions">
            {onRequestInject ? (
              <button
                type="button"
                className="lr-teacher-brain-brief__regenerate"
                disabled={injectLoading}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("[TeacherBrainUI] regenerate clicked", { blockType });
                  void onRequestInject?.();
                }}
              >
                {injectLoading ? "Regenerating…" : "Regenerate brief"}
              </button>
            ) : null}
            <button
              type="button"
              className="lr-teacher-brain-brief__copy"
              onClick={handleCopy}
              aria-label="Copy design brief"
            >
              {copyStatus === "copied"
                ? "Copied"
                : copyStatus === "error"
                  ? "Copy failed"
                  : "Copy brief"}
            </button>
            <button
              type="button"
              className="lr-teacher-brain-brief__toggle"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse design brief" : "Expand design brief"}
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>
        {expanded ? (
          <div className="lr-teacher-brain-brief__body">
            <pre
              key={`brief-body-${refreshKey}-${briefKindLine}`}
              className="lr-teacher-brain-brief__pre"
            >
              {panelBody}
            </pre>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div
        className="lr-teacher-brain-brief lr-teacher-brain-brief--missing"
        data-testid="teacher-brain-design-brief-missing"
      >
        <p className="lr-teacher-brain-brief__missing-text">
          No Teacher Brain design brief on this block yet. Export from the generator with{" "}
          <strong>Lesson Generator V4</strong> enabled, re-import JSON, or inject briefs here.
        </p>
        {onRequestInject ? (
          <button
            type="button"
            className="lr-teacher-brain-brief__inject-btn"
            disabled={injectLoading}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("[TeacherBrainUI] inject clicked", { blockType });
              void onRequestInject?.();
            }}
          >
            {injectLoading
              ? "Regenerating…"
              : hasBrief
                ? "Regenerate Teacher Brain brief"
                : "Inject Teacher Brain briefs"}
          </button>
        ) : null}
      </div>
      {showTeacherNoteField ? (
        <label className="lr-teacher-brain-teacher-note" data-testid="teacher-brain-teacher-note-field">
          <div className="lr-teacher-brain-teacher-note__label">Teacher note (optional)</div>
          <p className="lr-teacher-brain-teacher-note__hint">
            Shown only in the editor — not visible to students.
          </p>
          <LessonAutoTextarea
            editorVariant="plain"
            value={String(note ?? "")}
            onChange={onNoteChange}
            minHeightPx={96}
            style={{ fontSize: "0.875rem" }}
          />
        </label>
      ) : null}
    </>
  );
}
