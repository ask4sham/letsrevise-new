/**
 * Autopilot 0 Revision Intelligence route — admin-only GET /api/autopilot0/revision-intelligence.
 */
const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const authRoutes = require("../routes/auth");
const autopilot0Routes = require("../routes/autopilot0");
const requireAdmin = require("../middleware/requireAdmin");
const User = require("../models/User");

jest.mock("../services/autopilot0/systemBriefService", () => ({
  buildSystemBrief: jest.fn().mockResolvedValue({
    version: "autopilot0-system-brief-v1",
    level: "L0",
    generatedAt: new Date().toISOString(),
    summary: { overallStatus: "GREEN", humanReviewRequired: false },
    domains: {},
  }),
}));

jest.mock("../services/autopilot0/revisionIntelligenceService", () => ({
  buildRevisionIntelligence: jest.fn().mockResolvedValue({
    version: "autopilot0-revision-intelligence-v1",
    level: "L0",
    generatedAt: new Date().toISOString(),
    cohort: {
      specKey: "aqa-gcse-biology",
      cohortScope: "SPEC_ONLY",
      tierSupported: false,
      tier: null,
      topicsObserved: 0,
      suppressedTopicCount: 0,
    },
    mastery: {
      source: "LearningEvidenceEvent",
      policy: "student-topic-evidence",
      weakThreshold: 70,
    },
    privacy: { minStudentsForTopic: 5, minAttemptsForTopic: 10 },
    topicWeakness: [],
    contentLearningCrossSignals: [],
    summary: { overallStatus: "UNKNOWN", humanReviewRequired: true },
  }),
}));

const { buildRevisionIntelligence } = require("../services/autopilot0/revisionIntelligenceService");

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

describe("GET /api/autopilot0/revision-intelligence", () => {
  const app = buildApp();
  let adminToken;
  let teacherToken;

  beforeAll(async () => {
    const ts = Date.now();
    adminToken = await loginAs(app, { email: `ap0ri-admin-${ts}@test.com`, userType: "admin" });
    teacherToken = await loginAs(app, { email: `ap0ri-teacher-${ts}@test.com`, userType: "teacher" });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("admin 200 with expected version and level", async () => {
    const res = await request(app)
      .get("/api/autopilot0/revision-intelligence")
      .query({ specKey: "aqa-gcse-biology" })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.version).toBe("autopilot0-revision-intelligence-v1");
    expect(res.body.level).toBe("L0");
    expect(buildRevisionIntelligence).toHaveBeenCalledWith({
      specKey: "aqa-gcse-biology",
      limit: 20,
    });
  });

  test("anonymous rejected", async () => {
    const res = await request(app)
      .get("/api/autopilot0/revision-intelligence")
      .query({ specKey: "aqa-gcse-biology" });
    expect(res.status).toBe(401);
  });

  test("non-admin rejected", async () => {
    const res = await request(app)
      .get("/api/autopilot0/revision-intelligence")
      .query({ specKey: "aqa-gcse-biology" })
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(403);
  });

  test("specKey required", async () => {
    const res = await request(app)
      .get("/api/autopilot0/revision-intelligence")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/specKey is required/i);
  });

  test("invalid specKey rejected", async () => {
    buildRevisionIntelligence.mockRejectedValueOnce(
      Object.assign(new Error("Unknown specKey: bad-spec"), { code: "INVALID_SPEC_KEY" })
    );
    const res = await request(app)
      .get("/api/autopilot0/revision-intelligence")
      .query({ specKey: "bad-spec" })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown specKey/i);
  });

  test("tier query rejected", async () => {
    const res = await request(app)
      .get("/api/autopilot0/revision-intelligence")
      .query({ specKey: "aqa-gcse-biology", tier: "higher" })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tier is not supported/i);
    expect(buildRevisionIntelligence).not.toHaveBeenCalled();
  });

  test("limit default 20", async () => {
    await request(app)
      .get("/api/autopilot0/revision-intelligence")
      .query({ specKey: "aqa-gcse-biology" })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(buildRevisionIntelligence).toHaveBeenCalledWith({
      specKey: "aqa-gcse-biology",
      limit: 20,
    });
  });

  test("limit max 50", async () => {
    await request(app)
      .get("/api/autopilot0/revision-intelligence")
      .query({ specKey: "aqa-gcse-biology", limit: 999 })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(buildRevisionIntelligence).toHaveBeenCalledWith({
      specKey: "aqa-gcse-biology",
      limit: 50,
    });
  });

  test("malformed limit values use bounded defaults", async () => {
    const cases = [
      { query: { limit: "abc" }, expected: 20 },
      { query: { limit: "0" }, expected: 1 },
      { query: { limit: "-1" }, expected: 1 },
      { query: { limit: "51" }, expected: 50 },
      { query: { limit: "20.5" }, expected: 20 },
    ];
    for (const { query, expected } of cases) {
      jest.clearAllMocks();
      await request(app)
        .get("/api/autopilot0/revision-intelligence")
        .query({ specKey: "aqa-gcse-biology", ...query })
        .set("Authorization", `Bearer ${adminToken}`);
      expect(buildRevisionIntelligence).toHaveBeenCalledWith({
        specKey: "aqa-gcse-biology",
        limit: expected,
      });
    }
  });

  test("response contains no student identifiers", async () => {
    const res = await request(app)
      .get("/api/autopilot0/revision-intelligence")
      .query({ specKey: "aqa-gcse-biology" })
      .set("Authorization", `Bearer ${adminToken}`);
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/userId/i);
    expect(body).not.toMatch(/studentId/i);
    expect(body).not.toMatch(/@/);
  });

  test("route wires requireAdmin and GET only", () => {
    const routeSrc = fs.readFileSync(
      path.join(__dirname, "..", "routes", "autopilot0.js"),
      "utf8"
    );
    expect(routeSrc).toMatch(/requireAdmin/);
    expect(routeSrc).toMatch(/router\.get\(\s*["']\/revision-intelligence["']/);
    expect(routeSrc).not.toMatch(/router\.post\(\s*["']\/revision-intelligence["']/);
  });
});

describe("autopilot0 revision-intelligence auth guard", () => {
  test("requireAdmin rejects non-admin user on mock request", () => {
    const req = { user: { userType: "teacher" } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
