import React, { useCallback, useEffect, useRef, useState } from "react";

export type LessonAutoTextareaProps = {
  value: string;
  onChange: (next: string) => void;
  /** Minimum height when not in focus mode (px). */
  minHeightPx?: number;
  /** Height of the editor in focus mode (viewport fraction). */
  focusModeVh?: number;
  /** Show expand/focus mode control (main content fields only). */
  showExpandButton?: boolean;
  assignRef?: (el: HTMLTextAreaElement | null) => void;
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
  /** Selection tracking for toolbar actions (e.g. remove key term). */
  onSelect?: React.ReactEventHandler<HTMLTextAreaElement>;
  onKeyUp?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onMouseUp?: React.MouseEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  name?: string;
  maxLength?: number;
  /** Merged onto the textarea (border, font, etc.). */
  style?: React.CSSProperties;
  /** Optional class for the textarea. */
  className?: string;
  /** "lesson" = monospace teaching editor; "plain" = UI copy fields. */
  editorVariant?: "lesson" | "plain";
};

const lessonBase: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  marginTop: 0,
  padding: "10px 12px",
  borderRadius: 12,
  border: "2px solid rgba(0,0,0,0.14)",
  resize: "none",
  background: "white",
  whiteSpace: "pre-wrap",
  lineHeight: 1.6,
  overflow: "hidden",
  boxSizing: "border-box",
};

const plainBase: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  padding: "10px 12px",
  borderRadius: 10,
  border: "2px solid rgba(0,0,0,0.14)",
  resize: "none",
  background: "white",
  whiteSpace: "pre-wrap",
  lineHeight: 1.55,
  overflow: "hidden",
  boxSizing: "border-box",
};

function syncTextareaHeight(
  el: HTMLTextAreaElement,
  minHeightPx: number,
  expanded: boolean,
  focusModeVh: number
) {
  if (expanded) {
    const vh = typeof window !== "undefined" ? window.innerHeight * (focusModeVh / 100) : minHeightPx * 2;
    el.style.minHeight = `${vh}px`;
    el.style.maxHeight = `${vh}px`;
    el.style.height = `${vh}px`;
    el.style.overflowY = "auto";
    return;
  }
  el.style.minHeight = `${minHeightPx}px`;
  el.style.maxHeight = "none";
  el.style.overflowY = "hidden";
  el.style.height = "auto";
  const next = Math.max(minHeightPx, el.scrollHeight);
  const rounded = Math.ceil(next);
  el.style.height = `${rounded}px`;
}

/**
 * Auto-growing textarea with optional focus mode (~70vh) for long-form lesson writing.
 */
export function LessonAutoTextarea({
  value,
  onChange,
  minHeightPx = 144,
  focusModeVh = 70,
  showExpandButton = false,
  assignRef,
  onPaste,
  onSelect,
  onKeyUp,
  onMouseUp,
  placeholder,
  name,
  maxLength,
  style,
  className,
  editorVariant = "plain",
}: LessonAutoTextareaProps) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const assignRefLatest = useRef(assignRef);
  assignRefLatest.current = assignRef;
  const [focusExpanded, setFocusExpanded] = useState(false);
  const strValue = value == null ? "" : String(value);

  const setRefs = useCallback((el: HTMLTextAreaElement | null) => {
    innerRef.current = el;
    assignRefLatest.current?.(el);
  }, []);

  const runSync = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    syncTextareaHeight(el, minHeightPx, focusExpanded, focusModeVh);
  }, [minHeightPx, focusExpanded, focusModeVh]);

  useEffect(() => {
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      runSync();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [strValue, focusExpanded, runSync]);

  const base: React.CSSProperties =
    editorVariant === "lesson"
      ? {
          ...lessonBase,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        }
      : { ...plainBase };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    if (next === strValue) return;
    onChange(next);
  };

  const handlePaste: React.ClipboardEventHandler<HTMLTextAreaElement> = (e) => {
    onPaste?.(e);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!innerRef.current) return;
        syncTextareaHeight(innerRef.current, minHeightPx, focusExpanded, focusModeVh);
      });
    });
  };

  return (
    <div style={{ width: "100%" }}>
      {showExpandButton && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 6,
          }}
        >
          <button
            type="button"
            onClick={() => setFocusExpanded((v) => !v)}
            aria-expanded={focusExpanded}
            aria-label={focusExpanded ? "Collapse editor" : "Expand editor focus mode"}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1.5px solid rgba(59,130,246,0.35)",
              background: focusExpanded ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.95)",
              color: "#1d4ed8",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "0.8125rem",
            }}
          >
            {focusExpanded ? "Collapse" : "Expand / Focus mode"}
          </button>
        </div>
      )}
      <textarea
        ref={setRefs}
        name={name}
        value={strValue}
        onChange={handleChange}
        onPaste={handlePaste}
        onSelect={onSelect}
        onKeyUp={onKeyUp}
        onMouseUp={onMouseUp}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={1}
        className={className}
        style={{ ...base, ...style }}
      />
    </div>
  );
}
