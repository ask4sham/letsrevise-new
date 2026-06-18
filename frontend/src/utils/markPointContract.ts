/**
 * Launch-safe question-specific mark-point contract builder.
 * Mark points are extracted from the current question + model answer + mark scheme.
 * Topic profiles never drive scoring — only question-specific sources do.
 */

import { matchMarkSchemePoint } from "./shortAnswerMarking";

export type MarkingConfidence = "high" | "medium" | "low";

/** Legacy metadata only — profiles must not select scoring criteria */
export type SafeMarkProfile = "thermoregulation" | "medulla_exercise" | "reflex_arc" | null;

export interface MarkPointCriterionDef {
  id: string;
  label: string;
  evidenceRequired: string;
  acceptablePhrases: RegExp[];
  improveHint: string;
}

export interface MatchedMarkPoint {
  id: string;
  label: string;
  evidenceRequired: string;
  acceptablePhrases: RegExp[];
  matched: boolean;
  evidenceFromStudent?: string;
  improveHint: string;
}

export interface MarkPointContract {
  question: string;
  maxMarks: number;
  modelAnswer: string;
  markScheme: string[];
  /** Always derived from question sources; profiles are never used for scoring */
  profile: "derived";
  criteria: MatchedMarkPoint[];
  confidence: MarkingConfidence;
  guidedSelfCheck: string[];
}

export function normaliseMarkingText(s = ""): string {
  return String(s)
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, max = 100): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 3)}...`;
}

function studentFriendlyLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return trimmed;
  if (/^(mention|name|state|describe|explain|identify|give|define|analyse|analyze|evaluate|discuss|compare|link)\b/i.test(trimmed)) {
    const s = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    return s.endsWith(".") ? s : `${s}.`;
  }
  const s = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return s.endsWith(".") ? s : `${s}.`;
}

function tokenOverlapRatio(a: string, b: string): number {
  const ta = new Set(normaliseMarkingText(a).split(" ").filter((t) => t.length > 3));
  const tb = new Set(normaliseMarkingText(b).split(" ").filter((t) => t.length > 3));
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of Array.from(ta)) {
    if (tb.has(t)) shared++;
  }
  return shared / Math.max(ta.size, tb.size);
}

function extractDistinctiveTerms(text: string): string[] {
  return normaliseMarkingText(text)
    .split(" ")
    .filter((t) => t.length >= 5)
    .filter(
      (t) =>
        !/^(names?|links?|compares?|includes?|mentions?|describes?|explains?|evaluates?|states?|identifies?|discusses?|during|increase|increases|maintains|responds|specific|regions?|their|normal|functions?|importance|severity|overall|impact|consequences?|judgement|judgment|loss|function|damage|each|about|between|different|other|which|where|when|what|with|from|into|through|because|therefore|however)$/i.test(
          t
        )
    );
}

function isDescriptorMarkLine(line: string): boolean {
  return /^(names?|links?|compares?|includes?|mentions?|describes?|explains?|evaluates?|states?|identifies?|discusses?|analyses?|analyzes?)\b/i.test(
    line.trim()
  );
}

function isNearDuplicate(a: string, b: string): boolean {
  const na = normaliseMarkingText(a);
  const nb = normaliseMarkingText(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;

  const distinctiveA = extractDistinctiveTerms(a);
  const distinctiveB = extractDistinctiveTerms(b);
  if (distinctiveA.length && distinctiveB.length) {
    const sharedDistinctive = distinctiveA.filter((t) => distinctiveB.includes(t));
    if (sharedDistinctive.length === 0) return false;
  }

  return tokenOverlapRatio(a, b) >= 0.85;
}

function splitMarkSchemeLine(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  const parts = trimmed
    .split(/\s*;\s*|\s*\|\s*|\s+and\s+(?=[A-Z])|\.\s+(?=[A-Z])/)
    .map((p) => p.trim().replace(/\.$/, ""))
    .filter((p) => p.length > 8);

  return parts.length > 1 ? parts : [trimmed];
}

function splitIntoSentences(text: string): string[] {
  const ca = (text || "").replace(/\r\n/g, "\n").trim();
  if (!ca) return [];

  return ca
    .split(/\n+|(?<=[.!?])\s+/)
    .map((p) => p.trim().replace(/\.$/, ""))
    .filter((p) => p.length > 12);
}

function splitModelAnswerIntoChunks(modelAnswer: string): string[] {
  const sentences = splitIntoSentences(modelAnswer);
  const chunks: string[] = [];

  for (const sentence of sentences) {
    const subParts = splitMarkSchemeLine(sentence);
    chunks.push(...(subParts.length > 1 ? subParts : [sentence]));
  }

  return chunks.slice(0, 12);
}

function contextText(...texts: string[]): string {
  return normaliseMarkingText(texts.filter(Boolean).join(" "));
}

/** Metadata helper only — must not gate scoring criteria selection */
export function detectSafeMarkProfile(
  question: string,
  markScheme: string[],
  modelAnswer: string
): SafeMarkProfile {
  const combined = contextText(question, ...markScheme, modelAnswer);
  const q = contextText(question);

  const narrowMedulla =
    /\bmedulla\b/.test(q) &&
    /\b(physical activity|during exercise|exercise)\b/.test(q) &&
    !/\b(brain damage|brain region|evaluate|compare|cerebellum|cerebral cortex)\b/.test(q);
  const narrowThermo =
    /\bhypothalamus\b/.test(q) &&
    /\bthermoregulation\b/.test(q) &&
    !/\b(brain damage|brain region|evaluate)\b/.test(q);
  const narrowReflex =
    /\breflex\b/.test(q) &&
    /\b(reflex arc|withdrawal|receptor|sensory neurone|motor neurone|effector)\b/.test(combined) &&
    !/\b(brain damage|brain region|evaluate)\b/.test(q);

  if (narrowMedulla) return "medulla_exercise";
  if (narrowThermo) return "thermoregulation";
  if (narrowReflex) return "reflex_arc";
  return null;
}

function deriveCriteriaFromSources({
  markScheme,
  modelAnswer,
  maxMarks,
}: {
  question: string;
  markScheme: string[];
  modelAnswer: string;
  maxMarks: number;
}): MarkPointCriterionDef[] {
  const criteria: MarkPointCriterionDef[] = [];
  const seen: string[] = [];

  const remember = (line: string, source: "scheme" | "model" | "descriptor", index: number) => {
    const trimmed = line.trim();
    if (!trimmed || criteria.length >= maxMarks) return;
    if (seen.some((existing) => isNearDuplicate(existing, trimmed))) return;
    seen.push(trimmed);
    criteria.push({
      id: `${source}-${index}`,
      label: studentFriendlyLine(trimmed),
      evidenceRequired: trimmed,
      acceptablePhrases: [],
      improveHint: `Include: ${truncate(trimmed)}`,
    });
  };

  const contentScheme: string[] = [];
  const descriptorScheme: string[] = [];
  for (const line of markScheme) {
    for (const part of splitMarkSchemeLine(line)) {
      if (isDescriptorMarkLine(part)) descriptorScheme.push(part);
      else contentScheme.push(part);
    }
  }

  let schemeIndex = 0;
  for (const part of contentScheme) {
    remember(part, "scheme", schemeIndex++);
  }

  if (modelAnswer.trim()) {
    splitModelAnswerIntoChunks(modelAnswer).forEach((chunk, i) => {
      remember(chunk, "model", i);
    });
  }

  let descriptorIndex = 0;
  for (const part of descriptorScheme) {
    remember(part, "descriptor", descriptorIndex++);
  }

  return criteria.slice(0, maxMarks);
}

function matchCriterion(userAnswer: string, def: MarkPointCriterionDef): { matched: boolean; evidence?: string } {
  const ua = normaliseMarkingText(userAnswer);
  if (!ua) return { matched: false };

  for (const re of def.acceptablePhrases) {
    const m = ua.match(re);
    if (m) return { matched: true, evidence: m[0] };
  }

  const ok = matchMarkSchemePoint(userAnswer, def.evidenceRequired, []);
  if (ok) return { matched: true, evidence: def.evidenceRequired };

  return { matched: false };
}

function assessConfidence({
  criteriaDefs,
  markScheme,
  modelAnswer,
  maxMarks,
}: {
  criteriaDefs: MarkPointCriterionDef[];
  markScheme: string[];
  modelAnswer: string;
  maxMarks: number;
}): MarkingConfidence {
  if (!criteriaDefs.length) return "low";

  const model = modelAnswer.trim();
  const hasClearModel = model.length >= 40;
  const modelChunks = splitModelAnswerIntoChunks(model);
  const schemeLines = markScheme.filter(Boolean);
  const contentSchemeCount = schemeLines.filter((l) => !isDescriptorMarkLine(l)).length;

  if (contentSchemeCount >= maxMarks && criteriaDefs.length >= maxMarks) return "high";

  if (hasClearModel && criteriaDefs.length >= maxMarks && (contentSchemeCount >= 2 || modelChunks.length >= 3)) {
    return contentSchemeCount >= maxMarks ? "high" : "medium";
  }

  if (contentSchemeCount >= 2 && criteriaDefs.length >= 2 && hasClearModel) return "medium";
  if (schemeLines.length >= 2 && criteriaDefs.length >= 2 && hasClearModel) return "medium";
  if (schemeLines.length >= 1 && criteriaDefs.length >= Math.min(3, maxMarks) && model.length >= 80) {
    return "medium";
  }

  return "low";
}

function buildGuidedSelfCheck(criteria: MatchedMarkPoint[], markScheme: string[]): string[] {
  const fromCriteria = criteria.map((c) => `Check whether your answer mentions: ${c.label.replace(/\.$/, "")}`);
  if (fromCriteria.length) return fromCriteria;

  return markScheme.map((line) => `Check whether your answer mentions: ${line.replace(/\.$/, "")}`);
}

export function buildMarkPointContract({
  question = "",
  markScheme = [],
  modelAnswer = "",
  maxMarks,
  userAnswer = "",
}: {
  question?: string;
  markScheme?: string[];
  modelAnswer?: string;
  maxMarks: number;
  userAnswer?: string;
}): MarkPointContract {
  const scheme = markScheme.map((l) => String(l ?? "").trim()).filter(Boolean);
  const model = (modelAnswer || "").trim();
  const q = (question || "").trim();

  const criteriaDefs = deriveCriteriaFromSources({
    question: q,
    markScheme: scheme,
    modelAnswer: model,
    maxMarks,
  });

  const matchedCriteria: MatchedMarkPoint[] = criteriaDefs.map((def) => {
    const result = matchCriterion(userAnswer, def);
    return {
      id: def.id,
      label: def.label,
      evidenceRequired: def.evidenceRequired,
      acceptablePhrases: def.acceptablePhrases,
      matched: result.matched,
      evidenceFromStudent: result.evidence,
      improveHint: def.improveHint,
    };
  });

  const confidence = assessConfidence({
    criteriaDefs,
    markScheme: scheme,
    modelAnswer: model,
    maxMarks,
  });

  return {
    question: q,
    maxMarks,
    modelAnswer: model,
    markScheme: scheme,
    profile: "derived",
    criteria: matchedCriteria,
    confidence,
    guidedSelfCheck: buildGuidedSelfCheck(
      matchedCriteria.map((c) => ({ ...c, matched: false })),
      scheme
    ),
  };
}
