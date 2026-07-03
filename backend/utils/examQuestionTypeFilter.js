/**
 * Mongo type filter for exam-question list queries.
 * Composite questions store type="composite" at the top level; MCQ-ness lives on parts.
 */

function buildExamQuestionTypeQuery(type) {
  const t = String(type || "").trim().toLowerCase();
  if (!t) return null;
  if (t === "mcq") {
    return {
      $or: [{ type: "mcq" }, { type: "composite", "parts.type": "mcq" }],
    };
  }
  return { type: t };
}

function applyExamQuestionTypeFilter(query, type) {
  const clause = buildExamQuestionTypeQuery(type);
  if (!clause) return;
  if (clause.$or) {
    query.$and = query.$and || [];
    query.$and.push({ $or: clause.$or });
    return;
  }
  if (clause.type) {
    query.type = clause.type;
  }
}

module.exports = {
  buildExamQuestionTypeQuery,
  applyExamQuestionTypeFilter,
};
