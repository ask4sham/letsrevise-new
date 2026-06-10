/**
 * Phase 3H.1.6 — Dashboard teacher-first opening via generate-and-save.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const { getValidHomeostasisTeacherFirstDraft } = require("./helpers/validAiStructureLessonDraft");

jest.mock("axios");

const hashedPassword = bcrypt.hashSync("password123", 10);

function getBlocks(lesson) {
  return (lesson?.pages ?? []).flatMap((p) => p?.blocks ?? []);
}

describe("AI generate-and-save: teacher-first dashboard opening (3H.1.6)", () => {
  const prevFlag = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
  let teacherToken;

  beforeAll(async () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const teacher = await User.create({
      firstName: "TeacherFirst",
      lastName: "Dashboard",
      email: "teacher-first-dashboard@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "teacher-first-dashboard@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");

    const gold = await Lesson.findOne({ isTemplate: true }).lean();
    if (!gold) {
      await Lesson.create({
        teacherId: teacher._id,
        teacherName: "TeacherFirst Dashboard",
        title: "Gold Template",
        description: "Template",
        content: "Template content",
        isTemplate: true,
        status: "draft",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        topic: "Template",
        pages: [{ pageId: "p1", title: "Page 1", order: 1, blocks: [{ type: "text", content: "Intro" }] }],
      });
    }
  }, 15000);

  afterAll(async () => {
    if (prevFlag === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevFlag;
    await User.deleteMany({ email: "teacher-first-dashboard@test.com" });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("reorders opening to Definition before Scenario at block 8", async () => {
    const homeostasisDraft = getValidHomeostasisTeacherFirstDraft();
    axios.post.mockResolvedValue({
      data: {
        output_text: JSON.stringify(homeostasisDraft),
      },
    });

    const res = await request(app)
      .post("/api/ai/generate-and-save")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topic: "Homeostasis",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        topicKey: "aqa-gcse-biology:homeostasis",
        useLessonGeneratorV2: true,
        useLessonGeneratorV4: true,
      });

    if (res.status !== 200) {
      throw new Error(`generate-and-save failed: ${JSON.stringify(res.body)}`);
    }
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const lesson = await Lesson.findById(res.body.lessonId).lean();
    const titles = getBlocks(lesson)
      .slice(0, 10)
      .map((b) => String(b.title || "").trim());

    expect(titles[0]).toMatch(/revision objectives/i);
    expect(titles[2]).toMatch(/definition/i);
    expect(titles[3]).toMatch(/why it matters/i);
    expect(titles[4]).toMatch(/core model/i);
    expect(titles[5]).toMatch(/key examples/i);
    expect(titles[6]).toMatch(/exam vocabulary/i);
    expect(titles[7]).toMatch(/scenario/i);

    const scenarioIdx = titles.findIndex((t) => /scenario/i.test(t));
    expect(scenarioIdx).toBe(7);

    const reviewRes = await request(app)
      .get(`/api/lessons/${res.body.lessonId}/coverage-review`)
      .set("Authorization", `Bearer ${teacherToken}`);
    const tf = reviewRes.body?.review?.teacherFirstOpeningCoverage;
    expect(tf?.enabled).toBe(true);
    expect(tf?.scenarioBeforeCoreKnowledge).toBe(false);
    expect(tf?.openingScorePct).toBeGreaterThan(25);
  });
});
