/**
 * Phase 3G.8 — offline acceptance: interaction authority enforcement on benchmark fixture.
 * Usage: TEACHER_BRAIN_SUBTOPIC_BOUNDARY=2 node backend/scripts/manualAcceptance3G8.js
 */

const {
  enforceInteractionAuthorityOnDraft,
  countForbiddenPrimaryActivities,
} = require("../../lib/teacherBrain/interactionAuthorityEnforcer");
const { auditInteractionAuthorityFromLesson } = require("../../lib/teacherBrain/interactionAuthorityLayer");

const BENCHMARK = {
  topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
  subTopic: "Structure and function of the nervous system",
  topic: "Structure and function of the nervous system",
};

function contaminatedPages() {
  return [
    {
      title: "Page 1",
      blocks: [
        {
          type: "text",
          title: "Key examples",
          content: "Sensory neurones, motor neurones, CNS, PNS — reflex pathway neighbour mention.",
        },
        {
          type: "keyIdea",
          title: "What to Notice",
          content: "Focus on the labelled parts of the neurone diagram.",
        },
        {
          type: "dragDropMatch",
          title: "REFLEX ARC PATHWAY",
          content: "Order the reflex arc pathway drag drop",
        },
        {
          type: "checkpoint",
          prompt: "Explain accommodation and lens shape change for near vision.",
          questionType: "short",
          correctAnswer: "",
        },
        {
          type: "interactiveDiagram",
          title: "Label brain regions",
          content: "Label cerebellum, medulla and cerebral cortex.",
        },
        {
          type: "dragDropMatch",
          title: "Thermoregulation sort",
          content: "Sort sweating and vasodilation",
        },
        {
          type: "dragDropMatch",
          title: "Neurone structure labelling",
          content: "Label dendrites, axon, myelin sheath",
        },
      ],
    },
  ];
}

function main() {
  process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY || "2";
  const pages = contaminatedPages();

  const beforePrimary = countForbiddenPrimaryActivities(pages, BENCHMARK);
  const auditBefore = auditInteractionAuthorityFromLesson({ pages, ...BENCHMARK });

  const enforced = enforceInteractionAuthorityOnDraft({ pages, ...BENCHMARK });
  const afterPrimary = countForbiddenPrimaryActivities(enforced.pages, BENCHMARK);
  const auditAfter = auditInteractionAuthorityFromLesson({ pages: enforced.pages, ...BENCHMARK });

  const report = {
    generatedAt: new Date().toISOString(),
    boundaryMode: Number(process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY),
    benchmark: BENCHMARK,
    before: {
      forbiddenPrimaryActivities: beforePrimary,
      auditUnauthorised: auditBefore.unauthorisedDetected,
      blockedRisks: auditBefore.blockedRisks?.length ?? 0,
    },
    after: {
      forbiddenPrimaryActivities: afterPrimary,
      auditUnauthorised: auditAfter.unauthorisedDetected,
      blockedRisks: auditAfter.blockedRisks?.length ?? 0,
      blocksRerouted: enforced.enforcement.blocksRerouted,
      blocksRemoved: enforced.enforcement.blocksRemoved,
    },
    pass:
      afterPrimary === 0 &&
      enforced.enforcement.blocksRerouted.length >= 4 &&
      enforced.pages[0].blocks.some((b) => b.title === "Key examples") &&
      enforced.pages[0].blocks.some((b) => b.title === "What to Notice"),
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

main();
