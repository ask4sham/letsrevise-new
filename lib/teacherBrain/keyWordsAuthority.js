/**
 * Phase 3H.1.8b.0 — Key Words authority (profile-aware fallback + validation gate).
 */

const { resolveTeacherFirstKnowledgeProfile } = require("./teacherFirstKnowledgeProfiles");

/** Exam-framework / meta-teaching terms that must not dominate Key Words blocks. */
const FRAMEWORK_META_TERMS = new Set([
  "cause",
  "effect",
  "structure",
  "function",
  "keyword",
  "keywords",
  "explain",
  "compare",
  "evidence",
  "misconception",
  "mark scheme",
]);

const GCSE_TERM_DEFINITIONS = {
  receptor: "A specialised cell or organ that detects a specific stimulus.",
  stimulus: "A change in the environment detected by the body.",
  response: "The action or change produced by an effector after a stimulus.",
  "sensory neurone": "A neurone that carries impulses from receptors to the CNS.",
  "relay neurone": "A neurone in the CNS that connects sensory and motor neurones.",
  "motor neurone": "A neurone that carries impulses from the CNS to effectors.",
  synapse: "The gap between two neurones where impulses are transmitted chemically.",
  cns: "Central Nervous System — the brain and spinal cord.",
  pns: "Peripheral Nervous System — nerves outside the brain and spinal cord.",
  effector: "A muscle or gland that produces a response.",
  "myelin sheath": "Fatty layer around some neurones that speeds up impulse transmission.",
  axon: "The long fibre of a neurone that carries electrical impulses away from the cell body.",
  dendrite: "A branched extension of a neurone that receives impulses from other neurones.",
  homeostasis: "The regulation of internal conditions to maintain optimum conditions.",
  "coordination centre": "Processes information and coordinates a response (e.g. brain, spinal cord, pancreas).",
  optimum: "The best or most favourable condition for cells and enzymes.",
  "negative feedback": "A control mechanism that reverses a change to restore optimum conditions.",
  hormone: "A chemical messenger transported in the blood to target organs.",
  enzyme: "A biological catalyst that speeds up chemical reactions in the body.",
  cornea: "The transparent front part of the eye that refracts light.",
  iris: "The coloured ring of muscle that controls pupil size.",
  pupil: "The opening in the centre of the iris that lets light into the eye.",
  lens: "The elastic structure that changes shape to focus light on the retina.",
  retina: "The light-sensitive layer at the back of the eye containing photoreceptors.",
  "ciliary muscles": "Muscles that change the shape of the lens during accommodation.",
  "suspensory ligaments": "Fibres connecting ciliary muscles to the lens.",
  accommodation: "The process of changing lens shape to focus on near or distant objects.",
  refraction: "The bending of light as it passes from one medium to another.",
  photoreceptor: "A light-sensitive cell in the retina that detects light.",
  photoreceptors: "Light-sensitive cells in the retina that detect light and start nerve impulses.",
};

function sanitizeTopic(topic) {
  const t = String(topic || "this topic").trim() || "this topic";
  return t.replace(/\s+/g, " ").slice(0, 120);
}

function normalizeTermKey(term) {
  return String(term || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function formatKeywordTerm(term) {
  const raw = String(term || "").trim();
  if (!raw) return raw;
  if (/^[A-Z]{2,}$/.test(raw)) return raw;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function gcseDefinitionForTerm(term, topic) {
  const key = normalizeTermKey(term);
  if (GCSE_TERM_DEFINITIONS[key]) return GCSE_TERM_DEFINITIONS[key];
  const display = formatKeywordTerm(term);
  return `Key GCSE term for ${sanitizeTopic(topic)}: ${display}.`;
}

function isFrameworkMetaTerm(term) {
  return FRAMEWORK_META_TERMS.has(normalizeTermKey(term));
}

function collectProfileKeyWordsTerms(profile) {
  if (!profile) return [];
  const out = [];
  const seen = new Set();
  const add = (t) => {
    const key = normalizeTermKey(t);
    if (!key || seen.has(key) || isFrameworkMetaTerm(t)) return;
    seen.add(key);
    out.push(String(t).trim());
  };
  (profile.keyWordsTerms || []).forEach(add);
  (profile.examVocabulary || []).forEach(add);
  return out;
}

function extractTermsFromCoreModel(text = "") {
  const terms = [];
  const seen = new Set();
  const arrowParts = String(text).split(/\s*→\s*|\s*->\s*/);
  for (const part of arrowParts) {
    const cleaned = part
      .replace(/<[^>]+>/g, " ")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned || cleaned.length > 40) continue;
    const key = normalizeTermKey(cleaned);
    if (seen.has(key) || isFrameworkMetaTerm(cleaned)) continue;
    seen.add(key);
    terms.push(cleaned);
  }
  return terms;
}

function extractBoldTermsFromHtml(html = "") {
  const terms = [];
  const seen = new Set();
  for (const m of String(html).matchAll(/<strong[^>]*>([^<]+)<\/strong>/gi)) {
    const t = m[1].trim();
    const key = normalizeTermKey(t);
    if (!key || seen.has(key) || isFrameworkMetaTerm(t)) continue;
    if (/^👉|^keywords?$/i.test(t)) continue;
    seen.add(key);
    terms.push(t);
  }
  return terms;
}

function findBlockBodyByTitle(lessonText, titlePattern) {
  const chunks = String(lessonText || "").split(/\n(?=\d+\s*[—\-–]\s+)/);
  for (const chunk of chunks) {
    const firstLine = chunk.split("\n")[0] || "";
    if (titlePattern.test(firstLine)) {
      const pasteIdx = chunk.split("\n").findIndex((l) => /^Paste into:/i.test(l));
      return pasteIdx >= 0 ? chunk.split("\n").slice(pasteIdx + 1).join("\n") : chunk;
    }
  }
  return "";
}

function extractTermsFromLessonBlocks(lessonText = "") {
  const terms = [];
  const seen = new Set();
  const add = (t) => {
    const key = normalizeTermKey(t);
    if (!key || seen.has(key) || isFrameworkMetaTerm(t)) return;
    seen.add(key);
    terms.push(String(t).trim());
  };

  const coreModelBody = findBlockBodyByTitle(lessonText, /CORE\s+MODEL/i);
  extractTermsFromCoreModel(coreModelBody).forEach(add);

  const examVocabBody = findBlockBodyByTitle(lessonText, /EXAM\s+VOCABULARY/i);
  extractBoldTermsFromHtml(examVocabBody).forEach(add);

  return terms;
}

function resolveKeyWordsTermList(profile, lessonText) {
  const terms = [];
  const seen = new Set();
  const add = (t) => {
    const key = normalizeTermKey(t);
    if (!key || seen.has(key) || isFrameworkMetaTerm(t)) return;
    seen.add(key);
    terms.push(String(t).trim());
  };

  collectProfileKeyWordsTerms(profile).forEach(add);
  extractTermsFromLessonBlocks(lessonText).forEach(add);
  return terms;
}

function buildKeywordRowsFromTerms(terms, topic, count = 10) {
  const rows = [];
  const seen = new Set();
  for (const raw of terms) {
    const term = formatKeywordTerm(raw);
    const key = normalizeTermKey(term);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ term, def: gcseDefinitionForTerm(raw, topic) });
    if (rows.length >= count) break;
  }
  return rows;
}

function genericKeywordFallbackRows(topic, count) {
  const t = sanitizeTopic(topic);
  const base = [
    { term: "Cause", def: "Why something happens in this topic." },
    { term: "Effect", def: "What changes as an outcome." },
    { term: "Structure", def: "How parts fit together visually or logically." },
    { term: "Function", def: "What something does during the process." },
    { term: "Keyword", def: "A precise term examiners reward when explained." },
    { term: "Explain", def: `Give reasoning, not just naming from ${t.slice(0, 40)}.` },
    {
      term: "Compare",
      def: "Identify similarities and differences linked to consequences.",
    },
    { term: "Evidence", def: "A reasoning step that proves the answer." },
    { term: "Misconception", def: "A common confusion corrected in clear prose." },
    { term: "Mark scheme", def: "Shows what examiners reward in your explanation." },
  ];

  const rows = [];
  for (let i = 0; i < count; i++) {
    const b = base[i % base.length];
    const termName = i < base.length ? b.term : `${b.term} (${i + 1})`;
    rows.push({ term: termName, def: b.def });
  }
  return rows;
}

/**
 * Profile-aware keyword fallback (Phase 3H.1.8b.0).
 * Priority: profile keyWordsTerms + examVocabulary → lesson extraction → generic (last resort).
 */
function profileAwareKeywordFallback({
  topic = "",
  topicKey = "",
  subject = "Biology",
  lessonText = "",
  count = 10,
} = {}) {
  const profile = resolveTeacherFirstKnowledgeProfile({ topic, topicKey, subject });
  const terms = resolveKeyWordsTermList(profile, lessonText);
  let rows = buildKeywordRowsFromTerms(terms, topic, count);

  if (rows.length >= count) {
    return {
      rows: rows.slice(0, count),
      source: profile ? "profile" : "lesson",
      usedGenericFallback: false,
    };
  }

  if (rows.length > 0 && terms.length > 0) {
    let idx = 0;
    while (rows.length < count) {
      const raw = terms[idx % terms.length];
      const term = formatKeywordTerm(raw);
      const key = normalizeTermKey(term);
      if (!rows.some((r) => normalizeTermKey(r.term) === key)) {
        rows.push({ term, def: gcseDefinitionForTerm(raw, topic) });
      }
      idx++;
      if (idx > terms.length * 3 && rows.length < count) break;
    }
    if (rows.length >= count) {
      return { rows: rows.slice(0, count), source: "profile", usedGenericFallback: false };
    }
  }

  const needed = count - rows.length;
  if (needed > 0) {
    const generic = genericKeywordFallbackRows(topic, needed);
    rows = [...rows, ...generic];
    return {
      rows: rows.slice(0, count),
      source: rows.length > generic.length ? "mixed" : "generic",
      usedGenericFallback: true,
      warning: "Key Words used generic exam-framework fallback — no sufficient profile or lesson terms found.",
    };
  }

  return { rows: rows.slice(0, count), source: "profile", usedGenericFallback: false };
}

/** Improved keyword extraction — handles <br>, </li>, and comma-separated bold terms. */
function extractKeywordLines(htmlish = "") {
  const raw = String(htmlish || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const rows = [];
  const seen = new Set();

  function pushRow(term, def) {
    let t = String(term || "")
      .trim()
      .replace(/<\/?[^>]+>/g, "")
      .replace(/<\/li>$/i, "")
      .trim();
    let d = String(def || "")
      .trim()
      .replace(/<\/?[^>]+>/g, "")
      .replace(/<\/li>$/i, "")
      .trim();
    if (!t || t.length > 80) return;
    const key = normalizeTermKey(t);
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ term: t, def: d || "Key term for this topic." });
  }

  const segments = raw.split(/(?:<br\s*\/?>|\n)/i);
  for (const segment of segments) {
    const line = segment.trim();
    if (!line || /^Paste into:/i.test(line)) continue;

    let m =
      /<strong([^>]*)>([^<]+)<\/strong>\s*[–\-]\s*(.+)$/i.exec(line) ||
      /<strong([^>]*)>([^<]+)<\/strong>\s*-\s*(.+)$/i.exec(line);
    if (m) {
      pushRow(m[2], m[3]);
      continue;
    }

    if (/\*{2}.+\*{2}/.test(line)) {
      m = /\*{2}\s*(.+?)\*{2}\s*[–\-]\s*(.+)$/i.exec(line);
      if (m) {
        pushRow(m[1], m[2]);
        continue;
      }
    }

    const plain = line.replace(/^-\s*/, "").trim();
    const plainDash = /^(.+?)\s*[–\-]\s*(.+)$/.exec(plain);
    if (plainDash && plainDash[1].length < 60) {
      pushRow(plainDash[1], plainDash[2]);
    }
  }

  if (rows.length === 0) {
    raw.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
      const stripped = inner
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const dash = stripped.split(/\s*[–\-]\s*/);
      if (dash.length === 2) pushRow(dash[0].trim(), dash[1].trim());
      else if (stripped.length) pushRow(stripped.slice(0, 40), stripped);
      return "";
    });
  }

  if (rows.length < 10) {
    for (const t of extractBoldTermsFromHtml(raw)) {
      pushRow(t, "");
      if (rows.length >= 12) break;
    }
  }

  return rows.slice(0, 12);
}

function extractKeywordsBlockText(lessonText = "") {
  const lines = String(lessonText || "").split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^(\d+)\s*[—\-–]\s+.*\bKEY\s+WORDS\b/i.test(line)) {
      start = i;
      break;
    }
    if (/^(\d+)\s*[—\-–]\s+/i.test(line) && /\bPaste into:\s*key\s+words\b/i.test(lines.slice(i, i + 4).join("\n"))) {
      start = i;
      break;
    }
  }
  if (start < 0) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^(\d+)\s*[—\-–]\s+/i.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function evaluateKeyWordsAuthorityGate(lessonText = "", meta = {}) {
  const blockText = extractKeywordsBlockText(lessonText);
  const rows = extractKeywordLines(blockText);
  const frameworkTermsFound = rows
    .filter((r) => isFrameworkMetaTerm(r.term))
    .map((r) => r.term);
  const frameworkTermCount = frameworkTermsFound.length;
  const keywordCount = rows.length;
  const frameworkRatio = keywordCount ? frameworkTermCount / keywordCount : 0;
  const usedGenericFallback = Boolean(meta.usedGenericFallback);

  const warnings = [];
  if (frameworkRatio > 0.5) {
    warnings.push(
      `Key Words block is ${Math.round(frameworkRatio * 100)}% exam-framework meta-terms (${frameworkTermsFound.join(", ")}).`
    );
  }
  if (usedGenericFallback) {
    warnings.push("Generic keyword fallback was used — profile-aware terms were insufficient.");
  }
  if (keywordCount < 10) {
    warnings.push(`Key Words block has only ${keywordCount} parsed terms (expected 10).`);
  }

  const pass =
    keywordCount >= 10 && frameworkRatio <= 0.5 && !usedGenericFallback;

  return {
    pass,
    keywordCount,
    frameworkTermCount,
    frameworkRatio,
    frameworkTermsFound,
    usedGenericFallback,
    keywords: rows.map((r) => r.term),
    warnings,
  };
}

module.exports = {
  FRAMEWORK_META_TERMS,
  extractKeywordLines,
  extractKeywordsBlockText,
  profileAwareKeywordFallback,
  genericKeywordFallbackRows,
  evaluateKeyWordsAuthorityGate,
  resolveKeyWordsTermList,
  collectProfileKeyWordsTerms,
  isFrameworkMetaTerm,
  formatKeywordTerm,
  gcseDefinitionForTerm,
};
