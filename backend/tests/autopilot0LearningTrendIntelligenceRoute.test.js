/**
 * Autopilot 0 Learning Trend Intelligence route — admin-only GET /api/autopilot0/learning-trend-intelligence.
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
    summary: { overallStatus: "UNKNOWN", humanReviewRequired: true },
  }),
}));

jest.mock("../services/autopilot0/questionIntelligenceService", () => ({
  buildQuestionIntelligence: jest.fn().mockResolvedValue({
    version: "autopilot0-question-intelligence-v1",
    level: "L0",
    summary: { overallStatus: "UNKNOWN", humanReviewRequired: true },
  }),
}));

jest.mock("../services/autopilot0/learningTrendIntelligenceService", () => ({
  buildLearningTrendIntelligence: jest.fn().mockResolvedValue({
    version: "autopilot0-learning-trend-intelligence-v1",
    level: "L0",
    generatedAt: new Date().toISOString(),
    cohort: {
      specKey: "aqa-gcse-biology",
      cohortScope: "SPEC_ONLY",
      tierSupported: false,
      tier: null,
    },
    windows: { lookbackDays: 90, windowDays: 45 },
    policy: {
      minPairedStudents: 10,
      minEarlierAttempts: 10,
      minRecentAttempts: 10,
      improvingThresholdPercentagePoints: 10,
      decliningThresholdPercentagePoints: -10,
    },
    topicTrends: [],
    summary: { overallStatus: "UNKNOWN", humanReviewRequired: true },
    eligibleTopicCount: 0,
    insufficientEvidenceTopicCount: 0,
  }),
}));

const { buildLearningTrendIntelligence } = require("../services/autopilot0/learningTrendIntelligenceService");

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

describe("GET /api/autopilot0/learning-trend-intelligence", () => {
  const app = buildApp();
  let adminToken;
  let teacherToken;

  beforeAll(async () => {
    const ts = Date.now();
    adminToken = await loginAs(app, { email: `ap0lt-admin-${ts}@test.com`, userType: "admin" });
    teacherToken = await loginAs(app, { email: `ap0lt-teacher-${ts}@test.com`, userType: "teacher" });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("admin 200 with expected version and level", async () => {
    const res = await request(app)
      .get("/api/autopilot0/learning-trend-intelligence")
      .query({ specKey: "aqa-gcse-biology" })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.version).toBe("autopilot0-learning-trend-intelligence-v1");
    expect(res.body.level).toBe("L0");
    expect(res.body.cohort.cohortScope).toBe("SPEC_ONLY");
    expect(res.body.windows).toBeDefined();
    expect(res.body.policy).toBeDefined();
    expect(res.body.topicTrends).toEqual([]);
    expect(buildLearningTrendIntelligence).toHaveBeenCalledWith({
      specKey: "aqa-gcse-biology",
      limit: 20,
    });
  });

  test("anonymous rejected", async () => {
    const res = await request(app)
      .get("/api/autopilot0/learning-trend-intelligence")
      .query({ specKey: "aqa-gcse-biology" });
    expect(res.status).toBe(401);
  });

  test("non-admin rejected", async () => {
    const res = await request(app)
      .get("/api/autopilot0/learning-trend-intelligence")
      .query({ specKey: "aqa-gcse-biology" })
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(403);
  });

  test("specKey required", async () => {
    const res = await request(app)
      .get("/api/autopilot0/learning-trend-intelligence")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/specKey/i);
  });

  test("invalid specKey rejected", async () => {
    buildLearningTrendIntelligence.mockRejectedValueOnce(
      Object.assign(new Error("Unknown specKey: bad-spec"), { code: "INVALID_SPEC_KEY" })
    );
    const res = await request(app)
      .get("/api/autopilot0/learning-trend-intelligence")
      .query({ specKey: "bad-spec" })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown specKey/i);
  });

  test("tier rejected", async () => {
    const res = await request(app)
      .get("/api/autopilot0/learning-trend-intelligence")
      .query({ specKey: "aqa-gcse-biology", tier: "higher" })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tier/i);
    expect(buildLearningTrendIntelligence).not.toHaveBeenCalled();
  });

  test("limit bounded to max 50", async () => {
    await request(app)
      .get("/api/autopilot0/learning-trend-intelligence")
      .query({ specKey: "aqa-gcse-biology", limit: 99 })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(buildLearningTrendIntelligence).toHaveBeenCalledWith({
      specKey: "aqa-gcse-biology",
      limit: 50,
    });
  });

  test("route file wires auth and requireAdmin", () => {
    const routeSource = fs.readFileSync(
      path.join(__dirname, "..", "routes", "autopilot0.js"),
      "utf8"
    );
    expect(routeSource).toMatch(/learning-trend-intelligence[\s\S]*auth,\s*requireAdmin/);
    expect(requireAdmin).toBeDefined();
  });
});
