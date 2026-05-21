/**
 * Student-facing step explanations — strip generator UI markup and HTML.
 * Source: letsrevise-generator `decorateSequenceStepVisuals` (lr-seq-mini-flow, etc.)
 */

import { htmlToPlainText } from "./parseFlexibleCheckpointPaste";
import { stripSequenceStepImagePromptFromDescription } from "./interactiveSequenceStepImagePrompt";

const UI_HELPER_BLOCK_RE =
  /<p[^>]*\b(?:lr-seq-mini-flow|lr-seq-transition)\b[^>]*>[\s\S]*?<\/p>/gi;
const ARIA_HIDDEN_RE =
  /<[^>]*\baria-hidden\s*=\s*["']true["'][^>]*>[\s\S]*?<\/[^>]+>/gi;

function stripSequenceUiHelperMarkup(value: string): string {
  return String(value ?? "")
    .replace(UI_HELPER_BLOCK_RE, "")
    .replace(ARIA_HIDDEN_RE, "");
}

function decodeBasicHtmlEntities(value: string): string {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    });
}

function collapseWhitespace(value: string): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripRedundantStepLead(
  text: string,
  options?: { stepTitle?: string; stepIndex?: number }
): string {
  let t = text.trim();
  t = t.replace(/^\s*Step\s+\d+\s*[:\-—–]\s*/i, "");
  t = t.replace(/\s*[→↔]\s*$/g, "");
  t = t.replace(/\s*(?:Next|↓)\s*$/gi, "");
  const title = String(options?.stepTitle ?? "").trim();
  if (title) {
    const titlePlain = htmlToPlainText(title);
    if (titlePlain && t.toLowerCase().startsWith(titlePlain.toLowerCase())) {
      t = t.slice(titlePlain.length).replace(/^[:\-—–\s]+/, "");
    }
  }
  return t.trim();
}

/**
 * Plain-text step explanation safe for student UI (no raw HTML / flow chrome).
 */
export function cleanSequenceStepDescription(
  raw: string,
  options?: { stepTitle?: string; stepIndex?: number }
): string {
  let text = stripSequenceStepImagePromptFromDescription(raw);
  if (!text) return "";

  text = stripSequenceUiHelperMarkup(text);
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = htmlToPlainText(text);
  } else {
    text = text.replace(/<[^>]+>/g, " ");
  }
  text = decodeBasicHtmlEntities(text);
  text = stripRedundantStepLead(text, options);
  return collapseWhitespace(text);
}

/** True when stored description likely contains generator UI markup. */
export function sequenceStepDescriptionNeedsCleaning(raw: string): boolean {
  const s = String(raw ?? "");
  return (
    /\blr-seq-(?:mini-flow|transition)\b/i.test(s) ||
    /<\s*(?:p|span|em|strong)\b/i.test(s) ||
    /\baria-hidden\s*=/i.test(s)
  );
}
