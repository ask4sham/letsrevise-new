/**
 * Resolve free-text / composite lesson labels to canonical taxonomy topic keys.
 * Matching order: exact display → normalized display → slug → alias/fuzzy.
 * Uses flattenTaxonomyLeafTopics so flat (AQA) and section-nested (Edexcel) share one contract.
 */
const { getTaxonomyBySpecKey, flattenTaxonomyLeafTopics } = require("./topicTaxonomy");

function safeStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

function normalizeTopicString(raw = "") {
  return safeStr(raw)
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\band\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** @param {string} raw */
function topicToKey(raw) {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Compare slugs with "and" tokens optional (FSH & LH vs FSH and LH). */
function loosenSlugForCompare(slug) {
  return safeStr(slug)
    .toLowerCase()
    .replace(/-and-/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Split composite labels like "Biology — Metabolism (AQA GCSE Biology)". */
function extractLabelCandidates(...sources) {
  const out = [];
  const add = (s) => {
    const t = safeStr(s);
    if (!t) return;
    if (!out.includes(t)) out.push(t);
  };

  for (const source of sources) {
    const raw = safeStr(source);
    if (!raw) continue;
    add(raw);
    const noParens = raw.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    add(noParens);
    const beforeExamCode = noParens.split(/\bexam\s+code\b/i)[0].trim();
    add(beforeExamCode);
    for (const part of noParens.split(/[–—|:]/)) {
      add(part.trim());
    }
    for (const part of beforeExamCode.split(/[–—|:]/)) {
      add(part.trim());
    }
    const emParts = noParens.split(/\s+[–—]\s+/);
    if (emParts.length > 1) {
      add(emParts[emParts.length - 1].trim());
    }
  }
  return out;
}

function normalizeDisplayLabel(label) {
  return normalizeTopicString(label);
}

function labelTokens(normalized) {
  return normalized.split(/\s+/).filter((t) => t.length >= 3);
}

function allTokensContained(shorterNorm, longerNorm) {
  const shortTokens = labelTokens(shorterNorm);
  const longSet = new Set(labelTokens(longerNorm));
  if (shortTokens.length < 2 || longSet.size < shortTokens.length) return false;
  return shortTokens.every((t) => longSet.has(t));
}

/** Known lesson-title aliases → canonical slug (keep in sync with normalizeLessonTopicKey). */
function aliasSlugFromNormalized(normalized) {
  const t = normalizeDisplayLabel(normalized);
  if (!t) return null;
  if (/\bphotosynth(?:esis|etic)\b/.test(t)) return "photosynthesis";
  if (/\bbioenergetics\b/.test(t) && /\bphoto/.test(t)) return "photosynthesis";
  if (t.includes("photosynthesis")) return "photosynthesis";
  if (/\b(?:aerobic|anaerobic)?\s*respiration\b/.test(t)) return "respiration";
  if (/\baerobic\b/.test(t) && /\banaerobic\b/.test(t)) return "respiration";
  if (t.includes("respiration")) return "respiration";
  if (/\blimiting factor/.test(t) && /\bphoto/.test(t)) return "photosynthesis";
  if (/\blimiting factor/.test(t)) return "photosynthesis";
  if (/\buses of glucose\b/.test(t)) return "photosynthesis";
  if (/\bmetabolism\b/.test(t) && !/\benzyme/.test(t)) return "metabolism";
  if (/\bresponse to exercise\b/.test(t)) return "response-to-exercise";
  if (/\bsecondary sexual characteristics?\b/.test(t)) {
    return "development-of-secondary-sexual-characteristics";
  }
  return null;
}

/**
 * @param {Array<{ topic?: string, key?: string }>} topics
 * @param {string} candidate
 * @returns {{ key: string, match: string } | null}
 */
function matchCandidateAgainstTopics(topics, candidate) {
  const c = safeStr(candidate);
  if (!c || !Array.isArray(topics)) return null;
  const normC = normalizeDisplayLabel(c);
  const slugC = topicToKey(c);
  const looseSlugC = slugC ? loosenSlugForCompare(slugC) : "";

  for (const t of topics) {
    const display = safeStr(t.topic);
    const key = safeStr(t.key);
    if (!key) continue;
    if (display && display.toLowerCase() === c.toLowerCase()) {
      return { key, match: "exact-display" };
    }
  }

  for (const t of topics) {
    const display = safeStr(t.topic);
    const key = safeStr(t.key);
    if (!key || !display) continue;
    if (normalizeDisplayLabel(display) === normC) {
      return { key, match: "normalized-display" };
    }
  }

  if (slugC) {
    for (const t of topics) {
      const key = safeStr(t.key);
      if (!key) continue;
      if (key.toLowerCase() === slugC) {
        return { key, match: "slug" };
      }
      if (looseSlugC && loosenSlugForCompare(key) === looseSlugC) {
        return { key, match: "slug" };
      }
    }
  }

  const alias = aliasSlugFromNormalized(normC);
  if (alias) {
    for (const t of topics) {
      const key = safeStr(t.key);
      if (key === alias) return { key, match: "alias" };
    }
  }

  if (normC.length >= 4) {
    let best = null;
    for (const t of topics) {
      const display = safeStr(t.topic);
      const key = safeStr(t.key);
      if (!display || !key) continue;
      const normD = normalizeDisplayLabel(display);
      const contains =
        normD.includes(normC) ||
        normC.includes(normD) ||
        allTokensContained(normC, normD) ||
        allTokensContained(normD, normC);
      if (contains) {
        if (!best || normD.length < normalizeDisplayLabel(best.display).length) {
          best = { key, match: "fuzzy-contains", display };
        }
      }
    }
    if (best) return { key: best.key, match: best.match };
  }

  return null;
}

/**
 * @param {string} specKey
 * @param {...string} labelSources
 * @returns {{ key: string | null, match: string | null, candidate: string | null }}
 */
function resolveTopicLabelToKey(specKey, ...labelSources) {
  const spec = safeStr(specKey);
  if (!spec) return { key: null, match: null, candidate: null };

  const taxonomy = getTaxonomyBySpecKey(spec);
  const topics = flattenTaxonomyLeafTopics(taxonomy);
  if (!topics.length) return { key: null, match: null, candidate: null };

  const candidates = extractLabelCandidates(...labelSources);
  for (const candidate of candidates) {
    const hit = matchCandidateAgainstTopics(topics, candidate);
    if (hit) return { key: hit.key, match: hit.match, candidate };
  }
  return { key: null, match: null, candidate: candidates[0] || null };
}

function logTopicMappingDebug(scope, payload) {
  if (process.env.NODE_ENV === "production") return;
  console.debug(`[topic-mapping:${scope}]`, payload);
}

module.exports = {
  extractLabelCandidates,
  topicToKey,
  normalizeTopicString,
  normalizeDisplayLabel,
  loosenSlugForCompare,
  aliasSlugFromNormalized,
  resolveTopicLabelToKey,
  matchCandidateAgainstTopics,
  logTopicMappingDebug,
};
