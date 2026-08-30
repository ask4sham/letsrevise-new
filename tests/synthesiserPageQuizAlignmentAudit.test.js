/**
 * Phase 3 — Page Quiz shadow audit (observation only, no persistence changes).
 */

const {
  alignPageQuizCandidates,
  SHADOW_VERSION,
} = require("../lib/teacherBrain/lessonTruth/alignPageQuizCandidates");
const {
  runSynthesiserPageQuizShadowAudit,
  logSynthesiserPageQuizShadowAudit,
  buildShadowLogEvent,
  findPageQuizQuestions,
} = require("../backend/utils/synthesiserPageQuizAlignmentAudit");
const {
  adaptSynthesiserDraftToLessonCreate,
} = require("../backend/utils/lessonSynthesiserDraftAdapter");
const {
  getLessonSynthesiserPr10DraftFixture,
} = require("../backend/tests/fixtures/lessonSynthesiserPr10Draft.fixture");
const {
  ALIGNMENT_VERDICT,
  REASON_CODES,
} = require("../lib/teacherBrain/lessonTruth/assessmentTargetTypes");
const { buildLessonTruth } = require("../lib/teacherBrain/lessonTruth/buildLessonTruth");
const weimarLesson = require("./fixtures/lessonTruth/weimar-instability.lesson.json");

function mcq(id, prompt, correctAnswer, options) {
  return {
    id,
    type: "mcq",
    prompt,
    question: prompt,
    options,
    correctAnswer,
  };
}

function mutationLessonForShadow() {
  return {
    title: "Mutation",
    subject: "Biology",
    examBoard: "Edexcel",
    level: "IGCSE",
    tier: "Higher",
    topicKey: "edexcel-igcse-biology:reproduction/mutation",
    specKey: "edexcel-igcse-biology",
    topic: "Mutation",
    pages: [
      {
        blocks: [
          {
            type: "text",
            role: "lessonObjectives",
            content: "- Define mutation\n- Explain how mutation can affect proteins",
          },
          {
            type: "text",
            role: "definition",
            content: "**Mutation** is a change in the base sequence of DNA.",
          },
          {
            type: "text",
            role: "concept",
            content:
              "A change in the base sequence of a gene may change the amino acid sequence of the protein it codes for.",
          },
          {
            type: "text",
            role: "concept",
            content: "This may change the shape or function of the protein.",
          },
          {
            type: "text",
            role: "concept",
            content: "Some mutations have no effect on the phenotype.",
          },
          {
            type: "text",
            role: "concept",
            content: "Mutations can be caused by radiation or chemicals.",
          },
        ],
      },
    ],
  };
}

function mutationFiveSlotQuestions() {
  return [
    mcq(
      "quiz1",
      "A mutation changes the base sequence of a gene. What is a possible consequence of this change?",
      "The amino acid sequence of a protein may change",
      [
        "The amino acid sequence of a protein may change",
        "Mitosis produces identical cells",
        "Gametes fuse at fertilisation",
        "Chromosome number doubles",
      ]
    ),
    mcq("quiz2", "Define mutation.", "A change in the base sequence of DNA", [
      "A change in the base sequence of DNA",
      "A type of cell division",
      "Fusion of gametes",
      "Random fertilisation",
    ]),
    mcq("quiz3", "State one cause of mutation.", "Radiation", [
      "Radiation",
      "Mitosis",
      "Fertilisation",
      "Variation",
    ]),
    mcq("quiz4", "Explain how a mutation may affect a protein.", "It may change the protein shape", [
      "It may change the protein shape",
      "It always stops mitosis",
      "It creates gametes",
      "It prevents DNA copying",
    ]),
    mcq(
      "quiz5",
      "Why must human gametes be haploid before fertilisation?",
      "So fertilisation restores the diploid number",
      [
        "So fertilisation restores the diploid number",
        "To increase variation",
        "To speed up mitosis",
        "To form a zygote directly",
      ]
    ),
  ];
}

describe("alignPageQuizCandidates", () => {
  test("Mutation bad Q25 shadow = REGENERATE with drift reason", () => {
    const lesson = mutationLessonForShadow();
    const questions = mutationFiveSlotQuestions();
    const audit = alignPageQuizCandidates({ lesson, questions });
    const bad = audit.results.find((row) => row.slotIndex === 4);
    expect(bad.verdict).toBe(ALIGNMENT_VERDICT.REGENERATE);
    expect(
      bad.reasonCodes.some((code) =>
        [REASON_CODES.SUPPORTING_AS_PRIMARY, REASON_CODES.UNAUTHORIZED_CONCEPT].includes(code)
      )
    ).toBe(true);
  });

  test("valid Mutation replacement MCQ shadow = REVIEW / NO_PRIMARY_CONCEPT_MATCH", () => {
    const lesson = mutationLessonForShadow();
    const questions = mutationFiveSlotQuestions();
    const audit = alignPageQuizCandidates({ lesson, questions });
    const valid = audit.results.find((row) => row.slotIndex === 0);
    expect(valid.verdict).toBe(ALIGNMENT_VERDICT.REVIEW);
    expect(valid.reasonCodes).toContain(REASON_CODES.NO_PRIMARY_CONCEPT_MATCH);
  });

  test("target-bound Define mutation. on correct slot ACCEPT", () => {
    const lesson = mutationLessonForShadow();
    const questions = [
      mcq("quiz1", "Define mutation.", "A change in the base sequence of DNA", [
        "A change in the base sequence of DNA",
        "A type of cell division",
        "Fusion of gametes",
        "Random fertilisation",
      ]),
    ];
    const audit = alignPageQuizCandidates({ lesson, questions });
    expect(audit.results).toHaveLength(1);
    expect(audit.results[0].verdict).toBe(ALIGNMENT_VERDICT.ACCEPT);
    expect(audit.results[0].reasonCodes).toContain(REASON_CODES.AUTHORIZED);
  });

  test("five Page Quiz slots produce five targets, rows, and aggregate counts", () => {
    const lesson = mutationLessonForShadow();
    const questions = mutationFiveSlotQuestions();
    const audit = alignPageQuizCandidates({ lesson, questions });
    expect(audit.version).toBe(SHADOW_VERSION);
    expect(audit.status).toBe("ok");
    expect(audit.targets).toHaveLength(5);
    expect(audit.results).toHaveLength(5);
    expect(audit.summary.total).toBe(5);
    expect(audit.summary.accept + audit.summary.review + audit.summary.regenerate).toBe(5);
    expect(new Set(audit.results.map((row) => row.slotIndex)).size).toBe(5);
  });

  test("Weimar fixture smoke remains subject-agnostic", () => {
    const audit = alignPageQuizCandidates({
      lesson: weimarLesson,
      questions: [
        mcq("wq1", "Define hyperinflation.", "Very rapid increase in prices", [
          "Very rapid increase in prices",
          "Stable prices",
          "Low unemployment",
          "Strong currency",
        ]),
      ],
    });
    expect(audit.status).toBe("ok");
    expect(audit.results).toHaveLength(1);
    expect(["ACCEPT", "REVIEW", "REGENERATE"]).toContain(audit.results[0].verdict);
  });
});

describe("synthesiserPageQuizAlignmentAudit wrapper", () => {
  test("input lesson document is not mutated by shadow audit", () => {
    const lesson = mutationLessonForShadow();
    lesson.pages[0].blocks.push({
      type: "pageQuiz",
      questions: mutationFiveSlotQuestions(),
    });
    const snapshot = JSON.parse(JSON.stringify(lesson));
    runSynthesiserPageQuizShadowAudit(lesson);
    expect(lesson).toEqual(snapshot);
  });

  test("NO_PAGEQUIZ_BANK returns skipped without throw", () => {
    const lesson = mutationLessonForShadow();
    const audit = runSynthesiserPageQuizShadowAudit(lesson);
    expect(audit.status).toBe("skipped");
    expect(audit.reason).toBe("NO_PAGEQUIZ_BANK");
    expect(audit.summary.total).toBe(0);
  });

  test("PR10 synthesiser adapted draft locates five-question Page Quiz bank", () => {
    const createDoc = adaptSynthesiserDraftToLessonCreate(
      getLessonSynthesiserPr10DraftFixture().draft,
      { ownerTeacherId: "507f1f77bcf86cd799439011", teacherName: "Synth Owner" }
    );
    const questions = findPageQuizQuestions(createDoc);
    expect(questions).toHaveLength(5);
    const audit = runSynthesiserPageQuizShadowAudit(createDoc);
    expect(audit.status).toBe("ok");
    expect(audit.results).toHaveLength(5);
    expect(audit.summary.total).toBe(5);
  });

  test("structured log event is compact and excludes full lesson content", () => {
    const lesson = mutationLessonForShadow();
    lesson.metadata = {
      synthesiser: {
        source: "letsrevise-lesson-synthesiser",
        generator: "lesson-synthesiser-v1",
      },
    };
    lesson.pages[0].blocks.push({
      type: "pageQuiz",
      questions: mutationFiveSlotQuestions(),
    });
    const audit = runSynthesiserPageQuizShadowAudit(lesson);
    const event = buildShadowLogEvent(lesson, audit);
    expect(event.version).toBe(SHADOW_VERSION);
    expect(event.topicKey).toBe(lesson.topicKey);
    expect(event.results).toHaveLength(5);
    expect(event.results[0]).toHaveProperty("verdict");
    expect(event.results[0]).not.toHaveProperty("prompt");
    expect(event.results[0]).not.toHaveProperty("options");
    expect(event).not.toHaveProperty("lesson");
    expect(JSON.stringify(event).length).toBeLessThan(8000);

    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    logSynthesiserPageQuizShadowAudit(lesson, audit);
    expect(logSpy).toHaveBeenCalledWith(
      "[TeacherBrain][PageQuizShadow]",
      expect.any(String)
    );
    logSpy.mockRestore();
  });
});

describe("shadow audit external call safety", () => {
  test("buildLessonTruth and alignPageQuizCandidates remain local/deterministic", () => {
    const lesson = mutationLessonForShadow();
    const truth = buildLessonTruth(lesson);
    expect(truth.meta.contentHash).toBeTruthy();
    const audit = alignPageQuizCandidates({
      lesson,
      questions: mutationFiveSlotQuestions(),
    });
    expect(audit.lessonTruthHash).toBe(truth.meta.contentHash);
  });
});
