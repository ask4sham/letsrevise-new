/**
 * Phase 9C — Integration tests for POST /api/lessons/:id/purchase (idempotent, ledger-backed).
 */
const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const LessonPurchase = require("../models/LessonPurchase");
const bcrypt = require("bcryptjs");

describe("POST /api/lessons/:id/purchase (Phase 9C)", () => {
  let studentId;
  let lessonId;
  let token;
  const hashedPassword = bcrypt.hashSync("password123", 10);

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "T",
      lastName: "Teacher",
      email: "phase9c-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });

    const lesson = await Lesson.create({
      title: "Paid Lesson",
      description: "Desc",
      content: "Content",
      teacherId: teacher._id,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      isFreePreview: false,
      shamCoinPrice: 10,
      pages: [{ pageId: "p1", order: 0, blocks: [] }],
      quiz: { questions: [] },
      flashcards: [],
    });
    lessonId = lesson._id;

    const student = await User.create({
      firstName: "S",
      lastName: "Student",
      email: "phase9c-student@test.com",
      password: hashedPassword,
      userType: "student",
      shamCoins: 5,
      purchasedLessons: [],
    });
    studentId = student._id;

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "phase9c-student@test.com", password: "password123" });
    token = loginRes.body.token;
  });

  test("missing idempotencyKey returns 400", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/purchase`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/idempotencyKey/i);
  });

  test("insufficient coins returns 402 with code and amounts", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/purchase`)
      .set("Authorization", `Bearer ${token}`)
      .send({ idempotencyKey: "key-insufficient" });
    expect(res.status).toBe(402);
    expect(res.body.error).toMatch(/insufficient/i);
    expect(res.body.code).toBe("INSUFFICIENT_COINS");
    expect(res.body.required).toBe(10);
    expect(res.body.available).toBe(5);
  });

  test("successful purchase decrements coins and grants access", async () => {
    await User.findByIdAndUpdate(studentId, { shamCoins: 20, $set: { purchasedLessons: [] } });
    await LessonPurchase.deleteMany({ userId: studentId, lessonId });

    const res = await request(app)
      .post(`/api/lessons/${lessonId}/purchase`)
      .set("Authorization", `Bearer ${token}`)
      .send({ idempotencyKey: "key-success-1" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.entitlements.shamCoinsBalance).toBe(10);
    expect(res.body.entitlements.purchasedLessonsCount).toBe(1);

    const getRes = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.pages).toHaveLength(1);
    expect(getRes.body.quiz).toBeDefined();
  });

  test("idempotency: same idempotencyKey again returns 200, no double debit", async () => {
    const userBefore = await User.findById(studentId).select("shamCoins purchasedLessons").lean();
    const balanceBefore = userBefore.shamCoins;
    const countBefore = (userBefore.purchasedLessons || []).length;

    const res = await request(app)
      .post(`/api/lessons/${lessonId}/purchase`)
      .set("Authorization", `Bearer ${token}`)
      .send({ idempotencyKey: "key-success-1" });
    expect(res.status).toBe(200);
    expect(res.body.alreadyPurchased).toBe(true);
    expect(res.body.entitlements.shamCoinsBalance).toBe(balanceBefore);
    expect(res.body.entitlements.purchasedLessonsCount).toBe(countBefore);

    const ledgerCount = await LessonPurchase.countDocuments({ userId: studentId, lessonId });
    expect(ledgerCount).toBe(1);
  });

  test("double-click simulation: two requests with same key → only one debit", async () => {
    const otherLesson = await Lesson.create({
      title: "Other Paid",
      description: "D",
      content: "C",
      teacherId: (await User.findOne({ email: "phase9c-teacher@test.com" }))._id,
      teacherName: "T",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      isFreePreview: false,
      shamCoinPrice: 3,
      pages: [],
      quiz: { questions: [] },
      flashcards: [],
    });

    await User.findByIdAndUpdate(studentId, {
      shamCoins: 10,
      $pull: { purchasedLessons: { lessonId: otherLesson._id } },
    });
    await LessonPurchase.deleteMany({ userId: studentId, lessonId: otherLesson._id });

    const idemKey = "key-double-click-" + Date.now();
    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/lessons/${otherLesson._id}/purchase`)
        .set("Authorization", `Bearer ${token}`)
        .send({ idempotencyKey: idemKey }),
      request(app)
        .post(`/api/lessons/${otherLesson._id}/purchase`)
        .set("Authorization", `Bearer ${token}`)
        .send({ idempotencyKey: idemKey }),
    ]);

    const ok = res1.status === 200 || res2.status === 200;
    expect(ok).toBe(true);

    const userAfter = await User.findById(studentId).select("shamCoins").lean();
    expect(userAfter.shamCoins).toBe(7);

    const ledgerRows = await LessonPurchase.countDocuments({
      userId: studentId,
      lessonId: otherLesson._id,
    });
    expect(ledgerRows).toBe(1);
  });
});
