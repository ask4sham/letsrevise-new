/**
 * Lesson Generator V2 — PR B guarded draft persistence.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const {
  runLessonGeneratorV2Scaffold,
  isLessonGeneratorV2PersistEnabled,
  STAGE_STATUS,
} = require("../services/lessonGeneratorV2");
const { collectActivityQuestions } = require("../services/lessonGeneratorV2/validateFinalLesson");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Lesson Generator V2 draft persistence (PR B)", () => {
  let teacherToken;
  let teacherId;
  const prevEnabled = process.env.LESSON_GENERATOR_V2_ENABLED;
  const prevPersist = process.env.LESSON_GENERATOR_V2_PERSIST;
  const markerEmail = "lesson-gen-v2-persist@test.com";

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "V2",
      lastName: "Persist",
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

  afterEach(async () => {
    await Lesson.deleteMany({ teacherId, "metadata.generator": "v2" });
  });

  afterAll(async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = prevEnabled;
    process.env.LESSON_GENERATOR_V2_PERSIST = prevPersist;
    await Lesson.deleteMany({ teacherId, "metadata.generator": "v2" });
    await User.deleteMany({ email: markerEmail });
  });

  test("pipeline flag off still returns 503", async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = "0";
    process.env.LESSON_GENERATOR_V2_PERSIST = "1";
    const res = await request(app)
      .post("/api/ai/generate-and-save-v2")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topic: "Cell structure",
        subject: "Biology",
        level: "GCSE",
        persist: true,
      });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("LESSON_GENERATOR_V2_DISABLED");
  });

  test("persist:true with PERSIST env off returns LESSON_V2_PERSIST_DISABLED", async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = "1";
    process.env.LESSON_GENERATOR_V2_PERSIST = "0";
    expect(isLessonGeneratorV2PersistEnabled()).toBe(false);
    await expect(
      runLessonGeneratorV2Scaffold({
        topic: "Cell structure",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        teacherId,
        persist: true,
      })
    ).rejects.toMatchObject({ code: "LESSON_V2_PERSIST_DISABLED", status: 422 });
  });

  test("without persist:true does not write Lesson even if PERSIST env on", async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = "1";
    process.env.LESSON_GENERATOR_V2_PERSIST = "1";
    const before = await Lesson.countDocuments({ teacherId, "metadata.generator": "v2" });
    const result = await runLessonGeneratorV2Scaffold({
      topic: "Cell structure",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      teacherId,
      persist: false,
    });
    expect(result.saved).toBe(false);
    expect(result.lessonId).toBeNull();
    expect(result.criticOk).toBe(true);
    expect(result.persistenceReady).toBe(true);
    const after = await Lesson.countDocuments({ teacherId, "metadata.generator": "v2" });
    expect(after).toBe(before);
  });

  test("persist:true + both flags saves draft unpublished v2 lesson", async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = "1";
    process.env.LESSON_GENERATOR_V2_PERSIST = "1";
    const before = await Lesson.countDocuments({ teacherId, "metadata.generator": "v2" });
    const result = await runLessonGeneratorV2Scaffold({
      topic: "Gametes & Fertilisation",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      teacherId,
      teacherName: "V2 Persist",
      persist: true,
    });
    expect(result.saved).toBe(true);
    expect(result.lessonId).toBeTruthy();
    expect(result.scaffold).toBe(false);
    expect(result.stageStatuses.phase3).toBe(STAGE_STATUS.COMPLETE);

    const doc = await Lesson.findById(result.lessonId).lean();
    expect(doc).toBeTruthy();
    expect(doc.status).toBe("draft");
    expect(doc.isPublished).toBe(false);
    expect(doc.metadata.generator).toBe("v2");
    expect(String(doc.teacherId)).toBe(teacherId);
    expect(doc.title).toMatch(/Gametes/i);

    const { selfCheck, checkpoint, quiz } = collectActivityQuestions({
      pages: doc.pages,
      quiz: doc.quiz,
    });
    expect(selfCheck).toHaveLength(3);
    expect(checkpoint).toHaveLength(3);
    expect(quiz).toHaveLength(5);

    const after = await Lesson.countDocuments({ teacherId, "metadata.generator": "v2" });
    expect(after).toBe(before + 1);
  });

  test("HTTP persist path saves one draft and keeps V1 route", async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = "1";
    process.env.LESSON_GENERATOR_V2_PERSIST = "1";
    const before = await Lesson.countDocuments({ teacherId, "metadata.generator": "v2" });
    const res = await request(app)
      .post("/api/ai/generate-and-save-v2")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topic: "Sexual & Asexual Reproduction",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        persist: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(true);
    expect(res.body.lessonId).toBeTruthy();
    expect(res.body.finalLesson.status).toBe("draft");
    expect(res.body.finalLesson.isPublished).toBe(false);

    const doc = await Lesson.findById(res.body.lessonId).lean();
    expect(doc.isPublished).toBe(false);
    expect(doc.status).toBe("draft");
    expect(doc.metadata.generator).toBe("v2");

    const after = await Lesson.countDocuments({ teacherId, "metadata.generator": "v2" });
    expect(after).toBe(before + 1);

    const aiRouter = require("../routes/ai");
    const hasV1 = (aiRouter.stack || []).some(
      (layer) => layer.route && layer.route.path === "/generate-and-save" && layer.route.methods?.post
    );
    expect(hasV1).toBe(true);
  });

  test("HTTP persist:true with persist env off returns 503", async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = "1";
    process.env.LESSON_GENERATOR_V2_PERSIST = "0";
    const res = await request(app)
      .post("/api/ai/generate-and-save-v2")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topic: "Cell structure",
        subject: "Biology",
        level: "GCSE",
        persist: true,
      });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("LESSON_V2_PERSIST_DISABLED");
    expect(res.body.saved).toBe(false);
  });
});
