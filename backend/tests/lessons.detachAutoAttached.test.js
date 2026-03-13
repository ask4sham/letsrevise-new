/**
 * PR-FE-BE-DETACH-AUTO-ATTACHED-1: Detach auto-attached content endpoint.
 * - Removes only items tagged "auto-attached" (quiz + flashcards).
 * - Preserves untagged and manual content; string/non-object flashcards kept.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("POST /api/lessons/:id/detach-auto-attached-content", () => {
  let teacherToken;
  let teacherId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Detach",
      lastName: "Teacher",
      email: "detach-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "detach-teacher@test.com", password: "password123" });
    teacherToken = loginRes.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  });

  afterAll(async () => {
    await Lesson.deleteMany({ teacherId });
    await User.deleteOne({ _id: teacherId });
  });

  test("detaches only tagged quiz questions; untagged remains", async () => {
    const lesson = await Lesson.create({
      title: "Detach Quiz Test",
      description: "Desc",
      content: "Content",
      teacherId,
      teacherName: "Detach Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "draft",
      pages: [],
      quiz: {
        timeSeconds: 600,
        questions: [
          { id: "q1", type: "mcq", question: "Q1?", options: ["A", "B"], correctAnswer: "A", tags: ["auto-attached", "topic-bank"] },
          { id: "q2", type: "mcq", question: "Q2?", options: ["X", "Y"], correctAnswer: "X", tags: ["auto-attached"] },
          { id: "q3", type: "short", question: "Manual Q?", correctAnswer: "Ans", tags: [] },
        ],
      },
      flashcards: [],
    });

    const res = await request(app)
      .post(`/api/lessons/${lesson._id}/detach-auto-attached-content`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.detached).toEqual({ flashcards: 0, quiz: 2 });
    expect(res.body.lesson).toBeDefined();
    expect(res.body.lesson.quiz.questions).toHaveLength(1);
    expect(res.body.lesson.quiz.questions[0].id).toBe("q3");
  });

  test("detaches only tagged flashcards; untagged and non-objects preserved", async () => {
    const lesson = await Lesson.create({
      title: "Detach Flashcards Test",
      description: "Desc",
      content: "Content",
      teacherId,
      teacherName: "Detach Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "draft",
      pages: [],
      quiz: { timeSeconds: 600, questions: [] },
      flashcards: [
        { id: "f1", front: "F1", back: "B1", tags: ["auto-attached", "topic-bank"] },
        { id: "f2", front: "F2", back: "B2", tags: ["auto-attached"] },
        { id: "f3", front: "Manual", back: "Manual back", tags: [] },
      ],
    });

    const res = await request(app)
      .post(`/api/lessons/${lesson._id}/detach-auto-attached-content`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.detached).toEqual({ flashcards: 2, quiz: 0 });
    expect(res.body.lesson.flashcards).toHaveLength(1);
    expect(res.body.lesson.flashcards[0].id).toBe("f3");
  });

  test("mixed: tagged quiz + tagged flashcards removed; counts match", async () => {
    const lesson = await Lesson.create({
      title: "Detach Mixed Test",
      description: "Desc",
      content: "Content",
      teacherId,
      teacherName: "Detach Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "draft",
      pages: [],
      quiz: {
        timeSeconds: 600,
        questions: [
          { id: "q1", type: "mcq", question: "Q1?", options: ["A", "B"], correctAnswer: "A", tags: ["auto-attached"] },
          { id: "q2", type: "short", question: "Manual?", correctAnswer: "A", tags: [] },
        ],
      },
      flashcards: [
        { id: "f1", front: "A", back: "B", tags: ["auto-attached"] },
        { id: "f2", front: "C", back: "D", tags: [] },
      ],
    });

    const res = await request(app)
      .post(`/api/lessons/${lesson._id}/detach-auto-attached-content`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.detached).toEqual({ flashcards: 1, quiz: 1 });
    expect(res.body.lesson.quiz.questions).toHaveLength(1);
    expect(res.body.lesson.quiz.questions[0].id).toBe("q2");
    expect(res.body.lesson.flashcards).toHaveLength(1);
    expect(res.body.lesson.flashcards[0].id).toBe("f2");
  });

  test("no-op when no auto-attached tags: returns 0 counts, no crash", async () => {
    const lesson = await Lesson.create({
      title: "Detach No-op Test",
      description: "Desc",
      content: "Content",
      teacherId,
      teacherName: "Detach Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "draft",
      pages: [],
      quiz: {
        timeSeconds: 600,
        questions: [
          { id: "q1", type: "mcq", question: "Q?", options: ["A", "B"], correctAnswer: "A", tags: [] },
        ],
      },
      flashcards: [
        { id: "f1", front: "F", back: "B", tags: [] },
      ],
    });

    const res = await request(app)
      .post(`/api/lessons/${lesson._id}/detach-auto-attached-content`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.detached).toEqual({ flashcards: 0, quiz: 0 });
    expect(res.body.lesson.quiz.questions).toHaveLength(1);
    expect(res.body.lesson.flashcards).toHaveLength(1);
  });
});
