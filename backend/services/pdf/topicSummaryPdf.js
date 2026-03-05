/**
 * PR-025: Topic summary PDF generation.
 * Uses PDFKit. No LLM, no external fetch.
 * All text inputs normalized via toText/safeSlice to avoid 500 on malformed data.
 */
const PDFDocument = require("pdfkit");

const MARGIN = 50;
const PAGE_WIDTH = 612;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const toText = (v) => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(toText).filter(Boolean).join("\n");
  if (typeof v === "object") {
    if (typeof v.text === "string") return v.text;
    if (typeof v.summary === "string") return v.summary;
    if (typeof v.title === "string") return v.title;
    try {
      return JSON.stringify(v);
    } catch {
      return "[object]";
    }
  }
  return String(v);
};

const safeSlice = (v, n) => toText(v).slice(0, n);

function badgeLabel(sourceType) {
  if (sourceType === "specStatement") return "SPEC";
  if (sourceType === "lessonBlock") return "LESSON";
  if (sourceType === "teacherNote") return "NOTE";
  if (sourceType === "externalTrusted") return "EXTERNAL";
  return "EXTERNAL";
}

function formatTopicTitle(topicKey) {
  if (!topicKey || typeof topicKey !== "string") return "Topic";
  const seg = toText(topicKey).split(":").pop() || toText(topicKey);
  return seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMode(mode) {
  const m = toText(mode).toLowerCase();
  if (m === "lessonplan") return "Lesson plan";
  if (m === "revisionsheet") return "Revision sheet";
  if (m === "examfocus") return "Exam focus";
  return "Overview";
}

/**
 * Render topic summary as PDF buffer.
 */
function renderTopicSummaryPdf({
  specKey,
  topicKey,
  mode,
  generatedForRole,
  confidenceLevel,
  confidenceReason,
  summaryPayload,
  usedSources = [],
  includeCitations = true,
}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: "A4", margin: MARGIN });
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const payload = summaryPayload || {};
    const keyPoints = Array.isArray(payload.keyPoints) ? payload.keyPoints : [];
    const citations = Array.isArray(payload.citations) ? payload.citations : [];
    const sections = payload.sections && typeof payload.sections === "object" ? payload.sections : {};

    const title = formatTopicTitle(topicKey);
    const modeLabel = formatMode(mode);
    const now = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

    // Title
    doc.fontSize(18).font("Helvetica-Bold").text(toText(`Topic summary — ${title}`), 0, 0, { width: CONTENT_WIDTH });
    doc.moveDown(0.5);

    // Subtitle
    doc.fontSize(10).font("Helvetica").fillColor("#666666");
    doc.text(toText(`${specKey} • ${modeLabel} • Generated ${now}`), 0, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.5);

    // Confidence badge
    if (confidenceLevel) {
      const confLabel = toText(confidenceLevel).charAt(0).toUpperCase() + toText(confidenceLevel).slice(1);
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#000000");
      doc.text(toText(`Confidence: ${confLabel}`), 0, doc.y, { width: CONTENT_WIDTH });
      if (confidenceReason) {
        doc.fontSize(10).font("Helvetica").fillColor("#444444");
        doc.text(toText(confidenceReason), 0, doc.y + 2, { width: CONTENT_WIDTH });
        doc.moveDown(0.5);
      }
      doc.moveDown(0.5);
    }

    // Summary
    const summary = toText(payload.summary);
    if (summary) {
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#000000");
      doc.text("Summary", 0, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.3);
      doc.fontSize(11).font("Helvetica").fillColor("#333333");
      doc.text(summary, 0, doc.y, { width: CONTENT_WIDTH, align: "left" });
      doc.moveDown(1);
    }

    // Key points
    if (keyPoints.length > 0) {
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#000000");
      doc.text("Key points", 0, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.3);
      doc.fontSize(11).font("Helvetica").fillColor("#333333");
      keyPoints.forEach((kp) => {
        doc.text(toText(`• ${safeSlice(kp, 500)}`), 0, doc.y, { width: CONTENT_WIDTH, continued: false });
        doc.moveDown(0.2);
      });
      doc.moveDown(0.5);
    }

    // Lesson plan
    const lp = sections.lessonPlan;
    if (lp && Array.isArray(lp.segments) && lp.segments.length > 0) {
      const dur = toText(lp.durationMinutes || 50);
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#000000");
      doc.text(toText(`Lesson plan (${dur} min)`), 0, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica").fillColor("#333333");
      lp.segments.forEach((s) => {
        const line = `${safeSlice(s.minutes, 20)} | ${safeSlice(s.title, 60)} | ${safeSlice(s.activity, 40)} | ${safeSlice(s.checkForUnderstanding, 30)}`;
        doc.text(toText(line), 0, doc.y, { width: CONTENT_WIDTH });
        doc.moveDown(0.15);
      });
      doc.moveDown(0.5);
    }

    // Revision sheet
    const rs = sections.revisionSheet;
    if (rs && typeof rs === "object") {
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#000000");
      doc.text("Revision sheet", 0, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica").fillColor("#333333");
      const commonMistakes = Array.isArray(rs.commonMistakes) ? rs.commonMistakes : [];
      if (commonMistakes.length > 0) {
        doc.text("Common mistakes:", 0, doc.y, { width: CONTENT_WIDTH });
        doc.moveDown(0.2);
        commonMistakes.forEach((m) => {
          doc.text(toText(`  • ${safeSlice(m, 300)}`), 0, doc.y, { width: CONTENT_WIDTH });
          doc.moveDown(0.15);
        });
        doc.moveDown(0.3);
      }
      const memoryCues = Array.isArray(rs.memoryCues) ? rs.memoryCues : [];
      if (memoryCues.length > 0) {
        doc.text("Memory cues:", 0, doc.y, { width: CONTENT_WIDTH });
        doc.moveDown(0.2);
        memoryCues.forEach((m) => {
          doc.text(toText(`  • ${safeSlice(m, 300)}`), 0, doc.y, { width: CONTENT_WIDTH });
          doc.moveDown(0.15);
        });
        doc.moveDown(0.3);
      }
      const flashcards = Array.isArray(rs.flashcards) ? rs.flashcards : [];
      if (flashcards.length > 0) {
        doc.text("Flashcards:", 0, doc.y, { width: CONTENT_WIDTH });
        doc.moveDown(0.2);
        flashcards.forEach((f, i) => {
          doc.text(toText(`  ${i + 1}. Q: ${safeSlice(f?.front, 100)}`), 0, doc.y, { width: CONTENT_WIDTH });
          doc.moveDown(0.1);
          doc.text(toText(`     A: ${safeSlice(f?.back, 150)}`), 0, doc.y, { width: CONTENT_WIDTH });
          doc.moveDown(0.2);
        });
        doc.moveDown(0.3);
      }
    }

    // Exam focus
    const ef = sections.examFocus;
    if (ef && typeof ef === "object") {
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#000000");
      doc.text("Exam focus", 0, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica").fillColor("#333333");
      const commandWords = Array.isArray(ef.commandWords) ? ef.commandWords : [];
      if (commandWords.length > 0) {
        const cwStr = commandWords.map(toText).join(", ");
        doc.text(toText(`Command words: ${cwStr}`), 0, doc.y, { width: CONTENT_WIDTH });
        doc.moveDown(0.3);
      }
      if (ef.examQuestion) {
        const eq = ef.examQuestion;
        doc.text(toText(`Question: ${safeSlice(eq?.question, 400)}`), 0, doc.y, { width: CONTENT_WIDTH });
        doc.moveDown(0.2);
        doc.text(toText(`Mark scheme: ${safeSlice(eq?.markScheme, 300)}`), 0, doc.y, { width: CONTENT_WIDTH });
        doc.moveDown(0.5);
      }
    }

    // Citations
    const sourceMap = new Map((Array.isArray(usedSources) ? usedSources : []).map((s) => [s.knowledgeDocumentId, s]));

    if (includeCitations && citations.length > 0) {
      doc.addPage();
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#000000");
      doc.text("Citations", 0, MARGIN, { width: CONTENT_WIDTH });
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica").fillColor("#333333");

      citations.forEach((c, i) => {
        const src = sourceMap.get(c.knowledgeDocumentId);
        const badge = badgeLabel(toText(c.sourceType || "externalTrusted"));
        const titleText = safeSlice(src?.title || c.reason || "Source", 80);
        const quoteText = safeSlice(c.quote, 200);
        doc.text(toText(`[${i + 1}] [${badge}] ${titleText}`), 0, doc.y, { width: CONTENT_WIDTH });
        doc.moveDown(0.15);
        doc.text(toText(`  "${quoteText}"`), 0, doc.y, { width: CONTENT_WIDTH - 20, indent: 10 });
        if (c.externalUrl) {
          doc.moveDown(0.1);
          doc.fillColor("#2563eb").text(toText(`  → ${c.externalUrl}`), 0, doc.y, { width: CONTENT_WIDTH - 20, indent: 10 });
          doc.fillColor("#333333");
        }
        doc.moveDown(0.4);
      });
    }

    doc.end();
  });
}

module.exports = { renderTopicSummaryPdf };
