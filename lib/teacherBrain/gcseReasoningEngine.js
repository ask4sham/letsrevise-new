/**
 * Phase 3G — GCSE reasoning engine (structure → adaptation → function → consequence → exam).
 * Prompt and diagnostics only; does not mutate lesson blocks.
 */

const { normalizeText, blockHaystack } = require("../lessonBlockAnalysis");
const { resolvePedagogyProfile } = require("./biologyPedagogyProfiles");

const REASONING_MARKER = "GCSE REASONING ENGINE:";

const GCSE_REASONING_STEPS = [
  "structure",
  "adaptation",
  "function",
  "consequence",
  "exam_application",
];

const STEP_LABELS = {
  structure: "Structure",
  adaptation: "Adaptation",
  function: "Function",
  consequence: "Consequence",
  exam_application: "Exam application",
};

const STEP_PATTERNS = {
  structure: [
    /\bstructure\b/i,
    /\bis a\b/i,
    /\bcomposed of\b/i,
    /\bconsists of\b/i,
    /\bpart of the\b/i,
    /\blabel\b/i,
    /\bcell body\b/i,
    /\bsheath\b/i,
  ],
  adaptation: [
    /\badapt/i,
    /\binsulat/i,
    /\blong\b/i,
    /\bsurface area\b/i,
    /\bsaltatory\b/i,
    /\bprevents\b/i,
    /\bdesigned to\b/i,
    /\ballows impulses to jump\b/i,
  ],
  function: [
    /\bfunction\b/i,
    /\btransmit/i,
    /\bcarries impulses\b/i,
    /\breceive/i,
    /\bspeeds up\b/i,
    /\bconduct/i,
    /\bpasses impulses\b/i,
    /\bcoordinat/i,
  ],
  consequence: [
    /\bconsequence\b/i,
    /\btherefore\b/i,
    /\bso that\b/i,
    /\bthis means\b/i,
    /\brapid response/i,
    /\bfaster\b/i,
    /\badvantage\b/i,
    /\bif (the|this) .* (damaged|removed|absent)/i,
    /\bwithout (myelin|the axon)/i,
    /\ballows (the|a) (body|organism)/i,
    /\bmuch faster\b/i,
  ],
  exam_application: [
    /\bexam\b/i,
    /\bgcse\b/i,
    /\b4[\s-]?mark/i,
    /\bexplain how\b/i,
    /\bmodel answer\b/i,
    /\bmark scheme\b/i,
    /\brapid responses to stimuli\b/i,
    /\bin an exam\b/i,
  ],
};

/** @type {import("./gcseReasoningEngine").ReasoningProfile} */
const NERVOUS_SYSTEM_REASONING_PROFILE = {
  taxonomyKey: "nervous-system-structure",
  topicKeyPatterns: [/nervous-system-structure/i],
  displayName: "Structure and function of the nervous system",
  concepts: [
    {
      conceptId: "neurone",
      name: "Neurone",
      matchTerms: ["neurone", "neuron", "nerve cell"],
      structure: "A neurone has a cell body, dendrites, a nucleus, a long axon and nerve endings.",
      adaptation:
        "Dendrites are branched for a large surface area; the axon is long to carry impulses over distance.",
      function:
        "Neurones transmit electrical impulses between receptors, the CNS and effectors.",
      consequence:
        "This allows rapid, coordinated responses across the body.",
      exam_application:
        "GCSE: label neurone parts and explain how structure supports rapid communication.",
    },
    {
      conceptId: "axon",
      name: "Axon",
      matchTerms: ["axon", "axons", "nerve fibre", "nerve fiber"],
      structure: "The axon is a long fibre carrying impulses away from the cell body.",
      adaptation: "Length carries impulses over long distances without many cell bodies.",
      function: "Transmits electrical impulses to synapses and target cells.",
      consequence: "Signals reach effectors quickly for coordinated responses.",
      exam_application: "Explain how axon length helps rapid transmission in exam answers.",
    },
    {
      conceptId: "dendrites",
      name: "Dendrites",
      matchTerms: ["dendrite", "dendrites"],
      structure: "Branched extensions from the cell body.",
      adaptation: "Large surface area with many receptors.",
      function: "Receive impulses from other neurones and conduct them toward the cell body.",
      consequence: "The neurone can integrate signals from many sources at once.",
      exam_application: "Link dendrite structure to detecting stimuli in GCSE questions.",
    },
    {
      conceptId: "myelin_sheath",
      name: "Myelin sheath",
      matchTerms: ["myelin", "myelin sheath", "schwann"],
      structure: "Myelin is a fatty insulating sheath wrapped around the axon.",
      adaptation:
        "It prevents electrical signal loss and allows saltatory conduction at nodes of Ranvier.",
      function: "Impulses jump between gaps in the sheath, increasing transmission speed.",
      consequence: "Transmission becomes much faster so responses to stimuli are rapid.",
      exam_application:
        "Explain why fast transmission helps rapid responses to stimuli (4-mark GCSE).",
    },
    {
      conceptId: "receptors",
      name: "Receptors",
      matchTerms: ["receptor", "receptors", "detect stimulus"],
      structure: "Specialised cells or endings that detect stimuli.",
      adaptation: "Positioned to detect changes in the environment or internal conditions.",
      function: "Convert stimuli into electrical impulses in sensory neurones.",
      consequence: "The nervous system can detect changes and respond quickly.",
      exam_application: "Describe the role of receptors in stimulus–response pathways.",
    },
    {
      conceptId: "cns",
      name: "CNS",
      matchTerms: ["cns", "central nervous system", "brain and spinal cord", "spinal cord", "brain"],
      structure: "The brain and spinal cord form the central nervous system.",
      adaptation: "Protected by bone/fluid; contains many interneurones for processing.",
      function: "Processes information and coordinates responses.",
      consequence: "Allows complex, rapid decision-making and reflex coordination.",
      exam_application: "Compare CNS and PNS roles in GCSE coordination questions.",
    },
    {
      conceptId: "pns",
      name: "PNS",
      matchTerms: ["pns", "peripheral nervous system", "peripheral nerves", "nerves"],
      structure: "Nerves made of bundles of neurones outside the CNS.",
      adaptation: "Extends to all parts of the body to carry signals to and from the CNS.",
      function: "Transmits impulses between CNS and receptors/effectors.",
      consequence: "Every part of the body can be monitored and controlled.",
      exam_application: "Classify structures as CNS or PNS in exam tasks.",
    },
    {
      conceptId: "effectors",
      name: "Effectors",
      matchTerms: ["effector", "effectors", "muscle", "gland"],
      structure: "Muscles and glands that respond to nervous signals.",
      adaptation: "Can contract or secrete in response to impulses.",
      function: "Carry out the body's response to a stimulus.",
      consequence: "The organism produces a visible or physiological response.",
      exam_application: "Explain stimulus → receptor → CNS → effector sequences in exams.",
    },
  ],
  lessonRequirements: {
    minFullChains: 2,
    minExamChains: 1,
  },
};

const REASONING_PROFILES = [NERVOUS_SYSTEM_REASONING_PROFILE];

function isGcseReasoningEngineEnabled() {
  return String(process.env.TEACHER_BRAIN_GCSE_REASONING_ENGINE || "0").trim() === "1";
}

function leafKeyFromTopicKey(topicKey = "") {
  const raw = String(topicKey || "").trim().toLowerCase();
  if (!raw) return "";
  const idx = raw.lastIndexOf(":");
  return idx >= 0 ? raw.slice(idx + 1) : raw;
}

/**
 * @param {object} [input]
 * @returns {typeof NERVOUS_SYSTEM_REASONING_PROFILE|null}
 */
function resolveReasoningProfile(input = {}) {
  const leaf = leafKeyFromTopicKey(input.topicKey);
  const subTopic = String(input.subTopic || "").trim();

  for (const profile of REASONING_PROFILES) {
    if (input.taxonomyKey && input.taxonomyKey === profile.taxonomyKey) return profile;
    if (leaf && profile.topicKeyPatterns.some((re) => re.test(leaf))) return profile;
    if (input.subTopicProfile?.taxonomyKey === profile.taxonomyKey) return profile;
    if (subTopic && /structure\s+and\s+function\s+of\s+the\s+nervous\s+system/i.test(subTopic)) {
      return profile;
    }
    if (input.pedagogyProfile?.taxonomyKey === profile.taxonomyKey) return profile;
  }
  return null;
}

/**
 * @param {string} conceptId
 * @param {typeof NERVOUS_SYSTEM_REASONING_PROFILE} reasoningProfile
 */
function buildReasoningChain(conceptId, reasoningProfile) {
  if (!reasoningProfile) return null;
  const concept = (reasoningProfile.concepts || []).find((c) => c.conceptId === conceptId);
  if (!concept) return null;

  return {
    conceptId: concept.conceptId,
    name: concept.name,
    steps: GCSE_REASONING_STEPS.map((step) => ({
      step,
      label: STEP_LABELS[step],
      text: concept[step],
    })),
    chainText: GCSE_REASONING_STEPS.map((step) => `${STEP_LABELS[step]}: ${concept[step]}`).join("\n"),
  };
}

function haystackForBlock(block) {
  return normalizeText(
    [blockHaystack(block), block?.title, block?.prompt, block?.question, block?.content, block?.explanation]
      .filter(Boolean)
      .join(" ")
  );
}

function conceptMentioned(hay, concept) {
  const terms = [concept.name, ...(concept.matchTerms || [])].map((t) => normalizeText(t));
  return terms.some((t) => t && hay.includes(t));
}

function stepPresentInHaystack(hay, step) {
  const patterns = STEP_PATTERNS[step] || [];
  return patterns.some((re) => re.test(hay));
}

function stepPresentForConcept(conceptHay, fullHay, concept, step) {
  if (step === "structure" && concept.structure) {
    const snippet = normalizeText(concept.structure.slice(0, 40));
    if (snippet && conceptHay.includes(snippet.slice(0, 20))) return true;
  }
  if (conceptHay && stepPresentInHaystack(conceptHay, step)) return true;
  if (step === "exam_application" && stepPresentInHaystack(fullHay, step)) return true;
  if (step === "consequence" && /rapid response|much faster|advantage|so that/i.test(conceptHay)) {
    return true;
  }
  return stepPresentInHaystack(conceptHay, step);
}

/**
 * @param {object} input
 * @param {object[]} [input.pages]
 * @param {typeof NERVOUS_SYSTEM_REASONING_PROFILE} [input.reasoningProfile]
 */
function scoreReasoningCoverage(input = {}) {
  const reasoningProfile =
    input.reasoningProfile || resolveReasoningProfile(input);

  if (!isGcseReasoningEngineEnabled() || !reasoningProfile) {
    return {
      enabled: false,
      reasoningScorePct: 0,
      structureBlocks: 0,
      adaptationBlocks: 0,
      functionBlocks: 0,
      consequenceBlocks: 0,
      examBlocks: 0,
      conceptReasoning: [],
      fullChainsFound: 0,
      examChainsFound: 0,
      gaps: [],
      recommendations: [],
    };
  }

  const blocks = (input.pages || []).flatMap((p) => p.blocks || []);
  const fullHay = blocks.map((b) => haystackForBlock(b)).join(" ");

  let structureBlocks = 0;
  let adaptationBlocks = 0;
  let functionBlocks = 0;
  let consequenceBlocks = 0;
  let examBlocks = 0;

  for (const block of blocks) {
    const hay = haystackForBlock(block);
    if (stepPresentInHaystack(hay, "structure")) structureBlocks += 1;
    if (stepPresentInHaystack(hay, "adaptation")) adaptationBlocks += 1;
    if (stepPresentInHaystack(hay, "function")) functionBlocks += 1;
    if (stepPresentInHaystack(hay, "consequence")) consequenceBlocks += 1;
    if (stepPresentInHaystack(hay, "exam_application")) examBlocks += 1;
  }

  const conceptReasoning = [];
  let fullChainsFound = 0;
  let examChainsFound = 0;

  for (const concept of reasoningProfile.concepts) {
    const conceptHay = blocks
      .filter((b) => conceptMentioned(haystackForBlock(b), concept))
      .map((b) => haystackForBlock(b))
      .join(" ");

    if (!conceptMentioned(fullHay, concept) && !conceptHay) {
      conceptReasoning.push({
        conceptId: concept.conceptId,
        name: concept.name,
        mentionCount: 0,
        steps: Object.fromEntries(GCSE_REASONING_STEPS.map((s) => [s, false])),
        stepsComplete: 0,
        complete: false,
      });
      continue;
    }

    const steps = {};
    for (const step of GCSE_REASONING_STEPS) {
      steps[step] = stepPresentForConcept(conceptHay, fullHay, concept, step);
    }
    const stepsComplete = GCSE_REASONING_STEPS.filter((s) => steps[s]).length;
    const complete = stepsComplete >= 4;
    if (complete) fullChainsFound += 1;
    if (steps.exam_application && steps.consequence) examChainsFound += 1;

    conceptReasoning.push({
      conceptId: concept.conceptId,
      name: concept.name,
      mentionCount: (concept.matchTerms || []).reduce((n, term) => {
        const t = normalizeText(term);
        return n + (t ? Math.max(0, fullHay.split(t).length - 1) : 0);
      }, 0),
      steps,
      stepsComplete,
      complete,
    });
  }

  const gaps = identifyReasoningGaps({ conceptReasoning, reasoningProfile });
  const recommendations = gaps.flatMap((g) => g.recommendations);

  const req = reasoningProfile.lessonRequirements || {};
  const checks = [
    structureBlocks > 0,
    adaptationBlocks > 0,
    functionBlocks > 0,
    consequenceBlocks > 0,
    examBlocks > 0,
    fullChainsFound >= (req.minFullChains || 2),
    examChainsFound >= (req.minExamChains || 1),
    conceptReasoning.filter((c) => c.complete).length >= 2,
  ];
  const reasoningScorePct = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return {
    enabled: true,
    reasoningScorePct,
    structureBlocks,
    adaptationBlocks,
    functionBlocks,
    consequenceBlocks,
    examBlocks,
    conceptReasoning,
    fullChainsFound,
    examChainsFound,
    gaps,
    recommendations,
    warnings: reasoningScorePct < 80 ? recommendations.slice(0, 6) : [],
  };
}

/**
 * @param {object} input
 * @param {object[]} input.conceptReasoning
 * @param {typeof NERVOUS_SYSTEM_REASONING_PROFILE} input.reasoningProfile
 */
function identifyReasoningGaps(input = {}) {
  const { conceptReasoning = [], reasoningProfile } = input;
  const gaps = [];

  for (const row of conceptReasoning) {
    if (!row.mentionCount && !row.stepsComplete) continue;

    const missing = GCSE_REASONING_STEPS.filter((s) => !row.steps[s]);
    if (!missing.length) continue;

    const concept = (reasoningProfile?.concepts || []).find((c) => c.conceptId === row.conceptId);
    const recommendations = [];

    for (const step of missing) {
      if (concept?.[step]) {
        recommendations.push(`Add ${STEP_LABELS[step]}: "${concept[step]}"`);
      }
    }
    if (missing.includes("consequence") && row.conceptId === "myelin_sheath") {
      recommendations.push('Add: "Explain why fast transmission helps rapid responses."');
    }
    if (missing.includes("exam_application") && concept?.exam_application) {
      recommendations.push(`Add exam application: ${concept.exam_application}`);
    }

    gaps.push({
      conceptId: row.conceptId,
      name: row.name,
      missingSteps: missing.map((s) => STEP_LABELS[s]),
      steps: row.steps,
      recommendations,
    });
  }

  return gaps;
}

/**
 * @param {typeof NERVOUS_SYSTEM_REASONING_PROFILE|null} reasoningProfile
 */
function buildReasoningAppendix(reasoningProfile) {
  if (!isGcseReasoningEngineEnabled() || !reasoningProfile) return "";

  const lines = [
    REASONING_MARKER,
    "For every major concept use the full GCSE reasoning chain:",
    "1. Describe the structure.",
    "2. Explain the adaptation.",
    "3. Explain the function.",
    "4. Explain what advantage it provides (consequence — what happens if damaged/absent or why speed/coordination matters).",
    "5. Explain how this appears in GCSE exam questions.",
    "",
    "Do not stop at factual description. Force cause-and-effect reasoning.",
    `Require at least ${reasoningProfile.lessonRequirements?.minFullChains || 2} complete structure→adaptation→function→consequence chains`,
    `and at least ${reasoningProfile.lessonRequirements?.minExamChains || 1} chain ending with exam application.`,
    "",
    "EXAMPLE CHAIN (Myelin sheath):",
    buildReasoningChain("myelin_sheath", reasoningProfile)?.chainText || "",
    "",
    "Apply the same five-step chain to: neurone, axon, dendrites, receptors, CNS, PNS, effectors.",
  ];

  for (const concept of (reasoningProfile.concepts || []).slice(0, 5)) {
    lines.push("", `${concept.name.toUpperCase()} — template:`);
    lines.push(buildReasoningChain(concept.conceptId, reasoningProfile)?.chainText || "");
  }

  return lines.join("\n");
}

/**
 * @param {object} options
 */
function buildReasoningContext(options = {}) {
  const reasoningProfile =
    resolveReasoningProfile(options) ||
    resolveReasoningProfile({ pedagogyProfile: resolvePedagogyProfile(options) });
  return {
    enabled: isGcseReasoningEngineEnabled() && Boolean(reasoningProfile),
    reasoningProfile,
  };
}

module.exports = {
  GCSE_REASONING_STEPS,
  STEP_LABELS,
  NERVOUS_SYSTEM_REASONING_PROFILE,
  isGcseReasoningEngineEnabled,
  resolveReasoningProfile,
  buildReasoningChain,
  scoreReasoningCoverage,
  identifyReasoningGaps,
  buildReasoningAppendix,
  buildReasoningContext,
  REASONING_MARKER,
};
