/**
 * PR-EDGE-4.1: Quiz assignment share — GET /api/quiz-assignments/share/:shareId
 */
const request = require("supertest");
const app = require("../app");
const QuizAssignment = require("../models/QuizAssignment");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("GET /api/quiz-assignments/share/:shareId (PR-EDGE-4.1)", () => {
  let teacherId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Share",
      lastName: "Teacher",
      email: "share-quiz-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
  });

  afterAll(async () => {
    await QuizAssignment.deleteMany({});
  });

  test("returns 404 for unknown shareId", async () => {
    const res = await request(app).get("/api/quiz-assignments/share/nonexistent123");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test("returns assignment by shareId (public, no auth)", async () => {
    const assign = await QuizAssignment.create({
      ownerId: teacherId,
      kind: "quiz",
      title: "Share Test Quiz",
      isActive: true,
      shareId: "sharequiz" + Date.now(),
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const res = await request(app).get(`/api/quiz-assignments/share/${assign.shareId}`);
    expect(res.status).toBe(200);
    expect(res.body.assignment).toBeDefined();
    expect(res.body.assignment.shareId).toBe(assign.shareId);
    expect(res.body.assignment.kind).toBe("quiz");
    expect(res.body.assignment.title).toBe("Share Test Quiz");
    expect(res.body.assignment.isActive).toBe(true);
  });

  test("returns closed when assignment inactive", async () => {
    const assign = await QuizAssignment.create({
      ownerId: teacherId,
      kind: "assessment",
      title: "Closed Assessment",
      isActive: false,
      shareId: "shareclosed" + Date.now(),
    });

    const res = await request(app).get(`/api/quiz-assignments/share/${assign.shareId}`);
    expect(res.status).toBe(200);
    expect(res.body.closed).toBe(true);
    expect(res.body.assignment.isActive).toBe(false);
  });
});
