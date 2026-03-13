/**
 * PR-PAST-PAPERS-API-1: GET /api/past-papers/mine — auth + owner-only + filtering.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const PastPaper = require("../models/PastPaper");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("GET /api/past-papers/mine", () => {
  let token;
  let teacherId;

  beforeAll(async () => {
    const email = `teacher_mine_${Date.now()}@example.com`;
    const teacher = await User.create({
      email,
      password: hashedPassword,
      userType: "teacher",
      firstName: "PastPaper",
      lastName: "Teacher",
    });
    teacherId = teacher._id;

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "password123" })
      .expect(200);

    token = login.body?.token;
    if (!token) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    await PastPaper.deleteMany({ ownerId: teacherId });
  });

  it("requires auth", async () => {
    await request(app).get("/api/past-papers/mine").expect(401);
  });

  it("returns only my papers", async () => {
    await PastPaper.create({
      ownerId: teacherId,
      specKey: "aqa-gcse-biology",
      subject: "Biology",
      examBoard: "AQA",
      level: "GCSE",
      year: "2024",
      series: "June",
      paperCode: "Paper 1",
      tier: "higher",
      title: "My Paper",
      pdf: { mediaId: null, url: null, mimeType: "application/pdf" },
      fingerprint: `fp_${Date.now()}_1`,
    });

    const res = await request(app)
      .get("/api/past-papers/mine?specKey=aqa-gcse-biology&year=2024")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const p of res.body.items) {
      expect(String(p.ownerId)).toBe(String(teacherId));
    }
  });
});
