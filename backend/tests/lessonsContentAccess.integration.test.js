/**
 * Phase 9 — Integration tests for GET /api/lessons/:id content access.
 * Asserts: not entitled → 403; free preview → 200 partial; subscribed/purchased → 200 full.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const bcrypt = require("bcryptjs");

describe("GET /api/lessons/:id content access (Phase 9)", () => {
  let teacherId;
  let lessonAId;
  let lessonBId;
  let tokenU1;
  let tokenU2;
  let tokenU3;
  const hashedPassword = bcrypt.hashSync("password123", 10);

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "T",
      lastName: "Teacher",
      email: "phase9-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const lessonA = await Lesson.create({
      title: "Lesson A (locked)",
      description: "Description A",
      content: "Full content A",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      isFreePreview: false,
      pages: [
        { pageId: "p1", title: "Page 1", order: 0, blocks: [] },
        { pageId: "p2", title: "Page 2", order: 1, blocks: [] },
      ],
      quiz: { questions: [{ id: "q1", type: "mcq", question: "Q?", correctAnswer: "A" }] },
      flashcards: [{ id: "f1", front: "F", back: "B" }],
    });
    lessonAId = lessonA._id;

    const lessonB = await Lesson.create({
      title: "Lesson B (free preview)",
      description: "Description B",
      content: "Full content B",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      isFreePreview: true,
      pages: [
        { pageId: "p1", title: "Preview Page", order: 0, blocks: [] },
        { pageId: "p2", title: "Locked Page", order: 1, blocks: [] },
      ],
      quiz: { questions: [] },
      flashcards: [],
    });
    lessonBId = lessonB._id;

    const u1 = await User.create({
      firstName: "U1",
      lastName: "Student",
      email: "phase9-u1@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: null,
      purchasedLessons: [],
    });

    const u2 = await User.create({
      firstName: "U2",
      lastName: "Student",
      email: "phase9-u2@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: null,
      purchasedLessons: [{ lessonId: lessonAId, progress: 0 }],
    });

    const future = new Date(Date.now() + 86400000);
    const u3 = await User.create({
      firstName: "U3",
      lastName: "Student",
      email: "phase9-u3@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: { status: "active", expiresAt: future },
      purchasedLessons: [],
    });

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    tokenU1 = await login("phase9-u1@test.com");
    tokenU2 = await login("phase9-u2@test.com");
    tokenU3 = await login("phase9-u3@test.com");
  });

  test("not entitled user gets 403 with NOT_ENTITLED on locked lesson", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonAId}`)
      .set("Authorization", `Bearer ${tokenU1}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
    expect(res.body.reason).toBe("NOT_ENTITLED");
  });

  test("purchased user gets 200 and full content (pages, quiz, flashcards)", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonAId}`)
      .set("Authorization", `Bearer ${tokenU2}`);
    expect(res.status).toBe(200);
    expect(res.body.pages).toHaveLength(2);
    expect(res.body.quiz).toBeDefined();
    expect(Array.isArray(res.body.flashcards)).toBe(true);
    expect(res.body.isFreePreview).not.toBe(true);
  });

  test("subscribed user gets 200 and full content", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonAId}`)
      .set("Authorization", `Bearer ${tokenU3}`);
    expect(res.status).toBe(200);
    expect(res.body.pages).toHaveLength(2);
    expect(res.body.quiz).toBeDefined();
  });

  test("free preview user gets 200 with partial content only (first page, no quiz/flashcards)", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonBId}`)
      .set("Authorization", `Bearer ${tokenU1}`);
    expect(res.status).toBe(200);
    expect(res.body.isFreePreview).toBe(true);
    expect(res.body.pages).toHaveLength(1);
    expect(res.body.flashcards).toEqual([]);
    expect(res.body.quiz).toBeUndefined();
  });
});
