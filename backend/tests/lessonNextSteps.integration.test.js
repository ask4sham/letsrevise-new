/**
 * PR15: GET /api/lessons/:id/next-steps — Student-safe next steps from reteach plan.
 * NOT_ENTITLED -> 402; FREE_PREVIEW -> 200 allowed:false nextSteps:null; SUB_ACTIVE + pinned plan -> 200 allowed:true nextSteps.studentSummary.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ReteachPlan = require("../models/ReteachPlan");

jest.setTimeout(20000);

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("GET /api/lessons/:id/next-steps", () => {
  let teacherId;
  let lessonLockedId;
  let lessonPreviewId;
  let tokenNotEntitled;
  let tokenSubscribed;
  let tokenTeacher;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "T",
      lastName: "Teacher",
      email: "ns-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const lessonLocked = await Lesson.create({
      title: "NS Locked",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      isFreePreview: false,
      examQuestions: [],
    });
    lessonLockedId = lessonLocked._id;

    const lessonPreview = await Lesson.create({
      title: "NS Preview",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      isFreePreview: true,
      examQuestions: [],
    });
    lessonPreviewId = lessonPreview._id;

    const uNotEntitled = await User.create({
      firstName: "Student",
      lastName: "None",
      email: "ns-not-entitled@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: null,
      purchasedLessons: [],
    });
    const future = new Date(Date.now() + 86400000);
    await User.create({
      firstName: "Student",
      lastName: "Sub",
      email: "ns-subscribed@test.com",
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

    tokenNotEntitled = await login("ns-not-entitled@test.com");
    tokenSubscribed = await login("ns-subscribed@test.com");
    tokenTeacher = await login("ns-teacher@test.com");
  });

  test("401 without auth", async () => {
    const res = await request(app).get(`/api/lessons/${lessonLockedId}/next-steps`);
    expect(res.status).toBe(401);
  });

  test("NOT_ENTITLED user gets 402", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonLockedId}/next-steps`)
      .set("Authorization", `Bearer ${tokenNotEntitled}`);
    expect(res.status).toBe(402);
    expect(res.body.reason).toBe("NOT_ENTITLED");
  });

  test("FREE_PREVIEW returns 200 with allowed:false and nextSteps:null", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonPreviewId}/next-steps`)
      .set("Authorization", `Bearer ${tokenNotEntitled}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.allowed).toBe(false);
    expect(res.body.reason).toBe("FREE_PREVIEW");
    expect(res.body.nextSteps).toBeNull();
  });

  test("SUB_ACTIVE with pinned plan returns 200 allowed:true and nextSteps.studentSummary", async () => {
    await ReteachPlan.deleteMany({ lessonId: lessonLockedId });
    await ReteachPlan.create({
      lessonId: lessonLockedId,
      days: 14,
      generatedBy: teacherId,
      sourceHash: "hash1",
      content: "Full teacher-only content must not be returned.",
      pinned: true,
      studentSummary: "Review mitosis diagrams and try the practice questions again.",
    });

    const res = await request(app)
      .get(`/api/lessons/${lessonLockedId}/next-steps`)
      .set("Authorization", `Bearer ${tokenSubscribed}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.allowed).toBe(true);
    expect(res.body.lessonId).toBe(String(lessonLockedId));
    expect(res.body.nextSteps).not.toBeNull();
    expect(res.body.nextSteps.studentSummary).toBe("Review mitosis diagrams and try the practice questions again.");
    expect(res.body.nextSteps.updatedAt).toBeDefined();
    // Student must never receive full plan content or classroomNotes
    expect(res.body.nextSteps.content).toBeUndefined();
    expect(res.body.nextSteps.classroomNotes).toBeUndefined();
    expect(res.body.content).toBeUndefined();
    expect(res.body.classroomNotes).toBeUndefined();
  });

  test("SUB_ACTIVE with no plan returns 200 allowed:true nextSteps:null", async () => {
    const lessonNoPlan = await Lesson.create({
      title: "NS No Plan",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      isFreePreview: false,
      examQuestions: [],
    });
    await ReteachPlan.deleteMany({ lessonId: lessonNoPlan._id });

    const res = await request(app)
      .get(`/api/lessons/${lessonNoPlan._id}/next-steps`)
      .set("Authorization", `Bearer ${tokenSubscribed}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.allowed).toBe(true);
    expect(res.body.nextSteps).toBeNull();
  });
});
