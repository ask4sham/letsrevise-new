/**
 * @jest-environment node
 */
const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const authRoutes = require("../routes/auth");
const autopilotSafetyRoutes = require("../routes/autopilotSafety");
const User = require("../models/User");
const { PreparationRecordListError } = require("../services/autopilotPreparation/listPreparationRecords");

jest.mock("../services/autopilotPreparation/listPreparationRecords", () => ({
  listPreparationRecords: jest.fn(),
  PreparationRecordListError: jest.requireActual(
    "../services/autopilotPreparation/listPreparationRecords"
  ).PreparationRecordListError,
}));

const { listPreparationRecords } = require("../services/autopilotPreparation/listPreparationRecords");

const hashedPassword = bcrypt.hashSync("password123", 10);
const envBackup = { ...process.env };

const ACTOR_ID = new mongoose.Types.ObjectId();
const RECORD_ID = new mongoose.Types.ObjectId();

function validStoredRecord() {
  return {
    _id: RECORD_ID,
    actionId: "approved-b2",
    preparationRecordSemanticIdentityHash: "d".repeat(64),
    recordCandidate: {
      policyVersion: "autopilot-preparation-record-candidate-v1",
      actionId: "approved-b2",
    },
    actorId: ACTOR_ID,
    actorRole: "admin",
    createdAt: new Date("2026-08-16T10:00:00.000Z"),
  };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/autopilot-safety", autopilotSafetyRoutes);
  return app;
}

async function loginAs(app, { email, userType }) {
  await User.create({
    firstName: "Preparation",
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

function extractPreparationRecordListRouteHandlerSource() {
  const routeSrc = fs.readFileSync(
    path.join(__dirname, "..", "routes", "autopilotSafety.js"),
    "utf8"
  );
  const match = routeSrc.match(/router\.get\("\/preparation-records",[\s\S]*?\n\}\);/);
  expect(match).not.toBeNull();
  return match[0];
}

describe("autopilot preparation record list route P1.5", () => {
  const app = buildApp();
  let adminToken;
  let teacherToken;

  beforeAll(async () => {
    const ts = Date.now();
    adminToken = await loginAs(app, { email: `p15-admin-${ts}@test.com`, userType: "admin" });
    teacherToken = await loginAs(app, { email: `p15-teacher-${ts}@test.com`, userType: "teacher" });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envBackup };
    delete process.env.AUTOPILOT_LEARNING_PREPARATION_RECORD_RETRIEVAL_ENABLED;
    listPreparationRecords.mockResolvedValue({
      records: [],
      pagination: { limit: 20, offset: 0, total: 0 },
    });
  });

  afterAll(() => {
    process.env = { ...envBackup };
  });

  test("unauthenticated request rejected with 401", async () => {
    const res = await request(app).get("/api/autopilot-safety/preparation-records");
    expect(res.status).toBe(401);
    expect(listPreparationRecords).not.toHaveBeenCalled();
  });

  test("authenticated non-admin rejected with 403", async () => {
    const res = await request(app)
      .get("/api/autopilot-safety/preparation-records")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(403);
    expect(listPreparationRecords).not.toHaveBeenCalled();
  });

  test("authenticated admin with gate disabled maps PREPARATION_RECORD_RETRIEVAL_DISABLED to 503", async () => {
    listPreparationRecords.mockRejectedValue(
      new PreparationRecordListError(
        "PREPARATION_RECORD_RETRIEVAL_DISABLED",
        "Autopilot preparation record retrieval is disabled"
      )
    );

    const res = await request(app)
      .get("/api/autopilot-safety/preparation-records")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("PREPARATION_RECORD_RETRIEVAL_DISABLED");
    expect(listPreparationRecords).toHaveBeenCalledWith({});
  });

  test("invalid pagination maps INVALID_LIST_REQUEST to 400", async () => {
    listPreparationRecords.mockRejectedValue(
      new PreparationRecordListError("INVALID_LIST_REQUEST", "limit must be a positive integer", {
        limit: "abc",
      })
    );

    const res = await request(app)
      .get("/api/autopilot-safety/preparation-records?limit=abc")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_LIST_REQUEST");
  });

  test("authenticated admin happy path returns records, pagination, and meta", async () => {
    listPreparationRecords.mockResolvedValue({
      records: [validStoredRecord()],
      pagination: { limit: 20, offset: 0, total: 1 },
    });

    const res = await request(app)
      .get("/api/autopilot-safety/preparation-records")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(listPreparationRecords).toHaveBeenCalledWith({});
    expect(res.body.records).toHaveLength(1);
    expect(res.body.records[0].actionId).toBe("approved-b2");
    expect(res.body.records[0]._id).toBe(RECORD_ID.toHexString());
    expect(typeof res.body.records[0].actorId).toBe("string");
    expect(res.body.records[0].actorId).toBe(ACTOR_ID.toHexString());
    expect(res.body.records[0].createdAt).toBe("2026-08-16T10:00:00.000Z");
    expect(res.body.pagination).toEqual({ limit: 20, offset: 0, total: 1 });
    expect(res.body.meta.executionAuthorized).toBe(false);
    expect(res.body.meta.executionEnabled).toBe(false);
  });

  test("forwards limit and offset query params to service", async () => {
    listPreparationRecords.mockResolvedValue({
      records: [],
      pagination: { limit: 10, offset: 5, total: 0 },
    });

    const res = await request(app)
      .get("/api/autopilot-safety/preparation-records?limit=10&offset=5")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(listPreparationRecords).toHaveBeenCalledWith({ limit: "10", offset: "5" });
  });

  test("empty result returns zero records", async () => {
    listPreparationRecords.mockResolvedValue({
      records: [],
      pagination: { limit: 20, offset: 0, total: 0 },
    });

    const res = await request(app)
      .get("/api/autopilot-safety/preparation-records")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.records).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  test("preparation-record list route handler stays read-only and service-scoped", () => {
    const handlerSrc = extractPreparationRecordListRouteHandlerSource();

    expect(handlerSrc).toMatch(/router\.get\("\/preparation-records"/);
    expect(handlerSrc).toMatch(/listPreparationRecords\(req\.query/);
    expect(handlerSrc).not.toMatch(/persistPreparationRecord/);
    expect(handlerSrc).not.toMatch(/getPreparationRecord/);
    expect(handlerSrc).not.toMatch(/proposalService/);
    expect(handlerSrc).not.toMatch(/AutopilotActionProposal/);
    expect(handlerSrc).not.toMatch(/AutopilotPreparationRecordEvent/);
    expect(handlerSrc).not.toMatch(/router\.post/);
    expect(handlerSrc).not.toMatch(/router\.put/);
    expect(handlerSrc).not.toMatch(/router\.delete/);
  });
});
