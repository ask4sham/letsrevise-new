/**
 * Block 28 Semantic Short-Answer Marking — unit tests (mock LLM, no DB).
 */
const {
  validateSemanticLlmPoints,
  deriveMarkingResult,
} = require("../services/semanticShortAnswerMarking/validate");
const { evidencePresentInAnswer } = require("../services/semanticShortAnswerMarking/evidence");
const { markShortAnswerSemantically } = require("../services/semanticShortAnswerMarking");
const mutationFixture = require("./fixtures/semanticMarking/mutation");
const crossTopicFixtures = require("./fixtures/semanticMarking/crossTopic");
const { buildMockLlmPoints } = require("./fixtures/semanticMarking/mockResponses");

describe("semanticShortAnswerMarking unit", () => {
  const markScheme = ["Point one about cells.", "Point two about energy."];
  const studentAnswer = "Cells have a nucleus. Mitochondria release energy.";

  test("SATISFIED requires evidence present in student answer", () => {
    const result = validateSemanticLlmPoints(
      {
        points: [
          {
            index: 1,
            judgement: "SATISFIED",
            studentEvidence: "nucleus",
            reason: "ok",
          },
          { index: 2, judgement: "NOT_EVIDENCED", studentEvidence: "", reason: "no" },
        ],
      },
      { markScheme, studentAnswer }
    );
    expect(result.ok).toBe(true);
  });

  test("rejects fabricated evidence", () => {
    const result = validateSemanticLlmPoints(
      {
        points: [
          {
            index: 1,
            judgement: "SATISFIED",
            studentEvidence: "chloroplast photosynthesis only",
            reason: "bad",
          },
          { index: 2, judgement: "NOT_EVIDENCED", studentEvidence: "", reason: "no" },
        ],
      },
      { markScheme, studentAnswer }
    );
    expect(result.ok).toBe(false);
  });

  test("one-word evidence accepted when present", () => {
    expect(evidencePresentInAnswer("mitosis", "mitosis")).toBe(true);
    const result = validateSemanticLlmPoints(
      {
        points: [
          {
            index: 1,
            judgement: "SATISFIED",
            studentEvidence: "mitosis",
            reason: "ok",
          },
          { index: 2, judgement: "NOT_EVIDENCED", studentEvidence: "", reason: "no" },
        ],
      },
      { markScheme: ["Mitosis produces identical cells.", "Second point."], studentAnswer: "mitosis" }
    );
    expect(result.ok).toBe(true);
  });

  test("rejects model output with awarded field", () => {
    const result = validateSemanticLlmPoints(
      {
        points: [
          {
            index: 1,
            judgement: "SATISFIED",
            studentEvidence: "nucleus",
            awarded: 1,
            reason: "bad",
          },
          { index: 2, judgement: "NOT_EVIDENCED", studentEvidence: "", reason: "no" },
        ],
      },
      { markScheme, studentAnswer }
    );
    expect(result.ok).toBe(false);
  });

  test("server derives score from judgements only", () => {
    const validated = [
      { index: 1, judgement: "SATISFIED", studentEvidence: "nucleus", reason: "a" },
      { index: 2, judgement: "CONTRADICTED", studentEvidence: "", reason: "b" },
    ];
    const derived = deriveMarkingResult(validated, markScheme, 2);
    expect(derived.score).toBe(1);
    expect(derived.maxMarks).toBe(2);
    expect(derived.isCorrect).toBe(false);
    expect(derived.points[0].awarded).toBe(1);
    expect(derived.points[1].awarded).toBe(0);
  });

  test("score capped at effectiveMarks", () => {
    const validated = [
      { index: 1, judgement: "SATISFIED", studentEvidence: "nucleus", reason: "a" },
      { index: 2, judgement: "SATISFIED", studentEvidence: "energy", reason: "b" },
    ];
    const derived = deriveMarkingResult(validated, markScheme, 1);
    expect(derived.score).toBe(1);
  });

  test("invalid point count fails validation", () => {
    const result = validateSemanticLlmPoints(
      { points: [{ index: 1, judgement: "NOT_EVIDENCED", studentEvidence: "", reason: "x" }] },
      { markScheme, studentAnswer }
    );
    expect(result.ok).toBe(false);
  });

  test("duplicate index fails validation", () => {
    const result = validateSemanticLlmPoints(
      {
        points: [
          { index: 1, judgement: "NOT_EVIDENCED", studentEvidence: "", reason: "a" },
          { index: 1, judgement: "NOT_EVIDENCED", studentEvidence: "", reason: "b" },
        ],
      },
      { markScheme, studentAnswer }
    );
    expect(result.ok).toBe(false);
  });

  test("markShortAnswerSemantically uses one corrective retry then unavailable", async () => {
    const previousFlag = process.env.BLOCK28_SEMANTIC_MARKING_V1;
    process.env.BLOCK28_SEMANTIC_MARKING_V1 = "1";
    try {
      let calls = 0;
      const lesson = {
        topicKey: "aqa-gcse-biology:mutation",
        subject: "Biology",
        level: "GCSE",
        examQuestions: [
          {
            _id: "507f1f77bcf86cd799439011",
            questionId: {
              _id: "507f1f77bcf86cd799439012",
              type: "short",
              question: "Q?",
              marks: 2,
              markScheme: markScheme,
              status: "published",
              topicKey: "aqa-gcse-biology:mutation",
            },
          },
        ],
      };

      const result = await markShortAnswerSemantically({
        lesson,
        questionId: "507f1f77bcf86cd799439012",
        studentAnswer,
        generateJson: async () => {
          calls += 1;
          return { points: [{ index: 1, judgement: "SATISFIED", studentEvidence: "nucleus", reason: "x" }] };
        },
      });

      expect(calls).toBe(2);
      expect(result.status).toBe("unavailable");
    } finally {
      if (previousFlag === undefined) {
        delete process.env.BLOCK28_SEMANTIC_MARKING_V1;
      } else {
        process.env.BLOCK28_SEMANTIC_MARKING_V1 = previousFlag;
      }
    }
  });

  test("provider failure returns unavailable not score", async () => {
    process.env.BLOCK28_SEMANTIC_MARKING_V1 = "1";
    const lesson = {
      topicKey: "aqa-gcse-biology:mutation",
      examQuestions: [
        {
          questionId: {
            _id: "507f1f77bcf86cd799439012",
            type: "short",
            question: "Q?",
            marks: 2,
            markScheme: markScheme,
            status: "published",
            topicKey: "aqa-gcse-biology:mutation",
          },
        },
      ],
    };
    const result = await markShortAnswerSemantically({
      lesson,
      questionId: "507f1f77bcf86cd799439012",
      studentAnswer,
      generateJson: async () => {
        const err = new Error("timeout");
        err.code = "ETIMEDOUT";
        throw err;
      },
    });
    expect(result.status).toBe("unavailable");
    delete process.env.BLOCK28_SEMANTIC_MARKING_V1;
  });

  test("feature flag off returns unavailable", async () => {
    delete process.env.BLOCK28_SEMANTIC_MARKING_V1;
    const result = await markShortAnswerSemantically({
      lesson: { topicKey: "aqa-gcse-biology:mutation", examQuestions: [] },
      questionId: "507f1f77bcf86cd799439012",
      studentAnswer: "test",
    });
    expect(result.status).toBe("unavailable");
  });

  describe("Mutation golden fixtures (mock plumbing)", () => {
    beforeEach(() => {
      process.env.BLOCK28_SEMANTIC_MARKING_V1 = "1";
    });
    afterEach(() => {
      delete process.env.BLOCK28_SEMANTIC_MARKING_V1;
    });

    const lessonBase = {
      topicKey: "aqa-gcse-biology:mutation",
      subject: "Biology",
      level: "GCSE",
    };

    for (const c of mutationFixture.cases) {
      test(`mutation case ${c.id} mock plumbing score ${c.expectedScore}`, async () => {
        const lesson = {
          ...lessonBase,
          examQuestions: [
            {
              questionId: {
                _id: "507f1f77bcf86cd799439099",
                type: "short",
                question: mutationFixture.question,
                marks: mutationFixture.marks,
                markScheme: mutationFixture.markScheme,
                correctAnswer: c.staleCorrectAnswer || "STALE",
                status: "published",
                topicKey: "aqa-gcse-biology:mutation",
              },
            },
          ],
        };

        const result = await markShortAnswerSemantically({
          lesson,
          questionId: "507f1f77bcf86cd799439099",
          studentAnswer: c.answer,
          generateJson: async () => ({
            points: buildMockLlmPoints(c.expectedScore, mutationFixture.markScheme, c.answer),
          }),
        });

        expect(result.status).toBe("ok");
        expect(result.score).toBe(c.expectedScore);
        expect(result.maxMarks).toBe(4);
      });
    }
  });

  describe("Cross-topic fixtures (mock plumbing)", () => {
    beforeEach(() => {
      process.env.BLOCK28_SEMANTIC_MARKING_V1 = "1";
    });
    afterEach(() => {
      delete process.env.BLOCK28_SEMANTIC_MARKING_V1;
    });

    for (const topic of crossTopicFixtures) {
      for (const c of topic.cases) {
        test(`${topic.topic} / ${c.id} mock plumbing`, async () => {
          const lesson = {
            topicKey: `aqa-gcse-biology:${topic.topic}`,
            subject: "Biology",
            level: "GCSE",
            examQuestions: [
              {
                questionId: {
                  _id: "507f1f77bcf86cd799439088",
                  type: "short",
                  question: topic.question,
                  marks: topic.marks,
                  markScheme: topic.markScheme,
                  status: "published",
                  topicKey: `aqa-gcse-biology:${topic.topic}`,
                },
              },
            ],
          };

          const result = await markShortAnswerSemantically({
            lesson,
            questionId: "507f1f77bcf86cd799439088",
            studentAnswer: c.answer,
            generateJson: async () => ({
              points: buildMockLlmPoints(c.expectedScore, topic.markScheme, c.answer),
            }),
          });

          expect(result.status).toBe("ok");
          expect(result.score).toBe(c.expectedScore);
        });
      }
    }
  });
});
