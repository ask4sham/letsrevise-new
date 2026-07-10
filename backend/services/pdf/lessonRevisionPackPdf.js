/**
 * Lesson Revision Pack PDF — PDFKit export for a single lesson.
 * Structured rich text (headings/bullets/bold) + local-first diagram embedding.
 */
const PDFDocument = require("pdfkit");
const {
  resolveLessonImageForPdf,
  MAX_DIAGRAMS,
  IMAGE_MAX_HEIGHT,
} = require("./resolveLessonImageForPdf");

const MARGIN = 50;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 30;
const CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT;

const FONT_TITLE = 22;
const FONT_META = 11;
const FONT_SECTION = 14;
const FONT_HEADING = 13;
const FONT_BODY = 12;
const FONT_FOOTER = 9;
const LINE_GAP = 4;

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

/** Strip tags but keep text (for captions / single-line fields). */
function stripTags(s) {
  return decodeEntities(s)
    .replace(/<\s*br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
  htmlToPlainStructured(s)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Strip HTML + markdown but keep paragraph/list structure for revision bullets.
 */
function stripMdKeepBreaks(s) {
  return htmlToPlainStructured(s)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_`]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

  let text = runs.map((r) => r.text).join("").replace(/\s+/g, " ").trim();
  if (text.length > maxLen) {
    text = text.slice(0, maxLen);
  }
  const hasBold = runs.some((r) => r.bold);
  if (!hasBold) return { text };
  // Re-slice runs to maxLen roughly
  let used = 0;
  const clipped = [];
  for (const r of runs) {
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

function addFooter(doc, meta) {
  const { slug, dateStr, pageNum } = meta;
  doc.fontSize(FONT_FOOTER).font("Helvetica").fillColor("#94a3b8");
  const footerText = `LetsRevise • Revision pack • ${toText(slug)} • ${dateStr} • Page ${pageNum}`;
  doc.text(footerText, MARGIN, PAGE_HEIGHT - MARGIN - 12, { width: CONTENT_WIDTH, align: "center" });
}

function addSectionHeader(doc, text) {
  ensureSpace(doc, 32);
  doc.fontSize(FONT_SECTION).font("Helvetica-Bold").fillColor("#1e293b");
  doc.text(toText(text), MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: LINE_GAP });
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
  segments.forEach((seg) => {
    if (typeof seg === "string") {
      addBullets(doc, [seg]);
      return;
    }
    const type = seg.type || "paragraph";
    const text = segmentText(seg);
    if (!text) return;

    if (type === "heading") {
      ensureSpace(doc, 28);
      doc.fontSize(FONT_HEADING).font("Helvetica-Bold").fillColor("#1e293b");
      doc.text(text, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: LINE_GAP });
      doc.moveDown(0.45);
      return;
    }
    if (type === "boldLabel") {
      addRichLine(doc, "", text, null, { boldAll: true, color: "#1e293b", moveDown: 0.35 });
      return;
    }
    if (type === "bullet") {
      addRichLine(doc, "• ", text, seg.runs, { indent: 10, moveDown: 0.35 });
      return;
    }
    if (type === "numbered") {
      const n = seg.n != null ? seg.n : 1;
      addRichLine(doc, `${n}. `, text, seg.runs, { indent: 10, moveDown: 0.35 });
      return;
    }
    // paragraph
    addRichLine(doc, "", text, seg.runs, { indent: 0, moveDown: 0.5 });
  });
  doc.moveDown(0.25);
}

/**
 * Embed diagram images (local-first). Never throws.
 */
function addDiagramSection(doc, diagrams) {
  if (!Array.isArray(diagrams) || diagrams.length === 0) return;
  addSectionHeader(doc, "Diagrams");

  let embedded = 0;
  for (const d of diagrams) {
    if (embedded >= MAX_DIAGRAMS) break;

    const caption =
      typeof d === "string" ? stripMd(d) : stripMd(d?.caption || d?.alt || "Diagram");
    const imageUrl = typeof d === "string" ? "" : String(d?.imageUrl || d?.src || "").trim();
    const resolved = imageUrl ? resolveLessonImageForPdf(imageUrl) : null;

    let imgW = 0;
    let imgH = 0;
    let img = null;
    if (resolved) {
      try {
        img = doc.openImage(resolved);
        const scale = Math.min(CONTENT_WIDTH / img.width, IMAGE_MAX_HEIGHT / img.height, 1);
        imgW = Math.max(1, img.width * scale);
        imgH = Math.max(1, img.height * scale);
      } catch {
        img = null;
      }
    }

    // Keep caption + image together when possible (avoid orphan caption above a page break).
    const blockH = (caption ? 28 : 0) + (img ? imgH + 16 : 24);
    ensureSpace(doc, Math.min(blockH, CONTENT_BOTTOM - MARGIN - 20));

    if (caption) {
      doc.fontSize(FONT_BODY).font("Helvetica-Bold").fillColor("#1e293b");
      doc.text(caption, MARGIN, doc.y, { width: CONTENT_WIDTH, lineGap: LINE_GAP });
      doc.moveDown(0.3);
    }

    let drew = false;
    if (img) {
      try {
        const x = MARGIN + (CONTENT_WIDTH - imgW) / 2;
        doc.image(img, x, doc.y, { width: imgW, height: imgH });
        doc.y += imgH + 10;
        drew = true;
        embedded += 1;
      } catch {
        drew = false;
      }
    }

    if (!drew) {
      doc.fontSize(FONT_BODY).font("Helvetica").fillColor("#94a3b8");
      doc.text("[Diagram unavailable]", MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.55);
      if (imageUrl) embedded += 1;
    } else {
      doc.moveDown(0.35);
    }
  }
}

function blockType(b) {
  return String(b?.type || b?.blockType || "").toLowerCase();
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

  const pages = Array.isArray(lesson?.pages) ? lesson.pages : [];
  pages.forEach((page, pageIdx) => {
    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
    blocks.forEach((b) => {
      const t = blockType(b);
      const body = blockBody(b);
      if (t === "keyideas" || t === "keyidea" || t === "text" || t === "stretch" || t === "deeperknowledge") {
        pushSegments(keyLearning, blockRawText(b), 600);
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
        pushSegments(examTips, blockRawText(b), 500);
      } else if (t === "misconceptions" || t === "commonmistake" || t === "commonmistakes") {
        pushSegments(commonMistakes, blockRawText(b), 500);
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

  return {
    title: toText(lesson?.title) || "Lesson",
    subject: toText(lesson?.subject),
    board: toText(lesson?.examBoardName || lesson?.board),
    topic: toText(lesson?.topic || lesson?.subTopic),
    level: toText(lesson?.level),
    tier: toText(lesson?.tier),
    keyLearning,
    keywords,
    examTips,
    commonMistakes,
    diagrams,
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
 * @param {{ includeAnswers?: boolean }} [opts]
 * @returns {Promise<Buffer>}
 */
function renderLessonRevisionPackPdf(lesson, opts = {}) {
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

      if (sections.keyLearning.length) {
        addSectionHeader(doc, "Key learning points");
        addSegments(doc, sections.keyLearning);
      }
      if (sections.keywords.length) {
        addSectionHeader(doc, "Keywords");
        addBullets(doc, sections.keywords, 200);
      }
      if (sections.diagrams.length) {
        addDiagramSection(doc, sections.diagrams);
      }
      if (sections.examTips.length) {
        addSectionHeader(doc, "Exam tips");
        addSegments(doc, sections.examTips);
      }
      if (sections.commonMistakes.length) {
        addSectionHeader(doc, "Common mistakes");
        addSegments(doc, sections.commonMistakes);
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
};
