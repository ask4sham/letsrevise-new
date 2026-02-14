/**
 * Phase 9D — Integration tests for teacher review workflow: draft → in_review → published,
 * submit-review, approve, reject, unpublish; access rules (owner/admin vs student).
 */
const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const LessonReview = require("../models/LessonReview");
const bcrypt = require("bcryptjs");

describe("Phase 9D lesson review workflow", () => {
  let teacherId;
  let studentId;
  let adminId;
  let lessonId;
  let tokenTeacher;
  let tokenStudent;
  let tokenAdmin;
  const hashedPassword = bcrypt.hashSync("password123", 10);

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Phase9D",
      lastName: "Teacher",
      email: "phase9d-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const student = await User.create({
      firstName: "Phase9D",
      lastName: "Student",
      email: "phase9d-student@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: null,
      purchasedLessons: [],
    });
    studentId = student._id;

    const admin = await User.create({
      firstName: "Phase9D",
      lastName: "Admin",
      email: "phase9d-admin@test.com",
      password: hashedPassword,
      userType: "admin",
    });
    adminId = admin._id;

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    tokenTeacher = await login("phase9d-teacher@test.com");
    tokenStudent = await login("phase9d-student@test.com");
    tokenAdmin = await login("phase9d-admin@test.com");
  });

  describe("draft lifecycle", () => {
    beforeAll(async () => {
      const lesson = await Lesson.create({
        title: "Phase9D Draft Lesson",
        description: "Desc",
        content: "Content",
        teacherId,
        teacherName: "Phase9D Teacher",
        subject: "Biology",
        level: "GCSE",
        topic: "Cells",
        status: "draft",
        isPublished: false,
        pages: [{ pageId: "p1", order: 0, blocks: [] }],
        quiz: { questions: [] },
        flashcards: [],
      });
      lessonId = lesson._id;
    });

    test("teacher creates draft → status DRAFT", async () => {
      const lesson = await Lesson.findById(lessonId).lean();
      expect(lesson.status).toBe("draft");
      expect(lesson.isPublished).toBe(false);
    });

    test("student cannot access draft lesson → 403 NOT_PUBLISHED", async () => {
      const res = await request(app)
        .get(`/api/lessons/${lessonId}`)
        .set("Authorization", `Bearer ${tokenStudent}`);
      expect(res.status).toBe(403);
      expect(res.body.reason).toBe("NOT_PUBLISHED");
    });

    test("owner can access draft → 200 full", async () => {
      const res = await request(app)
        .get(`/api/lessons/${lessonId}`)
        .set("Authorization", `Bearer ${tokenTeacher}`);
      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Phase9D Draft Lesson");
      expect(res.body.pages).toHaveLength(1);
    });

    test("submit-review transitions DRAFT → in_review", async () => {
      const res = await request(app)
        .post(`/api/lessons/${lessonId}/submit-review`)
        .set("Authorization", `Bearer ${tokenTeacher}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.lesson.status).toBe("in_review");
      const lesson = await Lesson.findById(lessonId).lean();
      expect(lesson.status).toBe("in_review");
    });

    test("student cannot access IN_REVIEW → 403 NOT_PUBLISHED", async () => {
      const res = await request(app)
        .get(`/api/lessons/${lessonId}`)
        .set("Authorization", `Bearer ${tokenStudent}`);
      expect(res.status).toBe(403);
      expect(res.body.reason).toBe("NOT_PUBLISHED");
    });

    test("admin approves → IN_REVIEW → PUBLISHED", async () => {
      const res = await request(app)
        .post(`/api/reviews/lesson/${lessonId}/approve`)
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .send({ notes: "Looks good" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.lesson.status).toBe("published");
      const lesson = await Lesson.findById(lessonId).lean();
      expect(lesson.status).toBe("published");
      expect(lesson.isPublished).toBe(true);
    });

    test("entitled student can access PUBLISHED (subscribed)", async () => {
      const future = new Date(Date.now() + 86400000);
      await User.updateOne(
        { _id: studentId },
        { $set: { subscriptionV2: { status: "active", expiresAt: future } } }
      );
      const res = await request(app)
        .get(`/api/lessons/${lessonId}`)
        .set("Authorization", `Bearer ${tokenStudent}`);
      expect(res.status).toBe(200);
      expect(res.body.pages).toHaveLength(1);
    });
  });

  describe("reject and invalid transitions", () => {
    let lesson2Id;

    beforeAll(async () => {
      const lesson2 = await Lesson.create({
        title: "Phase9D Lesson To Reject",
        description: "Desc",
        content: "Content",
        teacherId,
        teacherName: "Phase9D Teacher",
        subject: "Biology",
        level: "GCSE",
        topic: "Cells",
        status: "draft",
        isPublished: false,
        pages: [],
        quiz: { questions: [] },
        flashcards: [],
      });
      lesson2Id = lesson2._id;
      await request(app)
        .post(`/api/lessons/${lesson2Id}/submit-review`)
        .set("Authorization", `Bearer ${tokenTeacher}`);
    });

    test("admin rejects → IN_REVIEW → DRAFT", async () => {
      const res = await request(app)
        .post(`/api/reviews/lesson/${lesson2Id}/reject`)
        .set("Authorization", `Bearer ${tokenAdmin}`)
        .send({ notes: "Needs fixes" });
      expect(res.status).toBe(200);
      expect(res.body.lesson.status).toBe("draft");
      const lesson = await Lesson.findById(lesson2Id).lean();
      expect(lesson.status).toBe("draft");
      expect(lesson.isPublished).toBe(false);
    });

    test("submit-review when already IN_REVIEW → 200 alreadyInReview (idempotent)", async () => {
      const lesson3 = await Lesson.create({
        title: "Phase9D In Review",
        description: "D",
        content: "C",
        teacherId,
        teacherName: "T",
        subject: "Bio",
        level: "GCSE",
        topic: "T",
        status: "in_review",
        isPublished: false,
        pages: [],
        quiz: { questions: [] },
        flashcards: [],
      });
      const res = await request(app)
        .post(`/api/lessons/${lesson3._id}/submit-review`)
        .set("Authorization", `Bearer ${tokenTeacher}`);
      expect(res.status).toBe(200);
      expect(res.body.alreadyInReview).toBe(true);
      expect(res.body.lesson.status).toBe("in_review");
    });

    test("submit-review when PUBLISHED → 409 INVALID_STATE", async () => {
      const res = await request(app)
        .post(`/api/lessons/${lessonId}/submit-review`)
        .set("Authorization", `Bearer ${tokenTeacher}`);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_STATE");
    });
  });

  describe("submit-review idempotency", () => {
    let lessonSubmitTwiceId;

    beforeAll(async () => {
      const lesson = await Lesson.create({
        title: "Phase9D Submit Twice",
        description: "D",
        content: "C",
        teacherId,
        teacherName: "T",
        subject: "Bio",
        level: "GCSE",
        topic: "T",
        status: "draft",
        isPublished: false,
        pages: [],
        quiz: { questions: [] },
        flashcards: [],
      });
      lessonSubmitTwiceId = lesson._id;
    });

    test("submit-review twice does not create two pending reviews", async () => {
      const res1 = await request(app)
        .post(`/api/lessons/${lessonSubmitTwiceId}/submit-review`)
        .set("Authorization", `Bearer ${tokenTeacher}`);
      expect(res1.status).toBe(200);
      expect(res1.body.alreadyInReview).toBeFalsy();

      const res2 = await request(app)
        .post(`/api/lessons/${lessonSubmitTwiceId}/submit-review`)
        .set("Authorization", `Bearer ${tokenTeacher}`);
      expect(res2.status).toBe(200);
      expect(res2.body.alreadyInReview).toBe(true);

      const pendingCount = await LessonReview.countDocuments({
        lessonId: lessonSubmitTwiceId,
        status: "PENDING",
      });
      expect(pendingCount).toBe(1);
    });
  });

  describe("unpublish and list filtering", () => {
    test("owner can unpublish → PUBLISHED → draft", async () => {
      const res = await request(app)
        .post(`/api/lessons/${lessonId}/unpublish`)
        .set("Authorization", `Bearer ${tokenTeacher}`);
      expect(res.status).toBe(200);
      expect(res.body.lesson.status).toBe("draft");
      const lesson = await Lesson.findById(lessonId).lean();
      expect(lesson.status).toBe("draft");
    });

    test("unpublish when not published → 409 INVALID_STATE", async () => {
      const res = await request(app)
        .post(`/api/lessons/${lessonId}/unpublish`)
        .set("Authorization", `Bearer ${tokenTeacher}`);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("INVALID_STATE");
    });

    test("student list does not include draft lessons", async () => {
      const res = await request(app)
        .get("/api/lessons")
        .set("Authorization", `Bearer ${tokenStudent}`);
      expect(res.status).toBe(200);
      const draft = (res.body || []).find((l) => String(l._id) === String(lessonId));
      expect(draft).toBeUndefined();
    });

    test("teacher list includes own draft", async () => {
      const res = await request(app)
        .get("/api/lessons")
        .set("Authorization", `Bearer ${tokenTeacher}`);
      expect(res.status).toBe(200);
      const found = (res.body || []).find((l) => String(l._id) === String(lessonId));
      expect(found).toBeDefined();
      expect(found.status).toBe("draft");
    });
  });
});
