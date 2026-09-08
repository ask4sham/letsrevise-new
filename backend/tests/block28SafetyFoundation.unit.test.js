/**
 * Block 28 Safety Foundation V2 — attach, publish, regen duplicate, census.
 */
const { validateMastersForBlock28Attach } = require("../utils/block28AttachGuard");
const { wouldBlock28RegenerationDuplicateAttach } = require("../utils/block28RegenerationDuplicateGuard");
const { validateBlock28LessonPublishIntegrity } = require("../utils/block28PublishIntegrity");
const {
  simulateLessonAfterLessonEdits,
  validateBlock28NoRegressionOnPublishedLesson,
  validateBlock28NoRegressionOnPublishedLessonMasters,
} = require("../utils/block28PublishedMutationGuard");
const { runBlock28IntegrityCensus } = require("../services/block28Phase2/integrityCensus");
const { buildBlock28IntegrityHealth } = require("../services/block28Phase2/integrityHealth");
const { validateExamQuestionRow } = require("../services/csvContentImportService");

describe("Block 28 Safety Foundation V2", () => {
  test("pre-attach rejects invalid short master", () => {
    const lesson = { examQuestions: [] };
    const masters = [
      {
        _id: "q1",
        type: "short",
        question: "Describe meiosis?",
        marks: 3,
        markScheme: ["only one point"],
      },
    ];
    const out = validateMastersForBlock28Attach(masters, lesson, new Map([["q1", masters[0]]]));
    expect(out.ok).toBe(false);
    expect(out.errors[0].code).toBe("MARK_SCHEME_COUNT_MISMATCH");
  });

  test("regeneration duplicate guard blocks HIGH conceptual duplicate attach", () => {
    const masterA = {
      _id: "a",
      type: "short",
      question: "Explain how meiosis produces genetic variation in gametes.",
      marks: 2,
      markScheme: ["A", "B"],
    };
    const masterB = {
      _id: "b",
      type: "short",
      question: "Explain how meiosis contributes to genetic variation in gametes.",
      marks: 2,
      markScheme: ["C", "D"],
    };
    const lesson = { examQuestions: [{ questionId: "a" }] };
    const mastersById = new Map([["a", masterA], ["b", masterB]]);
    const dup = wouldBlock28RegenerationDuplicateAttach(lesson, masterB, mastersById);
    expect(dup.duplicate).toBe(true);
    expect(dup.reason).toBe("CONCEPTUAL_HIGH");
  });

  test("publish gate fails invalid served short", () => {
    const master = {
      _id: "m1",
      type: "short",
      question: "What is an allele?",
      marks: 3,
      markScheme: ["one"],
    };
    const lesson = {
      _id: "l1",
      examQuestions: [{ questionId: "m1" }],
    };
    const out = validateBlock28LessonPublishIntegrity(lesson, new Map([["m1", master]]), 10);
    expect(out.ok).toBe(false);
    expect(out.issues.some((i) => i.code === "MARK_SCHEME_COUNT_MISMATCH")).toBe(true);
  });

  test("publish gate passes clean served short", () => {
    const master = {
      _id: "m1",
      type: "short",
      question: "What is an allele?",
      marks: 2,
      markScheme: ["Alternative form of a gene.", "Found at the same locus."],
    };
    const lesson = {
      _id: "l1",
      examQuestions: [{ questionId: "m1" }],
    };
    const out = validateBlock28LessonPublishIntegrity(lesson, new Map([["m1", master]]), 10);
    expect(out.ok).toBe(true);
  });

  test("import row rejects invalid short invariant", () => {
    const row = {
      questionText: "Explain photosynthesis?",
      markScheme: "Only one point",
      marks: "3",
      specKey: "edexcel-igcse-biology",
      topicKey: "dna-structure",
      questionType: "short",
    };
    const v = validateExamQuestionRow(row, {});
    expect(v.valid).toBe(false);
    expect(String(v.error)).toMatch(/mark-scheme/i);
  });

  test("import row accepts matching marks and independent scheme points", () => {
    const row = {
      questionText: "Explain how DNA replication maintains genetic information?",
      markScheme: "Helicase unwinds the double helix|DNA polymerase adds complementary nucleotides|Hydrogen bonds reform between bases",
      marks: "3",
      specKey: "edexcel-igcse-biology",
      topicKey: "dna-structure",
      questionType: "short",
    };
    const v = validateExamQuestionRow(row, {});
    expect(v.valid).toBe(true);
  });

  test("published clean lesson rejects lessonEdit regression", () => {
    const master = {
      _id: "m1",
      type: "short",
      question: "What is an allele?",
      marks: 2,
      markScheme: ["Alternative form of a gene.", "Found at the same locus."],
    };
    const lesson = {
      _id: "l1",
      isPublished: true,
      status: "published",
      examQuestions: [{ questionId: "m1" }],
    };
    const lessonAfter = simulateLessonAfterLessonEdits(lesson, [
      {
        questionId: "m1",
        lessonEdit: {
          type: "short",
          question: "What is an allele?",
          marks: 3,
          markScheme: ["Only one point"],
        },
      },
    ]);
    const gate = validateBlock28NoRegressionOnPublishedLesson(
      lesson,
      lessonAfter,
      new Map([["m1", master]]),
      10
    );
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBe("BLOCK28_REGRESSION");
  });

  test("legacy-invalid published lesson allows remediation edits", () => {
    const master = {
      _id: "m1",
      type: "short",
      question: "Describe DNA?",
      marks: 2,
      markScheme: ["one"],
    };
    const lesson = {
      _id: "l1",
      isPublished: true,
      status: "published",
      examQuestions: [{ questionId: "m1" }],
    };
    const lessonAfter = simulateLessonAfterLessonEdits(lesson, [
      {
        questionId: "m1",
        lessonEdit: {
          type: "short",
          question: "Describe DNA structure?",
          marks: 2,
          markScheme: ["Double helix", "Base pairing"],
        },
      },
    ]);
    const gate = validateBlock28NoRegressionOnPublishedLesson(
      lesson,
      lessonAfter,
      new Map([["m1", master]]),
      10
    );
    expect(gate.ok).toBe(true);
    expect(gate.reason).toBe("LEGACY_INVALID_PUBLISHED");
  });

  test("published clean lesson rejects QB master update regression", () => {
    const masterBefore = {
      _id: "m1",
      type: "short",
      question: "What is an allele?",
      marks: 2,
      markScheme: ["Alternative form of a gene.", "Found at the same locus."],
    };
    const masterAfter = {
      ...masterBefore,
      marks: 3,
      markScheme: ["Only one point"],
    };
    const lesson = {
      _id: "l1",
      isPublished: true,
      status: "published",
      examQuestions: [{ questionId: "m1" }],
    };
    const mastersBefore = new Map([["m1", masterBefore]]);
    const mastersAfter = new Map([["m1", masterAfter]]);
    const gate = validateBlock28NoRegressionOnPublishedLessonMasters(
      lesson,
      mastersBefore,
      mastersAfter,
      10
    );
    expect(gate.ok).toBe(false);
    expect(gate.reason).toBe("BLOCK28_REGRESSION");
  });

  test("integrity census reports invalid served count", () => {
    const master = {
      _id: "m1",
      type: "short",
      question: "Describe DNA?",
      marks: 2,
      markScheme: ["one"],
    };
    const lesson = {
      _id: "l1",
      title: "Test",
      topicKey: "edexcel-igcse-biology:dna",
      status: "published",
      examQuestions: [{ questionId: "m1" }],
    };
    const census = runBlock28IntegrityCensus(
      [lesson],
      new Map([["m1", master]]),
      new Map([["m1", 1]]),
      { publishedOnly: true }
    );
    expect(census.totals.lessonsScanned).toBe(1);
    expect(census.totals.invalidServedQuestions).toBe(1);
    const health = buildBlock28IntegrityHealth(census);
    expect(health.status).toBe("BLOCKED");
    expect(health.invalidServedQuestions).toBe(1);
  });
});
