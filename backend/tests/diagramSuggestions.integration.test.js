/**
 * PR8: GET /api/lessons/:id/diagram-suggestions — owner only, read-only.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const VisualModel = require("../models/VisualModel");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("GET /api/lessons/:id/diagram-suggestions", () => {
  let teacherId;
  let otherTeacherId;
  let lessonId;
  let teacherToken;
  let otherTeacherToken;
  let visualId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "D",
      lastName: "Teacher",
      email: "diagram-sugg-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const other = await User.create({
      firstName: "O",
      lastName: "Teacher",
      email: "diagram-sugg-other@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    otherTeacherId = other._id;

    const lesson = await Lesson.create({
      title: "Photosynthesis Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "D Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Photosynthesis",
      status: "draft",
      pages: [{ pageId: "p1", title: "P1", order: 0, blocks: [] }],
      examQuestions: [],
    });
    lessonId = lesson._id;

    const visual = await VisualModel.create({
      conceptKey: "photosynthesis",
      subject: "Biology",
      topic: "Photosynthesis",
      isPublished: true,
      variants: [{ level: "GCSE", type: "staticDiagram", src: "/visuals/photosynthesis.svg" }],
    });
    visualId = visual._id;

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    teacherToken = await login("diagram-sugg-teacher@test.com");
    otherTeacherToken = await login("diagram-sugg-other@test.com");
  });

  test("returns 401 without auth", async () => {
    const res = await request(app).get(`/api/lessons/${lessonId}/diagram-suggestions`);
    expect(res.status).toBe(401);
  });

  test("non-owner teacher => 404 (no existence leak)", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}/diagram-suggestions`)
      .set("Authorization", `Bearer ${otherTeacherToken}`);
    expect(res.status).toBe(404); // no existence leak: non-owner gets 404
  });

  test("owner gets suggestions for lesson with mapped topic (Photosynthesis)", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}/diagram-suggestions`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.lessonId).toBeDefined();
    expect(res.body.topicKey).toBe("photosynthesis");
    expect(res.body.topic).toBe("Photosynthesis");
    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.suggestions.length).toBeGreaterThanOrEqual(1);
    const first = res.body.suggestions.find((s) => s.conceptKey === "photosynthesis" || String(s.id) === String(visualId));
    expect(first).toBeDefined();
    expect(first.id).toBe(String(visualId));
    expect(first.conceptKey).toBe("photosynthesis");
    expect(first.isPublished).toBe(true);
  });

  test("unknown mapping returns 200 with ok and suggestions array (maybe empty)", async () => {
    const lesson2 = await Lesson.create({
      title: "Obscure Topic",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "D Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Some Obscure Topic Xyz",
      status: "draft",
      pages: [],
      examQuestions: [],
    });
    const res = await request(app)
      .get(`/api/lessons/${lesson2._id}/diagram-suggestions`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.suggestions)).toBe(true);
  });
});
