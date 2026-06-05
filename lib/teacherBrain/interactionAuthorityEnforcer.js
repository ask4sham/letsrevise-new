/**
 * Phase 3G.8 — deterministic interaction authority enforcement on lesson drafts.
 * Mutates primary activity blocks when TEACHER_BRAIN_SUBTOPIC_BOUNDARY=2.
 */

const { resolveSubTopicProfile } = require("./subTopicProfiles");
const {
  getSubTopicBoundaryMode,
  isSubTopicBoundaryEnforcementEnabled,
  validateBlockScope,
  isPrimaryAssessmentBlock,
} = require("./subTopicBoundaryGuard");
const {
  resolveAuthorizedInteractions,
  validateInteractionAuthority,
  nearestAuthorizedTemplate,
} = require("./interactionAuthorityLayer");

/** Specialized brief kinds blocked per interaction-authority profile. */
const BLOCKED_BRIEF_KINDS_BY_PROFILE = {
  "nervous-system-structure": new Set(["brain", "reflexArc", "eye", "homeostasis"]),
};

/**
 * @param {object} block
 */
function isEnforcementTarget(block) {
  if (!block || typeof block !== "object") return false;
  return isPrimaryAssessmentBlock(block);
}

/**
 * @param {object} block
 */
function blockAsInteraction(block) {
  const pairs = Array.isArray(block.pairs)
    ? block.pairs.map((p) =>
        typeof p === "string"
          ? p
          : `${p?.prompt || p?.label || ""} → ${p?.answer || p?.definition || ""}`.trim()
      )
    : [];

  return {
    title: block.title,
    instructions: block.content,
    prompt: block.prompt || block.question,
    content: block.content,
    diagramBrief: block.note,
    cards: block.cards,
    pairs,
    steps: block.steps,
    key: block.interactionKey || block._authorityReplacementKey,
  };
}

/**
 * @param {object} block
 * @param {object} template
 * @param {{ blockedKey?: string|null }} meta
 */
function applyAuthorizedTemplate(block, template, meta = {}) {
  const out = { ...block };

  if (template.blockType) {
    out.type = template.blockType;
  }
  if (template.title) {
    out.title = template.title;
  }

  if (template.blockType === "checkpoint") {
    out.prompt = template.prompt || template.instructions || "Quick check";
    out.content = template.instructions || template.prompt || "";
    if (!out.questionType) out.questionType = "short";
    if (out.correctAnswer === undefined) out.correctAnswer = "";
    if (out.explanation === undefined) out.explanation = "";
  } else if (template.instructions) {
    out.content = template.instructions;
  } else {
    out.content = "";
  }

  if (template.blockType === "interactivesequence") {
    delete out.pairs;
    delete out.cards;
    if (template.steps?.length) {
      out.steps = [...template.steps];
      out.content = template.steps.join(" → ");
    }
  } else if (template.blockType === "dragdropmatch") {
    delete out.steps;
    if (template.cards?.length) {
      out.cards = [...template.cards];
    } else if (template.pairs?.length) {
      out.pairs = template.pairs.map((p, i) => {
        if (typeof p !== "string") return p;
        const [prompt, answer] = p.split("→").map((s) => s.trim());
        return { id: `pair-${i + 1}`, prompt: prompt || p, answer: answer || "" };
      });
    }
  }

  if (template.prompt && template.blockType !== "checkpoint") {
    out.prompt = template.prompt;
  }

  delete out.note;

  out._authorityEnforced = true;
  out._authorityBlockedKey = meta.blockedKey || null;
  out._authorityReplacementKey = template.key || null;
  if (template.key) {
    out.interactionKey = template.key;
  }
  return out;
}

/**
 * @param {object} block
 * @param {import("./subTopicProfiles").SubTopicProfile} profile
 * @param {object} authority
 */
function evaluateBlockForEnforcement(block, profile, authority) {
  if (!isEnforcementTarget(block)) {
    return { enforce: false, valid: true, reason: "Not a primary activity block." };
  }

  if (
    block._authorityEnforced &&
    block._authorityReplacementKey &&
    authority.authorizedInteractionKeys?.includes(block._authorityReplacementKey)
  ) {
    return { enforce: true, valid: true, reason: "Already rerouted to authorised template." };
  }

  const scopeResult = validateBlockScope(block, profile);
  const interactionResult = validateInteractionAuthority({
    interaction: blockAsInteraction(block),
    authorizedInteractions: authority,
    subTopicProfile: profile,
    boundaryMode: authority.boundaryMode,
  });

  const blockedByScope = Boolean(scopeResult.wouldReject);
  const blockedByAuthority = !interactionResult.valid;

  if (!blockedByScope && !blockedByAuthority) {
    return { enforce: true, valid: true, reason: "Authorised." };
  }

  const blockedKey =
    interactionResult.blockedKey || (scopeResult.wouldReject ? scopeResult.conceptId : null);

  const template =
    interactionResult.suggestedTemplate ||
    (blockedKey && authority.authorityProfile
      ? nearestAuthorizedTemplate(blockedKey, authority.authorityProfile)
      : null);

  return {
    enforce: true,
    valid: false,
    blockedKey,
    blockedByScope,
    blockedByAuthority,
    scopeResult,
    interactionResult,
    template,
    reason: interactionResult.reason || scopeResult.reason,
  };
}

/**
 * @param {string} topicKind
 * @param {import("./subTopicProfiles").SubTopicProfile|null} profile
 */
function isTopicKindBlockedForProfile(topicKind, profile) {
  if (!profile?.taxonomyKey || !topicKind || topicKind === "generic") return false;
  const blocked = BLOCKED_BRIEF_KINDS_BY_PROFILE[profile.taxonomyKey];
  return blocked ? blocked.has(topicKind) : false;
}

/**
 * @param {object[]} pages
 * @param {object} input
 */
function countForbiddenPrimaryActivities(pages, input = {}) {
  const profile =
    input.subTopicProfile ||
    resolveSubTopicProfile({
      topicKey: input.topicKey,
      subTopic: input.subTopic,
      topic: input.topic,
    });
  if (!profile) return 0;

  const authority = resolveAuthorizedInteractions({
    subTopicProfile: profile,
    topicKey: input.topicKey,
    subTopic: input.subTopic,
    topic: input.topic,
    boundaryMode: input.boundaryMode ?? getSubTopicBoundaryMode(),
  });
  if (!authority.profileKey) return 0;

  let count = 0;
  for (const page of pages || []) {
    for (const block of page.blocks || []) {
      const evaluation = evaluateBlockForEnforcement(block, profile, authority);
      if (evaluation.enforce && !evaluation.valid) count += 1;
    }
  }
  return count;
}

/**
 * @param {object} input
 * @param {object[]} [input.pages]
 * @param {string} [input.topicKey]
 * @param {string} [input.subTopic]
 * @param {string} [input.topic]
 * @param {import("./subTopicProfiles").SubTopicProfile|null} [input.subTopicProfile]
 * @param {number} [input.boundaryMode]
 * @param {boolean} [input.applyChanges]
 */
function enforceInteractionAuthorityOnDraft(input = {}) {
  const mode =
    input.boundaryMode !== undefined && input.boundaryMode !== null
      ? Number(input.boundaryMode)
      : getSubTopicBoundaryMode();

  const applyChanges =
    input.applyChanges !== undefined
      ? Boolean(input.applyChanges)
      : isSubTopicBoundaryEnforcementEnabled();

  const profile =
    input.subTopicProfile ||
    resolveSubTopicProfile({
      topicKey: input.topicKey,
      subTopic: input.subTopic,
      topic: input.topic,
    });

  const pages = JSON.parse(JSON.stringify(input.pages || []));

  if (mode === 0 || !applyChanges || !profile) {
    return {
      pages,
      changed: false,
      enforcement: {
        enabled: false,
        boundaryMode: mode,
        profileKey: null,
        blocksRerouted: [],
        blocksRemoved: [],
        changed: false,
      },
    };
  }

  const authority = resolveAuthorizedInteractions({
    subTopicProfile: profile,
    topicKey: input.topicKey,
    subTopic: input.subTopic,
    topic: input.topic,
    boundaryMode: mode,
  });

  if (!authority.profileKey) {
    return {
      pages,
      changed: false,
      enforcement: {
        enabled: false,
        boundaryMode: mode,
        profileKey: null,
        blocksRerouted: [],
        blocksRemoved: [],
        changed: false,
      },
    };
  }

  const blocksRerouted = [];
  const blocksRemoved = [];
  let changed = false;

  for (const page of pages) {
    const nextBlocks = [];
    for (const block of page.blocks || []) {
      const evaluation = evaluateBlockForEnforcement(block, profile, authority);
      if (!evaluation.enforce || evaluation.valid) {
        nextBlocks.push(block);
        continue;
      }

      if (evaluation.template) {
        const rerouted = applyAuthorizedTemplate(block, evaluation.template, {
          blockedKey: evaluation.blockedKey,
        });
        blocksRerouted.push({
          blockTitle: block.title || block.type,
          blockedKey: evaluation.blockedKey,
          replacementKey: evaluation.template.key,
          replacementTitle: evaluation.template.title,
        });
        nextBlocks.push(rerouted);
        changed = true;
      } else {
        blocksRemoved.push({
          blockTitle: block.title || block.type,
          blockedKey: evaluation.blockedKey,
          reason: evaluation.reason,
        });
        changed = true;
      }
    }
    page.blocks = nextBlocks;
  }

  return {
    pages,
    changed,
    enforcement: {
      enabled: true,
      boundaryMode: mode,
      profileKey: authority.profileKey,
      blocksRerouted,
      blocksRemoved,
      changed,
    },
  };
}

module.exports = {
  BLOCKED_BRIEF_KINDS_BY_PROFILE,
  enforceInteractionAuthorityOnDraft,
  isEnforcementTarget,
  evaluateBlockForEnforcement,
  isTopicKindBlockedForProfile,
  countForbiddenPrimaryActivities,
  applyAuthorizedTemplate,
  blockAsInteraction,
};
