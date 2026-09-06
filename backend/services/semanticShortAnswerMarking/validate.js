const { JUDGEMENTS } = require("./constants");
const { evidencePresentInAnswer } = require("./evidence");

/**
 * @param {unknown} raw
 * @param {{ markScheme: string[], studentAnswer: string }} ctx
 * @returns {{ ok: true, points: object[] } | { ok: false, errors: string[] }}
 */
function validateSemanticLlmPoints(raw, ctx) {
  const errors = [];
  const markScheme = ctx.markScheme || [];
  const studentAnswer = String(ctx.studentAnswer ?? "");
  const expectedCount = markScheme.length;

  const points = Array.isArray(raw?.points) ? raw.points : null;
  if (!points) {
    return { ok: false, errors: ["points array missing"] };
  }
  if (points.length !== expectedCount) {
    errors.push(`expected ${expectedCount} points, got ${points.length}`);
  }

  const seen = new Set();
  const normalized = [];

  for (const pt of points) {
    const index = Number(pt?.index);
    if (!Number.isInteger(index) || index < 1 || index > expectedCount) {
      errors.push(`invalid index ${pt?.index}`);
      continue;
    }
    if (seen.has(index)) errors.push(`duplicate index ${index}`);
    seen.add(index);

    const judgement = String(pt?.judgement ?? "").trim();
    if (!JUDGEMENTS.includes(judgement)) {
      errors.push(`invalid judgement at index ${index}`);
      continue;
    }

    const studentEvidence = String(pt?.studentEvidence ?? "").trim();
    const reason = String(pt?.reason ?? "").trim();

    if (judgement === "SATISFIED") {
      if (!studentEvidence) {
        errors.push(`SATISFIED at index ${index} requires studentEvidence`);
      } else if (!evidencePresentInAnswer(studentEvidence, studentAnswer)) {
        errors.push(`studentEvidence not found in answer at index ${index}`);
      }
    }

    if (pt?.awarded !== undefined && pt?.awarded !== null) {
      errors.push(`model must not output awarded at index ${index}`);
    }

    normalized.push({
      index,
      judgement,
      studentEvidence,
      reason,
    });
  }

  for (let i = 1; i <= expectedCount; i += 1) {
    if (!seen.has(i)) errors.push(`missing index ${i}`);
  }

  if (errors.length > 0) return { ok: false, errors };
  normalized.sort((a, b) => a.index - b.index);
  return { ok: true, points: normalized };
}

/**
 * @param {object[]} validatedPoints
 * @param {string[]} markScheme
 * @param {number} effectiveMarks
 */
function deriveMarkingResult(validatedPoints, markScheme, effectiveMarks) {
  const points = validatedPoints.map((pt) => {
    const awarded = pt.judgement === "SATISFIED" ? 1 : 0;
    return {
      index: pt.index,
      markPoint: markScheme[pt.index - 1] || "",
      judgement: pt.judgement,
      awarded,
      studentEvidence: pt.studentEvidence,
      reason: pt.reason,
    };
  });

  const score = Math.min(
    points.filter((p) => p.awarded === 1).length,
    effectiveMarks
  );
  const maxMarks = effectiveMarks;
  const isCorrect = score >= maxMarks;

  const awarded = points.filter((p) => p.judgement === "SATISFIED").map((p) => p.markPoint);
  const missing = points
    .filter((p) => p.judgement === "NOT_EVIDENCED")
    .map((p) => p.markPoint);
  const contradicted = points
    .filter((p) => p.judgement === "CONTRADICTED")
    .map((p) => p.markPoint);

  return {
    score,
    maxMarks,
    isCorrect,
    points,
    feedback: { awarded, missing, contradicted },
  };
}

module.exports = {
  validateSemanticLlmPoints,
  deriveMarkingResult,
};
