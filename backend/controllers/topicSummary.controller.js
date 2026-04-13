/**
 * PR-024: Topic summary controller — teacher/admin + student (PR-024.1, feature-flagged).
 */
const { retrieveTopicSummaryContext } = require("../services/topicSummary/topicSummaryRetrieval");
const { generateTopicSummary, getProvider: getLlmProvider } = require("../services/llm/provider");
const { getProvider: getEmbeddingsProvider } = require("../services/embeddings/provider");
const { computeConfidence } = require("../services/enquiry/confidence");
const { verifyCitations } = require("../utils/citationVerification");
const { getCached, setCached } = require("../services/topicSummary/topicSummaryCache");
const { isAiTutorEnabledForSpec } = require("../config/featureFlags");
const TopicSummaryLog = require("../models/TopicSummaryLog");
const { upsertStudentTopicProgressSignal } = require("../services/progress/studentTopicProgressService");

function isTeacherOrAdmin(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user?.isAdmin === true;
}

function isStudent(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "student";
}

/**
 * POST /api/topic-summary
 */
async function postTopicSummary(req, res) {
  try {
    const role = (req.user?.userType || req.user?.role || "").toString();

    if (!isTeacherOrAdmin(req) && !isStudent(req)) {
      return res.status(403).json({ error: "Teachers and admins only" });
    }

    const {
      specKey,
      topicKey,
      mode = "overview",
      maxSources = 14,
      allowExternal = false,
    } = req.body || {};

    const spec = (specKey || "").trim();
    const topic = (topicKey || "").trim();
    if (!spec || !topic) {
      return res.status(400).json({ error: "specKey and topicKey are required" });
    }

    // PR-024.1: Student gating — only enabled specs
    if (isStudent(req)) {
      if (!isAiTutorEnabledForSpec(spec)) {
        return res.status(403).json({ error: "AI Tutor is not enabled for this course yet." });
      }
    }

    let modeVal = ["overview", "lessonPlan", "revisionSheet", "examFocus"].includes(mode)
      ? mode
      : "overview";
    let maxSrc = Math.min(24, Math.max(1, parseInt(maxSources, 10) || 14));
    let allowExt = allowExternal === true;
    const studentSafe = isStudent(req);

    // PR-024.1: Student constraints
    if (studentSafe) {
      allowExt = false;
      maxSrc = Math.min(10, maxSrc);
      if (!["overview", "revisionSheet"].includes(modeVal)) {
        modeVal = "overview";
      }
    }

    // Cache check
    const cached = await getCached(spec, topic, modeVal, maxSrc, allowExt, studentSafe);
    if (cached.hit && cached.response) {
      const logDoc = await TopicSummaryLog.create({
        userId: req.user?._id || req.user?.userId || req.user?.id,
        role: (req.user?.userType || req.user?.role || "").toString(),
        specKey: spec,
        topicKey: topic,
        mode: modeVal,
        allowExternal: allowExt,
        retrieval: cached.response.retrieval || {},
        response: {
          summary: cached.response.summary?.summary || "",
          keyPoints: cached.response.summary?.keyPoints || [],
          sections: cached.response.summary?.sections || {},
          citations: cached.response.summary?.citations || [],
          warnings: cached.response.summary?.warnings || [],
          confidenceLevel: (cached.response.confidenceLevel || "").toString(),
          confidenceReason: (cached.response.confidenceReason || "").toString(),
        },
        provider: { llmProvider: getLlmProvider(), llmModel: "", embeddingsProvider: getEmbeddingsProvider() },
      });
      return res.json({
        ...cached.response,
        topicSummaryLogId: String(logDoc._id),
        cached: true,
      });
    }

    const { contextChunks, usedSources, topScore, sourceCounts, warnings, externalUsed } =
      await retrieveTopicSummaryContext({
        specKey: spec,
        topicKey: topic,
        mode: modeVal,
        maxSources: maxSrc,
        allowExternal: allowExt,
        userRole: role,
      });

    const confidence = computeConfidence({
      usedSources,
      retrievalScores: contextChunks.map((c) => c.score ?? 0),
      warnings,
    });

    let llmResponse = await generateTopicSummary({
      mode: modeVal,
      specKey: spec,
      topicKey: topic,
      contextChunks,
      constraints: { studentSafe, allowExternal: allowExt },
    });

    const docMap = new Map(
      contextChunks.map((c) => [String(c.knowledgeDocumentId), { ...c, text: c.text, metadata: c.metadata || {}, sourceType: c.sourceType, sourceId: c.sourceId }])
    );
    const { valid: validCitations, warnings: verifyWarnings } = verifyCitations(
      llmResponse.citations || [],
      docMap,
      contextChunks
    );
    llmResponse.citations = studentSafe
      ? validCitations.filter((c) => c.sourceType !== "teacherNote")
      : validCitations;
    if (verifyWarnings.length > 0) {
      llmResponse.warnings = [...(llmResponse.warnings || []), ...verifyWarnings];
    }
    if (externalUsed) {
      llmResponse.warnings = [...(llmResponse.warnings || []), "External references used (exploratory)"];
    }

    // Build usedSources for frontend (with title)
    let usedSourcesForClient = usedSources.map((s) => ({
      knowledgeDocumentId: s.knowledgeDocumentId,
      sourceType: s.sourceType,
      sourceId: String(s.sourceId || ""),
      title: s.title || "",
      topicKey: topic,
      score: s.score ?? 0,
    }));
    if (studentSafe) {
      usedSourcesForClient = usedSourcesForClient.filter((s) => s.sourceType !== "teacherNote");
    }

    const retrievalForLog = {
      usedSources: usedSources.map((s) => ({
        knowledgeDocumentId: s.knowledgeDocumentId,
        sourceType: s.sourceType,
        sourceId: s.sourceId,
        score: s.score,
        title: s.title,
        topicKey: topic,
      })),
      topScore,
      sourceCounts,
    };

    const logDoc = await TopicSummaryLog.create({
      userId: req.user?._id || req.user?.userId || req.user?.id,
      role,
      specKey: spec,
      topicKey: topic,
      mode: modeVal,
      allowExternal: allowExt,
      retrieval: retrievalForLog,
      response: {
        summary: llmResponse.summary,
        keyPoints: llmResponse.keyPoints || [],
        sections: llmResponse.sections || {},
        citations: llmResponse.citations || [],
        warnings: llmResponse.warnings || [],
        confidenceLevel: confidence.confidenceLevel || "",
        confidenceReason: confidence.confidenceReason || "",
      },
      provider: {
        llmProvider: getLlmProvider(),
        llmModel: process.env.LLM_MODEL || "",
        embeddingsProvider: getEmbeddingsProvider(),
      },
    });

    const responsePayload = {
      specKey: spec,
      topicKey: topic,
      mode: modeVal,
      confidenceLevel: confidence.confidenceLevel,
      confidenceReason: confidence.confidenceReason,
      confidenceSignals: confidence.confidenceSignals,
      usedSources: usedSourcesForClient,
      externalUsed: externalUsed || false,
      summary: {
        summary: llmResponse.summary,
        keyPoints: llmResponse.keyPoints || [],
        sections: llmResponse.sections || {},
        citations: llmResponse.citations || [],
        warnings: llmResponse.warnings || [],
      },
      topicSummaryLogId: String(logDoc._id),
      cached: false,
    };

    // PR-038: Update student topic progress (topicSummaries)
    if (studentSafe) {
      const uid = req.user?._id || req.user?.userId || req.user?.id;
      upsertStudentTopicProgressSignal({ userId: uid, specKey: spec, topicKey: topic, signalType: "topicSummaries", value: 1 }).catch(() => {});
    }

    await setCached(spec, topic, modeVal, maxSrc, allowExt, {
      ...responsePayload,
      retrieval: retrievalForLog,
      summary: responsePayload.summary,
    }, studentSafe);

    return res.json(responsePayload);
  } catch (err) {
    console.error("[topicSummary] post:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

module.exports = { postTopicSummary };
