/**
 * GCSE Biology concept groups and canonical mark points for deterministic short-answer matching.
 */

export interface BiologyConceptGroup {
  id: string;
  includedLabel: string;
  improveLabel: string;
  matchers: RegExp[];
  markPointHints: string[];
}

/** One GCSE mark point — unique concept, student-friendly feedback, deterministic matchers. */
export interface CanonicalMarkPoint {
  id: string;
  conceptGroupId: string;
  includedLabel: string;
  improveLabel: string;
  matchers: RegExp[];
}

export const BIOLOGY_CONCEPT_GROUPS: BiologyConceptGroup[] = [
  {
    id: "temp_monitoring",
    includedLabel: "The hypothalamus monitors/detects body temperature.",
    improveLabel: "Explain that the hypothalamus monitors or detects body/blood temperature.",
    matchers: [
      /\b(monitors?|detects?|senses?|measures?)\b.{0,40}\b(temperature|temp)\b/,
      /\b(temperature|temp)\b.{0,40}\b(blood|body|brain|core)\b/,
      /\b(blood|body|brain|core)\b.{0,40}\b(temperature|temp)\b/,
      /\bthermoreceptor/,
      /\bbody temperature\b/,
      /\bblood temperature\b/,
      /\bcontrols?\s+body\s+temperature\b/,
    ],
    markPointHints: [
      "monitor",
      "detect",
      "temperature",
      "blood temperature",
      "body temperature",
      "thermoreceptor",
      "hypothalamus",
      "core temperature",
    ],
  },
  {
    id: "heat_loss_hot",
    includedLabel: "It triggers sweating and vasodilation when body temperature is too high.",
    improveLabel:
      "Describe sweating and/or vasodilation when body temperature rises (heat loss).",
    matchers: [
      /\b(sweat|vasodilat|dilat).{0,100}\b(rises?|hot|heat loss|too high|above|optimum|increase)\b/,
      /\b(rises?|hot|heat loss|too high|above|optimum).{0,100}\b(sweat|vasodilat|dilat)/,
      /\b(sweat|vasodilat)\b/,
      /\bvessels?\s+(widen|dilate)/,
      /\bincrease\s+heat\s+loss\b/,
    ],
    markPointHints: [
      "sweating",
      "sweat",
      "vasodilation",
      "vasodilate",
      "widen",
      "dilate",
      "hot",
      "heat loss",
      "rises",
      "cool",
      "arteriole",
    ],
  },
  {
    id: "heat_conservation_cold",
    includedLabel: "It triggers shivering and vasoconstriction when body temperature is too low.",
    improveLabel:
      "Describe shivering and/or vasoconstriction when body temperature falls (reduce heat loss).",
    matchers: [
      /\b(shiver|vasoconstric|constric).{0,100}\b(falls?|cold|too low|below|optimum|reduce|generate)\b/,
      /\b(falls?|cold|too low|below|optimum).{0,100}\b(shiver|vasoconstric|constric)/,
      /\b(shiver|vasoconstric)\b/,
      /\bvessels?\s+(narrow|constrict)/,
      /\breduc(e|es|ing)\s+heat\s+loss\b/,
      /\bgenerat(e|es|ing)\s+heat\b/,
    ],
    markPointHints: [
      "shivering",
      "shiver",
      "vasoconstriction",
      "vasoconstrict",
      "narrow",
      "constrict",
      "cold",
      "falls",
      "warm",
      "generate heat",
      "arteriole",
    ],
  },
  {
    id: "negative_feedback",
    includedLabel: "These responses use negative feedback to return body temperature to normal.",
    improveLabel:
      "Explain that negative feedback returns body temperature to normal (homeostasis).",
    matchers: [
      /\bnegative\s+feedback\b/,
      /\bhomeostasis\b/,
      /\breturn(s|ing)?\b.{0,60}\b(normal|optimum|set\s+point)\b/,
      /\brestores?\b.{0,30}\b(normal|optimum|temperature)\b/,
      /\bnegative\s+feedback\b.{0,80}\b(normal|optimum|temperature)\b/,
    ],
    markPointHints: [
      "negative feedback",
      "homeostasis",
      "normal",
      "set point",
      "restore",
      "return",
      "maintain",
    ],
  },
];

/** Curated GCSE mark-point profiles — only applied with strict question-context gating. */
export type CuratedMarkProfile = "thermoregulation" | "medulla_exercise";

export const THERMOREGULATION_MARK_POINTS: CanonicalMarkPoint[] = [
  {
    id: "thermo_monitor",
    conceptGroupId: "temp_monitoring",
    includedLabel: "The hypothalamus monitors/detects body temperature.",
    improveLabel: "Explain that the hypothalamus monitors or detects body/blood temperature.",
    matchers: BIOLOGY_CONCEPT_GROUPS.find((g) => g.id === "temp_monitoring")!.matchers,
  },
  {
    id: "thermo_hot",
    conceptGroupId: "heat_loss_hot",
    includedLabel: "It triggers sweating and vasodilation when body temperature is too high.",
    improveLabel:
      "Describe sweating and/or vasodilation when body temperature rises (heat loss).",
    matchers: BIOLOGY_CONCEPT_GROUPS.find((g) => g.id === "heat_loss_hot")!.matchers,
  },
  {
    id: "thermo_cold",
    conceptGroupId: "heat_conservation_cold",
    includedLabel: "It triggers shivering and vasoconstriction when body temperature is too low.",
    improveLabel:
      "Describe shivering and/or vasoconstriction when body temperature falls (reduce heat loss).",
    matchers: BIOLOGY_CONCEPT_GROUPS.find((g) => g.id === "heat_conservation_cold")!.matchers,
  },
  {
    id: "thermo_feedback",
    conceptGroupId: "negative_feedback",
    includedLabel: "These responses use negative feedback to return body temperature to normal.",
    improveLabel:
      "Explain that negative feedback returns body temperature to normal (homeostasis).",
    matchers: BIOLOGY_CONCEPT_GROUPS.find((g) => g.id === "negative_feedback")!.matchers,
  },
];

/** Fixed GCSE mark-point order for medulla during exercise (4 marks). */
export const MEDULLA_EXERCISE_MARK_POINTS: CanonicalMarkPoint[] = [
  {
    id: "medulla_monitor",
    conceptGroupId: "medulla_activity_monitor",
    includedLabel: "The medulla monitors/responds to changes during physical activity.",
    improveLabel:
      "Explain that the medulla detects or responds to changes during physical activity/exercise.",
    matchers: [
      /\bmedulla\b.{0,100}\b(monitor|detect|respond|change|activity|exercise|physical|homeostasis)/,
      /\b(monitor|detect|respond).{0,100}\bmedulla\b/,
      /\bmedulla\b.{0,100}\b(carbon dioxide|co2|oxygen)/,
    ],
  },
  {
    id: "medulla_breathing",
    conceptGroupId: "medulla_breathing_rate",
    includedLabel: "The medulla increases breathing rate.",
    improveLabel: "Explain that the medulla increases breathing/respiration rate during exercise.",
    matchers: [
      /\b(breathing|respiration)\s+rate\b/,
      /\bincrease(s|d|ing)?\b.{0,50}\b(breathing|respiration)\b/,
      /\bmedulla\b.{0,80}\b(breathing|respiration)\b/,
      /\b(breathing|respiration)\b.{0,50}\bincrease/,
    ],
  },
  {
    id: "medulla_heart",
    conceptGroupId: "medulla_heart_rate",
    includedLabel: "The medulla increases heart rate.",
    improveLabel: "Explain that the medulla increases heart rate during exercise.",
    matchers: [
      /\bheart\s+rate\b/,
      /\bincrease(s|d|ing)?\b.{0,50}\bheart\b/,
      /\bmedulla\b.{0,80}\bheart\b/,
      /\bheart\b.{0,50}\bincrease/,
    ],
  },
  {
    id: "medulla_homeostasis",
    conceptGroupId: "medulla_homeostasis_supply",
    includedLabel:
      "These responses maintain homeostasis by supplying oxygen/glucose to muscles and removing carbon dioxide.",
    improveLabel:
      "Explain how these responses maintain homeostasis (oxygen/glucose to muscles; remove carbon dioxide).",
    matchers: [
      /\bhomeostasis\b/,
      /\b(oxygen|glucose).{0,80}\bmuscle/,
      /\b(supply|supplies|deliver|delivers).{0,50}\b(oxygen|glucose)/,
      /\b(carbon dioxide|co2).{0,80}\b(remove|removed|removing|expel|breath)/,
      /\b(remove|removing|expel|breathe out).{0,50}\b(carbon dioxide|co2)/,
    ],
  },
];

export function getThermoregulationMarkPoints(maxMarks: number): CanonicalMarkPoint[] {
  return THERMOREGULATION_MARK_POINTS.slice(0, Math.max(1, maxMarks));
}

export function getMedullaExerciseMarkPoints(maxMarks: number): CanonicalMarkPoint[] {
  return MEDULLA_EXERCISE_MARK_POINTS.slice(0, Math.max(1, maxMarks));
}

/**
 * Strict gating for curated mark-point profiles.
 * Broad words like "homeostasis" alone must NOT select thermoregulation.
 */
export function detectCuratedMarkProfile(...texts: string[]): CuratedMarkProfile | null {
  const combined = normaliseMarkingText(texts.filter(Boolean).join(" "));
  if (!combined) return null;

  const hasMedulla = /\bmedulla\b/.test(combined);
  const hasHypothalamus = /\bhypothalamus\b/.test(combined);
  const hasExerciseContext = /\b(physical activity|during exercise|during physical activity|exercise)\b/.test(
    combined
  );
  const hasThermoTopic = /\bthermoregulation\b/.test(combined);
  const hasThermoTerms = /\b(body temperature|blood temperature|vasodilation|vasoconstriction|shivering|sweating|thermoreceptor|heat loss)\b/.test(
    combined
  );
  const hasReflexContext =
    /\b(reflex arc|reflex action)\b/.test(combined) ||
    (/\breflex\b/.test(combined) &&
      /\b(receptor|effector|neurone|neuron|motor neurone|sensory neurone|relay neurone)\b/.test(combined));

  if (hasReflexContext && !hasHypothalamus && !hasMedulla) return null;

  if (hasMedulla && hasExerciseContext && !hasHypothalamus && !hasThermoTopic && !hasThermoTerms) {
    return "medulla_exercise";
  }

  if (hasHypothalamus && (hasThermoTopic || hasThermoTerms || /\btemperature\b/.test(combined))) {
    return "thermoregulation";
  }

  if (hasThermoTopic && (hasThermoTerms || hasHypothalamus)) {
    return "thermoregulation";
  }

  return null;
}

/** @deprecated Prefer detectCuratedMarkProfile */
export function isThermoregulationContext(...texts: string[]): boolean {
  return detectCuratedMarkProfile(...texts) === "thermoregulation";
}

export function getConceptGroupById(id: string): BiologyConceptGroup | undefined {
  return BIOLOGY_CONCEPT_GROUPS.find((g) => g.id === id);
}

export function normaliseMarkingText(s = ""): string {
  return String(s)
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function textMatchesMatchers(normalisedText: string, matchers: RegExp[]): boolean {
  if (!normalisedText) return false;
  return matchers.some((re) => re.test(normalisedText));
}

export function textMatchesConceptGroup(
  normalisedText: string,
  group: BiologyConceptGroup
): boolean {
  return textMatchesMatchers(normalisedText, group.matchers);
}

export function textMatchesMarkPoint(normalisedText: string, markPoint: CanonicalMarkPoint): boolean {
  return textMatchesMatchers(normalisedText, markPoint.matchers);
}

export function primaryConceptGroupsForText(text: string): BiologyConceptGroup[] {
  const norm = normaliseMarkingText(text);
  if (!norm) return [];

  const scored = BIOLOGY_CONCEPT_GROUPS.map((group) => ({
    group,
    score: group.markPointHints.filter((hint) => {
      const h = normaliseMarkingText(hint);
      if (!h) return false;
      if (h.includes(" ")) return norm.includes(h);
      return h.length >= 5 && norm.split(" ").includes(h);
    }).length,
  }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return [];
  const top = scored[0].score;
  return scored.filter((entry) => entry.score === top).map((entry) => entry.group);
}

export function inferConceptGroupsForText(text: string): BiologyConceptGroup[] {
  const norm = normaliseMarkingText(text);
  if (!norm) return [];
  return BIOLOGY_CONCEPT_GROUPS.filter((group) =>
    group.markPointHints.some((hint) => {
      const h = normaliseMarkingText(hint);
      if (!h) return false;
      if (h.includes(" ")) return norm.includes(h);
      return h.length >= 5 && norm.split(" ").includes(h);
    })
  );
}

/** @deprecated Use getThermoregulationMarkPoints */
export function getThermoregulationGroups(): BiologyConceptGroup[] {
  return BIOLOGY_CONCEPT_GROUPS;
}
