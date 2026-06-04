/**
 * Phase 3B — post-generation lesson boundary audit (warn/report first).
 * Does not remove or mutate lesson content.
 */

const { normalizeText } = require("../lessonBlockAnalysis");
const { resolveSubTopicProfile, listProfileConcepts } = require("./subTopicProfiles");
const {
  getSubTopicBoundaryMode,
  classifyConcept,
  validateBlockScope,
  inferPrimaryConceptIdFromHaystack,
  blockHaystackExtended,
} = require("./subTopicBoundaryGuard");

/** In-scope replacement hints when primary concept is out of scope. */
const SUGGESTED_REPLACEMENT_FOCUS = {
  brain_regions: "Neurone structure labelling diagram",
  brain: "Neurone structure labelling diagram",
  thermoregulation: "Explain how myelin speeds up electrical impulses",
  accommodation: "Explain how myelin speeds up electrical impulses",
  reflex_arc_pathway: "Describe two adaptations of neurones for rapid communication",
  reflex_arc: "Describe two adaptations of neurones for rapid communication",
  eye: "Label the parts of a motor neurone",
};

function normalizeBlockType(block) {
  return String(block.type || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function classifyBlockLocationLabel(block) {
  const type = normalizeBlockType(block);
  const role = String(block.role || "").toLowerCase();
  if (type === "checkpoint" || role === "checkpoint" || role === "quickcheck") return "Checkpoint";
  if (role === "selfcheck" || type === "selfcheck" || type === "selfcheckquestion") return "Self-check";
  if (type === "dragdropmatch") return "Drag & Drop";
  if (type === "interactivesequence") return "Step-by-Step";
  if (type === "interactivediagram" || type === "hotspot" || type === "labeldiagram") {
    return "Interactive Diagram";
  }
  if (type === "diagram") return "Diagram";
  return "Teaching block";
}

function conceptNameForId(conceptId, profile) {
  if (!conceptId || !profile) return conceptId || "Unknown";
  for (const c of listProfileConcepts(profile)) {
    if (c.id === conceptId) return c.name;
  }
  return conceptId;
}

function suggestReplacementFocus(conceptId, profile, title) {
  if (conceptId && SUGGESTED_REPLACEMENT_FOCUS[conceptId]) {
    return SUGGESTED_REPLACEMENT_FOCUS[conceptId];
  }
  const central = profile?.centralConceptId;
  if (central === "neurones") {
    if (/brain|region|cortex|cerebellum/i.test(String(title || ""))) {
      return SUGGESTED_REPLACEMENT_FOCUS.brain_regions;
    }
    if (/thermo|temperature|vaso/i.test(String(title || ""))) {
      return SUGGESTED_REPLACEMENT_FOCUS.thermoregulation;
    }
    if (/reflex/i.test(String(title || ""))) {
      return SUGGESTED_REPLACEMENT_FOCUS.reflex_arc_pathway;
    }
    return "Explain how myelin speeds up electrical impulses";
  }
  const primary = profile?.primaryConcepts?.[0];
  return primary ? `Focus on "${primary.name}"` : "Use an in-scope concept from this sub-topic";
}

function severityForFinding(classification, mode, isAssessed) {
  if (!isAssessed || classification === "in_scope" || classification === "unknown") {
    return "info";
  }
  if (mode >= 2 && classification === "forbidden") return "blocker";
  if (classification === "forbidden" || classification === "neighbouring") return "warning";
  return "info";
}

function suggestedActionFor(classification, mode, isAssessed) {
  if (!isAssessed || classification === "in_scope" || classification === "unknown") {
    return "none";
  }
  if (mode >= 2 && classification === "forbidden") {
    return "block_publish_until_replaced";
  }
  return "review_and_replace_when_editing";
}

function itemHaystack(item) {
  return normalizeText(
    [
      item.title,
      item.content,
      item.text,
      item.question,
      item.questionText,
      item.prompt,
      item.front,
      item.back,
      item.explanation,
      item.stem,
      item.caption,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function inferItemPrimaryConcept(item, profile) {
  if (item.conceptId) return String(item.conceptId).trim().toLowerCase();
  const hay = item._haystack || itemHaystack(item);
  return inferPrimaryConceptIdFromHaystack(hay, profile) || null;
}

function blockIsAssessed(block, profile) {
  return validateBlockScope(block, profile).isAssessed;
}

function emptyAudit(mode = 0) {
  return {
    boundaryProfileKey: null,
    boundaryMode: mode,
    scopeContaminationScore: 0,
    totalAuditedItems: 0,
    inScopeItems: 0,
    neighbourItems: 0,
    forbiddenItems: 0,
    blockFindings: [],
    summary: {
      safeToPublish: true,
      warnings: [],
      blockers: [],
      contaminationLevel: "good",
    },
  };
}

function contaminationLevel(score) {
  if (score <= 5) return "good";
  if (score <= 10) return "warning";
  return "high";
}

function buildFinding({
  blockId,
  blockType,
  title,
  location,
  conceptId,
  profile,
  boundaryStatus,
  mode,
  isAssessed,
  reason,
}) {
  const primaryConceptName = conceptNameForId(conceptId, profile);
  const severity = severityForFinding(boundaryStatus, mode, isAssessed);
  const suggestedReplacementFocus =
    boundaryStatus === "forbidden" || boundaryStatus === "neighbouring"
      ? suggestReplacementFocus(conceptId, profile, title)
      : undefined;

  return {
    blockId,
    blockType: blockType || "unknown",
    title: title || undefined,
    location,
    primaryConceptId: conceptId || null,
    primaryConceptName,
    boundaryStatus,
    severity,
    reason,
    suggestedAction: suggestedActionFor(boundaryStatus, mode, isAssessed),
    suggestedReplacementFocus,
  };
}

function collectPageBlocks(pages) {
  const items = [];
  if (!Array.isArray(pages)) return items;
  pages.forEach((page, pageIdx) => {
    for (const block of page.blocks || []) {
      items.push({
        source: "lesson_block",
        blockId: block.id || block._id || `page-${pageIdx + 1}-${block.type || "block"}`,
        blockType: block.type,
        title: block.title || block.question || block.prompt,
        location: `Page ${pageIdx + 1} · ${classifyBlockLocationLabel(block)}`,
        raw: block,
        kind: "lesson_block",
      });
    }
  });
  return items;
}

function collectFlatItems(items, defaults) {
  if (!Array.isArray(items)) return [];
  return items.map((item, idx) => ({
    source: defaults.source,
    blockId: item.id || item._id || `${defaults.source}-${idx + 1}`,
    blockType: defaults.blockType,
    title:
      item.question ||
      item.questionText ||
      item.front ||
      item.prompt ||
      item.title ||
      undefined,
    location: defaults.location,
    raw: item,
    kind: defaults.kind,
    assessed: true,
  }));
}

function normalizeQuiz(quiz) {
  if (Array.isArray(quiz)) return quiz;
  if (quiz && Array.isArray(quiz.questions)) return quiz.questions;
  return [];
}

/**
 * Post-generation boundary audit for a full lesson artifact set.
 * @param {object} input
 */
function auditLessonBoundary(input = {}) {
  const mode = getSubTopicBoundaryMode();
  if (mode === 0) {
    return emptyAudit(0);
  }

  const profile = resolveSubTopicProfile({
    topicKey: input.topicKey,
    subTopic: input.subTopic || input.topic,
    topic: input.topic,
  });

  if (!profile) {
    return emptyAudit(mode);
  }

  const auditable = [
    ...collectPageBlocks(input.pages),
    ...collectFlatItems(input.flashcards, {
      source: "flashcard",
      blockType: "flashcard",
      location: "Lesson flashcards",
      kind: "flashcard",
    }),
    ...collectFlatItems(normalizeQuiz(input.quiz), {
      source: "quiz",
      blockType: "quiz",
      location: "Lesson quiz",
      kind: "quiz",
    }),
    ...collectFlatItems(input.practiceQuestions, {
      source: "practice",
      blockType: "practice",
      location: "Practice questions",
      kind: "practice",
    }),
    ...collectFlatItems(input.bankFlashcards, {
      source: "bank_flashcard",
      blockType: "flashcard",
      location: "AI topic bank · flashcards",
      kind: "bank_flashcard",
    }),
    ...collectFlatItems(input.bankQuizQuestions, {
      source: "bank_quiz",
      blockType: "quiz",
      location: "AI topic bank · quiz drafts",
      kind: "bank_quiz",
    }),
    ...collectFlatItems(input.bankExamQuestions, {
      source: "bank_exam",
      blockType: "exam",
      location: "AI topic bank · exam drafts",
      kind: "bank_exam",
    }),
  ];

  const blockFindings = [];
  let assessedTotal = 0;
  let inScopeItems = 0;
  let neighbourItems = 0;
  let forbiddenItems = 0;

  for (const entry of auditable) {
    const block = entry.raw;
    const isAssessed =
      entry.assessed === true ||
      (entry.kind === "lesson_block" ? blockIsAssessed(block, profile) : true);

    let conceptId;
    let boundaryStatus;
    let reason;

    if (entry.kind === "lesson_block") {
      const scope = validateBlockScope(block, profile);
      conceptId = scope.conceptId;
      boundaryStatus = scope.classification;
      reason = scope.reason;
    } else {
      const hay = blockHaystackExtended(block);
      conceptId = inferPrimaryConceptIdFromHaystack(hay, profile);
      boundaryStatus = classifyConcept(conceptId, profile);
      if (boundaryStatus === "forbidden") {
        reason = `Forbidden primary focus: "${conceptId}" belongs to another sub-topic lesson.`;
      } else if (boundaryStatus === "neighbouring") {
        reason = `Neighbouring concept "${conceptId}" is not the focus of this sub-topic.`;
      } else if (boundaryStatus === "in_scope") {
        reason = "In-scope for this sub-topic.";
      } else {
        reason = "Could not classify against sub-topic profile.";
      }
    }

    if (isAssessed) {
      assessedTotal += 1;
      if (boundaryStatus === "in_scope") inScopeItems += 1;
      if (boundaryStatus === "neighbouring") neighbourItems += 1;
      if (boundaryStatus === "forbidden") forbiddenItems += 1;
    }

    const finding = buildFinding({
      blockId: entry.blockId,
      blockType: entry.blockType || block?.type,
      title: entry.title,
      location: entry.location,
      conceptId,
      profile,
      boundaryStatus,
      mode,
      isAssessed,
      reason,
    });

    if (isAssessed || boundaryStatus === "forbidden" || boundaryStatus === "neighbouring") {
      blockFindings.push(finding);
    }
  }

  const outOfScopeAssessed = neighbourItems + forbiddenItems;
  const scopeContaminationScore =
    assessedTotal > 0 ? Math.round((outOfScopeAssessed / assessedTotal) * 100) : 0;

  const warnings = [];
  const blockers = [];

  const level = contaminationLevel(scopeContaminationScore);
  if (level === "warning") {
    warnings.push(
      `Scope contamination ${scopeContaminationScore}% (5–10%): review neighbouring or forbidden primary items.`
    );
  } else if (level === "high") {
    warnings.push(
      `Scope contamination ${scopeContaminationScore}% (>10%): high out-of-scope leakage for this sub-topic.`
    );
  }

  for (const f of blockFindings) {
    if (f.severity === "warning") {
      warnings.push(`${f.location}: ${f.reason}`);
    }
    if (f.severity === "blocker") {
      blockers.push(`${f.location}: ${f.reason}`);
    }
  }

  const repairRecommendations =
    mode >= 2
      ? blockFindings
          .filter((f) => f.severity === "blocker" || f.severity === "warning")
          .map((f) => ({
            blockId: f.blockId,
            location: f.location,
            primaryConceptId: f.primaryConceptId,
            suggestedReplacementFocus: f.suggestedReplacementFocus,
            suggestedAction: f.suggestedAction,
          }))
      : undefined;

  return {
    boundaryProfileKey: profile.taxonomyKey,
    boundaryMode: mode,
    scopeContaminationScore,
    totalAuditedItems: blockFindings.length,
    inScopeItems,
    neighbourItems,
    forbiddenItems,
    blockFindings,
    summary: {
      safeToPublish: blockers.length === 0,
      warnings: [...new Set(warnings)].slice(0, 20),
      blockers: [...new Set(blockers)].slice(0, 20),
      contaminationLevel: level,
      assessedCount: assessedTotal,
      ...(repairRecommendations ? { repairRecommendations } : {}),
    },
  };
}

/**
 * Compact metadata for generation API responses (no full block list).
 * @param {ReturnType<typeof auditLessonBoundary>} audit
 */
function boundaryAuditResponseMeta(audit) {
  if (!audit || !audit.boundaryProfileKey || audit.boundaryMode === 0) {
    return null;
  }
  return {
    boundaryProfileKey: audit.boundaryProfileKey,
    boundaryMode: audit.boundaryMode,
    scopeContaminationScore: audit.scopeContaminationScore,
    inScopeItems: audit.inScopeItems,
    neighbourItems: audit.neighbourItems,
    forbiddenItems: audit.forbiddenItems,
    summary: audit.summary,
    outOfScopeCount: audit.neighbourItems + audit.forbiddenItems,
  };
}

module.exports = {
  auditLessonBoundary,
  boundaryAuditResponseMeta,
  SUGGESTED_REPLACEMENT_FOCUS,
  contaminationLevel,
};
