/**
 * HTML → plain text for diagram fields. Display orchestration lives in diagramPedagogyDisplay.ts.
 */

/** Tags removed from diagram instruction display (never shown literally). */
const DIAGRAM_INSTRUCTION_STRIP_TAG_RE =
  /<\/?(?:p|ul|ol|li|details|summary|div|span|br|h[1-6]|blockquote|section|article|figure|figcaption|table|tr|td|th|thead|tbody|tfoot|em|strong|b|i|u|a)(?:\s[^>]*)?\/?>/gi;

const HTML_ENTITY_MAP: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&nbsp;": " ",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

function blockRecord(block: unknown): Record<string, unknown> {
  return block != null && typeof block === "object" ? (block as Record<string, unknown>) : {};
}

function decodeHtmlEntities(text: string): string {
  let out = text;
  for (const [entity, char] of Object.entries(HTML_ENTITY_MAP)) {
    out = out.split(entity).join(char);
  }
  out = out.replace(/&#(\d+);/g, (_, n) => {
    const code = Number(n);
    return Number.isFinite(code) ? String.fromCharCode(code) : _;
  });
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, h) => {
    const code = parseInt(h, 16);
    return Number.isFinite(code) ? String.fromCharCode(code) : _;
  });
  return out;
}

function stripRemainingHtmlTags(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}

function normalizeInlineWhitespace(text: string): string {
  return text.replace(/[ \t]+/g, " ").trim();
}

function normalizeLineBreaks(text: string): string {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd());
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function innerTextFromHtmlFragment(html: string): string {
  let t = html;
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, "\n");
  t = stripRemainingHtmlTags(t);
  return normalizeInlineWhitespace(t);
}

/**
 * Normalize diagram field text (strip HTML). For reveal-aware display use diagramPedagogyDisplay.ts.
 */
export function cleanDiagramInstructionsForDisplay(input: unknown): string {
  let text = String(input ?? "").trim();
  if (!text) return "";

  text = decodeHtmlEntities(text);
  text = text.replace(/<details[^>]*>([\s\S]*?)<\/details>/gi, () => "");
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_match, item: string) => {
    const line = innerTextFromHtmlFragment(item);
    if (!line) return "";
    return line.startsWith("- ") ? line : `- ${line}`;
  });
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/?(p|div|h[1-6]|ul|ol|blockquote|section|article)[^>]*>/gi, "\n");
  text = text.replace(DIAGRAM_INSTRUCTION_STRIP_TAG_RE, "");
  text = stripRemainingHtmlTags(text);

  return normalizeLineBreaks(text);
}

export function cleanDiagramPedagogyFieldForDisplay(input: unknown): string {
  return cleanDiagramInstructionsForDisplay(input);
}

/** @deprecated Prefer diagramPedagogyDisplay.ts — re-exported for legacy imports */
export {
  diagramCaptionForDisplayFromBlock,
  diagramInstructionsForDisplayFromBlock,
} from "./diagramPedagogyDisplay";

/** First non-empty authoring field from a diagram block (raw, before display cleaning). */
export function diagramInstructionsRawFromBlock(block: unknown): string | undefined {
  const b = blockRecord(block);
  for (const key of ["subtitle", "intro", "note"] as const) {
    const raw = typeof b[key] === "string" ? (b[key] as string).trim() : "";
    if (raw) return raw;
  }
  const content = typeof b.content === "string" ? b.content.trim() : "";
  if (!content || /^image\s+here$/i.test(content)) return undefined;
  return content.length >= 10 ? content : undefined;
}

export type DiagramInstructionSourceField = "subtitle" | "intro" | "note" | "content";

export function diagramInstructionSourceField(
  block: unknown
): DiagramInstructionSourceField | undefined {
  const b = blockRecord(block);
  for (const key of ["subtitle", "intro", "note"] as const) {
    const raw = typeof b[key] === "string" ? (b[key] as string).trim() : "";
    if (raw) return key;
  }
  const content = typeof b.content === "string" ? b.content.trim() : "";
  if (!content || /^image\s+here$/i.test(content)) return undefined;
  if (content.length >= 10) return "content";
  return undefined;
}
