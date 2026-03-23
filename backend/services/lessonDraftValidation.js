/**
 * Curriculum-controlled AI: validation layer for generated lesson drafts.
 * Confirms coverage of spec statements, required keywords, misconceptions, and exam questions.
 */
function safeStr(v, fallback = "") {
  const s = v === undefined || v === null ? "" : String(v);
  return s.trim() ? s.trim() : fallback;
}

/**
 * Extract all text content from a lesson draft (blocks, checkpoint prompts) for keyword/concept search.
 */
function extractDraftText(draft) {
  const parts = [];
  const pages = Array.isArray(draft?.pages) ? draft.pages : [];
  for (const p of pages) {
    const blocks = Array.isArray(p?.blocks) ? p.blocks : [];
    for (const b of blocks) {
      const content = safeStr(b?.content, "");
      const prompt = safeStr(b?.prompt, "");
      if (content) parts.push(content.toLowerCase());
      if (prompt) parts.push(prompt.toLowerCase());
    }
    const cp = p?.checkpoint;
    if (cp?.question) parts.push(safeStr(cp.question, "").toLowerCase());
  }
  return parts.join(" ");
}

/**
 * Check if a required string appears (case-insensitive, substring) in the draft text.
 */
function textContains(draftText, required) {
  if (!required || typeof required !== "string") return true;
  const needle = required.trim().toLowerCase();
  if (!needle) return true;
  return draftText.includes(needle);
}

/**
 * Count blocks by type in a draft.
 */
function countBlocksByType(draft) {
  const counts = { text: 0, keyIdea: 0, examTip: 0, commonMistake: 0, stretch: 0, checkpoint: 0 };
  const pages = Array.isArray(draft?.pages) ? draft.pages : [];
  for (const p of pages) {
    const blocks = Array.isArray(p?.blocks) ? p.blocks : [];
    for (const b of blocks) {
      const t = (b?.type || "text").toString();
      if (counts[t] !== undefined) counts[t]++;
    }
  }
  return counts;
}

/**
 * Detect if draft has a key words block (text containing "key words:" or "key words ").
 */
function hasKeyWordsBlock(draft) {
  const draftText = extractDraftText(draft);
  return /key\s*words\s*[:\s]/i.test(draftText);
}

/**
 * Detect if draft has exam-style Q&A (question/answer pattern in text).
 */
function detectExamStyleQandA(draft) {
  const draftText = extractDraftText(draft);
  return /\b(question|q:?)\s*[\.:]|\b(answer|a:?)\s*[\.:]|mark\s*scheme/i.test(draftText);
}

/**
 * Detect if draft has a markdown comparison table (| Feature | Type A | Type B |).
 */
function hasComparisonTable(draft) {
  const draftText = extractDraftText(draft);
  return /\|[^|]+\|[^|]+\|[^|]+\|/.test(draftText) && /\|[\s-]+\|/.test(draftText);
}

/**
 * Detect if topic suggests comparison/classification is applicable.
 */
function topicSuggestsComparison(topic) {
  if (!topic || typeof topic !== "string") return false;
  const t = topic.toLowerCase();
  return (
    /\btypes?\b/.test(t) ||
    /\bcompare\b/.test(t) ||
    /\bdifferen(ces?|t)\b/.test(t) ||
    /\bvs\.?\b/.test(t) ||
    /\bversus\b/.test(t) ||
    /\bstages?\b/.test(t) ||
    /\badvantages?\b/.test(t) ||
    /\bdisadvantages?\b/.test(t) ||
    /\bmitosis\b/.test(t) ||
    /\bmeiosis\b/.test(t) ||
    /\bosmosis\b/.test(t) ||
    /\bdiffusion\b/.test(t) ||
    /\b(plant|animal)\s*(and|vs|or)\s*(plant|animal)\b/.test(t)
  );
}

/**
 * Detect if topic strongly benefits from a visual/diagram (cells, mitosis, osmosis, etc.).
 */
function topicSuggestsVisual(topic) {
  if (!topic || typeof topic !== "string") return false;
  const t = topic.toLowerCase();
  return (
    /\bcell(s?)\b/.test(t) ||
    /\bmitosis\b/.test(t) ||
    /\bmeiosis\b/.test(t) ||
    /\b(osmosis|diffusion)\b/.test(t) ||
    /\b(diagram|structure|label)\b/.test(t) ||
    /\b(stem\s*cell|organism)\b/.test(t) ||
    /\b(enzyme|respiration|photosynthesis)\b/.test(t)
  );
}

/**
 * Detect if draft has diagram/visual guidance (Draw and label, diagram should show, Notice that, etc.).
 */
function hasDiagramGuidance(draft) {
  const draftText = extractDraftText(draft);
  return (
    /\bdraw\s+and\s+label\b/i.test(draftText) ||
    /\bdiagram\s+should\s+show\b/i.test(draftText) ||
    /\bwhat\s+to\s+notice\b/i.test(draftText) ||
    /\bnotice\s+that\b/i.test(draftText) ||
    /\bcan\s+be\s+visuali(s|z)ed\s+as\b/i.test(draftText) ||
    /\bimagine\s+(that|the)\b/i.test(draftText) ||
    /\blabel(l)?\s+(the|these|x|y|z)\b/i.test(draftText)
  );
}

/**
 * Detect if draft has a worked example with mark allocation (e.g. "1 mark for", "marks for").
 */
function hasWorkedExample(draft) {
  const draftText = extractDraftText(draft);
  return /\b\d+\s*mark(s?)\s+(for|to|if)/i.test(draftText) || /\bmark(s?)\s+for\b/i.test(draftText);
}

/**
 * Count exam-style questions and detect command word variety (describe, explain, compare, evaluate).
 */
function getExamQuestionStats(draft) {
  const draftText = extractDraftText(draft);
  // Count question indicators: "Question 1", "Q1", "Q:", etc.
  const qMatches = draftText.match(/\b(question|q)\s*[:\d]|\bq\d\b/gi);
  const qCount = qMatches ? Math.min(qMatches.length, 10) : 0;

  const hasDescribe = /\bdescribe\b/i.test(draftText);
  const hasExplain = /\bexplain\b/i.test(draftText);
  const hasCompareOrEvaluate = /\b(compare|evaluate)\b/i.test(draftText);
  const hasSuggest = /\bsuggest\b/i.test(draftText);
  const commandWordVariety = [hasDescribe, hasExplain, hasCompareOrEvaluate, hasSuggest].filter(Boolean).length;
  // Need both: 3+ questions and 3 command word types (Describe, Explain, Compare/Evaluate)
  const examQuestionCount = Math.max(qCount, commandWordVariety);

  return { examQuestionCount, commandWordVariety, hasDescribe, hasExplain, hasCompareOrEvaluate, hasSuggest };
}

/**
 * Detect comparison/evaluation language ("compared to", "whereas", "in contrast").
 */
function hasComparisonLanguage(draft) {
  const draftText = extractDraftText(draft);
  return (
    /\bcompared\s+to\b/i.test(draftText) ||
    /\bwhereas\b/i.test(draftText) ||
    /\bin\s+contrast\b/i.test(draftText) ||
    /\bhowever\b/i.test(draftText) ||
    /\bdifference\b/i.test(draftText)
  );
}

/**
 * Approximate content length (character count from all text blocks).
 */
function getContentLength(draft) {
  const draftText = extractDraftText(draft);
  return draftText.length;
}

/** Minimum content length to avoid shallow summaries (approx 1500 chars). */
const MIN_CONTENT_LENGTH = 1500;

/**
 * Count markdown ## subheadings in text block content (for structured teaching sections).
 */
function countSubheadings(draft) {
  let count = 0;
  const pages = Array.isArray(draft?.pages) ? draft.pages : [];
  for (const p of pages) {
    const blocks = Array.isArray(p?.blocks) ? p.blocks : [];
    for (const b of blocks) {
      if (b?.type === "text" || b?.type === "keyIdea") {
        const content = safeStr(b?.content, "");
        const matches = content.match(/^##\s+/gm);
        if (matches) count += matches.length;
      }
    }
  }
  return count;
}

/**
 * Validate a lesson draft against curriculum requirements.
 *
 * @param {Object} draft - Sanitized lesson draft (title, pages, blocks)
 * @param {Object} opts - Validation options
 * @param {string[]} [opts.specPoints] - Spec statements that must be covered (substring check)
 * @param {string[]} [opts.requiredKeywords] - Keywords that must appear in content
 * @param {string[]} [opts.requiredMisconceptions] - Misconception phrases that must appear (e.g. in commonMistake blocks)
 * @param {boolean} [opts.requireExamQuestions=true] - Whether at least one checkpoint/exam-style block is required
 * @param {string} [opts.topic] - Topic string (for comparison-table applicability check)
 *
 * @returns {{ valid: boolean, ...qualityFields, summary: string }}
 */
function validateLessonDraftAgainstCurriculum(draft, opts = {}) {
  const specPoints = Array.isArray(opts.specPoints) ? opts.specPoints : [];
  const requiredKeywords = Array.isArray(opts.requiredKeywords) ? opts.requiredKeywords : [];
  const requiredMisconceptions = Array.isArray(opts.requiredMisconceptions) ? opts.requiredMisconceptions : [];
  const requireExamQuestions = opts.requireExamQuestions !== false;
  const topic = opts.topic != null ? String(opts.topic) : "";

  const draftText = extractDraftText(draft);
  const counts = countBlocksByType(draft);
  const misconceptionCount = counts.commonMistake || 0;
  const examTipCount = counts.examTip || 0;
  const hasKeyWords = hasKeyWordsBlock(draft);
  const hasExamStyleQandA = detectExamStyleQandA(draft);
  const subheadingCount = countSubheadings(draft);
  const hasComparisonTableResult = hasComparisonTable(draft);
  const topicSuggestsComparisonResult = topicSuggestsComparison(topic);
  const needsTableButMissing = topicSuggestsComparisonResult && !hasComparisonTableResult;
  const hasWorkedExampleResult = hasWorkedExample(draft);
  const examStats = getExamQuestionStats(draft);
  const hasComparisonLanguageResult = hasComparisonLanguage(draft);
  const contentLength = getContentLength(draft);
  const contentTooShort = contentLength < MIN_CONTENT_LENGTH;
  const topicSuggestsVisualResult = topicSuggestsVisual(topic);
  const hasDiagramGuidanceResult = hasDiagramGuidance(draft);
  const needsDiagramButMissing = topicSuggestsVisualResult && !hasDiagramGuidanceResult;

  const missingSpecPoints = [];
  for (const sp of specPoints) {
    const phrase = safeStr(sp, "");
    if (!phrase) continue;
    const needle = phrase.toLowerCase();
    if (!draftText.includes(needle)) {
      missingSpecPoints.push(phrase);
    }
  }

  const missingKeywords = [];
  for (const kw of requiredKeywords) {
    const phrase = safeStr(kw, "");
    if (!phrase) continue;
    const needle = phrase.toLowerCase();
    if (!draftText.includes(needle)) {
      missingKeywords.push(phrase);
    }
  }

  const missingMisconceptions = [];
  for (const mc of requiredMisconceptions) {
    const phrase = safeStr(mc, "");
    if (!phrase) continue;
    const needle = phrase.toLowerCase();
    if (!draftText.includes(needle)) {
      missingMisconceptions.push(phrase);
    }
  }

  const hasExamQuestions =
    counts.checkpoint > 0 ||
    (Array.isArray(draft?.pages) && draft.pages.some((p) => p?.checkpoint?.question));

  const valid =
    missingSpecPoints.length === 0 &&
    missingKeywords.length === 0 &&
    missingMisconceptions.length === 0 &&
    (!requireExamQuestions || hasExamQuestions);

  const parts = [];
  if (!valid) {
    if (missingSpecPoints.length > 0)
      parts.push(`${missingSpecPoints.length} spec statement(s) not clearly covered`);
    if (missingKeywords.length > 0)
      parts.push(`${missingKeywords.length} required keyword(s) missing`);
    if (missingMisconceptions.length > 0)
      parts.push(`${missingMisconceptions.length} required misconception(s) missing`);
    if (requireExamQuestions && !hasExamQuestions)
      parts.push("No exam-style questions present");
  }
  const qualityParts = [];
  if (misconceptionCount < 3)
    qualityParts.push(`Fewer than 3 misconceptions (${misconceptionCount} found)`);
  if (examTipCount < 2)
    qualityParts.push(`Fewer than 2 exam tips (${examTipCount} found)`);
  if (!hasKeyWords)
    qualityParts.push("Key words block not detected");
  if (!hasExamStyleQandA && hasExamQuestions)
    qualityParts.push("Exam-style Q&A with answers not detected");
  if (subheadingCount < 4)
    qualityParts.push("Content lacks structured teaching sections (fewer than 4 ## subheadings)");
  if (needsTableButMissing)
    qualityParts.push("Topic suggests comparison — markdown table required but not found");
  if (!hasWorkedExampleResult)
    qualityParts.push("Worked example with mark allocation (e.g. '1 mark for…') not found");
  if (examStats.examQuestionCount < 3 || examStats.commandWordVariety < 3)
    qualityParts.push(`Need at least 3 exam questions with variety (Describe, Explain, Compare/Evaluate) — have ${examStats.examQuestionCount} questions, ${examStats.commandWordVariety} command types`);
  if (!hasComparisonLanguageResult && topicSuggestsComparisonResult)
    qualityParts.push("Comparison/evaluation language missing (e.g. 'compared to', 'whereas')");
  if (contentTooShort)
    qualityParts.push(`Content too short (${contentLength} chars, need ≥${MIN_CONTENT_LENGTH})`);
  if (needsDiagramButMissing)
    qualityParts.push("Topic would benefit from visual — add diagram guidance ('Draw and label…', 'What to notice…')");

  let summary;
  if (parts.length > 0) {
    summary = parts.join("; ") + ".";
  } else if (qualityParts.length > 0) {
    summary = "All requirements met. Quality suggestions: " + qualityParts.join("; ") + ".";
  } else {
    summary = "All curriculum requirements met.";
  }

  return {
    valid,
    missingSpecPoints,
    missingKeywords,
    missingMisconceptions,
    hasExamQuestions,
    misconceptionCount,
    examTipCount,
    hasKeyWords,
    hasExamStyleQandA,
    subheadingCount,
    hasComparisonTable: hasComparisonTableResult,
    needsTableButMissing,
    hasWorkedExample: hasWorkedExampleResult,
    examQuestionCount: examStats.examQuestionCount,
    commandWordVariety: examStats.commandWordVariety,
    hasComparisonLanguage: hasComparisonLanguageResult,
    topicSuggestsComparison: topicSuggestsComparisonResult,
    topicSuggestsVisual: topicSuggestsVisualResult,
    hasDiagramGuidance: hasDiagramGuidanceResult,
    needsDiagramButMissing,
    contentLength,
    contentTooShort,
    summary,
  };
}

/**
 * Validate lesson structure against the block role contract.
 * @param {Object} draft - Draft with pages[].blocks
 * @returns {string[]} Array of issue messages (empty if valid).
 */
function validateLessonStructure(draft) {
  const issues = [];
  const pages = Array.isArray(draft?.pages) ? draft.pages : [];
  const blocks = pages.flatMap((p) => p?.blocks ?? []);

  if (blocks.length < 10) issues.push("Too few blocks (need at least 10)");

  const diagramCount = blocks.filter((b) => safeStr(b?.type, "") === "diagram").length;
  if (diagramCount < 2) issues.push("Not enough diagrams");

  const roles = new Set(blocks.map((b) => safeStr(b?.role, "")).filter(Boolean));
  const requiredRoles = [
    "hook",
    "coreRule",
    "commonMistake",
    "patternRecognition",
    "workedExample",
    "synthesis",
    "finalMemoryRule",
  ];
  requiredRoles.forEach((role) => {
    if (!roles.has(role)) issues.push(`Missing role: ${role}`);
  });

  const hasWhatToNotice = blocks.some((b) => safeStr(b?.role, "") === "whatToNotice");
  if (!hasWhatToNotice) issues.push("Missing What to Notice block");

  const workedExampleContent = (b) =>
    [b?.explanation, b?.correctAnswer, b?.prompt, b?.answer].filter(Boolean).map(String).join(" ");
  const hasWorkedExample = blocks.some(
    (b) => safeStr(b?.role, "") === "workedExample" && workedExampleContent(b).length > 30
  );
  if (!hasWorkedExample) issues.push("Missing worked example (needs role 'workedExample' with substantial content)");

  return issues;
}

/**
 * Determine if a draft should trigger a second-pass improvement.
 * Trigger if: hard validation failure OR any quality weakness OR structure issues:
 * - subheadings < 4, no markdown table when topic suggests comparison,
 * - no worked example, < 3 exam questions, no comparison language, content too short,
 * - block role contract violations.
 */
function shouldTriggerSecondPass(validation) {
  if (!validation) return false;
  if ((validation.structureIssues?.length ?? 0) > 0) return true;
  if (!validation.valid) return true;
  if ((validation.subheadingCount || 0) < 4) return true;
  if (validation.needsTableButMissing) return true;
  if (!validation.hasWorkedExample) return true;
  if ((validation.examQuestionCount || 0) < 3) return true;
  if ((validation.commandWordVariety || 0) < 3) return true;
  if (validation.topicSuggestsComparison && !validation.hasComparisonLanguage) return true;
  if (validation.contentTooShort) return true;
  if (validation.needsDiagramButMissing) return true;
  if ((validation.misconceptionCount || 0) < 3) return true;
  if (!validation.hasExamQuestions) return true;
  if (!validation.hasKeyWords) return true;
  if ((validation.examTipCount || 0) < 2) return true;
  if (!validation.hasExamStyleQandA && validation.hasExamQuestions) return true;
  return false;
}

module.exports = {
  validateLessonDraftAgainstCurriculum,
  shouldTriggerSecondPass,
  extractDraftText,
  validateLessonStructure,
};
