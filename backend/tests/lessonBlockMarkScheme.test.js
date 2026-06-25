/**
 * Regression: block-level markScheme must be String in Mongo (not string[]).
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const {
  makeLessonDbSafe,
  normalizeBlockMarkSchemeForDb,
  rehydrateLessonPagesMarkSchemeFromDb,
} = require("../utils/lessonDbSafe");

describe("lesson block markScheme normalization", () => {
  test("normalizeBlockMarkSchemeForDb joins arrays with newlines", () => {
    expect(
      normalizeBlockMarkSchemeForDb(["Line one", "Line two"])
    ).toBe("Line one\nLine two");
  });

  test("normalizeBlockMarkSchemeForDb leaves valid strings unchanged", () => {
    const s = "Already\na string";
    expect(normalizeBlockMarkSchemeForDb(s)).toBe(s);
  });

  test("makeLessonDbSafe converts block markScheme array to string", () => {
    const pages = [
      {
        pageId: "p1",
        order: 0,
        blocks: [
          {
            type: "checkpoint",
            prompt: "Q?",
            markScheme: ["Alpha", "Beta"],
          },
        ],
        checkpoint: {
          question: "Page Q?",
          options: ["a", "b"],
          answer: "a",
          markScheme: ["Page rubric one", "Page rubric two"],
        },
      },
    ];
    const safe = makeLessonDbSafe({ pages });
    expect(safe.pages[0].blocks[0].markScheme).toBe("Alpha\nBeta");
    expect(safe.pages[0].checkpoint.markScheme).toEqual([
      "Page rubric one",
      "Page rubric two",
    ]);
  });

  test("rehydrateLessonPagesMarkSchemeFromDb fixes legacy array in Mongo before publish save", async () => {
    const hashed = bcrypt.hashSync("password123", 10);
    const teacher = await User.create({
      firstName: "Mark",
      lastName: "Scheme",
      email: `markscheme-${Date.now()}@test.com`,
      password: hashed,
      userType: "teacher",
    });

    const pages = [
      {
        pageId: "p1",
        order: 0,
        blocks: [
          { type: "text", content: "Intro" },
          {
            type: "checkpoint",
            role: "checkpoint",
            prompt: "Why vasodilation?",
            questionType: "mcq",
            options: ["a", "b"],
            correctAnswer: "a",
            markScheme: ["Line A", "Line B"],
          },
        ],
      },
    ];

    const ins = await mongoose.connection.collection("lessons").insertOne({
      title: "Mark scheme publish test",
      description: "desc",
      content: "Structured lesson (see pages)",
      teacherId: teacher._id,
      teacherName: "Mark Scheme",
      subject: "Biology",
      level: "GCSE",
      topic: "Homeostasis",
      status: "draft",
      isPublished: false,
      pages,
      quiz: { questions: [] },
      flashcards: [],
    });

    const lesson = await Lesson.findById(ins.insertedId);
    expect(lesson.pages[0].blocks[1].markScheme).toBeUndefined();

    await rehydrateLessonPagesMarkSchemeFromDb(lesson);
    expect(lesson.pages[0].blocks[1].markScheme).toBe("Line A\nLine B");

    lesson.isPublished = true;
    lesson.status = "published";
    await expect(lesson.save({ runValidators: true })).resolves.toBeDefined();

    await Lesson.deleteOne({ _id: ins.insertedId });
    await User.deleteOne({ _id: teacher._id });
  });
});

describe("PATCH /api/lessons/:id/publish with legacy block markScheme array", () => {
  let teacherId;
  let token;
  let lessonId;

  beforeAll(async () => {
    const hashed = bcrypt.hashSync("password123", 10);
    const teacher = await User.create({
      firstName: "Publish",
      lastName: "MarkScheme",
      email: `publish-ms-${Date.now()}@test.com`,
      password: hashed,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: teacher.email, password: "password123" });
    token = login.body.token;

    const ins = await mongoose.connection.collection("lessons").insertOne({
      title: "Publish markScheme regression",
      description: "desc",
      content: "Structured lesson (see pages)",
      teacherId,
      teacherName: "Publish MarkScheme",
      subject: "Biology",
      level: "GCSE",
      topic: "Temperature",
      status: "draft",
      isPublished: false,
      pages: [
        {
          pageId: "p1",
          order: 0,
          blocks: [
            { type: "text", content: "Body" },
            {
              type: "checkpoint",
              prompt: "Checkpoint?",
              questionType: "mcq",
              options: ["x", "y"],
              correctAnswer: "x",
              markScheme: ["Rubric 1", "Rubric 2"],
            },
          ],
        },
      ],
      quiz: { questions: [] },
      flashcards: [],
    });
    lessonId = String(ins.insertedId);
  });

  afterAll(async () => {
    if (lessonId) await Lesson.deleteOne({ _id: lessonId });
    if (teacherId) await User.deleteOne({ _id: teacherId });
  });

  test("publish returns 200 and persists string markScheme", async () => {
    const res = await request(app)
      .patch(`/api/lessons/${lessonId}/publish`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isPublished: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const raw = await mongoose.connection.collection("lessons").findOne({
      _id: new mongoose.Types.ObjectId(lessonId),
    });
    expect(typeof raw.pages[0].blocks[1].markScheme).toBe("string");
    expect(raw.pages[0].blocks[1].markScheme).toBe("Rubric 1\nRubric 2");
  });
});
