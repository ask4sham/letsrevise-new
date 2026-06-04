/**
 * Phase 3F — structure → adaptation → function → exam pedagogy engine.
 * Prompt and diagnostics only; does not mutate saved lesson blocks.
 */

const { normalizeText, blockHaystack } = require("../lessonBlockAnalysis");
const { resolvePedagogyProfile } = require("./biologyPedagogyProfiles");

const PEDAGOGY_MARKER = "STRUCTURE → FUNCTION PEDAGOGY:";

const PHASE_PATTERNS = {
  structure: [
    /\bstructure\b/i,
    /\bparts?\s+of\b/i,
    /\blabel\b/i,
    /\bdiagram\b/i,
    /\bcell body\b/i,
    /\bcomposed of\b/i,
  ],
  adaptation: [
    /\badapt/i,
    /\binsulat/i,
    /\blong\b/i,
    /\bsurface area\b/i,
    /\bsaltatory\b/i,
    /\bnode(s)? of ranvier\b/i,
    /\bprevents signal loss\b/i,
  ],
  function: [
    /\bfunction\b/i,
    /\ballows\b/i,
    /\benables\b/i,
    /\bspeeds up\b/i,
    /\btransmit/i,
    /\bcarries impulses\b/i,
    /\bso that\b/i,
  ],
  exam: [
    /\b4[\s-]?mark/i,
    /\bgcse\b/i,
    /\bexam\b/i,
    /\bexplain how\b/i,
    /\bmodel answer\b/i,
    /\bmark scheme\b/i,
  ],
};

function isPedagogyEngineEnabled() {
  return String(process.env.TEACHER_BRAIN_PEDAGOGY_ENGINE || "0").trim() === "1";
}

/**
 * @param {import("./biologyPedagogyProfiles").BiologyPedagogyProfile} pedagogyProfile
 */
function generateStructureFunctionFramework(pedagogyProfile) {
  if (!pedagogyProfile) return { rows: [], tableMarkdown: "" };

  const rows = (pedagogyProfile.tier1Frameworks || []).map((c) => ({
    conceptId: c.conceptId,
    name: c.name,
    structure: c.structure,
    adaptation: c.adaptation,
    function: c.function,
    examApplication: c.examApplication,
  }));

  const lines = [
    "STRUCTURE–FUNCTION TABLE (mandatory teaching block):",
    "| Structure | Adaptation | Function |",
    "|---|---|---|",
    ...rows.map((r) => `| ${r.structure} | ${r.adaptation} | ${r.function} |`),
  ];

  return { rows, tableMarkdown: lines.join("\n") };
}

/**
 * @param {import("./biologyPedagogyProfiles").BiologyPedagogyProfile} pedagogyProfile
 */
function generateRequiredInteractionSet(pedagogyProfile) {
  if (!pedagogyProfile) return [];
  return (pedagogyProfile.requiredInteractions || []).map((i) => ({ ...i }));
}

/**
 * @param {import("./biologyPedagogyProfiles").BiologyPedagogyProfile} pedagogyProfile
 */
function generateExamApplicationPrompts(pedagogyProfile) {
  if (!pedagogyProfile?.mandatoryExamBlock) return [];
  const exam = pedagogyProfile.mandatoryExamBlock;
  return [
    {
      marks: exam.marks,
      question: exam.question,
      modelAnswer: exam.modelAnswer,
      cognitiveSkill: exam.cognitiveSkill,
      blockType: "checkpoint",
      instructions:
        `Include at least one ${exam.marks}-mark GCSE ${exam.cognitiveSkill} question: "${exam.question}" with a model answer.`,
    },
  ];
}

function haystackForBlock(block) {
  return normalizeText(
    [
      blockHaystack(block),
      block?.title,
      block?.prompt,
      block?.question,
      block?.instructions,
      block?.content,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function phaseHitsInHaystack(hay, phase) {
  const patterns = PHASE_PATTERNS[phase] || [];
  return patterns.some((re) => re.test(hay));
}

function conceptMentioned(hay, framework) {
  const terms = [framework.name, ...(framework.matchTerms || [])].map((t) =>
    normalizeText(t)
  );
  return terms.some((t) => t && hay.includes(t));
}

/**
 * @param {object} input
 * @param {object[]} [input.pages]
 * @param {import("./biologyPedagogyProfiles").BiologyPedagogyProfile} [input.pedagogyProfile]
 */
function scorePedagogicalCoverage(input = {}) {
  const pedagogyProfile = input.pedagogyProfile || resolvePedagogyProfile(input);
  if (!isPedagogyEngineEnabled() || !pedagogyProfile) {
    return {
      enabled: false,
      pedagogyScorePct: 0,
      structureBlocks: 0,
      adaptationBlocks: 0,
      functionBlocks: 0,
      examBlocks: 0,
      requiredInteractionsPresent: {},
      tier1ConceptCoverage: [],
      gaps: [],
      warnings: [],
    };
  }

  const pages = input.pages || [];
  const blocks = pages.flatMap((p) => p.blocks || []);

  let structureBlocks = 0;
  let adaptationBlocks = 0;
  let functionBlocks = 0;
  let examBlocks = 0;

  const fullLessonHay = blocks.map((b) => haystackForBlock(b)).join(" ");

  for (const block of blocks) {
    const hay = haystackForBlock(block);
    if (phaseHitsInHaystack(hay, "structure")) structureBlocks += 1;
    if (phaseHitsInHaystack(hay, "adaptation")) adaptationBlocks += 1;
    if (phaseHitsInHaystack(hay, "function")) functionBlocks += 1;
    if (phaseHitsInHaystack(hay, "exam")) examBlocks += 1;
  }

  const required = generateRequiredInteractionSet(pedagogyProfile);
  const requiredInteractionsPresent = {};
  for (const interaction of required) {
    const cardHay = (interaction.cards || []).join(" ").toLowerCase();
    const pairHay = (interaction.pairs || []).join(" ").toLowerCase();
    const titleHay = interaction.title.toLowerCase();
    const present =
      fullLessonHay.includes(normalizeText(titleHay)) ||
      (cardHay && cardHay.split(/\s+/).filter((c) => c.length > 3).every((c) => fullLessonHay.includes(normalizeText(c)))) ||
      (pairHay && /cns|pns|myelin|axon/i.test(fullLessonHay) && /match|sort|drag/i.test(fullLessonHay));
    if (interaction.id === "interaction_a") {
      requiredInteractionsPresent[interaction.id] =
        /dendrites/i.test(fullLessonHay) &&
        /myelin/i.test(fullLessonHay) &&
        (/drag|label/i.test(fullLessonHay) || /neurone|neuron/i.test(fullLessonHay));
    } else if (interaction.id === "interaction_b") {
      requiredInteractionsPresent[interaction.id] =
        /adapt/i.test(fullLessonHay) && (/axon|myelin/i.test(fullLessonHay));
    } else if (interaction.id === "interaction_c") {
      requiredInteractionsPresent[interaction.id] =
        /cns/i.test(fullLessonHay) && /pns/i.test(fullLessonHay);
    } else {
      requiredInteractionsPresent[interaction.id] = present;
    }
  }

  const tier1ConceptCoverage = [];
  const gaps = [];

  for (const framework of pedagogyProfile.tier1Frameworks || []) {
    const conceptHay = blocks
      .filter((b) => conceptMentioned(haystackForBlock(b), framework))
      .map((b) => haystackForBlock(b))
      .join(" ");

    const mentionCount = (framework.matchTerms || []).reduce((n, term) => {
      const t = normalizeText(term);
      if (!t) return n;
      const matches = fullLessonHay.split(t).length - 1;
      return n + Math.max(0, matches);
    }, 0);

    const phases = {
      structure: phaseHitsInHaystack(conceptHay || fullLessonHay, "structure") && conceptMentioned(fullLessonHay, framework),
      adaptation: phaseHitsInHaystack(conceptHay, "adaptation") || (framework.conceptId === "myelin_sheath" && /insulat|saltatory|myelin/i.test(conceptHay || fullLessonHay)),
      function: phaseHitsInHaystack(conceptHay, "function") || /speed|transmit|impulse/i.test(conceptHay),
      exam: phaseHitsInHaystack(fullLessonHay, "exam") || /explain how neurones/i.test(fullLessonHay),
    };

    const phasesComplete = Object.values(phases).filter(Boolean).length;
    tier1ConceptCoverage.push({
      conceptId: framework.conceptId,
      name: framework.name,
      mentionCount,
      phases,
      phasesComplete,
      complete: phasesComplete >= 3,
    });

    if (mentionCount >= 2 && phasesComplete < 3) {
      gaps.push(
        `${framework.name} appears ${mentionCount} times but is not consistently taught through structure → adaptation → function → exam.`
      );
    }
    if (framework.conceptId === "myelin_sheath" && mentionCount > 0 && !phases.adaptation) {
      gaps.push(
        "Myelin appears in the lesson but is not taught through adaptation → function (add insulating sheath + saltatory conduction reasoning)."
      );
    }
  }

  const checks = [
    structureBlocks > 0,
    adaptationBlocks > 0,
    functionBlocks > 0,
    examBlocks > 0 || /explain how neurones/i.test(fullLessonHay),
    requiredInteractionsPresent.interaction_a,
    requiredInteractionsPresent.interaction_b,
    requiredInteractionsPresent.interaction_c,
    tier1ConceptCoverage.filter((c) => c.complete).length >= 2,
  ];
  const pedagogyScorePct = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  if (pedagogyScorePct < 80) {
    gaps.push("Pedagogy coverage below 80% — add structure–function table, required interactions, and a 4-mark GCSE explain question.");
  }

  return {
    enabled: true,
    pedagogyScorePct,
    structureBlocks,
    adaptationBlocks,
    functionBlocks,
    examBlocks,
    requiredInteractionsPresent,
    tier1ConceptCoverage,
    gaps: [...new Set(gaps)],
    warnings: gaps,
    hasStructureFunctionTable: /\|.*structure.*\|/i.test(fullLessonHay) || /structure.*adaptation.*function/i.test(fullLessonHay),
    hasMandatoryExam: /explain how neurones are adapted/i.test(fullLessonHay),
  };
}

/**
 * @param {import("./biologyPedagogyProfiles").BiologyPedagogyProfile|null} pedagogyProfile
 */
function formatStructureFunctionPedagogyAppendix(pedagogyProfile) {
  if (!isPedagogyEngineEnabled() || !pedagogyProfile) return "";

  const framework = generateStructureFunctionFramework(pedagogyProfile);
  const interactions = generateRequiredInteractionSet(pedagogyProfile);
  const exams = generateExamApplicationPrompts(pedagogyProfile);

  const lines = [
    PEDAGOGY_MARKER,
    "Teach every major Tier 1 concept through: Structure → Adaptation → Function → Exam application.",
    "Do NOT use single-sentence fact drops (e.g. only \"Myelin speeds up impulses\").",
    "",
    framework.tableMarkdown,
    "",
    "REQUIRED INTERACTIONS (include all):",
  ];

  for (const i of interactions) {
    lines.push(`- ${i.title} (${i.blockType}): ${i.instructions}`);
    if (i.cards?.length) lines.push(`  Labels/cards: ${i.cards.join(", ")}.`);
    if (i.pairs?.length) lines.push(`  Example pairs: ${i.pairs.join("; ")}.`);
  }

  lines.push("", "MANDATORY EXAM BLOCK:");
  for (const e of exams) {
    lines.push(`- ${e.marks}-mark: ${e.question}`);
    lines.push(`  Model answer: ${e.modelAnswer}`);
  }

  lines.push(
    "",
    "Allocate the largest teaching and interaction time to neurone structure, axon, myelin sheath, dendrites and nerve endings."
  );

  return lines.join("\n");
}

/**
 * Enrich interaction replacement entry with pedagogy chain (non-destructive).
 * @param {object} entry
 * @param {import("./biologyPedagogyProfiles").BiologyPedagogyProfile|null} pedagogyProfile
 */
function enrichInteractionWithPedagogy(entry, pedagogyProfile) {
  if (!isPedagogyEngineEnabled() || !pedagogyProfile || !entry) return entry;

  const framework = (pedagogyProfile.tier1Frameworks || []).find(
    (f) =>
      f.conceptId === entry.replacementConceptId ||
      f.matchTerms?.some((t) => entry.replacementConceptId?.includes(t))
  );

  if (framework) {
    const enriched = {
      ...entry,
      pedagogyChain: {
        structure: framework.structure,
        adaptation: framework.adaptation,
        function: framework.function,
        examApplication: framework.examApplication,
      },
      instructions: `${entry.instructions} Teach using Structure → Adaptation → Function before assessment.`,
    };
    if (framework.conceptId === "myelin_sheath" && !enriched.checkpointPrompt) {
      enriched.checkpointPrompt =
        "Structure: Myelin is a fatty sheath around the axon. Adaptation: It insulates and allows saltatory conduction. Function: Increases impulse speed. Explain in 3–4 sentences.";
    }
    return enriched;
  }

  if (entry.replacementTemplateKey === "neurone_structure_drag_drop") {
    return {
      ...entry,
      instructions: `${entry.instructions} After labelling, link each part: structure → adaptation → function.`,
    };
  }

  if (entry.replacementTemplateKey === "myelin_speed_explanation") {
    return {
      ...entry,
      checkpointPrompt:
        "Structure: Myelin is a fatty sheath around the axon. Adaptation: It insulates and allows saltatory conduction. Function: Increases impulse speed. Explain in 3–4 sentences.",
    };
  }

  return entry;
}

/**
 * Optional suffix for concept priority appendix.
 * @param {import("./biologyPedagogyProfiles").BiologyPedagogyProfile|null} pedagogyProfile
 */
function pedagogyPriorityTeachingNote(pedagogyProfile) {
  if (!isPedagogyEngineEnabled() || !pedagogyProfile) return "";
  return "Apply structure → adaptation → function → exam sequencing to all Tier 1 priority concepts.";
}

/**
 * @param {object} options
 */
function buildPedagogyContext(options = {}) {
  const pedagogyProfile = resolvePedagogyProfile(options);
  return {
    enabled: isPedagogyEngineEnabled() && Boolean(pedagogyProfile),
    pedagogyProfile,
  };
}

module.exports = {
  isPedagogyEngineEnabled,
  resolvePedagogyProfile,
  generateStructureFunctionFramework,
  generateRequiredInteractionSet,
  generateExamApplicationPrompts,
  scorePedagogicalCoverage,
  formatStructureFunctionPedagogyAppendix,
  enrichInteractionWithPedagogy,
  pedagogyPriorityTeachingNote,
  buildPedagogyContext,
  PEDAGOGY_MARKER,
};
