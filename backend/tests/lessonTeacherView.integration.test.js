/**
 * PR-LESSON-VIEW-FIX-1: Teacher "View lesson" — owner can always view own published lesson.
 * Other teacher gets 404 (no existence leak). Student with entitlement gets 200.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("GET /api/lessons/:id — teacher view (PR-LESSON-VIEW-FIX-1)", () => {
  let teacherId;
  let otherTeacherId;
  let studentId;
  let lessonId;
  let teacherToken;
  let otherTeacherToken;
  let studentToken;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Owner",
      lastName: "Teacher",
      email: "tv-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const otherTeacher = await User.create({
      firstName: "Other",
      lastName: "Teacher",
      email: "tv-other-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    otherTeacherId = otherTeacher._id;

    const student = await User.create({
      firstName: "S",
      lastName: "Student",
      email: "tv-student@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: { status: "active", expiresAt: new Date(Date.now() + 86400000) },
      purchasedLessons: [],
    });
    studentId = student._id;

    const lesson = await Lesson.create({
      title: "Teacher View Lesson",
      description: "D",
      content: "Content",
      teacherId,
      teacherName: "Owner Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      quiz: { timeSeconds: 600, questions: [] },
      flashcards: [],
    });
    lessonId = lesson._id;

    const loginTeacher = await request(app).post("/api/auth/login").send({
      email: "tv-teacher@test.com",
      password: "password123",
    });
    teacherToken = loginTeacher.body?.token || loginTeacher.body?.data?.token;

    const loginOther = await request(app).post("/api/auth/login").send({
      email: "tv-other-teacher@test.com",
      password: "password123",
    });
    otherTeacherToken = loginOther.body?.token || loginOther.body?.data?.token;

    const loginStudent = await request(app).post("/api/auth/login").send({
      email: "tv-student@test.com",
      password: "password123",
    });
    studentToken = loginStudent.body?.token || loginStudent.body?.data?.token;

    if (!teacherToken || !otherTeacherToken || !studentToken) {
      throw new Error("Login failed");
    }
  }, 15000);

  afterAll(async () => {
    await User.deleteMany({ email: /tv-.*@test\.com/ });
    await Lesson.deleteMany({ _id: lessonId });
  });

  it("teacher owner GET /api/lessons/:id returns 200", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .expect(200);
    expect(res.body.title).toBe("Teacher View Lesson");
    expect(res.body.accessDecision?.reason).toBe("OWNER");
  });

  it("other teacher GET returns 404 (no existence leak)", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${otherTeacherToken}`)
      .expect(404);
    expect(res.body.error).toBe("LESSON_NOT_FOUND");
    expect(res.body.reason).toBeDefined();
  });

  it("student with entitlement GET returns 200", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${studentToken}`)
      .expect(200);
    expect(res.body.title).toBe("Teacher View Lesson");
    expect(res.body.accessDecision?.allowed).toBe(true);
  });
});
