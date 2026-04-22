/**
 * PR-031: Weak Evidence Fix Mode — generate draft pack to fix missing spec coverage and weak enquiries.
 * Uses trusted internal sources; optionally externalTrusted when allowExternal + feature enabled.
 */
const SpecStatement = require("../../models/SpecStatement");
const KnowledgeDocument = require("../../models/KnowledgeDocument");
const EnquiryLog = require("../../models/EnquiryLog");
const { searchKnowledge } = require("../knowledge/knowledgeSearchService");
const { generateWeakEvidenceFixPack } = require("../llm/provider");
const { normalizeSpecKey } = require("../../config/featureFlags");
const adminTaxonomyService = require("../adminTaxonomyService");

const VALID_SOURCE_TYPES = ["specStatement", "lessonBlock", "teacherNote", "lessonDiagram"];
const MAX_MISSING_STATEMENTS = 5;
const MAX_WEAK_QUESTIONS = 5;

function getSpecVariants(specKey) {
  const normalized = normalizeSpecKey(specKey);
  const withUnderscores = normalized.replace(/-/g, "_");
  return [...new Set([normalized, withUnderscores])];
}

/**
 * Get top missing statement codes for topic (SpecStatements without KnowledgeDocument).
 */
async function getMissingStatementCodes(specKey, topicKey, maxCount = MAX_MISSING_STATEMENTS) {
  const specVariants = getSpecVariants(specKey);
  const specStatements = await SpecStatement.find({
    specKey: { $in: specVariants },
    topicKey,
  })
    .select("statementCode")
    .lean();

  const coveredCodes = await KnowledgeDocument.distinct("metadata.statementCode", {
    sourceType: "specStatement",
    specKey: { $in: specVariants },
    topicKey,
    "metadata.statementCode": { $exists: true, $ne: "" },
  });
  const coveredSet = new Set(coveredCodes.map((c) => String(c).trim()).filter(Boolean));

  return specStatements
    .filter((s) => !coveredSet.has(String(s.statementCode || "").trim()))
    .map((s) => s.statementCode)
    .filter(Boolean)
    .slice(0, maxCount);
}

/**
 * Get top weak questions from EnquiryLog (Insufficient trusted sources) for topic.
 */
async function getWeakQuestions(specKey, topicKey, windowDays = 14, maxCount = MAX_WEAK_QUESTIONS) {
  const specVariants = getSpecVariants(specKey);
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const weakLogs = await EnquiryLog.find({
    specKey: { $in: specVariants },
    topicKey,
    createdAt: { $gte: since },
    "response.warnings": "Insufficient trusted sources",
  })
    .select("question")
    .lean();

  const questionCounts = {};
  for (const log of weakLogs) {
    const q = String(log.question || "").trim().slice(0, 500);
    if (q) {
      questionCounts[q] = (questionCounts[q] || 0) + 1;
    }
  }

  return Object.entries(questionCounts)
    .map(([question, count]) => ({ question, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxCount)
    .map((x) => x.question);
}

/**
 * Load SpecStatements by codes.
 */
async function loadStatements(specKey, topicKey, statementCodes) {
  const specVariants = getSpecVariants(specKey);
  const query = { specKey: { $in: specVariants }, topicKey };
  if (statementCodes && statementCodes.length > 0) {
    query.statementCode = { $in: statementCodes };
  }
  return SpecStatement.find(query).select("statementCode statementText tier tags").lean();
}

/**
 * Retrieve context chunks. Uses specStatement, lessonBlock, teacherNote, lessonDiagram;
 * adds externalTrusted only when allowExternal and feature enabled.
 */
async function retrieveContext(specKey, topicKey, statements, weakQuestions, allowExternal = false) {
  const sourceTypes = [...VALID_SOURCE_TYPES];
  if (allowExternal) {
    sourceTypes.push("externalTrusted");
  }

  const allChunks = [];
  const seen = new Set();

  // Query 1: statement text prompts
  const keywords = (statements || [])
    .map((s) => (s.statementText || "").slice(0, 100))
    .filter(Boolean)
    .join(" ");
  const topicPart = (topicKey || "").split(":").pop() || topicKey || "";
  const query1 = `${topicPart} ${keywords}`.trim() || topicKey;

  if (query1) {
    try {
      const chunks1 = await searchKnowledge({
        query: query1,
        specKey,
        topicKey,
        sourceTypes,
        limit: 8,
        topK: 25,
      });
      for (const c of chunks1) {
        const id = c.knowledgeDocumentId;
        if (!seen.has(id)) {
          seen.add(id);
          allChunks.push(c);
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV !== "test") {
        console.warn("[weakEvidenceFix] searchKnowledge (statements) failed:", e.message);
      }
    }
  }

  // Query 2: weak questions
  const weakQuery = (weakQuestions || []).slice(0, 2).join(" ").trim();
  if (weakQuery) {
    try {
      const chunks2 = await searchKnowledge({
        query: weakQuery,
        specKey,
        topicKey,
        sourceTypes,
        limit: 6,
        topK: 20,
      });
      for (const c of chunks2) {
        const id = c.knowledgeDocumentId;
        if (!seen.has(id)) {
          seen.add(id);
          allChunks.push(c);
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV !== "test") {
        console.warn("[weakEvidenceFix] searchKnowledge (weak questions) failed:", e.message);
      }
    }
  }

  return allChunks.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 20);
}

/**
 * Run weak evidence fix generation.
 * @param {{ specKey, topicKey, missingStatementCodes?, weakQuestions?, allowExternal?, windowDays?, user }}
 */
async function runWeakEvidenceFixGeneration({
  specKey,
  topicKey,
  missingStatementCodes,
  weakQuestions,
  allowExternal = false,
  windowDays = 14,
  user,
}) {
  const normalized = normalizeSpecKey(specKey);
  if (await adminTaxonomyService.topicIsGroupInMerged(normalized, topicKey)) {
    const err = new Error("TOPIC_IS_GROUP");
    err.code = "TOPIC_IS_GROUP";
    throw err;
  }

  const codes =
    missingStatementCodes && missingStatementCodes.length > 0
      ? missingStatementCodes.slice(0, MAX_MISSING_STATEMENTS)
      : await getMissingStatementCodes(normalized, topicKey);

  const questions =
    weakQuestions && weakQuestions.length > 0
      ? weakQuestions.slice(0, MAX_WEAK_QUESTIONS)
      : await getWeakQuestions(normalized, topicKey, windowDays);

  const statements = await loadStatements(normalized, topicKey, codes);
  const contextChunks = await retrieveContext(normalized, topicKey, statements, questions, allowExternal);

  const pack = await generateWeakEvidenceFixPack({
    specKey: normalized,
    topicKey,
    statementCodes: codes,
    statements,
    weakQuestions: questions,
    contextChunks,
  });

  return {
    pack,
    statements,
    weakQuestions: questions,
    contextChunks,
    inputsUsed: {
      missingStatementCodes: codes,
      weakQuestions: questions,
      allowExternal,
      windowDays,
    },
  };
}

module.exports = {
  runWeakEvidenceFixGeneration,
  getMissingStatementCodes,
  getWeakQuestions,
  loadStatements,
  retrieveContext,
};
