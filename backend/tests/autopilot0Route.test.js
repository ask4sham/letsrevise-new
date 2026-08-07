/**
 * Autopilot 0 route — admin-only GET /api/autopilot0/brief.
 */
const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const authRoutes = require("../routes/auth");
const autopilot0Routes = require("../routes/autopilot0");
const requireAdmin = require("../middleware/requireAdmin");
const User = require("../models/User");

jest.mock("../services/autopilot0/systemBriefService", () => ({
  buildSystemBrief: jest.fn().mockResolvedValue({
    version: "autopilot0-system-brief-v1",
    level: "L0",
    generatedAt: new Date().toISOString(),
    release: { commit: "test-commit", status: "GREEN", confidence: "HIGH", evidence: [] },
    summary: { overallStatus: "GREEN", humanReviewRequired: false },
    domains: {
      platformHealth: { status: "GREEN", evidence: [], action: "NONE", confidence: "HIGH" },
      contentHealth: { status: "GREEN", evidence: [], action: "NONE", confidence: "HIGH" },
      curriculumCoverage: { status: "GREEN", evidence: [], action: "NONE", confidence: "HIGH" },
      assessmentHealth: { status: "UNKNOWN", evidence: [], action: "INVESTIGATE", confidence: "MEDIUM" },
      learningSignals: { status: "GREEN", evidence: [], action: "NONE", confidence: "MEDIUM" },
      security: { status: "GREEN", evidence: [], action: "NONE", confidence: "HIGH" },
      dependencies: { status: "UNKNOWN", evidence: [], action: "INVESTIGATE", confidence: "HIGH" },
      productExperience: { status: "UNKNOWN", evidence: [], action: "INVESTIGATE", confidence: "HIGH" },
    },
  }),
}));

const { buildSystemBrief } = require("../services/autopilot0/systemBriefService");

const hashedPassword = bcrypt.hashSync("password123", 10);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/autopilot0", autopilot0Routes);
  return app;
}

async function loginAs(app, { email, userType }) {
  await User.create({
    firstName: "Autopilot",
    lastName: userType,
    email,
    password: hashedPassword,
    userType,
  });
  const login = await request(app).post("/api/auth/login").send({ email, password: "password123" });
  const token = login.body?.token;
  if (!token) throw new Error(`Login failed: ${JSON.stringify(login.body)}`);
  return token;
}

describe("GET /api/autopilot0/brief", () => {
  const app = buildApp();
  let adminToken;
  let teacherToken;

  beforeAll(async () => {
    const ts = Date.now();
    adminToken = await loginAs(app, { email: `ap0-admin-${ts}@test.com`, userType: "admin" });
    teacherToken = await loginAs(app, { email: `ap0-teacher-${ts}@test.com`, userType: "teacher" });
  });

  test("returns 200 for admin with expected version and level", async () => {
    const res = await request(app)
      .get("/api/autopilot0/brief")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.version).toBe("autopilot0-system-brief-v1");
    expect(res.body.level).toBe("L0");
    expect(buildSystemBrief).toHaveBeenCalled();
  });

  test("rejects unauthenticated access", async () => {
    const res = await request(app).get("/api/autopilot0/brief");
    expect(res.status).toBe(401);
  });

  test("rejects non-admin access", async () => {
    const res = await request(app)
      .get("/api/autopilot0/brief")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(403);
  });

  test("supports GET only", async () => {
    const post = await request(app)
      .post("/api/autopilot0/brief")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(post.status).toBe(404);

    const put = await request(app)
      .put("/api/autopilot0/brief")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(put.status).toBe(404);

    const del = await request(app)
      .delete("/api/autopilot0/brief")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(del.status).toBe(404);
  });

  test("route module wires requireAdmin on brief path", () => {
    const routeSrc = require("fs").readFileSync(
      require("path").join(__dirname, "..", "routes", "autopilot0.js"),
      "utf8"
    );
    expect(routeSrc).toMatch(/requireAdmin/);
    expect(routeSrc).toMatch(/router\.get\(\s*["']\/brief["']/);
    expect(routeSrc).not.toMatch(/router\.post/);
  });
});

describe("autopilot0 route auth guard", () => {
  test("requireAdmin rejects non-admin user on mock request", () => {
    const req = { user: { userType: "teacher" } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
