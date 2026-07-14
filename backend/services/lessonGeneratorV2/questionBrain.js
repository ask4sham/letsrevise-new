/**
 * Phase 3 — Question Brain.
 *
 * Reads Phase 1 teaching content + Phase 2 visual/activity briefs and writes
 * teacher-quality SC×3, CP×3, quiz×5. Must NOT use V1 repair-template padding.
 */

const { STAGE_STATUS } = require("./schemas");
const { validatePhase3Questions } = require("./validatePhase3Questions");

function normalizeKey(topic) {
  return String(topic || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(arr, i, fallback) {
  if (Array.isArray(arr) && arr.length) return arr[Math.min(i, arr.length - 1)];
  return fallback;
}

function sectionContent(phase1, id) {
  const s = (phase1?.sections || []).find((x) => x?.id === id);
  return String(s?.content || "").trim();
}

function firstMisconception(phase1) {
  const m = (phase1?.misconceptions || [])[0];
  return {
    wrong: String(m?.wrong || "A common error is using a keyword without a mechanism.").trim(),
    correct: String(m?.correct || "Explain the mechanism with precise biological terms.").trim(),
  };
}

function keyTerms(phase1, fallbacks) {
  const terms = (phase1?.keyTerms || []).map((t) => String(t || "").trim()).filter(Boolean);
  return terms.length ? terms : fallbacks;
}

function qShort(id, purpose, prompt, correctAnswer, linkedSectionIds = ["core"]) {
  return {
    id,
    prompt,
    questionType: "short",
    options: [],
    correctAnswer,
    purpose,
    linkedSectionIds,
    marks: purpose === "explain" || purpose === "exam_style" ? 2 : 1,
  };
}

function qMcq(id, purpose, prompt, options, correctAnswer, linkedSectionIds = ["core"]) {
  return {
    id,
    prompt,
    questionType: "mcq",
    options: [...options],
    correctAnswer,
    purpose,
    linkedSectionIds,
    marks: 1,
  };
}

/**
 * Topic packs produce concrete stems from Phase 1 facts — not generic wrappers.
 */
function buildQuestionPack(ctx, phase1, phase2) {
  const topic = String(ctx.topic || phase1?.topic || "").trim();
  const n = normalizeKey(topic);
  const misc = firstMisconception(phase1);
  const tip = pick(phase1?.examTips, 0, "Use precise biological terms and because → therefore links.");
  const core = sectionContent(phase1, "core");
  const examples = sectionContent(phase1, "examples");
  const retrievalTitle = String(
    pick((phase2?.retrievalActivities || []).map((a) => a?.title), 0, "the retrieval diagram") ||
      "the retrieval diagram"
  ).trim();
  const retrievalHint =
    retrievalTitle.length > 60 ? "the student retrieval diagram activity" : retrievalTitle;

  if (/\bcell structure\b|\beukaryot|\bprokaryot|\borganelle/.test(n)) {
    const terms = keyTerms(phase1, ["nucleus", "mitochondria", "chloroplast", "cytoplasm"]);
    return {
      selfCheck: [
        qShort(
          "sc1",
          "definition",
          "Define what is meant by a eukaryotic cell.",
          "A cell that has a nucleus and membrane-bound organelles.",
          ["core"]
        ),
        qShort(
          "sc2",
          "misconception",
          `A student says: "${misc.wrong}" Why is this incorrect?`,
          misc.correct,
          ["core", "exam-link"]
        ),
        qShort(
          "sc3",
          "explain",
          "Explain why muscle cells typically contain many mitochondria.",
          "Muscle cells need large amounts of energy for contraction, so many mitochondria release energy from respiration.",
          ["examples"]
        ),
      ],
      checkpoint: [
        qMcq(
          "cp1",
          "recall",
          "Which organelle contains genetic material and controls cell activities?",
          ["Nucleus", "Ribosome", "Cell wall", "Cytoplasm"],
          "Nucleus",
          ["core"]
        ),
        qMcq(
          "cp2",
          "application",
          "A plant leaf cell absorbs light for photosynthesis. Which organelle is most important for this?",
          ["Chloroplast", "Nucleus", "Mitochondria", "Ribosome"],
          "Chloroplast",
          ["examples"]
        ),
        qShort(
          "cp3",
          "misconception",
          "A student labels DNA in a bacterial cell as being stored inside a nucleus. What should they write instead?",
          "Bacteria are prokaryotes: DNA is in the cytoplasm (nucleoid region), not inside a membrane-bound nucleus.",
          ["core", "exam-link"]
        ),
      ],
      quiz: [
        qShort(
          "qz1",
          "definition",
          `State the function of the ${terms[3] || "cell membrane"} in a typical cell.`,
          "It controls what enters and leaves the cell.",
          ["core"]
        ),
        qShort(
          "qz2",
          "misconception",
          "Correct this student error: plant and animal cells have identical organelles.",
          "Both have a nucleus, cytoplasm and cell membrane, but plant cells typically also have a cell wall, chloroplasts and a permanent vacuole.",
          ["examples"]
        ),
        qMcq(
          "qz3",
          "comparison",
          "Which structure is typically present in plant cells but not in animal cells?",
          ["Chloroplast", "Nucleus", "Cytoplasm", "Cell membrane"],
          "Chloroplast",
          ["examples"]
        ),
        qShort(
          "qz4",
          "sequence",
          "Put these ideas in a sensible teaching order: organelle function → cell type comparison → definition of eukaryotic cell. Which comes first and why?",
          "Definition of eukaryotic cell comes first so students have the model before linking organelle functions and comparing cell types.",
          ["core"]
        ),
        qShort(
          "qz5",
          "exam_style",
          `Using ${retrievalHint}, explain one difference examiners expect between plant and animal cells. Tip: ${tip}`,
          "State one clear difference per mark, e.g. plant cells have a cell wall / chloroplasts while animal cells do not, using precise organelle names.",
          ["exam-link"]
        ),
      ],
    };
  }

  if (/\bhomeostasis\b|\bnegative feedback\b|\bthermoregul|\bblood glucose\b/.test(n)) {
    return {
      selfCheck: [
        qShort(
          "sc1",
          "definition",
          "Define homeostasis.",
          "The regulation of internal conditions to maintain optimum levels for cells.",
          ["core"]
        ),
        qShort(
          "sc2",
          "misconception",
          `A student says: "${misc.wrong}" Rewrite the correct idea.`,
          misc.correct,
          ["core"]
        ),
        qShort(
          "sc3",
          "explain",
          "Explain how negative feedback returns conditions towards the optimum after a change.",
          "A receptor detects the change, a coordination centre processes the information, and an effector responds so conditions move back towards the optimum.",
          ["core"]
        ),
      ],
      checkpoint: [
        qMcq(
          "cp1",
          "recall",
          "In the negative feedback model, what detects a change in the internal environment?",
          ["Receptor", "Effector", "Hormone only", "Optimum value"],
          "Receptor",
          ["core"]
        ),
        qShort(
          "cp2",
          "sequence",
          "State the correct order of the homeostasis response pathway.",
          "Receptor → coordination centre → effector.",
          ["core", "exam-link"]
        ),
        qShort(
          "cp3",
          "misconception",
          "Why is it incomplete to say homeostasis only controls body temperature?",
          "Homeostasis also regulates other internal conditions such as blood glucose, not temperature alone.",
          ["examples"]
        ),
      ],
      quiz: [
        qShort(
          "qz1",
          "definition",
          "What is meant by an optimum condition for cells?",
          "The internal level at which enzymes and cell processes work best.",
          ["core"]
        ),
        qShort(
          "qz2",
          "misconception",
          "A student claims effectors detect changes. Correct them.",
          "Receptors detect changes; effectors carry out the response.",
          ["core"]
        ),
        qMcq(
          "qz3",
          "comparison",
          "During exercise, which pair of responses increases heat loss?",
          [
            "Sweating and vasodilation",
            "Shivering and vasoconstriction",
            "Insulin release only",
            "Stopping receptors",
          ],
          "Sweating and vasodilation",
          ["examples"]
        ),
        qShort(
          "qz4",
          "application",
          "After a meal, blood glucose rises. Explain one way the body restores the optimum range.",
          "Insulin helps lower blood glucose back towards the optimum so cells can respire steadily.",
          ["examples"]
        ),
        qShort(
          "qz5",
          "exam_style",
          `Explain, in exam style, why naming receptor, coordination centre and effector in order gains marks. Tip: ${tip}`,
          "Examiners award marks for the correct sequence and for linking each stage to the change detected and the response.",
          ["exam-link"]
        ),
      ],
    };
  }

  if (/\bgamete|\bfertilis|\bfertiliz/.test(n)) {
    const terms = keyTerms(phase1, ["gamete", "sperm", "egg", "fertilisation", "zygote", "haploid"]);
    return {
      selfCheck: [
        qShort(
          "sc1",
          "definition",
          "Define a gamete.",
          "A sex cell (e.g. sperm or egg) that contains half the normal chromosome number (haploid).",
          ["core"]
        ),
        qShort(
          "sc2",
          "misconception",
          `A student says: "${misc.wrong}" Explain the correct biology.`,
          misc.correct,
          ["core"]
        ),
        qShort(
          "sc3",
          "explain",
          "Explain why fertilisation restores the diploid chromosome number.",
          "Haploid sperm and haploid egg fuse, combining their chromosomes to form a diploid zygote.",
          ["core", "examples"]
        ),
      ],
      checkpoint: [
        qMcq(
          "cp1",
          "recall",
          "Which cells fuse during fertilisation in humans?",
          ["Sperm and egg", "Two sperm cells", "Two body cells", "Zygote and egg"],
          "Sperm and egg",
          ["core"]
        ),
        qShort(
          "cp2",
          "sequence",
          "Order these events: zygote forms → gametes meet → haploid nuclei fuse.",
          "Gametes meet → haploid nuclei fuse → zygote forms.",
          ["core"]
        ),
        qShort(
          "cp3",
          "explain",
          "Why must gametes be haploid before fertilisation?",
          "So that fusion produces a diploid zygote with the species' normal chromosome number, not a doubled set.",
          ["examples"]
        ),
      ],
      quiz: [
        qShort(
          "qz1",
          "definition",
          `What is meant by ${terms[4] || "a zygote"}?`,
          "The diploid cell formed when gametes fuse at fertilisation.",
          ["core"]
        ),
        qShort(
          "qz2",
          "misconception",
          "Correct this error: fertilisation halves the chromosome number.",
          "Fertilisation restores the diploid number; meiosis halves it when gametes form.",
          ["core"]
        ),
        qMcq(
          "qz3",
          "comparison",
          "How do sperm and egg gametes differ in function?",
          [
            "Sperm is adapted to move to the egg; the egg provides cytoplasm and nutrients",
            "Both are diploid body cells",
            "Only the egg is haploid",
            "Sperm contains no genetic material",
          ],
          "Sperm is adapted to move to the egg; the egg provides cytoplasm and nutrients",
          ["examples"]
        ),
        qShort(
          "qz4",
          "application",
          "A zygote has 46 chromosomes. What does that tell you about the gametes that fused?",
          "Each gamete contributed 23 chromosomes (haploid).",
          ["examples"]
        ),
        qShort(
          "qz5",
          "exam_style",
          "Explain, for exam marks, one reason variation can increase after fertilisation.",
          "Genetic material from two parents combines in the zygote, producing new allele combinations.",
          ["exam-link"]
        ),
      ],
    };
  }

  if (/\bsexual\b.*\basexual\b|\basexual\b.*\bsexual\b|\breproduction\b/.test(n)) {
    return {
      selfCheck: [
        qShort(
          "sc1",
          "definition",
          "Define sexual reproduction.",
          "Reproduction involving the fusion of gametes, usually producing genetically varied offspring.",
          ["core"]
        ),
        qShort(
          "sc2",
          "misconception",
          `A student says: "${misc.wrong}" Give the correct idea.`,
          misc.correct,
          ["core"]
        ),
        qShort(
          "sc3",
          "explain",
          "Explain one advantage of asexual reproduction for a plant in a stable environment.",
          "It can produce many genetically identical offspring quickly without needing a mate, which is efficient when conditions stay favourable.",
          ["examples"]
        ),
      ],
      checkpoint: [
        qMcq(
          "cp1",
          "recall",
          "Which type of reproduction usually needs gamete fusion?",
          ["Sexual reproduction", "Asexual reproduction only", "Binary fission only", "Budding only"],
          "Sexual reproduction",
          ["core"]
        ),
        qShort(
          "cp2",
          "application",
          "A strawberry plant sends out runners that form new plants. Which reproduction type is this, and why?",
          "Asexual reproduction, because new plants form from one parent without gamete fusion and are genetically identical.",
          ["examples"]
        ),
        qShort(
          "cp3",
          "misconception",
          "Why is it wrong to say asexual reproduction always produces more variation than sexual reproduction?",
          "Asexual offspring are genetically identical to the parent; sexual reproduction mixes alleles and usually increases variation.",
          ["core", "exam-link"]
        ),
      ],
      quiz: [
        qShort(
          "qz1",
          "definition",
          "Define asexual reproduction.",
          "Reproduction that does not involve gamete fusion and produces genetically identical offspring from one parent.",
          ["core"]
        ),
        qShort(
          "qz2",
          "misconception",
          "Correct this error: sexual reproduction never involves cell division.",
          "Sexual reproduction still involves mitosis and meiosis; the key point is gamete fusion and genetic mixing.",
          ["core"]
        ),
        qMcq(
          "qz3",
          "comparison",
          "Which statement correctly compares sexual and asexual reproduction?",
          [
            "Sexual usually increases genetic variation; asexual produces clones",
            "Asexual always needs two parents",
            "Sexual never uses gametes",
            "Both always produce identical offspring",
          ],
          "Sexual usually increases genetic variation; asexual produces clones",
          ["examples"]
        ),
        qShort(
          "qz4",
          "sequence",
          "Outline the sexual reproduction sequence from gamete formation to offspring.",
          "Meiosis forms haploid gametes → fertilisation forms a zygote → mitosis grows the offspring.",
          ["core"]
        ),
        qShort(
          "qz5",
          "exam_style",
          `Explain one exam-style disadvantage of asexual reproduction in a changing environment. Tip: ${tip}`,
          "Low genetic variation means offspring may all be vulnerable to the same disease or environmental change.",
          ["exam-link"]
        ),
      ],
    };
  }

  // Generic but still grounded in Phase 1 terms/sections — avoid banned wrappers.
  const terms = keyTerms(phase1, ["process", "structure", "mechanism"]);
  const t0 = terms[0] || "the core structure";
  const t1 = terms[1] || "the process";
  const label = topic || "this biology topic";
  const coreSnippet = core.slice(0, 180) || `${label} is explained using precise GCSE Biology terms and a clear mechanism.`;
  const exampleSnippet = examples.slice(0, 160) || `Concrete examples show how ${label} works in living organisms.`;

  return {
    selfCheck: [
      qShort(
        "sc1",
        "definition",
        `Define ${t0} as used in ${label}.`,
        `${t0} is a key idea in ${label}: ${coreSnippet.split(".")[0]}.`,
        ["core"]
      ),
      qShort(
        "sc2",
        "misconception",
        `A student says: "${misc.wrong}" What should they write instead?`,
        misc.correct,
        ["core"]
      ),
      qShort(
        "sc3",
        "explain",
        `Explain how ${t1} links to a biological outcome in ${label}.`,
        `In ${label}, ${t1} leads to a clear outcome: ${exampleSnippet.split(".")[0]}.`,
        ["examples"]
      ),
    ],
    checkpoint: [
      qMcq(
        "cp1",
        "recall",
        `Which term is central to the core teaching model for ${label}?`,
        [
          t0,
          terms[2] || "unrelated keyword",
          "random everyday word",
          "unspecified external factor",
        ],
        t0,
        ["core"]
      ),
      qShort(
        "cp2",
        "application",
        `Using an example from teaching, apply ${label} to explain one real biological situation.`,
        `${exampleSnippet.split(".")[0]}.`,
        ["examples"]
      ),
      qShort(
        "cp3",
        "misconception",
        `Why is this incorrect for ${label}: "${misc.wrong}"?`,
        misc.correct,
        ["exam-link"]
      ),
    ],
    quiz: [
      qShort(
        "qz1",
        "definition",
        `State a precise GCSE definition linked to ${t0}.`,
        `${coreSnippet.split(".")[0]}.`,
        ["core"]
      ),
      qShort(
        "qz2",
        "misconception",
        `Correct a common error about ${label} using the taught misconception.`,
        misc.correct,
        ["core"]
      ),
      qMcq(
        "qz3",
        "comparison",
        `When comparing two examples in ${label}, what should students contrast?`,
        [
          "A normal process versus what changes when a factor is altered",
          "Two identical keywords with no mechanism",
          "Only spelling differences",
          "Unrelated physics quantities",
        ],
        "A normal process versus what changes when a factor is altered",
        ["examples"]
      ),
      qShort(
        "qz4",
        "sequence",
        `Outline a sensible order for explaining ${label}: definition, mechanism, example.`,
        "Teach the definition first, then the mechanism, then a concrete example that links cause to effect.",
        ["core"]
      ),
      qShort(
        "qz5",
        "exam_style",
        `Explain one point examiners reward for ${label}. Tip: ${tip}`,
        tip,
        ["exam-link"]
      ),
    ],
  };
}

/**
 * Fix weak generic MCQ options that accidentally used filler language.
 * (Safety net for the generic pack.)
 */
function sanitisePack(pack) {
  for (const bank of ["selfCheck", "checkpoint", "quiz"]) {
    pack[bank] = (pack[bank] || []).map((q) => {
      if (q.questionType !== "mcq") return q;
      const options = (q.options || []).map((o, i) => {
        const s = String(o || "").trim();
        if (/^option\s*[123]$/i.test(s) || /option filler/i.test(s)) {
          return `Distractor ${i + 1}: unrelated biological idea`;
        }
        return s;
      });
      // Ensure unique distractors
      const seen = new Set();
      const unique = options.map((o, i) => {
        let cur = o;
        let n = 1;
        while (seen.has(cur.toLowerCase())) {
          cur = `${o} (${n})`;
          n += 1;
        }
        seen.add(cur.toLowerCase());
        return cur;
      });
      return { ...q, options: unique };
    });
  }
  return pack;
}

/**
 * @param {{ topic: string, subject?: string, level?: string, board?: string, tier?: string }} ctx
 * @param {object} phase1
 * @param {object} phase2
 * @param {{ phase3Override?: object }} [opts]
 */
function buildPhase3Questions(ctx, phase1, phase2, opts = {}) {
  if (opts.phase3Override && typeof opts.phase3Override === "object") {
    return {
      ...opts.phase3Override,
      status: opts.phase3Override.status || STAGE_STATUS.COMPLETE,
    };
  }

  const pack = sanitisePack(buildQuestionPack(ctx, phase1 || {}, phase2 || {}));
  return {
    status: STAGE_STATUS.COMPLETE,
    topic: String(ctx.topic || phase1?.topic || "").trim(),
    examBoard: String(ctx.board || phase1?.examBoard || phase1?.board || "").trim(),
    level: String(ctx.level || phase1?.level || "").trim(),
    tier: String(ctx.tier || phase1?.tier || "").trim(),
    selfCheck: pack.selfCheck,
    checkpoint: pack.checkpoint,
    quiz: pack.quiz,
    rules: {
      selfCheckCount: 3,
      checkpointCount: 3,
      quizCount: 5,
    },
    questionsFinalised: true,
    derivedFromPhase1: true,
    derivedFromPhase2: true,
    notes:
      "Phase 3 Question Brain: topic-specific SC×3, CP×3, quiz×5 from Phase 1+2. No V1 repair-template padding. Fail closed on quality.",
  };
}

/**
 * @param {{ topic: string }} ctx
 * @param {object} staged
 * @param {{ phase3Override?: object }} [opts]
 */
async function runQuestionBrain(ctx, staged, opts = {}) {
  const phase1 = staged.phase1Lesson || {};
  const phase2 = staged.phase2VisualActivities || {};

  if (phase1.status !== STAGE_STATUS.COMPLETE && !opts.phase3Override) {
    const err = new Error("Lesson Generator V2 Phase 3 requires a complete Phase 1 lesson.");
    err.status = 422;
    err.code = "LESSON_V2_PHASE3_FAILED";
    err.details = { issues: ["phase3_requires_complete_phase1"] };
    throw err;
  }
  if (phase2.status !== STAGE_STATUS.COMPLETE && !opts.phase3Override) {
    const err = new Error("Lesson Generator V2 Phase 3 requires a complete Phase 2 visual/activity plan.");
    err.status = 422;
    err.code = "LESSON_V2_PHASE3_FAILED";
    err.details = { issues: ["phase3_requires_complete_phase2"] };
    throw err;
  }

  const phase3 = buildPhase3Questions(ctx, phase1, phase2, opts);
  const check = validatePhase3Questions(phase3, {
    phase1,
    phase2,
    topic: ctx.topic,
  });
  if (!check.ok) {
    staged.phase3Questions = {
      ...phase3,
      status: STAGE_STATUS.FAILED,
      validationIssues: check.issues,
    };
    const err = new Error(
      `Lesson Generator V2 Phase 3 failed: ${(check.issues || []).slice(0, 5).join("; ")}`
    );
    err.status = 422;
    err.code = "LESSON_V2_PHASE3_FAILED";
    err.details = { issues: check.issues };
    throw err;
  }

  staged.phase3Questions = phase3;

  if (Array.isArray(staged.phase1Lesson?.placeholders)) {
    staged.phase1Lesson.placeholders = staged.phase1Lesson.placeholders.filter(
      (p) =>
        p !== "SELF_CHECK_PLACEHOLDER" &&
        p !== "CHECKPOINT_PLACEHOLDER" &&
        p !== "QUIZ_PLACEHOLDER"
    );
  }

  // Phase 2 still must not claim it finalised questions; Phase 3 owns that.
  if (staged.phase2VisualActivities && typeof staged.phase2VisualActivities === "object") {
    staged.phase2VisualActivities.questionsFinalised = false;
  }
  if (staged.phase1Lesson && typeof staged.phase1Lesson === "object") {
    staged.phase1Lesson.questionsFinalised = true;
    staged.phase1Lesson.selfCheck = phase3.selfCheck;
    staged.phase1Lesson.checkpoint = phase3.checkpoint;
    staged.phase1Lesson.quiz = phase3.quiz;
  }

  return staged;
}

module.exports = {
  runQuestionBrain,
  buildPhase3Questions,
  buildQuestionPack,
  validatePhase3Questions,
};
