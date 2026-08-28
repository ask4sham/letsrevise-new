/**
 * Phase 2 — open-world directive-aware question concept discovery (server-only).
 */

const { stripHtml } = require("../briefs/lessonContentExtractor");
const { extractConceptRefsFromText } = require("./taughtEvidenceBuilder");
const { createConceptRef, normalizeConceptId, safeStr, textMentionsConcept } = require("./conceptNormalization");
const {
  EVIDENCE_CLASS,
  CONFIDENCE_TIER,
  evidenceClassToConfidence,
  compareStrings,
} = require("./assessmentTargetTypes");

const COMMAND_WORDS = [
  "explain how",
  "explain why",
  "describe the structure of",
  "describe the adaptations of",
  "explain",
  "describe",
  "compare",
  "contrast",
  "state",
  "name",
  "identify",
  "evaluate",
  "suggest",
  "calculate",
  "give",
  "define",
  "why must",
  "why",
  "how",
];

const COMPARE_PATTERNS = [
  /\bcompare\b/i,
  /\bcontrast\b/i,
  /\bdifference between\b/i,
  /\bsimilarities and differences\b/i,
];

const RELATIONSHIP_PATTERNS = [
  /\bhow\b.+\b(contribute|affect|lead|cause|increase|reduce|result|link)\b/i,
  /\brelationship between\b/i,
];

function normalizeStem(stem) {
  return stripHtml(stem).replace(/\s+/g, " ").trim();
}

function detectCommandWord(clause) {
  const lower = clause.toLowerCase();
  for (const cw of COMMAND_WORDS) {
    const re = new RegExp(`^${cw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) return cw;
  }
  return null;
}

function splitDirectiveClauses(stem) {
  const text = normalizeStem(stem);
  if (!text) return [];

  const parts = text.split(/\s+and\s+|\s*;\s*/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return [text];

  const clauses = [];
  for (const part of parts) {
    if (detectCommandWord(part)) clauses.push(part);
    else if (clauses.length) clauses[clauses.length - 1] = `${clauses[clauses.length - 1]} and ${part}`;
    else clauses.push(part);
  }
  return clauses.length ? clauses : [text];
}

function extractObjectPhrase(clause, commandWord) {
  if (!commandWord) return clause.trim();
  const re = new RegExp(`^${commandWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i");
  return clause.replace(re, "").trim();
}

function isBroadAbstractPhrase(label) {
  const text = safeStr(label).toLowerCase();
  return (
    text.length >= 24 &&
    /\b(instability|issues|problems|challenges|factors|impact|effects|changes|events)\b/i.test(text)
  );
}

function isVagueAssessmentPhrase(label) {
  const text = safeStr(label).toLowerCase();
  if (!text) return true;
  if (text.length > 55) return true;
  if (isBroadAbstractPhrase(text)) return true;
  return /\b(key idea|this topic|the lesson|without naming|without only naming|important concept)\b/i.test(
    text
  );
}

function splitCoordinatedPair(tail) {
  const text = safeStr(tail).trim();
  const splitAt = text.toLowerCase().lastIndexOf(" and ");
  if (splitAt <= 0) return null;
  let left = text.slice(0, splitAt).trim();
  let right = text.slice(splitAt + 5).trim();
  const rightWords = right.split(/\s+/);
  const leftWords = left.split(/\s+/);
  if (rightWords.length > leftWords.length && rightWords.length >= 2) {
    const sharedTail = rightWords.slice(leftWords.length).join(" ");
    if (sharedTail && !left.toLowerCase().includes(sharedTail.toLowerCase())) {
      left = `${left} ${sharedTail}`.trim();
    }
  }
  return [left, right];
}

function phraseFromPatterns(objectPhrase) {
  const text = safeStr(objectPhrase).replace(/\.$/, "").trim();
  if (!text) return [];

  const found = [];

  const diffIdx = text.toLowerCase().indexOf("difference between");
  if (diffIdx >= 0) {
    const tail = text.slice(diffIdx + "difference between".length).trim().replace(/^the\s+/i, "");
    const pair = splitCoordinatedPair(tail);
    if (pair) {
      found.push(
        { label: pair[0], evidenceClass: EVIDENCE_CLASS.DIRECT_CLAUSE_MATCH, role: "direct" },
        { label: pair[1], evidenceClass: EVIDENCE_CLASS.DIRECT_CLAUSE_MATCH, role: "direct" }
      );
      return found;
    }
  }

  const causesMatch = text.match(/\bcauses of\s+(?:the\s+)?(.+?)$/i);
  if (causesMatch) {
    found.push({
      label: `causes of ${causesMatch[1].trim()}`,
      evidenceClass: EVIDENCE_CLASS.DIRECT_CLAUSE_MATCH,
      role: "direct",
    });
    return found;
  }

  const contributeMatch = text.match(
    /^(.+?)\s+(contributes?|affects?|leads?|increases?|reduces?|results?)\s+(?:to\s+)?(.+?)$/i
  );
  if (contributeMatch && !/\bcauses of\b/i.test(text)) {
    found.push({
      label: contributeMatch[1].trim(),
      evidenceClass: EVIDENCE_CLASS.DIRECT_CLAUSE_MATCH,
      role: "context",
    });
    found.push({
      label: contributeMatch[3].trim(),
      evidenceClass: EVIDENCE_CLASS.DIRECT_CLAUSE_MATCH,
      role: "direct",
    });
    return found;
  }

  const adaptationsMatch = text.match(/\badaptations?\s+of\s+(?:a\s+|an\s+|the\s+)?(.+?)$/i);
  if (adaptationsMatch) {
    found.push({
      label: `adaptations of ${adaptationsMatch[1].trim()}`,
      evidenceClass: EVIDENCE_CLASS.DIRECT_CLAUSE_MATCH,
      role: "direct",
    });
    return found;
  }

  const structureMatch = text.match(/\bstructure of\s+(?:a\s+|an\s+|the\s+)?(.+?)$/i);
  if (structureMatch) {
    found.push({
      label: `structure of ${structureMatch[1].trim()}`,
      evidenceClass: EVIDENCE_CLASS.DIRECT_CLAUSE_MATCH,
      role: "direct",
    });
    return found;
  }

  if (text.length >= 3) {
    found.push({
      label: text,
      evidenceClass: isVagueAssessmentPhrase(text)
        ? EVIDENCE_CLASS.WEAK_LEXICAL
        : EVIDENCE_CLASS.NORMALIZED_DIRECT_PHRASE,
      role: "direct",
    });
  }

  return found;
}

function refsFromPhraseEntries(entries, directiveIndex) {
  const out = [];
  for (const entry of entries) {
    const refs = extractConceptRefsFromText(entry.label);
    if (refs.length) {
      for (const ref of refs) {
        out.push({
          conceptId: ref.id,
          label: ref.name,
          directiveIndex,
          role: entry.role,
          evidenceClass: entry.label === ref.name ? entry.evidenceClass : EVIDENCE_CLASS.EXACT_DIRECT_TERM,
        });
      }
      continue;
    }
    const ref = createConceptRef(entry.label);
    out.push({
      conceptId: ref.id,
      label: ref.name,
      directiveIndex,
      role: entry.role,
      evidenceClass: entry.evidenceClass,
    });
  }
  return out;
}

function extractFromClause(clause, directiveIndex) {
  const lowerClause = clause.toLowerCase();
  let commandWord = detectCommandWord(clause);
  let objectPhrase = extractObjectPhrase(clause, commandWord);
  const phraseEntries = [];

  if (/\bdifference between\b/i.test(clause)) {
    const objectPhrase = extractObjectPhrase(clause, detectCommandWord(clause));
    const diffEntries = phraseFromPatterns(objectPhrase.replace(/^the\s+/i, ""));
    phraseEntries.push(...diffEntries);
    return refsFromPhraseEntries(phraseEntries, directiveIndex);
  }

  if (/\bcompare\b/i.test(clause)) {
    const compareTail = objectPhrase.replace(/^compare\s+/i, "").trim();
    const pair = splitCoordinatedPair(compareTail) || null;
    if (pair) {
      phraseEntries.push(
        { label: pair[0], evidenceClass: EVIDENCE_CLASS.DIRECT_CLAUSE_MATCH, role: "direct" },
        { label: pair[1], evidenceClass: EVIDENCE_CLASS.DIRECT_CLAUSE_MATCH, role: "direct" }
      );
      return refsFromPhraseEntries(phraseEntries, directiveIndex);
    }
  }

  if (/\bhow\b/i.test(lowerClause) && /\b(contribute|affect|lead|cause)\b/i.test(lowerClause)) {
    if (commandWord === "explain") {
      objectPhrase = clause.replace(/^explain\s+how\s+/i, "").trim();
    }
    phraseEntries.push(...phraseFromPatterns(objectPhrase));
    return refsFromPhraseEntries(phraseEntries, directiveIndex);
  }

  phraseEntries.push(...phraseFromPatterns(objectPhrase));
  return refsFromPhraseEntries(phraseEntries, directiveIndex);
}

function weakLexicalConcepts(text) {
  const words = normalizeStem(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4);
  return [...new Set(words)].slice(0, 3).map((w) => ({
    conceptId: normalizeConceptId(w),
    label: w,
    directiveIndex: 0,
    role: "context",
    evidenceClass: EVIDENCE_CLASS.WEAK_LEXICAL,
  }));
}

function mergeDiscovered(entries) {
  const byKey = new Map();
  for (const entry of entries) {
    const key = `${entry.directiveIndex}|${entry.conceptId}|${entry.role}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, entry);
      continue;
    }
    const rank = {
      [EVIDENCE_CLASS.EXACT_DIRECT_TERM]: 5,
      [EVIDENCE_CLASS.DIRECT_CLAUSE_MATCH]: 4,
      [EVIDENCE_CLASS.NORMALIZED_DIRECT_PHRASE]: 3,
      [EVIDENCE_CLASS.WEAK_LEXICAL]: 2,
      [EVIDENCE_CLASS.NONE]: 1,
    };
    if ((rank[entry.evidenceClass] || 0) > (rank[existing.evidenceClass] || 0)) {
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()].sort(
    (a, b) =>
      a.directiveIndex - b.directiveIndex ||
      compareStrings(a.conceptId, b.conceptId) ||
      compareStrings(a.role, b.role)
  );
}

function enrichConfidence(discovered) {
  return discovered.map((item) => ({
    ...item,
    confidence: evidenceClassToConfidence(item.evidenceClass),
  }));
}

/**
 * Open-world discovery from question text.
 * @param {object} input
 * @param {string} input.stem
 * @param {string[]} [input.options]
 * @param {string} [input.modelAnswer]
 */
function discoverQuestionAssessmentConcepts(input = {}) {
  const stem = normalizeStem(input.stem);
  const clauses = splitDirectiveClauses(stem);
  const discovered = [];

  clauses.forEach((clause, directiveIndex) => {
    discovered.push(...extractFromClause(clause, directiveIndex));
  });

  if (!discovered.length && stem) {
    discovered.push(...weakLexicalConcepts(stem));
  }

  const stemConceptIds = new Set(
    discovered.filter((d) => d.role === "direct").map((d) => d.conceptId)
  );

  const modelAnswer = normalizeStem(input.modelAnswer);
  if (modelAnswer) {
    for (const ref of extractConceptRefsFromText(modelAnswer)) {
      if (stemConceptIds.has(ref.id)) {
        discovered.push({
          conceptId: ref.id,
          label: ref.name,
          directiveIndex: 0,
          role: "direct",
          evidenceClass: EVIDENCE_CLASS.EXACT_DIRECT_TERM,
        });
      } else {
        discovered.push({
          conceptId: ref.id,
          label: ref.name,
          directiveIndex: 0,
          role: "context",
          evidenceClass: EVIDENCE_CLASS.WEAK_LEXICAL,
        });
      }
    }
  }

  for (const opt of input.options || []) {
    for (const ref of extractConceptRefsFromText(normalizeStem(opt))) {
      discovered.push({
        conceptId: ref.id,
        label: ref.name,
        directiveIndex: 0,
        role: "context",
        evidenceClass: EVIDENCE_CLASS.WEAK_LEXICAL,
      });
    }
  }

  const merged = enrichConfidence(mergeDiscovered(discovered));
  const directConcepts = merged.filter((d) => d.role === "direct");
  const contextConcepts = merged.filter((d) => d.role === "context");

  const confidentDirect = directConcepts.filter((d) => d.confidence === CONFIDENCE_TIER.CONFIDENT);
  const hasConfidentDirect = confidentDirect.length > 0;
  const hasAmbiguousOnly =
    !hasConfidentDirect &&
    directConcepts.some((d) => d.confidence === CONFIDENCE_TIER.AMBIGUOUS);

  return {
    stem,
    clauses,
    directConcepts,
    contextConcepts,
    confidentDirectConcepts: confidentDirect,
    hasConfidentDirect,
    hasAmbiguousOnly,
    isCompareStem: COMPARE_PATTERNS.some((re) => re.test(stem)),
    isRelationshipStem: RELATIONSHIP_PATTERNS.some((re) => re.test(stem)),
  };
}

function conceptMatchesRef(conceptId, ref) {
  if (!ref) return false;
  if (conceptId === ref.id) return true;
  return textMentionsConcept(ref.name, { id: conceptId, name: conceptId, matchTerms: [conceptId.replace(/_/g, " ")] });
}

module.exports = {
  discoverQuestionAssessmentConcepts,
  splitDirectiveClauses,
  detectCommandWord,
  extractObjectPhrase,
  splitCoordinatedPair,
  phraseFromPatterns,
  conceptMatchesRef,
  COMPARE_PATTERNS,
  RELATIONSHIP_PATTERNS,
};
