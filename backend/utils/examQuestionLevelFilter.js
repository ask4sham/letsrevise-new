const EDexcel_IGCSE_BIOLOGY_SPEC = "edexcel-igcse-biology";

/** Normalize level labels for consistent matching (GCSE, IGCSE, …). */
function normalizeLevelLabel(level) {
  const s = String(level || "").trim();
  if (!s) return "";
  if (/igcse/i.test(s)) return "IGCSE";
  if (/gcse/i.test(s)) return "GCSE";
  if (/a[\s-]?level/i.test(s)) return "A-Level";
  if (/ks\s*3/i.test(s)) return "KS3";
  return s;
}

/** True when the request targets Edexcel IGCSE Biology (4BI1) — not Edexcel GCSE. */
function isEdexcelIgcseBiologyContext(ctx = {}) {
  const specKey = String(ctx.specKey || "").trim().toLowerCase();
  if (specKey === EDexcel_IGCSE_BIOLOGY_SPEC) return true;
  const topicKey = String(ctx.topicKey || "").trim().toLowerCase();
  if (topicKey.startsWith(`${EDexcel_IGCSE_BIOLOGY_SPEC}:`)) return true;
  return false;
}

/**
 * Mongo level filter for exam-question list queries.
 * Edexcel IGCSE Biology: IGCSE searches also match legacy GCSE-labelled rows.
 * AQA GCSE and other specs: exact level match only.
 */
function buildExamQuestionLevelQuery(level, ctx = {}) {
  const normalized = normalizeLevelLabel(level);
  if (!normalized) return undefined;
  if (normalized === "IGCSE" && isEdexcelIgcseBiologyContext(ctx)) {
    return { $in: ["IGCSE", "GCSE"] };
  }
  return normalized;
}

/** Persist canonical level when spec/topicKey identifies Edexcel IGCSE Biology. */
function resolveExamQuestionLevelForSave({ specKey, topicKey, level } = {}) {
  if (isEdexcelIgcseBiologyContext({ specKey, topicKey })) {
    return "IGCSE";
  }
  const normalized = normalizeLevelLabel(level);
  return normalized || undefined;
}

module.exports = {
  EDexcel_IGCSE_BIOLOGY_SPEC,
  normalizeLevelLabel,
  isEdexcelIgcseBiologyContext,
  buildExamQuestionLevelQuery,
  resolveExamQuestionLevelForSave,
};
