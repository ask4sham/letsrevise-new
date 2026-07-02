/**
 * Regression: Exam Question image (imageUrl) persists through create, reopen (list),
 * edit/replace, and clear — and is returned to the lesson-embed fetch used by
 * ExamQuestionBlock. Guards the "image preview shows but imageUrl saved as null" bug.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

jest.setTimeout(20000);

const IMG_A = "https://cdn.example.com/storage/exam-questions/sperm-cell-1.png";
const IMG_B = "https://cdn.example.com/storage/exam-questions/sperm-cell-2.png";
const TOPIC_KEY = "edexcel-igcse-biology:human-male-and-female-reproductive-systems";

describe("Exam Question imageUrl persistence", () => {
  let token;
  let teacherId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Image",
      lastName: "Persist",
      email: "image-persist-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "image-persist-teacher@test.com", password: "password123" });
    token = login.body?.token;
    if (!token) throw new Error("Login failed");
  });

  function draftPayload(overrides = {}) {
    return {
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      specKey: "edexcel-igcse-biology",
      topicKey: TOPIC_KEY,
      topic: "Human Male & Female Reproductive Systems",
      type: "short",
      marks: 3,
      question: "The diagram shows a human sperm cell. Describe two adaptations for its function.",
      markScheme: [
        "Many mitochondria to release energy for swimming",
        "Acrosome contains enzymes to digest the egg membrane",
        "Long tail/flagellum enables movement to the egg",
      ],
      correctAnswer:
        "Sperm have many mitochondria for energy, an acrosome with digestive enzymes, and a tail for movement.",
      ...overrides,
    };
  }

  test("POST create with imageUrl persists to DB and response", async () => {
    const res = await request(app)
      .post("/api/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send(draftPayload({ imageUrl: IMG_A }));
    expect(res.status).toBe(201);
    expect(res.body?.question?.imageUrl).toBe(IMG_A);

    const inDb = await ExamQuestion.findById(res.body.question._id).lean();
    expect(inDb.imageUrl).toBe(IMG_A);
  });

  test("GET list (reopen) returns the persisted imageUrl", async () => {
    const created = await request(app)
      .post("/api/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send(draftPayload({ imageUrl: IMG_A }));
    const id = created.body.question._id;

    const list = await request(app)
      .get("/api/exam-questions")
      .query({ specKey: "edexcel-igcse-biology", topicKey: TOPIC_KEY, mineOnly: "1" })
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    const row = (list.body.questions || []).find((q) => String(q._id) === String(id));
    expect(row).toBeTruthy();
    expect(row.imageUrl).toBe(IMG_A);
  });

  test("PUT replace imageUrl persists the new URL", async () => {
    const created = await request(app)
      .post("/api/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send(draftPayload({ imageUrl: IMG_A }));
    const id = created.body.question._id;

    const put = await request(app)
      .put(`/api/exam-questions/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ specKey: "edexcel-igcse-biology", imageUrl: IMG_B });
    expect(put.status).toBe(200);
    expect(put.body?.question?.imageUrl).toBe(IMG_B);

    const inDb = await ExamQuestion.findById(id).lean();
    expect(inDb.imageUrl).toBe(IMG_B);
  });

  test("PUT with empty imageUrl clears it (null)", async () => {
    const created = await request(app)
      .post("/api/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send(draftPayload({ imageUrl: IMG_A }));
    const id = created.body.question._id;

    const put = await request(app)
      .put(`/api/exam-questions/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ specKey: "edexcel-igcse-biology", imageUrl: "" });
    expect(put.status).toBe(200);
    expect(put.body?.question?.imageUrl == null).toBe(true);

    const inDb = await ExamQuestion.findById(id).lean();
    expect(inDb.imageUrl == null).toBe(true);
  });

  test("by-ids (lesson embed teacher-owner path) returns imageUrl for rendering", async () => {
    const created = await request(app)
      .post("/api/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send(draftPayload({ imageUrl: IMG_A }));
    const id = created.body.question._id;

    const res = await request(app)
      .post("/api/exam-questions/by-ids")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [id] });
    expect(res.status).toBe(200);
    const row = (res.body.questions || []).find((q) => String(q._id) === String(id));
    expect(row).toBeTruthy();
    expect(row.imageUrl).toBe(IMG_A);
  });
});
