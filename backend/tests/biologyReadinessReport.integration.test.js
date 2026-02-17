/**
 * PR10: GET /api/reports/aqa-gcse-biology/readiness?scope=me
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("GET /api/reports/aqa-gcse-biology/readiness", () => {
  let teacherId;
  let teacherToken;
  let adminToken;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Report",
      lastName: "Teacher",
      email: "readiness-report-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const admin = await User.create({
      firstName: "Admin",
      lastName: "User",
      email: "readiness-report-admin@test.com",
      password: hashedPassword,
      userType: "admin",
    });

    const visualOid = new mongoose.Types.ObjectId();
    const questionOid = new mongoose.Types.ObjectId();

    // Lesson 1: Bioenergetics, published + READY (diagrams, checkpoints, reviewed)
    await Lesson.create({
      title: "Photosynthesis",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "Report Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Photosynthesis",
      status: "published",
      isPublished: true,
      reviewedAt: new Date(),
      reviewedBy: teacherId,
      pages: [
        {
          pageId: "p1",
          title: "P1",
          order: 1,
          blocks: [
            { type: "diagram", visualId: visualOid, caption: "" },
            { type: "checkpoint", prompt: "What is photosynthesis?", options: ["A", "B", "C", "D"], correctAnswer: "A" },
          ],
        },
      ],
      examQuestions: [{ questionId: questionOid }],
    });

    // Lesson 2: Cell Biology, draft
    await Lesson.create({
      title: "Cell structure",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "Report Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cell structure",
      status: "draft",
      isPublished: false,
      pages: [{ pageId: "p2", title: "P2", order: 1, blocks: [] }],
      examQuestions: [],
    });

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    teacherToken = await login("readiness-report-teacher@test.com");
    adminToken = await login("readiness-report-admin@test.com");
  });

  test("returns 401 without auth", async () => {
    const res = await request(app).get("/api/reports/aqa-gcse-biology/readiness?scope=me");
    expect(res.status).toBe(401);
  });

  test("scope=me returns totals and byUnit for teacher", async () => {
    const res = await request(app)
      .get("/api/reports/aqa-gcse-biology/readiness?scope=me")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.subject).toBe("Biology");
    expect(res.body.examBoard).toBe("AQA");
    expect(res.body.level).toBe("GCSE");
    expect(res.body.totals).toBeDefined();
    expect(res.body.totals.lessonsPublished).toBeGreaterThanOrEqual(1);
    expect(res.body.totals.lessonsDraft).toBeGreaterThanOrEqual(1);
    expect(res.body.totals.ready).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.byUnit)).toBe(true);
    expect(res.body.byUnit.length).toBeGreaterThan(0);
    const bioenergetics = res.body.byUnit.find((u) => u.unit === "Bioenergetics");
    expect(bioenergetics).toBeDefined();
    expect(bioenergetics.topicsTotal).toBeGreaterThan(0);
    expect(bioenergetics.readiness).toBeDefined();
    expect(res.body.uncoveredTopicsByUnit).toBeDefined();
    expect(Array.isArray(res.body.uncoveredTopicsByUnit)).toBe(true);
  });

  test("admin with scope=teacherId=<id> gets that teacher report", async () => {
    const res = await request(app)
      .get(`/api/reports/aqa-gcse-biology/readiness?scope=teacherId=${teacherId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.totals.lessonsPublished).toBeGreaterThanOrEqual(1);
  });

  test("teacher cannot use scope=teacherId= (admin only)", async () => {
    const res = await request(app)
      .get(`/api/reports/aqa-gcse-biology/readiness?scope=teacherId=${teacherId}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(403);
  });
});
