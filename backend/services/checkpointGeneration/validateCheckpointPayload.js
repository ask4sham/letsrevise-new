/**
 * Validate and normalise LLM checkpoint output for lesson page.checkpoint shape.
 */

function clampStr(s, max) {
  return String(s ?? "").trim().slice(0, max);
}

function sanitiseAutoMark(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  const strArr = (a, maxLen, maxItems) => {
    if (!Array.isArray(a)) return undefined;
    const out = a
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, maxItems)
      .map((s) => s.slice(0, maxLen));
    return out.length ? out : undefined;
  };
  const canonicalAnswer = typeof raw.canonicalAnswer === "string" ? raw.canonicalAnswer.trim().slice(0, 4000) : "";
  const requiredKeywords = strArr(raw.requiredKeywords, 120, 40);
  const optionalKeywords = strArr(raw.optionalKeywords, 120, 40);
  const forbiddenMisconceptions = strArr(raw.forbiddenMisconceptions, 200, 30);
  const acceptedVariants = strArr(raw.acceptedVariants, 2000, 25);
  let minMatchThreshold = Number(raw.minMatchThreshold);
  if (!Number.isFinite(minMatchThreshold)) minMatchThreshold = 0.6;
  minMatchThreshold = Math.max(0, Math.min(1, minMatchThreshold));
  const hasAny = canonicalAnswer || requiredKeywords || optionalKeywords || forbiddenMisconceptions || acceptedVariants;
  if (!hasAny) return undefined;
  return {
    canonicalAnswer,
    ...(requiredKeywords ? { requiredKeywords } : {}),
    ...(optionalKeywords ? { optionalKeywords } : {}),
    ...(forbiddenMisconceptions ? { forbiddenMisconceptions } : {}),
    ...(acceptedVariants ? { acceptedVariants } : {}),
    minMatchThreshold,
  };
}

/**
 * @param {object[]} rawItems
 * @param {{ pages: { pageId: string }[] }} lessonShape
 * @returns {{ items: object[], issues: { severity: string, code: string, message: string }[], qualityScore: number }}
 */
function validateAndNormalizeCheckpointPayload(rawItems, lessonShape) {
  const issues = [];
  const pageIds = new Set(
    (Array.isArray(lessonShape?.pages) ? lessonShape.pages : []).map((p) => String(p?.pageId || "").trim()).filter(Boolean)
  );

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    issues.push({ severity: "error", code: "EMPTY_ITEMS", message: "No checkpoint items generated" });
    return { items: [], issues, qualityScore: 0 };
  }

  const items = [];
  let errorCount = 0;
  let warnCount = 0;

  for (const raw of rawItems) {
    const pageId = clampStr(raw?.pageId, 200);
    if (!pageId || !pageIds.has(pageId)) {
      issues.push({
        severity: "warning",
        code: "UNKNOWN_PAGE",
        message: `Skipped item: unknown pageId ${pageId}`,
      });
      warnCount++;
      continue;
    }

    const type = raw?.type === "shortExplain" ? "shortExplain" : "mcq";
    const question = clampStr(raw?.question, 2000);

    if (!question || question.length < 8) {
      issues.push({ severity: "error", code: "BAD_QUESTION", message: `Question too short for page ${pageId}` });
      errorCount++;
      continue;
    }

    if (type === "mcq") {
      const options = Array.isArray(raw?.options) ? raw.options.map((o) => clampStr(o, 500)).filter(Boolean).slice(0, 4) : [];
      const answer = clampStr(raw?.answer, 500);
      if (options.length < 2) {
        issues.push({ severity: "error", code: "MCQ_OPTIONS", message: `MCQ needs ≥2 options (${pageId})` });
        errorCount++;
        continue;
      }
      if (!options.some((o) => o === answer)) {
        issues.push({ severity: "error", code: "MCQ_ANSWER_MISMATCH", message: `Answer must match an option (${pageId})` });
        errorCount++;
        continue;
      }
      const markScheme = Array.isArray(raw?.markScheme)
        ? raw.markScheme.map((x) => clampStr(x, 500)).filter(Boolean).slice(0, 20)
        : undefined;
      items.push({
        pageId,
        type: "mcq",
        question,
        options,
        answer,
        ...(markScheme?.length ? { markScheme } : {}),
      });
    } else {
      const markScheme = Array.isArray(raw?.markScheme)
        ? raw.markScheme.map((x) => clampStr(x, 500)).filter(Boolean).slice(0, 20)
        : undefined;
      const autoMark = sanitiseAutoMark(raw?.autoMark);
      if (!autoMark && (!markScheme || markScheme.length === 0)) {
        issues.push({
          severity: "warning",
          code: "SHORT_NO_MARK",
          message: `shortExplain without autoMark/markScheme (${pageId})`,
        });
        warnCount++;
      }
      items.push({
        pageId,
        type: "shortExplain",
        question,
        ...(markScheme?.length ? { markScheme } : {}),
        ...(autoMark ? { autoMark } : {}),
      });
    }
  }

  if (items.length === 0) {
    issues.push({ severity: "error", code: "ALL_REJECTED", message: "All items failed validation" });
    return { items: [], issues, qualityScore: 0 };
  }

  /** Score: start at 1, penalise errors/warnings */
  let score = 1;
  score -= errorCount * 0.2;
  score -= warnCount * 0.05;
  score -= Math.max(0, rawItems.length - items.length) * 0.03;
  if (items.length < Math.min(2, pageIds.size)) score -= 0.15;
  score = Math.max(0, Math.min(1, score));

  return { items, issues, qualityScore: Number(score.toFixed(3)) };
}

module.exports = { validateAndNormalizeCheckpointPayload, sanitiseAutoMark };
