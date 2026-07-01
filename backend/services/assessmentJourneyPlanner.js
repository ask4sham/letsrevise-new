/**
 * Universal Assessment Journey Planner — builds five assessment slots from topic spec records.
 * No per-topic hardcoded questions; synthesizes from spec fields + slot templates.
 */
const { hasRichSpecForAssessment } = require("./topicSpecification");

const SLOT_ORDER = ["checkpoint", "quickCheck", "selfCheck", "workedExample", "examPractice"];

const SLOT_META = {
  checkpoint: { skill: "recall", purpose: "Check one essential fact, structure, term, or process." },
  quickCheck: { skill: "explain", purpose: "Cause → effect or structure → function reasoning." },
  selfCheck: { skill: "apply", purpose: "Scenario, misconception correction, or applied example." },
  workedExample: { skill: "analyse", purpose: "Multi-step reasoning with marks and model answer." },
  examPractice: { skill: "exam-style", purpose: "Board-appropriate command word, marks, mark scheme." },
};

const BANNED_STEM_FRAGMENTS = [
  "which statement best explains a key idea",
  "which statement best matches this topic",
  "which option is most accurate",
  "a precise cause → effect explanation linked to the topic",
  "an unrelated process from another topic",
  "a common misconception stated as if it were true",
  "a vague name with no mechanism",
];

function titleCase(s) {
  return String(s || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickCommandWord(commandWords, preferred) {
  const words = Array.isArray(commandWords) ? commandWords : [];
  const lower = words.map((w) => w.toLowerCase());
  if (preferred && lower.includes(preferred.toLowerCase())) return preferred;
  return words[0] || preferred || "explain";
}

function buildConceptPool(topicSpec) {
  const pool = [];
  const structures = topicSpec.requiredStructures || [];
  const processes = topicSpec.requiredProcesses || [];
  const vocabulary = topicSpec.requiredVocabulary || topicSpec.requiredKeywords || [];
  const outcomes = topicSpec.learningOutcomes || [];
  const misconceptions = topicSpec.commonMisconceptions || topicSpec.requiredMisconceptions || [];
  const graphs = topicSpec.requiredGraphs || [];
  const calculations = topicSpec.requiredCalculations || [];
  const comparisons = topicSpec.requiredComparisons || [];
  const roles = topicSpec.structureRoles || {};

  structures.forEach((term, i) => {
    pool.push({
      id: `structure:${term}`,
      kind: "structure",
      term,
      role: roles[term] || roles[term.toLowerCase()] || "",
      index: i,
    });
  });

  processes.forEach((proc, i) => {
    pool.push({
      id: `process:${i}`,
      kind: "process",
      term: proc,
      index: i,
    });
  });

  vocabulary.forEach((term, i) => {
    pool.push({
      id: `vocab:${term}`,
      kind: "vocabulary",
      term,
      index: i,
    });
  });

  outcomes.forEach((out, i) => {
    pool.push({
      id: `outcome:${i}`,
      kind: "outcome",
      term: out,
      index: i,
    });
  });

  misconceptions.forEach((m, i) => {
    pool.push({
      id: `misconception:${i}`,
      kind: "misconception",
      term: m,
      index: i,
    });
  });

  graphs.forEach((g, i) => {
    pool.push({ id: `graph:${i}`, kind: "graph", term: g, index: i });
  });

  calculations.forEach((c, i) => {
    pool.push({ id: `calc:${i}`, kind: "calculation", term: c, index: i });
  });

  comparisons.forEach((c, i) => {
    pool.push({ id: `comparison:${i}`, kind: "comparison", term: c, index: i });
  });

  return pool;
}

function conceptForSlot(slot, pool, usedConceptIds, topicSpec) {
  if (slot === "quickCheck") {
    const structWithRole = pool.find(
      (c) => c.kind === "structure" && c.role && !usedConceptIds.has(c.id)
    );
    if (structWithRole) return structWithRole;
  }

  const priority = {
    checkpoint: ["structure", "vocabulary", "outcome", "process"],
    quickCheck: ["process", "structure", "graph", "outcome"],
    selfCheck: ["misconception", "calculation", "process", "structure"],
    workedExample: ["process", "outcome", "structure", "graph"],
    examPractice: ["comparison", "outcome", "process", "structure"],
  }[slot];

  for (const kind of priority) {
    const candidate = pool.find((c) => c.kind === kind && !usedConceptIds.has(c.id));
    if (candidate) return candidate;
  }
  return pool.find((c) => !usedConceptIds.has(c.id)) || pool[0] || null;
}

function mcqDistractors(correct, topicSpec, concept) {
  const vocab = (topicSpec.requiredVocabulary || []).filter(
    (v) => v.toLowerCase() !== String(correct).toLowerCase()
  );
  const structures = (topicSpec.requiredStructures || []).filter(
    (s) => s.toLowerCase() !== String(correct).toLowerCase()
  );
  const wrong = [...vocab, ...structures].slice(0, 3);
  while (wrong.length < 3) {
    wrong.push(`Incorrect detail about ${concept.term || "the topic"}`);
  }
  const options = [correct, ...wrong.slice(0, 3)];
  return options;
}

function buildExemplar(slot, concept, topicSpec, topicLabel) {
  const cmd = topicSpec.commandWords || [];
  const label = topicLabel || titleCase(topicSpec.topicKey);

  if (topicSpec.assessmentJourney?.[slot]) {
    const curated = topicSpec.assessmentJourney[slot];
    return {
      question: curated.question,
      answer: curated.answer || curated.correctAnswer || "",
      options: curated.options || [],
      questionType: curated.questionType || (curated.options?.length ? "mcq" : "short"),
      marks: curated.marks,
      markScheme: curated.markScheme || [],
      modelAnswer: curated.modelAnswer || curated.answer || "",
    };
  }

  if (!concept) {
    return {
      question: `State one key fact about ${label}.`,
      answer: `A specific fact about ${label}.`,
      questionType: "short",
      options: [],
    };
  }

  switch (slot) {
    case "checkpoint": {
      if (concept.kind === "structure") {
        const role = concept.role || "";
        let q;
        if (/^produces\b/i.test(role)) {
          q = `Which structure ${role}?`;
        } else if (role) {
          q = `Which structure ${role}?`;
        } else {
          q = `Which structure is essential for ${label}?`;
        }
        const answer = titleCase(concept.term);
        return {
          question: q,
          answer,
          options: mcqDistractors(answer, topicSpec, concept),
          questionType: "mcq",
        };
      }
      if (concept.kind === "vocabulary") {
        const answer = titleCase(concept.term);
        return {
          question: `What is the role of ${answer} in ${label}?`,
          answer: `It is essential for ${label.toLowerCase()}.`,
          options: mcqDistractors(answer, topicSpec, concept),
          questionType: "mcq",
        };
      }
      return {
        question: `State one essential fact about ${concept.term || label}.`,
        answer: String(concept.term || concept.term),
        questionType: "short",
        options: [],
      };
    }

    case "quickCheck": {
      if (concept.kind === "structure" && concept.role) {
        return {
          question: `Explain why the ${concept.term} ${concept.role.includes("cilia") ? "is lined with cilia" : concept.role}.`,
          answer: concept.role,
          questionType: "short",
          options: [],
        };
      }
      if (concept.kind === "process") {
        return {
          question: `Explain how ${concept.term.charAt(0).toLowerCase() + concept.term.slice(1)}.`,
          answer: `Use a because → therefore chain for ${label}.`,
          questionType: "short",
          options: [],
        };
      }
      if (concept.kind === "graph") {
        return {
          question: `Describe the pattern shown in data about ${concept.term}.`,
          answer: `Link the graph trend to ${label} using cause → effect.`,
          questionType: "short",
          options: [],
        };
      }
      return {
        question: `Explain why ${concept.term || label} is important.`,
        answer: `Because it affects how ${label} works in the body.`,
        questionType: "short",
        options: [],
      };
    }

    case "selfCheck": {
      if (concept.kind === "misconception") {
        const misc = concept.term;
        const studentSays = misc.replace(/^students?\s+(often|may|think|say)\s+/i, "").trim();
        const vocab = (topicSpec.requiredVocabulary || []).slice(0, 3);
        const vocabPhrase = vocab.length ? vocab.join(", ") : label;
        return {
          question: `A student says ${studentSays.endsWith(".") ? studentSays : `${studentSays}.`} Explain why this is incorrect.`,
          answer: `Use precise terms such as ${vocabPhrase} to correct the misconception and explain the mechanism.`,
          questionType: "short",
          options: [],
        };
      }
      if (concept.kind === "calculation") {
        return {
          question: `Work through this ${label} calculation: ${concept.term}`,
          answer: `Show working and units for full marks.`,
          questionType: "short",
          options: [],
        };
      }
      return {
        question: `Apply your knowledge of ${label}: ${concept.term || "give a worked scenario"}.`,
        answer: `Use because → therefore with topic-specific terms.`,
        questionType: "short",
        options: [],
      };
    }

    case "workedExample": {
      const marks = 3;
      if (concept.kind === "process") {
        return {
          question: `${pickCommandWord(cmd, "Explain")} ${concept.term} (${marks} marks)`,
          modelAnswer: `1. Identify the key step.\n2. Explain because → therefore.\n3. State the outcome for ${label}.`,
          answer: `1. Identify the key step.\n2. Explain because → therefore.\n3. State the outcome for ${label}.`,
          questionType: "short",
          marks,
          options: [],
        };
      }
      const likely = (topicSpec.likelyExamQuestions || [])[0];
      if (likely && /explain|describe/i.test(likely)) {
        return {
          question: likely.match(/\(\d+ marks?\)/i)
            ? likely
            : `${likely.replace(/\.$/, "")} (${marks} marks)`,
          modelAnswer: `Model answer with labelled steps and ${label} terminology.`,
          answer: `Model answer with labelled steps and ${label} terminology.`,
          questionType: "short",
          marks,
          options: [],
        };
      }
      return {
        question: `${pickCommandWord(cmd, "Explain")} a key process in ${label} (${marks} marks)`,
        modelAnswer: `Step 1: Name the process.\nStep 2: Explain mechanism.\nStep 3: State outcome.`,
        answer: `Step 1: Name the process.\nStep 2: Explain mechanism.\nStep 3: State outcome.`,
        questionType: "short",
        marks,
        options: [],
      };
    }

    case "examPractice": {
      const marks = 4;
      const likely = (topicSpec.likelyExamQuestions || []).find((q) =>
        /compare|evaluate|analyse|analyze/i.test(q)
      );
      if (likely) {
        return {
          question: likely.match(/\(\d+ marks?\)/i)
            ? likely
            : `${likely.replace(/\.$/, "")} (${marks} marks)`,
          markScheme: [
            "1 mark per valid point comparing structures/functions",
            "Link comparisons to exam command word",
          ],
          modelAnswer: `Full-mark comparison using ${label} vocabulary.`,
          questionType: "short",
          marks,
          options: [],
        };
      }
      if (concept.kind === "comparison" || topicSpec.requiredStructures?.length >= 2) {
        const a = titleCase(topicSpec.requiredStructures[0]);
        const b = titleCase(topicSpec.requiredStructures[1] || "related structure");
        return {
          question: `Compare the functions of ${a} and ${b}. (${marks} marks)`,
          markScheme: [
            `State function of ${a}`,
            `State function of ${b}`,
            "Compare similarities/differences",
            "Use precise terminology",
          ],
          modelAnswer: `Compare structure → function for both.`,
          questionType: "short",
          marks,
          options: [],
        };
      }
      return {
        question: `${pickCommandWord(cmd, "Describe")} ${label} for an exam answer (${marks} marks)`,
        markScheme: ["Point 1", "Point 2", "Point 3", "Point 4"],
        modelAnswer: `Exam-style response for ${label}.`,
        questionType: "short",
        marks,
        options: [],
      };
    }

    default:
      return { question: "", answer: "", questionType: "short", options: [] };
  }
}

/**
 * @returns {{ plan: Array, topicSpec, thinCoverage: boolean }}
 */
function planAssessmentJourney(input = {}) {
  const topicSpec = input.topicSpec || {};
  const topicLabel = input.topic || topicSpec.topicTitle || titleCase(input.topicKey);
  const pool = buildConceptPool(topicSpec);
  const usedConceptIds = new Set();
  const usedSkillConcept = new Set();

  const plan = SLOT_ORDER.map((slot) => {
    const meta = SLOT_META[slot];
    let concept = conceptForSlot(slot, pool, usedConceptIds, topicSpec);
    if (concept) {
      let key = `${concept.id}::${meta.skill}`;
      if (usedSkillConcept.has(key)) {
        concept = pool.find((c) => !usedConceptIds.has(c.id)) || concept;
        key = `${concept?.id}::${meta.skill}`;
      }
      if (concept) {
        usedConceptIds.add(concept.id);
        usedSkillConcept.add(key);
      }
    }

    const exemplar = buildExemplar(slot, concept, topicSpec, topicLabel);

    return {
      slot,
      skill: meta.skill,
      purpose: meta.purpose,
      concept: concept?.id || concept?.term || topicLabel,
      conceptKind: concept?.kind || "topic",
      exemplar,
    };
  });

  return {
    plan,
    topicSpec,
    thinCoverage: !hasRichSpecForAssessment(topicSpec),
    topicLabel,
  };
}

function buildAssessmentJourneyPromptSection(journey) {
  const lines = [
    "ASSESSMENT JOURNEY (mandatory — do not use generic placeholder stems):",
    `BANNED stems: ${BANNED_STEM_FRAGMENTS.join("; ")}`,
  ];
  for (const item of journey.plan || []) {
    lines.push(
      `- ${item.slot} (${item.skill}): ${item.exemplar?.question || ""}`.trim()
    );
  }
  return lines.join("\n");
}

module.exports = {
  planAssessmentJourney,
  buildAssessmentJourneyPromptSection,
  buildExemplar,
  buildConceptPool,
  SLOT_ORDER,
  SLOT_META,
  BANNED_STEM_FRAGMENTS,
};
