const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("GET /api/ai/framework-classification-audit", () => {
  let teacherId;
  let teacherToken;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Audit",
      lastName: "Teacher",
      email: "framework-audit-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "framework-audit-teacher@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Teacher login failed");

    await Lesson.create([
      {
        teacherId,
        teacherName: "Audit Teacher",
        title: "Reflex Arc generated",
        description: "Generated lesson",
        content: "Generated lesson content",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        topic: "Reflex Arc",
        topicKey: "aqa-gcse-biology:the-reflex-arc",
        pages: [{ pageId: "p1", title: "P1", order: 1, blocks: [{ type: "text", content: "x" }] }],
        metadata: { lessonGeneratorVersion: 2 },
      },
      {
        teacherId,
        teacherName: "Audit Teacher",
        title: "Mitosis generated",
        description: "Generated lesson",
        content: "Generated lesson content",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        topic: "Mitosis",
        topicKey: "aqa-gcse-biology:mitosis",
        pages: [{ pageId: "p2", title: "P1", order: 1, blocks: [{ type: "text", content: "x" }] }],
        metadata: { lessonGeneratorVersion: 2 },
      },
      {
        teacherId,
        teacherName: "Audit Teacher",
        title: "Maths lesson",
        description: "Generated lesson",
        content: "Generated lesson content",
        subject: "Maths",
        level: "GCSE",
        board: "AQA",
        topic: "Algebra",
        topicKey: "aqa-gcse-maths:algebra",
        pages: [{ pageId: "p3", title: "P1", order: 1, blocks: [{ type: "text", content: "x" }] }],
        metadata: { lessonGeneratorVersion: 2 },
      },
    ]);
  }, 20000);

  afterAll(async () => {
    await Lesson.deleteMany({
      title: { $in: ["Reflex Arc generated", "Mitosis generated", "Maths lesson"] },
    });
    await User.deleteMany({ email: "framework-audit-teacher@test.com" });
  });

  test("returns biology-only rows with framework fields", async () => {
    const res = await request(app)
      .get("/api/ai/framework-classification-audit")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({ subject: "Biology", limit: 50 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.filters.subject).toBe("Biology");
    expect(res.body.filters.limit).toBe(50);

    const titles = res.body.rows.map((r) => r.title);
    expect(titles).toContain("Reflex Arc generated");
    expect(titles).toContain("Mitosis generated");
    expect(titles).not.toContain("Maths lesson");

    const reflex = res.body.rows.find((r) => r.title === "Reflex Arc generated");
    expect(reflex.framework).toBe("signal_pathway");
    expect(reflex.visualModel).toBe("signal_flow_map");
    expect(reflex.confidence).toBeDefined();
    expect(reflex.matchedBy).toBeDefined();
    expect(reflex.generatedAt).toBeTruthy();
  });
});

