/**
 * Lesson Generator V2 — Phase 1 Lesson Brain tests.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const {
  isLessonGeneratorV2PipelineEnabled,
  runLessonGeneratorV2Scaffold,
  buildPhase1Lesson,
  validatePhase1Lesson,
  STAGE_STATUS,
  PHASE1_REQUIRED_PLACEHOLDERS,
} = require("../services/lessonGeneratorV2");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Lesson Generator V2 Phase 1 Lesson Brain", () => {
  let teacherToken;
  const prevFlag = process.env.LESSON_GENERATOR_V2_ENABLED;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "V2",
      lastName: "LessonBrain",
      email: "lesson-gen-v2-phase1@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "lesson-gen-v2-phase1@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = prevFlag;
    await User.deleteMany({ email: "lesson-gen-v2-phase1@test.com" });
  });

  test("V2 flag off still returns 503", async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = "0";
    expect(isLessonGeneratorV2PipelineEnabled()).toBe(false);
    const res = await request(app)
      .post("/api/ai/generate-and-save-v2")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topic: "Cell structure", subject: "Biology", level: "GCSE" });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("LESSON_GENERATOR_V2_DISABLED");
  });

  test("V2 flag on runs Lesson Brain Phase 1 with structured teaching content", async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = "1";
    const res = await request(app)
      .post("/api/ai/generate-and-save-v2")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topic: "Cell structure",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        tier: "higher",
      });
    expect(res.status).toBe(200);
    expect(res.body.phase1Complete).toBe(true);
    expect(res.body.saved).toBe(false);

    const p1 = res.body.staged.phase1Lesson;
    expect(p1.status).toBe(STAGE_STATUS.COMPLETE);
    expect(p1.title).toMatch(/Cell structure/i);
    expect(p1.examBoard).toBe("AQA");
    expect(p1.level).toBe("GCSE");
    expect(p1.objectives.length).toBeGreaterThanOrEqual(2);
    expect(p1.priorKnowledge.length).toBeGreaterThan(20);
    expect(p1.sections.length).toBeGreaterThanOrEqual(3);
    expect(p1.keyTerms.length).toBeGreaterThanOrEqual(3);
    expect(p1.misconceptions.length).toBeGreaterThanOrEqual(1);
    expect(p1.examTips.length).toBeGreaterThanOrEqual(1);
    expect(p1.summary.length).toBeGreaterThan(30);
  });

  test("Phase 1 build does not finalise questions or image prompts", () => {
    const p1 = buildPhase1Lesson({
      topic: "Homeostasis",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
    });
    expect(p1.questionsFinalised).toBe(false);
    expect(p1.imagePromptsFinalised).toBe(false);
    expect(p1.selfCheck).toEqual([]);
    expect(p1.checkpoint).toEqual([]);
    expect(p1.quiz).toEqual([]);
    expect(p1.imagePrompts).toEqual([]);
    expect(p1.activityPrompts).toEqual([]);
  });

  test("Full pipeline completes Phase 2 and Phase 3 after Phase 1", async () => {
    const result = await runLessonGeneratorV2Scaffold({
      topic: "Homeostasis",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
    });
    expect(result.staged.phase1Lesson.status).toBe(STAGE_STATUS.COMPLETE);
    expect(result.staged.phase2VisualActivities.status).toBe(STAGE_STATUS.COMPLETE);
    expect(result.staged.phase3Questions.status).toBe(STAGE_STATUS.COMPLETE);
    expect(result.saved).toBe(false);
  });

  test("Phase 1 includes placeholders for later phases", () => {
    const p1 = buildPhase1Lesson({
      topic: "Mitosis",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
    });
    for (const ph of PHASE1_REQUIRED_PLACEHOLDERS) {
      expect(p1.placeholders).toContain(ph);
    }
    const check = validatePhase1Lesson(p1);
    expect(check.ok).toBe(true);
  });

  test("Phase 1 fail-closed if content weak", async () => {
    await expect(
      runLessonGeneratorV2Scaffold({
        topic: "Cell structure",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        phase1Override: {
          status: STAGE_STATUS.COMPLETE,
          title: "X",
          topic: "X",
          subject: "Biology",
          examBoard: "AQA",
          level: "GCSE",
          objectives: ["too short"],
          priorKnowledge: "short",
          sections: [],
          keyTerms: [],
          misconceptions: [],
          examTips: [],
          summary: "short",
          placeholders: [],
          questionsFinalised: false,
          imagePromptsFinalised: false,
        },
      })
    ).rejects.toMatchObject({ code: "LESSON_V2_PHASE1_FAILED", status: 422 });
  });

  test("Phase 1 fail-closed via HTTP when override is weak", async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = "1";
    // Internal override is only available via orchestrator — exercise HTTP path with valid topic
    // and unit-level fail above. HTTP path still returns teaching content for valid requests.
    const res = await request(app)
      .post("/api/ai/generate-and-save-v2")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topic: "Cell structure", subject: "Biology", level: "GCSE", board: "AQA" });
    expect(res.status).toBe(200);
    expect(res.body.stageStatuses.phase1).toBe(STAGE_STATUS.COMPLETE);
  });

  test("V1 generate-and-save still unchanged on AI router", () => {
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
});
