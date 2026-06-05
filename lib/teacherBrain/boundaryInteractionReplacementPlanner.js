/**
 * Phase 3D — boundary-aware interaction replacement planning.
 * Enriches Phase 3C concept reroutes with in-scope activity-format equivalents.
 * Does not mutate existing lesson blocks.
 */

const { getSubTopicBoundaryMode, isSubTopicBoundaryEnforcementEnabled } = require("./subTopicBoundaryGuard");
const { listProfileConcepts } = require("./subTopicProfiles");
const { pickHighestPriorityConceptId } = require("./conceptPriorityEngine");
const {
  enrichInteractionWithPedagogy,
  resolvePedagogyProfile,
} = require("./structureFunctionPedagogyEngine");
const {
  resolveAuthorizedInteractions,
  rerouteInteractionToAuthority,
  formatInteractionAuthorityAppendix,
} = require("./interactionAuthorityLayer");

const INTERACTION_MARKER = "--- BOUNDARY INTERACTION REPLACEMENT (Phase 3D)";

const NEURONE_DRAG_CARDS = [
  "cell body",
  "nucleus",
  "dendrites",
  "axon",
  "myelin sheath",
  "axon terminals",
];

/**
 * @param {string} blockTypeOrKind
 * @returns {string}
 */
function normalizeOriginalActivityKind(blockTypeOrKind) {
  const t = String(blockTypeOrKind || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (!t) return "activity";
  if (t.includes("dragdrop") || t === "dragdropmatch") return "dragDrop";
  if (t.includes("interactivediagram") || t === "labeldiagram" || t === "hotspot") {
    return "interactiveDiagram";
  }
  if (t.includes("interactivesequence") || t === "stepbystep") return "interactiveSequence";
  if (t === "exam" || t.includes("exampractice") || t === "practice") return "examPractice";
  if (t === "quiz") return "examPractice";
  if (t === "checkpoint" || t.includes("selfcheck")) return "checkpoint";
  if (t === "flashcard") return "flashcard";
  return "activity";
}

function defaultActivityKindForConcept(conceptId) {
  if (conceptId === "reflex_arc_pathway" || conceptId === "reflex_arc") return "dragDrop";
  if (conceptId === "brain_regions" || conceptId === "brain") return "interactiveDiagram";
  if (conceptId === "accommodation" || conceptId === "eye") return "checkpoint";
  if (conceptId === "thermoregulation") return "examPractice";
  return "checkpoint";
}

function conceptNameForId(conceptId, profile) {
  if (!conceptId || !profile) return conceptId || "";
  for (const c of listProfileConcepts(profile)) {
    if (c.id === conceptId) return c.name;
  }
  return conceptId;
}

/**
 * @param {string} originalConceptId
 * @param {string} originalActivityKind
 * @param {import("./subTopicProfiles").SubTopicProfile} profile
 * @returns {Omit<InteractionReplacementPlan, "originalConceptId" | "originalActivityKind" | "reason"> | null}
 */
function nervousSystemStructureInteractionTemplate(originalConceptId, originalActivityKind, profile) {
  const activity = normalizeOriginalActivityKind(originalActivityKind);
  const key = `${originalConceptId}|${activity}`;

  const templates = {
    "reflex_arc_pathway|dragDrop": {
      replacementTemplateKey: "neurone_structure_drag_drop",
      replacementConceptId: "neurones",
      replacementActivityKind: "dragDrop",
      replacementBlockType: "dragdropmatch",
      title: "Label the neurone structure",
      instructions:
        "Drag and drop labels onto a neurone diagram. Explain how each part helps transmit impulses quickly.",
      cards: NEURONE_DRAG_CARDS,
      targets: ["neurone image zones"],
      diagramBrief:
        "Portrait neurone diagram with labelled zones for cell body, nucleus, dendrites, axon, myelin sheath, and axon terminals.",
      checkpointPrompt: null,
      examFocus: null,
    },
    "reflex_arc|dragDrop": {
      replacementTemplateKey: "neurone_structure_drag_drop",
      replacementConceptId: "neurones",
      replacementActivityKind: "dragDrop",
      replacementBlockType: "dragdropmatch",
      title: "Label the neurone structure",
      instructions:
        "Drag and drop labels onto a neurone diagram. Explain how each part helps transmit impulses quickly.",
      cards: NEURONE_DRAG_CARDS,
      targets: ["neurone image zones"],
      diagramBrief:
        "Portrait neurone diagram with labelled zones for cell body, nucleus, dendrites, axon, myelin sheath, and axon terminals.",
      checkpointPrompt: null,
      examFocus: null,
    },
    "brain_regions|interactiveDiagram": {
      replacementTemplateKey: "cns_pns_comparison_or_neurone_label",
      replacementConceptId: "neurones",
      replacementActivityKind: "interactiveDiagram",
      replacementBlockType: "interactivediagram",
      title: "CNS and PNS overview",
      instructions:
        "Interactive diagram showing CNS, PNS, brain and spinal cord as overview only, and nerves branching out. Do not ask brain-region function questions.",
      cards: ["CNS", "PNS", "brain", "spinal cord", "peripheral nerves"],
      targets: ["overview diagram zones"],
      diagramBrief:
        "Overview diagram: central nervous system (brain and spinal cord) vs peripheral nervous system (nerves). Optional motor neurone labelling inset — no cerebrum/cerebellum/medulla function questions.",
      checkpointPrompt: null,
      examFocus: null,
    },
    "brain|interactiveDiagram": {
      replacementTemplateKey: "cns_pns_comparison_or_neurone_label",
      replacementConceptId: "neurones",
      replacementActivityKind: "interactiveDiagram",
      replacementBlockType: "interactivediagram",
      title: "Motor neurone labelling",
      instructions:
        "Label motor neurone parts (cell body, dendrites, axon, myelin sheath). Do not assess named brain regions.",
      cards: ["cell body", "dendrites", "axon", "myelin sheath", "axon terminal"],
      targets: ["motor neurone diagram zones"],
      diagramBrief: "Motor neurone structure diagram for labelling — not brain regional anatomy.",
      checkpointPrompt: null,
      examFocus: null,
    },
    "accommodation|checkpoint": {
      replacementTemplateKey: "myelin_speed_explanation",
      replacementConceptId: "myelin_sheath",
      replacementActivityKind: "checkpoint",
      replacementBlockType: "checkpoint",
      title: "Myelin and impulse speed",
      instructions: "Short self-check on how the myelin sheath speeds up electrical impulses.",
      cards: [],
      targets: [],
      diagramBrief: null,
      checkpointPrompt:
        "Explain how the myelin sheath speeds up electrical impulses along the axon (saltatory conduction).",
      examFocus: null,
    },
    "eye|checkpoint": {
      replacementTemplateKey: "myelin_speed_explanation",
      replacementConceptId: "myelin_sheath",
      replacementActivityKind: "checkpoint",
      replacementBlockType: "checkpoint",
      title: "Myelin and impulse speed",
      instructions: "Short self-check on how the myelin sheath speeds up electrical impulses.",
      cards: [],
      targets: [],
      diagramBrief: null,
      checkpointPrompt:
        "Explain how the myelin sheath speeds up electrical impulses along the axon (saltatory conduction).",
      examFocus: null,
    },
    "thermoregulation|examPractice": {
      replacementTemplateKey: "impulse_transmission_sequence",
      replacementConceptId: "impulse_transmission",
      replacementActivityKind: "interactiveSequence",
      replacementBlockType: "interactivesequence",
      title: "Impulse transmission sequence",
      instructions:
        "Step-by-step sequence: stimulus → receptor → sensory neurone → CNS → motor neurone → effector. Focus on neurone communication and fast response — not a full reflex-arc lesson.",
      cards: ["stimulus", "receptor", "sensory neurone", "CNS", "motor neurone", "effector"],
      targets: ["sequence steps"],
      diagramBrief: null,
      checkpointPrompt: null,
      examFocus:
        "Compare how electrical impulses travel through CNS and PNS neurones for a rapid coordinated response.",
    },
  };

  let template = templates[key];
  if (!template && profile?.taxonomyKey === "nervous-system-structure") {
    const fallbackActivity = normalizeOriginalActivityKind(defaultActivityKindForConcept(originalConceptId));
    template = templates[`${originalConceptId}|${fallbackActivity}`];
  }
  return template || null;
}

function buildInteractionPlanEntry(originalConceptId, originalActivityKind, profile, titleHint) {
  const template = nervousSystemStructureInteractionTemplate(
    originalConceptId,
    originalActivityKind,
    profile
  );
  if (!template) return null;

  const originalName = conceptNameForId(originalConceptId, profile);
  const replacementName = conceptNameForId(template.replacementConceptId, profile);

  const entry = {
    originalConceptId,
    originalActivityKind: normalizeOriginalActivityKind(originalActivityKind),
    replacementTemplateKey: template.replacementTemplateKey,
    replacementConceptId: template.replacementConceptId,
    replacementActivityKind: template.replacementActivityKind,
    replacementBlockType: template.replacementBlockType,
    title: template.title,
    instructions: template.instructions,
    cards: template.cards,
    targets: template.targets,
    diagramBrief: template.diagramBrief,
    checkpointPrompt: template.checkpointPrompt,
    examFocus: template.examFocus,
    reason: `Replace out-of-scope "${originalName}" ${normalizeOriginalActivityKind(originalActivityKind)} with in-scope "${replacementName}" ${template.replacementActivityKind}${titleHint ? ` (was: ${titleHint})` : ""}.`,
  };

  return enrichInteractionWithPedagogy(
    entry,
    resolvePedagogyProfile({ subTopicProfile: profile })
  );
}

function collectActivitySignals(boundaryAudit, boundaryReplacementPlan) {
  const signals = [];
  const seen = new Set();

  for (const finding of boundaryAudit?.blockFindings || []) {
    if (finding.boundaryStatus !== "forbidden" && finding.boundaryStatus !== "neighbouring") {
      continue;
    }
    const conceptId = finding.primaryConceptId;
    if (!conceptId) continue;
    const activityKind = normalizeOriginalActivityKind(finding.blockType);
    const key = `${conceptId}|${activityKind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    signals.push({
      originalConceptId: conceptId,
      originalActivityKind: activityKind,
      titleHint: finding.title,
    });
  }

  for (const row of boundaryReplacementPlan?.replacementPlans || []) {
    const activityKind = defaultActivityKindForConcept(row.originalConceptId);
    const key = `${row.originalConceptId}|${activityKind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    signals.push({
      originalConceptId: row.originalConceptId,
      originalActivityKind: activityKind,
      titleHint: row.originalConceptName,
    });
  }

  return signals;
}

function emptyInteractionPlan(mode = 0) {
  return {
    interactionReplacementPlans: [],
    interactionPromptInstructions: [],
    reportOnly: true,
    interactionRerouteActive: false,
    boundaryMode: mode,
  };
}

/**
 * @param {object} input
 * @param {object} [input.boundaryAudit]
 * @param {object} [input.boundaryReplacementPlan]
 * @param {import("./subTopicProfiles").SubTopicProfile|null} [input.subTopicProfile]
 */
function planBoundaryInteractionReplacements(input = {}) {
  const mode = getSubTopicBoundaryMode();
  if (mode === 0) return emptyInteractionPlan(0);

  const profile = input.subTopicProfile;
  const audit = input.boundaryAudit;
  if (!profile || !audit?.boundaryProfileKey) return emptyInteractionPlan(mode);

  const boundaryReplacementPlan = input.boundaryReplacementPlan || {};
  const interactionRerouteActive = isSubTopicBoundaryEnforcementEnabled();
  const authority = resolveAuthorizedInteractions({
    subTopicProfile: profile,
    boundaryMode: mode,
  });
  const signals = collectActivitySignals(audit, boundaryReplacementPlan);

  const interactionReplacementPlans = [];
  for (const signal of signals) {
    let entry = buildInteractionPlanEntry(
      signal.originalConceptId,
      signal.originalActivityKind,
      profile,
      signal.titleHint
    );
    if (entry && authority.enforce) {
      entry = rerouteInteractionToAuthority(entry, authority, profile);
    }
    if (entry) interactionReplacementPlans.push(entry);
  }

  const interactionPromptInstructions = [];
  if (authority.promptInstructions?.length) {
    interactionPromptInstructions.push(...authority.promptInstructions);
  }
  if (interactionReplacementPlans.length) {
    interactionPromptInstructions.push(
      "Replace forbidden interaction types with these in-scope equivalents:"
    );
    for (const p of interactionReplacementPlans.slice(0, 8)) {
      const originalLabel = `${conceptNameForId(p.originalConceptId, profile)} (${p.originalActivityKind})`;
      const replacementLabel = `${conceptNameForId(p.replacementConceptId, profile)} (${p.replacementActivityKind})`;
      interactionPromptInstructions.push(
        `- Do not create a ${originalLabel} task. Instead create a ${replacementLabel} task: "${p.title}".`
      );
      if (p.replacementBlockType === "dragdropmatch" && p.cards?.length) {
        interactionPromptInstructions.push(
          `  Use drag/drop labels: ${p.cards.join(", ")}.`
        );
      }
      if (p.checkpointPrompt) {
        interactionPromptInstructions.push(`  Checkpoint focus: ${p.checkpointPrompt}`);
      }
      if (p.diagramBrief) {
        interactionPromptInstructions.push(`  Diagram brief: ${p.diagramBrief}`);
      }
      if (p.examFocus) {
        interactionPromptInstructions.push(`  Exam focus: ${p.examFocus}`);
      }
    }
  }

  if (interactionRerouteActive && interactionReplacementPlans.length) {
    interactionPromptInstructions.push(
      "Enforcement: blocked interaction formats must not be generated; use the replacement block types and titles above."
    );
  } else if (interactionReplacementPlans.length) {
    interactionPromptInstructions.push(
      "Advisory: prefer these interaction replacements when generating new lesson activities."
    );
  }

  return {
    interactionReplacementPlans,
    interactionPromptInstructions,
    reportOnly: !interactionRerouteActive,
    interactionRerouteActive,
    boundaryMode: mode,
    boundaryProfileKey: profile.taxonomyKey,
    interactionAuthority: authority.profileKey ? authority : null,
  };
}

/**
 * Merge Phase 3D interaction plan into a Phase 3C replacement plan (in place copy).
 * @param {object} replacementPlan
 * @param {object} boundaryAudit
 * @param {import("./subTopicProfiles").SubTopicProfile|null} subTopicProfile
 */
function mergeInteractionPlanIntoReplacementPlan(replacementPlan, boundaryAudit, subTopicProfile) {
  if (!replacementPlan || !subTopicProfile) return replacementPlan;
  const interaction = planBoundaryInteractionReplacements({
    boundaryAudit,
    boundaryReplacementPlan: replacementPlan,
    subTopicProfile,
  });
  if (!interaction.interactionReplacementPlans.length) {
    return replacementPlan;
  }
  const conceptPromptInstructions =
    replacementPlan.conceptPromptInstructions || replacementPlan.promptInstructions || [];
  return {
    ...replacementPlan,
    conceptPromptInstructions,
    interactionReplacementPlans: interaction.interactionReplacementPlans,
    interactionPromptInstructions: interaction.interactionPromptInstructions,
    interactionRerouteActive: interaction.interactionRerouteActive,
    interactionReportOnly: interaction.reportOnly,
    promptInstructions: [
      ...conceptPromptInstructions,
      ...interaction.interactionPromptInstructions,
    ],
  };
}

/**
 * @param {object} replacementPlan — may include interactionReplacementPlans
 */
function formatBoundaryInteractionReplacementAppendix(replacementPlan) {
  const plans = replacementPlan?.interactionReplacementPlans;
  const instructions =
    replacementPlan?.interactionPromptInstructions?.length
      ? replacementPlan.interactionPromptInstructions
      : null;
  if (!plans?.length && !instructions?.length) return "";

  const lines = [INTERACTION_MARKER, ""];
  if (instructions?.length) {
    lines.push(...instructions);
  } else {
    for (const p of plans.slice(0, 8)) {
      lines.push(
        `- ${p.originalConceptId} (${p.originalActivityKind}) → ${p.replacementConceptId} (${p.replacementActivityKind} / ${p.replacementBlockType}): ${p.title}`
      );
    }
  }
  if (replacementPlan.interactionRerouteActive) {
    lines.push("", "Interaction reroute enforcement is ON for this generation request.");
  }
  return lines.join("\n");
}

/**
 * @param {object} plan
 */
function boundaryInteractionReplacementResponseMeta(plan) {
  if (!plan?.interactionReplacementPlans?.length) return null;
  return {
    boundaryProfileKey: plan.boundaryProfileKey,
    boundaryMode: plan.boundaryMode,
    interactionRerouteActive: plan.interactionRerouteActive,
    reportOnly: plan.reportOnly,
    interactionCount: plan.interactionReplacementPlans.length,
    interactionReplacementPlans: plan.interactionReplacementPlans.slice(0, 12),
    interactionPromptInstructions: plan.interactionPromptInstructions,
  };
}

module.exports = {
  planBoundaryInteractionReplacements,
  mergeInteractionPlanIntoReplacementPlan,
  formatBoundaryInteractionReplacementAppendix,
  boundaryInteractionReplacementResponseMeta,
  normalizeOriginalActivityKind,
  defaultActivityKindForConcept,
  nervousSystemStructureInteractionTemplate,
  INTERACTION_MARKER,
  NEURONE_DRAG_CARDS,
};
