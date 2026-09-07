/**
 * Block 28 Phase 2 — filter meaningful lesson objectives from extracted noise.
 */

const STOPWORD_TERMS = new Set([
  "each",
  "lesson",
  "with",
  "from",
  "that",
  "this",
  "they",
  "page",
  "pages",
  "learn",
  "structured",
  "https",
  "http",
  "storage",
  "object",
  "public",
  "block",
  "definition",
  "model",
  "answer",
  "prior",
  "knowledge",
  "before",
  "start",
  "should",
  "already",
  "know",
  "familiarity",
  "concept",
  "basic",
  "understanding",
  "recall",
  "role",
  "see",
  "tier",
  "exam",
  "code",
  "biology",
  "edexcel",
  "igcse",
  "higher",
  "single",
  "stranded",
  "different",
  "sequence",
  "chromosome",
  "chromosomes",
  "diploid",
  "genetic",
  "variation",
  "lesson-media",
  "dyjiwezataxahbpuxjhz",
  "supabase",
  "png",
  "jpg",
  "co",
]);

const URL_PATTERN = /https?:\/\/|www\.|\.png|\.jpg|\.jpeg|\.gif|lesson-media|supabase|storage\/v1/i;
const HTML_PATTERN = /<[^>]+>|\[definition\]|\[image\]/i;
const PRIOR_KNOWLEDGE_PATTERN = /^prior knowledge\b|^before we start\b/i;

const BIOLOGY_OBJECTIVE_VERBS =
  /\b(define|describe|explain|compare|contrast|outline|evaluate|analyse|analyze|justify|apply|identify|state|suggest|recall|understand|recognise|recognize)\b/i;

function isNoiseToken(term) {
  const t = String(term || "").trim().toLowerCase();
  if (!t || t.length < 5) return true;
  if (STOPWORD_TERMS.has(t)) return true;
  if (URL_PATTERN.test(t)) return true;
  if (/^[a-z]{1,3}$/.test(t)) return true;
  return false;
}

function isMeaningfulObjective(text) {
  const raw = String(text || "").trim();
  if (!raw || raw.length < 25) return false;
  if (URL_PATTERN.test(raw)) return false;
  if (HTML_PATTERN.test(raw)) return false;
  if (PRIOR_KNOWLEDGE_PATTERN.test(raw)) return false;
  if (/^prior knowledge before we start/i.test(raw)) return false;
  const alphaWords = raw.replace(/[^a-zA-Z\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  if (alphaWords.length < 4) return false;
  if (!BIOLOGY_OBJECTIVE_VERBS.test(raw) && alphaWords.length < 8) return false;
  const noiseWordCount = alphaWords.filter((w) => STOPWORD_TERMS.has(w.toLowerCase())).length;
  if (noiseWordCount / alphaWords.length > 0.5) return false;
  return true;
}

function filterMeaningfulObjectives(coreConcepts) {
  const seen = new Set();
  const out = [];
  for (const raw of coreConcepts || []) {
    const lines = String(raw)
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines.length ? lines : [raw]) {
      if (!isMeaningfulObjective(line)) continue;
      const key = line.toLowerCase().slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(line);
    }
  }
  return out.slice(0, 12);
}

function filterMeaningfulKeyTerms(keyTerms) {
  return (keyTerms || []).filter((t) => !isNoiseToken(t)).slice(0, 25);
}

module.exports = {
  STOPWORD_TERMS,
  isNoiseToken,
  isMeaningfulObjective,
  filterMeaningfulObjectives,
  filterMeaningfulKeyTerms,
};
