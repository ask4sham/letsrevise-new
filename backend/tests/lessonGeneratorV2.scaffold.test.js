/**
 * Lesson Generator V2 scaffold tests.
 * Confirms V1 untouched, flag gating, staged schema, and no-save contract.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const {
  isLessonGeneratorV2PipelineEnabled,
  createEmptyStagedOutput,
  validateStagedOutput,
  runLessonGeneratorV2Scaffold,
  STAGE_STATUS,
} = require("../services/lessonGeneratorV2");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Lesson Generator V2 scaffold", () => {
  let teacherToken;
  const prevFlag = process.env.LESSON_GENERATOR_V2_ENABLED;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "V2",
      lastName: "Scaffold",
      email: "lesson-gen-v2-scaffold@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "lesson-gen-v2-scaffold@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = prevFlag;
    await User.deleteMany({ email: "lesson-gen-v2-scaffold@test.com" });
  });

  test("V1 generate-and-save route still exists on the AI router", () => {
    const aiRouter = require("../routes/ai");
    const stack = aiRouter.stack || [];
    const hasV1 = stack.some(
      (layer) =>
        layer.route &&
        layer.route.path === "/generate-and-save" &&
        layer.route.methods &&
        layer.route.methods.post
    );
    expect(hasV1).toBe(true);
  });

  test("feature flag defaults off", () => {
    delete process.env.LESSON_GENERATOR_V2_ENABLED;
    expect(isLessonGeneratorV2PipelineEnabled()).toBe(false);
  });

  test("V2 route returns 503 when flag is off", async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = "0";
    const res = await request(app)
      .post("/api/ai/generate-and-save-v2")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topic: "Cell structure", subject: "Biology", level: "GCSE" });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("LESSON_GENERATOR_V2_DISABLED");
  });

  test("V2 route is available when flag is on and does not save", async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = "1";
    const res = await request(app)
      .post("/api/ai/generate-and-save-v2")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topic: "Cell structure",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        topicKey: "aqa-gcse-biology:cell-structure",
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.scaffold).toBe(true);
    expect(res.body.saved).toBe(false);
    expect(res.body.phase1Complete).toBe(true);
    expect(res.body.staged).toBeDefined();
    expect(res.body.staged.finalLesson).toBeNull();
    expect(res.body.staged.criticReport.ok).toBe(false);
    expect(res.body.stageStatuses.phase1).toBe(STAGE_STATUS.COMPLETE);
    expect(res.body.stageStatuses.phase2).toBe(STAGE_STATUS.STUB);
    expect(res.body.stageStatuses.phase3).toBe(STAGE_STATUS.STUB);
  });

  test("V2 route rejects missing topic/subject/level when enabled", async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = "1";
    const res = await request(app)
      .post("/api/ai/generate-and-save-v2")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topic: "Cell structure" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("LESSON_V2_BAD_REQUEST");
  });

  test("staged schema validates empty envelope", () => {
    const staged = createEmptyStagedOutput({
      topic: "Cell structure",
      subject: "Biology",
      level: "GCSE",
    });
    const r = validateStagedOutput(staged);
    expect(r.ok).toBe(true);
  });

  test("staged schema rejects saved=true without critic ok", () => {
    const staged = createEmptyStagedOutput({ topic: "X", subject: "Biology", level: "GCSE" });
    staged.saved = true;
    staged.finalLesson = { title: "X" };
    staged.criticReport.ok = false;
    const r = validateStagedOutput(staged);
    expect(r.ok).toBe(false);
    expect(r.issues).toContain("saved_true_without_critic_ok");
  });

  test("orchestrator scaffold never saves", async () => {
    const result = await runLessonGeneratorV2Scaffold({
      topic: "Homeostasis",
      subject: "Biology",
      level: "GCSE",
    });
    expect(result.saved).toBe(false);
    expect(result.staged.saved).toBe(false);
    expect(result.staged.finalLesson).toBeNull();
    expect(result.staged.criticReport.ok).toBe(false);
  });
});
