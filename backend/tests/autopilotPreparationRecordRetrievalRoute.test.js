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
const {
  PreparationRecordRetrievalError,
} = require("../services/autopilotPreparation/getPreparationRecord");

jest.mock("../services/autopilotPreparation/getPreparationRecord", () => ({
  getPreparationRecord: jest.fn(),
  PreparationRecordRetrievalError: jest.requireActual(
    "../services/autopilotPreparation/getPreparationRecord"
  ).PreparationRecordRetrievalError,
}));

jest.mock("../services/autopilotPreparation/listPreparationRecords", () => ({
  listPreparationRecords: jest.fn(),
  PreparationRecordListError: jest.requireActual(
    "../services/autopilotPreparation/listPreparationRecords"
  ).PreparationRecordListError,
}));

const { getPreparationRecord } = require("../services/autopilotPreparation/getPreparationRecord");
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

function extractPreparationRecordRouteHandlerSource() {
  const routeSrc = fs.readFileSync(
    path.join(__dirname, "..", "routes", "autopilotSafety.js"),
    "utf8"
  );
  const match = routeSrc.match(
    /router\.get\("\/preparation-records\/:actionId"[\s\S]*?\n\}\);/
  );
  expect(match).not.toBeNull();
  return match[0];
}

describe("autopilot preparation record retrieval route P1.4", () => {
  const app = buildApp();
  let adminToken;
  let teacherToken;

  beforeAll(async () => {
    const ts = Date.now();
    adminToken = await loginAs(app, { email: `p14-admin-${ts}@test.com`, userType: "admin" });
    teacherToken = await loginAs(app, { email: `p14-teacher-${ts}@test.com`, userType: "teacher" });
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
    const res = await request(app).get("/api/autopilot-safety/preparation-records/approved-b2");
    expect(res.status).toBe(401);
    expect(getPreparationRecord).not.toHaveBeenCalled();
  });

  test("authenticated non-admin rejected with 403", async () => {
    const res = await request(app)
      .get("/api/autopilot-safety/preparation-records/approved-b2")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(403);
    expect(getPreparationRecord).not.toHaveBeenCalled();
  });

  test("authenticated admin with gate disabled maps PREPARATION_RECORD_RETRIEVAL_DISABLED to 503", async () => {
    getPreparationRecord.mockRejectedValue(
      new PreparationRecordRetrievalError(
        "PREPARATION_RECORD_RETRIEVAL_DISABLED",
        "Autopilot preparation record retrieval is disabled"
      )
    );

    const res = await request(app)
      .get("/api/autopilot-safety/preparation-records/approved-b2")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("PREPARATION_RECORD_RETRIEVAL_DISABLED");
    expect(getPreparationRecord).toHaveBeenCalledWith("approved-b2");
  });

  test("authenticated admin happy path returns transport-normalized record and meta", async () => {
    getPreparationRecord.mockResolvedValue(validStoredRecord());

    const res = await request(app)
      .get("/api/autopilot-safety/preparation-records/approved-b2")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(getPreparationRecord).toHaveBeenCalledWith("approved-b2");
    expect(res.body.record.actionId).toBe("approved-b2");
    expect(res.body.record._id).toBe(RECORD_ID.toHexString());
    expect(typeof res.body.record.actorId).toBe("string");
    expect(res.body.record.actorId).toBe(ACTOR_ID.toHexString());
    expect(res.body.record.createdAt).toBe("2026-08-16T10:00:00.000Z");
    expect(res.body.meta.executionAuthorized).toBe(false);
    expect(res.body.meta.executionEnabled).toBe(false);
  });

  test("unknown actionId maps PREPARATION_RECORD_NOT_FOUND to 404", async () => {
    getPreparationRecord.mockRejectedValue(
      new PreparationRecordRetrievalError(
        "PREPARATION_RECORD_NOT_FOUND",
        "Preparation record not found",
        { actionId: "missing" }
      )
    );

    const res = await request(app)
      .get("/api/autopilot-safety/preparation-records/missing")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PREPARATION_RECORD_NOT_FOUND");
  });

  test("whitespace-only path segment maps INVALID_RETRIEVAL_REQUEST to 400", async () => {
    getPreparationRecord.mockRejectedValue(
      new PreparationRecordRetrievalError(
        "INVALID_RETRIEVAL_REQUEST",
        "actionId is required for preparation record retrieval",
        { actionId: "   " }
      )
    );

    const res = await request(app)
      .get("/api/autopilot-safety/preparation-records/%20%20")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_RETRIEVAL_REQUEST");
    expect(getPreparationRecord).toHaveBeenCalledTimes(1);
    expect(String(getPreparationRecord.mock.calls[0][0]).trim()).toBe("");
  });

  test("collection path invokes list handler not single-record getPreparationRecord", async () => {
    const res = await request(app)
      .get("/api/autopilot-safety/preparation-records")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(listPreparationRecords).toHaveBeenCalledWith({});
    expect(getPreparationRecord).not.toHaveBeenCalled();
  });

  test("preparation-record route handler stays read-only and service-scoped", () => {
    const handlerSrc = extractPreparationRecordRouteHandlerSource();

    expect(handlerSrc).toMatch(/router\.get\("\/preparation-records\/:actionId"/);
    expect(handlerSrc).toMatch(/getPreparationRecord\(req\.params\.actionId\)/);
    expect(handlerSrc).not.toMatch(/persistPreparationRecord/);
    expect(handlerSrc).not.toMatch(/proposalService/);
    expect(handlerSrc).not.toMatch(/AutopilotActionProposal/);
    expect(handlerSrc).not.toMatch(/router\.post/);
    expect(handlerSrc).not.toMatch(/router\.put/);
    expect(handlerSrc).not.toMatch(/router\.delete/);
  });
});
