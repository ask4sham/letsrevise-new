/**
 * PR-W2.3: Dev seed endpoint — only when ENABLE_DEV_TOOLS=1; teacher/admin only.
 * Run 404 test: ENABLE_DEV_TOOLS=0 npm test -- --testPathPattern=devSeed --runInBand
 * Run auth tests: ENABLE_DEV_TOOLS=1 npm test -- --testPathPattern=devSeed --runInBand
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("POST /api/dev/seed/aqa-gcse-biology/:scope", () => {
  let teacherToken;
  let studentToken;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Dev",
      lastName: "Teacher",
      email: "dev-seed-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const teacherLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "dev-seed-teacher@test.com", password: "password123" });
    teacherToken = teacherLogin.body?.token;

    if (process.env.ENABLE_DEV_TOOLS === "1") {
      await User.create({
        firstName: "Dev",
        lastName: "Student",
        email: "dev-seed-student@test.com",
        password: hashedPassword,
        userType: "student",
      });
      const studentLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: "dev-seed-student@test.com", password: "password123" });
      studentToken = studentLogin.body?.token;
    }
  });

  test("returns 404 when ENABLE_DEV_TOOLS is not 1", async () => {
    if (process.env.ENABLE_DEV_TOOLS === "1") return;
    const res = await request(app)
      .post("/api/dev/seed/aqa-gcse-biology/cell-biology")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });

  test("student token receives 403 when ENABLE_DEV_TOOLS=1", async () => {
    if (process.env.ENABLE_DEV_TOOLS !== "1" || !studentToken) return;
    const res = await request(app)
      .post("/api/dev/seed/aqa-gcse-biology/cell-biology")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
    expect(res.body.msg).toMatch(/teacher|admin/i);
  });

  test("teacher token receives 200 and ok: true when ENABLE_DEV_TOOLS=1", async () => {
    if (process.env.ENABLE_DEV_TOOLS !== "1" || !teacherToken) return;
    const res = await request(app)
      .post("/api/dev/seed/aqa-gcse-biology/cell-biology-batch-a")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.scope).toBe("cell-biology-batch-a");
    expect(Array.isArray(res.body.results)).toBe(true);
  });
});
