/**
 * Golden lesson architecture tests — V3 enforcement targets.
 */

const fs = require("fs");
const path = require("path");
const { buildLessonBlueprint } = require("../../lib/lessonGeneratorV2/lessonBlueprintEngine");
const { buildLessonArchitecture } = require("../../lib/lessonArchitectureEngine");
const { enforceLessonStructure } = require("../../lib/lessonStructuralEnforcer");
const { computeLessonFlowScore, runLessonQualityGate } = require("../../lib/lessonFlowScore");
const { validateTeachTestRhythm } = require("../../lib/teachTestRhythmValidator");
const { auditDuplication } = require("../../lib/duplicationAuditor");
const { flattenPagesToBlocks } = require("../../lib/lessonBlockAnalysis");

const TOPICS = [
  {
    label: "Metabolism",
    topic: "Metabolism",
    archetype: "metabolism",
    requireDiagram: true,
    requireAtpRetrieval: true,
    requireExam: true,
  },
  {
    label: "Uses of Glucose",
    topic: "Uses of glucose",
    archetype: "uses_of_glucose",
    requireGlucoseActivity: true,
    requireNitrate: true,
    forbidGraph: true,
  },
  {
    label: "Limiting Factors",
    topic: "Limiting factors in photosynthesis",
    archetype: "limiting_factors",
    requireGraph: true,
    requireGraphInterpret: true,
  },
  {
    label: "Respiration",
    topic: "Respiration",
    archetype: "respiration",
    requireAerobicAnaerobic: true,
    requireOxygenDebt: true,
  },
  {
    label: "Plant Defences",
    topic: "Plant defences",
    archetype: "plant_defences",
    requireClassification: true,
    requireHotspot: true,
  },
];

function parseDryRunLessons() {
  const raw = fs.readFileSync(
    path.join(__dirname, "../../backend/scripts/dry-run-pilot-lessons-output.json"),
    "utf8"
  );
  return raw
    .trim()
    .split(/\n(?=\{)/)
    .map((s) => JSON.parse(s));
}

function beforeToPages(before) {
  return [
    {
      title: "Lesson",
      order: 1,
      blocks: before.map((b) => ({
        type: b.type,
        role: b.role,
        title: b.title,
        content: b.preview || "",
      })),
    },
  ];
}

function blocksFromPages(pages) {
  return flattenPagesToBlocks(pages);
}

describe("Golden lesson architecture (V3)", () => {
  const dry = parseDryRunLessons();
  const metabolismBefore = dry.find((d) => /metabolism/i.test(d.title))?.before;
  const respirationBefore = dry.find((d) => /respiration/i.test(d.title))?.before;

  test.each(TOPICS)("$label: blueprint archetype and mandatory architecture", ({ topic, archetype }) => {
    const bp = buildLessonBlueprint({ topic, subject: "Biology", durationTier: "standard" });
    expect(bp.lessonArchetype).toBe(archetype);
    const arch = buildLessonArchitecture(bp);
    expect(arch.lessonArchitecture.length).toBeGreaterThanOrEqual(16);
    expect(arch.lessonArchitecture[0].slot).toBe("objectives");
    expect(arch.lessonArchitecture.some((s) => s.slot === "examPractice")).toBe(true);
  });

  test("Metabolism curated: enforced rhythm and scores", () => {
    expect(metabolismBefore?.length).toBeGreaterThan(10);
    const bp = buildLessonBlueprint({ topic: "Metabolism", subject: "Biology" });
    const pages = beforeToPages(metabolismBefore);
    const enforced = enforceLessonStructure(pages, bp);
    const rhythm = validateTeachTestRhythm(enforced.pages);
    const scores = computeLessonFlowScore(enforced.pages, { blueprint: bp });
    const blocks = blocksFromPages(enforced.pages);

    expect(enforced.changes.reordered).toBe(true);
    expect(blocks.some((b) => String(b.type).toLowerCase() === "diagram" || b._v3ArchitectureSlot === "visualActivity")).toBeTruthy();
    expect(rhythm.maxConsecutiveTeach).toBeLessThanOrEqual(3);
    expect(scores.duplicationScore).toBeGreaterThanOrEqual(70);
    expect(scores.architectureScore).toBeGreaterThanOrEqual(50);
  });

  test("Respiration curated: aerobic/anaerobic and duplication", () => {
    expect(respirationBefore?.length).toBeGreaterThan(10);
    const bp = buildLessonBlueprint({ topic: "Respiration", subject: "Biology" });
    const enforced = enforceLessonStructure(beforeToPages(respirationBefore), bp);
    const blocks = blocksFromPages(enforced.pages);
    const hay = blocks.map((b) => (b.content || "") + (b.title || "")).join(" ").toLowerCase();

    expect(hay.includes("aerobic") || hay.includes("anaerobic")).toBe(true);
    const dup = auditDuplication(enforced.pages);
    expect(dup.duplicateCount).toBe(0);
  });

  test.each(TOPICS.filter((t) => t.requireGraph))(
    "$label: blueprint plans graphs",
    ({ topic }) => {
      const bp = buildLessonBlueprint({ topic, subject: "Biology" });
      const journey = bp.learningJourney || [];
      expect(journey.some((s) => s.blockType === "graph")).toBe(true);
      expect(bp.activityPlan.some((a) => a.type === "graph")).toBe(true);
    }
  );

  test.each(TOPICS.filter((t) => t.forbidGraph))(
    "$label: no graph in blueprint",
    ({ topic }) => {
      const bp = buildLessonBlueprint({ topic, subject: "Biology" });
      const journey = bp.learningJourney || [];
      expect(journey.some((s) => s.blockType === "graph")).toBe(false);
    }
  );

  test.each(TOPICS)("$label: quality gate on enforced curated or synthetic", ({ topic, label }) => {
    const bp = buildLessonBlueprint({ topic, subject: "Biology" });
    let pages;
    if (label === "Metabolism" && metabolismBefore) {
      pages = enforceLessonStructure(beforeToPages(metabolismBefore), bp).pages;
    } else if (label === "Respiration" && respirationBefore) {
      pages = enforceLessonStructure(beforeToPages(respirationBefore), bp).pages;
    } else {
      pages = enforceLessonStructure(
        [
          {
            title: "Lesson",
            order: 1,
            blocks: [
              { type: "keyIdea", role: "lessonObjectives", title: "LESSON OBJECTIVES", content: "At the end of this lesson, you should be able to:" },
              { type: "text", role: "priorKnowledge", title: "PRIOR KNOWLEDGE", content: "Prior knowledge check" },
              { type: "text", role: "hook", title: "SCENARIO", content: "Hook scenario" },
              { type: "keyIdea", role: "coreRule", title: "CORE RULE", content: "Core rule" },
              { type: "text", role: "concept", title: "CORE LEARNING", content: "Teach chunk one" },
              { type: "checkpoint", role: "checkpoint", question: "Quick check 1?" },
              { type: "text", role: "concept", content: "Teach chunk two" },
              { type: "dragDropMatch", role: "match", title: "Activity" },
              { type: "examTip", role: "examTechnique", content: "Exam technique tip" },
              { type: "text", role: "examPractice", title: "EXAM PRACTICE", content: "Exam practice Q1" },
              { type: "keyIdea", role: "summary", title: "SUMMARY", content: "Summary points" },
              { type: "keyWords", role: "keyWords", title: "KEY WORDS", content: "Keywords list" },
            ],
          },
        ],
        bp
      ).pages;
    }

    const gate = runLessonQualityGate(pages, { blueprint: bp, strict: false });
    expect(gate.scores.overallFlowScore).toBeGreaterThanOrEqual(55);
    expect(gate.scores.duplicationScore).toBeGreaterThanOrEqual(70);
  });
});
