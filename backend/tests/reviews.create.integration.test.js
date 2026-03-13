/**
 * PR-REVIEWS-1: POST /api/reviews/:lessonId — student submit review.
 * Ensures route is mounted, auth and canAccessContent are enforced, validation works.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");

const hashedPassword = bcrypt.hashSync("password123", 10);

jest.setTimeout(15000);

describe("POST /api/reviews/:lessonId (create review)", () => {
  let teacherId;
  let lessonId;
  let tokenStudent;
  let tokenNotEntitled;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "R",
      lastName: "Teacher",
      email: "reviews-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const lesson = await Lesson.create({
      title: "Review Test Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isFreePreview: false,
    });
    lessonId = lesson._id;

    const student = await User.create({
      firstName: "Student",
      lastName: "Sub",
      email: "reviews-student@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: { status: "active", expiresAt: new Date(Date.now() + 86400000) },
      purchasedLessons: [],
    });

    const notEntitled = await User.create({
      firstName: "Student",
      lastName: "None",
      email: "reviews-not-entitled@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: null,
      purchasedLessons: [],
    });

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    tokenStudent = await login("reviews-student@test.com");
    tokenNotEntitled = await login("reviews-not-entitled@test.com");
  });

  afterEach(async () => {
    await mongoose.connection.collection("reviews").deleteMany({ lessonId });
  });

  test("student with access can post review → 200 and reviewId", async () => {
    const res = await request(app)
      .post(`/api/reviews/${lessonId}`)
      .set("Authorization", `Bearer ${tokenStudent}`)
      .send({ rating: 5, review: "Great lesson!" });

    expect(res.status).toBe(200);
    expect(res.body.msg).toBe("Review submitted successfully");
    expect(res.body.review).toBeDefined();
    expect(res.body.review.id).toBeDefined();
    expect(res.body.review.rating).toBe(5);
    expect(res.body.review.comment).toBe("Great lesson!");
  });

  test("401 without auth", async () => {
    const res = await request(app)
      .post(`/api/reviews/${lessonId}`)
      .send({ rating: 4, review: "Ok" });

    expect(res.status).toBe(401);
  });

  test("402 when student not entitled to lesson", async () => {
    const res = await request(app)
      .post(`/api/reviews/${lessonId}`)
      .set("Authorization", `Bearer ${tokenNotEntitled}`)
      .send({ rating: 4, review: "Ok" });

    expect(res.status).toBe(402);
  });

  test("400 invalid rating (0)", async () => {
    const res = await request(app)
      .post(`/api/reviews/${lessonId}`)
      .set("Authorization", `Bearer ${tokenStudent}`)
      .send({ rating: 0, review: "" });

    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/valid rating|1-5/i);
  });

  test("400 invalid rating (6)", async () => {
    const res = await request(app)
      .post(`/api/reviews/${lessonId}`)
      .set("Authorization", `Bearer ${tokenStudent}`)
      .send({ rating: 6, review: "" });

    expect(res.status).toBe(400);
    expect(res.body.msg).toMatch(/valid rating|1-5/i);
  });
});
