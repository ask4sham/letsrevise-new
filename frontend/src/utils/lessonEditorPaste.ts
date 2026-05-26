/**
 * Lesson manual editor: paste handling helpers.
 * Prefer fixing double-paste at the source (onPaste + default) rather than relying on collapse alone.
 *
 * Smart paste (HTML clipboard): parsed with DOMParser; only structure is mapped to markdown.
 * Dangerous nodes/attrs are never emitted — output is plain markdown + allowed inline HTML
 * (e.g. <u> from toolbar), not raw pasted HTML.
 */

import {
  coerceLessonMcqOptionsFour,
  convertLegacyHtmlCheckpointExportToCanonicalPlain,
} from "./parseFlexibleCheckpointPaste";

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

/** Tags we interpret when converting HTML → lesson markdown (others are unwrapped to text/children). */
export const LESSON_PASTE_HTML_RECOGNIZED_TAGS = new Set([
  "P",
  "DIV",
  "BR",
  "HR",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "STRONG",
  "B",
  "EM",
  "I",
  "U",
  "S",
  "STRIKE",
  "DEL",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
  "PRE",
  "CODE",
  "A",
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
  "TH",
  "TD",
  "IMG",
  "SPAN",
  "SECTION",
  "ARTICLE",
  "HEADER",
  "FOOTER",
  "MAIN",
  "NAV",
  "ASIDE",
  "FIGURE",
  "FIGCAPTION",
  "DD",
  "DT",
  "DL",
]);

const REMOVE_SELECTOR = [
  "script",
  "style",
  "noscript",
  "iframe",
  "object",
  "embed",
  "meta",
  "base",
  'link[rel="stylesheet"]',
  "form",
  "template",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "canvas",
  "svg",
  "video",
  "audio",
  "source",
  "track",
  "map",
  "area",
].join(",");

/** Avoid `Array.from`/spread on NodeList/HTMLCollection (TS may require downlevelIteration). */
function arrayLikeToArray<T>(arrayLike: ArrayLike<T>): T[] {
  const out: T[] = [];
  const len = arrayLike.length;
  for (let i = 0; i < len; i++) {
    out.push(arrayLike[i] as T);
  }
  return out;
}

function normalizeLessonMarkdown(s: string): string {
  return s
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
}

function inlineNodesToMd(nodes: NodeListOf<ChildNode> | ChildNode[]): string {
  const list = Array.isArray(nodes) ? nodes : arrayLikeToArray(nodes);
  let s = "";
  for (let i = 0; i < list.length; i++) {
    s += nodeToMarkdown(list[i]!);
  }
  return s;
}

function blockInline(el: Element): string {
  return inlineNodesToMd(el.childNodes).replace(/\s+/g, " ").trim();
}

function ulToMarkdown(el: Element, depth: number): string {
  const indent = "  ".repeat(depth);
  const items = arrayLikeToArray(el.children).filter((c) => c.tagName === "LI");
  let out = "";
  for (const li of items) {
    let main = "";
    let nested = "";
    const liKids = arrayLikeToArray(li.childNodes);
    for (let ci = 0; ci < liKids.length; ci++) {
      const child = liKids[ci]!;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        main += nodeToMarkdown(child);
        continue;
      }
      const tag = (child as Element).tagName;
      if (tag === "UL") nested += "\n" + ulToMarkdown(child as Element, depth + 1);
      else if (tag === "OL") nested += "\n" + olToMarkdown(child as Element, depth + 1);
      else main += nodeToMarkdown(child);
    }
    const line = `${indent}- ${(main + nested).trim()}\n`;
    out += line;
  }
  return out;
}

function olToMarkdown(el: Element, depth: number): string {
  const indent = "  ".repeat(depth);
  const items = arrayLikeToArray(el.children).filter((c) => c.tagName === "LI");
  let out = "";
  items.forEach((li, idx) => {
    let main = "";
    let nested = "";
    const liKids = arrayLikeToArray(li.childNodes);
    for (let ci = 0; ci < liKids.length; ci++) {
      const child = liKids[ci]!;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        main += nodeToMarkdown(child);
        continue;
      }
      const tag = (child as Element).tagName;
      if (tag === "UL") nested += "\n" + ulToMarkdown(child as Element, depth + 1);
      else if (tag === "OL") nested += "\n" + olToMarkdown(child as Element, depth + 1);
      else main += nodeToMarkdown(child);
    }
    const line = `${indent}${idx + 1}. ${(main + nested).trim()}\n`;
    out += line;
  });
  return out;
}

function tableToMarkdown(table: Element): string {
  const rows = table.querySelectorAll("tr");
  const lines: string[] = [];
  rows.forEach((tr) => {
    const cells = tr.querySelectorAll("th,td");
    const parts = arrayLikeToArray(cells).map((c) => {
      const t = inlineNodesToMd(c.childNodes)
        .replace(/\|/g, "\\|")
        .replace(/\s+/g, " ")
        .trim();
      return t || " ";
    });
    if (parts.length) lines.push(parts.join(" | "));
  });
  return lines.join("\n");
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as Element;
  const tag = el.tagName.toUpperCase();

  switch (tag) {
    case "SCRIPT":
    case "STYLE":
    case "NOSCRIPT":
      return "";
    case "BR":
      return "\n";
    case "HR":
      return "\n---\n\n";
    case "STRONG":
    case "B": {
      const inner = inlineNodesToMd(el.childNodes);
      if (!inner.trim()) return "";
      return `**${inner}**`;
    }
    case "EM":
    case "I": {
      const inner = inlineNodesToMd(el.childNodes);
      if (!inner.trim()) return "";
      return `*${inner}*`;
    }
    case "U": {
      const inner = inlineNodesToMd(el.childNodes);
      if (!inner.trim()) return "";
      return `<u>${inner}</u>`;
    }
    case "S":
    case "STRIKE":
    case "DEL": {
      const inner = inlineNodesToMd(el.childNodes);
      if (!inner.trim()) return "";
      return `~~${inner}~~`;
    }
    case "CODE": {
      if (el.parentElement?.tagName === "PRE") {
        return el.textContent ?? "";
      }
      const inner = el.textContent ?? "";
      if (!inner.trim()) return "";
      return `\`${inner.replace(/`/g, "'")}\``;
    }
    case "PRE": {
      const raw = el.textContent ?? "";
      return "```\n" + raw.replace(/\r\n/g, "\n") + "\n```\n\n";
    }
    case "A": {
      const href = (el.getAttribute("href") ?? "").trim();
      const inner = inlineNodesToMd(el.childNodes);
      if (/^https?:\/\//i.test(href)) {
        return `[${inner}](${href})`;
      }
      return inner;
    }
    case "IMG": {
      const alt = (el.getAttribute("alt") ?? "").trim();
      return alt ? `[image: ${alt}]` : "";
    }
    case "H1":
      return blockInline(el) ? `# ${blockInline(el)}\n\n` : "\n";
    case "H2":
      return blockInline(el) ? `## ${blockInline(el)}\n\n` : "\n";
    case "H3":
      return blockInline(el) ? `### ${blockInline(el)}\n\n` : "\n";
    case "H4":
      return blockInline(el) ? `#### ${blockInline(el)}\n\n` : "\n";
    case "H5":
      return blockInline(el) ? `##### ${blockInline(el)}\n\n` : "\n";
    case "H6":
      return blockInline(el) ? `###### ${blockInline(el)}\n\n` : "\n";
    case "BLOCKQUOTE": {
      const inner = inlineNodesToMd(el.childNodes).trim();
      if (!inner) return "\n";
      return (
        inner
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n") + "\n\n"
      );
    }
    case "UL":
      return ulToMarkdown(el, 0) + "\n";
    case "OL":
      return olToMarkdown(el, 0) + "\n";
    case "LI": {
      const inner = inlineNodesToMd(el.childNodes).trim();
      return inner ? `- ${inner}\n` : "";
    }
    case "TABLE":
      return tableToMarkdown(el) + "\n\n";
    case "TR":
    case "TBODY":
    case "THEAD":
    case "TFOOT":
      return inlineNodesToMd(el.childNodes);
    case "TH":
    case "TD":
      return inlineNodesToMd(el.childNodes) + " | ";
    case "SPAN":
    case "FONT":
    case "CENTER":
    case "SMALL":
    case "MARK":
    case "SUB":
    case "SUP":
      return inlineNodesToMd(el.childNodes);
    case "P":
    case "DIV":
    case "SECTION":
    case "ARTICLE":
    case "MAIN":
    case "HEADER":
    case "FOOTER":
    case "NAV":
    case "ASIDE":
    case "FIGURE":
    case "FIGCAPTION":
    case "DD":
    case "DT":
    case "DL": {
      const inner = inlineNodesToMd(el.childNodes);
      const t = inner.replace(/\u00a0/g, " ").trim();
      if (!t) return "";
      const inLi = el.parentElement?.tagName === "LI";
      if (inLi) return t + "\n";
      return t + "\n\n";
    }
    case "HTML":
    case "BODY":
      return inlineNodesToMd(el.childNodes);
    default:
      return inlineNodesToMd(el.childNodes);
  }
}

/**
 * Convert pasted HTML (Word, ChatGPT, browser) to lesson markdown.
 * Strips scripts/styles and unsafe embeds before walking the tree; output is markdown only.
 */
export function clipboardHtmlToLessonMarkdown(html: string): string {
  if (!html || !html.trim()) return "";
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  const doc = new DOMParser().parseFromString(cleaned, "text/html");
  doc.querySelectorAll(REMOVE_SELECTOR).forEach((n) => n.remove());
  const body = doc.body;
  if (!body) return "";
  const kids = arrayLikeToArray(body.childNodes);
  let raw = "";
  for (let i = 0; i < kids.length; i++) {
    raw += nodeToMarkdown(kids[i]!);
  }
  return normalizeLessonMarkdown(raw);
}

/**
 * Prefer HTML clipboard when present and converts to non-empty markdown; else plain-text transforms.
 * Returns null to let the browser perform default paste (plain text only in textarea).
 */
export function getLessonPasteInsertText(clipboardData: DataTransfer | null): { text: string } | null {
  if (!clipboardData) return null;
  const html = clipboardData.getData("text/html") ?? "";
  const plain = clipboardData.getData("text/plain") ?? "";

  if (html && /<[a-z]/i.test(html)) {
    const looksLikeCheckpointHtml =
      /<strong>\s*Question\s*<\/strong>/i.test(html) &&
      /<\s*(?:ul|ol)\b/i.test(html) &&
      /<\s*li\b/i.test(html);
    if (looksLikeCheckpointHtml) {
      const merged = [plain.trim(), html.trim()].filter(Boolean).join("\n\n");
      const cp = convertLegacyHtmlCheckpointExportToCanonicalPlain(merged);
      if (cp?.trim()) {
        return { text: collapseExactDuplicatePaste(cp) };
      }
    }
    const md = clipboardHtmlToLessonMarkdown(html);
    if (md.trim().length > 0) {
      return { text: collapseExactDuplicatePaste(md) };
    }
  }

  if (plain.trim()) {
    const collapsedPlain = collapseExactDuplicatePaste(plain);
    const { text, needsCustomInsert } = transformLessonPastedPlainText(collapsedPlain);
    /** Always route plain-text through programmatic insert so Create/Edit Lesson can classify structured blocks (checkpoint MCQ paste). */
    return { text: collapseExactDuplicatePaste(needsCustomInsert ? text : collapsedPlain) };
  }

  return null;
}

/** Used by "Paste and format lesson": raw buffer may be HTML or plain. */
export function pasteRawBufferToLessonMarkdown(raw: string): string {
  if (raw == null) return "";
  const s = String(raw);
  if (!s.trim()) return s;
  if (/<[a-z]/i.test(s)) {
    const looksLikeCheckpointHtml =
      /<strong>\s*Question\s*<\/strong>/i.test(s) &&
      /<\s*(?:ul|ol)\b/i.test(s) &&
      /<\s*li\b/i.test(s);
    if (looksLikeCheckpointHtml) {
      const cp = convertLegacyHtmlCheckpointExportToCanonicalPlain(s);
      if (cp?.trim()) return collapseExactDuplicatePaste(cp);
    }
    return collapseExactDuplicatePaste(clipboardHtmlToLessonMarkdown(s));
  }
  const { text, needsCustomInsert } = transformLessonPastedPlainText(s);
  return collapseExactDuplicatePaste(needsCustomInsert ? text : s);
}

const PASTE_GUARD_STRING_KEYS = [
  "content",
  "prompt",
  "explanation",
  "correctAnswer",
  "caption",
  "subtitle",
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
  if ("options" in out && out.options !== undefined) {
    const raw = Array.isArray(out.options)
      ? (out.options as unknown[]).map((o) =>
          typeof o === "string" ? collapseExactDuplicatePaste(o) : String(o ?? ""),
        )
      : [];
    out.options = [...coerceLessonMcqOptionsFour(raw)] as unknown as T[keyof T];
  }
  return out as T;
}
