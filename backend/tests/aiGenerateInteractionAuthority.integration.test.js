/**
 * Phase 3G.8 — generate-and-save interaction authority enforcement.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const { getValidCellStructureDraft } = require("./helpers/validAiStructureLessonDraft");
const { countForbiddenPrimaryActivities } = require("../../lib/teacherBrain/interactionAuthorityEnforcer");

jest.mock("axios");

const hashedPassword = bcrypt.hashSync("password123", 10);

const TOPIC_KEY = "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure";
const SUB_TOPIC = "Structure and function of the nervous system";

function getBlocks(lesson) {
  return (lesson?.pages ?? []).flatMap((p) => p?.blocks ?? []);
}

function nervousSystemContaminatedDraft() {
  const base = getValidCellStructureDraft();
  const extraBlocks = [
    {
      type: "text",
      title: "Key examples",
      content: "Sensory neurones and motor neurones — brief reflex pathway neighbour mention.",
    },
    {
      type: "keyIdea",
      title: "What to Notice",
      role: "whatToNotice",
      content: "Focus on the labelled parts of the neurone diagram.",
    },
    {
      type: "dragDropMatch",
      title: "REFLEX ARC PATHWAY",
      content: "Order the reflex arc pathway drag drop",
    },
    {
      type: "checkpoint",
      prompt: "Explain accommodation and lens shape change for near vision.",
      questionType: "short",
      options: [],
      correctAnswer: "Ciliary muscles contract.",
      explanation: "",
    },
  ];
  base.pages[0].blocks = [...base.pages[0].blocks.slice(0, 4), ...extraBlocks, ...base.pages[0].blocks.slice(4)];
  base.title = "Structure and function of the nervous system";
  return base;
}

describe("AI generate-and-save: interaction authority enforcement (3G.8)", () => {
  const prevBoundary = process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
  let teacherToken;

  beforeAll(async () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const teacher = await User.create({
      firstName: "Interaction",
      lastName: "Authority",
      email: "interaction-authority@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "interaction-authority@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");

    const gold = await Lesson.findOne({ isTemplate: true }).lean();
    if (!gold) {
      await Lesson.create({
        teacherId: teacher._id,
        teacherName: "Interaction Authority",
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
    if (prevBoundary === undefined) delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    else process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = prevBoundary;
    await User.deleteMany({ email: "interaction-authority@test.com" });
    await Lesson.deleteMany({ title: /Structure and function of the nervous system/i });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("saved lesson has zero forbidden primary activities; text mentions preserved", async () => {
    axios.post.mockResolvedValue({
      data: {
        output_text: JSON.stringify(nervousSystemContaminatedDraft()),
      },
    });

    const res = await request(app)
      .post("/api/ai/generate-and-save")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topic: SUB_TOPIC,
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        tier: "foundation",
        topicKey: TOPIC_KEY,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const lesson = await Lesson.findById(res.body.lessonId).lean();
    expect(lesson).toBeTruthy();

    const blocks = getBlocks(lesson);
    expect(blocks.some((b) => b.title === "Key examples" && /reflex pathway/i.test(b.content || ""))).toBe(
      true
    );
    expect(
      blocks.some((b) => b.title === "What to Notice" && /Focus on the labelled parts/i.test(b.content || ""))
    ).toBe(true);
    expect(blocks.some((b) => /REFLEX ARC PATHWAY/i.test(b.title || ""))).toBe(false);

    expect(
      countForbiddenPrimaryActivities(lesson.pages, {
        topicKey: TOPIC_KEY,
        subTopic: SUB_TOPIC,
        topic: SUB_TOPIC,
      })
    ).toBe(0);
  });
});
