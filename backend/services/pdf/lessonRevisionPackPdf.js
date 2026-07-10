/**
 * Lesson Revision Pack PDF V1 — PDFKit export for a single lesson.
 * Reuses layout conventions from topicSummaryPdf.js (margins, pagination, footer).
 */
const PDFDocument = require("pdfkit");

const MARGIN = 50;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 30;
const CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT;

const FONT_TITLE = 22;
const FONT_META = 11;
const FONT_SECTION = 14;
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

/** Strip markdown markers; collapse to a single line (captions, answers, stems). */
const stripMd = (s) =>
  toText(s)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Strip markdown but keep paragraph/list structure for revision bullets.
 */
function stripMdKeepBreaks(s) {
  return toText(s)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`]/g, "")
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
  // Cap estimate so a single block cannot force a blank page by itself.
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
    const line = `• ${safeSlice(item, maxLen)}`;
    if (line === "• ") return;
    ensureTextSpace(doc, line, { width: CONTENT_WIDTH - 10, fontSize: FONT_BODY, lineGap: LINE_GAP, extra: 12 });
    doc.fontSize(FONT_BODY).font("Helvetica").fillColor("#334155");
    doc.text(line, MARGIN, doc.y, { width: CONTENT_WIDTH - 10, indent: 10, lineGap: LINE_GAP });
    doc.moveDown(0.45);
  });
  doc.moveDown(0.35);
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

function pushStructuredLines(target, raw, maxLen = 600) {
  splitIntoReadableChunks(raw, maxLen).forEach((line) => {
    if (line) target.push(line);
  });
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
        pushStructuredLines(keyLearning, blockRawText(b), 600);
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
        pushStructuredLines(examTips, blockRawText(b), 500);
      } else if (t === "misconceptions" || t === "commonmistake" || t === "commonmistakes") {
        pushStructuredLines(commonMistakes, blockRawText(b), 500);
      } else if (t === "diagram") {
        const caption = stripMd(b?.caption || b?.alt || b?.title || body || "Diagram");
        diagrams.push(caption);
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
      } else if (t === "interactivesequence" || t === "interactivediagram") {
        pushStructuredLines(keyLearning, blockRawText(b) ? `[Interactive] ${blockRawText(b)}` : "", 600);
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
        addBullets(doc, sections.keyLearning);
      }
      if (sections.keywords.length) {
        addSectionHeader(doc, "Keywords");
        addBullets(doc, sections.keywords, 200);
      }
      if (sections.diagrams.length) {
        addSectionHeader(doc, "Diagrams");
        addBullets(
          doc,
          sections.diagrams.map((d) => `${d} (see lesson for full diagram)`),
          300
        );
      }
      if (sections.examTips.length) {
        addSectionHeader(doc, "Exam tips");
        addBullets(doc, sections.examTips);
      }
      if (sections.commonMistakes.length) {
        addSectionHeader(doc, "Common mistakes");
        addBullets(doc, sections.commonMistakes);
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
};
