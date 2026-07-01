/**
 * Teaching Access V1 — TEACH permission, teaching library, SHARED_TEACH classroom access.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const LessonShare = require("../models/LessonShare");

describe("Teaching Access V1", () => {
  let ownerId;
  let teachTeacherId;
  let viewTeacherId;
  let otherTeacherId;
  let studentId;
  let adminId;
  let lessonId;
  let tokenOwner;
  let tokenTeachTeacher;
  let tokenViewTeacher;
  let tokenOther;
  let tokenStudent;
  let tokenAdmin;
  const hashedPassword = bcrypt.hashSync("password123", 10);
  const ts = Date.now();

  beforeAll(async () => {
    const owner = await User.create({
      firstName: "Sham",
      lastName: "Owner",
      email: `teach-owner-${ts}@test.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    ownerId = owner._id;

    const teachTeacher = await User.create({
      firstName: "Rachel",
      lastName: "Teacher",
      email: `teach-rachel-${ts}@test.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    teachTeacherId = teachTeacher._id;

    const viewTeacher = await User.create({
      firstName: "View",
      lastName: "Reviewer",
      email: `teach-viewer-${ts}@test.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    viewTeacherId = viewTeacher._id;

    const other = await User.create({
      firstName: "Other",
      lastName: "Teacher",
      email: `teach-other-${ts}@test.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    otherTeacherId = other._id;

    const student = await User.create({
      firstName: "Teach",
      lastName: "Student",
      email: `teach-student-${ts}@test.com`,
      password: hashedPassword,
      userType: "student",
      subscriptionV2: null,
      purchasedLessons: [],
    });
    studentId = student._id;

    const admin = await User.create({
      firstName: "Teach",
      lastName: "Admin",
      email: `teach-admin-${ts}@test.com`,
      password: hashedPassword,
      userType: "admin",
    });
    adminId = admin._id;

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    tokenOwner = await login(`teach-owner-${ts}@test.com`);
    tokenTeachTeacher = await login(`teach-rachel-${ts}@test.com`);
    tokenViewTeacher = await login(`teach-viewer-${ts}@test.com`);
    tokenOther = await login(`teach-other-${ts}@test.com`);
    tokenStudent = await login(`teach-student-${ts}@test.com`);
    tokenAdmin = await login(`teach-admin-${ts}@test.com`);

    const lesson = await Lesson.create({
      title: "Human Reproductive Systems Teach",
      description: "Draft for classroom teaching share",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Sham Owner",
      subject: "Biology",
      level: "IGCSE",
      topic: "Human Reproductive Systems",
      board: "Edexcel",
      status: "draft",
      isPublished: false,
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "Teach me" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });
    lessonId = lesson._id;
  });

  test("owner can share lesson with Rachel as TEACH", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/shares`)
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ email: `teach-rachel-${ts}@test.com`, permission: "TEACH" });
    expect(res.status).toBe(201);
    expect(res.body.share.permission).toBe("TEACH");
    expect(res.body.permission).toBe("TEACH");
  });

  test("Rachel sees lesson in teaching library not in my lessons or review requests", async () => {
    const libraryRes = await request(app)
      .get("/api/lessons/teaching-library")
      .set("Authorization", `Bearer ${tokenTeachTeacher}`);
    expect(libraryRes.status).toBe(200);
    expect(libraryRes.body.some((l) => String(l._id) === String(lessonId))).toBe(true);
    expect(libraryRes.body[0].accessRole).toBe("shared_teach");

    const reviewRes = await request(app)
      .get("/api/lessons/review-requests")
      .set("Authorization", `Bearer ${tokenTeachTeacher}`);
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.some((l) => String(l._id) === String(lessonId))).toBe(false);

    const mineRes = await request(app)
      .get("/api/lessons/teacher")
      .set("Authorization", `Bearer ${tokenTeachTeacher}`);
    const mine = Array.isArray(mineRes.body) ? mineRes.body : mineRes.body.lessons || [];
    expect(mine.some((l) => String(l._id) === String(lessonId))).toBe(false);
  });

  test("Rachel can open lesson for teaching with SHARED_TEACH", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${tokenTeachTeacher}`);
    expect(res.status).toBe(200);
    expect(res.body.accessDecision?.reason).toBe("SHARED_TEACH");
    expect(res.body.shareMeta?.sharedByName).toMatch(/Sham/i);
  });

  test("Rachel can open classroom presentation mode", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .query({ present: "classroom" })
      .set("Authorization", `Bearer ${tokenTeachTeacher}`);
    expect(res.status).toBe(200);
    expect(res.body.accessDecision?.reason).toBe("SHARED_TEACH");
  });

  test("Rachel cannot edit publish delete or manage shares", async () => {
    const putRes = await request(app)
      .put(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${tokenTeachTeacher}`)
      .send({ title: "Hijacked" });
    expect(putRes.status).toBe(401);

    const pubRes = await request(app)
      .put(`/api/lessons/${lessonId}/publish`)
      .set("Authorization", `Bearer ${tokenTeachTeacher}`);
    expect([401, 404]).toContain(pubRes.status);

    const delRes = await request(app)
      .delete(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${tokenTeachTeacher}`);
    expect([401, 404]).toContain(delRes.status);

    const sharesRes = await request(app)
      .get(`/api/lessons/${lessonId}/shares`)
      .set("Authorization", `Bearer ${tokenTeachTeacher}`);
    expect(sharesRes.status).toBe(403);
  });

  test("VIEW shares appear only in review requests", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/shares`)
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ email: `teach-viewer-${ts}@test.com`, permission: "VIEW" });
    expect(res.status).toBe(201);
    expect(res.body.share.permission).toBe("VIEW");

    const reviewRes = await request(app)
      .get("/api/lessons/review-requests")
      .set("Authorization", `Bearer ${tokenViewTeacher}`);
    expect(reviewRes.body.some((l) => String(l._id) === String(lessonId))).toBe(true);

    const libraryRes = await request(app)
      .get("/api/lessons/teaching-library")
      .set("Authorization", `Bearer ${tokenViewTeacher}`);
    expect(libraryRes.body.some((l) => String(l._id) === String(lessonId))).toBe(false);
  });

  test("TEACH shares do not appear in review requests", async () => {
    const reviewRes = await request(app)
      .get("/api/lessons/review-requests")
      .set("Authorization", `Bearer ${tokenTeachTeacher}`);
    expect(reviewRes.body.some((l) => String(l._id) === String(lessonId))).toBe(false);
  });

  test("VIEW reviewer cannot open classroom mode", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .query({ present: "classroom" })
      .set("Authorization", `Bearer ${tokenViewTeacher}`);
    expect(res.status).toBe(403);
    expect(res.body.reason).toBe("CLASSROOM_TEACH_REQUIRED");
  });

  test("VIEW reviewer still gets SHARED_REVIEW on lesson preview", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${tokenViewTeacher}`);
    expect(res.status).toBe(200);
    expect(res.body.accessDecision?.reason).toBe("SHARED_REVIEW");
  });

  test("student access to draft lesson is unchanged", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${tokenStudent}`);
    expect(res.status).toBe(403);
    expect(res.body.reason).toBe("NOT_PUBLISHED");
  });

  test("admin can grant and revoke TEACH access", async () => {
    const revokeRes = await request(app)
      .delete(`/api/lessons/${lessonId}/shares/${teachTeacherId}`)
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.share.status).toBe("revoked");

    const grantRes = await request(app)
      .post(`/api/lessons/${lessonId}/shares`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ teacherId: String(teachTeacherId), permission: "TEACH" });
    expect(grantRes.status).toBe(201);
    expect(grantRes.body.share.permission).toBe("TEACH");

    const shareCount = await LessonShare.countDocuments({
      lessonId,
      teacherId: teachTeacherId,
      status: "active",
      permission: "TEACH",
    });
    expect(shareCount).toBe(1);
  });
});
