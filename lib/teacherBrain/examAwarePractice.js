/**
 * Exam-aware Practice Question de-duplication (Teacher Brain V1).
 * When a lesson embeds Exam Question Bank items, practice must complement — not repeat — them.
 */

const COMMAND_WORDS = [
  "evaluate",
  "compare",
  "explain",
  "describe",
  "predict",
  "calculate",
  "suggest",
  "outline",
  "state",
  "give",
  "name",
  "label",
];

const ALTERNATE_SKILLS_BY_EXAM = {
  label: ["explain", "describe", "why"],
  name: ["explain function", "compare", "apply"],
  state: ["explain why", "predict", "evaluate"],
  give: ["explain", "compare", "evaluate"],
  describe: ["explain why", "compare", "predict"],
  explain: ["apply", "evaluate", "predict"],
  compare: ["evaluate", "explain why", "predict"],
  predict: ["explain", "evaluate", "apply"],
  calculate: ["explain", "predict", "evaluate"],
  evaluate: ["explain", "compare", "apply"],
};

const DEFAULT_SIMILARITY_THRESHOLD = 0.7;

function stripHtml(raw = "") {
  return String(raw)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(raw = "") {
  return stripHtml(raw)
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text = "") {
  return new Set(
    normalizeText(text)
      .split(" ")
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(a, b) {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (!sa.size && !sb.size) return 1;
  let inter = 0;
  for (const w of sa) {
    if (sb.has(w)) inter++;
  }
  const union = sa.size + sb.size - inter;
  return union ? inter / union : 0;
}

function extractCommandWord(text = "") {
  const norm = normalizeText(text);
  for (const word of COMMAND_WORDS) {
    if (new RegExp(`\\b${word}\\b`, "i").test(norm)) return word;
  }
  return "";
}

/** Collect examQuestion block ids from lesson pages (no DB). */
function collectEmbeddedExamQuestionIds(pages) {
  const ids = new Set();
  const list = Array.isArray(pages) ? pages : [];
  for (const page of list) {
    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
    for (const block of blocks) {
      if (String(block?.type ?? "").trim() !== "examQuestion") continue;
      const rawId = block?.examQuestionId ?? block?.examQuestionID;
      const id = rawId != null ? String(rawId).trim() : "";
      if (id) ids.add(id);
    }
  }
  return ids;
}

function markSchemeKeywords(question = {}) {
  const lines = [];
  if (Array.isArray(question.markScheme)) {
    lines.push(...question.markScheme.map((l) => String(l ?? "")));
  }
  if (Array.isArray(question.parts)) {
    for (const part of question.parts) {
      if (Array.isArray(part.markScheme)) {
        lines.push(...part.markScheme.map((l) => String(l ?? "")));
      }
    }
  }
  return lines.filter(Boolean);
}

/**
 * @param {object} question — ExamQuestion doc (single or composite)
 * @returns {object} fingerprint (in-memory only)
 */
function buildExamQuestionFingerprint(question = {}) {
  const texts = [];
  if (question.sharedStem) texts.push(String(question.sharedStem));
  if (question.question) texts.push(String(question.question));
  if (Array.isArray(question.parts)) {
    for (const part of question.parts) {
      if (part?.questionText) texts.push(String(part.questionText));
    }
  }

  const commandWords = new Set();
  for (const t of texts) {
    const cw = extractCommandWord(t);
    if (cw) commandWords.add(cw);
  }

  const normalizedTexts = texts.map(normalizeText).filter(Boolean);
  const msKeywords = markSchemeKeywords(question).map(normalizeText).filter(Boolean);

  return {
    id: question._id != null ? String(question._id) : "",
    normalizedTexts,
    commandWords: [...commandWords],
    keywords: msKeywords,
    hasDiagram: Boolean(question.imageUrl && String(question.imageUrl).trim()),
    diagramSubject: question.imageUrl
      ? normalizeText(question.topic || question.sharedStem || question.question || "")
      : "",
    combinedText: normalizedTexts.join(" "),
    markSchemeText: msKeywords.join(" "),
  };
}

function buildExamQuestionFingerprints(examQuestions = []) {
  if (!Array.isArray(examQuestions)) return [];
  return examQuestions.map(buildExamQuestionFingerprint).filter((fp) => fp.combinedText || fp.id);
}

function coreConceptText(text = "") {
  let t = normalizeText(text);
  for (const word of COMMAND_WORDS) {
    t = t.replace(new RegExp(`\\b${word}\\b`, "g"), " ");
  }
  t = t
    .replace(/\b(which|what|where|how|why|when|who|is|are|was|were|does|do|did|can|could|should|would|will|a|an|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t;
}

function similarityToFingerprint(practiceText, fingerprint) {
  const norm = normalizeText(practiceText);
  if (!norm || !fingerprint) return 0;
  let max = jaccardSimilarity(norm, fingerprint.combinedText);
  for (const t of fingerprint.normalizedTexts || []) {
    max = Math.max(max, jaccardSimilarity(norm, t));
    if (t.length >= 24 && (norm.includes(t) || t.includes(norm))) {
      max = Math.max(max, 0.85);
    }
    max = Math.max(max, jaccardSimilarity(coreConceptText(norm), coreConceptText(t)));
  }
  if (fingerprint.markSchemeText) {
    max = Math.max(max, jaccardSimilarity(norm, fingerprint.markSchemeText) * 0.85);
    max = Math.max(max, jaccardSimilarity(coreConceptText(norm), coreConceptText(fingerprint.markSchemeText)));
  }
  max = Math.max(max, jaccardSimilarity(coreConceptText(norm), coreConceptText(fingerprint.combinedText)));
  return max;
}

function sharesExamTopicCommandCombo(practiceText, fingerprint) {
  const practiceCw = extractCommandWord(practiceText);
  if (!practiceCw || !fingerprint.commandWords?.length) return false;
  if (!fingerprint.commandWords.includes(practiceCw)) return false;
  return similarityToFingerprint(practiceText, fingerprint) >= 0.45;
}

/**
 * @param {string} practiceText
 * @param {object[]} fingerprints
 * @param {number} [threshold=0.7]
 */
function overlapsExamFingerprint(practiceText, fingerprints, threshold = DEFAULT_SIMILARITY_THRESHOLD) {
  if (!practiceText || !Array.isArray(fingerprints) || !fingerprints.length) return false;
  return fingerprints.some(
    (fp) =>
      similarityToFingerprint(practiceText, fp) >= threshold ||
      sharesExamTopicCommandCombo(practiceText, fp)
  );
}

function suggestAlternatePracticeSkills(examCommandWords = []) {
  const primary = examCommandWords[0] || "label";
  return ALTERNATE_SKILLS_BY_EXAM[primary] || ["explain why", "apply", "evaluate"];
}

/**
 * Filter exam-bank rows for practice attach / serve — exclude embedded ids and semantic duplicates.
 * @param {object[]} candidates — ExamQuestion lean docs or mapped practice rows with `question` + `id`
 * @param {object} opts
 * @param {Set<string>} [opts.embeddedIds]
 * @param {object[]} [opts.fingerprints]
 * @param {number} [opts.limit]
 */
function filterDistinctPracticeExamQuestions(candidates, opts = {}) {
  const embeddedIds = opts.embeddedIds || new Set();
  const fingerprints = Array.isArray(opts.fingerprints) ? opts.fingerprints : [];
  const threshold = opts.threshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const limit =
    typeof opts.limit === "number" && opts.limit > 0 ? opts.limit : Number.POSITIVE_INFINITY;

  const out = [];
  for (const row of candidates || []) {
    const id = String(row._id ?? row.id ?? "").trim();
    if (id && embeddedIds.has(id)) continue;

    const text = String(row.question ?? row.questionText ?? "").trim();
    if (!text) continue;
    if (overlapsExamFingerprint(text, fingerprints, threshold)) continue;

    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

function formatExamExclusionDirectiveForPrompt(fingerprints = []) {
  if (!Array.isArray(fingerprints) || !fingerprints.length) return "";

  const lines = fingerprints.map((fp, i) => {
    const preview = (fp.normalizedTexts[0] || fp.combinedText || "").slice(0, 140);
    const skills = fp.commandWords.length ? fp.commandWords.join(", ") : "recall";
    const alt = suggestAlternatePracticeSkills(fp.commandWords);
    const diagram = fp.hasDiagram ? " (uses diagram)" : "";
    return `${i + 1}. Exam question [${skills}]${diagram}: "${preview}" → Practice must use ${alt.join(" / ")}, not repeat this.`;
  });

  return [
    "EXAM QUESTION EXCLUSION (mandatory):",
    "This lesson already embeds Exam Question Bank item(s). Practice questions must complement them:",
    "- extend the idea, apply it, compare, explain why, predict, or evaluate",
    "- NEVER repeat the same stem, diagram task, or recall wording",
    ...lines,
    "Reject any practice question with >70% wording overlap with the exam question(s) above.",
    "",
  ].join("\n");
}

/**
 * Reject generated practice items that duplicate embedded exam questions.
 * @param {object[]} practiceItems — { question | questionText }
 * @param {object[]} fingerprints
 */
function rejectDuplicatePracticeItems(practiceItems, fingerprints, threshold = DEFAULT_SIMILARITY_THRESHOLD) {
  const accepted = [];
  const rejected = [];
  for (const item of practiceItems || []) {
    const text = String(item.question ?? item.questionText ?? "").trim();
    if (!text) {
      rejected.push({ item, reason: "empty" });
      continue;
    }
    if (overlapsExamFingerprint(text, fingerprints, threshold)) {
      rejected.push({ item, reason: "exam_overlap" });
      continue;
    }
    accepted.push(item);
  }
  return { accepted, rejected };
}

module.exports = {
  DEFAULT_SIMILARITY_THRESHOLD,
  normalizeText,
  jaccardSimilarity,
  extractCommandWord,
  collectEmbeddedExamQuestionIds,
  buildExamQuestionFingerprint,
  buildExamQuestionFingerprints,
  similarityToFingerprint,
  overlapsExamFingerprint,
  suggestAlternatePracticeSkills,
  filterDistinctPracticeExamQuestions,
  formatExamExclusionDirectiveForPrompt,
  rejectDuplicatePracticeItems,
};
