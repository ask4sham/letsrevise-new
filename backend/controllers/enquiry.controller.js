/**
 * PR-004: Enquiry (RAG) controller.
 * PR-006: Caching, deep links, enquiryLogId.
 */
const { verifyCitations } = require("../utils/citationVerification");
const { searchKnowledge } = require("../services/knowledge/knowledgeSearchService");
const {
  generateEnquiryAnswer,
  getProvider: getLlmProvider,
  ENQUIRY_GENERAL_KNOWLEDGE_NOTICE,
} = require("../services/llm/provider");
const { isTruthyEnv } = require("../config/storage");
const { getProvider: getEmbeddingsProvider } = require("../services/embeddings/provider");
const { getCached, setCached } = require("../services/enquiry/enquiryCache");
const { buildSuggestedActions } = require("../services/enquiry/suggestedActions");
const { buildLearningSuggestions } = require("../services/enquiry/learningSuggestions");
const { computeConfidence } = require("../services/enquiry/confidence");
const { upsertStudentTopicProgressSignal } = require("../services/progress/studentTopicProgressService");
const { isExternalSearchEnabled, getExternalAllowedDomains, getExternalMaxResults, getDomainsForQuery, isExamContextQuery } = require("../config/externalSearch");
const { searchWeb } = require("../services/externalSearch/provider");
const { filterDenied, isDenied } = require("../services/externalSearch/policyService");
const { indexExternalResults, embedExternalDocs } = require("../services/knowledge/indexers/externalTrustedIndexer");
const EnquiryLog = require("../models/EnquiryLog");
const { sendInternalError } = require("../utils/safeErrorResponse");
const Conversation = require("../models/Conversation");
const ConversationMessage = require("../models/ConversationMessage");

const WEAK_SCORE_THRESHOLD = 0.35;
const CONVERSATION_CONTEXT_PAIRS = 3; // last 3 user+assistant pairs = 6 messages

const DEBUG_ENQUIRY = process.env.DEBUG_ENQUIRY === "1" || process.env.DEBUG_ENQUIRY === "true";

const ENQUIRY_MODES = new Set(["lesson", "revision", "exam"]);
const RESPONSE_MODES = new Set(["quick", "explain", "exam", "revision"]);
const PRACTICE_TYPES = new Set(["mcq", "short", "exam", "flashcard"]);

function normalizeEnquiryMode(mode) {
  const raw = mode != null ? String(mode).trim() : "";
  return ENQUIRY_MODES.has(raw) ? raw : null;
}

/** Safe for cache keys + LLM constraints (must not be a non-string type). */
function normalizeResponseMode(rm) {
  const raw = rm != null ? String(rm).trim().toLowerCase() : "";
  return RESPONSE_MODES.has(raw) ? raw : null;
}

/** Avoid Mongoose enum validation errors on EnquiryLog.response.practice[].type */
function sanitizePracticeForEnquiryLog(practice) {
  if (!Array.isArray(practice)) return [];
  return practice
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      const t = String(p.type || "short").toLowerCase();
      const type = PRACTICE_TYPES.has(t) ? t : "short";
      if (type === "flashcard") {
        return {
          type,
          front: String(p.front != null ? p.front : "").slice(0, 500),
          back: String(p.back != null ? p.back : "").slice(0, 800),
        };
      }
      return {
        type,
        question: p.question != null ? String(p.question) : "",
        options: Array.isArray(p.options) ? p.options.map((x) => String(x)) : undefined,
        answer: p.answer != null ? String(p.answer) : "",
        markScheme: p.markScheme != null ? String(p.markScheme) : undefined,
      };
    })
    .filter(Boolean);
}

/**
 * POST /api/enquiry handler.
 */
async function handleEnquiry(req, res) {
  try {
    if (DEBUG_ENQUIRY) {
      const b = req.body || {};
      console.log("[enquiry/post] body (sanitized)", {
        specKey: b.specKey,
        topicKey: b.topicKey,
        mode: b.mode,
        limit: b.limit,
        conversationId: b.conversationId ? String(b.conversationId).slice(0, 24) + "…" : undefined,
        responseMode: b.responseMode,
        allowExternal: b.allowExternal,
        qLen: typeof b.question === "string" ? b.question.length : 0,
      });
    }

    const userRoleLower = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
    const userRoleForLog = (req.user?.userType || req.user?.role || "").toString();
    const isStudentUser = userRoleLower === "student";

    let { question, specKey, topicKey, mode, limit = 8, includePractice = true, conversationId, responseMode, allowExternal } = req.body || {};
    topicKey = topicKey != null ? String(topicKey).trim() : topicKey;
    responseMode = normalizeResponseMode(responseMode);

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

    const isTeacherOrAdmin = userRoleLower === "teacher" || userRoleLower === "admin";
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
    const modeVal = normalizeEnquiryMode(mode);

    // PR-006: Check cache before retrieval + LLM (PR-019: conversationId, PR-020: responseMode, PR-021: allowExternal in key)
    const cached = await getCached(spec, topicKey || null, modeVal, q, convIdValid, responseMode, allowExternalVal);
    if (cached.hit && cached.response) {
      const userId = req.user?._id || req.user?.userId || req.user?.id;
      const msgCount = await (convIdValid
        ? ConversationMessage.countDocuments({ conversationId: convIdValid })
        : Promise.resolve(0));
      const turnIndex = Math.floor(msgCount / 2);

      const logDoc = await EnquiryLog.create({
        userId,
        role: userRoleForLog,
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
          practice: sanitizePracticeForEnquiryLog(cached.response.answer?.practice || []),
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
      const confidence = computeConfidence({
        usedSources: usedSourcesCached,
        retrievalScores: usedSourcesCached.map((s) => s.score).filter((n) => typeof n === "number"),
        warnings: answerCached.warnings || [],
      });
      const suggestedActions = buildSuggestedActions({
        role: (req.user?.userType || req.user?.role || "").toString(),
        specKey: spec,
        topicKey: topicKey || null,
        usedSources: usedSourcesCached,
        answer: answerCached,
        confidenceLevel: confidence.confidenceLevel,
        allowExternal: !!cached.response.externalUsed,
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
        if (cached.response.externalExamContextUsed) {
          cachePayload.externalExamContextUsed = true;
        }
      }
      // PR-038: Update student topic progress (aiEnquiries, weakAiEnquiries)
      if (isStudentUser && topicKey) {
        const uid = req.user?._id || req.user?.userId || req.user?.id;
        const weak = confidence.confidenceLevel === "weak" ||
          (Array.isArray(answerCached.warnings) && answerCached.warnings.some((w) =>
            typeof w === "string" && w.toLowerCase().includes("insufficient trusted sources")));
        (async () => {
          await upsertStudentTopicProgressSignal({ userId: uid, specKey: spec, topicKey, signalType: "aiEnquiries", value: 1 });
          if (weak) await upsertStudentTopicProgressSignal({ userId: uid, specKey: spec, topicKey, signalType: "weakAiEnquiries", value: 1 });
        })().catch(() => {});
      }
      return res.json(cachePayload);
    }

    if (DEBUG_ENQUIRY) console.log("[enquiry/post] before searchKnowledge");
    let retrievalResults = await searchKnowledge({
      query: q,
      specKey: spec,
      topicKey: topicKey || undefined,
      limit: topN,
      topK: 50,
    });
    if (DEBUG_ENQUIRY) console.log("[enquiry/post] after searchKnowledge", { count: retrievalResults?.length ?? 0 });

    let externalUsed = false;
    let externalSources = [];

    // PR-021: External search fallback — only when weak, teacher/admin, allowExternal, feature enabled
    // PR-022: filterDenied before indexing; if all denied, keep externalUsed=false
    if (
      (retrievalResults.length === 0 || (retrievalResults[0]?.score ?? 0) < WEAK_SCORE_THRESHOLD) &&
      isTeacherOrAdmin &&
      allowExternalVal &&
      isExternalSearchEnabled()
    ) {
      const searchQuery = `${q} ${spec} ${topicKey || ""}`.trim();
      const baseDomains = getExternalAllowedDomains();
      const domains = getDomainsForQuery(q, baseDomains);
      const extResultsRaw = await searchWeb({
        query: searchQuery,
        domains,
        limit: getExternalMaxResults(),
      });
      const extResults = await filterDenied(extResultsRaw);
      if (extResults.length > 0) {
        const indexed = await indexExternalResults({
          results: extResults,
          specKey: spec,
          topicKey: topicKey || null,
        });
        await embedExternalDocs(indexed);
        retrievalResults = await searchKnowledge({
          query: q,
          specKey: spec,
          topicKey: topicKey || undefined,
          limit: topN,
          topK: 50,
        });
        externalUsed = true;
        externalSources = indexed.map((x) => ({ url: x.url, title: x.title, domain: x.domain }));
      }
    }

    const externalExamContextUsed = externalUsed && isExamContextQuery(q);

    // PR-022: Filter out externalTrusted that are now denied (may have been indexed before policy)
    const retrievalFiltered = [];
    for (const r of retrievalResults) {
      if (r.sourceType === "externalTrusted") {
        const denied = await isDenied({
          url: r.metadata?.url,
          domain: r.metadata?.domain,
        });
        if (denied) continue;
      }
      retrievalFiltered.push(r);
    }
    retrievalResults = retrievalFiltered;

    const topScore = retrievalResults.length > 0 ? retrievalResults[0].score : 0;
    const weakEvidence = retrievalResults.length === 0 || topScore < WEAK_SCORE_THRESHOLD;
    const strictCurriculumOnly = isTruthyEnv("STRICT_CURRICULUM_ONLY");
    const useGeneralKnowledgeFallback = !strictCurriculumOnly && weakEvidence;

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

    if (DEBUG_ENQUIRY) {
      console.log("[enquiry/post] before generateEnquiryAnswer", {
        chunks: contextChunks.length,
        useGeneralKnowledgeFallback,
        strictCurriculumOnly,
      });
    }
    let answer = await generateEnquiryAnswer({
      question: q,
      contextChunks,
      constraints: {
        weakEvidence: weakEvidence && !useGeneralKnowledgeFallback,
        generalKnowledgeFallback: useGeneralKnowledgeFallback,
        specKey: spec,
        topicKey: topicKey || null,
        includePractice,
        studentMode: isStudentUser,
        conversationContext: conversationContext.length > 0 ? conversationContext : undefined,
        responseMode: responseMode || undefined,
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
    if (useGeneralKnowledgeFallback) {
      const notice = ENQUIRY_GENERAL_KNOWLEDGE_NOTICE;
      const w = answer.warnings || [];
      if (!w.some((x) => typeof x === "string" && x.includes("general knowledge"))) {
        answer.warnings = [notice, ...w];
      }
    }

    const userId = req.user?._id || req.user?.userId || req.user?.id;

    const logEntry = {
      userId,
      role: userRoleForLog,
      question: q,
      specKey: spec,
      topicKey: topicKey || null,
      mode: modeVal,
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
        practice: sanitizePracticeForEnquiryLog(answer.practice || []),
        citations: answer.citations || [],
        warnings: answer.warnings || [],
      },
      provider: {
        llm: getLlmProvider(),
        embeddings: getEmbeddingsProvider(),
      },
      ...(externalUsed && {
        externalUsed: true,
        externalSources: externalSources,
        ...(externalExamContextUsed && { externalExamContextUsed: true }),
      }),
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

    const usedSourcesPayload = retrievalResults.slice(0, topN).map((r) => {
      const base = {
        knowledgeDocumentId: r.knowledgeDocumentId,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        title: r.title,
        topicKey: r.topicKey,
        score: Math.round(r.score * 1000) / 1000,
      };
      if (r.sourceType === "externalTrusted") {
        const url = r.metadata?.url && String(r.metadata.url).trim();
        base.url = url || (r.metadata?.domain ? `https://${r.metadata.domain}` : "#");
      }
      return base;
    });

    const confidence = computeConfidence({
      usedSources: usedSourcesPayload,
      retrievalScores: retrievalResults.slice(0, topN).map((s) => s.score).filter((n) => typeof n === "number"),
      warnings: answer.warnings || [],
    });

    const suggestedActions = buildSuggestedActions({
      role: (req.user?.userType || req.user?.role || "").toString(),
      specKey: spec,
      topicKey: topicKey || null,
      usedSources: usedSourcesPayload,
      answer: {
        practice: answer.practice,
        warnings: answer.warnings,
      },
      confidenceLevel: confidence.confidenceLevel,
      allowExternal: allowExternalVal,
    });

    const roleStr = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
    const learningSuggestions =
      roleStr === "student"
        ? await buildLearningSuggestions({
            specKey: spec,
            topicKey: topicKey || null,
            role: roleStr,
            confidenceLevel: confidence.confidenceLevel,
            warnings: answer.warnings || [],
            limit: 3,
          })
        : [];

    // PR-006: Store in cache (PR-037: learningSuggestions)
    await setCached(spec, topicKey || null, modeVal, q, {
      question: q,
      usedSources: usedSourcesPayload,
      answer: {
        explanation: answer.explanation,
        keyPoints: answer.keyPoints,
        citations: answer.citations,
        practice: answer.practice,
        warnings: answer.warnings,
      },
      ...(externalUsed && {
        externalUsed: true,
        externalSources,
        ...(externalExamContextUsed && { externalExamContextUsed: true }),
      }),
      ...(learningSuggestions.length > 0 && { learningSuggestions }),
    }, convIdValid, responseMode, allowExternalVal);

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
      if (externalExamContextUsed) responsePayload.externalExamContextUsed = true;
    }
    if (suggestedTopics.length > 0) {
      responsePayload.suggestedTopics = suggestedTopics;
    }
    if (learningSuggestions.length > 0) {
      responsePayload.learningSuggestions = learningSuggestions;
    }
    if (useGeneralKnowledgeFallback) {
      responsePayload.confidence = "low";
      responsePayload.source = "fallback_ai";
      responsePayload.fallbackNotice = ENQUIRY_GENERAL_KNOWLEDGE_NOTICE;
    }
    // PR-038: Update student topic progress (aiEnquiries, weakAiEnquiries)
    if (isStudentUser && topicKey) {
      const uid = req.user?._id || req.user?.userId || req.user?.id;
      const weak = confidence.confidenceLevel === "weak" ||
        (Array.isArray(answer.warnings) && answer.warnings.some((w) =>
          typeof w === "string" && w.toLowerCase().includes("insufficient trusted sources")));
      (async () => {
        await upsertStudentTopicProgressSignal({ userId: uid, specKey: spec, topicKey, signalType: "aiEnquiries", value: 1 });
        if (weak) await upsertStudentTopicProgressSignal({ userId: uid, specKey: spec, topicKey, signalType: "weakAiEnquiries", value: 1 });
      })().catch(() => {});
    }
    return res.json(responsePayload);
  } catch (err) {
    console.error("Enquiry error:", err);
    return sendInternalError("enquiry/post", err, res);
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
    return sendInternalError("enquiry/feedback", err, res);
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
    return sendInternalError("enquiry/action", err, res);
  }
}

module.exports = { handleEnquiry, handleEnquiryFeedback, handleEnquiryAction };
