"use strict";

const request = require("supertest");
const bcrypt = require("bcryptjs");

jest.mock("../services/lessonSynthesiser/synthesiserClient", () => {
  const actual = jest.requireActual("../services/lessonSynthesiser/synthesiserClient");
  return {
    ...actual,
    callLessonSynthesiser: jest.fn(),
  };
});

const { callLessonSynthesiser } = require("../services/lessonSynthesiser/synthesiserClient");
const {
  getLessonSynthesiserPr10DraftFixture,
} = require("./fixtures/lessonSynthesiserPr10Draft.fixture");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");

const hashedPassword = bcrypt.hashSync("password123", 10);

function gametesTeacherBody(overrides = {}) {
  return {
    subject: "Biology",
    level: "IGCSE",
    board: "Edexcel",
    topic: "Gametes and Fertilisation",
    specKey: "edexcel-igcse-biology",
    topicKey: "edexcel-igcse-biology:gametes-and-fertilisation",
    tier: "Higher",
    ...overrides,
  };
}

function successfulPipelinePayload() {
  const fixture = getLessonSynthesiserPr10DraftFixture();
  return {
    ok: true,
    code: "SYNTHESISE_OK",
    mode: "deterministic_pipeline",
    export: { letsReviseDraft: fixture.draft },
    criticReport: { ok: true },
  };
}

describe("Lesson Synthesiser P1 — teacher generate route", () => {
  let teacherToken;
  let teacherId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Synth",
      lastName: "Teacher",
      email: `synth-p1-${Date.now()}@test.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: teacher.email, password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  });

  afterAll(async () => {
    if (teacherId) {
      await Lesson.deleteMany({ teacherId });
      await User.deleteOne({ _id: teacherId });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.LESSON_SYNTHESISER_V1_ENABLED;
  });

  test("flag OFF → route returns LESSON_SYNTHESISER_V1_DISABLED", async () => {
    process.env.LESSON_SYNTHESISER_V1_ENABLED = "false";
    const res = await request(app)
      .post("/api/ai/generate-with-lesson-synthesiser-v1")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send(gametesTeacherBody());
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("LESSON_SYNTHESISER_V1_DISABLED");
    expect(callLessonSynthesiser).not.toHaveBeenCalled();
  });

  test("flag ON + teacher taxonomy topicKey → maps and calls Synthesiser", async () => {
    process.env.LESSON_SYNTHESISER_V1_ENABLED = "true";
    callLessonSynthesiser.mockResolvedValue({
      ok: true,
      payload: successfulPipelinePayload(),
    });

    const res = await request(app)
      .post("/api/ai/generate-with-lesson-synthesiser-v1")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send(
        gametesTeacherBody({
          topicKey: "edexcel-igcse-biology:gametes-and-fertilisation",
          topic: "Gametes & Fertilisation",
        })
      );

    expect(res.status).toBe(201);
    expect(callLessonSynthesiser).toHaveBeenCalledTimes(1);
    const synthInput = callLessonSynthesiser.mock.calls[0][0];
    expect(synthInput.topicKey).toBe("reproduction/gametes-fertilisation");
    expect(synthInput.tier).toBeUndefined();
  });

  test("flag ON + supported topic → calls Synthesiser and creates lesson", async () => {
    process.env.LESSON_SYNTHESISER_V1_ENABLED = "true";
    callLessonSynthesiser.mockResolvedValue({
      ok: true,
      payload: successfulPipelinePayload(),
    });

    const before = await Lesson.countDocuments({ teacherId });
    const res = await request(app)
      .post("/api/ai/generate-with-lesson-synthesiser-v1")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send(gametesTeacherBody());

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.lessonId).toBeTruthy();
    expect(res.body.generationEngine).toBe("lesson-synthesiser");
    expect(callLessonSynthesiser).toHaveBeenCalledTimes(1);
    const synthInput = callLessonSynthesiser.mock.calls[0][0];
    expect(synthInput.specKey).toBe("edexcel-igcse-biology");
    expect(synthInput.topicKey).toBe("reproduction/gametes-fertilisation");
    expect(synthInput.tier).toBeUndefined();

    const after = await Lesson.countDocuments({ teacherId });
    expect(after).toBe(before + 1);

    const lesson = await Lesson.findById(res.body.lessonId).lean();
    expect(lesson.metadata?.generationEngine).toBe("lesson-synthesiser");
  });

  test("unsupported topic → SYNTHESISER_TOPIC_UNSUPPORTED, no Synthesiser call", async () => {
    process.env.LESSON_SYNTHESISER_V1_ENABLED = "true";
    const res = await request(app)
      .post("/api/ai/generate-with-lesson-synthesiser-v1")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        ...gametesTeacherBody(),
        topicKey: "edexcel-igcse-biology:unit/unknown-topic",
      });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("SYNTHESISER_TOPIC_UNSUPPORTED");
    expect(callLessonSynthesiser).not.toHaveBeenCalled();
  });

  test("quality failure → no lesson created", async () => {
    process.env.LESSON_SYNTHESISER_V1_ENABLED = "true";
    callLessonSynthesiser.mockResolvedValue({
      ok: true,
      payload: {
        ok: false,
        code: "CRITIC_GATE_FAILED",
        message: "Critic failed",
        errors: [{ code: "TEST" }],
      },
    });

    const before = await Lesson.countDocuments({ teacherId });
    const res = await request(app)
      .post("/api/ai/generate-with-lesson-synthesiser-v1")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send(gametesTeacherBody());

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("CRITIC_GATE_FAILED");
    const after = await Lesson.countDocuments({ teacherId });
    expect(after).toBe(before);
  });

  test("Synthesiser unreachable → explicit failure", async () => {
    process.env.LESSON_SYNTHESISER_V1_ENABLED = "true";
    callLessonSynthesiser.mockResolvedValue({
      ok: false,
      code: "SYNTHESISER_UNREACHABLE",
      message: "down",
    });

    const res = await request(app)
      .post("/api/ai/generate-with-lesson-synthesiser-v1")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send(gametesTeacherBody());

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("SYNTHESISER_UNREACHABLE");
  });
});
