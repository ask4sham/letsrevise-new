/**
 * PR-024: Retrieval for topic summaries.
 * Searches specStatement, lessonBlock, teacherNote; optionally externalTrusted when weak + allowExternal.
 */
const { searchKnowledge } = require("../knowledge/knowledgeSearchService");
const { computeConfidence } = require("../enquiry/confidence");
const { isExternalSearchEnabled } = require("../../config/externalSearch");
const { isDenied } = require("../externalSearch/policyService");

const WEAK_SCORE_THRESHOLD = 0.35;
const EXTERNAL_CAP_PERCENT = 0.4;

const MODE_QUERIES = {
  overview: (topicKey) => `${topicKey} overview key facts`,
  lessonPlan: (topicKey) => `${topicKey} teaching plan misconceptions activities`,
  revisionSheet: (topicKey) => `${topicKey} revision key points common mistakes`,
  examFocus: (topicKey) => `${topicKey} exam question mark scheme command words`,
};

/**
 * Retrieve context for topic summary.
 * @param {{
 *   specKey: string,
 *   topicKey: string,
 *   mode: string,
 *   maxSources?: number,
 *   includeSourceTypes?: string[],
 *   allowExternal?: boolean,
 *   userRole?: string
 * }}
 */
async function retrieveTopicSummaryContext({
  specKey,
  topicKey,
  mode = "overview",
  maxSources = 14,
  includeSourceTypes,
  allowExternal = false,
  userRole = "",
}) {
  const spec = (specKey || "").trim();
  const topic = (topicKey || "").trim();
  if (!spec || !topic) {
    return {
      contextChunks: [],
      usedSources: [],
      topScore: null,
      sourceCounts: { spec: 0, lesson: 0, note: 0, external: 0, total: 0 },
      warnings: ["specKey and topicKey are required"],
    };
  }

  const isTeacherOrAdmin = ["teacher", "admin"].includes(String(userRole).toLowerCase());
  const isStudentUser = String(userRole).toLowerCase() === "student";
  const query = (MODE_QUERIES[mode] || MODE_QUERIES.overview)(topic);

  // PR-024.1: Students get specStatement + lessonBlock only; no teacherNote, no external
  // PR-030: Include lessonDiagram for diagram-aware retrieval
  const internalTypes = isStudentUser
    ? ["specStatement", "lessonBlock", "lessonDiagram"]
    : ["specStatement", "lessonBlock", "lessonDiagram", "teacherNote"];

  // Search: topK=50, we filter and slice
  let allResults = await searchKnowledge({
    query,
    specKey: spec,
    topicKey: topic,
    limit: 50,
    topK: 50,
  });

  // Filter out denied externalTrusted
  const filtered = [];
  for (const r of allResults) {
    if (r.sourceType === "externalTrusted") {
      const denied = await isDenied({
        url: r.metadata?.url,
        domain: r.metadata?.domain,
      });
      if (denied) continue;
    }
    filtered.push(r);
  }
  allResults = filtered;

  const internalResults = allResults.filter((r) => internalTypes.includes(r.sourceType));
  const externalResults = isStudentUser ? [] : allResults.filter((r) => r.sourceType === "externalTrusted");

  // Compute confidence from internal-only
  const internalUsed = internalResults.slice(0, maxSources).map((r) => ({
    knowledgeDocumentId: r.knowledgeDocumentId,
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    score: r.score,
    title: r.title,
    topicKey: r.topicKey,
  }));
  const internalScores = internalUsed.map((s) => s.score ?? 0);
  const internalTop = internalScores.length > 0 ? Math.max(...internalScores) : null;
  const internalConfidence = computeConfidence({
    usedSources: internalUsed,
    retrievalScores: internalScores,
    warnings: internalResults.length === 0 ? ["Insufficient trusted sources"] : [],
  });

  let contextChunks = internalResults.slice(0, maxSources).map((r) => ({
    knowledgeDocumentId: r.knowledgeDocumentId,
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    title: r.title,
    text: r.text,
    score: r.score,
    metadata: r.metadata || {},
  }));
  const warnings = [];
  let externalUsed = false;

  // Add external only if: allowExternal, teacher/admin, external search enabled, confidence weak
  if (
    allowExternal &&
    isTeacherOrAdmin &&
    isExternalSearchEnabled() &&
    internalConfidence.confidenceLevel === "weak" &&
    externalResults.length > 0
  ) {
    const maxExternal = Math.floor(maxSources * EXTERNAL_CAP_PERCENT);
    const toAdd = externalResults.slice(0, Math.min(maxExternal, externalResults.length));
    const externalChunks = toAdd.map((r) => ({
      knowledgeDocumentId: r.knowledgeDocumentId,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      title: r.title,
      text: r.text,
      score: r.score,
      metadata: r.metadata || {},
    }));
    contextChunks = [...contextChunks.slice(0, maxSources - toAdd.length), ...externalChunks].slice(0, maxSources);
    externalUsed = true;
    warnings.push("External references used (exploratory)");
  }

  const usedSources = contextChunks.map((c) => ({
    knowledgeDocumentId: c.knowledgeDocumentId,
    sourceType: c.sourceType,
    sourceId: c.sourceId,
    score: c.score,
    title: c.title,
    topicKey: topic,
  }));

  const sourceCounts = {
    spec: contextChunks.filter((c) => c.sourceType === "specStatement").length,
    lesson: contextChunks.filter((c) => c.sourceType === "lessonBlock").length,
    diagram: contextChunks.filter((c) => c.sourceType === "lessonDiagram").length,
    note: contextChunks.filter((c) => c.sourceType === "teacherNote").length,
    external: contextChunks.filter((c) => c.sourceType === "externalTrusted").length,
    total: contextChunks.length,
  };

  const topScore = contextChunks.length > 0
    ? Math.max(...contextChunks.map((c) => c.score ?? 0))
    : null;

  return {
    contextChunks,
    usedSources,
    topScore,
    sourceCounts,
    warnings,
    externalUsed,
  };
}

module.exports = { retrieveTopicSummaryContext };
