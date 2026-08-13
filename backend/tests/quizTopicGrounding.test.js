/**
 * Quiz Topic Grounding V1 — regression tests.
 */
const {
  GROUNDING_RESULT,
  classifyQuizQuestion,
  extractLessonTeachingText,
  filterQuizQuestionsByTopicGrounding,
  resolveGroundingProfileKey,
  stemAllowedForTopicScope,
} = require("../utils/quizTopicGrounding");
const { resolveTopicPack } = require("../utils/activityQuestionStemPacks");
const { normalizeStem } = require("../utils/validateLessonActivityQuestionCounts");
const { buildQuizBank, repairLessonActivityQuestionCounts } = require("../utils/repairLessonActivityQuestionCounts");

const MITOSIS_TOPIC_KEY = "aqa-gcse-biology:mitosis-cell-cycle";
const MITOSIS_EDEXCEL = "edexcel-igcse-biology:mitosis-cell-cycle";
const MEIOSIS_TOPIC_KEY = "aqa-gcse-biology:meiosis";
const PHOTOSYNTHESIS_KEY = "edexcel-igcse-biology:the-process-of-photosynthesis";
const RESPIRATION_KEY = "aqa-gcse-biology:respiration";

const mitosisPages = [
  {
    blocks: [
      {
        type: "text",
        content:
          "<p>Mitosis produces two genetically identical daughter cells. Chromosomes duplicate during interphase before mitosis.</p>",
      },
    ],
  },
];

const meiosisPages = [
  {
    blocks: [
      {
        type: "text",
        content:
          "<p>Meiosis produces haploid gametes. Fertilisation restores the diploid zygote chromosome number.</p>",
      },
    ],
  },
];

function mcq(stem, extra = {}) {
  return {
    type: "mcq",
    question: stem,
    options: ["A", "B", "C", "D"],
    correctAnswer: "A",
    ...extra,
  };
}

function mcqAssessed(stem, correctAnswer, options) {
  return {
    type: "mcq",
    question: stem,
    options,
    correctAnswer,
  };
}

describe("quizTopicGrounding", () => {
  const mitosisCtx = {
    topicKey: MITOSIS_TOPIC_KEY,
    specKey: "aqa-gcse-biology",
    topic: "Mitosis and the cell cycle",
    pages: mitosisPages,
  };

  const meiosisCtx = {
    topicKey: MEIOSIS_TOPIC_KEY,
    specKey: "aqa-gcse-biology",
    topic: "Meiosis",
    pages: meiosisPages,
  };

  test("resolves mitosis profile for AQA and Edexcel topic keys", () => {
    expect(resolveGroundingProfileKey(MITOSIS_TOPIC_KEY, "Mitosis and the cell cycle")).toBe(
      "mitosis-cell-cycle"
    );
    expect(resolveGroundingProfileKey(MITOSIS_EDEXCEL, "Mitosis and the cell cycle")).toBe(
      "mitosis-cell-cycle"
    );
  });

  describe("Mitosis lesson MUST accept", () => {
    const acceptStems = [
      "Why are daughter cells genetically identical?",
      "Why is mitosis important for growth?",
      "Why are chromosomes copied before mitosis?",
    ];

    for (const stem of acceptStems) {
      test(`accepts: ${stem}`, () => {
        const r = classifyQuizQuestion(mcq(stem), mitosisCtx);
        expect(r.result).toBe(GROUNDING_RESULT.PASS);
      });
    }
  });

  describe("Mitosis lesson MUST reject", () => {
    const rejectStems = [
      "Why must human gametes be haploid before fertilisation?",
      "Why does meiosis halve chromosome number?",
      "How does fertilisation restore the diploid number?",
    ];

    for (const stem of rejectStems) {
      test(`rejects: ${stem}`, () => {
        const r = classifyQuizQuestion(mcq(stem), mitosisCtx);
        expect(r.result).toBe(GROUNDING_RESULT.REJECT_CROSS_TOPIC);
      });
    }

    test("rejects mitosis/meiosis comparison when meiosis not taught", () => {
      const r = classifyQuizQuestion(mcq("How do mitosis and meiosis differ?"), mitosisCtx);
      expect(r.result).toBe(GROUNDING_RESULT.REJECT_CROSS_TOPIC);
    });
  });

  describe("extractLessonTeachingText — instructional haystack only", () => {
    const mitosisTopic = {
      topicKey: "edexcel-igcse-biology:mitosis",
      specKey: "edexcel-igcse-biology",
      topic: "Mitosis",
    };

    const coreTeachingOnly = [
      {
        blocks: [
          {
            type: "text",
            role: "coreTeaching",
            content:
              "<p>Mitosis produces two genetically identical diploid daughter cells.</p>",
          },
        ],
      },
    ];

    test("examPractice haploid prompt is not taught evidence", () => {
      const pages = [
        {
          blocks: [
            ...coreTeachingOnly[0].blocks,
            {
              type: "text",
              role: "examPractice",
              title: "Practice Questions",
              content:
                "<p>Why must human gametes be haploid before fertilisation?</p>",
            },
          ],
        },
      ];
      const teaching = extractLessonTeachingText(pages, { topic: mitosisTopic.topic });
      expect(teaching).not.toMatch(/human gametes be haploid/i);
      const r = classifyQuizQuestion(
        mcq("Why must human gametes be haploid before fertilisation?", {
          correctAnswer: "So fusion restores the diploid chromosome number in the zygote",
        }),
        { ...mitosisTopic, pages }
      );
      expect(r.result).toBe(GROUNDING_RESULT.REJECT_CROSS_TOPIC);
    });

    test("commonMistake haploid misconception is not taught evidence", () => {
      const pages = [
        {
          blocks: [
            ...coreTeachingOnly[0].blocks,
            {
              type: "misconceptions",
              role: "commonMistake",
              content:
                "Mistake: Mitosis produces haploid cells. Fix: Mitosis produces diploid cells.",
            },
          ],
        },
      ];
      const teaching = extractLessonTeachingText(pages, { topic: mitosisTopic.topic });
      expect(teaching).not.toMatch(/produces haploid cells/i);
      const r = classifyQuizQuestion(
        mcq("Why must human gametes be haploid before fertilisation?"),
        { ...mitosisTopic, pages }
      );
      expect(r.result).toBe(GROUNDING_RESULT.REJECT_CROSS_TOPIC);
    });

    test("examVocabulary glossary is excluded (terminology list, not explanatory teaching)", () => {
      const pages = [
        {
          blocks: [
            ...coreTeachingOnly[0].blocks,
            {
              type: "text",
              role: "examVocabulary",
              content:
                "<p><strong>Asexual reproduction</strong> – reproduction without gametes producing identical offspring.</p>",
            },
          ],
        },
      ];
      const teaching = extractLessonTeachingText(pages, { topic: mitosisTopic.topic });
      expect(teaching).not.toMatch(/\bgametes\b/i);
    });

    test("examTechnique contrast wording is not taught evidence", () => {
      const pages = [
        {
          blocks: [
            ...coreTeachingOnly[0].blocks,
            {
              type: "examTips",
              role: "examTechnique",
              content:
                "Avoid confusing <strong>mitosis</strong> with meiosis in inheritance questions.",
            },
          ],
        },
      ];
      const teaching = extractLessonTeachingText(pages, { topic: mitosisTopic.topic });
      expect(teaching).not.toMatch(/\bmeiosis\b/i);
      const r = classifyQuizQuestion(
        mcq("Why must human gametes be haploid before fertilisation?"),
        { ...mitosisTopic, pages }
      );
      expect(r.result).toBe(GROUNDING_RESULT.REJECT_CROSS_TOPIC);
    });

    test("substantive explanatory teaching of a neighbour concept may count as taught", () => {
      const pages = [
        {
          blocks: [
            {
              type: "text",
              role: "coreTeaching",
              content:
                "<p>Mitosis produces diploid cells. Meiosis is different: it halves chromosome number to produce haploid gametes for sexual reproduction.</p>",
            },
          ],
        },
      ];
      const teaching = extractLessonTeachingText(pages, { topic: mitosisTopic.topic });
      expect(teaching).toMatch(/\bmeiosis\b/i);
      expect(teaching).toMatch(/\bhaploid\b/i);
      const r = classifyQuizQuestion(
        mcq("Why must human gametes be haploid before fertilisation?", {
          correctAnswer: "So fertilisation restores the diploid number",
        }),
        { ...mitosisTopic, pages }
      );
      expect(r.result).toBe(GROUNDING_RESULT.PASS);
    });
  });

  test("Meiosis lesson accepts haploid gamete question", () => {
    const r = classifyQuizQuestion(
      mcq("Why must human gametes be haploid before fertilisation?"),
      meiosisCtx
    );
    expect(r.result).toBe(GROUNDING_RESULT.PASS);
  });

  test("bank-backed questions always pass", () => {
    const r = classifyQuizQuestion(
      mcq("Why must human gametes be haploid before fertilisation?", {
        sourceQuestionId: "abc123",
        sourceType: "topicQuizQuestion",
      }),
      mitosisCtx
    );
    expect(r.result).toBe(GROUNDING_RESULT.PASS);
    expect(r.reason).toBe("bank_backed");
  });

  /**
   * V2 TECHNICAL DEBT: validate sourceQuestionId against lesson topicKey rather than blind PASS.
   * Scenario: lesson duplicated from Topic A → retopiced to Topic B → stale sourceQuestionId remains.
   */
  test("bank-backed stale sourceQuestionId after retopic — current blind PASS (V2 debt)", () => {
    const r = classifyQuizQuestion(
      mcq("Why must human gametes be haploid before fertilisation?", {
        correctAnswer: "So fertilisation restores the diploid number",
        sourceQuestionId: "507f1f77bcf86cd799439011",
        sourceType: "topicQuizQuestion",
      }),
      mitosisCtx
    );
    expect(r.result).toBe(GROUNDING_RESULT.PASS);
    expect(r.reason).toBe("bank_backed");
  });

  describe("neutral stem — boundary assessed via correct answer, not distractors", () => {
    test("rejects haploid concept in correct answer only", () => {
      const r = classifyQuizQuestion(
        mcqAssessed(
          "Which statement is correct?",
          "Mitosis produces haploid cells.",
          [
            "Mitosis produces two genetically identical daughter cells",
            "Meiosis produces haploid gametes",
            "Fertilisation halves chromosome number",
          ]
        ),
        mitosisCtx
      );
      expect(r.result).toBe(GROUNDING_RESULT.REJECT_CROSS_TOPIC);
    });

    test("rejects halved chromosome number before fertilisation in correct answer only", () => {
      const r = classifyQuizQuestion(
        mcqAssessed(
          "Which statement is correct?",
          "The chromosome number is halved before fertilisation.",
          [
            "Mitosis produces two genetically identical daughter cells",
            "Chromosomes are copied during interphase",
            "Cytokinesis divides the cytoplasm",
          ]
        ),
        mitosisCtx
      );
      expect(r.result).toBe(GROUNDING_RESULT.REJECT_CROSS_TOPIC);
    });

    test("accepts in-topic correct answer when distractors mention neighbour concepts", () => {
      const r = classifyQuizQuestion(
        mcqAssessed(
          "Which statement is correct?",
          "Mitosis produces two genetically identical daughter cells.",
          [
            "Meiosis produces haploid gametes",
            "Gametes fuse during fertilisation",
            "Haploid cells are formed by mitosis",
          ]
        ),
        mitosisCtx
      );
      expect(r.result).toBe(GROUNDING_RESULT.PASS);
    });
  });

  test("photosynthesis rejects respiration-only question", () => {
    const r = classifyQuizQuestion(mcq("Explain aerobic respiration and ATP release in mitochondria."), {
      topicKey: PHOTOSYNTHESIS_KEY,
      specKey: "edexcel-igcse-biology",
      topic: "The Process of Photosynthesis",
      pages: [{ blocks: [{ type: "text", content: "Photosynthesis uses light energy in chloroplasts." }] }],
    });
    expect(r.result).toBe(GROUNDING_RESULT.REJECT_CROSS_TOPIC);
  });

  test("respiration rejects photosynthesis-only question", () => {
    const r = classifyQuizQuestion(mcq("Describe the word equation for photosynthesis."), {
      topicKey: RESPIRATION_KEY,
      specKey: "aqa-gcse-biology",
      topic: "Respiration",
      pages: [{ blocks: [{ type: "text", content: "Aerobic respiration releases ATP." }] }],
    });
    expect(r.result).toBe(GROUNDING_RESULT.REJECT_CROSS_TOPIC);
  });

  test("oestrogen topic rejects FSH-only question", () => {
    const r = classifyQuizQuestion(mcq("What is the role of FSH in the menstrual cycle?"), {
      topicKey:
        "edexcel-igcse-biology:hormones-adrenaline-insulin-testosterone-progesterone-and-oestrogen",
      specKey: "edexcel-igcse-biology",
      topic: "Hormones: oestrogen and progesterone",
      pages: [{ blocks: [{ type: "text", content: "Oestrogen and progesterone regulate the cycle." }] }],
    });
    expect(r.result).toBe(GROUNDING_RESULT.REJECT_CROSS_TOPIC);
  });

  test("FSH/LH topic rejects oestrogen-only question", () => {
    const r = classifyQuizQuestion(mcq("Describe the role of oestrogen in the menstrual cycle."), {
      topicKey: "edexcel-igcse-biology:the-role-of-hormones-adh-fsh-and-lh",
      specKey: "edexcel-igcse-biology",
      topic: "The role of hormones ADH, FSH and LH",
      pages: [{ blocks: [{ type: "text", content: "FSH and LH control ovulation." }] }],
    });
    expect(r.result).toBe(GROUNDING_RESULT.REJECT_CROSS_TOPIC);
  });

  test("filterQuizQuestionsByTopicGrounding removes cross-topic items", () => {
    const { questions, removed } = filterQuizQuestionsByTopicGrounding(
      [
        mcq("Why is mitosis important for growth?"),
        mcq("Why must human gametes be haploid before fertilisation?"),
        mcq("Why are daughter cells genetically identical?"),
      ],
      mitosisCtx
    );
    expect(questions).toHaveLength(2);
    expect(removed).toHaveLength(1);
    expect(removed[0].classification.result).toBe(GROUNDING_RESULT.REJECT_CROSS_TOPIC);
  });

  test("stem pack scope: mitosis pack resolves for mitosis topic, not meiosis-only stems", () => {
    const pack = resolveTopicPack("Mitosis and the cell cycle");
    expect(pack?.id).toBe("mitosis");
    const meiosisStem = (pack?.mcq || []).find((s) =>
      /gametes be haploid/i.test(s.prompt)
    );
    expect(meiosisStem).toBeUndefined();
    const haploidStem = { prompt: "Why must gametes be haploid before fertilisation?", topicScope: "meiosis" };
    expect(stemAllowedForTopicScope(haploidStem, MITOSIS_TOPIC_KEY, "Mitosis and the cell cycle")).toBe(
      false
    );
    expect(stemAllowedForTopicScope(haploidStem, MEIOSIS_TOPIC_KEY, "Meiosis")).toBe(true);
  });

  test("buildQuizBank for mitosis never includes haploid gamete fertilisation question", () => {
    const result = buildQuizBank(
      mitosisPages,
      { questions: [] },
      "Mitosis and the cell cycle",
      ["mitosis", "chromosomes", "daughter cells"],
      new Set(),
      5,
      {
        topicKey: MITOSIS_TOPIC_KEY,
        specKey: "aqa-gcse-biology",
        pages: mitosisPages,
      }
    );
    const stems = result.questions.map((q) => q.question);
    expect(stems.some((s) => /human gametes be haploid/i.test(s))).toBe(false);
    expect(stems.some((s) => /gametes be haploid/i.test(s))).toBe(false);
    expect(stems.some((s) => /fertilisation restore/i.test(s))).toBe(false);
    expect(result.questions.length).toBeGreaterThan(0);
  });

  test("count pressure: returns three grounded questions instead of padding with neighbour-topic MCQs to reach five", () => {
    const threeGrounded = {
      questions: [
        {
          type: "mcq",
          question: "Why is mitosis important for growth?",
          options: [
            "It produces genetically identical cells",
            "It halves chromosome number",
            "It forms haploid gametes",
            "It only happens in gametes",
          ],
          correctAnswer: "It produces genetically identical cells",
          purpose: "explain",
        },
        {
          type: "mcq",
          question: "How many genetically identical daughter cells does mitosis produce?",
          options: ["Two", "One", "Four", "None"],
          correctAnswer: "Two",
          purpose: "recall",
        },
        {
          type: "mcq",
          question: "Why are chromosomes copied before mitosis?",
          options: [
            "So each daughter cell gets a full identical set",
            "To halve chromosome number",
            "To form a zygote",
            "To produce variation",
          ],
          correctAnswer: "So each daughter cell gets a full identical set",
          purpose: "explain",
        },
      ],
    };

    const pack = resolveTopicPack("Mitosis and the cell cycle");
    const usedAcross = new Set();
    for (const s of pack?.mcq || []) usedAcross.add(normalizeStem(s.prompt));
    for (const s of pack?.short || []) usedAcross.add(normalizeStem(s.prompt));

    const result = buildQuizBank(
      mitosisPages,
      threeGrounded,
      "Mitosis and the cell cycle",
      ["mitosis", "chromosomes", "daughter cells"],
      usedAcross,
      5,
      {
        topicKey: MITOSIS_TOPIC_KEY,
        specKey: "aqa-gcse-biology",
        pages: mitosisPages,
      }
    );

    const neighbourRe = /meiosis|gamete|haploid|fertil/i;
    expect(result.questions.length).toBe(3);
    expect(result.questions.length).toBeLessThan(5);
    expect(result.questions.every((q) => !neighbourRe.test(q.question))).toBe(true);
    expect(result.groundingLimited).toBe(true);
  });

  test("repairLessonActivityQuestionCounts keeps three grounded quiz items without neighbour filler", () => {
    const pack = resolveTopicPack("Mitosis and the cell cycle");
    const shortStems = (pack?.short || []).filter((s) => s.topicScope === "mitosis");
    const mcqStems = (pack?.mcq || []).filter((s) => s.topicScope === "mitosis");

    const lesson = {
      pages: [
        {
          blocks: [
            {
              type: "text",
              content:
                "<p>Mitosis produces two genetically identical daughter cells. Chromosomes duplicate during interphase before mitosis.</p>",
            },
            {
              type: "selfCheck",
              questions: shortStems.map((s, i) => ({
                prompt: s.prompt,
                questionType: "short",
                correctAnswer: s.answer,
                purpose: s.purpose,
              })),
            },
            {
              type: "checkpoint",
              questions: mcqStems.map((s) => ({
                prompt: s.prompt,
                questionType: "mcq",
                options: [s.correct, ...s.distractors],
                correctAnswer: s.correct,
                purpose: s.purpose,
              })),
            },
          ],
        },
      ],
      quiz: {
        timeSeconds: 600,
        questions: [
          {
            type: "mcq",
            question: "Why is mitosis important for growth?",
            options: [
              "It produces genetically identical cells",
              "It halves chromosome number",
              "It forms haploid gametes",
              "It only happens in gametes",
            ],
            correctAnswer: "It produces genetically identical cells",
            purpose: "explain",
          },
          {
            type: "mcq",
            question: "How many genetically identical daughter cells does mitosis produce?",
            options: ["Two", "One", "Four", "None"],
            correctAnswer: "Two",
            purpose: "recall",
          },
          {
            type: "mcq",
            question: "Why are chromosomes copied before mitosis?",
            options: [
              "So each daughter cell gets a full identical set",
              "To halve chromosome number",
              "To form a zygote",
              "To produce variation",
            ],
            correctAnswer: "So each daughter cell gets a full identical set",
            purpose: "explain",
          },
        ],
      },
    };

    const out = repairLessonActivityQuestionCounts(lesson, {
      topic: "Mitosis and the cell cycle",
      topicKey: MITOSIS_TOPIC_KEY,
      specKey: "aqa-gcse-biology",
      vocabulary: ["mitosis", "chromosomes", "daughter cells"],
    });

    const neighbourRe = /meiosis|gamete|haploid|fertil/i;
    expect(out.quiz.questions).toHaveLength(3);
    expect(out.quiz.questions.every((q) => !neighbourRe.test(q.question))).toBe(true);
    expect(out.quizTopicGroundingLimited).toBe(true);
    const quizChange = out.changes.find((c) => c.kind === "quiz");
    expect(quizChange?.groundingLimited).toBe(true);
    expect(quizChange?.count).toBe(3);
  });
});
