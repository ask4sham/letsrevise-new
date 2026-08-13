/**
 * Topic-aware GCSE/IGCSE-style stem packs for activity question repair.
 * Prefer these over formulaic "{word} in {topic}" templates.
 */

function normalizeTopicKey(topic) {
  return String(topic || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Banned weak repair / AI filler patterns (activity stems). */
const WEAK_FORMULAIC_STEM_PATTERNS = [
  /^identify the role of .+\bin\b.+/i,
  /^which option correctly defines .+\bfor\b.+/i,
  /^a student says .+\balone completes\b.+/i,
  /^explain one important use of .+\bin medicine\b/i,
  /\buse of .+\bin medicine\b/i,
  /^(key idea|main comparison|main exam point)\b/i,
  /^what is the key idea (about|of)\b/i,
  /^what is the main comparison\b/i,
  /^what is the main exam point\b/i,
  /might be tested in an exam/i,
  /cause\s*(→|->|to)\s*effect chain best explains/i,
  /key factor in this process is missing/i,
  /later step in this process/i,
  /^which idea is most directly linked to this topic/i,
];

/**
 * True for formulaic topic-word substitution stems that feel template-made.
 * Medicine stems are allowed only when the stem itself mentions stem cells.
 */
function isWeakFormulaicStem(stem) {
  const raw = String(stem || "").trim();
  if (!raw) return false;
  if (/\bstem\s*cells?\b/i.test(raw) && /\bin medicine\b/i.test(raw)) {
    return WEAK_FORMULAIC_STEM_PATTERNS.filter((re) => !/medicine/i.test(String(re))).some((re) =>
      re.test(raw)
    );
  }
  return WEAK_FORMULAIC_STEM_PATTERNS.some((re) => re.test(raw));
}

function shortQ(prompt, answer, purpose, topicScope = "any") {
  return { prompt, answer, purpose, kind: "short", topicScope };
}

function mcqQ(prompt, correct, distractors, purpose, topicScope = "any") {
  return { prompt, correct, distractors, purpose, kind: "mcq", topicScope };
}

const PACK_GAMETES_FERTILISATION = {
  id: "gametes-fertilisation",
  match(n) {
    return (
      (/\bgametes?\b/.test(n) && /\bfertilis/.test(n)) ||
      /\bgametes?\s+and\s+fertilis/.test(n) ||
      n === "gametes fertilisation"
    );
  },
  short: [
    shortQ("Which process produces gametes?", "Meiosis produces gametes (haploid sex cells).", "recall"),
    shortQ(
      "Why must gametes contain half the normal number of chromosomes?",
      "So fertilisation restores the full diploid chromosome number in the zygote.",
      "explain"
    ),
    shortQ(
      "A student says fertilisation produces gametes. Explain why this is incorrect.",
      "Meiosis produces gametes; fertilisation is the fusion of gamete nuclei to form a zygote.",
      "misconception"
    ),
    shortQ(
      "Describe what happens when the nucleus of a sperm cell fuses with the nucleus of an egg cell.",
      "The haploid nuclei fuse to form a diploid zygote (fertilisation).",
      "definition"
    ),
    shortQ(
      "Explain why meiosis must happen before fertilisation.",
      "Meiosis halves the chromosome number so fusion does not double it each generation.",
      "explain"
    ),
    shortQ(
      "A zygote has the full chromosome number. Explain how fertilisation restores this number.",
      "Two haploid nuclei fuse, combining their chromosomes to make a diploid zygote.",
      "exam_style"
    ),
    shortQ(
      "Compare a gamete with a normal body cell: state one clear difference.",
      "A gamete is haploid; a typical body cell is diploid (or: gametes are sex cells).",
      "comparison"
    ),
    shortQ(
      "Put these events in order: meiosis, gamete formation, fertilisation, zygote formation.",
      "Meiosis → gamete formation → fertilisation → zygote formation.",
      "sequence"
    ),
    shortQ(
      "Suggest what would happen if sperm and egg nuclei did not fuse.",
      "A diploid zygote would not form; development of a new organism would not start normally.",
      "application"
    ),
  ],
  mcq: [
    mcqQ(
      "What is a gamete?",
      "A sex cell with half the normal chromosome number",
      [
        "A diploid body cell",
        "A cell that only divides by mitosis",
        "A zygote after fertilisation",
      ],
      "recall"
    ),
    mcqQ(
      "Which statement is incorrect about fertilisation?",
      "Fertilisation produces gametes by meiosis",
      [
        "Fertilisation is fusion of gamete nuclei",
        "Fertilisation forms a zygote",
        "Fertilisation restores the diploid chromosome number",
      ],
      "misconception"
    ),
    mcqQ(
      "How is a gamete different from a normal body cell?",
      "It usually has half the chromosome number",
      [
        "It always has twice the chromosome number",
        "It cannot contain DNA",
        "It is identical to a zygote",
      ],
      "comparison"
    ),
    mcqQ(
      "Which sequence is correct?",
      "Meiosis → gametes → fertilisation → zygote",
      [
        "Fertilisation → meiosis → gametes → zygote",
        "Zygote → fertilisation → meiosis → gametes",
        "Mitosis only → zygote → gametes",
      ],
      "sequence"
    ),
    mcqQ(
      "Explain why sexual reproduction produces genetic variation — which idea is most accurate?",
      "Gametes from two parents fuse, combining different alleles",
      [
        "Offspring are always clones of one parent",
        "No chromosomes are involved",
        "Only mitosis occurs in gamete formation",
      ],
      "exam_style"
    ),
    mcqQ(
      "Why is meiosis needed before fertilisation?",
      "To halve the chromosome number in gametes",
      [
        "To double the chromosome number in gametes",
        "To destroy DNA in the zygote",
        "To prevent nuclei from fusing",
      ],
      "explain"
    ),
    mcqQ(
      "If an egg cell were diploid instead of haploid, what is the most likely effect after fertilisation?",
      "The zygote would have too many chromosomes",
      [
        "Fertilisation could not involve a sperm nucleus",
        "The chromosome number would always be correct",
        "Meiosis would become unnecessary in every species",
      ],
      "application"
    ),
    mcqQ(
      "Which option best defines fertilisation in animals?",
      "Fusion of the nuclei of male and female gametes",
      [
        "Division of a zygote into gametes",
        "Production of sperm by mitosis only",
        "Growth of an embryo without nuclei",
      ],
      "definition"
    ),
  ],
};

const PACK_SEXUAL_ASEXUAL = {
  id: "sexual-asexual-reproduction",
  match(n) {
    return (
      (/\bsexual\b/.test(n) && /\basexual\b/.test(n)) ||
      /\bsexual\s+and\s+asexual\b/.test(n) ||
      /\breproduction\b/.test(n) && /\basexual\b/.test(n) && /\bsexual\b/.test(n)
    );
  },
  short: [
    shortQ(
      "Which type of cell division produces gametes?",
      "Meiosis produces gametes for sexual reproduction.",
      "recall"
    ),
    shortQ(
      "Explain why offspring from asexual reproduction are usually genetically identical.",
      "They are produced by mitosis from one parent, so DNA is copied without combining two genomes.",
      "explain"
    ),
    shortQ(
      "Compare the number of parents involved in sexual and asexual reproduction.",
      "Sexual usually involves two parents; asexual involves one parent.",
      "comparison"
    ),
    shortQ(
      "A population reproduces asexually. Suggest one advantage and one disadvantage.",
      "Advantage: fast / no mate needed. Disadvantage: little variation / shared vulnerability to change.",
      "application"
    ),
    shortQ(
      "Explain why sexual reproduction can increase variation in a population.",
      "Fusion of gametes from two parents mixes alleles; meiosis also shuffles alleles.",
      "exam_style"
    ),
    shortQ(
      "A student says asexual reproduction always needs two parents. Explain why this is incorrect.",
      "Asexual reproduction involves one parent; offspring arise without gamete fusion.",
      "misconception"
    ),
    shortQ(
      "Define asexual reproduction.",
      "Reproduction involving one parent that produces genetically identical offspring (clones), usually by mitosis.",
      "definition"
    ),
    shortQ(
      "Put these ideas in a sensible order for sexual reproduction: meiosis, gametes, fertilisation, offspring.",
      "Meiosis → gametes → fertilisation → offspring.",
      "sequence"
    ),
  ],
  mcq: [
    mcqQ(
      "Which division forms gametes for sexual reproduction?",
      "Meiosis",
      ["Mitosis only", "Binary fission only", "Budding only"],
      "recall"
    ),
    mcqQ(
      "Which statement is incorrect about asexual reproduction?",
      "It usually requires fertilisation of two gametes",
      [
        "It usually involves one parent",
        "Offspring are often genetically identical",
        "It can be rapid in stable conditions",
      ],
      "misconception"
    ),
    mcqQ(
      "How do sexual and asexual reproduction differ in parent number?",
      "Sexual usually needs two parents; asexual needs one",
      [
        "Both always need two parents",
        "Both always need one parent",
        "Asexual always needs fertilisation",
      ],
      "comparison"
    ),
    mcqQ(
      "Why can sexual reproduction increase variation?",
      "Alleles from two parents combine in offspring",
      [
        "Offspring are always clones",
        "No DNA is involved",
        "Only mitosis forms gametes",
      ],
      "exam_style"
    ),
    mcqQ(
      "A species reproduces only asexually in a changing environment. What is a likely disadvantage?",
      "Little genetic variation to survive new conditions",
      [
        "Too much variation every generation",
        "Fertilisation always fails",
        "Meiosis becomes too frequent",
      ],
      "application"
    ),
    mcqQ(
      "Which sequence matches sexual reproduction?",
      "Meiosis → gametes → fertilisation → offspring",
      [
        "Fertilisation → meiosis → one parent clone",
        "Budding → fertilisation → meiosis",
        "Zygote → asexual fission → gametes",
      ],
      "sequence"
    ),
    mcqQ(
      "What is meant by sexual reproduction?",
      "Reproduction involving fusion of male and female gametes",
      [
        "Reproduction from one parent by mitosis only",
        "Reproduction without any cell division",
        "Growth of a plant without DNA",
      ],
      "definition"
    ),
    mcqQ(
      "Why are asexual offspring usually genetically identical to the parent?",
      "They are produced by mitosis from one parent",
      [
        "Two different gametes always fuse",
        "Meiosis mixes alleles every time",
        "Chromosomes are discarded",
      ],
      "explain"
    ),
  ],
};

const PACK_MITOSIS = {
  id: "mitosis",
  match(n) {
    return (/\bmitosis\b/.test(n) || /\bcell cycle\b/.test(n)) && !/\bmeiosis\b/.test(n);
  },
  short: [
    shortQ("Why is mitosis important for growth?", "It produces genetically identical diploid cells for growth and repair.", "explain", "mitosis"),
    shortQ("Define mitosis.", "Cell division that produces two genetically identical diploid daughter cells.", "definition", "mitosis"),
    shortQ("Why are daughter cells genetically identical after mitosis?", "Chromosomes are duplicated then divided equally between the two daughter cells.", "explain", "mitosis"),
    shortQ("Why are chromosomes copied before mitosis?", "So each daughter cell receives a full set of identical genetic information.", "explain", "mitosis"),
    shortQ("What happens during interphase before mitosis?", "The cell grows and DNA/chromosomes replicate.", "recall", "mitosis"),
    shortQ("State the role of cytokinesis.", "Division of the cytoplasm to form two separate daughter cells.", "definition", "mitosis"),
    shortQ("A student says mitosis produces gametes. Explain why this is incorrect.", "Mitosis produces genetically identical body cells; meiosis produces gametes.", "misconception", "both"),
    shortQ("State one key difference between mitosis and meiosis.", "Mitosis keeps chromosome number; meiosis halves it (and forms gametes).", "comparison", "both"),
  ],
  mcq: [
    mcqQ("Why are daughter cells genetically identical after mitosis?", "Chromosomes duplicate then separate equally", ["Gametes fuse at fertilisation", "Meiosis halves chromosome number", "DNA is destroyed before division"], "explain", "mitosis"),
    mcqQ("Why is mitosis important for growth?", "It produces genetically identical cells", ["It halves chromosome number", "It forms haploid gametes", "It only happens in gametes"], "explain", "mitosis"),
    mcqQ("Why are chromosomes copied before mitosis?", "So each daughter cell gets a full identical set", ["To halve chromosome number", "To form a zygote", "To produce variation"], "explain", "mitosis"),
    mcqQ("How many genetically identical daughter cells does mitosis produce?", "Two", ["One", "Four", "None"], "recall", "mitosis"),
    mcqQ("Why is mitosis used for repair?", "It makes genetically identical cells to replace damaged ones", ["It halves chromosomes every time", "It fuses gametes", "It removes all DNA"], "explain", "mitosis"),
    mcqQ("Which statement is incorrect?", "Mitosis halves chromosome number to form gametes", ["Mitosis produces identical diploid cells", "Mitosis is used for growth", "Mitosis is used for repair"], "misconception", "mitosis"),
    mcqQ("How do mitosis and meiosis differ?", "Meiosis halves chromosome number; mitosis keeps it", ["Both always halve chromosome number", "Both never copy DNA", "Mitosis only happens in gametes"], "comparison", "both"),
  ],
};

const PACK_MEIOSIS = {
  id: "meiosis",
  match(n) {
    return /\bmeiosis\b/.test(n);
  },
  short: [
    shortQ("What is the chromosome number outcome of meiosis?", "Haploid daughter cells (half the original number).", "recall", "meiosis"),
    shortQ("Explain why meiosis is needed for sexual reproduction.", "It halves chromosome number so fertilisation restores the diploid number.", "exam_style", "meiosis"),
    shortQ("Why must gametes be haploid before fertilisation?", "So fusion produces a diploid zygote with the species' normal chromosome number, not a doubled set.", "explain", "meiosis"),
    shortQ("Put in order for gamete production: DNA replication, meiosis, haploid gametes.", "DNA replication → meiosis → haploid gametes.", "sequence", "meiosis"),
    shortQ("Suggest what would happen if body cells only divided by meiosis.", "Chromosome number would keep falling; tissues would not maintain diploid cells.", "application", "meiosis"),
    shortQ("A student says meiosis produces identical body cells for growth. Explain why this is incorrect.", "Meiosis produces haploid gametes; mitosis produces identical body cells.", "misconception", "both"),
  ],
  mcq: [
    mcqQ("Which division halves the chromosome number?", "Meiosis", ["Mitosis", "Binary fission only", "Budding only"], "recall", "meiosis"),
    mcqQ("Why must gametes be haploid before fertilisation?", "So fertilisation restores the diploid number without doubling each generation", ["So mitosis can produce clones", "So DNA is destroyed", "So variation never occurs"], "explain", "meiosis"),
    mcqQ("If meiosis failed to occur before fertilisation, what is most likely?", "Zygotes would have too many chromosomes", ["No DNA would exist", "Only clones could form by fertilisation", "Mitosis would stop forever"], "application", "meiosis"),
    mcqQ("Which sequence is correct for sexual reproduction?", "Meiosis → gametes → fertilisation", ["Fertilisation → meiosis → identical clones only", "Mitosis → zygote → gametes by budding", "Meiosis → diploid body clone → no fertilisation"], "sequence", "meiosis"),
    mcqQ("What is meiosis?", "Division producing haploid gametes", ["Division producing only identical diploid clones", "Fusion of sperm and egg", "Growth without cell division"], "definition", "meiosis"),
    mcqQ("Which answer earns a mark for explaining meiosis?", "It halves chromosome number so fertilisation does not double it each generation", ["Just writing the word meiosis", "Saying cells get bigger only", "Naming mitosis with no link"], "exam_style", "meiosis"),
    mcqQ("Which statement is incorrect?", "Meiosis produces two identical diploid body cells for growth", ["Mitosis produces identical diploid cells", "Meiosis produces haploid gametes", "Fertilisation restores diploid number"], "misconception", "both"),
  ],
};

const PACK_PLANT_TRANSPORT = {
  id: "plant-transport",
  match(n) {
    return (
      /\bplant transport\b/.test(n) ||
      /\bxylem\b/.test(n) ||
      /\bphloem\b/.test(n) ||
      /\btranspiration\b/.test(n) ||
      (/\btransport\b/.test(n) && /\bplant\b/.test(n))
    );
  },
  short: [
    shortQ("State what xylem transports.", "Water and mineral ions (up the plant).", "recall"),
    shortQ("Explain why phloem is needed in a plant.", "It translocates sugars (sucrose) from sources to sinks.", "explain"),
    shortQ("A student says xylem carries sugars around the plant. Explain why this is incorrect.", "Xylem transports water/minerals; phloem transports sugars.", "misconception"),
    shortQ("Compare xylem and phloem transport.", "Xylem: water/minerals (mainly up); phloem: sugars (source to sink).", "comparison"),
    shortQ("Define transpiration.", "Loss of water vapour from leaves (mainly via stomata).", "definition"),
    shortQ("Suggest how closing stomata can affect water loss.", "Reduced stomatal opening lowers transpiration / water loss.", "application"),
    shortQ("Explain one reason transport systems matter in plants.", "They move water, minerals and sugars between roots, leaves and growing regions.", "exam_style"),
    shortQ("Put in order: root uptake, xylem transport, transpiration from leaves.", "Root uptake → xylem transport → transpiration from leaves.", "sequence"),
  ],
  mcq: [
    mcqQ("What does xylem mainly transport?", "Water and mineral ions", ["Sugars only", "Oxygen only", "Protein hormones only"], "recall"),
    mcqQ("Which statement is incorrect?", "Xylem transports sugars from leaves to roots", ["Phloem transports sugars", "Xylem transports water", "Transpiration is water loss from leaves"], "misconception"),
    mcqQ("How do xylem and phloem differ?", "Xylem moves water/minerals; phloem moves sugars", ["Both only move oxygen", "Neither is a living tissue system in plants", "Phloem only moves water upwards"], "comparison"),
    mcqQ("Why does transpiration matter?", "It helps pull water up through xylem", ["It produces sugars in roots", "It stops all photosynthesis", "It removes xylem vessels"], "explain"),
    mcqQ("If stomata stay closed on a hot day, what is most likely?", "Transpiration rate falls", ["Sugar transport in phloem must stop forever", "Roots stop existing", "Xylem starts carrying only sugar"], "application"),
    mcqQ("Which sequence is sensible for water?", "Root uptake → xylem → leaves → transpiration", ["Transpiration → phloem sugars → root uptake only", "Phloem → xylem water down only → stomata", "Sugars → xylem → fertilisation"], "sequence"),
    mcqQ("What is phloem specialised for?", "Translocation of sugars", ["Absorbing only mineral ions from soil air", "Producing gametes", "Photosynthesis in roots only"], "definition"),
    mcqQ("Which answer best explains plant transport for an exam mark?", "Xylem moves water up; phloem moves sugars from source to sink", ["Just naming the word xylem", "Saying plants have no transport", "Claiming only animals need transport"], "exam_style"),
  ],
};

const TOPIC_PACKS = [
  PACK_GAMETES_FERTILISATION,
  PACK_SEXUAL_ASEXUAL,
  PACK_MEIOSIS,
  PACK_MITOSIS,
  PACK_PLANT_TRANSPORT,
];

function resolveTopicPack(topic) {
  const n = normalizeTopicKey(topic);
  if (!n) return null;
  for (const pack of TOPIC_PACKS) {
    if (pack.match(n)) return pack;
  }
  return null;
}

/**
 * Improved generic exam-style fallbacks (no "{word} in {topic}" / "defines X for Y").
 */
function genericShortCatalog(topic) {
  const label = String(topic || "").trim() || "this process";
  return {
    recall: shortQ(
      "State one key term linked to this topic.",
      `Name a precise term used when explaining ${label}.`,
      "recall"
    ),
    definition: shortQ(
      "What is meant by this process in biology?",
      `Give a clear definition of ${label}.`,
      "definition"
    ),
    misconception: shortQ(
      "A student gives an incorrect explanation of this process. Identify the mistake.",
      `State the error and the correct idea for ${label}.`,
      "misconception"
    ),
    explain: shortQ(
      "Explain one reason why this process is important.",
      `Link a mechanism in ${label} to a clear outcome.`,
      "explain"
    ),
    application: shortQ(
      "Suggest how a change in conditions could affect this process.",
      `Describe a cause → effect change linked to ${label}.`,
      "application"
    ),
    comparison: shortQ(
      "Compare two features linked to this topic.",
      `State one clear difference between two ideas in ${label}.`,
      "comparison"
    ),
    exam_style: shortQ(
      "Explain one idea examiners credit for this topic.",
      `Use because → therefore for ${label}, not a lone keyword.`,
      "exam_style"
    ),
    sequence: shortQ(
      "Describe the order of the main steps in this process.",
      `Place the steps of ${label} in a sensible sequence.`,
      "sequence"
    ),
    evaluate: shortQ(
      "Which part of an explanation of this process is weakest if it only names a word?",
      `A keyword alone is not enough; link it to mechanism and outcome in ${label}.`,
      "evaluate"
    ),
    calculate: shortQ(
      "State one measurable change you could refer to when discussing this process.",
      `Name a quantity or observable change linked to ${label}.`,
      "calculate"
    ),
  };
}

function genericMcqCatalog(topic, vocabTerms) {
  const label = String(topic || "").trim() || "this process";
  const terms = (vocabTerms || []).map((t) => String(t || "").trim()).filter(Boolean);
  const a = terms[0] || "a key structure";
  const b = terms[1] || "a related idea";
  const c = terms[2] || "an outcome";
  return {
    recall: mcqQ(
      `Which term is a key structure or idea in ${label}?`,
      a,
      [b, c, "An unrelated idea outside this topic"],
      "recall"
    ),
    definition: mcqQ(
      "Which option best matches a correct definition for this topic?",
      `A precise meaning of ${a} within this process`,
      [
        `A vague claim that ${label} just happens`,
        `An unrelated definition of ${b}`,
        `Saying ${c} with no meaning`,
      ],
      "definition"
    ),
    misconception: mcqQ(
      "Which statement shows a common misconception about this process?",
      `${a} alone is the complete explanation of the whole process`,
      [
        `${a} is one part of a larger mechanism`,
        `${b} can contribute to the process`,
        `Outcomes depend on more than one factor`,
      ],
      "misconception"
    ),
    application: mcqQ(
      "Suggest how a change in conditions could affect this process.",
      "The expected outcome is disrupted or altered",
      [
        "Nothing changes at all",
        "The process always speeds up with no downside",
        "Every other factor becomes irrelevant forever",
      ],
      "application"
    ),
    comparison: mcqQ(
      "How do two linked features in this topic usually differ?",
      "They have different roles in the sequence",
      [
        "They are identical in every way",
        "Neither is ever involved",
        "Only one word can ever be used",
      ],
      "comparison"
    ),
    explain: mcqQ(
      "Explain one reason why this process is biologically important.",
      "An earlier step enables a later outcome in living organisms",
      [
        "It is decorative only",
        "It never links to an outcome",
        "No mechanism is needed",
      ],
      "explain"
    ),
    sequence: mcqQ(
      "Which comes earlier in a typical sequence for this process?",
      a,
      [c, "Neither belongs in the process", "Only the final outcome with no prior step"],
      "sequence"
    ),
    exam_style: mcqQ(
      "Which answer would earn a mark for explaining this process (not just naming a word)?",
      `A because → therefore link involving ${a}`,
      [
        `The single word ${a} with no mechanism`,
        `A vague claim that the process happens`,
        `An unrelated definition of ${b}`,
      ],
      "exam_style"
    ),
    evaluate: mcqQ(
      "Which claim about this process is weakest for an exam answer?",
      `Just writing the word ${a} without linking it to an outcome`,
      [
        `Linking ${a} to a clear mechanism`,
        `Comparing ${a} and ${b} with a difference`,
        `Explaining why a misconception is wrong`,
      ],
      "evaluate"
    ),
  };
}

/**
 * Extra rotated short stems when packs/generics need more unique prompts.
 */
function genericShortExtras(topic, vocabTerms) {
  const label = String(topic || "").trim() || "this process";
  const terms = (vocabTerms || []).map((t) => String(t || "").trim()).filter(Boolean);
  const out = [];
  const templates = [
    (t) => shortQ(`State one accurate fact about ${t}.`, `${t} is involved in ${label}; state its role precisely.`, "recall"),
    (t) =>
      shortQ(
        `Which common error about ${t} should you avoid? Explain briefly.`,
        `Avoid treating ${t} as the whole of ${label} without mechanism.`,
        "misconception"
      ),
    (t) =>
      shortQ(
        `Why must ${t} be linked to an outcome in an exam answer?`,
        `Exam answers need because → therefore, not a label alone.`,
        "explain"
      ),
    (t) =>
      shortQ(
        `Suggest one way ${t} could be tested or observed in this topic.`,
        `Link ${t} to a practical or exam-style observation for ${label}.`,
        "application"
      ),
  ];
  for (let i = 0; i < terms.length; i++) {
    out.push(templates[i % templates.length](terms[i]));
  }
  out.push(
    shortQ(
      "Outline one cause-and-effect link in this topic.",
      `State a cause and its effect in ${label}.`,
      "explain"
    ),
    shortQ(
      "Name two ideas in this topic and say how they connect.",
      `Show a clear link between two features of ${label}.`,
      "comparison"
    )
  );
  return out;
}

function genericMcqExtras(topic, vocabTerms) {
  const label = String(topic || "").trim() || "this process";
  const terms = (vocabTerms || []).map((t) => String(t || "").trim()).filter(Boolean);
  const out = [];
  // Distinct recall/definition openings so checkpoint repair does not exhaust the only quiz stems.
  out.push(
    mcqQ(
      `Name the role most closely associated with ${terms[0] || "a key structure"} in this topic.`,
      terms[0] || "a key structure",
      [terms[1] || "an unrelated label", terms[2] || "a random outcome", "Something outside biology"],
      "recall"
    ),
    mcqQ(
      `Identify one accurate fact examiners expect about ${label}.`,
      `A precise fact involving ${terms[0] || "a key structure"}`,
      [
        "A vague claim with no biological mechanism",
        "An unrelated idea from another topic",
        "A single keyword with no meaning",
      ],
      "recall"
    ),
    mcqQ(
      `What is the best short definition of ${terms[0] || "the key idea"} in this topic?`,
      `A clear meaning of ${terms[0] || "the key idea"} within ${label}`,
      [
        `A vague claim that ${label} just happens`,
        `An unrelated definition of ${terms[1] || "another idea"}`,
        "A keyword with no meaning attached",
      ],
      "definition"
    ),
    mcqQ(
      `Which sentence correctly states what ${terms[1] || "a linked idea"} means here?`,
      `A precise meaning of ${terms[1] || "a linked idea"} in ${label}`,
      [
        "An everyday guess with no biology",
        "A definition copied from an unrelated topic",
        "Only naming the word with no meaning",
      ],
      "definition"
    )
  );
  const openings = [
    (t) =>
      mcqQ(
        `Where does ${t} fit in a sensible sequence for this topic?`,
        t,
        [`Unrelated to ${label}`, `Opposite of ${t}`, `Not part of this topic`],
        "sequence"
      ),
    (t) =>
      mcqQ(
        `How does ${t} change the outcome in this process?`,
        `${t} affects a later step in the mechanism`,
        [`${t} is never involved`, `${t} only happens after the outcome`, `${t} replaces the whole process`],
        "application"
      ),
    (t) =>
      mcqQ(
        `A student claims ${t} is unrelated to this topic. Which response is best?`,
        `${t} is linked to the mechanism of ${label}`,
        [`${t} should be ignored`, `${t} only belongs in chemistry`, `${t} means the process is finished`],
        "misconception"
      ),
    (t) =>
      mcqQ(
        `What is one precise difference between naming ${t} and explaining the process?`,
        `Explaining needs mechanism and outcome, not only the word ${t}`,
        [`Naming ${t} is always enough for full marks`, `${t} cannot be named in exams`, `Explanation never uses ${t}`],
        "comparison"
      ),
  ];
  for (let i = 0; i < terms.length; i++) {
    out.push(openings[i % openings.length](terms[i]));
  }
  return out;
}

module.exports = {
  WEAK_FORMULAIC_STEM_PATTERNS,
  isWeakFormulaicStem,
  normalizeTopicKey,
  resolveTopicPack,
  TOPIC_PACKS,
  genericShortCatalog,
  genericMcqCatalog,
  genericShortExtras,
  genericMcqExtras,
};
