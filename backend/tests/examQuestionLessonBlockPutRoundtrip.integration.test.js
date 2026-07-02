/**
 * Regression: editor "Save Changes" (PUT /api/lessons/:id) must persist
 * examQuestion block examQuestionId through the full save + refetch round-trip.
 *
 * Guards the backend save contract (mergePagesOnUpdate + sanitisePageInput +
 * makeLessonDbSafe) that EditLessonPage relies on when saving embedded exam
 * question blocks. Text/checkpoint blocks in the same page must also survive.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

jest.setTimeout(20000);

describe("examQuestion lesson block — PUT save/refetch round-trip", () => {
  let ownerToken;
  let ownerId;
  let questionId;
  let lessonId;

  beforeAll(async () => {
    const owner = await User.create({
      firstName: "Roundtrip",
      lastName: "Owner",
      email: "eq-roundtrip-owner@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    ownerId = owner._id;

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "eq-roundtrip-owner@test.com", password: "password123" });
    ownerToken = login.body?.token;
    if (!ownerToken) throw new Error("Login failed");

    const q = await ExamQuestion.create({
      teacherId: ownerId,
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topic: "Reproduction",
      type: "short",
      marks: 3,
      question: "Label the sperm cell diagram.",
      markScheme: ["Head contains genetic material"],
      status: "published",
      imageUrl: "/uploads/exam-questions/sperm.png",
    });
    questionId = String(q._id);

    // Draft lesson (owner can PUT-edit only draft/in_review)
    const lesson = await Lesson.create({
      title: "Human Reproductive Systems",
      description: "Desc",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Roundtrip Owner",
      subject: "Biology",
      level: "IGCSE",
      topic: "Reproduction",
      status: "draft",
      pages: [
        {
          pageId: "p1",
          title: "Page 1",
          order: 1,
          blocks: [{ type: "text", content: "Intro" }],
        },
      ],
    });
    lessonId = String(lesson._id);
  });

  test("PUT adds examQuestion block; GET returns examQuestionId (and keeps text block)", async () => {
    const putRes = await request(app)
      .put(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        pages: [
          {
            pageId: "p1",
            title: "Page 1",
            order: 1,
            blocks: [
              { type: "text", content: "Intro" },
              { type: "examQuestion", examQuestionId: questionId },
            ],
          },
        ],
      });
    expect(putRes.status).toBe(200);

    const putBlocks = putRes.body?.lesson?.pages?.[0]?.blocks ?? [];
    const putEq = putBlocks.filter((b) => b.type === "examQuestion");
    expect(putEq).toHaveLength(1);
    expect(String(putEq[0].examQuestionId)).toBe(questionId);
    expect(putBlocks.some((b) => b.type === "text" && b.content === "Intro")).toBe(true);

    // Re-fetch (simulates reload of Edit Lesson)
    const getRes = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(getRes.status).toBe(200);
    const blocks = getRes.body?.pages?.[0]?.blocks ?? getRes.body?.lesson?.pages?.[0]?.blocks ?? [];
    const eqBlocks = blocks.filter((b) => b.type === "examQuestion");
    expect(eqBlocks).toHaveLength(1);
    expect(String(eqBlocks[0].examQuestionId)).toBe(questionId);
  });

  test("second PUT (re-save after reload) preserves examQuestionId", async () => {
    // Simulate editor reload then Save again with the same reference block.
    const putRes = await request(app)
      .put(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        pages: [
          {
            pageId: "p1",
            title: "Page 1",
            order: 1,
            blocks: [
              { type: "text", content: "Intro" },
              { type: "examQuestion", examQuestionId: questionId },
            ],
          },
        ],
      });
    expect(putRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    const blocks = getRes.body?.pages?.[0]?.blocks ?? getRes.body?.lesson?.pages?.[0]?.blocks ?? [];
    const eqBlocks = blocks.filter((b) => b.type === "examQuestion");
    expect(eqBlocks).toHaveLength(1);
    expect(String(eqBlocks[0].examQuestionId)).toBe(questionId);
  });
});
