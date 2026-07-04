/**
 * AI lesson asset generation — exam draft pipeline (stability).
 * Mocks LLM generators; verifies save + bank filter contract for Edexcel long topics.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");

jest.mock("../services/generateFlashcardsFromLesson", () => ({
  generateFlashcardsFromLesson: jest.fn().mockResolvedValue([]),
}));
jest.mock("../services/generateQuizQuestionsFromLesson", () => ({
  generateQuizQuestionsFromLesson: jest.fn().mockResolvedValue([]),
}));
jest.mock("../services/generateExamQuestionsFromLesson", () => ({
  generateExamQuestionsFromLesson: jest.fn(),
}));

const { generateExamQuestionsFromLesson } = require("../services/generateExamQuestionsFromLesson");

const hashedPassword = bcrypt.hashSync("password123", 10);
const OESTROGEN_SLUG = "roles-of-oestrogen-and-progesterone-in-the-menstrual-cycle";
const NAMESPACED = `edexcel-igcse-biology:${OESTROGEN_SLUG}`;

function validExamDraft(i) {
  return {
    type: "short",
    question: `Explain the role of oestrogen in the menstrual cycle (variant ${i}).`,
    marks: 4,
    commandWord: "Explain",
    markScheme: [
      "Oestrogen stimulates repair and thickening of the uterus lining after menstruation.",
      "High oestrogen inhibits FSH and triggers an LH surge leading to ovulation.",
    ],
    modelAnswer:
      "Oestrogen repairs and thickens the uterus lining and, at high levels, inhibits FSH while triggering the LH surge that causes ovulation.",
  };
}

describe("POST /api/lessons/:id/generate-assets exam drafts", () => {
  let teacherToken;
  let teacherId;
  let lessonId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Exam",
      lastName: "Draft",
      email: "exam-draft-gen@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "exam-draft-gen@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");

    const lesson = await Lesson.create({
      title: "Oestrogen and Progesterone",
      description: "Menstrual cycle hormones lesson for asset generation tests.",
      content: "Oestrogen and progesterone in the menstrual cycle.",
      subject: "Biology",
      board: "Edexcel",
      level: "IGCSE",
      specKey: "edexcel-igcse-biology",
      topicKey: NAMESPACED,
      topic: "Metabolism",
      subTopic: "Roles of oestrogen and progesterone in the menstrual cycle",
      teacherId,
      teacherName: "Exam Draft",
      status: "draft",
      pages: [
        {
          pageId: "p1",
          title: "Hormones",
          order: 1,
          blocks: [
            {
              type: "text",
              content:
                "Oestrogen repairs the uterus lining and peaks before ovulation. Progesterone maintains the lining after ovulation. FSH and LH control the cycle. Hormone levels can be read from graphs to identify ovulation timing.",
            },
          ],
        },
      ],
    });
    lessonId = String(lesson._id);
  });

  afterAll(async () => {
    await ExamQuestion.deleteMany({ teacherId });
    await Lesson.deleteMany({ teacherId });
    await User.deleteMany({ email: "exam-draft-gen@test.com" });
  });

  beforeEach(async () => {
    await ExamQuestion.deleteMany({ teacherId, "metadata.source": "ai_lesson_assets" });
    generateExamQuestionsFromLesson.mockReset();
  });

  test("generateExamQuestions:false does not create exam draft rows", async () => {
    generateExamQuestionsFromLesson.mockResolvedValue([validExamDraft(1), validExamDraft(2), validExamDraft(3)]);

    const res = await request(app)
      .post(`/api/lessons/${lessonId}/generate-assets`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ generateExamQuestions: false });

    expect(res.status).toBe(200);
    expect(res.body.generated.examQuestions).toBe(0);
    expect(generateExamQuestionsFromLesson).not.toHaveBeenCalled();

    const count = await ExamQuestion.countDocuments({
      teacherId,
      "metadata.source": "ai_lesson_assets",
      "metadata.generationType": "exam",
    });
    expect(count).toBe(0);
  });

  test("generateExamQuestions:true saves draft rows with correct metadata", async () => {
    generateExamQuestionsFromLesson.mockResolvedValue([
      validExamDraft(1),
      validExamDraft(2),
      validExamDraft(3),
    ]);

    const res = await request(app)
      .post(`/api/lessons/${lessonId}/generate-assets`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ generateExamQuestions: true, generateFlashcards: false, generateQuizQuestions: false });

    expect(res.status).toBe(200);
    expect(res.body.generated.examQuestions).toBe(3);
    expect(res.body.examQuestionStats?.insertedCount).toBe(3);

    const rows = await ExamQuestion.find({
      teacherId,
      "metadata.source": "ai_lesson_assets",
      "metadata.generationType": "exam",
      "metadata.lessonId": lessonId,
    }).lean();

    expect(rows.length).toBe(3);
    rows.forEach((q) => {
      expect(q.status).toBe("draft");
      expect(q.topicKey).toBe(NAMESPACED);
      expect(q.metadata.source).toBe("ai_lesson_assets");
      expect(q.metadata.lessonId).toBe(lessonId);
      expect(q.metadata.aiGenerated).toBe(true);
    });
  });

  test("regression: sidebar draft count matches Review Exam Drafts bank query (Edexcel, no AQA fallback)", async () => {
    generateExamQuestionsFromLesson.mockResolvedValue([
      validExamDraft(30),
      validExamDraft(31),
      validExamDraft(32),
      validExamDraft(33),
    ]);

    const gen = await request(app)
      .post(`/api/lessons/${lessonId}/generate-assets`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ generateExamQuestions: true, generateFlashcards: false, generateQuizQuestions: false });

    expect(gen.status).toBe(200);
    expect(gen.body.generated.examQuestions).toBe(4);

    const baseFilters = {
      metadataSource: "ai_lesson_assets",
      generationType: "exam",
      lessonId,
      status: "draft",
      mineOnly: "1",
    };

    // EditLessonPage sidebar draft count (slug + explicit specKey).
    const sidebarRes = await request(app)
      .get("/api/exam-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({ ...baseFilters, topicKey: OESTROGEN_SLUG, specKey: "edexcel-igcse-biology" });

    // Exam Question Bank after frontend fix (slug + explicit specKey).
    const bankRes = await request(app)
      .get("/api/exam-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({ ...baseFilters, topicKey: OESTROGEN_SLUG, specKey: "edexcel-igcse-biology" });

    // Defensive backend path: namespaced topicKey without specKey must not default to AQA.
    const defensiveRes = await request(app)
      .get("/api/exam-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({ ...baseFilters, topicKey: NAMESPACED });

    expect(sidebarRes.status).toBe(200);
    expect(bankRes.status).toBe(200);
    expect(defensiveRes.status).toBe(200);

    const sidebarIds = sidebarRes.body.questions.map((q) => String(q._id)).sort();
    const bankIds = bankRes.body.questions.map((q) => String(q._id)).sort();
    const defensiveIds = defensiveRes.body.questions.map((q) => String(q._id)).sort();

    expect(sidebarRes.body.questions.length).toBe(4);
    expect(bankRes.body.questions.length).toBe(4);
    expect(defensiveRes.body.questions.length).toBe(4);
    expect(bankIds).toEqual(sidebarIds);
    expect(defensiveIds).toEqual(sidebarIds);

    [...sidebarRes.body.questions, ...bankRes.body.questions, ...defensiveRes.body.questions].forEach((q) => {
      expect(q.topicKey).toBe(OESTROGEN_SLUG);
      expect(q.topicKey).not.toMatch(/^aqa-gcse-biology:/);
      expect(q.metadata?.source).toBe("ai_lesson_assets");
      expect(q.status).toBe("draft");
    });

    // Slug-only without specKey still uses legacy AQA default — must not return Edexcel rows.
    const legacySlugOnly = await request(app)
      .get("/api/exam-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({ ...baseFilters, topicKey: OESTROGEN_SLUG });

    expect(legacySlugOnly.status).toBe(200);
    expect(legacySlugOnly.body.questions.length).toBe(0);
  });

  test("AI lesson drafts bank filter finds rows when specKey is passed", async () => {
    generateExamQuestionsFromLesson.mockResolvedValue([
      validExamDraft(10),
      validExamDraft(11),
      validExamDraft(12),
    ]);

    await request(app)
      .post(`/api/lessons/${lessonId}/generate-assets`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ generateExamQuestions: true, generateFlashcards: false, generateQuizQuestions: false });

    const withoutSpec = await request(app)
      .get("/api/exam-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({
        topicKey: OESTROGEN_SLUG,
        metadataSource: "ai_lesson_assets",
        generationType: "exam",
        lessonId,
        status: "draft",
        mineOnly: "1",
      });

    const withSpec = await request(app)
      .get("/api/exam-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({
        topicKey: OESTROGEN_SLUG,
        specKey: "edexcel-igcse-biology",
        metadataSource: "ai_lesson_assets",
        generationType: "exam",
        lessonId,
        status: "draft",
        mineOnly: "1",
      });

    expect(withoutSpec.status).toBe(200);
    expect(withSpec.status).toBe(200);
    expect(withoutSpec.body.questions.length).toBe(0);
    expect(withSpec.body.questions.length).toBe(3);
  });

  test("regenerate removes stale AI exam drafts and does not duplicate identical stems", async () => {
    generateExamQuestionsFromLesson.mockResolvedValue([
      validExamDraft(20),
      validExamDraft(21),
      validExamDraft(22),
    ]);

    await request(app)
      .post(`/api/lessons/${lessonId}/generate-assets`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ generateExamQuestions: true, generateFlashcards: false, generateQuizQuestions: false });

    await request(app)
      .post(`/api/lessons/${lessonId}/generate-assets`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ generateExamQuestions: true, generateFlashcards: false, generateQuizQuestions: false });

    const count = await ExamQuestion.countDocuments({
      teacherId,
      "metadata.source": "ai_lesson_assets",
      "metadata.generationType": "exam",
      "metadata.lessonId": lessonId,
    });
    expect(count).toBe(3);
  });
});
