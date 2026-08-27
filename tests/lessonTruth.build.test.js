/**
 * Lesson Truth Phase 1 — buildLessonTruth focused tests.
 */

const fs = require("fs");
const path = require("path");
const { buildLessonTruth } = require("../lib/teacherBrain/lessonTruth/buildLessonTruth");
const { runTeacherBrain } = require("../lib/teacherBrain");
const { semanticEquals } = require("../lib/teacherBrain/lessonTruth/canonicalize");
const { isTeachingAuthorityBlock } = require("../lib/teacherBrain/lessonTruth/taughtEvidenceBuilder");

const FIXTURE_DIR = path.join(__dirname, "fixtures", "lessonTruth");
const variationLesson = require(path.join(FIXTURE_DIR, "variation-within-species.lesson.json"));
const variationExpectations = require(path.join(
  FIXTURE_DIR,
  "variation-within-species.expected-truth.json"
));

const LESSON_TRUTH_DIR = path.join(__dirname, "..", "lib", "teacherBrain", "lessonTruth");
const FIXTURE_BIOLOGY_TERMS = [
  "variation within a species",
  "genetic variation",
  "environmental variation",
  "meiosis",
  "fertilisation",
  "mutation",
  "allele",
];

function readProductionLessonTruthSources() {
  const files = [
    "types.js",
    "canonicalize.js",
    "buildLessonTruth.js",
    "requiredConceptsFromLesson.js",
    "taughtEvidenceBuilder.js",
    "conceptNormalization.js",
  ];
  return files.map((file) => fs.readFileSync(path.join(LESSON_TRUTH_DIR, file), "utf8")).join("\n");
}

function conceptIds(concepts) {
  return concepts.map((c) => c.id);
}

describe("Lesson Truth buildLessonTruth (Phase 1)", () => {
  test("builds LessonTruth for variation lesson fixture", () => {
    const result = buildLessonTruth(variationLesson);
    expect(result).toHaveProperty("semantic");
    expect(result).toHaveProperty("meta");
    expect(result.semantic.lessonTitle).toBe("Variation within a Species");
    expect(result.semantic.requiredConcepts.length).toBeGreaterThan(0);
  });

  test("semantic payload is deterministic across repeated calls", () => {
    const first = buildLessonTruth(variationLesson);
    const second = buildLessonTruth(variationLesson);
    expect(semanticEquals(first.semantic, second.semantic)).toBe(true);
  });

  test("contentHash is identical across repeated calls", () => {
    const first = buildLessonTruth(variationLesson);
    const second = buildLessonTruth(variationLesson);
    expect(first.meta.contentHash).toBe(second.meta.contentHash);
  });

  test("generatedAt is outside semantic payload", () => {
    const result = buildLessonTruth(variationLesson);
    expect(result.semantic).not.toHaveProperty("generatedAt");
    expect(result.meta.generatedAt).toEqual(expect.any(String));
  });

  test("generatedAt does not affect contentHash", () => {
    const early = buildLessonTruth(variationLesson, { generatedAt: "2020-01-01T00:00:00.000Z" });
    const late = buildLessonTruth(variationLesson, { generatedAt: "2030-06-15T12:30:00.000Z" });
    expect(early.meta.contentHash).toBe(late.meta.contentHash);
    expect(semanticEquals(early.semantic, late.semantic)).toBe(true);
  });

  test("taughtEvidence traces page/block identity", () => {
    const { taughtEvidence } = buildLessonTruth(variationLesson).semantic;
    expect(taughtEvidence.length).toBeGreaterThan(0);
    for (const ev of taughtEvidence) {
      expect(ev).toEqual(
        expect.objectContaining({
          evidenceId: expect.any(String),
          pageIndex: expect.any(Number),
          blockId: expect.any(String),
          blockType: expect.any(String),
        })
      );
    }
    const defEvidence = taughtEvidence.find((ev) => ev.blockId === "def-variation");
    expect(defEvidence).toMatchObject({ pageIndex: 0, blockRole: "definition" });
  });

  test("requiredConcepts are backed by taughtEvidence", () => {
    const { requiredConcepts, taughtEvidence } = buildLessonTruth(variationLesson).semantic;
    const evidencedIds = new Set(taughtEvidence.flatMap((ev) => ev.conceptIds));
    for (const concept of requiredConcepts) {
      expect(evidencedIds.has(concept.id)).toBe(true);
    }
  });

  test("no subTopicProfile is required", () => {
    const lessonWithoutProfile = {
      title: "Introductory chemistry ideas",
      subject: "Chemistry",
      pages: [
        {
          blocks: [
            {
              id: "teach-1",
              type: "text",
              role: "concept",
              title: "Particle model",
              content: "**Particle model** — matter is made of tiny particles.",
            },
          ],
        },
      ],
    };
    const result = buildLessonTruth(lessonWithoutProfile);
    expect(result.meta.subTopicProfileKey).toBeNull();
    expect(result.semantic.requiredConcepts.length).toBeGreaterThan(0);
  });

  test("topic/spec metadata cannot broaden requiredConcepts beyond taught evidence", () => {
    const lesson = {
      title: "Neutral lesson",
      topicKey: "biology:nervous-system-structure",
      specKey: "example-spec-with-unrelated-outcomes",
      pages: [
        {
          blocks: [
            {
              id: "only-taught",
              type: "text",
              role: "definition",
              title: "Definition",
              content: "**Target concept alpha** — a taught idea in this lesson only.",
            },
          ],
        },
      ],
    };
    const { requiredConcepts } = buildLessonTruth(lesson).semantic;
    const ids = requiredConcepts.map((c) => c.id);
    expect(ids).toContain("target_concept_alpha");
    expect(ids.some((id) => /neurone|synapse|cns|reflex/.test(id))).toBe(false);
  });

  test("not-taught concepts do not automatically populate outOfScope", () => {
    const { outOfScopeConcepts } = buildLessonTruth(variationLesson).semantic;
    expect(outOfScopeConcepts).toEqual([]);
  });

  test("inferred adjacency does not create assessmentExclusion", () => {
    const { assessmentExclusions } = buildLessonTruth(variationLesson).semantic;
    expect(assessmentExclusions).toEqual([]);
  });

  test("assessmentTargets is empty in Phase 1", () => {
    expect(buildLessonTruth(variationLesson).semantic.assessmentTargets).toEqual([]);
  });

  test("targetsDeferred is true in meta", () => {
    expect(buildLessonTruth(variationLesson).meta.targetsDeferred).toBe(true);
  });

  test("variation fixture independently expected required concepts from teaching blocks", () => {
    const { requiredConcepts, learningObjectives, taughtEvidence } = buildLessonTruth(variationLesson).semantic;
    const requiredIds = conceptIds(requiredConcepts);

    for (const expectedId of variationExpectations.requiredConceptIds) {
      expect(requiredIds).toContain(expectedId);
    }

    expect(learningObjectives.map((o) => o.text)).toEqual(variationExpectations.learningObjectiveTexts);

    for (const [conceptId, blockId] of Object.entries(variationExpectations.requiredConceptEvidenceBlocks)) {
      const evidence = taughtEvidence.find((ev) => ev.blockId === blockId);
      expect(evidence).toBeDefined();
      expect(evidence.conceptIds).toContain(conceptId);
    }
  });

  test("variation fixture excludes assessment-only drift from required and supporting concepts", () => {
    const { requiredConcepts, supportingConcepts } = buildLessonTruth(variationLesson).semantic;
    const allIds = [...requiredConcepts, ...supportingConcepts].map((c) => c.id);

    for (const forbiddenId of variationExpectations.mustNotAppearInRequiredOrSupportingIds) {
      expect(allIds).not.toContain(forbiddenId);
    }

    for (const supportingId of variationExpectations.supportingConceptIds) {
      expect(allIds).toContain(supportingId);
    }
  });

  test("assessment-only blocks do not produce taughtEvidence", () => {
    const { taughtEvidence } = buildLessonTruth(variationLesson).semantic;
    const evidenceBlockIds = taughtEvidence.map((ev) => ev.blockId);

    for (const blockId of variationExpectations.assessmentBlockIdsMustNotProduceEvidence) {
      expect(evidenceBlockIds).not.toContain(blockId);
    }

    for (const blockId of variationExpectations.teachingEvidenceBlockIds) {
      expect(evidenceBlockIds).toContain(blockId);
    }
  });

  test("summary text does not define required concepts", () => {
    const lesson = {
      title: "Topic review",
      pages: [
        {
          blocks: [
            {
              id: "teach-core",
              type: "text",
              role: "concept",
              title: "Core idea",
              content: "**Core idea alpha** — the only taught concept.",
            },
            {
              id: "summary-drift",
              type: "text",
              role: "summary",
              title: "Summary",
              content: "**Adjacent drift concept** — mentioned only in end-of-lesson summary.",
            },
          ],
        },
      ],
    };
    const { requiredConcepts, taughtEvidence } = buildLessonTruth(lesson).semantic;
    expect(taughtEvidence.some((ev) => ev.blockId === "summary-drift")).toBe(false);
    expect(conceptIds(requiredConcepts)).toEqual(["core_idea_alpha"]);
  });

  test("keywords/endgame text does not define required concepts", () => {
    const lesson = {
      title: "Topic review",
      pages: [
        {
          blocks: [
            {
              id: "teach-core",
              type: "text",
              role: "definition",
              title: "Definition",
              content: "**Primary taught term** — defined in teaching block.",
            },
            {
              id: "keywords-drift",
              type: "keywords",
              role: "keywords",
              title: "Key words",
              keywords: ["Adjacent keyword drift"],
              content: "**Adjacent keyword drift** — listed only in keywords block.",
            },
          ],
        },
      ],
    };
    const { requiredConcepts, taughtEvidence } = buildLessonTruth(lesson).semantic;
    expect(taughtEvidence.some((ev) => ev.blockId === "keywords-drift")).toBe(false);
    expect(conceptIds(requiredConcepts)).toEqual(["primary_taught_term"]);
  });

  test("mis-tagged question-like generic text without trusted teaching role is not teaching authority", () => {
    const suspiciousBlock = {
      id: "mis-tagged-assessment",
      type: "text",
      title: "Extra notes",
      question: "Define fertilisation.",
      content: "**Fertilisation** is the fusion of gamete nuclei.",
    };

    expect(isTeachingAuthorityBlock(suspiciousBlock)).toBe(false);

    const lesson = {
      title: "Mixed lesson",
      pages: [
        {
          blocks: [
            {
              id: "teach-core",
              type: "text",
              role: "concept",
              title: "Core idea",
              content: "**Core idea beta** — taught in a trusted role block.",
            },
            suspiciousBlock,
          ],
        },
      ],
    };

    const { requiredConcepts, taughtEvidence } = buildLessonTruth(lesson).semantic;
    expect(taughtEvidence.some((ev) => ev.blockId === "mis-tagged-assessment")).toBe(false);
    expect(conceptIds(requiredConcepts)).toEqual(["core_idea_beta"]);
  });

  test("lessons without explicit objectives may return empty learningObjectives", () => {
    const lesson = {
      title: "Title only lesson",
      pages: [
        {
          blocks: [
            {
              id: "teach-only",
              type: "text",
              role: "concept",
              title: "Observable pattern",
              content: "**Observable pattern** — described without explicit objectives.",
            },
          ],
        },
      ],
    };
    const result = buildLessonTruth(lesson).semantic;
    expect(result.learningObjectives).toEqual([]);
    expect(conceptIds(result.requiredConcepts)).toContain("observable_pattern");
  });

  test("insufficient evidence may yield empty requiredConcepts without promotion", () => {
    const lesson = {
      title: "Sparse mention lesson",
      pages: [
        {
          blocks: [
            {
              id: "summary-only-mention",
              type: "text",
              role: "summary",
              title: "Summary",
              content: "A passing mention of something without teaching authority.",
            },
          ],
        },
      ],
    };
    const result = buildLessonTruth(lesson).semantic;
    expect(result.requiredConcepts).toEqual([]);
    expect(result.taughtEvidence).toEqual([]);
  });

  test("production lessonTruth sources contain no fixture-specific Biology terms", () => {
    const source = readProductionLessonTruthSources().toLowerCase();
    for (const term of FIXTURE_BIOLOGY_TERMS) {
      expect(source.includes(term)).toBe(false);
    }
  });

  test("existing Teacher Brain exports remain available", () => {
    const teacherBrain = require("../lib/teacherBrain");
    expect(typeof runTeacherBrain).toBe("function");
    expect(typeof buildLessonTruth).toBe("function");
    expect(teacherBrain.buildLessonTruth).toBeUndefined();
    const output = runTeacherBrain({ topic: "Metabolism", subject: "Biology" });
    expect(output).toHaveProperty("coreConcepts");
    expect(output).toHaveProperty("coverageMap");
  });

  test("semantic equality ignores operational metadata", () => {
    const a = buildLessonTruth(variationLesson, { generatedAt: "2020-01-01T00:00:00.000Z" });
    const b = buildLessonTruth(variationLesson, { generatedAt: "2030-01-01T00:00:00.000Z" });
    expect(semanticEquals(a.semantic, b.semantic)).toBe(true);
    expect(a.meta.generatedAt).not.toBe(b.meta.generatedAt);
  });
});
