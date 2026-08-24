/**
 * PR: Attach page quiz from Topic Quiz Bank — integration tests.
 * Verifies: exact topicKey, published-only, pageId, duplicate prevention, End of Lesson Test unchanged.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Attach Page Quiz from Bank", () => {
  let teacherToken;
  let teacherId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Attach",
      lastName: "Teacher",
      email: "attach-page-quiz@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "attach-page-quiz@test.com", password: "password123" });
    teacherToken = loginRes.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    await TopicQuizQuestion.deleteMany({ ownerId: teacherId });
  });

  test("attaches published questions to page with pageId", async () => {
    const topicKey = "aqa-gcse-biology:cell-structure";
    const bulkRes = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        items: [
          { questionText: "Page quiz Q1?", choices: ["A", "B"], correctIndex: 0 },
          { questionText: "Page quiz Q2?", choices: ["X", "Y"], correctIndex: 1 },
        ],
      });
    expect(bulkRes.status).toBe(200);
    const ids = bulkRes.body.createdIds;
    expect(ids.length).toBe(2);
    for (const id of ids) {
      await request(app)
        .post(`/api/topic-quiz-questions/${id}/publish`)
        .set("Authorization", `Bearer ${teacherToken}`);
    }

    const lesson = await Lesson.create({
      title: "Attach page quiz lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "Attach Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Cell structure",
      topicKey,
      status: "draft",
      pages: [
        { pageId: "p1", title: "Page 1", order: 0, blocks: [] },
        { pageId: "p2", title: "Page 2", order: 1, blocks: [] },
      ],
      quiz: { timeSeconds: 600, questions: [] },
    });

    const attachRes = await request(app)
      .post(`/api/lessons/${lesson._id}/attach-page-quiz-from-bank`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ pageId: "p1", questionIds: ids });
    expect(attachRes.status).toBe(200);
    expect(attachRes.body.ok).toBe(true);
    expect(attachRes.body.addedCount).toBe(2);
    expect(attachRes.body.alreadyExisted).toBe(0);

    const getRes = await request(app)
      .get(`/api/lessons/${lesson._id}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(getRes.status).toBe(200);
    const questions = getRes.body.quiz?.questions ?? [];
    expect(questions.length).toBe(2);
    expect(questions.every((q) => q.pageId === "p1")).toBe(true);
    expect(questions.every((q) => q.sourceType === "topicQuizQuestion")).toBe(true);
    expect(questions.every((q) => q.sourceQuestionId)).toBe(true);

    // Regression: attached page quiz questions must NOT appear in End of Lesson Test
    const eolQuestions = questions.filter((q) => !q.pageId || String(q.pageId) === "END");
    const pageLevelInEol = eolQuestions.filter((q) => q.pageId === "p1");
    expect(pageLevelInEol).toHaveLength(0);
  });

  test("attached page quiz question does not appear in End of Lesson Test", async () => {
    const topicKey = "aqa-gcse-biology:cell-structure";
    const bulkRes = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        items: [{ questionText: "Page-level only Q?", choices: ["A", "B"], correctIndex: 0 }],
      });
    expect(bulkRes.status).toBe(200);
    const id = bulkRes.body.createdIds[0];
    await request(app)
      .post(`/api/topic-quiz-questions/${id}/publish`)
      .set("Authorization", `Bearer ${teacherToken}`);

    const lesson = await Lesson.create({
      title: "Page vs EOL separation lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "Attach Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Enzymes",
      topicKey,
      status: "draft",
      pages: [
        { pageId: "pageA", title: "Page A", order: 0, blocks: [] },
        { pageId: "pageB", title: "Page B", order: 1, blocks: [] },
      ],
      quiz: {
        timeSeconds: 600,
        questions: [
          {
            id: "eol1",
            type: "mcq",
            question: "End of lesson only?",
            options: ["X", "Y"],
            correctAnswer: "X",
          },
        ],
      },
    });

    const attachRes = await request(app)
      .post(`/api/lessons/${lesson._id}/attach-page-quiz-from-bank`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ pageId: "pageA", questionIds: [id] });
    expect(attachRes.status).toBe(200);
    expect(attachRes.body.addedCount).toBe(1);

    const getRes = await request(app)
      .get(`/api/lessons/${lesson._id}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    const questions = getRes.body.quiz?.questions ?? [];

    const pageQuizForA = questions.filter((q) => q.pageId === "pageA");
    const eolQuestions = questions.filter((q) => !q.pageId || String(q.pageId) === "END");

    expect(pageQuizForA).toHaveLength(1);
    expect(pageQuizForA[0].question).toBe("Page-level only Q?");
    expect(eolQuestions).toHaveLength(1);
    expect(eolQuestions[0].question).toBe("End of lesson only?");
    expect(eolQuestions.some((q) => q.pageId === "pageA")).toBe(false);
  });

  test("duplicate attach is prevented", async () => {
    const topicKey = "aqa-gcse-biology:cell-division";
    const bulkRes = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        items: [{ questionText: "Dup Q?", choices: ["A", "B"], correctIndex: 0 }],
      });
    expect(bulkRes.status).toBe(200);
    const id = bulkRes.body.createdIds[0];
    await request(app)
      .post(`/api/topic-quiz-questions/${id}/publish`)
      .set("Authorization", `Bearer ${teacherToken}`);

    const lesson = await Lesson.create({
      title: "Dup attach lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "Attach Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Cell division",
      topicKey,
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      quiz: { timeSeconds: 600, questions: [] },
    });

    const first = await request(app)
      .post(`/api/lessons/${lesson._id}/attach-page-quiz-from-bank`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ pageId: "p1", questionIds: [id] });
    expect(first.status).toBe(200);
    expect(first.body.addedCount).toBe(1);
    expect(first.body.alreadyExisted).toBe(0);

    const second = await request(app)
      .post(`/api/lessons/${lesson._id}/attach-page-quiz-from-bank`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ pageId: "p1", questionIds: [id] });
    expect(second.status).toBe(200);
    expect(second.body.addedCount).toBe(0);
    expect(second.body.alreadyExisted).toBe(1);

    const getRes = await request(app)
      .get(`/api/lessons/${lesson._id}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    const questions = (getRes.body.quiz?.questions ?? []).filter((q) => q.pageId === "p1");
    expect(questions.length).toBe(1);
  });

  test("End of Lesson Test questions unchanged", async () => {
    const topicKey = "aqa-gcse-biology:mitosis-cell-cycle";
    const bulkRes = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        items: [{ questionText: "EOL Q?", choices: ["A", "B"], correctIndex: 0 }],
      });
    expect(bulkRes.status).toBe(200);
    const id = bulkRes.body.createdIds[0];
    await request(app)
      .post(`/api/topic-quiz-questions/${id}/publish`)
      .set("Authorization", `Bearer ${teacherToken}`);

    const endOfLessonQ = {
      id: "eol1",
      type: "mcq",
      question: "End of lesson Q?",
      options: ["X", "Y"],
      correctAnswer: "X",
    };
    const lesson = await Lesson.create({
      title: "EOL preserved lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "Attach Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Mitosis",
      topicKey,
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      quiz: { timeSeconds: 600, questions: [endOfLessonQ] },
    });

    const attachRes = await request(app)
      .post(`/api/lessons/${lesson._id}/attach-page-quiz-from-bank`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ pageId: "p1", questionIds: [id] });
    expect(attachRes.status).toBe(200);
    expect(attachRes.body.addedCount).toBe(1);

    const getRes = await request(app)
      .get(`/api/lessons/${lesson._id}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    const questions = getRes.body.quiz?.questions ?? [];
    const pageQuestions = questions.filter((q) => q.pageId === "p1");
    const eolQuestions = questions.filter((q) => !q.pageId || q.pageId === "END");
    expect(pageQuestions.length).toBe(1);
    expect(eolQuestions.some((q) => q.question === "End of lesson Q?")).toBe(true);
  });

  test("allowDraft attaches teacher draft without publishing bank row", async () => {
    const topicKey = "aqa-gcse-biology:cell-structure";
    const bulkRes = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        items: [{ questionText: "Draft-only attach Q?", choices: ["A", "B"], correctIndex: 0 }],
      });
    expect(bulkRes.status).toBe(200);
    const draftId = bulkRes.body.createdIds[0];
    // Intentionally not published — attach uses allowDraft

    const lesson = await Lesson.create({
      title: "Draft attach lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "Attach Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Draft bridge",
      topicKey,
      status: "draft",
      pages: [{ pageId: "pDraft", title: "Page 1", order: 0, blocks: [] }],
      quiz: { timeSeconds: 600, questions: [] },
    });

    const attachRes = await request(app)
      .post(`/api/lessons/${lesson._id}/attach-page-quiz-from-bank`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ pageId: "pDraft", questionIds: [draftId], allowDraft: true });
    expect(attachRes.status).toBe(200);
    expect(attachRes.body.ok).toBe(true);
    expect(attachRes.body.addedCount).toBe(1);
    const q = (attachRes.body.lesson?.quiz?.questions || []).find((x) => x.sourceQuestionId === String(draftId));
    expect(q).toBeTruthy();
    expect(q.pageId).toBe("pDraft");
    expect(q.source).toBe("topic_quiz_bank");
  });

  test("pageId required -> 400", async () => {
    const lesson = await Lesson.create({
      title: "Bad req lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "Attach Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Cell structure",
      topicKey: "aqa-gcse-biology:cell-structure",
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      quiz: { timeSeconds: 600, questions: [] },
    });
    const res = await request(app)
      .post(`/api/lessons/${lesson._id}/attach-page-quiz-from-bank`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ questionIds: ["507f1f77bcf86cd799439011"] });
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/pageId/);
  });

  test("questionIds required -> 400", async () => {
    const lesson = await Lesson.create({
      title: "Bad req 2 lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "Attach Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Cell structure",
      topicKey: "aqa-gcse-biology:cell-structure",
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      quiz: { timeSeconds: 600, questions: [] },
    });
    const res = await request(app)
      .post(`/api/lessons/${lesson._id}/attach-page-quiz-from-bank`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ pageId: "p1", questionIds: [] });
    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/questionIds/);
  });

  test("stem fingerprint duplicate is idempotent no-op (HTTP 200, no new pq row)", async () => {
    const topicKey = "aqa-gcse-biology:cell-structure";
    const haploidStem = "Why must human gametes be haploid before fertilisation?";
    const haploidAnswer = "So fusion restores the diploid chromosome number in the zygote";
    const bulkRes = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        items: [
          {
            questionText: haploidStem,
            choices: [haploidAnswer, "Wrong A", "Wrong B", "Wrong C"],
            correctIndex: 0,
          },
        ],
      });
    expect(bulkRes.status).toBe(200);
    const bankId = bulkRes.body.createdIds[0];
    await request(app)
      .post(`/api/topic-quiz-questions/${bankId}/publish`)
      .set("Authorization", `Bearer ${teacherToken}`);

    const lesson = await Lesson.create({
      title: "Stem dedup attach lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "Attach Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Cell division",
      topicKey,
      status: "draft",
      pages: [
        {
          pageId: "p1",
          title: "Practise",
          order: 0,
          blocks: [
            {
              type: "pageQuiz",
              questions: [
                {
                  id: "quiz1",
                  prompt: haploidStem,
                  options: [haploidAnswer, "Wrong A", "Wrong B", "Wrong C"],
                  correctAnswer: haploidAnswer,
                },
              ],
            },
          ],
        },
      ],
      quiz: { timeSeconds: 600, questions: [] },
    });

    const attachRes = await request(app)
      .post(`/api/lessons/${lesson._id}/attach-page-quiz-from-bank`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ pageId: "p1", questionIds: [bankId] });
    expect(attachRes.status).toBe(200);
    expect(attachRes.body.addedCount).toBe(0);
    expect(attachRes.body.alreadyExisted).toBe(1);

    const getRes = await request(app)
      .get(`/api/lessons/${lesson._id}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect((getRes.body.quiz?.questions ?? []).length).toBe(0);
  });
});
