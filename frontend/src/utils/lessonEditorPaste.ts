/**
 * Lesson manual editor: paste handling helpers.
 * Prefer fixing double-paste at the source (onPaste + default) rather than relying on collapse alone.
 */

/** If the whole string is two identical halves, return one half (backup for duplicate-paste glitches). */
export function collapseExactDuplicatePaste(value: string | undefined | null): string {
  if (value == null) return "";
  const s = String(value);
  if (!s) return s;
  const half = s.length / 2;
  if (Number.isInteger(half) && half > 0) {
    const first = s.slice(0, half);
    const second = s.slice(half);
    if (first === second) return first;
  }
  return s;
}

/**
 * Markdown-ish cleanup for pasted plain text (bullets from Word/Docs, heading + list).
 * When `needsCustomInsert` is false, let the browser paste and use onChange only.
 */
export function transformLessonPastedPlainText(pasted: string): {
  text: string;
  needsCustomInsert: boolean;
} {
  if (!pasted) return { text: "", needsCustomInsert: false };

  let text = pasted;
  let modified = false;

  // Real bullets only — do not treat **bold** markdown as a list marker
  const looksLikeBullets =
    /(^|\n)\s*(•|·|–|—)\s+/.test(pasted) ||
    /(^|\n)\s*-\s+\S/.test(pasted) ||
    /(^|\n)\s*\*\s+(?!\*)/.test(pasted) ||
    pasted.includes("•");

  if (looksLikeBullets) {
    modified = true;
    text = pasted.replace(/\s*•\s*/g, "\n• ").trim();
    text = text
      .split("\n")
      .map((line) => {
        if (/^\s*\*\*/.test(line)) return line;
        if (/^\s*\*\s+/.test(line)) return line.replace(/^\s*\*\s+/, "- ");
        return line.replace(/^\s*[•·–—]\s*/, "- ");
      })
      .join("\n");
    text = text.replace(/^-\s*(?=\S)/gm, "- ");
  }

  const lines = text.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    const current = lines[i].trim();
    const next = lines[i + 1].trim();

    const looksLikeHeading =
      current.length > 0 &&
      current.length < 60 &&
      !current.startsWith("-") &&
      !current.startsWith("*") &&
      !current.startsWith("**") &&
      !current.endsWith(".") &&
      /^- /.test(next);

    if (looksLikeHeading) {
      lines[i] = `### ${current}`;
      modified = true;
    }
  }

  return { text: lines.join("\n"), needsCustomInsert: modified };
}

const PASTE_GUARD_STRING_KEYS = [
  "content",
  "prompt",
  "explanation",
  "correctAnswer",
  "caption",
  "question",
  "answer",
  "note",
] as const;

/** Apply collapseExactDuplicatePaste to known long-text fields on block update patches. */
export function guardLessonBlockPatchForDuplicatePaste<T extends Record<string, unknown>>(patch: T): T {
  const out: Record<string, unknown> = { ...patch };
  for (const k of PASTE_GUARD_STRING_KEYS) {
    if (typeof out[k] === "string") {
      out[k] = collapseExactDuplicatePaste(out[k] as string);
    }
  }
  if (Array.isArray(out.options)) {
    out.options = (out.options as unknown[]).map((o) =>
      typeof o === "string" ? collapseExactDuplicatePaste(o) : o
    );
  }
  return out as T;
}
