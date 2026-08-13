'use strict';

/**
 * Quiz Topic Grounding V1 — deterministic boundary checks for lesson.quiz.questions.
 * Prevents adjacent-topic stem packs / AI repair from freezing off-topic MCQs into a lesson.
 */

const GROUNDING_RESULT = Object.freeze({
  PASS: 'PASS',
  REJECT_CROSS_TOPIC: 'REJECT_CROSS_TOPIC',
  REJECT_UNSUPPORTED: 'REJECT_UNSUPPORTED',
  REJECT_DUPLICATE: 'REJECT_DUPLICATE',
});

const MITOSIS_FORBIDDEN = [
  /\bwhy must\b[^?]{0,80}\b(human\s+)?gametes?\b[^?]{0,40}\bhaploid\b/i,
  /\bgametes?\b[^?]{0,60}\bhaploid\b[^?]{0,40}\bfertilis/i,
  /\bhaploid\b[^?]{0,40}\bfertilis/i,
  /\bhow does fertilisation restore\b/i,
  /\bwhy does meiosis halve\b/i,
  /\bmeiosis\b[^?]{0,60}\bproduce(s)?\b[^?]{0,30}\bgametes?\b/i,
  /\bindependent assortment\b/i,
  /\bwhich sequence is correct for sexual reproduction\b/i,
  /\bmeiosis\s*→\s*gametes\s*→\s*fertilisation\b/i,
];

const MEIOSIS_FORBIDDEN = [
  /\bwhy is mitosis used for repair\b/i,
  /\bhow many daughter cells are produced in mitosis\b/i,
  /\bmitosis produces genetically identical\b/i,
  /\bcell cycle\b[^?]{0,40}\binterphase\b/i,
];

const PHOTOSYNTHESIS_FORBIDDEN = [
  /\baerobic respiration\b/i,
  /\banaerobic respiration\b/i,
  /\batp\b[^?]{0,40}\brespir/i,
  /\brespiration\b[^?]{0,40}\batp\b/i,
  /\bglucose\b[^?]{0,50}\brespir/i,
];

const RESPIRATION_FORBIDDEN = [
  /\bphotosynthesis\b/i,
  /\bchloroplast\b/i,
  /\blight intensity\b[^?]{0,40}\bphotosynth/i,
  /\bword equation\b[^?]{0,40}\bphotosynth/i,
  /\blimiting factor\b[^?]{0,40}\bphotosynth/i,
];

const OESTROGEN_PROGESTERONE_FORBIDDEN = [
  /\bfsh\b/i,
  /\blh\b/i,
  /\bfollicle stimulating\b/i,
  /\bluteinising\b/i,
  /\badh\b/i,
];

const FSH_LH_FORBIDDEN = [
  /\boestrogen\b/i,
  /\bprogesterone\b/i,
  /\btestosterone\b/i,
  /\binsulin\b/i,
  /\badrenaline\b/i,
];

const PROFILE_FORBIDDEN = {
  'mitosis-cell-cycle': MITOSIS_FORBIDDEN,
  mitosis: MITOSIS_FORBIDDEN,
  meiosis: MEIOSIS_FORBIDDEN,
  'the-process-of-photosynthesis': PHOTOSYNTHESIS_FORBIDDEN,
  photosynthesis: PHOTOSYNTHESIS_FORBIDDEN,
  'factors-affecting-the-rate-of-photosynthesis': PHOTOSYNTHESIS_FORBIDDEN,
  respiration: RESPIRATION_FORBIDDEN,
  'aerobic-respiration': RESPIRATION_FORBIDDEN,
  'anaerobic-respiration': RESPIRATION_FORBIDDEN,
  'hormones-adrenaline-insulin-testosterone-progesterone-and-oestrogen': OESTROGEN_PROGESTERONE_FORBIDDEN,
  'hormones-adh-fsh-and-lh': FSH_LH_FORBIDDEN,
  'the-role-of-hormones-adh-fsh-and-lh': FSH_LH_FORBIDDEN,
};

const MITOSIS_ALLOWED = [
  /\bmitosis\b/i,
  /\bcell cycle\b/i,
  /\bdaughter cells?\b/i,
  /\bgenetically identical\b/i,
  /\bchromosomes?\b.*\b(duplicate|copy|copied|replicat)/i,
  /\b(copied|copy|replicat)\b.*\bchromosomes?\b/i,
  /\bgrowth\b/i,
  /\brepair\b/i,
  /\basexual reproduction\b/i,
  /\bcytokinesis\b/i,
  /\binterphase\b/i,
];

const MEIOSIS_ALLOWED = [
  /\bmeiosis\b/i,
  /\bgametes?\b/i,
  /\bhaploid\b/i,
  /\bfertilis/i,
  /\bzygote\b/i,
  /\bvariation\b/i,
  /\bindependent assortment\b/i,
  /\bcrossing over\b/i,
];

const PHOTOSYNTHESIS_ALLOWED = [
  /\bphotosynth/i,
  /\bchloroplast\b/i,
  /\blight\b/i,
  /\bglucose\b/i,
  /\bstarch\b/i,
  /\blimiting factor\b/i,
];

const RESPIRATION_ALLOWED = [
  /\brespir/i,
  /\batp\b/i,
  /\baerobic\b/i,
  /\banaerobic\b/i,
  /\bmitochondri/i,
];

const PROFILE_ALLOWED = {
  'mitosis-cell-cycle': MITOSIS_ALLOWED,
  mitosis: MITOSIS_ALLOWED,
  meiosis: MEIOSIS_ALLOWED,
  'the-process-of-photosynthesis': PHOTOSYNTHESIS_ALLOWED,
  photosynthesis: PHOTOSYNTHESIS_ALLOWED,
  respiration: RESPIRATION_ALLOWED,
};

/** Concepts that may appear in a mitosis lesson only when explicitly taught. */
const MITOSIS_NEIGHBOUR_CONCEPTS = ['meiosis', 'gamete', 'gametes', 'fertilisation', 'fertilization', 'haploid', 'zygote'];

function parseTopicKeyShort(topicKey) {
  const raw = String(topicKey || '').trim().toLowerCase();
  if (!raw) return '';
  return raw.includes(':') ? raw.split(':').pop() : raw;
}

function parseSpecKey(topicKey, specKey) {
  if (specKey) return String(specKey).trim().toLowerCase();
  const raw = String(topicKey || '').trim().toLowerCase();
  if (raw.includes(':')) return raw.split(':')[0];
  return '';
}

function normalizeStem(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function questionStemOnly(q) {
  return [q?.question, q?.prompt, q?.questionText, q?.stem].filter(Boolean).join(" ");
}

/** Stem + keyed answer fields only — excludes distractors/options. */
function questionAssessedHaystack(q) {
  return [
    q?.question,
    q?.prompt,
    q?.questionText,
    q?.stem,
    q?.correctAnswer,
    q?.explanation,
    q?.modelAnswer,
    q?.markScheme,
  ]
    .filter(Boolean)
    .join(" ");
}

function questionHaystack(q) {
  const parts = [
    q?.question,
    q?.prompt,
    q?.questionText,
    q?.stem,
    q?.correctAnswer,
    q?.explanation,
  ];
  if (Array.isArray(q?.options)) parts.push(...q.options);
  if (Array.isArray(q?.choices)) parts.push(...q.choices);
  return parts.filter(Boolean).join(' ');
}

/**
 * Bank-backed questions bypass grounding in V1 (attach paths are topic-scoped).
 * V2 TECHNICAL DEBT: validate sourceQuestionId against lesson topicKey — duplicate+retopic
 * can leave stale bank provenance from Topic A on a Topic B lesson.
 */
function isBankBackedQuestion(q) {
  if (!q || typeof q !== 'object') return false;
  if (q.sourceQuestionId) return true;
  const src = String(q.sourceType || q.source || '').toLowerCase();
  return src === 'topicquizquestion' || src === 'topic_quiz_bank' || src === 'topic-bank';
}

/**
 * Resolve grounding profile slug from namespaced topicKey + human label.
 */
function resolveGroundingProfileKey(topicKey, topicLabel) {
  const slug = parseTopicKeyShort(topicKey);
  const label = String(topicLabel || '').toLowerCase();
  const combined = `${slug} ${label}`.replace(/-/g, ' ');

  if (PROFILE_FORBIDDEN[slug]) return slug;

  if (/\bmeiosis\b/.test(combined) && !/\bmitosis and the cell cycle\b/.test(combined)) {
    if (!/\bmitosis\b/.test(combined) || /\bmeiosis\b/.test(combined)) return 'meiosis';
  }
  if (/\bmitosis\b/.test(combined) || /\bcell cycle\b/.test(combined)) return 'mitosis-cell-cycle';
  if (/\bphotosynth/.test(combined)) return 'photosynthesis';
  if (/\brespir/.test(combined) && !/\bphotosynth/.test(combined)) return 'respiration';
  if (/\boestrogen\b/.test(combined) || /\bprogesterone\b/.test(combined)) {
    return 'hormones-adrenaline-insulin-testosterone-progesterone-and-oestrogen';
  }
  if (/\bfsh\b/.test(combined) || /\blh\b/.test(combined) || /\badh\b/.test(combined)) {
    return 'hormones-adh-fsh-and-lh';
  }

  return slug || null;
}

/** Block types that are assessment/quiz banks — never instructional teaching. */
const EXCLUDED_TEACHING_BLOCK_TYPES = new Set([
  'checkpoint',
  'selfcheck',
  'pagequiz',
  'quiz',
  'assessment',
  'misconceptions',
  'examtips',
]);

/**
 * Block roles that are assessment prompts, deliberate mistakes, terminology glossaries,
 * or exam-technique guidance (contrast/caution wording, not substantive teaching) —
 * excluded even when they mention neighbour terms.
 */
const EXCLUDED_TEACHING_BLOCK_ROLES = new Set([
  'exampractice',
  'commonmistake',
  'examvocabulary',
  'examtechnique',
]);

function shouldExcludeBlockFromTeachingHaystack(block) {
  const type = String(block?.type || '').toLowerCase();
  const role = String(block?.role || '').toLowerCase();
  if (EXCLUDED_TEACHING_BLOCK_TYPES.has(type)) return true;
  if (EXCLUDED_TEACHING_BLOCK_ROLES.has(role)) return true;
  return false;
}

function extractLessonTeachingText(pages, extras = {}) {
  const parts = [];
  if (Array.isArray(extras.objectives)) {
    for (const o of extras.objectives) parts.push(String(o || ''));
  }
  if (Array.isArray(extras.vocabulary)) {
    for (const v of extras.vocabulary) parts.push(String(v || ''));
  }
  if (typeof extras.topic === 'string') parts.push(extras.topic);

  for (const page of pages || []) {
    for (const block of page?.blocks || []) {
      if (shouldExcludeBlockFromTeachingHaystack(block)) continue;
      if (block?.content) parts.push(String(block.content));
      if (block?.title) parts.push(String(block.title));
      if (block?.intro) parts.push(String(block.intro));
    }
  }
  return parts.join(' ').toLowerCase();
}

function conceptTaughtInLesson(concept, teachingText) {
  if (!concept || !teachingText) return false;
  const re = new RegExp(`\\b${concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return re.test(teachingText);
}

function matchesAnyPattern(text, patterns) {
  if (!text || !patterns?.length) return false;
  return patterns.some((re) => re.test(text));
}

function matchesAllowedProfile(text, profileKey) {
  const allowed = PROFILE_ALLOWED[profileKey];
  if (!allowed?.length) return true;
  return matchesAnyPattern(text, allowed);
}

/**
 * @param {object} q - quiz question record or stem pack item
 * @param {object} ctx - { topicKey, specKey, topic, pages, objectives, vocabulary, teachingText }
 * @returns {{ result: string, reason?: string, profileKey?: string }}
 */
function classifyQuizQuestion(q, ctx = {}) {
  const stemHaystack = questionStemOnly(q);
  const assessedHaystack = questionAssessedHaystack(q);
  if (!stemHaystack.trim() && !assessedHaystack.trim()) {
    return { result: GROUNDING_RESULT.REJECT_UNSUPPORTED, reason: 'empty_question' };
  }

  if (isBankBackedQuestion(q)) {
    return { result: GROUNDING_RESULT.PASS, reason: 'bank_backed' };
  }

  const profileKey = resolveGroundingProfileKey(ctx.topicKey, ctx.topic || ctx.topicLabel);
  if (!profileKey) {
    return { result: GROUNDING_RESULT.PASS, reason: 'no_profile' };
  }

  const teachingText =
    ctx.teachingText || extractLessonTeachingText(ctx.pages, ctx);
  const forbidden = PROFILE_FORBIDDEN[profileKey] || [];

  if (matchesAnyPattern(assessedHaystack, forbidden)) {
    if (profileKey === 'mitosis-cell-cycle' || profileKey === 'mitosis') {
      const neighbourExplicitlyTaught = MITOSIS_NEIGHBOUR_CONCEPTS.some((c) =>
        conceptTaughtInLesson(c, teachingText)
      );
      if (!neighbourExplicitlyTaught) {
        return {
          result: GROUNDING_RESULT.REJECT_CROSS_TOPIC,
          reason: 'forbidden_neighbour_concept',
          profileKey,
        };
      }
    } else {
      return {
        result: GROUNDING_RESULT.REJECT_CROSS_TOPIC,
        reason: 'forbidden_topic_signal',
        profileKey,
      };
    }
  }

  if (profileKey === 'mitosis-cell-cycle' || profileKey === 'mitosis') {
    const neighbourMentioned = MITOSIS_NEIGHBOUR_CONCEPTS.some((c) => {
      const re = new RegExp(`\\b${c.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'i');
      return re.test(assessedHaystack);
    });
    if (neighbourMentioned) {
      const neighbourTaught = MITOSIS_NEIGHBOUR_CONCEPTS.some((c) =>
        conceptTaughtInLesson(c, teachingText)
      );
      if (!neighbourTaught) {
        return {
          result: GROUNDING_RESULT.REJECT_CROSS_TOPIC,
          reason: 'neighbour_concept_not_taught',
          profileKey,
        };
      }
    }
  }

  if (PROFILE_ALLOWED[profileKey] && !matchesAllowedProfile(assessedHaystack, profileKey)) {
    const stem = normalizeStem(assessedHaystack);
    const taughtOverlap = teachingText && stem.split(' ').filter((w) => w.length > 4 && teachingText.includes(w)).length >= 2;
    if (!taughtOverlap) {
      return {
        result: GROUNDING_RESULT.REJECT_UNSUPPORTED,
        reason: 'not_supported_by_lesson',
        profileKey,
      };
    }
  }

  return { result: GROUNDING_RESULT.PASS, reason: 'in_boundary', profileKey };
}

function buildGroundingContext(opts = {}) {
  return {
    topicKey: opts.topicKey,
    specKey: parseSpecKey(opts.topicKey, opts.specKey),
    topic: opts.topic || opts.topicLabel,
    topicLabel: opts.topicLabel || opts.topic,
    pages: opts.pages || [],
    objectives: opts.objectives,
    vocabulary: opts.vocabulary,
    teachingText: opts.teachingText || extractLessonTeachingText(opts.pages, opts),
  };
}

/**
 * Filter quiz questions; dedupe by normalized stem.
 * @returns {{ questions: object[], removed: object[], groundingLimited: boolean }}
 */
function filterQuizQuestionsByTopicGrounding(questions, ctx = {}) {
  const groundingCtx = buildGroundingContext(ctx);
  const out = [];
  const removed = [];
  const seen = new Set();

  for (const q of questions || []) {
    const stem = normalizeStem(questionHaystack(q));
    if (!stem) continue;
    if (seen.has(stem)) {
      removed.push({ question: q, classification: { result: GROUNDING_RESULT.REJECT_DUPLICATE } });
      continue;
    }

    const classification = classifyQuizQuestion(q, groundingCtx);
    if (classification.result !== GROUNDING_RESULT.PASS) {
      removed.push({ question: q, classification });
      continue;
    }

    seen.add(stem);
    out.push(q);
  }

  const profileKey = resolveGroundingProfileKey(groundingCtx.topicKey, groundingCtx.topic);
  const groundingLimited =
    Boolean(profileKey) &&
    out.length < (questions || []).length &&
    removed.some((r) => r.classification?.result === GROUNDING_RESULT.REJECT_CROSS_TOPIC);

  return { questions: out, removed, groundingLimited, profileKey };
}

/**
 * Audit helper for existing lessons (read-only report rows).
 */
function auditLessonQuizGrounding(lesson) {
  const ctx = buildGroundingContext({
    topicKey: lesson?.topicKey,
    specKey: lesson?.specKey,
    topic: lesson?.topic || lesson?.title,
    pages: lesson?.pages,
    vocabulary: lesson?.metadata?.contentKeywords,
  });

  const rows = [];
  const questions = Array.isArray(lesson?.quiz?.questions) ? lesson.quiz.questions : [];
  for (const q of questions) {
    const classification = classifyQuizQuestion(q, ctx);
    rows.push({
      lessonId: String(lesson?._id || lesson?.id || ''),
      questionId: String(q?.id || q?._id || ''),
      question: String(q?.question || q?.prompt || '').slice(0, 200),
      topicBoundaryResult: classification.result,
      reason: classification.reason || null,
      profileKey: classification.profileKey || null,
      sourceQuestionId: q?.sourceQuestionId ? String(q.sourceQuestionId) : null,
      sourceType: q?.sourceType || q?.source || null,
      pageId: q?.pageId != null ? String(q.pageId) : null,
    });
  }
  return rows;
}

/**
 * Stem-pack scope filter — mitosis-only stems must not enter meiosis-only lessons and vice versa.
 */
function stemAllowedForTopicScope(stemItem, topicKey, topicLabel, teachingText = '') {
  const scope = stemItem?.topicScope;
  if (!scope || scope === 'any') return true;
  const profileKey = resolveGroundingProfileKey(topicKey, topicLabel);
  if (!profileKey) return true;
  if (scope === 'mitosis') {
    return profileKey === 'mitosis-cell-cycle' || profileKey === 'mitosis';
  }
  if (scope === 'meiosis') {
    return profileKey === 'meiosis';
  }
  if (scope === 'both') {
    if (profileKey === 'mitosis-cell-cycle' || profileKey === 'mitosis') {
      return conceptTaughtInLesson('meiosis', teachingText);
    }
    if (profileKey === 'meiosis') {
      return conceptTaughtInLesson('mitosis', teachingText);
    }
    return true;
  }
  return true;
}

module.exports = {
  GROUNDING_RESULT,
  parseTopicKeyShort,
  parseSpecKey,
  resolveGroundingProfileKey,
  extractLessonTeachingText,
  shouldExcludeBlockFromTeachingHaystack,
  classifyQuizQuestion,
  buildGroundingContext,
  filterQuizQuestionsByTopicGrounding,
  auditLessonQuizGrounding,
  stemAllowedForTopicScope,
  isBankBackedQuestion,
  questionAssessedHaystack,
  questionHaystack,
};
