/**
 * Block 28 Phase 2 — derive lesson content boundary from actual lesson teaching content.
 */
const { filterMeaningfulObjectives, filterMeaningfulKeyTerms } = require("./coverageGapFilter");

function stripHtml(text) {
  return String(text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectPageText(pages) {
  const chunks = [];
  for (const page of pages || []) {
    if (page?.title) chunks.push(String(page.title));
    for (const block of page?.blocks || []) {
      if (block?.text) chunks.push(stripHtml(block.text));
      if (block?.content) chunks.push(stripHtml(block.content));
      if (block?.markdown) chunks.push(stripHtml(block.markdown));
      if (block?.heading) chunks.push(String(block.heading));
      if (Array.isArray(block?.items)) {
        for (const item of block.items) {
          if (typeof item === "string") chunks.push(stripHtml(item));
          else if (item?.text) chunks.push(stripHtml(item.text));
        }
      }
    }
    if (page?.content) chunks.push(stripHtml(page.content));
  }
  return chunks.filter(Boolean);
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function uniqueTerms(tokens, minFreq = 1) {
  const freq = new Map();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  return [...freq.entries()]
    .filter(([, n]) => n >= minFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([term]) => term);
}

function extractDefinitions(text) {
  const defs = [];
  const patterns = [
    /([A-Z][a-z]+(?:\s+[a-z]+){0,4})\s+(?:is|are|means|refers to)\s+([^.!?]{10,120})/g,
    /(?:Definition|Key term)[:\s]+([^.!?]{10,120})/gi,
  ];
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(text)) !== null) {
      defs.push(m[0].trim().slice(0, 160));
    }
  }
  return defs.slice(0, 12);
}

function inferObjectives(lesson, fullText) {
  const explicit = [];
  if (Array.isArray(lesson?.learningObjectives)) {
    for (const o of lesson.learningObjectives) {
      if (typeof o === "string" && o.trim()) explicit.push(o.trim());
      else if (o?.text) explicit.push(String(o.text).trim());
    }
  }
  if (lesson?.readiness?.objectives) {
    for (const o of lesson.readiness.objectives) {
      if (typeof o === "string") explicit.push(o.trim());
    }
  }
  if (explicit.length) return explicit.slice(0, 10);

  const sentences = fullText.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 30);
  return sentences.slice(0, 6);
}

/**
 * @param {object} lesson - full lesson document
 */
function deriveLessonContentBoundary(lesson) {
  const pageText = collectPageText(lesson?.pages);
  const legacyContent = stripHtml(lesson?.content || "");
  const combined = [lesson?.title, lesson?.topic, legacyContent, ...pageText].filter(Boolean).join("\n");
  const tokens = tokenize(combined);
  const keyTerms = uniqueTerms(tokens, combined.split(/\s+/).length < 80 ? 1 : 2).slice(0, 40);

  const misconceptions = [];
  if (/\bnot\b|\bincorrect\b|\bmisconception\b|\bcommon mistake\b/i.test(combined)) {
    misconceptions.push("Lesson text references common errors or misconceptions — check evaluate-style questions.");
  }

  const mechanisms = keyTerms.filter((t) =>
    /(process|synthesis|replication|transcription|translation|division|transport|diffusion|osmosis|meiosis|mitosis|fertilisation|mutation)/.test(
      t
    )
  );

  const applications = keyTerms.filter((t) =>
    /(disease|medicine|agriculture|conservation|industry|diagnosis|treatment|breeding|therapy)/.test(t)
  );

  const coreConcepts = inferObjectives(lesson, combined);
  const meaningfulObjectives = filterMeaningfulObjectives(coreConcepts);
  const meaningfulKeyTerms = filterMeaningfulKeyTerms(keyTerms);

  return {
    lessonId: String(lesson._id),
    lessonTitle: lesson.title || "",
    topicKey: lesson.topicKey || lesson.canonicalTopicKey || null,
    coreConcepts,
    meaningfulObjectives,
    requiredDefinitions: extractDefinitions(combined),
    mechanisms: mechanisms.slice(0, 8),
    applications: applications.slice(0, 8),
    misconceptions,
    keyTerms,
    meaningfulKeyTerms,
    demandLevel: "Edexcel IGCSE Biology — short-answer explain/describe/state; 1–4 marks typical",
    sourceWordCount: combined.split(/\s+/).filter(Boolean).length,
    hasStructuredPages: Array.isArray(lesson?.pages) && lesson.pages.length > 0,
  };
}

module.exports = {
  deriveLessonContentBoundary,
  collectPageText,
  stripHtml,
};
