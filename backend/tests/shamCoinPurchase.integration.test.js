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

const MIN_IDEM_KEY = 16;
function idemKey(s) {
  return s.length >= MIN_IDEM_KEY ? s : s + "-".repeat(MIN_IDEM_KEY - s.length);
}

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

  test("invalid idempotencyKey (too short or too long) returns 400", async () => {
    const resShort = await request(app)
      .post(`/api/lessons/${lessonId}/purchase`)
      .set("Authorization", `Bearer ${token}`)
      .send({ idempotencyKey: "short" });
    expect(resShort.status).toBe(400);
    expect(resShort.body.code).toBe("INVALID_IDEMPOTENCY_KEY");

    const resLong = await request(app)
      .post(`/api/lessons/${lessonId}/purchase`)
      .set("Authorization", `Bearer ${token}`)
      .send({ idempotencyKey: "a".repeat(129) });
    expect(resLong.status).toBe(400);
    expect(resLong.body.code).toBe("INVALID_IDEMPOTENCY_KEY");
  });

  test("insufficient coins returns 402 with code and amounts", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/purchase`)
      .set("Authorization", `Bearer ${token}`)
      .send({ idempotencyKey: idemKey("key-insufficient") });
    expect(res.status).toBe(402);
    expect(res.body.error).toMatch(/insufficient/i);
    expect(res.body.code).toBe("INSUFFICIENT_COINS");
    expect(res.body.required).toBe(10);
    expect(res.body.available).toBe(5);
  });

  test("successful purchase decrements coins and grants access", async () => {
    await User.findByIdAndUpdate(studentId, { shamCoins: 20, $set: { purchasedLessons: [] } });
    await LessonPurchase.deleteMany({ userId: studentId, lessonId });

    let res = await request(app)
      .post(`/api/lessons/${lessonId}/purchase`)
      .set("Authorization", `Bearer ${token}`)
      .send({ idempotencyKey: idemKey("key-success-1") });
    if (res.status === 409 && res.body.code === "PURCHASE_CONFLICT") {
      res = await request(app)
        .post(`/api/lessons/${lessonId}/purchase`)
        .set("Authorization", `Bearer ${token}`)
        .send({ idempotencyKey: idemKey("key-success-1") });
    }
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

    let res = await request(app)
      .post(`/api/lessons/${lessonId}/purchase`)
      .set("Authorization", `Bearer ${token}`)
      .send({ idempotencyKey: idemKey("key-success-1") });
    if (res.status === 409 && res.body.code === "PURCHASE_CONFLICT") {
      res = await request(app)
        .post(`/api/lessons/${lessonId}/purchase`)
        .set("Authorization", `Bearer ${token}`)
        .send({ idempotencyKey: idemKey("key-success-1") });
    }
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

    const sameKey = idemKey("key-double-click-" + Date.now());
    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/lessons/${otherLesson._id}/purchase`)
        .set("Authorization", `Bearer ${token}`)
        .send({ idempotencyKey: sameKey }),
      request(app)
        .post(`/api/lessons/${otherLesson._id}/purchase`)
        .set("Authorization", `Bearer ${token}`)
        .send({ idempotencyKey: sameKey }),
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

  test("different idempotency keys, same lesson, concurrent → only one purchase and one debit", async () => {
    const diffLesson = await Lesson.create({
      title: "Diff Keys Lesson",
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
      shamCoinPrice: 4,
      pages: [],
      quiz: { questions: [] },
      flashcards: [],
    });

    await User.findByIdAndUpdate(studentId, {
      shamCoins: 15,
      $pull: { purchasedLessons: { lessonId: diffLesson._id } },
    });
    await LessonPurchase.deleteMany({ userId: studentId, lessonId: diffLesson._id });

    const keyA = idemKey("key-concurrent-a-" + Date.now());
    const keyB = idemKey("key-concurrent-b-" + Date.now());
    const [resA, resB] = await Promise.all([
      request(app)
        .post(`/api/lessons/${diffLesson._id}/purchase`)
        .set("Authorization", `Bearer ${token}`)
        .send({ idempotencyKey: keyA }),
      request(app)
        .post(`/api/lessons/${diffLesson._id}/purchase`)
        .set("Authorization", `Bearer ${token}`)
        .send({ idempotencyKey: keyB }),
    ]);

    const aOk = resA.status === 200;
    const bOk = resB.status === 200;
    expect(aOk || bOk).toBe(true);
    const aNew = aOk && !resA.body.alreadyPurchased;
    const bNew = bOk && !resB.body.alreadyPurchased;
    expect(aNew !== bNew).toBe(true);
    if (resA.status === 409 || resB.status === 409) {
      expect([resA.body?.code, resB.body?.code].includes("PURCHASE_CONFLICT")).toBe(true);
    }

    const userAfter = await User.findById(studentId).select("shamCoins").lean();
    expect(userAfter.shamCoins).toBe(11);

    const ledgerRows = await LessonPurchase.countDocuments({
      userId: studentId,
      lessonId: diffLesson._id,
    });
    expect(ledgerRows).toBe(1);
  });
});
