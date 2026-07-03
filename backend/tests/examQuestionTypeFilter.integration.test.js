/**
 * GET /api/exam-questions type filter — composite + MCQ part matching.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

jest.setTimeout(20000);

describe("GET /api/exam-questions type filter", () => {
  let token;
  let teacherId;
  let mcqId;
  let shortId;
  let compositeMcqId;
  let compositeShortOnlyId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Type",
      lastName: "Filter",
      email: "type-filter-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "type-filter-teacher@test.com", password: "password123" });
    token = login.body?.token;
    if (!token) throw new Error("Login failed");

    const mcq = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topic: "Menstrual cycle",
      topicKey: "edexcel-igcse-biology:roles-of-oestrogen-and-progesterone-in-the-menstrual-cycle",
      type: "mcq",
      marks: 1,
      question: "Which hormone maintains the uterus lining?",
      options: ["FSH", "Progesterone", "ADH", "Testosterone"],
      correctAnswer: "Progesterone",
      status: "published",
    });
    mcqId = String(mcq._id);

    const shortQ = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topic: "Menstrual cycle",
      topicKey: "edexcel-igcse-biology:roles-of-oestrogen-and-progesterone-in-the-menstrual-cycle",
      type: "short",
      marks: 2,
      question: "Describe the role of oestrogen.",
      markScheme: ["Repairs uterus lining"],
      status: "published",
    });
    shortId = String(shortQ._id);

    const compositeMcq = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topic: "Menstrual cycle",
      topicKey: "edexcel-igcse-biology:roles-of-oestrogen-and-progesterone-in-the-menstrual-cycle",
      questionMode: "composite",
      type: "composite",
      marks: 3,
      question: "The graph shows hormone levels during the menstrual cycle.",
      sharedStem: "The graph shows hormone levels during the menstrual cycle.",
      parts: [
        {
          label: "a",
          type: "mcq",
          marks: 1,
          questionText: "Name hormone X.",
          options: ["Oestrogen", "Progesterone", "FSH", "LH"],
          correctIndex: 0,
        },
        {
          label: "b",
          type: "short",
          marks: 2,
          questionText: "Explain the function of progesterone.",
          markScheme: ["Maintains uterus lining"],
        },
      ],
      totalMarks: 3,
      status: "published",
    });
    compositeMcqId = String(compositeMcq._id);

    const compositeShortOnly = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      examBoard: "Edexcel",
      level: "IGCSE",
      topic: "Menstrual cycle",
      topicKey: "edexcel-igcse-biology:roles-of-oestrogen-and-progesterone-in-the-menstrual-cycle",
      questionMode: "composite",
      type: "composite",
      marks: 4,
      question: "Explain two roles of the placenta.",
      sharedStem: "Explain two roles of the placenta.",
      parts: [
        {
          label: "a",
          type: "short",
          marks: 2,
          questionText: "Role 1",
          markScheme: ["Gas exchange"],
        },
        {
          label: "b",
          type: "short",
          marks: 2,
          questionText: "Role 2",
          markScheme: ["Nutrient transfer"],
        },
      ],
      totalMarks: 4,
      status: "published",
    });
    compositeShortOnlyId = String(compositeShortOnly._id);
  });

  test("type=mcq returns single MCQs and composites containing MCQ parts", async () => {
    const res = await request(app)
      .get("/api/exam-questions")
      .query({ type: "mcq", mineOnly: "1" })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const ids = (res.body.questions || []).map((q) => String(q._id));
    expect(ids).toContain(mcqId);
    expect(ids).toContain(compositeMcqId);
    expect(ids).not.toContain(shortId);
    expect(ids).not.toContain(compositeShortOnlyId);
  });

  test("type=composite returns only composite questions", async () => {
    const res = await request(app)
      .get("/api/exam-questions")
      .query({ type: "composite", mineOnly: "1" })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const ids = (res.body.questions || []).map((q) => String(q._id));
    expect(ids).toContain(compositeMcqId);
    expect(ids).toContain(compositeShortOnlyId);
    expect(ids).not.toContain(mcqId);
    expect(ids).not.toContain(shortId);
  });

  test("type=short returns single short questions only", async () => {
    const res = await request(app)
      .get("/api/exam-questions")
      .query({ type: "short", mineOnly: "1" })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const ids = (res.body.questions || []).map((q) => String(q._id));
    expect(ids).toContain(shortId);
    expect(ids).not.toContain(mcqId);
    expect(ids).not.toContain(compositeMcqId);
    expect(ids).not.toContain(compositeShortOnlyId);
  });

  test("no type filter includes composite questions", async () => {
    const res = await request(app)
      .get("/api/exam-questions")
      .query({ mineOnly: "1" })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const ids = (res.body.questions || []).map((q) => String(q._id));
    expect(ids).toContain(compositeMcqId);
    expect(ids).toContain(mcqId);
    expect(ids).toContain(shortId);
  });
});
