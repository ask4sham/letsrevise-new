/**
 * PR-QA-CLOSE-1: Lesson view data sources sanity — GET /api/lessons/:id returns quiz, flashcards, topicKey for owner
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("GET /api/lessons/:id data sources (PR-QA-CLOSE-1)", () => {
  let teacherId;
  let lessonId;
  let teacherToken;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "T",
      lastName: "DS",
      email: "lesson-ds-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const lesson = await Lesson.create({
      title: "Data Sources Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cell structure",
      status: "published",
      quiz: {
        timeSeconds: 600,
        questions: [
          { id: "q1", type: "mcq", question: "What is a cell?", options: ["A", "B"], correctAnswer: "A" },
        ],
      },
      flashcards: [
        { id: "f1", front: "Front", back: "Back" },
      ],
    });
    lessonId = lesson._id;

    const login = await request(app).post("/api/auth/login").send({
      email: "lesson-ds-teacher@test.com",
      password: "password123",
    });
    teacherToken = login.body?.token || login.body?.data?.token;
  });

  afterAll(async () => {
    await User.deleteMany({ email: "lesson-ds-teacher@test.com" });
    await Lesson.deleteMany({ _id: lessonId });
  });

  it("returns quiz, flashcards, topicKey for owner", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .expect(200);
    expect(res.body.quiz).toBeDefined();
    expect(Array.isArray(res.body.quiz?.questions)).toBe(true);
    expect(res.body.quiz.questions.length).toBeGreaterThanOrEqual(1);
    expect(res.body.flashcards).toBeDefined();
    expect(Array.isArray(res.body.flashcards)).toBe(true);
    expect(res.body.flashcards.length).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.topicKey === "string" || res.body.topic).toBe(true);
  });
});
