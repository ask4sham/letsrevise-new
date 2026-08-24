/**
 * Synthesiser ingestion — quiz topic grounding filter (no repair).
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const {
  groundLessonQuizBeforePersist,
  isSynthesiserLessonProvenance,
} = require("../utils/groundLessonQuizBeforePersist");
const {
  getLessonSynthesiserPr10DraftFixture,
} = require("./fixtures/lessonSynthesiserPr10Draft.fixture");

process.env.LETSREVISE_LESSON_SYNTHESISER_TOKEN =
  process.env.LETSREVISE_LESSON_SYNTHESISER_TOKEN || "test-synthesiser-token-pr72";

const TOKEN = process.env.LETSREVISE_LESSON_SYNTHESISER_TOKEN;
const MITOSIS_TOPIC_KEY = "aqa-gcse-biology:mitosis-cell-cycle";
const hashedPassword = bcrypt.hashSync("password123", 10);

function mcqQuestion(stem, correctAnswer, options) {
  return {
    type: "mcq",
    question: stem,
    prompt: stem,
    options,
    correctAnswer,
    purpose: "explain",
  };
}

const validMitosisQuiz = [
  mcqQuestion(
    "Why is mitosis important for growth?",
    "It produces genetically identical cells",
    [
      "It produces genetically identical cells",
      "It halves chromosome number",
      "It forms haploid gametes",
      "It only happens in gametes",
    ]
  ),
  mcqQuestion(
    "How many genetically identical daughter cells does mitosis produce?",
    "Two",
    ["Two", "One", "Four", "None"]
  ),
  mcqQuestion(
    "Why are chromosomes copied before mitosis?",
    "So each daughter cell gets a full identical set",
    [
      "So each daughter cell gets a full identical set",
      "To halve chromosome number",
      "To form a zygote",
      "To produce variation",
    ]
  ),
];

const badNeighbourQuiz = mcqQuestion(
  "Why must human gametes be haploid before fertilisation?",
  "So fertilisation restores the diploid number",
  [
    "So fertilisation restores the diploid number",
    "To increase variation",
    "To speed up mitosis",
    "To form a zygote directly",
  ]
);

const extraValidMitosis = mcqQuestion(
  "Why are daughter cells genetically identical after mitosis?",
  "Chromosomes duplicate then separate equally",
  [
    "Chromosomes duplicate then separate equally",
    "Gametes fuse at fertilisation",
    "Meiosis halves chromosome number",
    "DNA is destroyed before division",
  ]
);

const MITOSIS_TEACHING_SNIPPET =
  "Mitosis produces two genetically identical daughter cells during the cell cycle.";

/** PR10 fixture pages teach gametes/fertilisation — scrub so mitosis grounding is realistic. */
function scrubDraftPagesToMitosisTeaching(pages) {
  for (const page of pages || []) {
    for (const block of page?.blocks || []) {
      const type = String(block?.type || "").toLowerCase();
      if (["checkpoint", "selfcheck", "pagequiz"].includes(type)) continue;
      if (typeof block.content === "string") {
        block.content = MITOSIS_TEACHING_SNIPPET;
      }
      if (typeof block.title === "string" && /gamete|fertilis/i.test(block.title)) {
        block.title = "Mitosis and the cell cycle";
      }
      if (Array.isArray(block.items)) {
        for (const item of block.items) {
          if (item && typeof item.text === "string") {
            item.text = MITOSIS_TEACHING_SNIPPET;
          }
        }
      }
    }
  }
}

function mitosisSynthesiserEnvelope(quizQuestions) {
  const payload = getLessonSynthesiserPr10DraftFixture();
  payload.draft.title = "Mitosis and the cell cycle";
  payload.draft.topic = "Mitosis and the cell cycle";
  payload.draft.topicKey = MITOSIS_TOPIC_KEY;
  payload.draft.specKey = "aqa-gcse-biology";
  payload.draft.board = "AQA";
  payload.draft.level = "GCSE";
  payload.draft.description =
    "By the end of this lesson, students can explain mitosis and the cell cycle.";
  scrubDraftPagesToMitosisTeaching(payload.draft.pages);

  const pageQuizBlock = payload.draft.pages
    .flatMap((p) => (p.blocks || []).map((b) => ({ b, pageId: p.pageId })))
    .find(({ b }) => b.type === "pageQuiz")?.b;

  const fiveQuiz = quizQuestions.slice(0, 5);
  while (fiveQuiz.length < 5) {
    fiveQuiz.push({ ...extraValidMitosis });
  }

  payload.draft.quiz = { timeSeconds: 600, questions: fiveQuiz.map((q) => ({ ...q })) };
  if (pageQuizBlock) {
    pageQuizBlock.questions = fiveQuiz.map((q) => ({ ...q }));
  }

  return payload;
}

describe("Synthesiser ingestion quiz grounding", () => {
  let ownerTeacher;
  let teacherToken;

  beforeAll(async () => {
    ownerTeacher = await User.create({
      firstName: "Synth",
      lastName: "Ground",
      email: `synth-ground-${Date.now()}@test.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    process.env.LETSREVISE_SYNTHESISER_OWNER_TEACHER_ID = String(ownerTeacher._id);

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: ownerTeacher.email, password: "password123" });
    teacherToken = loginRes.body?.token;
    if (!teacherToken) throw new Error("Teacher login failed");
  });

  afterAll(async () => {
    if (ownerTeacher?._id) {
      await Lesson.deleteMany({ teacherId: ownerTeacher._id });
      await User.deleteOne({ _id: ownerTeacher._id });
    }
  });

  test("isSynthesiserLessonProvenance recognises metadata.synthesiser", () => {
    expect(
      isSynthesiserLessonProvenance({
        metadata: { synthesiser: { source: "letsrevise-lesson-synthesiser" } },
      })
    ).toBe(true);
    expect(isSynthesiserLessonProvenance({ metadata: {} })).toBe(false);
  });

  test("groundLessonQuizBeforePersist filters assessed content, not distractors only", () => {
    const doc = {
      topicKey: MITOSIS_TOPIC_KEY,
      specKey: "aqa-gcse-biology",
      topic: "Mitosis and the cell cycle",
      pages: [
        {
          blocks: [
            {
              type: "text",
              content: "Mitosis produces genetically identical daughter cells.",
            },
          ],
        },
      ],
      quiz: {
        questions: [
          mcqQuestion(
            "Which statement is correct?",
            "Mitosis produces two genetically identical daughter cells.",
            [
              "Meiosis produces haploid gametes",
              "Gametes fuse during fertilisation",
              "Haploid cells are formed by mitosis",
            ]
          ),
          badNeighbourQuiz,
        ],
      },
    };
    const result = groundLessonQuizBeforePersist(doc);
    expect(result.groundingApplied).toBe(true);
    expect(doc.quiz.questions).toHaveLength(1);
    expect(doc.quiz.questions[0].correctAnswer).toMatch(/genetically identical daughter cells/i);
  });

  describe("Path A — POST /api/lesson-synthesiser/drafts", () => {
    test("removes cross-topic quiz and mirrors pageQuiz", async () => {
      const payload = mitosisSynthesiserEnvelope([
        ...validMitosisQuiz,
        badNeighbourQuiz,
        extraValidMitosis,
      ]);

      const res = await request(app)
        .post("/api/lesson-synthesiser/drafts")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send(payload);

      expect(res.status).toBe(201);
      const lesson = await Lesson.findById(res.body.lessonId).lean();
      expect(lesson.quiz.questions).toHaveLength(4);
      expect(
        lesson.quiz.questions.some((q) => /human gametes be haploid/i.test(q.question))
      ).toBe(false);

      const pageQuiz = lesson.pages
        .flatMap((p) => p.blocks || [])
        .find((b) => b.type === "pageQuiz");
      expect(pageQuiz.questions).toHaveLength(4);
      expect(
        pageQuiz.questions.some((q) => /human gametes be haploid/i.test(q.question || q.prompt))
      ).toBe(false);
    });

    test("does not add replacement filler when grounded count is below five", async () => {
      const payload = mitosisSynthesiserEnvelope([
        ...validMitosisQuiz,
        badNeighbourQuiz,
        extraValidMitosis,
      ]);

      const res = await request(app)
        .post("/api/lesson-synthesiser/drafts")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send(payload);

      const lesson = await Lesson.findById(res.body.lessonId).lean();
      expect(lesson.quiz.questions.length).toBe(4);
      expect(lesson.quiz.questions.length).toBeLessThan(5);
    });

    test("preserves valid mitosis question when distractors mention meiosis", async () => {
      const withMeiosisDistractors = mcqQuestion(
        "Why is mitosis important for growth?",
        "It produces genetically identical cells",
        [
          "It produces genetically identical cells",
          "Meiosis halves chromosome number",
          "Gametes fuse during fertilisation",
          "Haploid cells are formed by mitosis",
        ]
      );
      const payload = mitosisSynthesiserEnvelope([
        withMeiosisDistractors,
        ...validMitosisQuiz.slice(1),
        badNeighbourQuiz,
        extraValidMitosis,
      ]);

      const res = await request(app)
        .post("/api/lesson-synthesiser/drafts")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send(payload);

      expect(res.status).toBe(201);
      const lesson = await Lesson.findById(res.body.lessonId).lean();
      expect(
        lesson.quiz.questions.some((q) => /mitosis important for growth/i.test(q.question))
      ).toBe(true);
    });

    test("leaves unprofiled topic quiz unchanged", async () => {
      const payload = getLessonSynthesiserPr10DraftFixture();
      payload.draft.topicKey = "aqa-gcse-biology:diffusion";
      payload.draft.specKey = "aqa-gcse-biology";
      payload.draft.topic = "Diffusion";
      const five = [...validMitosisQuiz, badNeighbourQuiz, extraValidMitosis].slice(0, 5);
      payload.draft.quiz = { timeSeconds: 600, questions: five.map((q) => ({ ...q })) };

      const res = await request(app)
        .post("/api/lesson-synthesiser/drafts")
        .set("Authorization", `Bearer ${TOKEN}`)
        .send(payload);

      expect(res.status).toBe(201);
      const lesson = await Lesson.findById(res.body.lessonId).lean();
      expect(lesson.quiz.questions).toHaveLength(5);
    });
  });

  describe("Path B — POST /api/lessons with Synthesiser provenance", () => {
    function createLessonPayload(quizQuestions, pageQuizQuestions = quizQuestions) {
      return {
        title: "Mitosis JSON import",
        description: "Imported synthesiser lesson",
        content: "Structured lesson (see pages)",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        topic: "Mitosis and the cell cycle",
        topicKey: MITOSIS_TOPIC_KEY,
        specKey: "aqa-gcse-biology",
        estimatedDuration: 30,
        metadata: {
          synthesiser: {
            source: "letsrevise-lesson-synthesiser",
            generator: "lesson-synthesiser-v1",
            criticOk: true,
            importedAt: new Date().toISOString(),
          },
        },
        pages: [
          {
            pageId: "page_practise_1",
            title: "Practise",
            order: 1,
            blocks: [
              {
                type: "text",
                content:
                  "<p>Mitosis produces two genetically identical daughter cells.</p>",
              },
              {
                type: "pageQuiz",
                questions: pageQuizQuestions.map((q) => ({
                  prompt: q.question,
                  questionType: "mcq",
                  options: q.options,
                  correctAnswer: q.correctAnswer,
                  purpose: q.purpose,
                })),
              },
            ],
          },
        ],
        quiz: {
          timeSeconds: 600,
          questions: quizQuestions.map((q) => ({
            id: `q_${q.question.slice(0, 8)}`,
            type: "mcq",
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            purpose: q.purpose,
            pageId: "page_practise_1",
            tags: ["page-quiz"],
          })),
        },
      };
    }

    test("filters quiz on create when metadata.synthesiser is present", async () => {
      const res = await request(app)
        .post("/api/lessons")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send(createLessonPayload([...validMitosisQuiz, badNeighbourQuiz]));

      expect(res.status).toBe(200);
      const lessonId = res.body?.lesson?._id || res.body?.lesson?.id;
      const lesson = await Lesson.findById(lessonId).lean();
      expect(lesson.quiz.questions).toHaveLength(3);
      expect(
        lesson.quiz.questions.some((q) => /gametes be haploid/i.test(q.question))
      ).toBe(false);

      const pageQuiz = lesson.pages[0].blocks.find((b) => b.type === "pageQuiz");
      expect(pageQuiz.questions).toHaveLength(3);
    });

    test("does not filter manual lessons without synthesiser provenance", async () => {
      const body = createLessonPayload([...validMitosisQuiz, badNeighbourQuiz]);
      delete body.metadata;

      const res = await request(app)
        .post("/api/lessons")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send(body);

      expect(res.status).toBe(200);
      const lessonId = res.body?.lesson?._id || res.body?.lesson?.id;
      const lesson = await Lesson.findById(lessonId).lean();
      expect(lesson.quiz.questions).toHaveLength(4);
    });
  });
});
