import React from "react";
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
}: LessonBlockContentTextareaProps) {
  const minHeightPx = minHeightProp ?? (sizeVariant === "long" ? 300 : 240);

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
      />
      <LessonAutoTextarea
        editorVariant="lesson"
        value={value}
        onChange={onChange}
        assignRef={assignTextareaRef}
        onPaste={onPaste}
        placeholder={placeholder}
        minHeightPx={minHeightPx}
        showExpandButton
        style={{ ...editorTextareaExtras, ...style }}
      />
    </>
  );
}
