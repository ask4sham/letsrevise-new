/**
 * exam-question-lesson-block-v1 — lesson embed + access control for linked ExamQuestion blocks.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

jest.setTimeout(20000);

describe("examQuestion lesson blocks", () => {
  let ownerToken;
  let ownerId;
  let otherTeacherToken;
  let studentToken;
  let publishedQuestionId;
  let draftQuestionId;
  let lessonId;

  beforeAll(async () => {
    const owner = await User.create({
      firstName: "Embed",
      lastName: "Owner",
      email: "embed-owner@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    ownerId = owner._id;

    const other = await User.create({
      firstName: "Embed",
      lastName: "Other",
      email: "embed-other@test.com",
      password: hashedPassword,
      userType: "teacher",
    });

    const student = await User.create({
      firstName: "Embed",
      lastName: "Student",
      email: "embed-student@test.com",
      password: hashedPassword,
      userType: "student",
    });

    const loginOwner = await request(app)
      .post("/api/auth/login")
      .send({ email: "embed-owner@test.com", password: "password123" });
    ownerToken = loginOwner.body?.token;

    const loginOther = await request(app)
      .post("/api/auth/login")
      .send({ email: "embed-other@test.com", password: "password123" });
    otherTeacherToken = loginOther.body?.token;

    const loginStudent = await request(app)
      .post("/api/auth/login")
      .send({ email: "embed-student@test.com", password: "password123" });
    studentToken = loginStudent.body?.token;

    if (!ownerToken || !otherTeacherToken || !studentToken) throw new Error("Login failed");

    const publishedQ = await ExamQuestion.create({
      teacherId: ownerId,
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topic: "Reproduction",
      type: "short",
      marks: 3,
      question: "Label the sperm cell diagram.",
      markScheme: ["Head contains genetic material"],
      status: "published",
      imageUrl: "/uploads/exam-questions/sperm.png",
    });
    publishedQuestionId = String(publishedQ._id);

    const draftQ = await ExamQuestion.create({
      teacherId: ownerId,
      subject: "Biology",
      type: "short",
      marks: 2,
      question: "Draft-only embed question?",
      markScheme: ["Draft point"],
      status: "draft",
    });
    draftQuestionId = String(draftQ._id);

    const privateOtherQ = await ExamQuestion.create({
      teacherId: other._id,
      subject: "Biology",
      type: "short",
      marks: 2,
      question: "Other teacher private question",
      markScheme: ["Secret"],
      status: "published",
    });

    const lesson = await Lesson.create({
      title: "Human Reproductive Systems",
      description: "Desc",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Embed Owner",
      subject: "Biology",
      level: "IGCSE",
      topic: "Reproduction",
      status: "published",
      isPublished: true,
      isFreePreview: true,
      pages: [
        {
          pageId: "p1",
          title: "Page 1",
          order: 1,
          blocks: [
            { type: "text", content: "Intro" },
            { type: "examQuestion", examQuestionId: publishedQ._id },
            { type: "examQuestion", examQuestionId: draftQ._id },
          ],
        },
      ],
    });
    lessonId = String(lesson._id);

    // Store other teacher question id on lesson object for negative test (not embedded)
    global.__embedOtherPrivateId = String(privateOtherQ._id);
  });

  test("lesson save/load preserves examQuestion block examQuestionId", async () => {
    const getRes = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(getRes.status).toBe(200);
    const blocks = getRes.body?.lesson?.pages?.[0]?.blocks ?? getRes.body?.pages?.[0]?.blocks ?? [];
    const eqBlocks = blocks.filter((b) => b.type === "examQuestion");
    expect(eqBlocks).toHaveLength(2);
    expect(String(eqBlocks[0].examQuestionId)).toBe(publishedQuestionId);
    expect(String(eqBlocks[1].examQuestionId)).toBe(draftQuestionId);
  });

  test("POST /by-ids with lessonId returns embedded published question for student", async () => {
    const res = await request(app)
      .post("/api/exam-questions/by-ids")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ lessonId, ids: [publishedQuestionId, draftQuestionId] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ids = (res.body.questions || []).map((q) => String(q._id));
    expect(ids).toContain(publishedQuestionId);
    expect(ids).not.toContain(draftQuestionId);
  });

  test("owner can fetch draft embedded question via lesson context", async () => {
    const res = await request(app)
      .post("/api/exam-questions/by-ids")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ lessonId, ids: [draftQuestionId] });
    expect(res.status).toBe(200);
    const ids = (res.body.questions || []).map((q) => String(q._id));
    expect(ids).toContain(draftQuestionId);
  });

  test("GET /:id returns embedded question for lesson viewer", async () => {
    const res = await request(app)
      .get(`/api/exam-questions/${publishedQuestionId}`)
      .query({ lessonId })
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.question?.question).toMatch(/sperm cell/i);
    expect(res.body.question?.imageUrl).toBeTruthy();
  });

  test("missing/deleted embedded question returns 404 on single fetch", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/exam-questions/${fakeId}`)
      .query({ lessonId })
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(res.status).toBe(404);
  });

  test("does not expose unrelated private question even when id is guessed", async () => {
    const otherPrivateId = global.__embedOtherPrivateId;
    const res = await request(app)
      .post("/api/exam-questions/by-ids")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ lessonId, ids: [otherPrivateId, publishedQuestionId] });
    expect(res.status).toBe(200);
    const ids = (res.body.questions || []).map((q) => String(q._id));
    expect(ids).toContain(publishedQuestionId);
    expect(ids).not.toContain(otherPrivateId);
  });

  test("other teacher cannot fetch owner question without lesson embed", async () => {
    const res = await request(app)
      .get(`/api/exam-questions/${publishedQuestionId}`)
      .set("Authorization", `Bearer ${otherTeacherToken}`);
    expect(res.status).toBe(404);
  });
});
