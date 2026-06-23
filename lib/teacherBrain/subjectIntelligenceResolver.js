/**
 * Phase 4.0 — Subject Intelligence Resolver.
 * Infers subject profile, concept archetype, and assessment skills from lesson metadata.
 * Always returns a complete resolution — never null / empty.
 */

const {
  normalizeSubjectIntelligenceKey,
  getSubjectIntelligenceProfile,
  GENERAL,
} = require("./subjectIntelligenceProfiles");
const { ALL_ARCHETYPES, GENERIC_CONCEPT, getConceptArchetype } = require("./conceptArchetypes");
const { getAssessmentSkillProfile, SKILLS_BY_KEY } = require("./assessmentSkillProfiles");
const { normalizeSubjectKey, subjectKeyFromTopicKey } = require("./teacherFirstKnowledgeProfiles");
const { isRequiredPracticalMode } = require("./requiredPracticalMode");

const SUBJECT_TOPIC_HINTS = [
  { subjectKey: "biology", patterns: [/photosynthesis/i, /respiration/i, /enzyme/i, /genetic/i, /ecology/i, /cell/i, /homeostasis/i, /nervous/i, /infection/i, /digestion/i] },
  { subjectKey: "chemistry", patterns: [/atomic structure/i, /bonding/i, /electrolysis/i, /rate of reaction/i, /mole/i, /acid/i, /alkali/i, /periodic/i] },
  { subjectKey: "physics", patterns: [/\bforces?\b/i, /\benergy\b/i, /\bwaves?\b/i, /electricity/i, /circuit/i, /magnet/i, /radioactiv/i] },
  { subjectKey: "maths", patterns: [/algebra/i, /\bgraph/i, /probability/i, /statistic/i, /geometry/i, /trigonometry/i, /simultaneous/i, /quadratic/i, /ratio/i, /proportion/i] },
  { subjectKey: "history", patterns: [/world war/i, /treaty of versailles/i, /medicine through time/i, /causes of/i, /nazi/i, /cold war/i, /holocaust/i, /significance of/i, /consequence/i] },
  { subjectKey: "geography", patterns: [/\brivers?\b/i, /\bcoasts?\b/i, /urbanisation/i, /urbanization/i, /climate change/i, /tectonic/i] },
  { subjectKey: "english", patterns: [/macbeth/i, /unseen poetry/i, /persuasive writing/i, /shakespeare/i, /poetry/i, /literature/i] },
  { subjectKey: "computer-science", patterns: [/algorithm/i, /\bbinary\b/i, /network/i, /pseudocode/i, /computing/i] },
  { subjectKey: "business", patterns: [/marketing mix/i, /cash flow/i, /stakeholder/i, /break.?even/i] },
  { subjectKey: "economics", patterns: [/supply and demand/i, /inflation/i, /\bgdp\b/i, /fiscal policy/i, /monetary policy/i] },
];

const ARCHETYPE_TOPIC_HINTS = [
  { archetypeKey: "maths-simultaneous", patterns: [/simultaneous/i, /two equations/i] },
  { archetypeKey: "maths-quadratics", patterns: [/quadratic/i, /discriminant/i, /completing the square/i] },
  { archetypeKey: "maths-ratio", patterns: [/ratio/i, /proportion/i, /divide in the ratio/i] },
  { archetypeKey: "maths-trigonometry", patterns: [/trigonometry/i, /\bsin\b/i, /\bcos\b/i, /\btan\b/i, /sohcahtoa/i] },
  { archetypeKey: "maths-algebra", patterns: [/^algebra$/i, /linear equation/i, /rearrang/i] },
  { archetypeKey: "history-consequence", patterns: [/treaty of versailles/i, /consequence/i, /aftermath/i] },
  { archetypeKey: "history-significance", patterns: [/significance of/i, /holocaust/i, /how significant/i] },
];

const LESSON_TYPE_SKILL_HINTS = [
  { lessonTypes: [/practical/i, /investigation/i, /required practical/i], skills: ["describe", "evaluate", "interpret-data"] },
  { lessonTypes: [/calculation/i, /numeracy/i], skills: ["calculate", "explain"] },
  { lessonTypes: [/essay/i, /extended/i], skills: ["essay-planning", "evaluate", "use-evidence"] },
  { lessonTypes: [/source/i], skills: ["source-analysis", "use-evidence"] },
];

const COMMAND_WORD_SKILL_MAP = [
  { rx: /\bcalculate\b|\bwork out\b/i, skill: "calculate" },
  { rx: /\bcompare\b|\bcontrast\b/i, skill: "compare" },
  { rx: /\bevaluate\b|\bassess\b|\bto what extent\b/i, skill: "evaluate" },
  { rx: /\banalys[e|z]\b|\bexamine\b/i, skill: "analyse" },
  { rx: /\bjustify\b|\bgive reasons\b/i, skill: "justify" },
  { rx: /\bexplain\b|\baccount for\b|\bsuggest why\b/i, skill: "explain" },
  { rx: /\bdescribe\b|\boutline\b/i, skill: "describe" },
  { rx: /\bhow useful\b|\bhow reliable\b|\bsource\b/i, skill: "source-analysis" },
  { rx: /\bdiscuss\b|\bexplore\b/i, skill: "essay-planning" },
  { rx: /\binterpret\b|\bfrom the (graph|table|data)\b/i, skill: "interpret-data" },
  { rx: /\bstate\b|\bname\b|\blist\b|\bdefine\b/i, skill: "recall" },
];

function buildHaystack(meta = {}) {
  return [
    meta.subject,
    meta.subjectKey,
    meta.topic,
    meta.title,
    meta.subTopic,
    meta.topicKey,
    meta.lessonType,
    meta.examBoard,
    meta.keywords,
    meta.label,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function resolveSubjectKey(meta = {}, hay = "") {
  const explicit =
    normalizeSubjectIntelligenceKey(meta.subject) ||
    normalizeSubjectIntelligenceKey(meta.subjectKey) ||
    normalizeSubjectKey(meta.subject) ||
    subjectKeyFromTopicKey(meta.topicKey);

  if (explicit) return explicit;

  for (const hint of SUBJECT_TOPIC_HINTS) {
    if (hint.patterns.some((rx) => rx.test(hay))) {
      return hint.subjectKey;
    }
  }

  return "general";
}

function resolveArchetypeKey(subjectKey, hay = "", meta = {}) {
  if (isRequiredPracticalMode(meta)) {
    const practicalKeys = {
      biology: "biology-practical",
      chemistry: "chemistry-practical",
      physics: "physics-practical",
    };
    if (practicalKeys[subjectKey]) return practicalKeys[subjectKey];
    return "biology-practical";
  }

  const candidates = ALL_ARCHETYPES.filter(
    (a) =>
      a.archetypeKey !== "generic-concept" &&
      (a.subjectKeys.includes(subjectKey) || a.subjectKeys.includes("general"))
  );

  for (const hint of ARCHETYPE_TOPIC_HINTS) {
    if (hint.patterns.some((rx) => rx.test(hay))) {
      const hinted = candidates.find((a) => a.archetypeKey === hint.archetypeKey);
      if (hinted) return hinted.archetypeKey;
    }
  }

  let best = null;
  let bestScore = 0;

  for (const archetype of candidates) {
    let score = 0;
    for (const rx of archetype.matchPatterns) {
      if (rx.test(hay)) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      best = archetype;
    }
  }

  if (best) return best.archetypeKey;

  const subjectProfile = getSubjectIntelligenceProfile(subjectKey);
  if (subjectProfile.defaultArchetypeKeys?.length) {
    return subjectProfile.defaultArchetypeKeys[0];
  }

  return GENERIC_CONCEPT.archetypeKey;
}

function resolveAssessmentSkillKeys(subjectKey, archetypeKey, hay = "", meta = {}) {
  const archetype = getConceptArchetype(archetypeKey);
  const subjectProfile = getSubjectIntelligenceProfile(subjectKey);
  const skills = new Set();

  for (const { rx, skill } of COMMAND_WORD_SKILL_MAP) {
    if (rx.test(hay)) skills.add(skill);
  }

  for (const hint of LESSON_TYPE_SKILL_HINTS) {
    if (hint.lessonTypes.some((rx) => rx.test(hay) || rx.test(String(meta.lessonType || "")))) {
      hint.skills.forEach((s) => skills.add(s));
    }
  }

  for (const s of archetype.defaultAssessmentSkills || []) skills.add(s);
  for (const s of subjectProfile.defaultAssessmentSkills || []) skills.add(s);

  if (skills.size === 0) {
    skills.add("describe");
    skills.add("explain");
  }

  const primary = [...skills].sort((a, b) => {
    const levelA = SKILLS_BY_KEY[a]?.cognitiveLevel || 0;
    const levelB = SKILLS_BY_KEY[b]?.cognitiveLevel || 0;
    return levelB - levelA;
  });

  return {
    primarySkillKey: primary[0],
    emphasisSkillKeys: primary.slice(0, 4),
  };
}

/**
 * @param {object} [meta]
 * @returns {{
 *   subjectKey: string,
 *   subjectProfile: import("./subjectIntelligenceProfiles").SubjectIntelligenceProfile,
 *   archetypeKey: string,
 *   archetype: import("./conceptArchetypes").ConceptArchetype,
 *   primarySkillKey: string,
 *   primarySkill: import("./assessmentSkillProfiles").AssessmentSkillProfile,
 *   emphasisSkillKeys: string[],
 *   emphasisSkills: import("./assessmentSkillProfiles").AssessmentSkillProfile[],
 *   isFallback: boolean,
 *   haystack: string,
 * }}
 */
function resolveSubjectIntelligence(meta = {}) {
  const haystack = buildHaystack(meta);
  const subjectKey = resolveSubjectKey(meta, haystack);
  const subjectProfile = getSubjectIntelligenceProfile(subjectKey);
  const archetypeKey = resolveArchetypeKey(subjectKey, haystack, meta);
  const archetype = getConceptArchetype(archetypeKey);
  const { primarySkillKey, emphasisSkillKeys } = resolveAssessmentSkillKeys(
    subjectKey,
    archetypeKey,
    haystack,
    meta
  );

  const matchedByPattern =
    subjectKey !== "general" &&
    (subjectProfile.matchPatterns.some((rx) => rx.test(haystack)) ||
      SUBJECT_TOPIC_HINTS.find((h) => h.subjectKey === subjectKey)?.patterns.some((rx) =>
        rx.test(haystack)
      ));

  const matchedArchetype = archetype.matchPatterns.some((rx) => rx.test(haystack));

  return {
    subjectKey,
    subjectProfile,
    archetypeKey,
    archetype,
    primarySkillKey,
    primarySkill: getAssessmentSkillProfile(primarySkillKey),
    emphasisSkillKeys,
    emphasisSkills: emphasisSkillKeys.map((k) => getAssessmentSkillProfile(k)),
    isFallback: subjectKey === "general" || (!matchedByPattern && !matchedArchetype),
    haystack,
  };
}

module.exports = {
  buildHaystack,
  resolveSubjectKey,
  resolveArchetypeKey,
  resolveAssessmentSkillKeys,
  resolveSubjectIntelligence,
};
