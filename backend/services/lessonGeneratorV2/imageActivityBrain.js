/**
 * Phase 2 — Image / Activity Brain.
 *
 * Reads Phase 1 teaching content and produces:
 * - teaching diagrams (labels/explanations allowed)
 * - retrieval/activity image briefs (must NOT reveal answers on student-facing images)
 *
 * Does NOT finalise questions or save lessons.
 */

const { STAGE_STATUS } = require("./schemas");
const { validatePhase2VisualActivities } = require("./validatePhase2VisualActivities");

function normalizeKey(topic) {
  return String(topic || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keyTermsFromPhase1(phase1) {
  const terms = Array.isArray(phase1?.keyTerms) ? phase1.keyTerms.map((t) => String(t || "").trim()).filter(Boolean) : [];
  return terms.length ? terms : ["structure", "process", "outcome"];
}

function sectionIds(phase1) {
  return (Array.isArray(phase1?.sections) ? phase1.sections : [])
    .map((s) => s?.id)
    .filter(Boolean);
}

/**
 * Topic-aware visual/activity briefs derived from Phase 1.
 */
function buildVisualPack(ctx, phase1) {
  const topic = String(ctx.topic || phase1?.topic || "this topic").trim();
  const n = normalizeKey(topic);
  const terms = keyTermsFromPhase1(phase1);
  const ids = sectionIds(phase1);
  const fromCore = ids.includes("core") ? ["core"] : ids.slice(0, 1);

  if (/\bcell structure\b|\beukaryot|\bprokaryot|\borganelle/.test(n)) {
    return {
      teachingDiagrams: [
        {
          id: "td-cell-labelled",
          purpose: "teaching",
          title: "Labelled animal and plant cell comparison",
          placement: "after core teaching",
          labelsAllowed: true,
          prompt:
            "Clean GCSE Biology teaching diagram comparing an animal cell and a plant cell. Clearly label nucleus, cytoplasm, cell membrane, mitochondria; on the plant cell also label cell wall, chloroplast and permanent vacuole. Use calm colours, no decorative clutter, exam-ready clarity.",
          whatToNotice: [
            "Plant cells have a cell wall and chloroplasts; animal cells do not",
            "Both cell types share nucleus, cytoplasm and cell membrane",
          ],
          derivedFromSectionIds: fromCore,
        },
      ],
      retrievalActivities: [
        {
          id: "ra-cell-unlabelled",
          purpose: "retrieval",
          activityType: "labelDiagram",
          title: "Identify organelles on an unlabelled cell diagram",
          placement: "after examples / before summary",
          labelsAllowedOnStudentImage: false,
          studentSafe: true,
          bannedRevealTerms: ["nucleus", "mitochondria", "chloroplast"],
          studentTask:
            "Look at the unlabelled diagram. Which structure contains genetic material and controls cell activities?",
          studentFacingImagePrompt:
            "Simple unlabelled GCSE Biology cell diagram showing several organelles as blank shapes with leader lines ending in empty label boxes. Do not print any organelle names on the image. Do not mark any structure as correct. Neutral colours only; no ticks, highlights, or answer cues.",
          teacherFacingBrief:
            "Teacher answer: the nucleus contains genetic material and controls activities. Student image must remain unlabelled so the activity does not give away the organelle name.",
          derivedFromSectionIds: fromCore,
        },
        {
          id: "ra-cell-compare-hotspot",
          purpose: "retrieval",
          activityType: "hotspot",
          title: "Spot the plant-only feature",
          placement: "after comparison teaching",
          labelsAllowedOnStudentImage: false,
          studentSafe: true,
          bannedRevealTerms: ["chloroplast", "cell wall"],
          studentTask: "Which feature is usually present in plant cells but not animal cells?",
          studentFacingImagePrompt:
            "Side-by-side animal and plant cell outlines with the same visual style. No text labels naming organelles. No arrows saying which side is correct. Students must inspect structures themselves; keep all cues visual-only and unlabelled.",
          teacherFacingBrief:
            "Teacher answer focus: cell wall and/or chloroplast. Do not print those names on the student image.",
          derivedFromSectionIds: ids.includes("examples") ? ["examples"] : fromCore,
        },
      ],
    };
  }

  if (/\bhomeostasis\b|\bnegative feedback\b|\bthermoregul|\bblood glucose\b/.test(n)) {
    return {
      teachingDiagrams: [
        {
          id: "td-feedback-loop",
          purpose: "teaching",
          title: "Negative feedback loop overview",
          placement: "after core teaching",
          labelsAllowed: true,
          prompt:
            "GCSE Biology teaching diagram of negative feedback for homeostasis: receptor detects change → coordination centre → effector response → return towards optimum. Label each stage clearly. Clean flowchart style suitable for revision.",
          whatToNotice: [
            "Feedback returns conditions towards the optimum",
            "Receptor, coordination centre and effector have different roles",
          ],
          derivedFromSectionIds: fromCore,
        },
      ],
      retrievalActivities: [
        {
          id: "ra-feedback-unlabelled",
          purpose: "retrieval",
          activityType: "interactiveSequence",
          title: "Order the feedback stages",
          placement: "after examples",
          labelsAllowedOnStudentImage: false,
          studentSafe: true,
          bannedRevealTerms: ["receptor", "effector"],
          studentTask: "Put the homeostasis response stages into a sensible order after a change is detected.",
          studentFacingImagePrompt:
            "Four blank flowchart boxes connected by arrows for a homeostasis response. Boxes have no stage names printed. No numbering that reveals the correct order. No ticks or 'correct path' highlighting.",
          teacherFacingBrief:
            "Teacher sequence: receptor → coordination centre → effector → return to optimum. Keep student image unnamed/unnumbered for order.",
          derivedFromSectionIds: fromCore,
        },
      ],
    };
  }

  // Generic biology visual pack from Phase 1 terms.
  const t0 = terms[0] || "key structure";
  const t1 = terms[1] || "related process";
  return {
    teachingDiagrams: [
      {
        id: "td-generic-labelled",
        purpose: "teaching",
        title: `Teaching diagram for ${topic}`,
        placement: "after core teaching",
        labelsAllowed: true,
        prompt: `Clear GCSE Biology teaching diagram for ${topic}. Label ${t0} and ${t1} where helpful so students can learn the model. Keep the layout exam-friendly and uncluttered.`,
        whatToNotice: [
          `How ${t0} links to the main idea in ${topic}`,
          `One visual difference or step students should remember`,
        ],
        derivedFromSectionIds: fromCore,
      },
    ],
    retrievalActivities: [
      {
        id: "ra-generic-unlabelled",
        purpose: "retrieval",
        activityType: "labelDiagram",
        title: `Retrieve a key idea about ${topic}`,
        placement: "after examples / before summary",
        labelsAllowedOnStudentImage: false,
        studentSafe: true,
        bannedRevealTerms: [t0],
        studentTask: `Using the unlabelled diagram, identify the part most closely linked to ${topic}.`,
        studentFacingImagePrompt: `Unlabelled GCSE Biology diagram related to ${topic}. Show structures as blank regions with empty label lines. Do not print names of structures. Do not mark any region as correct. No answer text, ticks, or highlighted solutions.`,
        teacherFacingBrief: `Teacher focus: students should identify ${t0} without the image naming it. Keep answer guidance in the teacher brief only.`,
        derivedFromSectionIds: fromCore,
      },
    ],
  };
}

/**
 * @param {{ topic: string, subject?: string, level?: string, board?: string }} ctx
 * @param {object} phase1
 * @param {{ phase2Override?: object }} [opts]
 */
function buildPhase2VisualActivities(ctx, phase1, opts = {}) {
  if (opts.phase2Override && typeof opts.phase2Override === "object") {
    return {
      ...opts.phase2Override,
      status: opts.phase2Override.status || STAGE_STATUS.COMPLETE,
    };
  }

  const pack = buildVisualPack(ctx, phase1 || {});
  return {
    status: STAGE_STATUS.COMPLETE,
    topic: String(ctx.topic || phase1?.topic || "").trim(),
    teachingDiagrams: pack.teachingDiagrams,
    retrievalActivities: pack.retrievalActivities,
    studentSafe: true,
    questionsFinalised: false,
    imagePromptsFinalised: true,
    selfCheck: [],
    quiz: [],
    notes:
      "Phase 2 Image/Activity Brain: teaching diagrams may label; retrieval/activity student images must not reveal answers. Questions still deferred to Phase 3.",
  };
}

/**
 * @param {{ topic: string }} ctx
 * @param {object} staged
 * @param {{ phase2Override?: object }} [opts]
 */
async function runImageActivityBrain(ctx, staged, opts = {}) {
  const phase1 = staged.phase1Lesson || {};
  if (phase1.status !== STAGE_STATUS.COMPLETE && !opts.phase2Override) {
    const err = new Error("Lesson Generator V2 Phase 2 requires a complete Phase 1 lesson.");
    err.status = 422;
    err.code = "LESSON_V2_PHASE2_FAILED";
    err.details = { issues: ["phase2_requires_complete_phase1"] };
    throw err;
  }

  const phase2 = buildPhase2VisualActivities(ctx, phase1, opts);
  const check = validatePhase2VisualActivities(phase2, { phase1 });
  if (!check.ok) {
    staged.phase2VisualActivities = {
      ...phase2,
      status: STAGE_STATUS.FAILED,
      validationIssues: check.issues,
    };
    const err = new Error(
      `Lesson Generator V2 Phase 2 failed: ${(check.issues || []).slice(0, 5).join("; ")}`
    );
    err.status = 422;
    err.code = "LESSON_V2_PHASE2_FAILED";
    err.details = { issues: check.issues };
    throw err;
  }

  staged.phase2VisualActivities = phase2;

  // Phase 1 may still list IMAGE_ACTIVITY_PLACEHOLDER; Phase 2 has now produced briefs.
  if (Array.isArray(staged.phase1Lesson?.placeholders)) {
    staged.phase1Lesson.placeholders = staged.phase1Lesson.placeholders.filter(
      (p) => p !== "IMAGE_ACTIVITY_PLACEHOLDER"
    );
  }

  return staged;
}

module.exports = {
  runImageActivityBrain,
  buildPhase2VisualActivities,
  validatePhase2VisualActivities,
  buildVisualPack,
};
