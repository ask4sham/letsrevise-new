/**
 * PR-032: AI Practice Generator — generate draft practice set (quiz, exam, flashcards).
 * Uses trusted retrieval (Spec/Lesson/Notes/Diagrams; external optional for teachers).
 */
const crypto = require("crypto");
const { searchKnowledge } = require("../knowledge/knowledgeSearchService");
const { generatePracticeSet: llmGeneratePracticeSet } = require("../llm/provider");
const { normalizeSpecKey } = require("../../config/featureFlags");
const adminTaxonomyService = require("../adminTaxonomyService");
const {
  createCoverageGenerationGate,
  planCoverageGatedQuestionBatch,
  formatCoveragePlanForPrompt,
} = require("../../../lib/teacherBrain/coverageGatedGeneration");

const VALID_SOURCE_TYPES = ["specStatement", "lessonBlock", "teacherNote", "lessonDiagram"];
const DEFAULT_COUNTS = {
  quizMcq: 5,
  quizShort: 3,
  exam: 2,
  flashcards: 6,
};

/**
 * Retrieve context chunks. Uses specStatement, lessonBlock, teacherNote, lessonDiagram;
 * adds externalTrusted only when allowExternal.
 */
async function retrieveContext(specKey, topicKey, allowExternal = false, includeExamStyle = true) {
  const sourceTypes = [...VALID_SOURCE_TYPES];
  if (allowExternal) {
    sourceTypes.push("externalTrusted");
  }

  const allChunks = [];
  const seen = new Set();

  const topicPart = (topicKey || "").split(":").pop() || topicKey || "";

  // Query 1: core knowledge
  const query1 = `${topicPart} core knowledge key concepts`.trim();
  try {
    const chunks1 = await searchKnowledge({
      query: query1,
      specKey,
      topicKey,
      sourceTypes,
      limit: 10,
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
      console.warn("[practiceSet] searchKnowledge (core) failed:", e.message);
    }
  }

  // Query 2: common misconceptions
  const query2 = `${topicPart} common misconceptions typical mistakes`.trim();
  try {
    const chunks2 = await searchKnowledge({
      query: query2,
      specKey,
      topicKey,
      sourceTypes,
      limit: 8,
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
      console.warn("[practiceSet] searchKnowledge (misconceptions) failed:", e.message);
    }
  }

  // Query 3 (optional): exam style
  if (includeExamStyle) {
    const query3 = `${topicPart} exam style questions mark scheme`.trim();
    try {
      const chunks3 = await searchKnowledge({
        query: query3,
        specKey,
        topicKey,
        sourceTypes,
        limit: 6,
        topK: 15,
      });
      for (const c of chunks3) {
        const id = c.knowledgeDocumentId;
        if (!seen.has(id)) {
          seen.add(id);
          allChunks.push(c);
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV !== "test") {
        console.warn("[practiceSet] searchKnowledge (exam) failed:", e.message);
      }
    }
  }

  return allChunks.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 25);
}

/**
 * Run practice set generation.
 * @param {{ specKey, topicKey, counts?, allowExternal?, seed, user }}
 */
async function runPracticeSetGeneration({
  specKey,
  topicKey,
  counts = {},
  allowExternal = false,
  seed,
  user,
}) {
  const normalized = normalizeSpecKey(specKey);
  const topic = String(topicKey || "").trim();
  if (!normalized || !topic) {
    throw new Error("specKey and topicKey are required");
  }
  if (await adminTaxonomyService.topicIsGroupInMerged(normalized, topic)) {
    const err = new Error("TOPIC_IS_GROUP");
    err.code = "TOPIC_IS_GROUP";
    throw err;
  }

  const effectiveCounts = { ...DEFAULT_COUNTS, ...counts };
  const contextChunks = await retrieveContext(normalized, topic, allowExternal, true);

  const specStatementsCount = contextChunks.filter((c) => c.sourceType === "specStatement").length;
  const isWeakConfidence = contextChunks.length < 4 || specStatementsCount < 2;
  const warnings = [];
  if (isWeakConfidence && !allowExternal) {
    warnings.push("Limited trusted sources; output may be generic. Consider enabling external sources.");
  }

  const topicLabel = topic.split(":").pop() || topic;
  const coverageGate = createCoverageGenerationGate({
    topic: topicLabel,
    subject: "Biology",
    examBoard: "AQA",
    tier: "Higher",
  });
  const flashPlans = planCoverageGatedQuestionBatch(
    coverageGate,
    effectiveCounts.flashcards || 6,
    "retrieval"
  );
  const mcqPlans = planCoverageGatedQuestionBatch(
    coverageGate,
    effectiveCounts.quizMcq || 5,
    "quiz"
  );
  const shortPlans = planCoverageGatedQuestionBatch(
    coverageGate,
    effectiveCounts.quizShort || 3,
    "practice"
  );
  const examPlans = planCoverageGatedQuestionBatch(
    coverageGate,
    effectiveCounts.exam || 2,
    "exam"
  );
  const coveragePlan = formatCoveragePlanForPrompt([
    ...flashPlans,
    ...mcqPlans,
    ...shortPlans,
    ...examPlans,
  ]);

  const pack = await generatePracticeSet({
    specKey: normalized,
    topicKey: topic,
    contextChunks,
    counts: effectiveCounts,
    weakConfidence: isWeakConfidence,
    coveragePlan,
  });

  return {
    pack,
    contextChunks,
    counts: effectiveCounts,
    warnings,
    coverageDiagnostics: coverageGate.diagnostics,
  };
}

module.exports = {
  runPracticeSetGeneration,
  retrieveContext,
  DEFAULT_COUNTS,
};
