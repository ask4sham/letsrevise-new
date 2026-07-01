/**
 * Share for Review V1 — integration tests for LessonShare grants and SHARED_REVIEW access.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const LessonShare = require("../models/LessonShare");

describe("Share for Review V1", () => {
  let ownerId;
  let reviewerId;
  let otherTeacherId;
  let studentId;
  let adminId;
  let lessonId;
  let tokenOwner;
  let tokenReviewer;
  let tokenOther;
  let tokenStudent;
  let tokenAdmin;
  const hashedPassword = bcrypt.hashSync("password123", 10);
  const ts = Date.now();

  beforeAll(async () => {
    const owner = await User.create({
      firstName: "Sham",
      lastName: "Owner",
      email: `share-owner-${ts}@test.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    ownerId = owner._id;

    const reviewer = await User.create({
      firstName: "Rachel",
      lastName: "Reviewer",
      email: `share-reviewer-${ts}@test.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    reviewerId = reviewer._id;

    const other = await User.create({
      firstName: "Other",
      lastName: "Teacher",
      email: `share-other-${ts}@test.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    otherTeacherId = other._id;

    const student = await User.create({
      firstName: "Share",
      lastName: "Student",
      email: `share-student-${ts}@test.com`,
      password: hashedPassword,
      userType: "student",
      subscriptionV2: null,
      purchasedLessons: [],
    });
    studentId = student._id;

    const admin = await User.create({
      firstName: "Share",
      lastName: "Admin",
      email: `share-admin-${ts}@test.com`,
      password: hashedPassword,
      userType: "admin",
    });
    adminId = admin._id;

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    tokenOwner = await login(`share-owner-${ts}@test.com`);
    tokenReviewer = await login(`share-reviewer-${ts}@test.com`);
    tokenOther = await login(`share-other-${ts}@test.com`);
    tokenStudent = await login(`share-student-${ts}@test.com`);
    tokenAdmin = await login(`share-admin-${ts}@test.com`);

    const lesson = await Lesson.create({
      title: "Human Reproductive Systems Review",
      description: "Draft for peer review",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Sham Owner",
      subject: "Biology",
      level: "IGCSE",
      topic: "Human Reproductive Systems",
      board: "Edexcel",
      status: "draft",
      isPublished: false,
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "Review me" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });
    lessonId = lesson._id;
  });

  test("owner shares draft lesson with reviewer by email", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/shares`)
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ email: `share-reviewer-${ts}@test.com` });
    expect(res.status).toBe(201);
    expect(res.body.share.status).toBe("active");
    expect(res.body.share.permission).toBe("VIEW");
  });

  test("reviewer sees lesson in review-requests not in teacher list", async () => {
    const reviewRes = await request(app)
      .get("/api/lessons/review-requests")
      .set("Authorization", `Bearer ${tokenReviewer}`);
    expect(reviewRes.status).toBe(200);
    expect(Array.isArray(reviewRes.body)).toBe(true);
    expect(reviewRes.body.some((l) => String(l._id) === String(lessonId))).toBe(true);
    expect(reviewRes.body[0].accessRole).toBe("shared_review");

    const mineRes = await request(app)
      .get("/api/lessons/teacher")
      .set("Authorization", `Bearer ${tokenReviewer}`);
    expect(mineRes.status).toBe(200);
    const mine = Array.isArray(mineRes.body) ? mineRes.body : mineRes.body.lessons || [];
    expect(mine.some((l) => String(l._id) === String(lessonId))).toBe(false);
  });

  test("reviewer can preview draft with SHARED_REVIEW", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${tokenReviewer}`);
    expect(res.status).toBe(200);
    expect(res.body.accessDecision?.reason).toBe("SHARED_REVIEW");
    expect(res.body.title).toMatch(/Human Reproductive/i);
  });

  test("unrelated teacher still gets 404 on draft lesson", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${tokenOther}`);
    expect(res.status).toBe(404);
    expect(res.body.reason).toBe("ACCESS_DENIED");
  });

  test("student cannot access draft lesson", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${tokenStudent}`);
    expect(res.status).toBe(403);
    expect(res.body.reason).toBe("NOT_PUBLISHED");
  });

  test("reviewer cannot edit publish or delete shared lesson", async () => {
    const putRes = await request(app)
      .put(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${tokenReviewer}`)
      .send({ title: "Hijacked" });
    expect(putRes.status).toBe(401);

    const pubRes = await request(app)
      .put(`/api/lessons/${lessonId}/publish`)
      .set("Authorization", `Bearer ${tokenReviewer}`);
    expect([401, 404]).toContain(pubRes.status);

    const delRes = await request(app)
      .delete(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${tokenReviewer}`);
    expect([401, 404]).toContain(delRes.status);
  });

  test("admin can list and revoke share", async () => {
    const listRes = await request(app)
      .get(`/api/lessons/${lessonId}/shares`)
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.shares.length).toBeGreaterThanOrEqual(1);

    const revokeRes = await request(app)
      .delete(`/api/lessons/${lessonId}/shares/${reviewerId}`)
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.share.status).toBe("revoked");
  });

  test("revoked reviewer loses access", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${tokenReviewer}`);
    expect(res.status).toBe(404);

    const reviewRes = await request(app)
      .get("/api/lessons/review-requests")
      .set("Authorization", `Bearer ${tokenReviewer}`);
    const items = Array.isArray(reviewRes.body) ? reviewRes.body : [];
    expect(items.some((l) => String(l._id) === String(lessonId))).toBe(false);
  });

  test("rejects share when email is registered as student", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/shares`)
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ email: `share-student-${ts}@test.com` });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not as a teacher/i);
  });

  test("owner can re-share after revoke", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/shares`)
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ teacherId: String(reviewerId) });
    expect(res.status).toBe(201);

    const shareCount = await LessonShare.countDocuments({ lessonId, teacherId: reviewerId });
    expect(shareCount).toBe(1);
  });
});
