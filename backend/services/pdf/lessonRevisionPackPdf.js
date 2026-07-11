/**
 * Lesson Revision Pack PDF — PDFKit export for a single lesson.
 * Structured rich text (headings/bullets/bold) + local-first diagram embedding.
 */
const PDFDocument = require("pdfkit");
const {
  resolveLessonImageForPdf,
  MAX_DIAGRAMS,
} = require("./resolveLessonImageForPdf");

/**
 * Separate safety cap for images embedded in prose/text blocks.
 * Does NOT share MAX_DIAGRAMS — diagram/activity images keep their own budget.
 */
const MAX_PROSE_IMAGES = 12;
/** Compact sizing for inline text-block images (smaller than Diagrams section). */
const PROSE_IMAGE_MAX_WIDTH = 200;
const PROSE_IMAGE_MAX_HEIGHT = 140;
const PROSE_COL_GAP = 14;
/** Minimum text column width required for side-by-side layout. */
const PROSE_SIDE_BY_SIDE_MIN_TEXT = 200;
/**
 * Diagrams section packing height (smaller than resolver IMAGE_MAX_HEIGHT so
 * more than one diagram can fit per page without huge blank regions).
 */
const DIAGRAM_SECTION_MAX_HEIGHT = 200;

const MARGIN = 50;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
/** Two-line footer: pack meta + copyright notice. */
const FOOTER_HEIGHT = 42;
const CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT;

const FONT_TITLE = 22;
const FONT_META = 11;
const FONT_SECTION = 14;
const FONT_HEADING = 13;
const FONT_BODY = 12;
const FONT_FOOTER = 8;
const FONT_FOOTER_COPYRIGHT = 7;
const LINE_GAP = 4;

/** WinAnsi-safe copyright line for every revision-pack PDF page. */
const REVISION_PACK_COPYRIGHT_NOTICE =
  "© 2026 LetsRevise. Personal study use only. Do not copy, share, upload or distribute.";


const toText = (v) => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(toText).filter(Boolean).join("\n");
  if (typeof v === "object") {
    if (typeof v.text === "string") return v.text;
    if (typeof v.content === "string") return v.content;
    if (typeof v.prompt === "string") return v.prompt;
    if (typeof v.question === "string") return v.question;
    if (typeof v.title === "string") return v.title;
    try {
      return JSON.stringify(v);
    } catch {
      return "";
    }
  }
  return String(v);
};

function decodeEntities(s) {
  return String(s || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

/**
 * Make lesson text safe for PDFKit Helvetica (WinAnsi).
 * Strips emoji / decorative symbols that otherwise render as garbage (e.g. Ø<ß¯),
 * while preserving GCSE science units and common Latin-1 characters (° , ² , ³).
 * @param {unknown} input
 * @param {{ trim?: boolean }} [opts]
 */
function sanitizePdfText(input, opts = {}) {
  let s = String(input == null ? "" : input);

  // Normalize newlines early
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Map Unicode subscripts used in chemistry to ASCII digits (Helvetica has no ₂).
  // Prefer readable CO2 / H2O over corrupted glyphs. Keep Latin-1 ²/³ (°C, cm³).
  const subMap = {
    "₀": "0",
    "₁": "1",
    "₂": "2",
    "₃": "3",
    "₄": "4",
    "₅": "5",
    "₆": "6",
    "₇": "7",
    "₈": "8",
    "₉": "9",
  };
  s = s.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (ch) => subMap[ch] || ch);

  // Decorative / directional arrows → simple hyphen
  s = s.replace(/[→←↔⇒⇐⟶⟵➔➜➝➞➡⬅⬆⬇⇄⇅]/g, "-");

  // Common emoji / pictographs → space (avoid gluing adjacent words)
  s = s.replace(
    /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F02F}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}]/gu,
    " "
  );
  // Variation selectors / ZWJ / combining enclosing keycap leftovers from emoji
  s = s.replace(/[\uFE0E\uFE0F\u200D\u20E3]/g, "");
  // Replacement / private-use / other non-printable junk often left after bad encoding
  s = s.replace(/\uFFFD/g, "");
  s = s.replace(/[\uE000-\uF8FF]/g, " ");
  // Zero-width / odd unicode spaces → normal space
  s = s.replace(/[\u200B-\u200F\u2028\u2029\u2060\uFEFF]/g, "");

  // Keep WinAnsi-safe text: letters, digits, common punctuation, Latin-1 supplements
  // (° £ ± ² ³ µ · × ÷ and accented letters), newlines, and basic spaces.
  // Replace (not delete) so words do not glue together when symbols are removed.
  s = s.replace(/[^\n\t\x20-\x7E\xA0-\xFF]/g, " ");

  // Tidy whitespace left by removals (preserve paragraph breaks)
  s = s
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  if (opts.trim !== false) {
    s = s.replace(/^[ \t]+|[ \t]+$/gm, "").trim();
  }
  return s;
}

/** Strip tags but keep text (for captions / single-line fields). */
function stripTags(s) {
  return sanitizePdfText(
    decodeEntities(s)
      .replace(/<\s*br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Convert common HTML into plain structured text before markdown cleanup. */
function htmlToPlainStructured(s) {
  return decodeEntities(toText(s))
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n\n")
    .replace(/<\s*p(\s[^>]*)?>/gi, "")
    .replace(/<\s*\/\s*h[1-6]\s*>/gi, "\n\n")
    .replace(/<\s*h[1-6](\s[^>]*)?>/gi, "\n\n")
    .replace(/<\s*li(\s[^>]*)?>/gi, "\n• ")
    .replace(/<\s*\/\s*li\s*>/gi, "")
    .replace(/<\s*\/?\s*(ul|ol)(\s[^>]*)?>/gi, "\n")
    .replace(/<\s*\/\s*(div|section|tr|td|th)\s*>/gi, "\n")
    .replace(/<\s*(div|section|tr|td|th)(\s[^>]*)?>/gi, "")
    .replace(/<\s*\/?\s*(strong|b|em|i|span|u)\s*>/gi, "")
    .replace(/<[^>]+>/g, "");
}

/** Strip HTML + markdown markers; collapse to a single line (captions, answers, stems). */
const stripMd = (s) =>
  sanitizePdfText(
    htmlToPlainStructured(s)
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#>*_`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );

/**
 * Strip HTML + markdown but keep paragraph/list structure for revision bullets.
 */
function stripMdKeepBreaks(s) {
  return sanitizePdfText(
    htmlToPlainStructured(s)
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#*_`]/g, "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Split multi-line / list-like lesson text into readable chunks (not one dense wall).
 */
function splitIntoReadableChunks(raw, maxLen = 600) {
  const cleaned = stripMdKeepBreaks(raw);
  if (!cleaned) return [];

  const parts = cleaned
    .split(/\n+|•\s+|(?:^|\n)\s*[-–]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const out = [];
  const pushChunk = (chunk) => {
    const t = String(chunk || "").trim();
    if (!t) return;
    if (t.length <= maxLen) {
      out.push(t);
      return;
    }
    const sentences = t.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [t];
    let buf = "";
    for (const sent of sentences) {
      const piece = sent.trim();
      if (!piece) continue;
      const next = buf ? `${buf} ${piece}` : piece;
      if (next.length <= maxLen) {
        buf = next;
      } else {
        if (buf) out.push(buf);
        buf = piece.slice(0, maxLen);
      }
    }
    if (buf) out.push(buf);
  };

  if (parts.length <= 1) {
    pushChunk(cleaned);
  } else {
    parts.forEach(pushChunk);
  }
  return out;
}

/** Strip tags for inline runs — collapse whitespace but keep edge spaces between runs. */
function cleanInlineFragment(s) {
  return decodeEntities(s)
    .replace(/<\s*br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t\r\n]+/g, " ");
}

/**
 * Parse inline HTML/markdown bold into PDFKit text runs.
 * @returns {{ text: string, runs?: Array<{ text: string, bold: boolean }> }}
 */
function parseInlineRuns(htmlish, maxLen = 600) {
  let s = decodeEntities(toText(htmlish));
  s = s.replace(/!\[[^\]]*\]\([^)]+\)/g, "");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/<\s*\/?\s*(em|i|span|u)(\s[^>]*)?>/gi, "");

  const runs = [];
  const re = /<\s*(strong|b)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi;
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    const before = cleanInlineFragment(s.slice(last, m.index));
    if (before) runs.push({ text: before, bold: false });
    const bold = cleanInlineFragment(m[2] || "").trim();
    if (bold) runs.push({ text: bold, bold: true });
    last = m.index + m[0].length;
  }
  const rest = cleanInlineFragment(s.slice(last));
  if (rest) runs.push({ text: rest, bold: false });

  // Trim only the outer edges of the first/last runs so "Explain" + " secondary" stays spaced.
  if (runs.length) {
    runs[0].text = runs[0].text.replace(/^\s+/, "");
    runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, "");
  }

  // Sanitize each run without trimming — spaces between plain/bold runs must survive.
  const cleanedRuns = [];
  for (const r of runs) {
    const t = sanitizePdfText(r.text, { trim: false });
    if (!String(t).trim()) continue; // drop emoji-only / empty runs
    cleanedRuns.push({ text: t, bold: !!r.bold });
  }
  if (cleanedRuns.length) {
    cleanedRuns[0].text = cleanedRuns[0].text.replace(/^\s+/, "");
    cleanedRuns[cleanedRuns.length - 1].text = cleanedRuns[cleanedRuns.length - 1].text.replace(/\s+$/, "");
  }
  // If sanitising removed a symbol between two word characters, keep a separating space.
  for (let i = 1; i < cleanedRuns.length; i++) {
    const prev = cleanedRuns[i - 1].text;
    const cur = cleanedRuns[i].text;
    if (/\S$/.test(prev) && /^\S/.test(cur)) {
      cleanedRuns[i - 1].text = `${prev} `;
    }
  }

  let text = cleanedRuns
    .map((r) => r.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  text = sanitizePdfText(text);
  if (text.length > maxLen) {
    text = text.slice(0, maxLen);
  }
  const hasBold = cleanedRuns.some((r) => r.bold);
  if (!hasBold) return { text };
  // Re-slice runs to maxLen roughly
  let used = 0;
  const clipped = [];
  for (const r of cleanedRuns) {
    if (used >= maxLen) break;
    if (!r.text) continue;
    const room = maxLen - used;
    const piece = r.text.slice(0, room);
    if (piece) clipped.push({ text: piece, bold: r.bold });
    used += piece.length;
  }
  return { text, runs: clipped };
}

function makeSegment(type, htmlInner, opts = {}) {
  const maxLen = opts.maxLen != null ? opts.maxLen : 600;
  const { text, runs } = parseInlineRuns(htmlInner, maxLen);
  if (!text) return null;
  const seg = { type, text };
  if (runs) seg.runs = runs;
  if (type === "numbered" && opts.n != null) seg.n = opts.n;
  // Short all-bold paragraph → boldLabel
  if (
    type === "paragraph" &&
    runs &&
    runs.length === 1 &&
    runs[0].bold &&
    text.length <= 80
  ) {
    return { type: "boldLabel", text };
  }
  return seg;
}

/**
 * Convert stored HTML / Markdown / plain text into typed PDF segments.
 * Types: heading | paragraph | bullet | numbered | boldLabel
 */
function parseContentToSegments(raw, maxLen = 600) {
  let s = decodeEntities(toText(raw));
  if (!s.trim()) return [];

  s = s.replace(/\r\n/g, "\n");
  s = s.replace(/!\[[^\]]*\]\([^)]+\)/g, "");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Markdown headings / bullets / bold → HTML-ish
  s = s.replace(/^#{1,3}\s+(.+)$/gm, (_, t) => `<h3>${t.trim()}</h3>`);
  s = s.replace(/^\s*[-*–]\s+(.+)$/gm, (_, t) => `<li>${t.trim()}</li>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/<\s*br\s*\/?>/gi, "\n");

  const segments = [];
  const push = (type, inner, extra) => {
    const seg = makeSegment(type, inner, { maxLen, ...(extra || {}) });
    if (seg) segments.push(seg);
  };

  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);

    const hMatch = rest.match(/^<\s*h([1-6])(?:\s[^>]*)?>([\s\S]*?)<\s*\/\s*h\1\s*>/i);
    if (hMatch) {
      push("heading", hMatch[2]);
      i += hMatch[0].length;
      continue;
    }

    const pMatch = rest.match(/^<\s*p(?:\s[^>]*)?>([\s\S]*?)<\s*\/\s*p\s*>/i);
    if (pMatch) {
      push("paragraph", pMatch[1]);
      i += pMatch[0].length;
      continue;
    }

    const olMatch = rest.match(/^<\s*ol(?:\s[^>]*)?>([\s\S]*?)<\s*\/\s*ol\s*>/i);
    if (olMatch) {
      let n = 0;
      const inner = olMatch[1];
      const liRe = /<\s*li(?:\s[^>]*)?>([\s\S]*?)<\s*\/\s*li\s*>/gi;
      let lm;
      while ((lm = liRe.exec(inner))) {
        n += 1;
        push("numbered", lm[1], { n });
      }
      i += olMatch[0].length;
      continue;
    }

    const ulMatch = rest.match(/^<\s*ul(?:\s[^>]*)?>([\s\S]*?)<\s*\/\s*ul\s*>/i);
    if (ulMatch) {
      const inner = ulMatch[1];
      const liRe = /<\s*li(?:\s[^>]*)?>([\s\S]*?)<\s*\/\s*li\s*>/gi;
      let lm;
      while ((lm = liRe.exec(inner))) {
        push("bullet", lm[1]);
      }
      i += ulMatch[0].length;
      continue;
    }

    const liMatch = rest.match(/^<\s*li(?:\s[^>]*)?>([\s\S]*?)<\s*\/\s*li\s*>/i);
    if (liMatch) {
      push("bullet", liMatch[1]);
      i += liMatch[0].length;
      continue;
    }

    // Skip structural/unknown block tags only — keep inline tags (strong/b/…) in plain chunks.
    const blockTag = rest.match(/^<\s*\/?\s*(div|section|article|header|footer|tr|td|th|table|thead|tbody)(?:\s[^>]*)?\s*\/?>/i);
    if (blockTag) {
      i += blockTag[0].length;
      continue;
    }

    // Plain / inline-rich text until next block-level tag or blank line
    const nextBlock = rest.search(/<\s*\/?\s*(h[1-6]|p|ul|ol|li|div|section)\b/i);
    const nextBreak = rest.search(/\n\n/);
    let end = rest.length;
    if (nextBlock >= 0) end = Math.min(end, nextBlock);
    if (nextBreak >= 0) end = Math.min(end, nextBreak === 0 ? 2 : nextBreak);

    let chunk = rest.slice(0, end);
    if (nextBreak === 0) {
      i += 2;
      continue;
    }
    // Avoid infinite loop on a lone '<' that is not a block tag
    if (end === 0) {
      i += 1;
      continue;
    }
    i += chunk.length;

    chunk = chunk.replace(/\n+/g, " ").trim();
    if (!chunk) continue;

    if (/^•\s+/.test(chunk) || /^[-–]\s+/.test(chunk)) {
      push("bullet", chunk.replace(/^•\s+/, "").replace(/^[-–]\s+/, ""));
    } else {
      const num = chunk.match(/^(\d+)\.\s+([\s\S]+)/);
      if (num) push("numbered", num[2], { n: Number(num[1]) });
      else push("paragraph", chunk);
    }
  }

  // Fallback: if parser produced nothing, use chunk splitter
  if (segments.length === 0) {
    splitIntoReadableChunks(raw, maxLen).forEach((line) => {
      push("bullet", line);
    });
  }

  return segments;
}

/** Plain text from a segment or string (for tests / search). */
function segmentText(seg) {
  if (seg == null) return "";
  if (typeof seg === "string") return seg;
  if (seg.type === "proseImage") return "";
  if (seg.type === "proseBlock") {
    const title = String(seg.title || "").trim();
    const body = (Array.isArray(seg.textSegments) ? seg.textSegments : [])
      .map(segmentText)
      .filter(Boolean)
      .join("\n");
    return [title, body].filter(Boolean).join("\n");
  }
  return String(seg.text || "");
}

const safeSlice = (v, n) => stripMd(v).slice(0, n);

function ensureSpace(doc, neededHeight) {
  const need = Math.max(12, Number(neededHeight) || 12);
  if (doc.y + need > CONTENT_BOTTOM) {
    doc.addPage();
  }
}

/** Page-break using measured text height when practical. */
function ensureTextSpace(doc, text, opts = {}) {
  const width = opts.width != null ? opts.width : CONTENT_WIDTH;
  const fontSize = opts.fontSize != null ? opts.fontSize : FONT_BODY;
  const lineGap = opts.lineGap != null ? opts.lineGap : LINE_GAP;
  const extra = opts.extra != null ? opts.extra : 10;
  const prevSize = doc._fontSize;
  doc.fontSize(fontSize);
  const h = doc.heightOfString(String(text || " "), { width, lineGap }) + extra;
  if (prevSize) doc.fontSize(prevSize);
  ensureSpace(doc, Math.min(h, CONTENT_BOTTOM - MARGIN - 40));
}

/** Keep heading with intro + first bullets (orphan prevention). */
const HEADING_KEEP_MIN_BULLETS = 3;
const HEADING_KEEP_MAX_SEGMENTS = 5;
/** Approx body line height including moveDown / ensureTextSpace padding. */
const HEADING_KEEP_BODY_LINE = FONT_BODY + LINE_GAP + 14;

/**
 * Collect following content after a heading for keep-with-next:
 * optional short intro paragraph/label, then first 2–3 bullets/numbered items.
 * Stops at the next heading.
 * @param {Array} segments
 * @param {number} headingIndex
 * @returns {Array<{ kind: string, text: string }>}
 */
function collectFollowingContentForHeading(segments, headingIndex) {
  const list = Array.isArray(segments) ? segments : [];
  const out = [];
  let bullets = 0;
  let introTaken = false;

  for (let i = headingIndex + 1; i < list.length; i++) {
    if (out.length >= HEADING_KEEP_MAX_SEGMENTS) break;
    const seg = list[i];

    if (typeof seg === "string") {
      const t = stripMd(seg);
      if (!t) continue;
      out.push({ kind: "bullet", text: `• ${t}` });
      bullets += 1;
      if (bullets >= HEADING_KEEP_MIN_BULLETS) break;
      continue;
    }

    const type = seg?.type || "heading";
    if (type === "heading") break;
    if (type === "proseImage" || type === "proseBlock") break;

    const text = segmentText(seg);
    if (!text) continue;

    if (type === "bullet" || type === "numbered") {
      const prefix = type === "numbered" ? `${seg.n != null ? seg.n : 1}. ` : "• ";
      out.push({ kind: type, text: `${prefix}${text}` });
      bullets += 1;
      if (bullets >= HEADING_KEEP_MIN_BULLETS) break;
      continue;
    }

    // paragraph / boldLabel — treat as intro; take at most one before bullets
    if (bullets > 0) break;
    if (introTaken) break;
    out.push({ kind: type === "boldLabel" ? "boldLabel" : "paragraph", text });
    introTaken = true;
  }

  return out;
}

/** @deprecated use collectFollowingContentForHeading — kept for tests that expect line strings */
function collectFollowingLinesForHeading(segments, headingIndex, maxLines = HEADING_KEEP_MAX_SEGMENTS) {
  return collectFollowingContentForHeading(segments, headingIndex)
    .slice(0, maxLines)
    .map((x) => x.text);
}

/**
 * Ensure room for a main heading plus intro paragraph (if any) and first bullets.
 * If that group does not fit, start a new page before the heading.
 * Does not force every heading onto a new page when space is available.
 * @param {PDFKit.PDFDocument} doc
 * @param {string} headingText
 * @param {Array<{ kind?: string, text: string }>|string[]} [following]
 * @param {{ fontSize?: number }} [opts]
 */
function ensureHeadingKeepWithContent(doc, headingText, following = [], opts = {}) {
  const headingSize = opts.fontSize != null ? opts.fontSize : FONT_HEADING;
  const prevSize = doc._fontSize;

  doc.fontSize(headingSize).font("Helvetica-Bold");
  const headingH =
    doc.heightOfString(String(headingText || "Heading"), {
      width: CONTENT_WIDTH,
      lineGap: LINE_GAP,
    }) + 16;

  const items = (Array.isArray(following) ? following : [])
    .map((x) => (typeof x === "string" ? { text: x } : x))
    .filter((x) => x && String(x.text || "").trim())
    .slice(0, HEADING_KEEP_MAX_SEGMENTS);

  doc.fontSize(FONT_BODY).font("Helvetica");
  let followH = 0;
  if (items.length === 0) {
    // No following segment — still leave room for a few body lines.
    followH = HEADING_KEEP_BODY_LINE * 3;
  } else {
    for (const item of items) {
      const width = String(item.kind || "").match(/bullet|numbered/) ? CONTENT_WIDTH - 10 : CONTENT_WIDTH;
      followH +=
        doc.heightOfString(String(item.text || " "), {
          width,
          lineGap: LINE_GAP,
        }) + 16;
    }
    // Floor: intro (~1–2 lines) + 3 bullet lines so heading+intro alone cannot "fit"
    // while the list spills to the next page.
    const hasIntro = items.some((x) => x.kind === "paragraph" || x.kind === "boldLabel");
    const bulletCount = items.filter((x) => x.kind === "bullet" || x.kind === "numbered").length;
    const minLines = (hasIntro ? 2 : 0) + Math.max(bulletCount, Math.min(3, items.length)) ;
    const minFollow = HEADING_KEEP_BODY_LINE * Math.max(4, minLines);
    followH = Math.max(followH, minFollow);
  }

  // Cap so a long section does not reserve an entire page (~7 body lines).
  followH = Math.min(followH, HEADING_KEEP_BODY_LINE * 7);

  if (prevSize) doc.fontSize(prevSize);

  ensureSpace(doc, headingH + followH);
}

function addFooter(doc, meta) {
  const { slug, dateStr, pageNum } = meta;
  const footerBaseY = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT + 6;
  doc.fontSize(FONT_FOOTER).font("Helvetica").fillColor("#94a3b8");
  const footerText = `LetsRevise - Revision pack - ${toText(slug)} - ${dateStr} - Page ${pageNum}`;
  doc.text(footerText, MARGIN, footerBaseY, { width: CONTENT_WIDTH, align: "center", lineBreak: false });
  doc.fontSize(FONT_FOOTER_COPYRIGHT).font("Helvetica").fillColor("#94a3b8");
  doc.text(REVISION_PACK_COPYRIGHT_NOTICE, MARGIN, footerBaseY + 11, {
    width: CONTENT_WIDTH,
    align: "center",
    lineBreak: false,
  });
}

function addSectionHeader(doc, text) {
  const label = toText(text);
  // Pack section titles are major headings — keep with a few lines of following content.
  ensureHeadingKeepWithContent(doc, label, [], { fontSize: FONT_SECTION });
  doc.fontSize(FONT_SECTION).font("Helvetica-Bold").fillColor("#1e293b");
  doc.text(label, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: LINE_GAP });
  doc.moveDown(0.55);
}

function addParagraph(doc, text) {
  const t = stripMd(text);
  if (!t) return;
  ensureTextSpace(doc, t, { fontSize: FONT_BODY, lineGap: LINE_GAP, extra: 12 });
  doc.fontSize(FONT_BODY).font("Helvetica").fillColor("#334155");
  doc.text(t, MARGIN, doc.y, { width: CONTENT_WIDTH, align: "left", lineGap: LINE_GAP });
  doc.moveDown(0.65);
}

function addBullets(doc, items, maxLen = 600) {
  if (!Array.isArray(items) || items.length === 0) return;
  items.forEach((item) => {
    const line = `• ${safeSlice(typeof item === "string" ? item : segmentText(item), maxLen)}`;
    if (line === "• ") return;
    ensureTextSpace(doc, line, { width: CONTENT_WIDTH - 10, fontSize: FONT_BODY, lineGap: LINE_GAP, extra: 12 });
    doc.fontSize(FONT_BODY).font("Helvetica").fillColor("#334155");
    doc.text(line, MARGIN, doc.y, { width: CONTENT_WIDTH - 10, indent: 10, lineGap: LINE_GAP });
    doc.moveDown(0.45);
  });
  doc.moveDown(0.35);
}

/**
 * Render text with optional bold runs (PDFKit continued).
 */
function addRichLine(doc, prefix, text, runs, opts = {}) {
  const indent = opts.indent != null ? opts.indent : 0;
  const fontSize = opts.fontSize != null ? opts.fontSize : FONT_BODY;
  const boldAll = opts.boldAll === true;
  const color = opts.color || "#334155";
  const width = CONTENT_WIDTH - indent;
  const full = `${prefix || ""}${text || ""}`;
  if (!String(text || "").trim() && !prefix) return;

  ensureTextSpace(doc, full, { width, fontSize, lineGap: LINE_GAP, extra: 12 });
  doc.fontSize(fontSize).fillColor(color);

  const x = MARGIN + indent;
  const y = doc.y;

  // Mixed bold via continued text is fragile in PDFKit (often splits onto new lines).
  // Prefer: bold-all when requested, else a single plain line (bold words still present as text).
  // If there is exactly one bold run and it is a short label, bold that whole line for emphasis.
  const usableRuns = Array.isArray(runs) ? runs.filter((r) => r && String(r.text || "").length) : [];
  const boldRuns = usableRuns.filter((r) => r.bold);
  const shortLabelBold =
    !boldAll &&
    boldRuns.length === 1 &&
    String(boldRuns[0].text || "").trim().length <= 40 &&
    usableRuns.length <= 3;

  if (boldAll || shortLabelBold || usableRuns.length === 0) {
    doc.font(boldAll || shortLabelBold ? "Helvetica-Bold" : "Helvetica").text(full, x, y, {
      width,
      lineGap: LINE_GAP,
    });
    doc.moveDown(opts.moveDown != null ? opts.moveDown : 0.4);
    return;
  }

  // Fallback: plain body (no raw markers); emphasis already reflected in segment headings elsewhere.
  doc.font("Helvetica").text(full, x, y, { width, lineGap: LINE_GAP });
  doc.moveDown(opts.moveDown != null ? opts.moveDown : 0.4);
}

function addSegments(doc, segments) {
  if (!Array.isArray(segments) || segments.length === 0) return;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (typeof seg === "string") {
      addBullets(doc, [seg]);
      continue;
    }
    const type = seg.type || "paragraph";
    if (type === "proseBlock") {
      addProseBlockGrouped(doc, seg);
      continue;
    }
    if (type === "proseImage") {
      // Legacy detached marker — keep-with via ensureSpace only (prefer proseBlock).
      addProseImageBelow(doc, seg);
      continue;
    }
    const text = segmentText(seg);
    if (!text) continue;

    if (type === "heading") {
      const following = collectFollowingContentForHeading(segments, i);
      ensureHeadingKeepWithContent(doc, text, following);
      doc.fontSize(FONT_HEADING).font("Helvetica-Bold").fillColor("#1e293b");
      doc.text(text, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: LINE_GAP });
      doc.moveDown(0.45);
      continue;
    }
    if (type === "boldLabel") {
      // Short labels — do not apply aggressive keep-with-next (avoids extra page breaks).
      addRichLine(doc, "", text, null, { boldAll: true, color: "#1e293b", moveDown: 0.35 });
      continue;
    }
    if (type === "bullet") {
      addRichLine(doc, "• ", text, seg.runs, { indent: 10, moveDown: 0.35 });
      continue;
    }
    if (type === "numbered") {
      const n = seg.n != null ? seg.n : 1;
      addRichLine(doc, `${n}. `, text, seg.runs, { indent: 10, moveDown: 0.35 });
      continue;
    }
    // paragraph
    addRichLine(doc, "", text, seg.runs, { indent: 0, moveDown: 0.5 });
  }
  doc.moveDown(0.25);
}

/**
 * Pre-resolve diagram image sources (local path or allowlisted remote buffer).
 * Caps at MAX_DIAGRAMS. Never throws.
 * @param {Array} diagrams
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
async function resolveDiagramEntries(diagrams, opts = {}) {
  const list = Array.isArray(diagrams) ? diagrams : [];
  const out = [];
  for (const d of list) {
    if (out.length >= MAX_DIAGRAMS) break;
    const caption =
      typeof d === "string" ? stripMd(d) : stripMd(d?.caption || d?.alt || "Diagram");
    const imageUrl = typeof d === "string" ? "" : String(d?.imageUrl || d?.src || "").trim();
    let source = null;
    if (imageUrl) {
      try {
        source = await resolveLessonImageForPdf(imageUrl, opts);
      } catch {
        source = null;
      }
    }
    out.push({ caption, imageUrl, source });
  }
  return out;
}

/**
 * Embed diagram images from pre-resolved sources. Never throws.
 * @param {PDFKit.PDFDocument} doc
 * @param {Array<{ caption: string, imageUrl: string, source: object|null }>} entries
 */
function addDiagramSection(doc, entries) {
  if (!Array.isArray(entries) || entries.length === 0) return;
  doc.moveDown(0.2);
  addSectionHeader(doc, "Diagrams");

  let embedded = 0;
  for (const entry of entries) {
    if (embedded >= MAX_DIAGRAMS) break;

    const caption = stripMd(entry?.caption || "Diagram");
    const imageUrl = String(entry?.imageUrl || "").trim();
    const source = entry?.source || null;

    let imgW = 0;
    let imgH = 0;
    let img = null;
    if (source) {
      try {
        const openTarget = source.kind === "buffer" ? source.buffer : source.path;
        if (openTarget) {
          img = doc.openImage(openTarget);
          const scale = Math.min(
            CONTENT_WIDTH / img.width,
            DIAGRAM_SECTION_MAX_HEIGHT / img.height,
            1
          );
          imgW = Math.max(1, img.width * scale);
          imgH = Math.max(1, img.height * scale);
        }
      } catch {
        img = null;
      }
    }

    // Keep caption + image together; use real scaled height (not oversized reserve).
    const captionH = caption ? 22 : 0;
    const blockH = captionH + (img ? imgH + 10 : 20);
    ensureSpace(doc, blockH);

    if (caption) {
      doc.fontSize(FONT_BODY).font("Helvetica-Bold").fillColor("#1e293b");
      doc.text(caption, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: LINE_GAP });
      doc.moveDown(0.15);
    }

    let drew = false;
    if (img) {
      try {
        const x = MARGIN + (CONTENT_WIDTH - imgW) / 2;
        doc.image(img, x, doc.y, { width: imgW, height: imgH });
        doc.y += imgH + 6;
        drew = true;
        embedded += 1;
      } catch {
        drew = false;
      }
    }

    if (!drew) {
      doc.fontSize(FONT_BODY).font("Helvetica").fillColor("#94a3b8");
      doc.text("[Diagram unavailable]", MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.35);
      if (imageUrl) embedded += 1;
    } else {
      doc.moveDown(0.2);
    }
  }
}

function blockType(b) {
  return String(b?.type || b?.blockType || "").toLowerCase().replace(/[_\s-]/g, "");
}

function blockRawText(b) {
  return b?.content || b?.text || b?.prompt || b?.title || "";
}

function blockBody(b) {
  return stripMd(blockRawText(b));
}

function pushSegments(target, raw, maxLen = 600) {
  parseContentToSegments(raw, maxLen).forEach((seg) => {
    if (seg) target.push(seg);
  });
}

function diagramImageUrl(b) {
  return String(b?.imageUrl || b?.src || b?.url || b?.visualUrl || "").trim();
}

/**
 * Extract the first image URL from prose block content (before stripMd).
 * V1: prefer a standalone markdown image line (same rule as student V12 splitter),
 * then fall back to the first HTML <img src="...">.
 * @param {unknown} raw
 * @returns {{ imageUrl: string, alt: string } | null}
 */
function extractFirstProseImage(raw) {
  const s = String(raw ?? "");
  if (!s.trim()) return null;

  const lines = s.split(/\r?\n/);
  for (const line of lines) {
    const md = line.match(/^\s*!\[([^\]]*)\]\(([^)\s]+)\)\s*$/);
    if (!md) continue;
    const imageUrl = String(md[2] || "").trim();
    if (!imageUrl) continue;
    return { imageUrl, alt: String(md[1] || "").trim() };
  }

  const html = s.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i);
  if (html) {
    const imageUrl = String(html[1] || "").trim();
    if (imageUrl) return { imageUrl, alt: "" };
  }
  return null;
}

/** Text-like block types that may embed a markdown/HTML image in content. */
function isProseKeyLearningType(t) {
  return (
    t === "text" ||
    t === "keyidea" ||
    t === "keyideas" ||
    t === "stretch" ||
    t === "deeperknowledge" ||
    t === "hook" ||
    t === "workedexample" ||
    t === "summary" ||
    t === "whythismatters" ||
    t === "whythismatter"
  );
}

/**
 * Remove embedded markdown/HTML images from prose content before text parsing.
 * @param {unknown} raw
 */
function stripEmbeddedImagesFromContent(raw) {
  return String(raw ?? "")
    .replace(/^\s*!\[[^\]]*\]\([^)]+\)\s*$/gm, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Display title for a prose block in the PDF (e.g. `3 — DEFINITION`).
 * @param {object} b
 */
function formatProseBlockTitle(b) {
  const title = stripMd(b?.title || "");
  const n = b?.number;
  if (typeof n === "number" && Number.isFinite(n) && n > 0 && title) {
    return `${Math.trunc(n)} — ${title}`;
  }
  return title;
}

/**
 * Pure layout helper: whether side-by-side fits for a given image width.
 * @param {number} imgW
 */
function canUseProseSideBySide(imgW) {
  const w = Number(imgW) || 0;
  if (w <= 0) return false;
  return CONTENT_WIDTH - w - PROSE_COL_GAP >= PROSE_SIDE_BY_SIDE_MIN_TEXT;
}

/**
 * Scale a prose image to compact text-block constraints (not full diagram size).
 * @param {{ width: number, height: number }} img
 */
function scaleProseImageSize(img) {
  const iw = Math.max(1, Number(img?.width) || 1);
  const ih = Math.max(1, Number(img?.height) || 1);
  const scale = Math.min(PROSE_IMAGE_MAX_WIDTH / iw, PROSE_IMAGE_MAX_HEIGHT / ih, 1);
  return {
    imgW: Math.max(1, iw * scale),
    imgH: Math.max(1, ih * scale),
  };
}

/**
 * Minimum height to keep heading + image (+ a little text) together.
 * Intentionally tight so blocks stay on the current page when they fit —
 * do NOT reserve full paragraph height (that caused Page-1 whitespace).
 * @param {PDFKit.PDFDocument} doc
 * @param {{ title?: string, textSegments?: Array }} block
 * @param {{ imgW: number, imgH: number }|null} imgSize
 */
function estimateProseBlockMinHeight(doc, block, imgSize) {
  const title = String(block?.title || "").trim();
  const textSegs = Array.isArray(block?.textSegments) ? block.textSegments : [];
  const prevSize = doc._fontSize;
  let h = 6;

  if (title) {
    doc.fontSize(FONT_HEADING).font("Helvetica-Bold");
    h +=
      doc.heightOfString(title, { width: CONTENT_WIDTH, lineGap: LINE_GAP }) + 6;
  }

  const imgH = imgSize?.imgH || 0;
  const imgW = imgSize?.imgW || 0;
  const sideBySide = imgSize && canUseProseSideBySide(imgW);

  doc.fontSize(FONT_BODY).font("Helvetica");
  // Only the first short line matters for keep-with (rest can continue below).
  let firstLineH = FONT_BODY + 4;
  for (const seg of textSegs) {
    const t = segmentText(seg);
    if (!t) continue;
    const prefix =
      seg?.type === "bullet" ? "• " : seg?.type === "numbered" ? "1. " : "";
    const sample = `${prefix}${t}`.slice(0, 90);
    const textWidth = sideBySide ? CONTENT_WIDTH - imgW - PROSE_COL_GAP : CONTENT_WIDTH;
    firstLineH = Math.min(
      40,
      doc.heightOfString(sample, { width: textWidth, lineGap: LINE_GAP }) + 4
    );
    break;
  }

  if (sideBySide) {
    // Text sits beside the image — reserve title + image row only.
    h += imgH + 8;
  } else if (imgH) {
    h += imgH + firstLineH + 10;
  } else {
    h += firstLineH + 6;
  }

  doc.fontSize(prevSize || FONT_BODY);
  return h;
}

/**
 * True when a prose block's keep-with height fits in remaining page space.
 * @param {PDFKit.PDFDocument} doc
 * @param {number} minH
 */
function proseBlockFitsRemaining(doc, minH) {
  const need = Math.max(12, Number(minH) || 12);
  return doc.y + need <= CONTENT_BOTTOM;
}

/**
 * Push a grouped prose unit (title + text + optional image) or plain text segments.
 * @param {Array} target
 * @param {object} b
 * @param {number} maxLen
 * @param {{ count: number, seen: Set<string> }} tracker
 */
function pushProseBlockWithImage(target, b, maxLen, tracker) {
  const raw = blockRawText(b);
  const extracted = extractFirstProseImage(raw);
  const title = formatProseBlockTitle(b);
  const textRaw = stripEmbeddedImagesFromContent(raw);

  // No image (or prose cap reached) → legacy flat text stream (titles come from content).
  if (!extracted?.imageUrl || !tracker || tracker.count >= MAX_PROSE_IMAGES) {
    pushSegments(target, raw, maxLen);
    return;
  }

  const url = extracted.imageUrl;
  if (tracker.seen.has(url)) {
    pushSegments(target, textRaw || raw, maxLen);
    return;
  }

  tracker.seen.add(url);
  tracker.count += 1;

  const textSegments = [];
  parseContentToSegments(textRaw, maxLen).forEach((seg) => {
    if (seg) textSegments.push(seg);
  });

  // Drop a content heading that merely repeats the block title.
  let segs = textSegments;
  if (title && segs[0]?.type === "heading") {
    const h = stripMd(segs[0].text || "").toLowerCase();
    const t = title.replace(/^\d+\s*[\u2014\u2013\-]\s*/, "").toLowerCase();
    if (h === t || h === title.toLowerCase()) {
      segs = segs.slice(1);
    }
  }

  target.push({
    type: "proseBlock",
    title,
    textSegments: segs,
    imageUrl: url,
    alt: extracted.alt || "",
  });
}

/**
 * Normalise image URLs for dedupe (protocol/host case, path separators, decode).
 * @param {unknown} url
 */
function normalizeImageUrlForDedupe(url) {
  let s = String(url ?? "").trim();
  if (!s) return "";
  try {
    if (s.includes("%")) s = decodeURIComponent(s);
  } catch {
    /* keep */
  }
  s = s.replace(/\\/g, "/");
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      return `${u.protocol}//${u.host.toLowerCase()}${u.pathname}`;
    }
  } catch {
    /* fall through */
  }
  return s.toLowerCase();
}

/** Collect image URLs already assigned to prose blocks. */
function collectProseImageUrls(segmentLists) {
  const urls = new Set();
  for (const list of segmentLists || []) {
    for (const seg of Array.isArray(list) ? list : []) {
      if (!seg) continue;
      if (seg.type === "proseBlock" || seg.type === "proseImage") {
        const n = normalizeImageUrlForDedupe(seg.imageUrl);
        if (n) urls.add(n);
      }
    }
  }
  return urls;
}

/**
 * Drop Diagrams entries whose URL was already rendered beside prose text.
 * Keeps activity/diagram-only images that were never shown as prose.
 * @param {Array} diagrams
 * @param {Set<string>} proseUrlSet
 */
function pruneDiagramsAlreadyShownAsProse(diagrams, proseUrlSet) {
  const list = Array.isArray(diagrams) ? diagrams : [];
  if (!proseUrlSet || proseUrlSet.size === 0) return list;
  return list.filter((d) => {
    const n = normalizeImageUrlForDedupe(d?.imageUrl || d?.src || "");
    if (!n) return true;
    return !proseUrlSet.has(n);
  });
}

/**
 * Resolve proseBlock / legacy proseImage sources via the shared safe resolver.
 * Unresolvable images are dropped (text/title remain; PDF stays valid).
 * @param {Array} segments
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
async function resolveProseImageSegments(segments, opts = {}) {
  const list = Array.isArray(segments) ? segments : [];
  const out = [];
  let embedded = 0;
  for (const seg of list) {
    if (!seg) continue;
    if (seg.type === "proseBlock") {
      const imageUrl = String(seg.imageUrl || "").trim();
      if (!imageUrl || embedded >= MAX_PROSE_IMAGES) {
        out.push({ ...seg, imageUrl: "", source: null });
        continue;
      }
      let source = null;
      try {
        source = await resolveLessonImageForPdf(imageUrl, opts);
      } catch {
        source = null;
      }
      if (!source) {
        out.push({ ...seg, imageUrl: "", source: null });
        continue;
      }
      out.push({ ...seg, source });
      embedded += 1;
      continue;
    }
    if (seg.type !== "proseImage") {
      out.push(seg);
      continue;
    }
    if (embedded >= MAX_PROSE_IMAGES) continue;
    const imageUrl = String(seg.imageUrl || "").trim();
    if (!imageUrl) continue;
    let source = null;
    try {
      source = await resolveLessonImageForPdf(imageUrl, opts);
    } catch {
      source = null;
    }
    if (!source) continue;
    out.push({ ...seg, source });
    embedded += 1;
  }
  return out;
}

/**
 * Open + scale a prose image. Returns null on failure.
 * @param {PDFKit.PDFDocument} doc
 * @param {{ kind?: string, path?: string, buffer?: Buffer }|null} source
 */
function openScaledProseImage(doc, source) {
  if (!source) return null;
  try {
    const openTarget = source.kind === "buffer" ? source.buffer : source.path;
    if (!openTarget) return null;
    const img = doc.openImage(openTarget);
    const { imgW, imgH } = scaleProseImageSize(img);
    return { img, imgW, imgH };
  } catch {
    return null;
  }
}

/**
 * Render text segments into a column. Returns the y after the last line.
 * @param {PDFKit.PDFDocument} doc
 * @param {Array} segments
 * @param {{ x: number, width: number, startY: number }} box
 */
function renderTextSegmentsInBox(doc, segments, box) {
  const x = box.x;
  const width = box.width;
  let y = box.startY;
  const list = Array.isArray(segments) ? segments : [];

  for (const seg of list) {
    if (!seg) continue;
    if (typeof seg === "string") {
      const t = stripMd(seg);
      if (!t) continue;
      doc.fontSize(FONT_BODY).font("Helvetica").fillColor("#334155");
      doc.text(`• ${t}`, x, y, { width: width - 4, lineGap: LINE_GAP });
      y = doc.y + 4;
      continue;
    }
    const type = seg.type || "paragraph";
    const text = segmentText(seg);
    if (!text) continue;
    if (type === "heading") {
      doc.fontSize(FONT_HEADING).font("Helvetica-Bold").fillColor("#1e293b");
      doc.text(text, x, y, { width, lineGap: LINE_GAP });
      y = doc.y + 6;
      continue;
    }
    if (type === "boldLabel") {
      doc.fontSize(FONT_BODY).font("Helvetica-Bold").fillColor("#1e293b");
      doc.text(text, x, y, { width, lineGap: LINE_GAP });
      y = doc.y + 4;
      continue;
    }
    if (type === "bullet") {
      doc.fontSize(FONT_BODY).font("Helvetica").fillColor("#334155");
      doc.text(`• ${text}`, x, y, { width: width - 4, indent: 4, lineGap: LINE_GAP });
      y = doc.y + 3;
      continue;
    }
    if (type === "numbered") {
      const n = seg.n != null ? seg.n : 1;
      doc.fontSize(FONT_BODY).font("Helvetica").fillColor("#334155");
      doc.text(`${n}. ${text}`, x, y, { width: width - 4, indent: 4, lineGap: LINE_GAP });
      y = doc.y + 3;
      continue;
    }
    doc.fontSize(FONT_BODY).font("Helvetica").fillColor("#334155");
    doc.text(text, x, y, { width, lineGap: LINE_GAP });
    y = doc.y + 4;
  }
  return y;
}

/**
 * Draw a grouped prose block: title + text + image kept together.
 * Preferred: text left / image right. Fallback: title → image → text.
 * Never renders text then orphans the image on the next page.
 * @param {PDFKit.PDFDocument} doc
 * @param {object} block
 */
function addProseBlockGrouped(doc, block) {
  const title = stripMd(block?.title || "");
  const textSegs = Array.isArray(block?.textSegments) ? block.textSegments : [];
  const imgMeta = openScaledProseImage(doc, block?.source || null);
  const imgSize = imgMeta ? { imgW: imgMeta.imgW, imgH: imgMeta.imgH } : null;

  const minH = estimateProseBlockMinHeight(doc, { title, textSegments: textSegs }, imgSize);
  // Only page-break when the keep-with chunk truly cannot fit (tight estimate).
  if (!proseBlockFitsRemaining(doc, minH)) {
    doc.addPage();
  }

  if (title) {
    doc.fontSize(FONT_HEADING).font("Helvetica-Bold").fillColor("#1e293b");
    doc.text(title, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: LINE_GAP });
    doc.moveDown(0.25);
  }

  if (!imgMeta) {
    if (textSegs.length) {
      const endY = renderTextSegmentsInBox(doc, textSegs, {
        x: MARGIN,
        width: CONTENT_WIDTH,
        startY: doc.y,
      });
      doc.y = endY + 4;
    }
    doc.moveDown(0.2);
    return;
  }

  const sideBySide = canUseProseSideBySide(imgMeta.imgW);
  if (sideBySide) {
    const startY = doc.y;
    const textWidth = CONTENT_WIDTH - imgMeta.imgW - PROSE_COL_GAP;
    const textEndY = renderTextSegmentsInBox(doc, textSegs, {
      x: MARGIN,
      width: textWidth,
      startY,
    });
    const imgX = MARGIN + textWidth + PROSE_COL_GAP;
    try {
      doc.image(imgMeta.img, imgX, startY, { width: imgMeta.imgW, height: imgMeta.imgH });
    } catch {
      /* text already drawn */
    }
    doc.y = Math.max(textEndY, startY + imgMeta.imgH) + 8;
    doc.moveDown(0.15);
    return;
  }

  // Fallback: heading (already drawn) → image → text on the same page group.
  try {
    const x = MARGIN + (CONTENT_WIDTH - imgMeta.imgW) / 2;
    doc.image(imgMeta.img, x, doc.y, { width: imgMeta.imgW, height: imgMeta.imgH });
    doc.y += imgMeta.imgH + 6;
  } catch {
    /* continue with text */
  }
  if (textSegs.length) {
    const endY = renderTextSegmentsInBox(doc, textSegs, {
      x: MARGIN,
      width: CONTENT_WIDTH,
      startY: doc.y,
    });
    doc.y = endY + 4;
  }
  doc.moveDown(0.15);
}

/**
 * Legacy detached prose image (should be rare after grouping).
 * @param {PDFKit.PDFDocument} doc
 * @param {{ source?: object|null }} seg
 */
function addProseImageBelow(doc, seg) {
  const imgMeta = openScaledProseImage(doc, seg?.source || null);
  if (!imgMeta) return;
  ensureSpace(doc, imgMeta.imgH + 20);
  doc.moveDown(0.15);
  try {
    const x = MARGIN + (CONTENT_WIDTH - imgMeta.imgW) / 2;
    doc.image(imgMeta.img, x, doc.y, { width: imgMeta.imgW, height: imgMeta.imgH });
    doc.y += imgMeta.imgH + 6;
  } catch {
    return;
  }
  doc.moveDown(0.15);
}

/** Flatten proseBlock/proseImage markers to plain text if resolve fails entirely. */
function flattenUnresolvedProseBlocks(segments) {
  const out = [];
  for (const seg of Array.isArray(segments) ? segments : []) {
    if (!seg) continue;
    if (seg.type === "proseImage") continue;
    if (seg.type === "proseBlock") {
      if (seg.title) out.push({ type: "heading", text: seg.title });
      (seg.textSegments || []).forEach((s) => out.push(s));
      continue;
    }
    out.push(seg);
  }
  return out;
}

/**
 * Build structured pack sections from a lesson document (lean or mongoose).
 * Pure — no I/O. Used by PDF render and unit tests.
 */
function buildRevisionPackSections(lesson, opts = {}) {
  const includeAnswers = opts.includeAnswers === true;
  const keyLearning = [];
  const keywords = [];
  const examTips = [];
  const commonMistakes = [];
  const diagrams = [];
  const practiceQuestions = [];
  const answerAppendix = [];
  const proseTracker = { count: 0, seen: new Set() };

  const pages = Array.isArray(lesson?.pages) ? lesson.pages : [];
  pages.forEach((page, pageIdx) => {
    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
    blocks.forEach((b) => {
      const t = blockType(b);
      const body = blockBody(b);
      if (isProseKeyLearningType(t)) {
        pushProseBlockWithImage(keyLearning, b, 600, proseTracker);
      } else if (t === "keywords" || t === "keyword") {
        if (body) {
          body.split(/[,;]+/).map((x) => x.trim()).filter(Boolean).forEach((kw) => keywords.push(kw));
        }
        if (Array.isArray(b?.items)) {
          b.items.forEach((it) => {
            const line = stripMd(typeof it === "string" ? it : it?.term || it?.word || it?.text);
            if (line) keywords.push(line);
          });
        }
      } else if (t === "examtips" || t === "examtip") {
        pushProseBlockWithImage(examTips, b, 500, proseTracker);
      } else if (t === "misconceptions" || t === "commonmistake" || t === "commonmistakes") {
        pushProseBlockWithImage(commonMistakes, b, 500, proseTracker);
      } else if (t === "diagram") {
        const caption = stripMd(b?.caption || b?.alt || b?.title || body || "Diagram");
        diagrams.push({ caption, imageUrl: diagramImageUrl(b) });
      } else if (t === "checkpoint" || t === "selfcheck") {
        const q = stripMd(b?.prompt || b?.question || body);
        if (q) {
          practiceQuestions.push({ kind: "checkpoint", text: q, options: b?.options });
          if (includeAnswers) {
            const ans = stripMd(b?.correctAnswer || b?.answer || "");
            const ms = stripMd(b?.markScheme || "");
            if (ans || ms) {
              answerAppendix.push({
                label: `Checkpoint (page ${pageIdx + 1})`,
                answer: ans,
                markScheme: ms,
              });
            }
          }
        }
      } else if (t === "dragdropmatch") {
        const prompt = stripMd(b?.prompt || b?.title || "Match the pairs");
        practiceQuestions.push({ kind: "match", text: `${prompt} (match activity — see lesson for diagram)` });
        const img = diagramImageUrl(b);
        if (img) {
          diagrams.push({
            caption: stripMd(b?.caption || b?.title || prompt || "Match diagram"),
            imageUrl: img,
          });
        }
        // textToImage / diagram match: pair card images
        if (Array.isArray(b?.pairs)) {
          b.pairs.forEach((p) => {
            const pairUrl = String(p?.imageUrl || p?.image || p?.src || "").trim();
            if (!pairUrl) return;
            const label = stripMd(p?.prompt || p?.answer || p?.label || p?.left || p?.text || "Match");
            diagrams.push({
              caption: `Matching image: ${label}`.slice(0, 120),
              imageUrl: pairUrl,
            });
          });
        }
        if (Array.isArray(b?.items)) {
          b.items.forEach((it) => {
            const itemUrl = String(it?.imageUrl || it?.image || it?.src || "").trim();
            if (!itemUrl) return;
            const label = stripMd(it?.prompt || it?.label || it?.text || it?.term || "Match");
            diagrams.push({
              caption: `Matching image: ${label}`.slice(0, 120),
              imageUrl: itemUrl,
            });
          });
        }
      } else if (t === "interactivesequence" || t === "interactivediagram") {
        pushSegments(keyLearning, blockRawText(b) ? `[Interactive] ${blockRawText(b)}` : "", 600);
        if (Array.isArray(b?.sequenceSteps)) {
          b.sequenceSteps.forEach((step) => {
            const stepUrl = String(step?.imageUrl || "").trim();
            if (!stepUrl) return;
            diagrams.push({
              caption: stripMd(step?.caption || step?.title || "Sequence step"),
              imageUrl: stepUrl,
            });
          });
        }
        const img = diagramImageUrl(b);
        if (img) {
          diagrams.push({
            caption: stripMd(b?.caption || b?.title || "Interactive diagram"),
            imageUrl: img,
          });
        }
      } else if (t === "examquestion") {
        const stem = stripMd(b?.prompt || b?.question || b?.stem || body || "Exam-style question");
        const marks = b?.marks != null ? ` (${b.marks} marks)` : "";
        practiceQuestions.push({ kind: "exam", text: `${stem}${marks}` });
      }
    });

    const cp = page?.checkpoint;
    if (cp && (cp.question || cp.prompt)) {
      const q = stripMd(cp.question || cp.prompt);
      if (q) {
        practiceQuestions.push({ kind: "checkpoint", text: q, options: cp.options });
        if (includeAnswers) {
          answerAppendix.push({
            label: `Page checkpoint (page ${pageIdx + 1})`,
            answer: stripMd(cp.answer || cp.correctAnswer || ""),
            markScheme: stripMd(cp.markScheme || ""),
          });
        }
      }
    }
  });

  const flashcards = (Array.isArray(lesson?.flashcards) ? lesson.flashcards : [])
    .map((f) => ({
      front: stripMd(f?.front || f?.question || ""),
      back: stripMd(f?.back || f?.answer || ""),
    }))
    .filter((f) => f.front);

  const quizQs = Array.isArray(lesson?.quiz?.questions)
    ? lesson.quiz.questions
    : Array.isArray(lesson?.quiz)
      ? lesson.quiz
      : [];
  quizQs.forEach((q, i) => {
    const text = stripMd(q?.question || q?.prompt || "");
    if (!text) return;
    practiceQuestions.push({ kind: "quiz", text, options: q?.options });
    if (includeAnswers) {
      answerAppendix.push({
        label: `Quiz Q${i + 1}`,
        answer: stripMd(q?.correctAnswer || q?.answer || ""),
        markScheme: stripMd(q?.markScheme || q?.explanation || ""),
      });
    }
  });

  const examQs = Array.isArray(lesson?.examQuestions) ? lesson.examQuestions : [];
  examQs.forEach((q) => {
    const text = stripMd(q?.question || q?.stem || q?.prompt || "");
    if (!text) return;
    const marks = q?.marks != null ? ` (${q.marks} marks)` : "";
    practiceQuestions.push({ kind: "exam", text: `${text}${marks}` });
    if (includeAnswers) {
      answerAppendix.push({
        label: "Exam-style question",
        answer: stripMd(q?.correctAnswer || q?.answer || ""),
        markScheme: stripMd(q?.markScheme || ""),
      });
    }
  });

  const proseUrls = collectProseImageUrls([keyLearning, examTips, commonMistakes]);

  return {
    title: sanitizePdfText(toText(lesson?.title)) || "Lesson",
    subject: sanitizePdfText(toText(lesson?.subject)),
    board: sanitizePdfText(toText(lesson?.examBoardName || lesson?.board)),
    topic: sanitizePdfText(toText(lesson?.topic || lesson?.subTopic)),
    level: sanitizePdfText(toText(lesson?.level)),
    tier: sanitizePdfText(toText(lesson?.tier)),
    keyLearning,
    keywords,
    examTips,
    commonMistakes,
    // Prefer near-text placement: drop Diagrams duplicates of prose images.
    diagrams: pruneDiagramsAlreadyShownAsProse(diagrams, proseUrls),
    flashcards,
    practiceQuestions,
    answerAppendix: includeAnswers ? answerAppendix : [],
  };
}

function slugify(title) {
  return (
    toText(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "lesson"
  );
}

/**
 * Render revision pack PDF buffer.
 * @param {object} lesson
 * @param {{ includeAnswers?: boolean, fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<Buffer>}
 */
async function renderLessonRevisionPackPdf(lesson, opts = {}) {
  const includeAnswers = opts.includeAnswers === true;
  const sections = buildRevisionPackSections(lesson, { includeAnswers });
  const slug = slugify(sections.title);
  const dateStr = new Date().toISOString().slice(0, 10);

  const hasContent =
    sections.keyLearning.length > 0 ||
    sections.keywords.length > 0 ||
    sections.examTips.length > 0 ||
    sections.commonMistakes.length > 0 ||
    sections.diagrams.length > 0 ||
    sections.flashcards.length > 0 ||
    sections.practiceQuestions.length > 0 ||
    Boolean(sections.title);

  if (!hasContent) {
    throw Object.assign(new Error("Lesson has no content to export."), {
      status: 400,
      code: "MISSING_CONTENT",
    });
  }

  // Resolve local + allowlisted remote images before opening the PDF stream.
  let diagramEntries = [];
  try {
    diagramEntries = await resolveDiagramEntries(sections.diagrams, {
      fetchImpl: opts.fetchImpl,
    });
  } catch {
    diagramEntries = (sections.diagrams || []).slice(0, MAX_DIAGRAMS).map((d) => ({
      caption: typeof d === "string" ? d : d?.caption || "Diagram",
      imageUrl: typeof d === "string" ? "" : d?.imageUrl || "",
      source: null,
    }));
  }

  let keyLearning = sections.keyLearning;
  let examTips = sections.examTips;
  let commonMistakes = sections.commonMistakes;
  try {
    keyLearning = await resolveProseImageSegments(sections.keyLearning, {
      fetchImpl: opts.fetchImpl,
    });
    examTips = await resolveProseImageSegments(sections.examTips, {
      fetchImpl: opts.fetchImpl,
    });
    commonMistakes = await resolveProseImageSegments(sections.commonMistakes, {
      fetchImpl: opts.fetchImpl,
    });
  } catch {
    keyLearning = flattenUnresolvedProseBlocks(sections.keyLearning);
    examTips = flattenUnresolvedProseBlocks(sections.examTips);
    commonMistakes = flattenUnresolvedProseBlocks(sections.commonMistakes);
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "LETTER", margin: MARGIN, autoFirstPage: true });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      let pageNum = 1;
      doc.on("pageAdded", () => {
        pageNum += 1;
        addFooter(doc, { slug, dateStr, pageNum });
        // Critical: footer text leaves doc.y near the bottom; reset so content
        // starts at the top margin and does not cascade empty pages.
        doc.y = MARGIN;
      });

      doc.fontSize(FONT_TITLE).font("Helvetica-Bold").fillColor("#0f172a");
      doc.text(sections.title, MARGIN, MARGIN, { width: CONTENT_WIDTH, lineGap: LINE_GAP });
      doc.moveDown(0.45);

      const metaParts = [sections.subject, sections.board, sections.topic, sections.level, sections.tier]
        .map((x) => toText(x).trim())
        .filter(Boolean);
      doc.fontSize(FONT_META).font("Helvetica").fillColor("#64748b");
      doc.text(metaParts.join(" · ") || "Revision pack", MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: LINE_GAP });
      doc.moveDown(0.3);
      doc.text(`Generated: ${dateStr}`, MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.9);

      if (keyLearning.length) {
        addSectionHeader(doc, "Key learning points");
        addSegments(doc, keyLearning);
      }
      if (sections.keywords.length) {
        addSectionHeader(doc, "Keywords");
        addBullets(doc, sections.keywords, 200);
      }
      if (diagramEntries.length) {
        addDiagramSection(doc, diagramEntries);
      }
      if (examTips.length) {
        addSectionHeader(doc, "Exam tips");
        addSegments(doc, examTips);
      }
      if (commonMistakes.length) {
        addSectionHeader(doc, "Common mistakes");
        addSegments(doc, commonMistakes);
      }
      if (sections.flashcards.length) {
        addSectionHeader(doc, "Flashcards");
        sections.flashcards.slice(0, 40).forEach((f, i) => {
          const qLine = `Q${i + 1}. ${safeSlice(f.front, 400)}`;
          const aLine = `A. ${safeSlice(f.back, 400) || "—"}`;
          ensureTextSpace(doc, `${qLine}\n${aLine}`, { fontSize: FONT_BODY, lineGap: LINE_GAP, extra: 16 });
          doc.fontSize(FONT_BODY).font("Helvetica-Bold").fillColor("#1e293b");
          doc.text(qLine, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: LINE_GAP });
          doc.moveDown(0.2);
          doc.font("Helvetica").fillColor("#334155");
          doc.text(aLine, MARGIN, doc.y, {
            width: CONTENT_WIDTH - 10,
            indent: 10,
            lineGap: LINE_GAP,
          });
          doc.moveDown(0.55);
        });
      }
      if (sections.practiceQuestions.length) {
        addSectionHeader(doc, "Practice questions");
        sections.practiceQuestions.slice(0, 50).forEach((q, i) => {
          const qLine = `${i + 1}. ${safeSlice(q.text, 500)}`;
          ensureTextSpace(doc, qLine, { fontSize: FONT_BODY, lineGap: LINE_GAP, extra: 28 });
          doc.fontSize(FONT_BODY).font("Helvetica-Bold").fillColor("#1e293b");
          doc.text(qLine, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: LINE_GAP });
          doc.moveDown(0.2);
          if (Array.isArray(q.options) && q.options.length) {
            doc.font("Helvetica").fillColor("#475569");
            q.options.forEach((opt, oi) => {
              const label = String.fromCharCode(65 + oi);
              const optLine = `${label}. ${safeSlice(opt, 200)}`;
              ensureTextSpace(doc, optLine, { width: CONTENT_WIDTH - 10, fontSize: FONT_BODY, lineGap: LINE_GAP, extra: 8 });
              doc.fontSize(FONT_BODY).font("Helvetica").fillColor("#475569");
              doc.text(optLine, MARGIN, doc.y, {
                width: CONTENT_WIDTH - 10,
                indent: 12,
                lineGap: LINE_GAP,
              });
              doc.moveDown(0.15);
            });
          }
          doc.fontSize(FONT_BODY).font("Helvetica").fillColor("#94a3b8");
          doc.text("Answer: ____________________________", MARGIN, doc.y, {
            width: CONTENT_WIDTH,
            indent: 10,
          });
          doc.moveDown(0.6);
        });
      }

      if (includeAnswers && sections.answerAppendix.length) {
        addSectionHeader(doc, "Model answers / mark scheme");
        sections.answerAppendix.forEach((a, i) => {
          ensureSpace(doc, 48);
          doc.fontSize(FONT_BODY).font("Helvetica-Bold").fillColor("#1e293b");
          doc.text(`${i + 1}. ${a.label}`, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: LINE_GAP });
          doc.moveDown(0.2);
          if (a.answer) addParagraph(doc, `Answer: ${a.answer}`);
          if (a.markScheme) addParagraph(doc, `Mark scheme: ${a.markScheme}`);
          doc.moveDown(0.3);
        });
      }

      addFooter(doc, { slug, dateStr, pageNum });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  renderLessonRevisionPackPdf,
  buildRevisionPackSections,
  slugify,
  splitIntoReadableChunks,
  parseContentToSegments,
  segmentText,
  sanitizePdfText,
  addSegments,
  collectFollowingLinesForHeading,
  collectFollowingContentForHeading,
  ensureHeadingKeepWithContent,
  extractFirstProseImage,
  formatProseBlockTitle,
  scaleProseImageSize,
  canUseProseSideBySide,
  estimateProseBlockMinHeight,
  proseBlockFitsRemaining,
  normalizeImageUrlForDedupe,
  collectProseImageUrls,
  pruneDiagramsAlreadyShownAsProse,
  MAX_PROSE_IMAGES,
  PROSE_IMAGE_MAX_WIDTH,
  PROSE_IMAGE_MAX_HEIGHT,
  DIAGRAM_SECTION_MAX_HEIGHT,
  HEADING_KEEP_MIN_BULLETS,
  CONTENT_BOTTOM,
  MARGIN,
  REVISION_PACK_COPYRIGHT_NOTICE,
};
