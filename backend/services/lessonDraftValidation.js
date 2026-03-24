/**
 * Curriculum-controlled AI: validation layer for generated lesson drafts.
 * Confirms coverage of spec statements, required keywords, misconceptions, and exam questions.
 */
function safeStr(v, fallback = "") {
  const s = v === undefined || v === null ? "" : String(v);
  return s.trim() ? s.trim() : fallback;
}

/** True if prompt looks like a real exam-style written question (command word + marks), not a placeholder MCQ stem. */
function isRealExamStyleQuestion(text = "") {
  const value = String(text).trim();
  if (!value) return false;

  const hasCommandWord = /(explain|describe|compare|evaluate|outline|state)/i.test(value);
  const hasMarkCount = /\(\s*\d+\s*marks?\s*\)/i.test(value) || /\b\d+\s*marks?\b/i.test(value);

  const banned = [
    "what statement is correct",
    "write your answer here",
    "option 1",
    "option 2",
    "option 3",
    "option 4",
  ];

  const containsBanned = banned.some((p) => value.toLowerCase().includes(p));

  return hasCommandWord && hasMarkCount && !containsBanned;
}

/** True if checkpoint has a substantial model answer (bullets and/or long combined answer fields). */
function hasSubstantialWorkedAnswer(block) {
  if (!block || typeof block !== "object") return false;

  const answerText = [
    block.answer,
    block.explanation,
    block.correctAnswer,
    Array.isArray(block.options) ? block.options.join(" ") : "",
  ]
    .filter(Boolean)
    .map(String)
    .join(" ")
    .trim();

  const bulletSource = [block.answer, block.explanation, block.correctAnswer].filter(Boolean).join("\n");
  const bulletLikeCount = (bulletSource.match(/(^|\n)\s*[-•*]\s*/g) || []).length;

  return answerText.length >= 60 || bulletLikeCount >= 2;
}

/** V3: keyIdea looks like punchy bullets or very short lines (not a paragraph dump). */
function looksLikePunchyKeyIdea(block) {
  const text = `${block?.title || ""}\n${block?.content || ""}`.trim();
  if (!text) return false;

  const lineCount = text.split("\n").filter(Boolean).length;
  const bulletCount = (text.match(/(^|\n)\s*[-•]/g) || []).length;

  return bulletCount >= 1 || lineCount <= 3;
}

/** V3: commonMistake uses Wrong / Correct / Exam link scaffold. */
function looksLikeProperCommonMistake(block) {
  const text = String(block?.content || "");
  return /wrong:/i.test(text) && /correct:/i.test(text) && /exam link:/i.test(text);
}

/** V3: examTip sounds practical for exams / marks. */
function looksLikePracticalExamTip(block) {
  const text = String(block?.content || "");
  return /(exam|mark|credit|answer|command word|gain marks)/i.test(text);
}

/** V3: "What to Notice" title plus at least two bullet lines in content. */
function looksLikeWhatToNotice(block) {
  const title = String(block?.title || "");
  const content = String(block?.content || "");
  const bulletCount = (content.match(/(^|\n)\s*[-•*]/g) || []).length;
  return /what to notice/i.test(title) && bulletCount >= 2;
}

/** V4: banned vague / filler phrasing in block text. */
function containsGenericFiller(text = "") {
  const value = String(text).toLowerCase();
  const genericPhrases = [
    "this topic",
    "this concept",
    "this process",
    "this material",
    "this is important",
    "it helps in exams",
    "used in many situations",
    "helps the body",
    "is useful in medicine",
    "plays an important role",
  ];
  return genericPhrases.some((p) => value.includes(p));
}

/** Words from lesson title/description/topic for topic-specific checks (any subject). */
function draftTopicTokens(draft) {
  const raw = [safeStr(draft?.title, ""), safeStr(draft?.description, ""), safeStr(draft?.topic, "")]
    .join(" ");
  const words = raw.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  return [...new Set(words)];
}

function textMentionsTopicTokens(text, draft) {
  const lower = String(text).toLowerCase();
  const tokens = draftTopicTokens(draft);
  return tokens.some((t) => lower.includes(t));
}

/** V4: keyIdea content feels tied to the lesson topic (not generic filler). */
function keyIdeaLooksSpecific(block, draft = {}) {
  const text = `${block?.title || ""} ${block?.content || ""}`.trim();
  if (!text) return false;
  if (containsGenericFiller(text)) return false;
  if (textMentionsTopicTokens(text, draft)) return true;
  return /(stem cells?|embryonic|adult stem cells?|differentiat|regenerative|medicine|repair|leukaemia|specialised cells?)/i.test(
    text
  );
}

/** V4: examTip explains marks / exams in a topic-aware way. */
function examTipLooksSpecific(block, draft = {}) {
  const text = String(block?.content || "");
  if (!text) return false;
  if (containsGenericFiller(text)) return false;
  if (textMentionsTopicTokens(text, draft)) return true;
  return /(exam|marks?|compare|describe|explain|credit|definition|difference|embryonic|adult stem cells?|leukaemia|regenerative)/i.test(
    text
  );
}

/** V4: What to Notice bullets reference real ideas, not only generic scaffolding. */
function whatToNoticeLooksSpecific(block, draft = {}) {
  const text = `${block?.title || ""}\n${block?.content || ""}`.trim();
  if (!/what to notice/i.test(block?.title || "")) return false;
  if (containsGenericFiller(text)) return false;
  const bulletCount = (String(block?.content || "").match(/(^|\n)\s*[-•*]/g) || []).length;
  if (bulletCount < 2) return false;
  if (textMentionsTopicTokens(text, draft)) return true;
  return /(stem cells?|embryonic|adult stem cells?|differentiat|specialised cells?|regenerative|medicine)/i.test(
    text
  );
}

/** V4: final memory rule names the topic, not vague revision fluff. */
function finalMemoryRuleLooksSpecific(block, draft = {}) {
  const text = String(block?.content || "").trim();
  if (!text) return false;
  if (containsGenericFiller(text)) return false;
  if (textMentionsTopicTokens(text, draft)) return true;
  return /(stem cells?|differentiat|embryonic|adult stem cells?|repair|medicine|ethic)/i.test(text);
}

/** Concatenate common block fields for flow heuristics (V5). */
function blockFlowText(b) {
  return [
    b?.title,
    b?.content,
    b?.prompt,
    b?.question,
    b?.explanation,
    b?.answer,
  ]
    .filter(Boolean)
    .map(String)
    .join(" ");
}

function blockMentionsComparison(text = "") {
  return /(compare|difference|whereas|however|unlike|embryonic|adult stem cells?)/i.test(String(text));
}

function blockMentionsApplication(text = "") {
  return /(medicine|medical|therapy|treat|treatment|transplant|regenerative|leukaemia|disease|for example|for instance|real[- ]world|used in|application|environmental|everyday|industry)/i.test(
    String(text)
  );
}

function blockMentionsExamUse(text = "") {
  return /(exam|marks?|compare|describe|explain|credit|question)/i.test(String(text));
}

/** V6: common function words — strip for overlap / redundancy heuristics. */
const V6_STOPWORDS = new Set(
  `the and for are not but can may its our was how all any you who one two used using that this with from have been were will your what when where which their there these those about into than then them very just only also some such each other because while being would could should might often many much more most make like well even they has had does did done`.split(
    /\s+/
  )
);

function v6TokenSetForOverlap(text = "") {
  const words = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !V6_STOPWORDS.has(w));
  return new Set(words);
}

function v6JaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  let inter = 0;
  for (const x of setA) if (setB.has(x)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * V6-style overlap / repetition hints. Advisory only — V9–V11 deliberately reuse exam/stem phrasing,
 * so these must not block save (see validateLessonStructure).
 */
function buildV6CompressionIssueStrings(draft) {
  const pages = Array.isArray(draft?.pages) ? draft.pages : [];
  const blocks = pages.flatMap((p) => p?.blocks ?? []);
  if (blocks.length < 3) return [];

  const v6Issues = [];

  let adjacentRedundancyReports = 0;
  for (let i = 0; i < blocks.length - 1; i++) {
    const a = blocks[i];
    const b = blocks[i + 1];
    const ta = safeStr(a?.type, "");
    const tb = safeStr(b?.type, "");
    if (!["text", "keyIdea", "examTip"].includes(ta) || !["text", "keyIdea", "examTip"].includes(tb)) {
      continue;
    }
    const s1 = v6TokenSetForOverlap(blockFlowText(a));
    const s2 = v6TokenSetForOverlap(blockFlowText(b));
    if (s1.size < 5 || s2.size < 5) continue;
    if (v6JaccardSimilarity(s1, s2) >= 0.48) {
      if (adjacentRedundancyReports < 8) {
        v6Issues.push(
          `Blocks ${i + 1} and ${i + 2} repeat similar ideas; merge or rewrite so each adds a new cognitive step (V6).`
        );
      }
      adjacentRedundancyReports += 1;
    }
  }

  let weakNewStepReports = 0;
  let cumulativePrior = "";
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const t = safeStr(b?.type, "");
    const body = blockFlowText(b);
    if (!["text", "keyIdea"].includes(t)) {
      cumulativePrior += ` ${body}`;
      continue;
    }
    if (body.length < 100 || i < 2) {
      cumulativePrior += ` ${body}`;
      continue;
    }
    const curTok = v6TokenSetForOverlap(body);
    const priorTok = v6TokenSetForOverlap(cumulativePrior);
    if (curTok.size < 8) {
      cumulativePrior += ` ${body}`;
      continue;
    }
    let newCount = 0;
    for (const w of curTok) if (!priorTok.has(w)) newCount += 1;
    const hasReasoningSignal =
      /(but not|unlike|whereas|however|wrong:|correct:|exam link:|for example|e\.g\.|such as|in contrast|vs\.?\s|versus|compared to|difference between)/i.test(
        body
      );
    if (newCount < 4 && !hasReasoningSignal) {
      if (weakNewStepReports < 8) {
        v6Issues.push(
          `Block ${i + 1} may only restate earlier content; add contrast, example, application, or exam link — or merge (V6).`
        );
      }
      weakNewStepReports += 1;
    }
    cumulativePrior += ` ${body}`;
  }

  const differentiationMentions = blocks.filter((b) =>
    /differentiat/i.test(blockFlowText(b))
  ).length;
  if (differentiationMentions >= 5) {
    v6Issues.push(
      "The same core idea (e.g. differentiation or stem cell definition) appears in too many blocks; compress into fewer teaching steps (V6)."
    );
  }

  return v6Issues;
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

  const keyIdeas = blocks.filter((b) => safeStr(b?.type, "") === "keyIdea");
  const commonMistakes = blocks.filter((b) => safeStr(b?.type, "") === "commonMistake");
  const examTips = blocks.filter((b) => safeStr(b?.type, "") === "examTip");

  if (diagramCount >= 1 && !keyIdeas.some(looksLikeWhatToNotice)) {
    issues.push(
      'Missing a proper "What to Notice" keyIdea block (required when the lesson has diagrams).'
    );
  }

  if (commonMistakes.length > 0 && !commonMistakes.some(looksLikeProperCommonMistake)) {
    issues.push("Common mistake blocks are not using Wrong / Correct / Exam link format.");
  }

  if (examTips.length > 0 && !examTips.some(looksLikePracticalExamTip)) {
    issues.push("Exam tip blocks are too descriptive and not practical enough.");
  }

  if (keyIdeas.length > 0 && !keyIdeas.some((b) => keyIdeaLooksSpecific(b, draft))) {
    issues.push("Key idea blocks are too generic and not topic-specific enough.");
  }

  if (examTips.length > 0 && !examTips.some((b) => examTipLooksSpecific(b, draft))) {
    issues.push("Exam tip blocks are too generic and not specific to how marks are earned.");
  }

  const whatToNoticeBlocks = keyIdeas.filter((b) => /what to notice/i.test(b.title || ""));
  if (
    whatToNoticeBlocks.length > 0 &&
    !whatToNoticeBlocks.some((b) => whatToNoticeLooksSpecific(b, draft))
  ) {
    issues.push("What to Notice blocks are too generic and not tied to the actual topic.");
  }

  const finalMemoryRuleBlock = blocks.find((b) => safeStr(b?.role, "") === "finalMemoryRule");
  if (finalMemoryRuleBlock && !finalMemoryRuleLooksSpecific(finalMemoryRuleBlock, draft)) {
    issues.push("Final memory rule is too generic and not topic-specific enough.");
  }

  const workedExampleBlock = blocks.find((b) => safeStr(b?.type, "") === "checkpoint" && safeStr(b?.role, "") === "workedExample");

  if (!workedExampleBlock) {
    issues.push("Missing worked example (needs role 'workedExample' with substantial content)");
  } else {
    const workedQuestion = safeStr(workedExampleBlock.prompt, "") || safeStr(workedExampleBlock.question, "");
    if (!isRealExamStyleQuestion(workedQuestion)) {
      issues.push(
        "Worked example must contain a real exam-style question with command word and mark count"
      );
    }
    if (!hasSubstantialWorkedAnswer(workedExampleBlock)) {
      issues.push("Worked example must include a substantial model answer");
    }
  }

  const checkpointBlocks = blocks.filter((b) => safeStr(b?.type, "") === "checkpoint");
  const placeholderPrompts = /^(which statement is correct\??\s*|choose the correct\??\s*|option [1234]\??\s*|quick check\??\s*)$/i;
  checkpointBlocks.forEach((b, i) => {
    const prompt = safeStr(b?.prompt, "") || safeStr(b?.question, "");
    const correctAnswer = safeStr(b?.correctAnswer, "") || safeStr(b?.answer, "");
    if (!prompt || prompt.length < 15) {
      issues.push(`Checkpoint ${i + 1}: must contain a real exam-style question`);
    } else if (placeholderPrompts.test(prompt.trim())) {
      issues.push(`Checkpoint ${i + 1}: must contain a real exam-style question (not a placeholder)`);
    }
    if (!correctAnswer) {
      issues.push(`Checkpoint ${i + 1}: must include a correct answer`);
    }
  });

  const mid = Math.ceil(blocks.length / 2);
  const firstHalf = blocks.slice(0, mid);
  const secondHalf = blocks.slice(mid);

  const earlyComparison = firstHalf.some((b) => blockMentionsComparison(blockFlowText(b)));
  const laterApplication = secondHalf.some((b) => blockMentionsApplication(blockFlowText(b)));
  const hasExamLink = blocks.some((b) => blockMentionsExamUse(blockFlowText(b)));

  if (!earlyComparison) {
    issues.push("Key comparison or distinction appears too late or is missing.");
  }

  if (!laterApplication) {
    issues.push("Real-world or medical application is missing or appears too weakly.");
  }

  if (!hasExamLink) {
    issues.push("Lesson does not connect clearly enough to exam use.");
  }

  return issues;
}

/**
 * Post-generation block-type shape checks (runs after sanitization).
 * Complements validateLessonStructure (roles, counts, checkpoint quality).
 * @param {Object} lesson - Draft with pages[].blocks
 * @returns {string[]}
 */
function validateBlockTypeRequirements(lesson) {
  const issues = [];
  const blocks = (Array.isArray(lesson?.pages) ? lesson.pages : []).flatMap((page) =>
    Array.isArray(page?.blocks) ? page.blocks : []
  );

  for (const block of blocks) {
    const type = safeStr(block?.type, "");

    if (type === "text" && !safeStr(block?.content, "").trim()) {
      issues.push("Text block missing content.");
    }

    if (type === "keyIdea") {
      if (!safeStr(block?.title, "").trim()) {
        issues.push("Key idea block missing title.");
      }
      if (!safeStr(block?.content, "").trim()) {
        issues.push("Key idea block missing content.");
      }
    }

    if (type === "commonMistake" && !safeStr(block?.content, "").trim()) {
      issues.push("Common mistake block missing content.");
    }

    if (type === "examTip" && !safeStr(block?.content, "").trim()) {
      issues.push("Exam tip block missing content.");
    }

    if (type === "stretch" && !safeStr(block?.content, "").trim()) {
      issues.push("Stretch block missing content.");
    }

    if (type === "diagram" && !safeStr(block?.content, "").trim()) {
      issues.push("Diagram block missing content.");
    }

    if (type === "checkpoint") {
      const hasQuestion =
        !!safeStr(block?.question, "").trim() || !!safeStr(block?.prompt, "").trim();
      const hasAnswer =
        !!safeStr(block?.answer, "").trim() ||
        !!safeStr(block?.correctAnswer, "").trim() ||
        !!safeStr(block?.explanation, "").trim();

      if (!hasQuestion) issues.push("Checkpoint block missing question.");
      if (!hasAnswer) issues.push("Checkpoint block missing answer.");
    }
  }

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

/** V9 advisory: reasoning / linking language typical of strong teacher explanations. */
function soundsTeacherLike(text = "") {
  return /(because|for example|in contrast|whereas|however|this matters)/i.test(String(text));
}

/** V9 advisory: concrete biology examples or cue phrases. */
function hasConcreteExample(text = "") {
  return /(for example|such as|leukaemia|bone marrow|nerve cell|blood cell)/i.test(String(text));
}

/** V10 advisory: more than three sentence-like units (split on “. ”). */
function blockLooksTooLong(text = "") {
  return String(text).split(/\.\s+/).filter(Boolean).length > 3;
}

/** V10 advisory: stock stem-cell lines that often stack without adding reasoning. */
function blockRepeatsKnownIdea(text = "") {
  return /(stem cells can differentiate|embryonic stem cells can become|adult stem cells can only)/i.test(
    String(text)
  );
}

/** V11 advisory: teacher-style question or “ask yourself” cue. */
function soundsLikeTeacherQuestion(text = "") {
  return /(have you ever|why does this matter|ask yourself|so what is the key difference)/i.test(
    String(text)
  );
}

/** V11 advisory: written checkpoint looks like a real exam question (command word + marks). */
function checkpointLooksReal(text = "") {
  return /(explain|compare|evaluate|describe|outline)/i.test(String(text)) && /(marks?)/i.test(String(text));
}

/**
 * V7.5: non-blocking teaching-quality hints (do not use for save/publish gates).
 * @returns {{ type: string, message: string, severity: string }[]}
 */
function collectV7TeachingAdvisoryNotes(draft) {
  const notes = [];
  const pages = Array.isArray(draft?.pages) ? draft.pages : [];
  const blocks = pages.flatMap((p) => p?.blocks ?? []);
  const examTips = blocks.filter((b) => safeStr(b?.type, "") === "examTip");

  if (examTips.length === 0) {
    notes.push({
      type: "v7_warning",
      message: "No examTip blocks — consider adding at least one practical tip for how marks are earned.",
      severity: "low",
    });
  }

  const joinedForTransitions = blocks.map((b) => blockFlowText(b)).join(" ");
  if (
    blocks.length >= 8 &&
    !/(to understand this clearly:|building on this:|to understand this,|this means that|so in simple terms,|so what does this show\?|why does this matter\?|what this shows is that|this is important because|in exams, this matters because|this leads to an important pattern:|this leads to a key exam pattern:|this leads to an important exam pattern:|a common mistake (students make )?is:|in exams, remember:|in exams,|putting this together:|\bhowever\b|\bthis leads\b)/i.test(
      joinedForTransitions
    )
  ) {
    notes.push({
      type: "v7_warning",
      message:
        "Few guided transition phrases — the lesson may read like separate notes; consider clearer stepping between ideas.",
      severity: "low",
    });
  }

  const teachableBlocks = blocks.filter((b) => {
    const t = safeStr(b?.type, "");
    return t === "text" || t === "keyIdea";
  });

  if (teachableBlocks.length >= 4) {
    const lackingVoice = teachableBlocks.filter((b) => !soundsTeacherLike(blockFlowText(b))).length;
    if (lackingVoice / teachableBlocks.length > 0.5) {
      notes.push({
        type: "v9_teacher_voice",
        message:
          "Many text/key idea blocks lack teacher-like explanation cues (e.g. because, for example, whereas). Consider adding short reasoning or examples.",
        severity: "low",
      });
    }

    const lackingExample = teachableBlocks.filter((b) => !hasConcreteExample(blockFlowText(b))).length;
    if (lackingExample / teachableBlocks.length > 0.5) {
      notes.push({
        type: "v9_concrete_examples",
        message:
          "Several blocks could use a concrete example (e.g. “such as…”, a named cell type, or a familiar context) to read less like abstract notes.",
        severity: "low",
      });
    }

    const tooLong = teachableBlocks.filter((b) => blockLooksTooLong(blockFlowText(b))).length;
    if (teachableBlocks.length >= 4 && tooLong / teachableBlocks.length > 0.5) {
      notes.push({
        type: "v10_length",
        message:
          "Many blocks read as long multi-sentence paragraphs — consider splitting so each block carries one idea (V10 simplicity).",
        severity: "low",
      });
    }

    const stemStockNoExpl = teachableBlocks.filter((b) => {
      const ft = blockFlowText(b);
      return (
        blockRepeatsKnownIdea(ft) &&
        !/because|for example|which means|in other words/i.test(ft)
      );
    }).length;
    if (teachableBlocks.length >= 4 && stemStockNoExpl >= 3) {
      notes.push({
        type: "v10_repetition",
        message:
          "Several blocks repeat common stem-cell phrases without adding explanation (e.g. because / for example) — trim duplicates or add one new layer each time.",
        severity: "low",
      });
    }
  }

  if (blocks.length >= 6 && !blocks.some((b) => soundsLikeTeacherQuestion(blockFlowText(b)))) {
    notes.push({
      type: "v11_teacher_questions",
      message:
        "Few teacher-style questions or “ask yourself” prompts — consider opening some sections with a short question to guide thinking.",
      severity: "low",
    });
  }

  const nonWorkedCps = blocks.filter(
    (b) => safeStr(b?.type, "") === "checkpoint" && safeStr(b?.role, "") !== "workedExample"
  );
  if (nonWorkedCps.length >= 2) {
    const weakCp = nonWorkedCps.filter((b) => {
      const stem = safeStr(b?.prompt, "") || safeStr(b?.question, "");
      return stem.length > 0 && !checkpointLooksReal(stem);
    }).length;
    if (weakCp / nonWorkedCps.length > 0.5) {
      notes.push({
        type: "v11_checkpoints",
        message:
          "Some checkpoints read like placeholders — use command words plus mark counts (e.g. Explain … (3 marks)) for a teacher-like check.",
        severity: "low",
      });
    }
  }

  const v6Hints = buildV6CompressionIssueStrings(draft);
  if (v6Hints.length > 0) {
    notes.push({
      type: "v6_compression",
      message:
        "Some blocks overlap or repeat the same teaching move (V6). Guided post-processing often does this on purpose; merge or trim if you want a tighter lesson. " +
        `Examples: ${v6Hints.slice(0, 2).join(" • ")}${v6Hints.length > 2 ? ` (+${v6Hints.length - 2} more)` : ""}`,
      severity: "low",
    });
  }

  return notes;
}

module.exports = {
  validateLessonDraftAgainstCurriculum,
  shouldTriggerSecondPass,
  extractDraftText,
  validateLessonStructure,
  collectV7TeachingAdvisoryNotes,
  validateBlockTypeRequirements,
  isRealExamStyleQuestion,
  hasSubstantialWorkedAnswer,
  looksLikePunchyKeyIdea,
  looksLikeProperCommonMistake,
  looksLikePracticalExamTip,
  looksLikeWhatToNotice,
  containsGenericFiller,
  keyIdeaLooksSpecific,
  examTipLooksSpecific,
  whatToNoticeLooksSpecific,
  finalMemoryRuleLooksSpecific,
  blockFlowText,
  blockMentionsComparison,
  blockMentionsApplication,
  blockMentionsExamUse,
  soundsTeacherLike,
  hasConcreteExample,
  blockLooksTooLong,
  blockRepeatsKnownIdea,
  soundsLikeTeacherQuestion,
  checkpointLooksReal,
  v6TokenSetForOverlap,
  v6JaccardSimilarity,
};
