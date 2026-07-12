import React, { useCallback, useRef, useState } from "react";
import { LessonBlockRichToolbar, insertAtCursor } from "./LessonBlockRichToolbar";
import { LessonAutoTextarea } from "./LessonAutoTextarea";

const editorTextareaExtras: React.CSSProperties = {
  marginTop: 0,
};

export type LessonBlockContentTextareaProps = {
  value: string;
  onChange: (next: string) => void;
  assignTextareaRef: (el: HTMLTextAreaElement | null) => void;
  getTextarea: () => HTMLTextAreaElement | null;
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  /** @deprecated Autosize replaces fixed rows; kept for API compatibility. */
  rows?: number;
  style?: React.CSSProperties;
  /** Taller default min-height for long-form block types (key idea, exam tip, etc.). */
  sizeVariant?: "default" | "long";
  /** Override min height (px) when you need a custom floor. */
  minHeightPx?: number;
  /** Glossary: toolbar “Key term” — uses current textarea selection. */
  onKeyTermClick?: () => void;
  /** Optional: toolbar “Suggest key terms” (AI) for this block. */
  onSuggestKeyTermsClick?: () => void;
};

export function LessonBlockContentTextarea({
  value,
  onChange,
  assignTextareaRef,
  getTextarea,
  onPaste,
  placeholder,
  rows: _rows = 6,
  style,
  sizeVariant = "default",
  minHeightPx: minHeightProp,
  onKeyTermClick,
  onSuggestKeyTermsClick,
}: LessonBlockContentTextareaProps) {
  const minHeightPx = minHeightProp ?? (sizeVariant === "long" ? 300 : 160);
  const lastSelRef = useRef({ start: 0, end: 0 });
  const [toolbarStatus, setToolbarStatus] = useState("");
  const statusClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rememberSelection = useCallback(() => {
    const el = getTextarea();
    if (!el) return;
    lastSelRef.current = {
      start: el.selectionStart ?? 0,
      end: el.selectionEnd ?? 0,
    };
  }, [getTextarea]);

  const showToolbarStatus = useCallback((message: string) => {
    setToolbarStatus(message);
    if (statusClearRef.current) clearTimeout(statusClearRef.current);
    statusClearRef.current = setTimeout(() => setToolbarStatus(""), 8000);
  }, []);

  const restoreCursor = (cursor: number) => {
    const el = getTextarea();
    if (!el) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          el.focus();
          const max = el.value.length;
          const pos = Math.min(cursor, max);
          el.setSelectionRange(pos, pos);
          lastSelRef.current = { start: pos, end: pos };
        } catch {
          /* ignore */
        }
      });
    });
  };

  const applyInsertAtCursor = (text: string) => {
    const el = getTextarea();
    if (!el) return;
    const { next, cursor } = insertAtCursor(el, text);
    onChange(next);
    restoreCursor(cursor);
  };

  return (
    <>
      <LessonBlockRichToolbar
        getTextarea={getTextarea}
        onApply={(next, cursor) => {
          onChange(next);
          restoreCursor(cursor);
        }}
        onKeyTermClick={onKeyTermClick}
        onSuggestKeyTermsClick={onSuggestKeyTermsClick}
        getLastTextareaSelection={() => lastSelRef.current}
        onRemoveKeyTermStatus={showToolbarStatus}
      />
      {toolbarStatus ? (
        <div
          role="status"
          style={{
            marginBottom: 8,
            fontSize: 12,
            color: "#334155",
            background: "rgba(241,245,249,0.95)",
            border: "1px solid rgba(148,163,184,0.45)",
            borderRadius: 8,
            padding: "6px 10px",
          }}
        >
          {toolbarStatus}
        </div>
      ) : null}
      <LessonAutoTextarea
        editorVariant="lesson"
        value={value}
        onChange={onChange}
        assignRef={assignTextareaRef}
        onPaste={onPaste}
        onSelect={rememberSelection}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        placeholder={placeholder}
        minHeightPx={minHeightPx}
        showExpandButton
        style={{ ...editorTextareaExtras, ...style }}
      />
    </>
  );
}
