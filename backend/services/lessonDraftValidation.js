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
 *
 * @returns {{ valid: boolean, missingSpecPoints: string[], missingKeywords: string[], missingMisconceptions: string[], hasExamQuestions: boolean, misconceptionCount: number, examTipCount: number, hasKeyWords: boolean, hasExamStyleQandA: boolean, summary: string }}
 */
function validateLessonDraftAgainstCurriculum(draft, opts = {}) {
  const specPoints = Array.isArray(opts.specPoints) ? opts.specPoints : [];
  const requiredKeywords = Array.isArray(opts.requiredKeywords) ? opts.requiredKeywords : [];
  const requiredMisconceptions = Array.isArray(opts.requiredMisconceptions) ? opts.requiredMisconceptions : [];
  const requireExamQuestions = opts.requireExamQuestions !== false;

  const draftText = extractDraftText(draft);
  const counts = countBlocksByType(draft);
  const misconceptionCount = counts.commonMistake || 0;
  const examTipCount = counts.examTip || 0;
  const hasKeyWords = hasKeyWordsBlock(draft);
  const hasExamStyleQandA = detectExamStyleQandA(draft);
  const subheadingCount = countSubheadings(draft);

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
  if (subheadingCount < 3)
    qualityParts.push("Content lacks structured teaching sections (fewer than 3 ## subheadings)");

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
    summary,
  };
}

/**
 * Determine if a draft should trigger a second-pass improvement.
 * Trigger if: hard validation failure OR any quality weakness:
 * - subheadings < 3, misconceptions < 3, missing exam questions, missing key words,
 *   or validation has warnings (exam tips, exam-style Q&A).
 */
function shouldTriggerSecondPass(validation) {
  if (!validation) return false;
  if (!validation.valid) return true;
  if ((validation.subheadingCount || 0) < 3) return true;
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
};
