/**
 * Lesson Generator V2 — Phase 2 Image / Activity Brain tests.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const {
  runLessonGeneratorV2Scaffold,
  buildPhase2VisualActivities,
  validatePhase2VisualActivities,
  studentImageRevealsAnswer,
  findRevealLeaks,
  STAGE_STATUS,
  buildPhase1Lesson,
} = require("../services/lessonGeneratorV2");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Lesson Generator V2 Phase 2 Image / Activity Brain", () => {
  let teacherToken;
  const prevFlag = process.env.LESSON_GENERATOR_V2_ENABLED;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "V2",
      lastName: "ImageBrain",
      email: "lesson-gen-v2-phase2@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "lesson-gen-v2-phase2@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = prevFlag;
    await User.deleteMany({ email: "lesson-gen-v2-phase2@test.com" });
  });

  test("V2 flag off still returns 503", async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = "0";
    const res = await request(app)
      .post("/api/ai/generate-and-save-v2")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topic: "Cell structure", subject: "Biology", level: "GCSE" });
    expect(res.status).toBe(503);
  });

  test("Phase 2 produces teaching diagrams and student-safe retrieval briefs", async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = "1";
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
    expect(res.body.phase2Complete).toBe(true);
    expect(res.body.saved).toBe(false);

    const p2 = res.body.staged.phase2VisualActivities;
    expect(p2.status).toBe(STAGE_STATUS.COMPLETE);
    expect(p2.studentSafe).toBe(true);
    expect(p2.questionsFinalised).toBe(false);
    expect(p2.teachingDiagrams.length).toBeGreaterThanOrEqual(1);
    expect(p2.retrievalActivities.length).toBeGreaterThanOrEqual(1);
    expect(p2.teachingDiagrams[0].labelsAllowed).toBe(true);
    expect(p2.retrievalActivities[0].labelsAllowedOnStudentImage).toBe(false);
    expect(p2.retrievalActivities[0].studentFacingImagePrompt.length).toBeGreaterThan(30);
    expect(p2.retrievalActivities[0].teacherFacingBrief.length).toBeGreaterThan(20);
  });

  test("teaching diagrams may label; retrieval images must not reveal answers", () => {
    const phase1 = buildPhase1Lesson({
      topic: "Cell structure",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
    });
    const p2 = buildPhase2VisualActivities(
      { topic: "Cell structure", subject: "Biology", level: "GCSE" },
      phase1
    );
    expect(p2.teachingDiagrams[0].prompt).toMatch(/label/i);
    for (const a of p2.retrievalActivities) {
      expect(findRevealLeaks(a.studentFacingImagePrompt)).toEqual([]);
      expect(studentImageRevealsAnswer(a.studentFacingImagePrompt, a.bannedRevealTerms)).toBe(false);
      expect(a.studentSafe).toBe(true);
    }
    expect(validatePhase2VisualActivities(p2, { phase1 }).ok).toBe(true);
  });

  test("Phase 2 does not finalise questions", async () => {
    const result = await runLessonGeneratorV2Scaffold({
      topic: "Homeostasis",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
    });
    expect(result.stageStatuses.phase2).toBe(STAGE_STATUS.COMPLETE);
    expect(result.stageStatuses.phase3).toBe(STAGE_STATUS.COMPLETE);
    expect(result.staged.phase2VisualActivities.questionsFinalised).toBe(false);
    expect(result.staged.phase3Questions.selfCheck).toHaveLength(3);
  });

  test("Phase 2 fail-closed when student image reveals the answer", async () => {
    await expect(
      runLessonGeneratorV2Scaffold({
        topic: "Cell structure",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        phase2Override: {
          status: STAGE_STATUS.COMPLETE,
          teachingDiagrams: [
            {
              id: "td1",
              purpose: "teaching",
              title: "Teaching cell",
              prompt: "Labelled teaching diagram of a cell with nucleus clearly named.",
              labelsAllowed: true,
              whatToNotice: ["Nucleus controls activities in the cell model"],
            },
          ],
          retrievalActivities: [
            {
              id: "bad",
              purpose: "retrieval",
              activityType: "labelDiagram",
              title: "Bad leaky image",
              labelsAllowedOnStudentImage: false,
              studentSafe: true,
              bannedRevealTerms: ["nucleus"],
              studentTask: "Which structure contains DNA?",
              studentFacingImagePrompt:
                "Cell diagram with the nucleus labelled TARGET CELL and marked CORRECT ANSWER with a green tick.",
              teacherFacingBrief: "Teacher answer is the nucleus.",
            },
          ],
          studentSafe: true,
          questionsFinalised: false,
        },
      })
    ).rejects.toMatchObject({ code: "LESSON_V2_PHASE2_FAILED", status: 422 });
  });

  test("safety helper detects reveal language", () => {
    expect(studentImageRevealsAnswer("Show the CORRECT ANSWER on the diagram")).toBe(true);
    expect(
      studentImageRevealsAnswer("Unlabelled diagram with empty label boxes. Do not mark any structure as correct.")
    ).toBe(false);
  });

  test("V1 generate-and-save still present", () => {
    const aiRouter = require("../routes/ai");
    const hasV1 = (aiRouter.stack || []).some(
      (layer) => layer.route && layer.route.path === "/generate-and-save" && layer.route.methods?.post
    );
    expect(hasV1).toBe(true);
  });
});
