/**
 * PR-025: Topic summary PDF export — teacher + student (when AI tutor enabled).
 * Body is parsed by express.json(); do NOT call JSON.parse on req.body.
 */
const TopicSummaryLog = require("../models/TopicSummaryLog");
const { renderTopicSummaryPdf, normalizeTopicSummaryExportPayload } = require("../services/pdf/topicSummaryPdf");
const { isAiTutorEnabledForSpec } = require("../config/featureFlags");

function isTeacherOrAdmin(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user?.isAdmin === true;
}

function isStudent(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "student";
}

/**
 * POST /api/topic-summary/export
 * Accepts body as object only. Never JSON.parse req.body (express.json handles it).
 */
async function postTopicSummaryExport(req, res) {
  try {
    let body = req.body;

    // Guard: if body is string (shouldn't be), attempt safe parse once
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: "Invalid JSON" });
      }
    }

    body = body || {};
    const {
      topicSummaryLogId,
      includeCitations,
      includeEvidenceAppendix,
      includeNextSteps,
      includeMiniRevisionAppendix,
      evidenceQuoteChars,
      specKey,
      topicKey,
      mode,
      summary,
      usedSources,
      confidenceLevel,
      confidenceReason,
      keyPoints,
      sections,
    } = body;

    const userId = req.user?._id || req.user?.userId || req.user?.id;
    const role = (req.user?.userType || req.user?.role || "").toString();
    const isTeacher = isTeacherOrAdmin(req);
    const isStudentUser = isStudent(req);

    if (!isTeacher && !isStudentUser) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const spec = (specKey || "").trim();
    const topic = (topicKey || "").trim();
    const modeVal = ["overview", "lessonPlan", "revisionSheet", "examFocus"].includes(mode) ? mode : "overview";
    const includeCites = includeCitations !== false;

    // PR-026.1: Export options with role-based defaults and student caps
    let includeEvidence = includeEvidenceAppendix;
    if (typeof includeEvidence !== "boolean") {
      includeEvidence = isTeacher ? true : false;
    }
    let includeNext = includeNextSteps;
    if (typeof includeNext !== "boolean") {
      includeNext = true;
    }
    let includeMiniRev = includeMiniRevisionAppendix;
    if (typeof includeMiniRev !== "boolean") {
      includeMiniRev = false;
    }
    if (isStudentUser) {
      includeMiniRev = false; // student cap: never allow
    }
    let quoteChars = evidenceQuoteChars;
    if (typeof quoteChars !== "number" || quoteChars < 50 || quoteChars > 500) {
      quoteChars = isTeacher ? 180 : 120;
    }
    if (isStudentUser) {
      quoteChars = Math.min(quoteChars, 120); // student cap
    }

    let summaryPayload, usedSourcesList, confLevel, confReason, finalSpec, finalTopic, finalMode;

    if (topicSummaryLogId) {
      const mongoose = require("mongoose");
      const logIdStr = String(topicSummaryLogId || "").trim();
      if (!logIdStr || !mongoose.Types.ObjectId.isValid(logIdStr)) {
        return res.status(400).json({ error: "Invalid topicSummaryLogId" });
      }
      const log = await TopicSummaryLog.findById(logIdStr).lean();
      if (!log) {
        return res.status(404).json({ error: "Topic summary not found" });
      }
      const logUserId = String(log.userId || "");
      const reqUserId = String(userId || "");
      const canAccess =
        isTeacher ? (role === "admin" || req.user?.isAdmin || logUserId === reqUserId) : logUserId === reqUserId;
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this topic summary" });
      }
      if (isStudent(req) && !isAiTutorEnabledForSpec(log.specKey)) {
        return res.status(403).json({ error: "AI Tutor is not enabled for this course." });
      }
      summaryPayload = {
        summary: typeof log.response?.summary === "string" ? log.response.summary : "",
        keyPoints: Array.isArray(log.response?.keyPoints) ? log.response.keyPoints.map(String) : [],
        sections: log.response?.sections && typeof log.response.sections === "object" ? log.response.sections : {},
        citations: Array.isArray(log.response?.citations) ? log.response.citations : [],
        warnings: Array.isArray(log.response?.warnings) ? log.response.warnings : [],
      };
      usedSourcesList = (log.retrieval?.usedSources || []).map((s) => ({
        knowledgeDocumentId: s.knowledgeDocumentId,
        sourceType: s.sourceType,
        sourceId: s.sourceId,
        title: s.title,
        topicKey: s.topicKey,
      }));
      confLevel = null;
      confReason = null;
      finalSpec = log.specKey;
      finalTopic = log.topicKey;
      finalMode = log.mode || "overview";
    } else {
      // Fallback: require specKey, topicKey, mode, summary, usedSources
      if (!spec || !topic) {
        return res.status(400).json({ error: "Provide topicSummaryLogId or (specKey, topicKey, mode, summary, usedSources)" });
      }
      if (summary === undefined) {
        return res.status(400).json({ error: "Provide topicSummaryLogId or (specKey, topicKey, mode, summary, usedSources)" });
      }
      if (isStudentUser && !isAiTutorEnabledForSpec(spec)) {
        return res.status(403).json({ error: "AI Tutor is not enabled for this course." });
      }

      // summary: if object use summary.summary, else String coercion (no JSON.parse)
      let summaryText = "";
      if (typeof summary === "string") {
        summaryText = summary;
      } else if (summary && typeof summary === "object") {
        summaryText = String(summary.summary ?? "");
      } else {
        summaryText = String(summary ?? "");
      }

      let kpArr, secObj, citArr, warnArr;
      if (summary && typeof summary === "object") {
        kpArr = Array.isArray(summary.keyPoints) ? summary.keyPoints.map((kp) => (typeof kp === "string" ? kp : String(kp))) : [];
        secObj = summary.sections && typeof summary.sections === "object" ? summary.sections : {};
        citArr = Array.isArray(summary.citations) ? summary.citations : [];
        warnArr = Array.isArray(summary.warnings) ? summary.warnings : [];
      } else {
        kpArr = Array.isArray(keyPoints) ? keyPoints.map((kp) => (typeof kp === "string" ? kp : String(kp))) : [];
        secObj = sections && typeof sections === "object" ? sections : {};
        citArr = [];
        warnArr = [];
      }

      const scFallback = (bodySourceCounts && typeof bodySourceCounts === "object") || (summary && typeof summary === "object" && summary.confidenceSignals?.sources);
      const sc = scFallback && typeof scFallback === "object" ? scFallback : {};
      summaryPayload = {
        summary: summaryText,
        keyPoints: kpArr,
        sections: secObj,
        citations: citArr,
        warnings: warnArr,
        sourceCounts: {
          spec: sc.spec ?? 0,
          lesson: sc.lesson ?? 0,
          note: sc.note ?? sc.teacherNote ?? 0,
          external: sc.external ?? 0,
          total: sc.total ?? 0,
        },
        suggestedActions: Array.isArray(bodySuggestedActions) ? bodySuggestedActions : (summary && typeof summary === "object" && Array.isArray(summary.suggestedActions) ? summary.suggestedActions : undefined),
        practiceMcq: (bodyPracticeMcq && typeof bodyPracticeMcq === "object") || (summary && typeof summary === "object" && summary.practiceMcq && typeof summary.practiceMcq === "object") ? (bodyPracticeMcq || summary?.practiceMcq) : undefined,
      };
      usedSourcesList = Array.isArray(usedSources) ? usedSources : [];
      confLevel = confidenceLevel || null;
      confReason = confidenceReason || null;
      finalSpec = spec;
      finalTopic = topic;
      finalMode = modeVal;
    }

    let buffer;
    try {
      buffer = await renderTopicSummaryPdf({
        specKey: finalSpec,
        topicKey: finalTopic,
        mode: finalMode,
        generatedForRole: role,
        confidenceLevel: confLevel,
        confidenceReason: confReason,
        summaryPayload,
        usedSources: usedSourcesList,
        includeCitations: includeCites,
        includeEvidenceAppendix: includeEvidence,
        includeNextSteps: includeNext,
        includeMiniRevisionAppendix: includeMiniRev,
        evidenceQuoteChars: quoteChars,
        topicSummaryLogId: topicSummaryLogId || undefined,
      });
    } catch (pdfErr) {
      if (pdfErr.status === 400 || pdfErr.code === "MISSING_CONTENT") {
        return res.status(400).json({
          error: "Missing content",
          message: pdfErr.message || "Topic summary has no content to export.",
        });
      }
      if (process.env.NODE_ENV !== "production") {
        console.error("[topicSummaryExport] error", pdfErr);
      }
      return res.status(500).json({ error: "PDF render failed" });
    }

    const safeSpec = (finalSpec || "spec").replace(/[^a-zA-Z0-9-_]/g, "_");
    const safeTopic = (finalTopic || "topic").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 40);
    const safeMode = (finalMode || "overview").replace(/[^a-zA-Z0-9-_]/g, "_");
    const filename = `LetsRevise_TopicSummary_${safeSpec}_${safeTopic}_${safeMode}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[topicSummaryExport] error", err);
    }
    return res.status(500).json({ error: "PDF render failed" });
  }
}

module.exports = { postTopicSummaryExport };
