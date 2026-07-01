/**
 * Phase 2C — validate lesson draft coverage against topic spec record.
 */
const { resolveTopicSpecForGeneration, getTopicSpecRecord } = require("./topicSpecification");

function stripHtml(html = "") {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textContainsPhrase(haystack, phrase) {
  const hay = stripHtml(haystack).toLowerCase();
  const needle = String(phrase || "").toLowerCase().trim();
  if (!needle) return false;
  if (hay.includes(needle)) return true;
  if (needle.endsWith("s") && hay.includes(needle.slice(0, -1))) return true;
  if (!needle.endsWith("s") && hay.includes(`${needle}s`)) return true;
  if (needle === "testes" && hay.includes("testis")) return true;
  if (needle === "testis" && hay.includes("testes")) return true;
  return false;
}

function draftFullText(draft) {
  const parts = [];
  for (const page of draft?.pages || []) {
    for (const block of page?.blocks || []) {
      parts.push(
        block?.content,
        block?.prompt,
        block?.question,
        block?.explanation,
        block?.answer,
        block?.title
      );
    }
  }
  return parts.filter(Boolean).join(" ");
}

function validateLessonAgainstTopicSpec(draft, topicSpec) {
  const text = draftFullText(draft);
  const missing = {
    structures: [],
    vocabulary: [],
    misconceptions: [],
    processes: [],
    outcomes: [],
  };

  for (const s of topicSpec.requiredStructures || []) {
    if (!textContainsPhrase(text, s)) missing.structures.push(s);
  }
  for (const v of topicSpec.requiredVocabulary || []) {
    if (!textContainsPhrase(text, v)) missing.vocabulary.push(v);
  }
  for (const m of topicSpec.commonMisconceptions || topicSpec.requiredMisconceptions || []) {
    if (!textContainsPhrase(text, m.split(" ")[0])) missing.misconceptions.push(m);
  }
  for (const p of topicSpec.requiredProcesses || []) {
    if (!textContainsPhrase(text, p.split(" ")[0])) missing.processes.push(p);
  }
  for (const o of topicSpec.learningOutcomes || []) {
    const token = o.split(" ").find((w) => w.length > 5) || o.split(" ")[0];
    if (token && !textContainsPhrase(text, token)) missing.outcomes.push(o);
  }

  const issues = [];
  if (missing.structures.length) issues.push(`Missing structures: ${missing.structures.join(", ")}`);
  if (missing.vocabulary.length) issues.push(`Missing vocabulary: ${missing.vocabulary.slice(0, 5).join(", ")}`);
  if (missing.outcomes.length > 2) {
    issues.push(`Missing learning outcomes coverage (${missing.outcomes.length} gaps)`);
  }

  const thinCoverage =
    !(topicSpec.requiredStructures?.length) && !(topicSpec.learningOutcomes?.length);

  return {
    valid: issues.length === 0,
    issues,
    missing,
    thinCoverage,
  };
}

function validateLessonForTopic(draft, specKey, topicSlug) {
  const topicSpec = resolveTopicSpecForGeneration(specKey, topicSlug);
  const result = validateLessonAgainstTopicSpec(draft, topicSpec);
  return { ...result, topicSpec };
}

function buildSpecValidatorFeedback(result) {
  return (result?.issues || []).map((i) => `SPEC: ${i}`);
}

module.exports = {
  validateLessonAgainstTopicSpec,
  validateLessonForTopic,
  buildSpecValidatorFeedback,
  textContainsPhrase,
};
