import React, { useCallback, useState } from "react";
import { pasteRawBufferToLessonMarkdown } from "../../utils/lessonEditorPaste";
import { removeDataKeyTermSpansInRange } from "../../utils/keyTermInlineMarkers";

export const LESSON_FONT_SIZE_LABELS = ["Small", "Normal", "Large", "Extra Large"] as const;
export const LESSON_FONT_SIZE_CLASSES = [
  "lesson-fsz-small",
  "lesson-fsz-normal",
  "lesson-fsz-large",
  "lesson-fsz-xlarge",
] as const;

export const LESSON_COLOR_SWATCHES = [
  { key: "black", label: "Black", cls: "lesson-fc-black", hex: "#0f172a" },
  { key: "navy", label: "Navy", cls: "lesson-fc-navy", hex: "#1e3a8a" },
  { key: "green", label: "Green", cls: "lesson-fc-green", hex: "#166534" },
  { key: "red", label: "Red", cls: "lesson-fc-red", hex: "#991b1b" },
  { key: "purple", label: "Purple", cls: "lesson-fc-purple", hex: "#6b21a8" },
] as const;

/** Quick-insert markers for teacher-authored emphasis (plain text, no auto-format). */
export const LESSON_TEACHING_ICONS: { icon: string; title: string }[] = [
  { icon: "🔑", title: "Key idea / keywords" },
  { icon: "🧬", title: "Biology concept" },
  { icon: "🧠", title: "Thinking / understanding" },
  { icon: "👉", title: "Key point" },
  { icon: "🔍", title: "Examine closely" },
  { icon: "⚠️", title: "Common mistake" },
  { icon: "⚖️", title: "Evaluate / balance" },
  { icon: "🧪", title: "Experiment / application" },
  { icon: "💡", title: "Key insight" },
];

function wrapSelection(textarea: HTMLTextAreaElement, before: string, after: string): { next: string; cursor: number } {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const val = textarea.value;
  const sel = val.slice(start, end);
  const next = val.slice(0, start) + before + sel + after + val.slice(end);
  const cursor = start + before.length + sel.length + after.length;
  return { next, cursor };
}

function insertAtCursor(textarea: HTMLTextAreaElement, insert: string): { next: string; cursor: number } {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const val = textarea.value;
  const next = val.slice(0, start) + insert + val.slice(end);
  const cursor = start + insert.length;
  return { next, cursor };
}

function prefixCurrentLine(textarea: HTMLTextAreaElement, prefix: string): { next: string; cursor: number } {
  const val = textarea.value;
  const start = textarea.selectionStart ?? 0;
  const lineStart = val.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = val.indexOf("\n", start);
  const endLine = lineEnd === -1 ? val.length : lineEnd;
  const line = val.slice(lineStart, endLine);
  const stripped = line.replace(/^\s*/, "");
  const nextLine = prefix + stripped;
  const next = val.slice(0, lineStart) + nextLine + val.slice(endLine);
  const cursor = lineStart + nextLine.length;
  return { next, cursor };
}

export type LessonBlockRichToolbarProps = {
  getTextarea: () => HTMLTextAreaElement | null;
  onApply: (value: string, cursorPos: number) => void;
  /** Glossary: uses current selection; parent opens AddKeyTermDialog. */
  onKeyTermClick?: () => void;
  /** Optional: AI-suggested key terms for the current block. */
  onSuggestKeyTermsClick?: () => void;
};

const toolbarBtn: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 6,
  border: "1px solid rgba(15,23,42,0.2)",
  background: "rgba(255,255,255,0.95)",
  color: "#334155",
  cursor: "pointer",
};

export function LessonBlockRichToolbar({
  getTextarea,
  onApply,
  onKeyTermClick,
  onSuggestKeyTermsClick,
}: LessonBlockRichToolbarProps) {
  const [pasteFmtOpen, setPasteFmtOpen] = useState(false);
  const [pasteFmtBuffer, setPasteFmtBuffer] = useState("");

  const apply = useCallback(
    (fn: (el: HTMLTextAreaElement) => { next: string; cursor: number }) => {
      const el = getTextarea();
      if (!el) return;
      const { next, cursor } = fn(el);
      onApply(next, cursor);
    },
    [onApply, getTextarea]
  );

  const insertPasteFormatted = useCallback(() => {
    const el = getTextarea();
    if (!el) return;
    const md = pasteRawBufferToLessonMarkdown(pasteFmtBuffer);
    if (!md) return;
    const { next, cursor } = insertAtCursor(el, md);
    onApply(next, cursor);
    setPasteFmtOpen(false);
    setPasteFmtBuffer("");
  }, [getTextarea, onApply, pasteFmtBuffer]);

  return (
    <>
    <div
      role="toolbar"
      aria-label="Block text formatting and teaching markers"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        alignItems: "center",
        marginBottom: pasteFmtOpen ? 0 : 8,
        padding: "6px 8px",
        borderRadius: 8,
        border: "1px solid rgba(15,23,42,0.12)",
        background: "rgba(248,250,252,0.95)",
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginRight: 4 }}>Format</span>
      <button type="button" style={toolbarBtn} onClick={() => apply((el) => wrapSelection(el, "**", "**"))} title="Bold" aria-label="Bold">
        <strong>B</strong>
      </button>
      <button type="button" style={toolbarBtn} onClick={() => apply((el) => wrapSelection(el, "*", "*"))} title="Italic" aria-label="Italic">
        <em>I</em>
      </button>
      <button type="button" style={toolbarBtn} onClick={() => apply((el) => wrapSelection(el, "<u>", "</u>"))} title="Underline" aria-label="Underline">
        <u>U</u>
      </button>
      <button type="button" style={toolbarBtn} onClick={() => apply((el) => prefixCurrentLine(el, "### "))} title="Heading" aria-label="Heading (markdown)">
        H
      </button>
      <button type="button" style={toolbarBtn} onClick={() => apply((el) => prefixCurrentLine(el, "- "))} title="Bullet list" aria-label="Bullet list">
        • List
      </button>
      <button type="button" style={toolbarBtn} onClick={() => apply((el) => prefixCurrentLine(el, "1. "))} title="Numbered list" aria-label="Numbered list">
        1.
      </button>
      <button
        type="button"
        style={toolbarBtn}
        onClick={() => setPasteFmtOpen((v) => !v)}
        title="Paste HTML or plain text and convert to safe lesson markdown"
        aria-expanded={pasteFmtOpen}
        aria-label="Paste and format lesson"
      >
        Paste and format lesson
      </button>

      <span style={{ width: 1, height: 18, background: "rgba(15,23,42,0.15)", margin: "0 4px" }} />

      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#475569" }}>
        Size
        <select
          style={{
            fontSize: 12,
            padding: "4px 6px",
            borderRadius: 6,
            border: "1px solid rgba(15,23,42,0.2)",
          }}
          defaultValue=""
          onChange={(e) => {
            const i = e.target.value;
            e.target.value = "";
            if (i === "") return;
            const idx = Number(i);
            const cls = LESSON_FONT_SIZE_CLASSES[idx];
            if (!cls) return;
            apply((el) =>
              wrapSelection(el, `<span class="lesson-inline ${cls}">`, `</span>`)
            );
          }}
        >
          <option value="">—</option>
          {LESSON_FONT_SIZE_LABELS.map((label, idx) => (
            <option key={label} value={String(idx)}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginLeft: 4 }}>Colour</span>
      {LESSON_COLOR_SWATCHES.map((c) => (
        <button
          key={c.key}
          type="button"
          title={c.label}
          aria-label={`Text colour: ${c.label}`}
          onClick={() =>
            apply((el) =>
              wrapSelection(el, `<span class="lesson-inline ${c.cls}">`, `</span>`)
            )
          }
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            border: "2px solid rgba(15,23,42,0.2)",
            background: c.hex,
            cursor: "pointer",
            padding: 0,
          }}
        />
      ))}

      <span style={{ width: 1, height: 18, background: "rgba(15,23,42,0.15)", margin: "0 4px" }} />

      <span
        style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginRight: 2, cursor: "help" }}
        title="Insert at cursor. Shortcuts (focus editor): Alt+1 💡 · Alt+2 ⚠️ · Alt+3 🔍 · Alt+4 🔑"
      >
        Teach
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        {LESSON_TEACHING_ICONS.map(({ icon, title }) => (
          <button
            key={icon}
            type="button"
            title={title}
            aria-label={`Insert ${title} (${icon}) at cursor`}
            onClick={() => apply((el) => insertAtCursor(el, `${icon} `))}
            style={{
              ...toolbarBtn,
              padding: "2px 6px",
              fontSize: 15,
              lineHeight: 1.2,
              minWidth: 28,
            }}
          >
            {icon}
          </button>
        ))}
        {onKeyTermClick ? (
          <>
            <button
              type="button"
              title="Add glossary definition"
              aria-label="Add glossary definition (key term)"
              onClick={onKeyTermClick}
              style={{
                ...toolbarBtn,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                fontSize: 12,
                lineHeight: 1.2,
              }}
            >
              <span style={{ fontSize: 15 }} aria-hidden>🔑</span>
              <span>Key term</span>
            </button>
            <button
              type="button"
              title="Remove key term markup from the selection (keeps the text)"
              aria-label="Remove key term"
              onClick={() =>
                apply((el) => {
                  const start = el.selectionStart ?? 0;
                  const end = el.selectionEnd ?? 0;
                  const result = removeDataKeyTermSpansInRange(el.value, start, end);
                  return { next: result.nextContent, cursor: result.cursor };
                })
              }
              style={{
                ...toolbarBtn,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                fontSize: 12,
                lineHeight: 1.2,
              }}
            >
              <span style={{ fontSize: 15 }} aria-hidden>🔑</span>
              <span>Remove key term</span>
            </button>
          </>
        ) : null}
        {onSuggestKeyTermsClick ? (
          <button
            type="button"
            title="Get AI-suggested key terms for this block"
            aria-label="Suggest key terms"
            onClick={onSuggestKeyTermsClick}
            style={{
              ...toolbarBtn,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              fontSize: 12,
              lineHeight: 1.2,
            }}
          >
            <span style={{ fontSize: 15 }} aria-hidden>✨</span>
            <span>Suggest key terms</span>
          </button>
        ) : null}
      </div>
    </div>
    {pasteFmtOpen && (
      <div
        style={{
          marginBottom: 8,
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid rgba(59,130,246,0.35)",
          background: "rgba(239,246,255,0.95)",
        }}
      >
        <div style={{ fontSize: 12, color: "#334155", marginBottom: 8, lineHeight: 1.45 }}>
          Paste from Word, ChatGPT, or the web. Content is converted to lesson markdown (headings, lists, bold, links).
          Inline styles and scripts are removed.
        </div>
        <textarea
          value={pasteFmtBuffer}
          onChange={(e) => setPasteFmtBuffer(e.target.value)}
          rows={8}
          placeholder="Paste here, then click Insert formatted…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            fontSize: 13,
            fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
            padding: 8,
            borderRadius: 6,
            border: "1px solid rgba(15,23,42,0.2)",
            resize: "vertical",
            minHeight: 120,
          }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          <button
            type="button"
            onClick={insertPasteFormatted}
            disabled={!pasteFmtBuffer.trim()}
            style={{
              ...toolbarBtn,
              background: pasteFmtBuffer.trim() ? "rgba(37,99,235,0.95)" : "rgba(148,163,184,0.5)",
              color: "#fff",
              borderColor: "rgba(37,99,235,0.5)",
              cursor: pasteFmtBuffer.trim() ? "pointer" : "not-allowed",
            }}
          >
            Insert formatted
          </button>
          <button
            type="button"
            onClick={() => {
              setPasteFmtOpen(false);
              setPasteFmtBuffer("");
            }}
            style={toolbarBtn}
          >
            Cancel
          </button>
        </div>
      </div>
    )}
    </>
  );
}

export { wrapSelection, insertAtCursor, prefixCurrentLine };
