/**
 * Regression: PUT /api/lessons/:id must preserve checkpoint/selfCheck block.id
 * through mergePagesOnUpdate + sanitisePageInput + save + PUT response.
 *
 * Mirrors Mutation lesson Practise-page selfCheck shape from live smoke test.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");

const hashedPassword = bcrypt.hashSync("password123", 10);

const BLOCK_ID = "blk_test_roundtrip";
const SELF_CHECK_BLOCK = {
  type: "selfCheck",
  prompt: "Which statement best defines a mutation?",
  questionType: "mcq",
  options: [
    "A rare, random change in genetic material.",
    "A change in the number of chromosomes in a cell",
    "A change in the shape of the cell membrane",
    "A change in the amount of cytoplasm in a cell",
  ],
  correctAnswer: "A rare, random change in genetic material.",
  explanation: "Mutations involve changes to the DNA base sequence which can affect genes.",
  id: BLOCK_ID,
  role: "selfCheck",
};

jest.setTimeout(20000);

describe("selfCheck block.id — PUT save/refetch round-trip", () => {
  let ownerToken;
  let ownerId;
  let lessonId;

  beforeAll(async () => {
    const owner = await User.create({
      firstName: "SelfCheck",
      lastName: "BlockId",
      email: "selfcheck-blockid@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    ownerId = owner._id;

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "selfcheck-blockid@test.com", password: "password123" });
    ownerToken = login.body?.token;
    if (!ownerToken) throw new Error("Login failed");

    const lesson = await Lesson.create({
      title: "Mutation block id probe",
      description: "Desc",
      content: "Content",
      teacherId: ownerId,
      teacherName: "SelfCheck BlockId",
      subject: "Biology",
      level: "IGCSE",
      topic: "Mutation",
      status: "draft",
      pages: [
        {
          pageId: "p_practise",
          title: "Practise",
          order: 2,
          blocks: [
            {
              type: "selfCheck",
              prompt: SELF_CHECK_BLOCK.prompt,
              questionType: "mcq",
              options: SELF_CHECK_BLOCK.options,
              correctAnswer: SELF_CHECK_BLOCK.correctAnswer,
              explanation: SELF_CHECK_BLOCK.explanation,
              role: "selfCheck",
            },
          ],
        },
      ],
    });
    lessonId = String(lesson._id);
  });

  function findSelfCheck(blocks) {
    return (blocks || []).find((b) => b.type === "selfCheck");
  }

  test("PUT preserves selfCheck block.id in response and GET after save", async () => {
    const putRes = await request(app)
      .put(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        pages: [
          {
            pageId: "p_practise",
            title: "Practise",
            order: 2,
            blocks: [SELF_CHECK_BLOCK],
          },
        ],
      });

    expect(putRes.status).toBe(200);

    const putBlock = findSelfCheck(putRes.body?.lesson?.pages?.[0]?.blocks);
    expect(putBlock).toBeDefined();
    expect(putBlock.id).toBe(BLOCK_ID);

    const lean = await Lesson.findById(lessonId).lean();
    const dbBlock = findSelfCheck(lean.pages?.[0]?.blocks);
    expect(dbBlock?.id).toBe(BLOCK_ID);

    const getRes = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(getRes.status).toBe(200);

    const getBlock = findSelfCheck(getRes.body?.pages?.[0]?.blocks);
    expect(getBlock?.id).toBe(BLOCK_ID);
  });
});
