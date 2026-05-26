/**
 * Diagram instructions must round-trip through lesson save + student GET.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const { mergePagesOnUpdate } = require("../routes/lessons");

const hashedPassword = bcrypt.hashSync("password123", 10);
const INSTRUCTIONS =
  "Follow how oxygen, carbon dioxide, and energy move through the body during exercise. Compare what happens during aerobic respiration and anaerobic respiration in muscle cells.";

describe("diagram block instructions round-trip", () => {
  let teacherToken;
  let lessonId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Diagram",
      lastName: "Teacher",
      email: "diagram-subtitle-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });

    const lesson = await Lesson.create({
      title: "Respiration diagram lesson",
      description: "D",
      content: "Content",
      teacherId: teacher._id,
      teacherName: "Diagram Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Respiration",
      status: "draft",
      isPublished: false,
      pages: [
        {
          pageId: "page-1",
          title: "Page 1",
          order: 1,
          blocks: [
            {
              type: "diagram",
              title: "Exercise Pathway During Aerobic and Anaerobic Respiration",
              content: "Oxygen in, carbon dioxide out – the exercise pathway",
              caption: "Exercise pathway",
              imageUrl: "/uploads/lesson-media/diagram.png",
              mode: "static",
              number: 9,
            },
          ],
        },
      ],
      quiz: { timeSeconds: 600, questions: [] },
      flashcards: [],
    });
    lessonId = lesson._id;

    const login = await request(app).post("/api/auth/login").send({
      email: "diagram-subtitle-teacher@test.com",
      password: "password123",
    });
    teacherToken = login.body?.token || login.body?.data?.token;
  });

  test("PUT save persists instructions on diagram block for GET /lessons/:id", async () => {
    const incomingPages = [
      {
        pageId: "page-1",
        title: "Page 1",
        order: 1,
        blocks: [
          {
            type: "diagram",
            title: "Exercise Pathway During Aerobic and Anaerobic Respiration",
            subtitle: INSTRUCTIONS,
            caption: "Exercise pathway",
            imageUrl: "/uploads/lesson-media/diagram.png",
            mode: "static",
            number: 9,
          },
        ],
      },
    ];

    const putRes = await request(app)
      .put(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ pages: incomingPages });
    expect(putRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(getRes.status).toBe(200);

    const diagram = getRes.body.pages[0].blocks.find((b) => b.type === "diagram");
    expect(diagram).toBeTruthy();
    expect(diagram.subtitle).toBe(INSTRUCTIONS);
    expect(diagram.intro).toBe(INSTRUCTIONS);
    expect(diagram.note).toBe(INSTRUCTIONS);
    expect(diagram.content).toBe(INSTRUCTIONS);
  });

  test("mergePagesOnUpdate mirrors instructions into content", () => {
    const pages = mergePagesOnUpdate(
      "lesson-id",
      [],
      [
        {
          pageId: "page-1",
          title: "Page 1",
          order: 1,
          blocks: [
            {
              type: "diagram",
              subtitle: INSTRUCTIONS,
              imageUrl: "/uploads/diagram.png",
              mode: "static",
            },
          ],
        },
      ]
    );
    const diagram = pages[0].blocks[0];
    expect(diagram.content).toBe(INSTRUCTIONS);
  });
});
