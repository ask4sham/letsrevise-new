/**
 * Phase 3G.7 — interaction authority layer.
 * Restricts future generation to authorised interaction templates per sub-topic profile.
 * Does not mutate existing lesson blocks.
 */

const { normalizeText, blockHaystack } = require("../lessonBlockAnalysis");
const { resolveSubTopicProfile } = require("./subTopicProfiles");
const {
  getSubTopicBoundaryMode,
  isSubTopicBoundaryEnforcementEnabled,
  inferPrimaryConceptIdFromHaystack,
} = require("./subTopicBoundaryGuard");

const AUTHORITY_MARKER = "INTERACTION AUTHORITY:";

/** @type {Record<string, object>} */
const NERVOUS_SYSTEM_AUTHORIZED = {
  neurone_structure_labelling: {
    key: "neurone_structure_labelling",
    title: "Neurone structure labelling",
    activityTypes: ["interactiveDiagram", "dragDrop", "dragdropmatch"],
    blockType: "dragdropmatch",
    conceptIds: ["neurones"],
    cards: ["dendrites", "cell body", "nucleus", "axon", "myelin sheath", "nerve endings"],
    instructions: "Label a neurone: dendrites, cell body, nucleus, axon, myelin sheath, nerve endings.",
  },
  cns_pns_sort: {
    key: "cns_pns_sort",
    title: "CNS/PNS classification",
    activityTypes: ["sort", "classification", "dragDrop"],
    blockType: "dragdropmatch",
    conceptIds: ["cns", "pns"],
    pairs: [
      "brain → CNS",
      "spinal cord → CNS",
      "sensory neurone → PNS",
      "motor neurone → PNS",
      "nerve → PNS",
    ],
    instructions: "Classify brain, spinal cord, sensory neurone, motor neurone and nerve as CNS or PNS.",
  },
  adaptation_function_match: {
    key: "adaptation_function_match",
    title: "Adaptation–function matching",
    activityTypes: ["dragDropMatch", "dragDrop"],
    blockType: "dragdropmatch",
    conceptIds: ["axons", "dendrites", "myelin_sheath", "neurones"],
    pairs: [
      "axon → carries impulses long distances",
      "dendrites → receive impulses",
      "myelin sheath → speeds impulse transmission",
      "nerve endings → connect to effectors",
    ],
    instructions: "Match structure/adaptation to function for axon, dendrites, myelin sheath and nerve endings.",
  },
  impulse_transmission_sequence: {
    key: "impulse_transmission_sequence",
    title: "Impulse transmission sequence",
    activityTypes: ["stepByStep", "interactiveSequence"],
    blockType: "interactivesequence",
    conceptIds: ["impulse_transmission"],
    steps: [
      "stimulus",
      "receptor",
      "sensory neurone",
      "CNS",
      "motor neurone",
      "effector",
      "response",
    ],
    instructions:
      "Step sequence: stimulus → receptor → sensory neurone → CNS → motor neurone → effector → response. Do not frame as a full reflex-arc lesson.",
    avoidTerms: ["reflex arc pathway", "reflex arc drag", "order the reflex arc"],
  },
  myelin_speed_reasoning: {
    key: "myelin_speed_reasoning",
    title: "Myelin speed reasoning",
    activityTypes: ["checkpoint", "workedExample"],
    blockType: "checkpoint",
    conceptIds: ["myelin_sheath"],
    prompt: "Explain how myelin helps impulses travel quickly.",
    instructions: "Checkpoint or worked example on myelin and impulse speed (structure → adaptation → function).",
  },
  receptor_effector_chain: {
    key: "receptor_effector_chain",
    title: "Receptor–effector chain",
    activityTypes: ["sequence", "checkpoint"],
    blockType: "checkpoint",
    conceptIds: ["impulse_transmission", "cns", "pns"],
    instructions: "Explain how receptors, neurones, CNS and effectors coordinate a response.",
  },
};

/** @type {Record<string, object>} */
const NERVOUS_SYSTEM_BLOCKED = {
  eye_accommodation_diagram: {
    key: "eye_accommodation_diagram",
    matchPatterns: [/accommodation/i, /lens shape/i, /near vision/i, /far vision/i],
    conceptIds: ["accommodation", "eye"],
    replacementKey: "myelin_speed_reasoning",
  },
  eye_labelling: {
    key: "eye_labelling",
    matchPatterns: [/label.*eye/i, /eye diagram/i, /cornea/i],
    conceptIds: ["eye"],
    replacementKey: "neurone_structure_labelling",
  },
  retina_labelling: { key: "retina_labelling", matchPatterns: [/\bretina\b/i], conceptIds: ["eye"], replacementKey: "neurone_structure_labelling" },
  lens_focus_activity: { key: "lens_focus_activity", matchPatterns: [/\blens\b/i, /focus/i], conceptIds: ["accommodation", "eye"], replacementKey: "myelin_speed_reasoning" },
  iris_pupil_activity: { key: "iris_pupil_activity", matchPatterns: [/\biris\b/i, /\bpupil\b/i], conceptIds: ["eye"], replacementKey: "neurone_structure_labelling" },
  thermoregulation_sequence: {
    key: "thermoregulation_sequence",
    matchPatterns: [/thermoregulation/i, /body temperature/i, /temperature control/i],
    conceptIds: ["thermoregulation"],
    replacementKey: "impulse_transmission_sequence",
  },
  sweating_vasodilation_sort: {
    key: "sweating_vasodilation_sort",
    matchPatterns: [/sweating/i, /vasodilation/i, /vasoconstriction/i, /shivering/i],
    conceptIds: ["thermoregulation"],
    replacementKey: "receptor_effector_chain",
  },
  brain_regions_labelling: {
    key: "brain_regions_labelling",
    matchPatterns: [/brain region/i, /label.*brain/i, /cerebr/i, /cerebellum/i, /medulla/i, /cortex/i],
    conceptIds: ["brain_regions", "brain"],
    replacementKey: "neurone_structure_labelling",
  },
  cerebellum_medulla_cortex_matching: {
    key: "cerebellum_medulla_cortex_matching",
    matchPatterns: [/cerebellum.*medulla/i, /cortex.*cerebellum/i],
    conceptIds: ["brain_regions"],
    replacementKey: "cns_pns_sort",
  },
  full_reflex_arc_dragdrop: {
    key: "full_reflex_arc_dragdrop",
    matchPatterns: [/reflex arc.*drag/i, /order the reflex arc/i, /reflex arc pathway/i, /reflex pathway/i],
    conceptIds: ["reflex_arc_pathway", "reflex_arc"],
    replacementKey: "impulse_transmission_sequence",
  },
  reflex_arc_pathway_labelling: {
    key: "reflex_arc_pathway_labelling",
    matchPatterns: [/reflex arc/i, /relay neurone.*motor neurone.*effector/i],
    conceptIds: ["reflex_arc_pathway"],
    replacementKey: "impulse_transmission_sequence",
  },
};

const INTERACTION_AUTHORITY_PROFILES = [
  {
    taxonomyKey: "nervous-system-structure",
    topicKeyPatterns: [/nervous-system-structure/i],
    authorized: NERVOUS_SYSTEM_AUTHORIZED,
    blocked: NERVOUS_SYSTEM_BLOCKED,
  },
];

function emptyAuthority(mode = 0) {
  return {
    profileKey: null,
    boundaryMode: mode,
    authorizedInteractionKeys: [],
    authorizedInteractionTemplates: [],
    blockedInteractionKeys: [],
    blockedInteractionConceptIds: [],
    promptInstructions: [],
    warnings: [],
    enforce: false,
    reportOnly: true,
  };
}

function leafKeyFromTopicKey(topicKey = "") {
  const raw = String(topicKey || "").trim().toLowerCase();
  if (!raw) return "";
  const idx = raw.lastIndexOf(":");
  return idx >= 0 ? raw.slice(idx + 1) : raw;
}

function resolveAuthorityProfile(subTopicProfile) {
  if (!subTopicProfile) return null;
  return (
    INTERACTION_AUTHORITY_PROFILES.find((p) => p.taxonomyKey === subTopicProfile.taxonomyKey) ||
    null
  );
}

/**
 * @param {object} input
 */
function resolveAuthorizedInteractions(input = {}) {
  const mode =
    input.boundaryMode !== undefined && input.boundaryMode !== null
      ? Number(input.boundaryMode)
      : getSubTopicBoundaryMode();

  if (mode === 0) return emptyAuthority(0);

  const profile =
    input.subTopicProfile ||
    resolveSubTopicProfile({
      topicKey: input.topicKey,
      subTopic: input.subTopic,
      topic: input.topic,
    });

  const authorityProfile = resolveAuthorityProfile(profile);
  if (!authorityProfile) return emptyAuthority(mode);

  const authorizedInteractionTemplates = Object.values(authorityProfile.authorized);
  const blockedInteractionKeys = Object.keys(authorityProfile.blocked);
  const blockedInteractionConceptIds = [
    ...new Set(
      Object.values(authorityProfile.blocked).flatMap((b) => b.conceptIds || [])
    ),
  ];

  const enforce = isSubTopicBoundaryEnforcementEnabled();
  const promptInstructions = buildInteractionAuthorityPrompt({
    authorizedInteractions: authorizedInteractionTemplates,
    blockedInteractions: Object.values(authorityProfile.blocked),
    subTopicProfile: profile,
    boundaryMode: mode,
  }).instructions;

  const warnings =
    mode >= 1
      ? [
          "Interaction authority active: only authorised interaction templates should be generated for this sub-topic.",
        ]
      : [];

  return {
    profileKey: authorityProfile.taxonomyKey,
    boundaryMode: mode,
    authorizedInteractionKeys: authorizedInteractionTemplates.map((t) => t.key),
    authorizedInteractionTemplates,
    blockedInteractionKeys,
    blockedInteractionConceptIds,
    blockedInteractions: Object.values(authorityProfile.blocked),
    authorityProfile,
    promptInstructions,
    warnings,
    enforce,
    reportOnly: !enforce,
  };
}

/**
 * @param {object} input
 */
function buildInteractionAuthorityPrompt(input = {}) {
  const mode = input.boundaryMode ?? getSubTopicBoundaryMode();
  const authorized = input.authorizedInteractions || [];
  const blocked = input.blockedInteractions || [];

  if (mode === 0 || !authorized.length) {
    return { marker: AUTHORITY_MARKER, instructions: [], text: "" };
  }

  const lines = [
    AUTHORITY_MARKER,
    "For this selected sub-topic, only use these authorised interactions:",
    ...authorized.map((a) => `- ${a.title} (${a.key})`),
    "",
    "Do NOT generate:",
    ...blocked.map((b) => `- ${b.key.replace(/_/g, " ")}`),
    "",
    "If an interaction is needed, choose from the authorised list only.",
  ];

  if (mode >= 2) {
    lines.push(
      "",
      "Enforcement: blocked interaction templates are forbidden. Reroute to the nearest authorised interaction."
    );
  }

  return {
    marker: AUTHORITY_MARKER,
    instructions: lines,
    text: lines.join("\n"),
  };
}

function interactionHaystack(interaction) {
  return normalizeText(
    [
      interaction?.title,
      interaction?.instructions,
      interaction?.prompt,
      interaction?.content,
      interaction?.diagramBrief,
      interaction?.replacementTemplateKey,
      interaction?.replacementBlockType,
      interaction?.originalConceptId,
      interaction?.replacementConceptId,
      ...(interaction?.cards || []),
      ...(interaction?.pairs || []),
      ...(interaction?.steps || []),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function detectBlockedInteractionKey(hay, authorityProfile) {
  if (!authorityProfile?.blocked) return null;
  for (const blocked of Object.values(authorityProfile.blocked)) {
    if ((blocked.matchPatterns || []).some((re) => re.test(hay))) {
      return blocked.key;
    }
    for (const conceptId of blocked.conceptIds || []) {
      if (conceptId && hay.includes(normalizeText(conceptId.replace(/_/g, " ")))) {
        return blocked.key;
      }
    }
  }
  return null;
}

function nearestAuthorizedTemplate(blockedKey, authorityProfile) {
  const blocked = authorityProfile?.blocked?.[blockedKey];
  const replacementKey = blocked?.replacementKey;
  if (replacementKey && authorityProfile?.authorized?.[replacementKey]) {
    return authorityProfile.authorized[replacementKey];
  }
  return authorityProfile?.authorized?.neurone_structure_labelling || null;
}

/**
 * @param {object} input
 */
function validateInteractionAuthority(input = {}) {
  const mode =
    input.boundaryMode !== undefined ? Number(input.boundaryMode) : getSubTopicBoundaryMode();
  if (mode === 0) {
    return { valid: true, blockedKey: null, suggestedReplacementKey: null, reason: "Authority off." };
  }

  const authority = input.authorizedInteractions || resolveAuthorizedInteractions(input);
  const authorityProfile = authority.authorityProfile || resolveAuthorityProfile(input.subTopicProfile);
  const interaction = input.interaction || {};
  const hay = interactionHaystack(interaction);

  if (!authorityProfile) {
    return { valid: true, blockedKey: null, suggestedReplacementKey: null, reason: "No authority profile." };
  }

  const blockedKey = detectBlockedInteractionKey(hay, authorityProfile);
  if (blockedKey) {
    const replacement = nearestAuthorizedTemplate(blockedKey, authorityProfile);
    return {
      valid: false,
      blockedKey,
      suggestedReplacementKey: replacement?.key || null,
      suggestedTemplate: replacement,
      reason: `Blocked interaction "${blockedKey}" is not authorised for this sub-topic.`,
    };
  }

  if (
    interaction.key &&
    authority.authorizedInteractionKeys?.length &&
    !authority.authorizedInteractionKeys.includes(interaction.key)
  ) {
    if (mode >= 2) {
      return {
        valid: false,
        blockedKey: interaction.key,
        suggestedReplacementKey: authority.authorizedInteractionKeys[0],
        suggestedTemplate: authority.authorizedInteractionTemplates?.[0],
        reason: `Interaction key "${interaction.key}" is not in the authorised set.`,
      };
    }
  }

  const conceptId =
    interaction.conceptId ||
    interaction.originalConceptId ||
    inferPrimaryConceptIdFromHaystack(hay, input.subTopicProfile);
  if (
    conceptId &&
    authority.blockedInteractionConceptIds?.includes(conceptId) &&
    mode >= 2
  ) {
    const blockedEntry = Object.values(authorityProfile.blocked).find((b) =>
      (b.conceptIds || []).includes(conceptId)
    );
    const replacement = nearestAuthorizedTemplate(blockedEntry?.key, authorityProfile);
    return {
      valid: false,
      blockedKey: blockedEntry?.key || conceptId,
      suggestedReplacementKey: replacement?.key || null,
      suggestedTemplate: replacement,
      reason: `Concept "${conceptId}" is blocked for primary interactions in this sub-topic.`,
    };
  }

  if (
    interaction.key === "impulse_transmission_sequence" ||
    hay.includes("impulse transmission sequence")
  ) {
    const avoid = authorityProfile.authorized?.impulse_transmission_sequence?.avoidTerms || [];
    if (avoid.some((term) => hay.includes(normalizeText(term)))) {
      return {
        valid: false,
        blockedKey: "full_reflex_arc_dragdrop",
        suggestedReplacementKey: "impulse_transmission_sequence",
        suggestedTemplate: authorityProfile.authorized.impulse_transmission_sequence,
        reason: "Sequence must not use full reflex-arc wording.",
      };
    }
  }

  return { valid: true, blockedKey: null, suggestedReplacementKey: null, reason: "Authorised." };
}

/**
 * Mode 2: reroute invalid interaction plan entry to authorised template.
 * @param {object} entry
 * @param {object} authority
 * @param {import("./subTopicProfiles").SubTopicProfile} subTopicProfile
 */
function rerouteInteractionToAuthority(entry, authority, subTopicProfile) {
  const validation = validateInteractionAuthority({
    interaction: entry,
    authorizedInteractions: authority,
    subTopicProfile,
    boundaryMode: authority.boundaryMode,
  });
  if (validation.valid || !validation.suggestedTemplate) return entry;

  const template = validation.suggestedTemplate;
  return {
    ...entry,
    authorityRerouted: true,
    authorityBlockedKey: validation.blockedKey,
    replacementTemplateKey: template.key,
    title: template.title,
    replacementBlockType: template.blockType,
    replacementActivityKind: template.activityTypes?.[0] || entry.replacementActivityKind,
    instructions: template.instructions,
    cards: template.cards || entry.cards,
    pairs: template.pairs,
    steps: template.steps,
    checkpointPrompt: template.prompt || entry.checkpointPrompt,
    reason: `${entry.reason || ""} Authority reroute: ${validation.reason}`.trim(),
  };
}

function formatInteractionAuthorityAppendix(authority) {
  if (!authority?.promptInstructions?.length) return "";
  return authority.promptInstructions.join("\n");
}

/**
 * Audit lesson pages for interaction authority (read-only).
 * @param {object} input
 */
function auditInteractionAuthorityFromLesson(input = {}) {
  const authority = input.authority || resolveAuthorizedInteractions(input);
  if (authority.boundaryMode === 0 || !authority.profileKey) {
    return {
      enabled: false,
      authorizedUsed: [],
      blockedRisks: [],
      unauthorisedDetected: [],
      suggestedReplacements: [],
    };
  }

  const authorityProfile = authority.authorityProfile;
  const pages = input.pages || [];
  const blocks = pages.flatMap((p) => p.blocks || []);

  const authorizedUsed = [];
  const blockedRisks = [];
  const unauthorisedDetected = [];
  const suggestedReplacements = [];

  for (const block of blocks) {
    const hay = normalizeText(
      [blockHaystack(block), block?.title, block?.prompt, block?.content].filter(Boolean).join(" ")
    );
    const isInteractive = /drag|drop|match|sequence|diagram|hotspot|label/i.test(hay) ||
      ["dragdropmatch", "interactivesequence", "interactivediagram", "hotspot", "labeldiagram"].includes(
        String(block.type || "").toLowerCase().replace(/[\s_-]+/g, "")
      );

    if (!isInteractive && !hay) continue;

    for (const auth of authority.authorizedInteractionTemplates || []) {
      const authHay = normalizeText([auth.title, auth.instructions, ...(auth.cards || [])].join(" "));
      if (authHay && hay.includes(normalizeText(auth.title.split(" ")[0]))) {
        if (!authorizedUsed.includes(auth.key)) authorizedUsed.push(auth.key);
      }
    }

    const blockedKey = detectBlockedInteractionKey(hay, authorityProfile);
    if (blockedKey) {
      const replacement = nearestAuthorizedTemplate(blockedKey, authorityProfile);
      blockedRisks.push({
        blockTitle: block.title || block.type,
        blockedKey,
        snippet: hay.slice(0, 120),
      });
      unauthorisedDetected.push(blockedKey);
      if (replacement) {
        suggestedReplacements.push({
          blocked: blockedKey,
          replaceWith: replacement.key,
          replaceTitle: replacement.title,
        });
      }
    }
  }

  return {
    enabled: true,
    profileKey: authority.profileKey,
    boundaryMode: authority.boundaryMode,
    authorizedUsed: [...new Set(authorizedUsed)],
    blockedRisks,
    unauthorisedDetected: [...new Set(unauthorisedDetected)],
    suggestedReplacements,
    enforce: authority.enforce,
  };
}

module.exports = {
  AUTHORITY_MARKER,
  NERVOUS_SYSTEM_AUTHORIZED,
  NERVOUS_SYSTEM_BLOCKED,
  resolveAuthorityProfile,
  resolveAuthorizedInteractions,
  validateInteractionAuthority,
  buildInteractionAuthorityPrompt,
  rerouteInteractionToAuthority,
  formatInteractionAuthorityAppendix,
  auditInteractionAuthorityFromLesson,
  detectBlockedInteractionKey,
  nearestAuthorizedTemplate,
};
