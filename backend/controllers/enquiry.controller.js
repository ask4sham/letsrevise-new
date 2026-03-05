/**
 * PR-004: Enquiry (RAG) controller.
 * PR-006: Caching, deep links, enquiryLogId.
 */
const { searchKnowledge } = require("../services/knowledge/knowledgeSearchService");
const { generateEnquiryAnswer, getProvider: getLlmProvider } = require("../services/llm/provider");
const { getProvider: getEmbeddingsProvider } = require("../services/embeddings/provider");
const { getCached, setCached } = require("../services/enquiry/enquiryCache");
const { buildSuggestedActions } = require("../services/enquiry/suggestedActions");
const { computeConfidence } = require("../services/enquiry/confidence");
const { isExternalSearchEnabled, getExternalAllowedDomains, getExternalMaxResults } = require("../config/externalSearch");
const { searchWeb } = require("../services/externalSearch/provider");
const { indexExternalResults, embedExternalDocs } = require("../services/knowledge/indexers/externalTrustedIndexer");
const EnquiryLog = require("../models/EnquiryLog");
const Conversation = require("../models/Conversation");
const ConversationMessage = require("../models/ConversationMessage");

const WEAK_SCORE_THRESHOLD = 0.35;
const CONVERSATION_CONTEXT_PAIRS = 3; // last 3 user+assistant pairs = 6 messages

/**
 * Verify citations: cited knowledgeDocumentId must be in retrieved set,
 * and quote must appear (approx) in that document's text.
 * @param {Array} citations - from LLM
 * @param {Map<string, { text }>} docMap - retrieved docs by id
 * @returns {{ valid: Array, warnings: string[] }}
 */
function verifyCitations(citations, docMap) {
  const valid = [];
  const warnings = [];

  for (const c of citations || []) {
    const id = c?.knowledgeDocumentId ? String(c.knowledgeDocumentId).trim() : null;
    if (!id) continue;
    const doc = docMap.get(id);
    if (!doc) continue;

    const quote = (c.quote || "").trim();
    const meta = doc.metadata || {};
    const blockIndex =
      meta.blockIndexStart != null ? meta.blockIndexStart : meta.blockIndex;
    const deepLink =
      (c.sourceType || doc.sourceType) === "lessonBlock" && doc.sourceId
        ? {
            type: "lesson",
            lessonId: String(doc.sourceId),
            pageIndex: meta.pageIndex,
            pageId: meta.pageId,
            blockIndex: blockIndex != null ? blockIndex : 0,
            ...(meta.blockIndexEnd != null && { blockIndexEnd: meta.blockIndexEnd }),
          }
        : null;

    const citationBase = {
      knowledgeDocumentId: id,
      sourceType: c.sourceType || doc.sourceType,
      sourceId: c.sourceId || doc.sourceId,
      quote: quote ? quote.slice(0, 200) : (doc.text || "").slice(0, 200),
      reason: c.reason || "",
      ...(deepLink && { deepLink }),
      ...(doc.sourceType === "externalTrusted" && {
        externalUrl: (meta.url && String(meta.url).trim()) || (meta.domain ? `https://${meta.domain}` : "#"),
      }),
    };

    if (!quote) {
      valid.push(citationBase);
      continue;
    }

    const docText = (doc.text || "").toLowerCase();
    const quoteNorm = quote.toLowerCase().replace(/\s+/g, " ").trim();
    const snippet = quoteNorm.slice(0, 150);
    if (docText.includes(snippet) || snippet.split(" ").every((w) => docText.includes(w))) {
      valid.push(citationBase);
    }
  }

  const dropped = (citations || []).length - valid.length;
  if (dropped > 0) {
    warnings.push("Some citations could not be verified");
  }

  return { valid, warnings };
}

/**
 * POST /api/enquiry handler.
 */
async function handleEnquiry(req, res) {
  try {
    const role = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
    const isStudentUser = role === "student";

    let { question, specKey, topicKey, mode, limit = 8, includePractice = true, conversationId, responseMode } = req.body || {};

    // PR-019: Resolve conversationId and load context (fallback to single-turn if invalid)
    let conversationContext = [];
    let convIdValid = null;
    if (conversationId && String(conversationId).trim()) {
      const mongoose = require("mongoose");
      if (mongoose.Types.ObjectId.isValid(conversationId)) {
        const conv = await Conversation.findById(conversationId).lean();
        const userId = req.user?._id || req.user?.userId || req.user?.id;
        const convUserId = String(conv?.userId || "");
        const reqUserId = String(userId || "");
        const isAdmin = (req.user?.userType || req.user?.role || "").toString().toLowerCase() === "admin" || req.user?.isAdmin === true;
        if (conv && (convUserId === reqUserId || isAdmin)) {
          convIdValid = conversationId;
          const messages = await ConversationMessage.find({ conversationId })
            .sort({ createdAt: -1 })
            .limit(CONVERSATION_CONTEXT_PAIRS * 2)
            .lean();
          conversationContext = messages.reverse().map((m) => ({ role: m.role, text: m.text || "" }));
        }
      }
    }

    // PR-007: Student-safe mode — force constraints
    // PR-021: Students never get external search
    if (isStudentUser) {
      mode = "lesson";
      limit = Math.min(6, parseInt(limit, 10) || 6);
      includePractice = true;
      allowExternal = false;
    }

    const isTeacherOrAdmin = role === "teacher" || role === "admin";
    const allowExternalVal = allowExternal === true && isTeacherOrAdmin;

    const q = question != null ? String(question).trim() : "";
    if (!q) {
      return res.status(400).json({ error: "question is required" });
    }
    const spec = specKey != null ? String(specKey).trim() : "";
    if (!spec) {
      return res.status(400).json({ error: "specKey is required" });
    }

    const topN = Math.min(20, Math.max(1, parseInt(limit, 10) || 8));
    const modeVal = mode != null ? String(mode).trim() : null;

    // PR-006: Check cache before retrieval + LLM (PR-019: conversationId, PR-020: responseMode in key)
    const cached = await getCached(spec, topicKey || null, modeVal, q, convIdValid, responseMode);
    if (cached.hit && cached.response) {
      const userId = req.user?._id || req.user?.userId || req.user?.id;
      const role = (req.user?.userType || req.user?.role || "").toString();
      const msgCount = await (convIdValid
        ? ConversationMessage.countDocuments({ conversationId: convIdValid })
        : Promise.resolve(0));
      const turnIndex = Math.floor(msgCount / 2);

      const logDoc = await EnquiryLog.create({
        userId,
        role,
        question: q,
        specKey: spec,
        topicKey: topicKey || null,
        mode: modeVal,
        conversationId: convIdValid || undefined,
        turnIndex,
        cached: true,
        retrieval: { query: q, topK: 0, results: [] },
        response: {
          explanation: cached.response.answer?.explanation || "",
          keyPoints: cached.response.answer?.keyPoints || [],
          practice: cached.response.answer?.practice || [],
          citations: cached.response.answer?.citations || [],
          warnings: cached.response.answer?.warnings || [],
        },
        provider: { llm: getLlmProvider(), embeddings: getEmbeddingsProvider() },
      });

      if (convIdValid) {
        await ConversationMessage.create([
          { conversationId: convIdValid, role: "user", text: q },
          {
            conversationId: convIdValid,
            role: "assistant",
            text: cached.response.answer?.explanation || "",
            enquiryLogId: logDoc._id,
          },
        ]);
        const update = { updatedAt: new Date(), lastMessageAt: new Date() };
        if (msgCount === 0) update.title = String(q).trim().slice(0, 60);
        await Conversation.updateOne({ _id: convIdValid }, { $set: update });
      }

      const usedSourcesCached = cached.response.usedSources || [];
      const answerCached = cached.response.answer || {};
      const suggestedActions = buildSuggestedActions({
        role: (req.user?.userType || req.user?.role || "").toString(),
        specKey: spec,
        topicKey: topicKey || null,
        usedSources: usedSourcesCached,
        answer: answerCached,
      });
      const confidence = computeConfidence({
        usedSources: usedSourcesCached,
        retrievalScores: usedSourcesCached.map((s) => s.score).filter((n) => typeof n === "number"),
        warnings: answerCached.warnings || [],
      });
      const cachePayload = {
        enquiryLogId: logDoc._id?.toString() || null,
        cached: true,
        ...cached.response,
        suggestedActions,
        confidenceLevel: confidence.confidenceLevel,
        confidenceReason: confidence.confidenceReason,
        confidenceSignals: confidence.confidenceSignals,
      };
      if (cached.response.externalUsed) {
        cachePayload.externalUsed = true;
        cachePayload.externalSources = cached.response.externalSources || [];
      }
      return res.json(cachePayload);
    }

    const retrievalResults = await searchKnowledge({
      query: q,
      specKey: spec,
      topicKey: topicKey || undefined,
      limit: topN,
      topK: 50,
    });

    const topScore = retrievalResults.length > 0 ? retrievalResults[0].score : 0;
    const weakEvidence = retrievalResults.length === 0 || topScore < WEAK_SCORE_THRESHOLD;

    // PR-007: suggestedTopics when weak evidence (for "Try these instead")
    const suggestedTopics = [];
    if (weakEvidence && retrievalResults.length > 0 && isStudentUser) {
      const seen = new Set();
      for (const r of retrievalResults.slice(0, 10)) {
        const tk = (r.topicKey || "").trim();
        if (tk && !seen.has(tk)) {
          seen.add(tk);
          suggestedTopics.push({ topicKey: tk, title: r.title || null });
        }
      }
    }

    const contextChunks = retrievalResults.map((r) => ({
      knowledgeDocumentId: r.knowledgeDocumentId,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      title: r.title,
      text: r.text,
      topicKey: r.topicKey,
    }));

    const docMap = new Map(retrievalResults.map((r) => [r.knowledgeDocumentId, r]));

    let answer = await generateEnquiryAnswer({
      question: q,
      contextChunks,
      constraints: {
        weakEvidence,
        includePractice,
        studentMode: isStudentUser,
        conversationContext: conversationContext.length > 0 ? conversationContext : undefined,
        responseMode,
      },
    });

    const { valid: validCitations, warnings: verifyWarnings } = verifyCitations(answer.citations, docMap);
    answer.citations = validCitations;
    if (verifyWarnings.length > 0) {
      answer.warnings = [...(answer.warnings || []), ...verifyWarnings];
    }
    // PR-021: Add external warning; never remove "Insufficient trusted sources"
    if (externalUsed) {
      answer.warnings = [...(answer.warnings || []), "External references used (exploratory)"];
    }

    const userId = req.user?._id || req.user?.userId || req.user?.id;
    const role = (req.user?.userType || req.user?.role || "").toString();

    const logEntry = {
      userId,
      role,
      question: q,
      specKey: spec,
      topicKey: topicKey || null,
      mode: mode || null,
      retrieval: {
        query: q,
        topK: retrievalResults.length,
        results: retrievalResults.slice(0, 20).map((r) => ({
          knowledgeDocumentId: r.knowledgeDocumentId,
          score: r.score,
          sourceType: r.sourceType,
          sourceId: r.sourceId,
          topicKey: r.topicKey,
        })),
      },
      response: {
        explanation: answer.explanation,
        keyPoints: answer.keyPoints || [],
        practice: answer.practice || [],
        citations: answer.citations || [],
        warnings: answer.warnings || [],
      },
      provider: {
        llm: getLlmProvider(),
        embeddings: getEmbeddingsProvider(),
      },
    };

    const logDoc = await EnquiryLog.create(logEntry);

    if (convIdValid) {
        const msgCount = await ConversationMessage.countDocuments({ conversationId: convIdValid });
        await ConversationMessage.create([
          { conversationId: convIdValid, role: "user", text: q },
          {
            conversationId: convIdValid,
            role: "assistant",
            text: answer.explanation || "",
            enquiryLogId: logDoc._id,
          },
        ]);
        const update = { updatedAt: new Date(), lastMessageAt: new Date() };
        if (msgCount === 0) update.title = String(q).trim().slice(0, 60);
        await Conversation.updateOne({ _id: convIdValid }, { $set: update });
      }

    // PR-006: Store in cache for future hits (PR-019: include conversationId in key)
    await setCached(spec, topicKey || null, modeVal, q, {
      question: q,
      usedSources: retrievalResults.slice(0, topN).map((r) => {
        const b = {
          knowledgeDocumentId: r.knowledgeDocumentId,
          sourceType: r.sourceType,
          sourceId: r.sourceId,
          title: r.title,
          topicKey: r.topicKey,
          score: Math.round(r.score * 1000) / 1000,
        };
        if (r.sourceType === "externalTrusted") {
          const url = r.metadata?.url && String(r.metadata.url).trim();
          b.url = url || (r.metadata?.domain ? `https://${r.metadata.domain}` : "#");
        }
        return b;
      }),
      answer: {
        explanation: answer.explanation,
        keyPoints: answer.keyPoints,
        citations: answer.citations,
        practice: answer.practice,
        warnings: answer.warnings,
      },
    }, convIdValid, responseMode);

    const usedSourcesPayload = retrievalResults.slice(0, topN).map((r) => ({
      knowledgeDocumentId: r.knowledgeDocumentId,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      title: r.title,
      topicKey: r.topicKey,
      score: Math.round(r.score * 1000) / 1000,
    }));

    const suggestedActions = buildSuggestedActions({
      role: (req.user?.userType || req.user?.role || "").toString(),
      specKey: spec,
      topicKey: topicKey || null,
      usedSources: usedSourcesPayload,
      answer: {
        practice: answer.practice,
        warnings: answer.warnings,
      },
    });

    const confidence = computeConfidence({
      usedSources: usedSourcesPayload,
      retrievalScores: retrievalResults.slice(0, topN).map((s) => s.score).filter((n) => typeof n === "number"),
      warnings: answer.warnings || [],
    });

    const responsePayload = {
      enquiryLogId: logDoc._id?.toString() || null,
      cached: false,
      question: q,
      specKey: spec,
      topicKey: topicKey || null,
      usedSources: usedSourcesPayload,
      answer: {
        explanation: answer.explanation,
        keyPoints: answer.keyPoints,
        citations: answer.citations,
        practice: answer.practice,
        warnings: answer.warnings,
      },
      suggestedActions,
      confidenceLevel: confidence.confidenceLevel,
      confidenceReason: confidence.confidenceReason,
      confidenceSignals: confidence.confidenceSignals,
    };
    if (externalUsed) {
      responsePayload.externalUsed = true;
      responsePayload.externalSources = externalSources;
    }
    if (suggestedTopics.length > 0) {
      responsePayload.suggestedTopics = suggestedTopics;
    }
    return res.json(responsePayload);
  } catch (err) {
    console.error("Enquiry error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

/**
 * POST /api/enquiry/:id/feedback — store thumbs up/down + optional comment.
 */
async function handleEnquiryFeedback(req, res) {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body || {};

    if (!id) {
      return res.status(400).json({ error: "Enquiry id is required" });
    }
    const validRating = rating === "up" || rating === "down";
    if (!validRating) {
      return res.status(400).json({ error: "rating must be 'up' or 'down'" });
    }

    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid enquiry id" });
    }

    const log = await EnquiryLog.findById(id).lean();
    if (!log) {
      return res.status(404).json({ error: "Enquiry not found" });
    }

    const userId = req.user?._id || req.user?.userId || req.user?.id;
    const isAdminUser =
      (req.user?.userType || req.user?.role || "").toString().toLowerCase() === "admin" ||
      req.user?.isAdmin === true;

    const logUserId = String(log.userId || "");
    const reqUserId = String(userId || "");
    if (logUserId !== reqUserId && !isAdminUser) {
      return res.status(403).json({ error: "Not authorized to set feedback for this enquiry" });
    }

    await EnquiryLog.updateOne(
      { _id: id },
      {
        $set: {
          "feedback.rating": rating,
          "feedback.comment": comment != null ? String(comment).trim() || null : null,
          "feedback.createdAt": new Date(),
        },
      }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("Enquiry feedback error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

/**
 * POST /api/enquiry/:id/action — PR-016b: Log which suggested action was clicked.
 * Auth: same as enquiry (owner or admin).
 */
async function handleEnquiryAction(req, res) {
  try {
    const { id } = req.params;
    const { actionId } = req.body || {};

    if (!id || !actionId || typeof actionId !== "string") {
      return res.status(400).json({ error: "enquiry id and actionId are required" });
    }

    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid enquiry id" });
    }

    const log = await EnquiryLog.findById(id).lean();
    if (!log) {
      return res.status(404).json({ error: "Enquiry not found" });
    }

    const userId = req.user?._id || req.user?.userId || req.user?.id;
    const isAdminUser =
      (req.user?.userType || req.user?.role || "").toString().toLowerCase() === "admin" ||
      req.user?.isAdmin === true;

    const logUserId = String(log.userId || "");
    const reqUserId = String(userId || "");
    if (logUserId !== reqUserId && !isAdminUser) {
      return res.status(403).json({ error: "Not authorized to log action for this enquiry" });
    }

    await EnquiryLog.updateOne(
      { _id: id },
      { $push: { actionClicks: { actionId: String(actionId).slice(0, 100), at: new Date() } } }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("Enquiry action error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

module.exports = { handleEnquiry, handleEnquiryFeedback, handleEnquiryAction };
