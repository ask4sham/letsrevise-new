/**
 * Block 28 Practice Questions — shared type policy (mirrors lib/block28PracticePolicy.js).
 */

export const BLOCK28_SUPPORTED_TYPES = new Set(["mcq", "short"]);
export const BLOCK28_UNSUPPORTED_TYPES = new Set(["composite", "label", "table", "data"]);

export function normalizeBlock28Type(type?: string | null): string {
  return String(type || "")
    .trim()
    .toLowerCase();
}

export function isBlock28SupportedType(type?: string | null): boolean {
  return BLOCK28_SUPPORTED_TYPES.has(normalizeBlock28Type(type));
}

export function normalizeMarkSchemeLines(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((line) => String(line ?? "").trim()).filter(Boolean);
}

export function validateShortMarksMarkSchemeInvariant(
  marksInput: unknown,
  markSchemeRaw: unknown
): { ok: true; marks: number; markScheme: string[] } | { ok: false; msg: string } {
  let marks = marksInput;
  if (typeof marks === "string" && marks.trim() !== "") {
    marks = parseInt(marks, 10);
  }
  if (typeof marks !== "number" || !Number.isFinite(marks) || marks < 1) {
    return { ok: false, msg: "marks must be an integer >= 1" };
  }
  marks = Math.trunc(marks);
  const markScheme = normalizeMarkSchemeLines(markSchemeRaw);
  if (markScheme.length !== marks) {
    return {
      ok: false,
      msg:
        marks === 1
          ? "This question is worth 1 mark, so it needs exactly 1 mark-scheme point."
          : `This question is worth ${marks} marks, so it needs exactly ${marks} mark-scheme points.`,
    };
  }
  return { ok: true, marks, markScheme };
}
