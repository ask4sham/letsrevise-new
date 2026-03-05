/**
 * PR-025/PR-026: Topic summary PDF generation.
 * Layout engine with proper wrapping, sections, citations, pagination, footer.
 */
const PDFDocument = require("pdfkit");

const MARGIN = 50;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_HEIGHT = 30;
const CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT;

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
  if (sourceType === "lessonDiagram") return "DIAGRAM";
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
 * Normalize payload for export. Throws if content is empty.
 */
function normalizeTopicSummaryExportPayload(payload) {
  const p = payload || {};
  const summaryText = toText(p.summary).trim();
  const keyPoints = Array.isArray(p.keyPoints)
    ? p.keyPoints.map((kp) => toText(kp).trim()).filter(Boolean)
    : [];
  const sections = p.sections && typeof p.sections === "object" ? p.sections : {};
  const citations = Array.isArray(p.citations) ? p.citations : [];
  const usedSources = Array.isArray(p.usedSources) ? p.usedSources : [];

  const hasSections = sections && typeof sections === "object" && Object.keys(sections).length > 0;
  const hasSectionContent =
    (sections.lessonPlan?.segments?.length > 0) ||
    (sections.revisionSheet && Object.keys(sections.revisionSheet).some((k) => Array.isArray(sections.revisionSheet[k]) && sections.revisionSheet[k].length > 0)) ||
    (sections.examFocus && (sections.examFocus.commandWords?.length > 0 || sections.examFocus.examQuestion));

  if (!summaryText && keyPoints.length === 0 && !hasSectionContent) {
    throw Object.assign(new Error("Topic summary has no content to export."), {
      status: 400,
      code: "MISSING_CONTENT",
    });
  }

  const sourceCounts = p.sourceCounts && typeof p.sourceCounts === "object" ? p.sourceCounts : {};
  const suggestedActions = Array.isArray(p.suggestedActions) ? p.suggestedActions : [];
  const practiceMcq = p.practiceMcq && typeof p.practiceMcq === "object" ? p.practiceMcq : null;

  return {
    summaryText,
    keyPoints,
    sections,
    citations,
    usedSources,
    sourceCounts,
    suggestedActions,
    practiceMcq,
  };
}

/**
 * Ensure enough space; add page if needed.
 */
function ensureSpace(doc, neededHeight) {
  if (doc.y + neededHeight > CONTENT_BOTTOM) {
    doc.addPage();
  }
}

/**
 * Add footer to current page.
 */
function addFooter(doc, meta) {
  const { specKey, topicKey, dateStr, pageNum } = meta;
  doc.fontSize(9).font("Helvetica").fillColor("#94a3b8");
  const footerText = `LetsRevise • ${toText(specKey)} • ${toText(topicKey)} • ${dateStr} • Page ${pageNum}`;
  doc.text(footerText, MARGIN, PAGE_HEIGHT - MARGIN - 12, { width: CONTENT_WIDTH, align: "center" });
}

/**
 * Add title and subtitle.
 */
function addTitle(doc, title, subtitle) {
  doc.fontSize(20).font("Helvetica-Bold").fillColor("#000000");
  doc.text(toText(title), MARGIN, MARGIN, { width: CONTENT_WIDTH });
  doc.moveDown(0.3);
  doc.fontSize(11).font("Helvetica").fillColor("#64748b");
  doc.text(toText(subtitle), MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.8);
}

/**
 * Add section header.
 */
function addSectionHeader(doc, text) {
  ensureSpace(doc, 24);
  doc.fontSize(13).font("Helvetica-Bold").fillColor("#1e293b");
  doc.text(toText(text), MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.4);
}

/**
 * Add paragraph with wrapping.
 */
function addParagraph(doc, text, opts = {}) {
  if (!text || !String(text).trim()) return;
  const { fontSize = 11, lineGap = 2 } = opts;
  doc.fontSize(fontSize).font("Helvetica").fillColor("#334155");
  doc.text(toText(text), MARGIN, doc.y, { width: CONTENT_WIDTH, align: "left", lineGap });
  doc.moveDown(0.6);
}

/**
 * Add bullet list.
 */
function addBullets(doc, items, opts = {}) {
  if (!Array.isArray(items) || items.length === 0) return;
  const { maxLen = 800 } = opts;
  doc.fontSize(11).font("Helvetica").fillColor("#334155");
  items.forEach((item) => {
    ensureSpace(doc, 18);
    const line = toText(item).slice(0, maxLen);
    doc.text(`• ${line}`, MARGIN, doc.y, { width: CONTENT_WIDTH - 10, indent: 10 });
    doc.moveDown(0.25);
  });
  doc.moveDown(0.3);
}

/**
 * Add key-value table (lesson plan style).
 */
function addKeyValueTable(doc, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  doc.fontSize(10).font("Helvetica").fillColor("#334155");
  rows.forEach((row) => {
    ensureSpace(doc, 16);
    const line = toText(row).slice(0, 200);
    doc.text(line, MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.2);
  });
  doc.moveDown(0.4);
}

/**
 * Add evidence appendix (numbered [1].. with quote truncation).
 */
function addEvidenceAppendix(doc, citations, usedSources, quoteChars = 180) {
  if (!Array.isArray(citations) || citations.length === 0) return;
  const sourceMap = new Map((usedSources || []).map((s) => [s.knowledgeDocumentId, s]));

  addSectionHeader(doc, "Evidence used");
  doc.fontSize(10).font("Helvetica").fillColor("#475569");

  citations.forEach((c, i) => {
    ensureSpace(doc, 60);
    const src = sourceMap.get(c.knowledgeDocumentId);
    const badge = badgeLabel(toText(c.sourceType || "externalTrusted"));
    const titleText = safeSlice(src?.title || c.reason || "Source", 80);
    const quoteText = safeSlice(c.quote, Math.max(50, Math.min(500, quoteChars)));

    doc.font("Helvetica-Bold").fillColor("#1e293b");
    doc.text(`[${i + 1}] [${badge}] ${titleText}`, MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.15);
    doc.font("Helvetica").fillColor("#475569");
    doc.text(`"${quoteText}"`, MARGIN, doc.y, { width: CONTENT_WIDTH - 10, indent: 10 });
    if (c.externalUrl) {
      doc.moveDown(0.1);
      doc.fillColor("#475569");
      const url = toText(c.externalUrl);
      const domain = url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
      doc.text(`→ ${domain}`, MARGIN, doc.y, { width: CONTENT_WIDTH - 10, indent: 10 });
      doc.moveDown(0.05);
      doc.text(url, MARGIN, doc.y, { width: CONTENT_WIDTH - 10, indent: 10 });
    }
    doc.moveDown(0.35);
  });
}

/**
 * Add "At a glance" block: Mode, Confidence, Source counts, Date.
 */
function addAtAGlance(doc, { modeLabel, confidenceLevel, sourceCounts, dateStr, isStudent }) {
  doc.fontSize(10).font("Helvetica").fillColor("#64748b");
  const parts = [`Mode: ${modeLabel}`, `Generated: ${dateStr}`];
  if (confidenceLevel && !isStudent) {
    const conf = toText(confidenceLevel).charAt(0).toUpperCase() + toText(confidenceLevel).slice(1);
    parts.splice(1, 0, `Confidence: ${conf}`);
  }
  if (sourceCounts && typeof sourceCounts === "object") {
    const sc = sourceCounts;
    const counts = [sc.spec, sc.lesson, sc.note, sc.external].filter((n) => typeof n === "number");
    if (counts.some((n) => n > 0)) {
      parts.push(`Sources: Spec ${sc.spec ?? 0} / Lesson ${sc.lesson ?? 0} / Notes ${sc.note ?? 0} / External ${sc.external ?? 0}`);
    }
  }
  doc.text(parts.join("  •  "), MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.5);
}

/**
 * Derive expanded key points (up to maxBullets) from keyPoints + sections.
 */
function deriveExpandedKeyPoints(keyPoints, sections, maxBullets) {
  const out = [...keyPoints.map(toText).filter(Boolean)];
  if (out.length >= maxBullets) return out.slice(0, maxBullets);
  const rs = sections?.revisionSheet;
  if (rs?.commonMistakes?.length) {
    rs.commonMistakes.slice(0, 2).forEach((m) => out.push(`Common mistake: ${toText(m).slice(0, 120)}`));
  }
  if (rs?.memoryCues?.length && out.length < maxBullets) {
    rs.memoryCues.slice(0, 2).forEach((m) => out.push(`Memory cue: ${toText(m).slice(0, 120)}`));
  }
  const lp = sections?.lessonPlan;
  if (lp?.segments?.length && out.length < maxBullets) {
    lp.segments.slice(0, 2).forEach((s) => out.push(`${toText(s.title)}: ${toText(s.activity).slice(0, 80)}`));
  }
  const ef = sections?.examFocus;
  if (ef?.commandWords?.length && out.length < maxBullets) {
    out.push(`Command words: ${ef.commandWords.map(toText).slice(0, 5).join(", ")}`);
  }
  return out.slice(0, maxBullets);
}

/**
 * Add "Common mistakes & examiner tips" section.
 */
function addCommonMistakesExaminerTips(doc, sections) {
  const rs = sections?.revisionSheet;
  const ef = sections?.examFocus;
  const commonMistakes = Array.isArray(rs?.commonMistakes) ? rs.commonMistakes : [];
  const examTips = Array.isArray(ef?.examTips) ? ef.examTips : [];

  if (commonMistakes.length > 0) {
    addSectionHeader(doc, "Common mistakes");
    addBullets(doc, commonMistakes, { maxLen: 400 });
  }
  if (examTips.length > 0) {
    addSectionHeader(doc, "Examiner tips");
    addBullets(doc, examTips, { maxLen: 400 });
  } else if (ef?.examQuestion?.markScheme) {
    addSectionHeader(doc, "Examiner tips");
    addParagraph(doc, safeSlice(ef.examQuestion.markScheme, 300));
  }
}

/**
 * Compute next steps (3–5 items). No LLM.
 */
function computeNextSteps(suggestedActions, specKey, topicKey) {
  if (Array.isArray(suggestedActions) && suggestedActions.length > 0) {
    return suggestedActions.slice(0, 5).map((a) => (typeof a === "string" ? a : toText(a?.label ?? a?.action ?? a))).filter(Boolean);
  }
  return [
    "View lesson for this topic",
    "Practice questions",
    "Review flashcards",
    "Take quiz",
  ];
}

/**
 * Add "Next steps" section.
 */
function addNextStepsSection(doc, items) {
  if (!Array.isArray(items) || items.length === 0) return;
  addSectionHeader(doc, "Next steps");
  addBullets(doc, items, { maxLen: 200 });
}

/**
 * Add mini revision appendix (4 flashcards + 1 MCQ). Teacher/admin only.
 */
function addMiniRevisionAppendix(doc, sections, practiceMcq) {
  const rs = sections?.revisionSheet;
  const flashcards = Array.isArray(rs?.flashcards) ? rs.flashcards : [];
  const toShow = flashcards.slice(0, 4);
  if (toShow.length === 0 && !practiceMcq) return;

  addSectionHeader(doc, "Mini revision appendix");
  if (toShow.length > 0) {
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#334155");
    doc.text("Flashcard prompts", MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.25);
    toShow.forEach((f, i) => {
      ensureSpace(doc, 28);
      doc.font("Helvetica").fillColor("#475569");
      doc.text(`${i + 1}. ${safeSlice(f?.front, 150)}`, MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.1);
      doc.text(`   → ${safeSlice(f?.back, 120)}`, MARGIN, doc.y, { width: CONTENT_WIDTH - 10, indent: 10 });
      doc.moveDown(0.2);
    });
  }
  if (practiceMcq && typeof practiceMcq === "object") {
    doc.moveDown(0.3);
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#334155");
    doc.text("Quick check", MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(0.2);
    doc.font("Helvetica").fillColor("#475569");
    const q = toText(practiceMcq.question ?? practiceMcq.stem ?? "").slice(0, 200);
    doc.text(`Q: ${q}`, MARGIN, doc.y, { width: CONTENT_WIDTH });
    const opts = practiceMcq.options || practiceMcq.choices || [];
    if (Array.isArray(opts) && opts.length > 0) {
      opts.forEach((o, i) => {
        doc.text(`  ${String.fromCharCode(65 + i)}. ${toText(o).slice(0, 100)}`, MARGIN, doc.y, { width: CONTENT_WIDTH - 10, indent: 10 });
      });
    }
    const ans = practiceMcq.correctAnswer ?? practiceMcq.answer;
    if (ans) doc.text(`Answer: ${toText(ans)}`, MARGIN, doc.y, { width: CONTENT_WIDTH - 10, indent: 10 });
  }
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
  includeEvidenceAppendix = true,
  includeNextSteps = true,
  includeMiniRevisionAppendix = false,
  evidenceQuoteChars = 180,
  topicSummaryLogId,
}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: "A4", margin: MARGIN });
    doc.on("data", (chunk) => chunks.push(chunk));
    let renderedPages = 1;
    doc.on("end", () => {
      const buffer = Buffer.concat(chunks);
      if (process.env.NODE_ENV === "development" && process.env.NODE_ENV !== "test") {
        console.log(
          `[topicSummaryPdf] summaryChars=${summaryPayload?.summary?.length ?? 0} keyPoints=${summaryPayload?.keyPoints?.length ?? 0} citations=${summaryPayload?.citations?.length ?? 0} renderedPages=${renderedPages} bytes=${buffer.length}`
        );
      }
      resolve(buffer);
    });
    doc.on("error", reject);

    let normalized;
    try {
      normalized = normalizeTopicSummaryExportPayload(summaryPayload);
    } catch (err) {
      return reject(err);
    }

    const { summaryText, keyPoints, sections, citations, sourceCounts, suggestedActions, practiceMcq } = normalized;
    const usedSourcesList = usedSources && usedSources.length > 0 ? usedSources : (normalized.usedSources || []);
    const title = formatTopicTitle(topicKey);
    const modeLabel = formatMode(mode);
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    let pageNum = 1;
    const isStudent = (generatedForRole || "").toString().toLowerCase() === "student";
    const maxKeyPoints = isStudent ? 8 : 12;

    const meta = { specKey: specKey || "spec", topicKey: topicKey || "topic", dateStr, pageNum };

    const drawFooter = () => {
      addFooter(doc, meta);
    };

    doc.on("pageAdded", () => {
      pageNum += 1;
      renderedPages = pageNum;
      meta.pageNum = pageNum;
      doc.y = MARGIN;
      drawFooter();
    });

    // Title + subtitle
    addTitle(doc, `Topic summary — ${title}`, `${specKey} • ${modeLabel} • ${dateStr}`);
    doc.y = doc.y + 4;

    // At a glance (PR-026.1)
    addAtAGlance(doc, { modeLabel, confidenceLevel, sourceCounts, dateStr, isStudent });
    if (confidenceReason && !isStudent) {
      doc.fontSize(10).font("Helvetica").fillColor("#64748b");
      doc.text(toText(confidenceReason), MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.moveDown(0.5);
    }

    // Summary
    if (summaryText) {
      addSectionHeader(doc, "Summary");
      addParagraph(doc, summaryText);
    }

    // Key points (expanded) — up to 12 teachers, 8 students
    const expandedKp = deriveExpandedKeyPoints(keyPoints, sections, maxKeyPoints);
    if (expandedKp.length > 0) {
      addSectionHeader(doc, "Key points (expanded)");
      addBullets(doc, expandedKp);
    }

    // Common mistakes & examiner tips (overview mode: synthesize from sections when not in full revision/exam block)
    const rs = sections?.revisionSheet;
    const ef = sections?.examFocus;
    const modeVal = (mode || "").toString().toLowerCase();
    if (modeVal === "overview" && (rs?.commonMistakes?.length || ef?.examTips?.length || ef?.examQuestion?.markScheme)) {
      addCommonMistakesExaminerTips(doc, sections);
    }

    // Mode sections
    const lp = sections.lessonPlan;
    if (lp && Array.isArray(lp.segments) && lp.segments.length > 0) {
      addSectionHeader(doc, `Lesson plan (${toText(lp.durationMinutes || 50)} min)`);
      const rows = lp.segments.map(
        (s) =>
          `${safeSlice(s.minutes, 12)} | ${safeSlice(s.title, 40)} | ${safeSlice(s.activity, 35)} | ${safeSlice(s.checkForUnderstanding, 30)}`
      );
      addKeyValueTable(doc, rows);
    }

    if (rs && typeof rs === "object") {
      addSectionHeader(doc, "Revision sheet");
      const commonMistakes = Array.isArray(rs.commonMistakes) ? rs.commonMistakes : [];
      if (commonMistakes.length > 0) {
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#334155");
        doc.text("Common mistakes", MARGIN, doc.y, { width: CONTENT_WIDTH });
        doc.moveDown(0.25);
        addBullets(doc, commonMistakes, { maxLen: 400 });
      }
      const memoryCues = Array.isArray(rs.memoryCues) ? rs.memoryCues : [];
      if (memoryCues.length > 0) {
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#334155");
        doc.text("Memory cues", MARGIN, doc.y, { width: CONTENT_WIDTH });
        doc.moveDown(0.25);
        addBullets(doc, memoryCues, { maxLen: 400 });
      }
      const flashcards = Array.isArray(rs.flashcards) ? rs.flashcards : [];
      if (flashcards.length > 0) {
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#334155");
        doc.text("Flashcards", MARGIN, doc.y, { width: CONTENT_WIDTH });
        doc.moveDown(0.25);
        flashcards.forEach((f, i) => {
          ensureSpace(doc, 36);
          doc.font("Helvetica").fillColor("#475569");
          doc.text(`${i + 1}. Q: ${safeSlice(f?.front, 150)}`, MARGIN, doc.y, { width: CONTENT_WIDTH });
          doc.moveDown(0.1);
          doc.text(`   A: ${safeSlice(f?.back, 200)}`, MARGIN, doc.y, { width: CONTENT_WIDTH - 10, indent: 10 });
          doc.moveDown(0.25);
        });
      }
    }

    if (ef && typeof ef === "object") {
      addSectionHeader(doc, "Exam focus");
      const commandWords = Array.isArray(ef.commandWords) ? ef.commandWords : [];
      if (commandWords.length > 0) {
        doc.fontSize(11).font("Helvetica").fillColor("#334155");
        doc.text(`Command words: ${commandWords.map(toText).join(", ")}`, MARGIN, doc.y, { width: CONTENT_WIDTH });
        doc.moveDown(0.4);
      }
      if (ef.examQuestion) {
        const eq = ef.examQuestion;
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#334155");
        doc.text("Exam-style question", MARGIN, doc.y, { width: CONTENT_WIDTH });
        doc.moveDown(0.2);
        doc.font("Helvetica").fillColor("#475569");
        addParagraph(doc, safeSlice(eq?.question, 500));
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#334155");
        doc.text("Mark scheme:", MARGIN, doc.y, { width: CONTENT_WIDTH });
        doc.moveDown(0.15);
        doc.font("Helvetica").fillColor("#475569");
        addParagraph(doc, safeSlice(eq?.markScheme, 400));
      }
    }

    // Next steps (PR-026.1)
    if (includeNextSteps) {
      const nextItems = computeNextSteps(suggestedActions, specKey, topicKey);
      addNextStepsSection(doc, nextItems);
    }

    // Evidence appendix (PR-026.1) — includeEvidenceAppendix controls; evidenceQuoteChars for truncation
    if (includeEvidenceAppendix && citations.length > 0) {
      ensureSpace(doc, 80);
      if (doc.y + 80 > CONTENT_BOTTOM) {
        doc.addPage();
        meta.pageNum = ++pageNum;
      }
      addEvidenceAppendix(doc, citations, usedSourcesList, evidenceQuoteChars);
    }

    // Mini revision appendix (teacher/admin only)
    if (includeMiniRevisionAppendix && !isStudent) {
      addMiniRevisionAppendix(doc, sections, practiceMcq);
    }

    drawFooter();
    doc.end();
  });
}

module.exports = { renderTopicSummaryPdf, normalizeTopicSummaryExportPayload };
