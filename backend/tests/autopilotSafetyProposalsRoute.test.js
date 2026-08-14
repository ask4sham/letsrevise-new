/**
 * @jest-environment node
 */
const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const authRoutes = require("../routes/auth");
const autopilotSafetyRoutes = require("../routes/autopilotSafety");
const User = require("../models/User");

jest.mock("../services/autopilotSafety/proposalService", () => ({
  createProposal: jest.fn(),
  listProposals: jest.fn(),
  getProposal: jest.fn(),
  approveProposal: jest.fn(),
  rejectProposal: jest.fn(),
  expireProposal: jest.fn(),
  serializeProposal: jest.fn((proposal) => ({ ...proposal, meta: { executionAuthorized: false } })),
  AutopilotSafetyError: require("../services/autopilotSafety/proposalValidation").AutopilotSafetyError,
}));

const proposalService = require("../services/autopilotSafety/proposalService");
const { AutopilotSafetyError } = require("../services/autopilotSafety/proposalValidation");

const hashedPassword = bcrypt.hashSync("password123", 10);
const envBackup = { ...process.env };

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/autopilot-safety", autopilotSafetyRoutes);
  return app;
}

async function loginAs(app, { email, userType }) {
  await User.create({
    firstName: "Safety",
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

const validCreateBody = {
  specKey: "aqa-gcse-biology",
  topicKey: "aqa-gcse-biology:cell-structure",
  observationNote: "Observation only",
};

describe("autopilotSafety proposal routes", () => {
  const app = buildApp();
  let adminToken;
  let teacherToken;

  beforeAll(async () => {
    const ts = Date.now();
    adminToken = await loginAs(app, { email: `s1-admin-${ts}@test.com`, userType: "admin" });
    teacherToken = await loginAs(app, { email: `s1-teacher-${ts}@test.com`, userType: "teacher" });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...envBackup };
    delete process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED;
    delete process.env.AUTOPILOT_LEARNING_APPROVALS_ENABLED;
    proposalService.listProposals.mockResolvedValue({
      proposals: [],
      pagination: { limit: 20, offset: 0, total: 0 },
    });
    proposalService.getProposal.mockResolvedValue({
      proposal: { actionId: "a1", status: "PROPOSED" },
    });
  });

  afterAll(() => {
    process.env = { ...envBackup };
  });

  test("route file mounted under /api/autopilot-safety", () => {
    const routeSrc = fs.readFileSync(path.join(__dirname, "..", "routes", "autopilotSafety.js"), "utf8");
    expect(routeSrc).toContain("/proposals");
    expect(routeSrc).not.toMatch(/\/execute|\/prepare/);
  });

  test("anonymous rejected", async () => {
    const res = await request(app).get("/api/autopilot-safety/proposals");
    expect(res.status).toBe(401);
  });

  test("non-admin rejected", async () => {
    const res = await request(app)
      .get("/api/autopilot-safety/proposals")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(403);
  });

  test("GET works with mutation gates OFF", async () => {
    const res = await request(app)
      .get("/api/autopilot-safety/proposals")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(proposalService.listProposals).toHaveBeenCalled();
  });

  test("POST create disabled by default", async () => {
    proposalService.createProposal.mockRejectedValue(
      new AutopilotSafetyError("AUTOPILOT_PROPOSALS_DISABLED", "disabled", 403)
    );
    const res = await request(app)
      .post("/api/autopilot-safety/proposals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validCreateBody);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("AUTOPILOT_PROPOSALS_DISABLED");
  });

  test("valid minimal create when proposal gate enabled", async () => {
    process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED = "true";
    proposalService.createProposal.mockResolvedValue({
      proposal: { actionId: "a1", status: "PROPOSED" },
      idempotentReplay: false,
    });
    const res = await request(app)
      .post("/api/autopilot-safety/proposals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validCreateBody);
    expect(res.status).toBe(201);
    expect(proposalService.createProposal).toHaveBeenCalledWith(
      validCreateBody,
      expect.anything()
    );
  });

  test("deprecated authority field rejected", async () => {
    const res = await request(app)
      .post("/api/autopilot-safety/proposals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...validCreateBody, advisoryAction: "CONSIDER_FLASHCARD_REVISION" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_PROPOSAL");
  });

  test("client safety-field override rejected", async () => {
    const res = await request(app)
      .post("/api/autopilot-safety/proposals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...validCreateBody, actionId: "client-id" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_PROPOSAL");
  });

  test("supplied targetSnapshotHash rejected", async () => {
    const res = await request(app)
      .post("/api/autopilot-safety/proposals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...validCreateBody, targetSnapshotHash: "client-hash" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_PROPOSAL");
  });

  test("student field rejected", async () => {
    const res = await request(app)
      .post("/api/autopilot-safety/proposals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...validCreateBody, studentId: "abc" });
    expect(res.status).toBe(400);
  });

  test("approve returns executionAuthorized false", async () => {
    proposalService.approveProposal.mockResolvedValue({
      actionId: "a1",
      status: "APPROVED",
    });
    const res = await request(app)
      .post("/api/autopilot-safety/proposals/a1/approve")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.executionAuthorized).toBe(false);
    expect(res.body.meta.executionEnabled).toBe(false);
  });

  test("approve after deadline maps PROPOSAL_EXPIRED", async () => {
    proposalService.approveProposal.mockRejectedValue(
      new AutopilotSafetyError("PROPOSAL_EXPIRED", "expired", 409)
    );
    const res = await request(app)
      .post("/api/autopilot-safety/proposals/a1/approve")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("PROPOSAL_EXPIRED");
  });

  test("reject and expire routes exist", async () => {
    proposalService.rejectProposal.mockResolvedValue({ actionId: "a1", status: "REJECTED" });
    proposalService.expireProposal.mockResolvedValue({ actionId: "a1", status: "EXPIRED" });

    const rejectRes = await request(app)
      .post("/api/autopilot-safety/proposals/a1/reject")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ rejectionReason: "Not now" });
    expect(rejectRes.status).toBe(200);

    const expireRes = await request(app)
      .post("/api/autopilot-safety/proposals/a1/expire")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(expireRes.status).toBe(200);
  });

  test("terminal transition maps 409", async () => {
    proposalService.expireProposal.mockRejectedValue(
      new AutopilotSafetyError("INVALID_STATE_TRANSITION", "terminal", 409)
    );
    const res = await request(app)
      .post("/api/autopilot-safety/proposals/a1/expire")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INVALID_STATE_TRANSITION");
  });

  test("read one supports optional events", async () => {
    proposalService.getProposal.mockResolvedValue({
      proposal: { actionId: "a1" },
      events: [{ eventType: "PROPOSED" }],
    });
    const res = await request(app)
      .get("/api/autopilot-safety/proposals/a1")
      .query({ includeEvents: "1", eventLimit: 10 })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(proposalService.getProposal).toHaveBeenCalledWith(
      "a1",
      expect.objectContaining({ includeEvents: true, eventLimit: "10" })
    );
  });

  test("malformed yes/on env values remain disabled at route boundary", async () => {
    process.env.AUTOPILOT_LEARNING_PROPOSALS_ENABLED = "yes";
    proposalService.createProposal.mockRejectedValue(
      new AutopilotSafetyError("AUTOPILOT_PROPOSALS_DISABLED", "disabled", 403)
    );
    const res = await request(app)
      .post("/api/autopilot-safety/proposals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(validCreateBody);
    expect(res.status).toBe(403);
  });
});
