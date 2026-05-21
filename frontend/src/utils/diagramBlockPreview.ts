/** Strip backend/AI diagram placeholder prose from teacher preview (not student view). */

export function isDiagramPlaceholderContent(content: unknown): boolean {
  return /^image\s+here$/i.test(String(content ?? "").trim());
}

/** Markdown body for diagram blocks in editor preview — never show "image here". */
export function diagramMarkdownContentForPreview(
  content: unknown,
  imageUrl?: unknown
): string {
  const c = String(content ?? "").trim();
  if (!c || isDiagramPlaceholderContent(c)) return "";
  return c;
}

export function diagramImageUrlForPreview(imageUrl: unknown): string {
  return String(imageUrl ?? "").trim();
}
