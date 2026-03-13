/**
 * PR-PAST-PAPERS-UI-2: GET /api/past-paper-questions/mine, POST / (single create), POST /link.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const PastPaper = require("../models/PastPaper");
const PastPaperQuestion = require("../models/PastPaperQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Past paper questions (mine + link)", () => {
  let token;
  let teacherId;
  let pastPaperId;

  beforeAll(async () => {
    const email = `teacher_ppq_${Date.now()}@example.com`;
    const teacher = await User.create({
      email,
      password: hashedPassword,
      userType: "teacher",
      firstName: "PPQ",
      lastName: "Teacher",
    });
    teacherId = teacher._id;

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "password123" })
      .expect(200);
    token = login.body?.token;
    if (!token) throw new Error("Login failed");

    const paper = await PastPaper.create({
      ownerId: teacherId,
      specKey: "aqa-gcse-biology",
      examBoard: "AQA",
      level: "GCSE",
      year: "2024",
      paperCode: "Paper 1",
      fingerprint: `fp_ppq_${Date.now()}`,
    });
    pastPaperId = paper._id;
  }, 15000);

  afterAll(async () => {
    await PastPaperQuestion.deleteMany({ ownerId: teacherId });
    await PastPaper.deleteMany({ ownerId: teacherId });
  });

  it("GET /mine requires auth", async () => {
    await request(app).get("/api/past-paper-questions/mine").expect(401);
  });

  it("GET /mine requires pastPaperId", async () => {
    await request(app)
      .get("/api/past-paper-questions/mine")
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
  });

  it("GET /mine returns questions for my paper", async () => {
    const res = await request(app)
      .get(`/api/past-paper-questions/mine?pastPaperId=${pastPaperId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(0);
  });

  it("POST /link adds questions and GET /mine returns them", async () => {
    const linkRes = await request(app)
      .post("/api/past-paper-questions/link")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({
        pastPaperId: String(pastPaperId),
        specKey: "aqa-gcse-biology",
        items: [
          {
            topicKey: "cell-structure",
            questionNumber: "1(a)",
            marks: 2,
            question: "Describe the function of the nucleus.",
            markScheme: "Control of cell activities; contains genetic material.",
          },
        ],
      })
      .expect(201);
    expect(linkRes.body.linked).toBe(1);
    expect(linkRes.body.pastPaperId).toBe(String(pastPaperId));

    const listRes = await request(app)
      .get(`/api/past-paper-questions/mine?pastPaperId=${pastPaperId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(listRes.body.items.length).toBe(1);
    expect(listRes.body.items[0].question).toContain("nucleus");
    expect(listRes.body.items[0].topicKey).toContain("cell-structure");
  });

  it("POST / creates a question with namespaced topicKey", async () => {
    const res = await request(app)
      .post("/api/past-paper-questions")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send({
        pastPaperId: String(pastPaperId),
        topicKey: "cell-structure",
        questionNumber: "2(a)",
        marks: 1,
        question: "Name the organelle that carries out photosynthesis.",
        markScheme: "Chloroplast.",
      })
      .expect(201);
    expect(res.body.item).toBeDefined();
    expect(res.body.item.topicKey).toMatch(/^aqa-gcse-biology:/);
    expect(res.body.deduped).toBe(false);
  });
});
