/**
 * Phase 3C.5 — objective / framing boundary enforcement at generation start.
 * Does not mutate existing saved lessons unless explicitly applied via draft pipeline.
 */

const { normalizeText } = require("../lessonBlockAnalysis");
const {
  getSubTopicBoundaryMode,
  classifyConcept,
  inferPrimaryConceptIdFromHaystack,
  matchProfileConceptIds,
} = require("./subTopicBoundaryGuard");

const OBJECTIVE_BOUNDARY_MARKER = "OBJECTIVE BOUNDARY:";

/** Extra sibling-topic phrases that must not appear as lesson objectives. */
const EXTRA_FORBIDDEN_OBJECTIVE_PATTERNS = [
  /\bendocrine\s+system\b/i,
  /\bdiabetes\b/i,
  /\bplant\s+hormone/i,
  /\bthermoregulatory\s+centre\b/i,
  /\bthermoregulatory\s+center\b/i,
];

/** @type {Record<string, string>} */
const NERVOUS_SYSTEM_OBJECTIVE_REPLACEMENTS = {
  brain_regions:
    "Identify the main parts of a neurone, including dendrites, axon, cell body and myelin sheath.",
  brain:
    "Identify the main parts of a neurone, including dendrites, axon, cell body and myelin sheath.",
  accommodation:
    "Explain how axons and myelin help electrical impulses travel quickly.",
  eye:
    "Explain how axons and myelin help electrical impulses travel quickly.",
  thermoregulation:
    "Explain how receptors, neurones, the CNS and effectors work together in nervous coordination.",
  reflex_arc_pathway:
    "Describe how impulses travel between receptors, neurones, the CNS and effectors.",
  reflex_arc:
    "Describe how impulses travel between receptors, neurones, the CNS and effectors.",
};

const FRAMING_FIELDS = [
  "objectives",
  "walt",
  "wilf",
  "successCriteria",
  "priorKnowledge",
  "keyQuestions",
];

/**
 * @param {string|string[]|null|undefined} value
 * @returns {string[]}
 */
function normalizeFieldList(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  const s = String(value).trim();
  if (!s) return [];
  return s
    .split(/\n+/)
    .map((line) => line.replace(/^[\s•\-\*\d.)]+/, "").trim())
    .filter(Boolean);
}

/**
 * @param {string[]} items
 * @param {string} [intro]
 */
function joinFieldList(items, intro = "") {
  const bullets = (items || []).map((line) => `• ${line}`).join("\n");
  if (intro && bullets) return `${intro}\n${bullets}`;
  if (intro) return intro;
  return bullets;
}

/**
 * Objectives treat neighbouring sibling topics as out-of-scope (stricter than activities).
 * @param {string} text
 * @param {import("./subTopicProfiles").SubTopicProfile} profile
 */
function analyzeObjectiveItem(text, profile) {
  const hay = normalizeText(text);
  if (!hay || !profile) {
    return { contaminated: false, primaryConceptId: null, violationType: null, reason: null };
  }

  for (const re of EXTRA_FORBIDDEN_OBJECTIVE_PATTERNS) {
    if (re.test(text)) {
      return {
        contaminated: true,
        primaryConceptId: "thermoregulation",
        violationType: "forbidden",
        reason: "Sibling-topic keyword detected in objective framing.",
      };
    }
  }

  const primaryConceptId = inferPrimaryConceptIdFromHaystack(hay, profile);
  const classification = classifyConcept(primaryConceptId, profile);

  if (classification === "forbidden") {
    return {
      contaminated: true,
      primaryConceptId,
      violationType: "forbidden",
      reason: `Forbidden objective focus: ${primaryConceptId}.`,
    };
  }

  if (classification === "neighbouring") {
    return {
      contaminated: true,
      primaryConceptId,
      violationType: "neighbouring",
      reason: `Neighbouring sub-topic must not be a lesson objective: ${primaryConceptId}.`,
    };
  }

  const matched = matchProfileConceptIds(hay, profile);
  const forbiddenHit = matched.find((id) => classifyConcept(id, profile) === "forbidden");
  if (forbiddenHit) {
    return {
      contaminated: true,
      primaryConceptId: forbiddenHit,
      violationType: "forbidden",
      reason: `Forbidden concept referenced: ${forbiddenHit}.`,
    };
  }

  return { contaminated: false, primaryConceptId, violationType: null, reason: null };
}

/**
 * @param {string} conceptId
 * @param {import("./subTopicProfiles").SubTopicProfile} profile
 */
function replacementForConcept(conceptId, profile) {
  if (profile?.taxonomyKey === "nervous-system-structure" && conceptId) {
    if (NERVOUS_SYSTEM_OBJECTIVE_REPLACEMENTS[conceptId]) {
      return NERVOUS_SYSTEM_OBJECTIVE_REPLACEMENTS[conceptId];
    }
  }
  const primary = profile?.primaryConcepts?.[0];
  if (primary) {
    return `Explain ${primary.name} and how structure links to function in this sub-topic.`;
  }
  return "Stay within the selected sub-topic scope.";
}

/**
 * @param {object} input
 * @param {string[]|string} [input.objectives]
 * @param {string[]|string} [input.walt]
 * @param {string[]|string} [input.wilf]
 * @param {string[]|string} [input.successCriteria]
 * @param {string[]|string} [input.priorKnowledge]
 * @param {string[]|string} [input.keyQuestions]
 * @param {import("./subTopicProfiles").SubTopicProfile|null} [input.subTopicProfile]
 * @param {number} [input.boundaryMode]
 * @param {boolean} [input.applyChanges] — when false, never rewrite (Coverage Review)
 */
function enforceObjectiveBoundaries(input = {}) {
  const mode =
    input.boundaryMode !== undefined && input.boundaryMode !== null
      ? Number(input.boundaryMode)
      : getSubTopicBoundaryMode();

  const profile = input.subTopicProfile;
  const applyChanges =
    input.applyChanges !== undefined
      ? Boolean(input.applyChanges)
      : mode >= 2;

  const original = {};
  const cleaned = {};
  for (const field of FRAMING_FIELDS) {
    original[field] = normalizeFieldList(input[field]);
    cleaned[field] = [...original[field]];
  }

  if (mode === 0 || !profile) {
    return {
      cleanedObjectives: cleaned.objectives,
      cleanedWalt: cleaned.walt,
      cleanedWilf: cleaned.wilf,
      cleanedSuccessCriteria: cleaned.successCriteria,
      cleanedPriorKnowledge: cleaned.priorKnowledge,
      cleanedKeyQuestions: cleaned.keyQuestions,
      removedOutOfScopeItems: [],
      replacementItems: [],
      warnings: [],
      boundaryMode: mode,
      changed: false,
      outOfScopeObjectiveCount: 0,
    };
  }

  const removedOutOfScopeItems = [];
  const replacementItems = [];
  const warnings = [];
  let changed = false;

  for (const field of FRAMING_FIELDS) {
    const next = [];
    for (const item of original[field]) {
      const analysis = analyzeObjectiveItem(item, profile);
      if (!analysis.contaminated) {
        next.push(item);
        continue;
      }

      const replacement = replacementForConcept(analysis.primaryConceptId, profile);
      removedOutOfScopeItems.push({
        field,
        text: item,
        primaryConceptId: analysis.primaryConceptId,
        violationType: analysis.violationType,
        reason: analysis.reason,
      });
      replacementItems.push({
        field,
        original: item,
        replacement,
        primaryConceptId: analysis.primaryConceptId,
        violationType: analysis.violationType,
      });
      warnings.push(
        `Out-of-scope ${field} item (${analysis.primaryConceptId}): suggest "${replacement}"`
      );

      if (mode >= 2 && applyChanges) {
        if (!next.includes(replacement)) next.push(replacement);
        changed = true;
      } else {
        next.push(item);
      }
    }
    cleaned[field] = next;
  }

  return {
    cleanedObjectives: cleaned.objectives,
    cleanedWalt: cleaned.walt,
    cleanedWilf: cleaned.wilf,
    cleanedSuccessCriteria: cleaned.successCriteria,
    cleanedPriorKnowledge: cleaned.priorKnowledge,
    cleanedKeyQuestions: cleaned.keyQuestions,
    removedOutOfScopeItems,
    replacementItems,
    warnings,
    boundaryMode: mode,
    changed,
    outOfScopeObjectiveCount: removedOutOfScopeItems.length,
  };
}

/**
 * @param {object} block
 * @returns {{ field: string, intro: string }|null}
 */
function framingFieldForBlock(block) {
  const role = String(block?.role || "").toLowerCase();
  const title = String(block?.title || "").toLowerCase();

  if (role === "lessonobjectives" || title.includes("lesson objectives")) {
    return { field: "objectives", intro: "" };
  }
  if (role === "priorknowledge" || title.includes("prior knowledge")) {
    return { field: "priorKnowledge", intro: "" };
  }
  if (role === "walt" || title.includes("walt")) {
    return { field: "walt", intro: "" };
  }
  if (role === "wilf" || title.includes("wilf")) {
    return { field: "wilf", intro: "" };
  }
  if (title.includes("success criteria")) {
    return { field: "successCriteria", intro: "" };
  }
  if (title.includes("key question")) {
    return { field: "keyQuestions", intro: "" };
  }
  return null;
}

/**
 * Split block content into intro line(s) and bullet items.
 * @param {string} content
 */
function splitBlockContent(content) {
  const lines = String(content || "").split("\n");
  const intro = [];
  const items = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^[\s•\-\*]/.test(line) || /^\d+[\.)]\s/.test(trimmed)) {
      items.push(trimmed.replace(/^[\s•\-\*\d.)]+/, "").trim());
    } else if (!items.length) {
      intro.push(trimmed);
    } else {
      items.push(trimmed);
    }
  }
  return { intro, items };
}

/**
 * @param {object[]} pages
 */
function extractFramingFromPages(pages) {
  const framing = {
    objectives: [],
    walt: [],
    wilf: [],
    successCriteria: [],
    priorKnowledge: [],
    keyQuestions: [],
  };
  const blockRefs = [];

  for (const page of pages || []) {
    for (const block of page.blocks || []) {
      const mapping = framingFieldForBlock(block);
      if (!mapping) continue;
      const { intro, items } = splitBlockContent(block.content);
      if (items.length) {
        framing[mapping.field].push(...items);
      } else if (block.content) {
        framing[mapping.field].push(String(block.content).trim());
      }
      blockRefs.push({ block, field: mapping.field, intro });
    }
  }

  return { framing, blockRefs };
}

/**
 * Apply cleaned framing back onto lesson blocks (preserves block count / structure).
 * @param {object[]} pages
 * @param {ReturnType<typeof enforceObjectiveBoundaries>} result
 */
function applyFramingToPages(pages, result) {
  if (!result.changed) return pages;

  const lists = {
    objectives: result.cleanedObjectives,
    walt: result.cleanedWalt,
    wilf: result.cleanedWilf,
    successCriteria: result.cleanedSuccessCriteria,
    priorKnowledge: result.cleanedPriorKnowledge,
    keyQuestions: result.cleanedKeyQuestions,
  };

  const applied = {};

  for (const page of pages || []) {
    for (const block of page.blocks || []) {
      const mapping = framingFieldForBlock(block);
      if (!mapping || applied[mapping.field]) continue;
      applied[mapping.field] = true;
      const { intro } = splitBlockContent(block.content);
      block.content = joinFieldList(lists[mapping.field], intro.join("\n"));
    }
  }

  return pages;
}

/**
 * @param {object} input
 * @param {object[]} [input.pages]
 * @param {string} [input.topicKey]
 * @param {string} [input.subTopic]
 * @param {string} [input.topic]
 * @param {import("./subTopicProfiles").SubTopicProfile|null} [input.subTopicProfile]
 * @param {boolean} [input.applyChanges]
 */
function enforceObjectiveBoundariesOnDraft(input = {}) {
  const { resolveSubTopicProfile } = require("./subTopicProfiles");
  const profile =
    input.subTopicProfile ||
    resolveSubTopicProfile({
      topicKey: input.topicKey,
      subTopic: input.subTopic,
      topic: input.topic,
    });

  const pages = input.pages || [];
  const { framing } = extractFramingFromPages(pages);
  const result = enforceObjectiveBoundaries({
    ...framing,
    subTopicProfile: profile,
    boundaryMode: input.boundaryMode,
    applyChanges: input.applyChanges,
  });

  const nextPages =
    result.changed && pages.length
      ? applyFramingToPages(JSON.parse(JSON.stringify(pages)), result)
      : pages;

  return {
    pages: nextPages,
    changed: result.changed,
    objectiveBoundary: {
      outOfScopeObjectiveCount: result.outOfScopeObjectiveCount,
      removedOutOfScopeItems: result.removedOutOfScopeItems,
      replacementItems: result.replacementItems,
      warnings: result.warnings,
      boundaryMode: result.boundaryMode,
      changed: result.changed,
    },
  };
}

/**
 * Read-only objective boundary diagnostics for Coverage Review.
 * @param {object} input
 */
function analyzeObjectiveBoundaryFromLesson(input = {}) {
  const { resolveSubTopicProfile } = require("./subTopicProfiles");
  const profile = resolveSubTopicProfile(input);
  const { framing } = extractFramingFromPages(input.pages || []);
  const result = enforceObjectiveBoundaries({
    ...framing,
    subTopicProfile: profile,
    applyChanges: false,
  });
  return {
    outOfScopeObjectiveCount: result.outOfScopeObjectiveCount,
    removedOutOfScopeItems: result.removedOutOfScopeItems,
    replacementItems: result.replacementItems,
    warnings: result.warnings,
    boundaryMode: result.boundaryMode,
    changed: false,
  };
}

/**
 * Prompt appendix when sub-topic profile resolves and mode >= 1.
 * @param {import("./subTopicProfiles").SubTopicProfile|null} profile
 * @param {number} [mode]
 */
function formatObjectiveBoundaryAppendix(profile, mode = getSubTopicBoundaryMode()) {
  if (!profile || mode === 0) return "";

  const display =
    profile.taxonomyKey === "nervous-system-structure"
      ? "Structure and function of the nervous system"
      : profile.taxonomyKey;

  const forbiddenBullets = [
    "cerebral cortex",
    "cerebellum",
    "medulla",
    "eye accommodation",
    "thermoregulation",
    "endocrine system",
    "diabetes",
    "plant hormones",
    "full reflex arc pathway",
    ...profile.forbiddenConcepts.map((c) => c.name),
  ];

  const allowedBullets = [
    "neurones",
    "CNS and PNS",
    "receptors and effectors",
    "axons and dendrites",
    "myelin sheath",
    "electrical impulses",
    "structure adapted to function",
    ...profile.primaryConcepts.slice(0, 6).map((c) => c.name),
  ];

  const enforceNote =
    mode >= 2
      ? "Enforcement ON: rewrite any out-of-scope objective lines to in-scope equivalents before planning the rest of the lesson."
      : "Advisory: flag out-of-scope objectives; prefer in-scope framing.";

  return [
    OBJECTIVE_BOUNDARY_MARKER,
    `The selected sub-topic is "${display}".`,
    "Lesson objectives, WALT, WILF, success criteria, prior knowledge and key questions must stay inside this sub-topic.",
    enforceNote,
    "",
    "Do NOT create objectives about:",
    ...forbiddenBullets.map((b) => `- ${b}`),
    "",
    "Use objectives about:",
    ...allowedBullets.map((b) => `- ${b}`),
    "",
    "Allowed brief context only: brain and spinal cord as parts of the CNS; reflex response as a brief example — not full reflex arc detail.",
  ].join("\n");
}

module.exports = {
  enforceObjectiveBoundaries,
  enforceObjectiveBoundariesOnDraft,
  analyzeObjectiveBoundaryFromLesson,
  formatObjectiveBoundaryAppendix,
  extractFramingFromPages,
  analyzeObjectiveItem,
  replacementForConcept,
  OBJECTIVE_BOUNDARY_MARKER,
  NERVOUS_SYSTEM_OBJECTIVE_REPLACEMENTS,
};
