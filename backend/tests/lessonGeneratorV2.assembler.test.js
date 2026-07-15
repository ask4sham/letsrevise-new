/**
 * Lesson Generator V2 — PR A Critic + Assembler (no DB save).
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const {
  runLessonGeneratorV2Scaffold,
  assembleFinalLesson,
  validateFinalLesson,
  buildPhase1Lesson,
  buildPhase2VisualActivities,
  buildPhase3Questions,
  STAGE_STATUS,
} = require("../services/lessonGeneratorV2");
const { collectActivityQuestions } = require("../services/lessonGeneratorV2/validateFinalLesson");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Lesson Generator V2 Critic + Assembler (PR A)", () => {
  let teacherToken;
  let teacherId;
  const prevFlag = process.env.LESSON_GENERATOR_V2_ENABLED;
  const markerEmail = "lesson-gen-v2-assembler@test.com";

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "V2",
      lastName: "Assembler",
      email: markerEmail,
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = String(teacher._id);
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: markerEmail, password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = prevFlag;
    await Lesson.deleteMany({ "metadata.generator": "v2", teacherId });
    await User.deleteMany({ email: markerEmail });
  });

  test("flag off → 503", async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = "0";
    const res = await request(app)
      .post("/api/ai/generate-and-save-v2")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topic: "Cell structure", subject: "Biology", level: "GCSE" });
    expect(res.status).toBe(503);
  });

  async function assertAssembled(topic) {
    const beforeCount = await Lesson.countDocuments({ "metadata.generator": "v2" });
    const result = await runLessonGeneratorV2Scaffold({
      topic,
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      teacherId,
      teacherName: "V2 Assembler",
    });
    expect(result.phase1Complete).toBe(true);
    expect(result.phase2Complete).toBe(true);
    expect(result.phase3Complete).toBe(true);
    expect(result.saved).toBe(false);
    expect(result.criticOk).toBe(true);
    expect(result.persistenceReady).toBe(false);

    const fl = result.finalLesson;
    expect(fl).toBeTruthy();
    expect(fl.status).toBe("draft");
    expect(fl.isPublished).toBe(false);
    expect(fl.metadata.generator).toBe("v2");
    expect(fl.title).toBeTruthy();
    expect(fl.description).toBeTruthy();
    expect(fl.content).toBeTruthy();
    expect(fl.subject).toBe("Biology");
    expect(fl.level).toBe("GCSE");
    expect(fl.topic).toMatch(new RegExp(topic.split(/\s+/)[0], "i"));
    expect(Array.isArray(fl.pages)).toBe(true);
    expect(fl.pages[0].pageId).toBeTruthy();

    const { selfCheck, checkpoint, quiz } = collectActivityQuestions(fl);
    expect(selfCheck).toHaveLength(3);
    expect(checkpoint).toHaveLength(3);
    expect(quiz).toHaveLength(5);

    // Phase 3 is the only question source — stems must match phase3 banks.
    const p3 = result.staged.phase3Questions;
    expect(selfCheck.map((q) => q.prompt || q.question)).toEqual(p3.selfCheck.map((q) => q.prompt));
    expect(checkpoint.map((q) => q.prompt || q.question)).toEqual(p3.checkpoint.map((q) => q.prompt));
    expect(quiz.map((q) => q.question)).toEqual(p3.quiz.map((q) => q.prompt));

    expect(result.staged.criticReport.ok).toBe(true);
    expect(result.staged.criticReport.assemblyOk).toBe(true);
    expect(result.staged.criticReport.finalValidationOk).toBe(true);
    expect(result.staged.criticReport.persistenceReady).toBe(false);

    const afterCount = await Lesson.countDocuments({ "metadata.generator": "v2" });
    expect(afterCount).toBe(beforeCount);
    return result;
  }

  test("Cell Structure: assembler + critic ok, no DB write", async () => {
    await assertAssembled("Cell structure");
  });

  test("Gametes & Fertilisation: Lesson-shaped draft", async () => {
    await assertAssembled("Gametes & Fertilisation");
  });

  test("Sexual & Asexual Reproduction: counts exact", async () => {
    await assertAssembled("Sexual & Asexual Reproduction");
  });

  test("banned stems fail final validation", () => {
    const phase1 = buildPhase1Lesson({
      topic: "Cell structure",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
    });
    const phase2 = buildPhase2VisualActivities(
      { topic: "Cell structure", subject: "Biology", level: "GCSE" },
      phase1
    );
    const phase3 = buildPhase3Questions(
      { topic: "Cell structure", subject: "Biology", level: "GCSE", board: "AQA" },
      phase1,
      phase2
    );
    const staged = {
      meta: { topic: "Cell structure" },
      phase1Lesson: phase1,
      phase2VisualActivities: phase2,
      phase3Questions: phase3,
    };
    const { finalLesson } = assembleFinalLesson(staged, { teacherId });
    finalLesson.pages[0].blocks.find((b) => b.type === "selfCheck").questions[0].prompt =
      "Which statement best explains a key idea about Cell structure?";
    finalLesson.pages[0].blocks.find((b) => b.type === "selfCheck").questions[0].question =
      "Which statement best explains a key idea about Cell structure?";
    const check = validateFinalLesson(finalLesson, { phase2, topic: "Cell structure" });
    expect(check.ok).toBe(false);
    expect(check.issues.some((i) => i.includes("banned") || i.includes("option"))).toBe(true);
  });

  test("retrieval answer leak fails final validation", () => {
    const phase1 = buildPhase1Lesson({
      topic: "Cell structure",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
    });
    const phase2 = buildPhase2VisualActivities(
      { topic: "Cell structure", subject: "Biology", level: "GCSE" },
      phase1
    );
    phase2.retrievalActivities[0].studentFacingImagePrompt =
      "Diagram with TARGET CELL labelled CORRECT ANSWER and a green tick.";
    const phase3 = buildPhase3Questions(
      { topic: "Cell structure", subject: "Biology", level: "GCSE", board: "AQA" },
      phase1,
      phase2
    );
    const staged = {
      meta: { topic: "Cell structure" },
      phase1Lesson: phase1,
      phase2VisualActivities: phase2,
      phase3Questions: phase3,
    };
    const { finalLesson } = assembleFinalLesson(staged, { teacherId });
    const check = validateFinalLesson(finalLesson, { phase2, topic: "Cell structure" });
    expect(check.ok).toBe(false);
    expect(check.issues.some((i) => i.includes("reveal") || i.includes("image"))).toBe(true);
  });

  test("HTTP returns critic ok + finalLesson + saved false and writes no Lesson", async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = "1";
    const before = await Lesson.countDocuments({});
    const res = await request(app)
      .post("/api/ai/generate-and-save-v2")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topic: "Cell structure",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
      });
    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(false);
    expect(res.body.criticOk).toBe(true);
    expect(res.body.finalLesson).toBeTruthy();
    expect(res.body.finalLesson.status).toBe("draft");
    expect(res.body.finalLesson.isPublished).toBe(false);
    expect(res.body.staged.criticReport.ok).toBe(true);
    expect(res.body.staged.criticReport.persistenceReady).toBe(false);
    const after = await Lesson.countDocuments({});
    expect(after).toBe(before);
  });

  test("V1 generate-and-save still present", () => {
    const aiRouter = require("../routes/ai");
    const hasV1 = (aiRouter.stack || []).some(
      (layer) => layer.route && layer.route.path === "/generate-and-save" && layer.route.methods?.post
    );
    expect(hasV1).toBe(true);
  });
});
