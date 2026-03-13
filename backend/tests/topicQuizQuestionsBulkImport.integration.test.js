/**
 * PR-Q1: Topic Quiz Bank — integration tests.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Topic Quiz Bank (PR-Q1)", () => {
  let teacherToken;
  let teacherId;
  let studentToken;
  const specKey = "aqa-gcse-biology";
  const topicKey = "diffusion";

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Quiz",
      lastName: "Teacher",
      email: "quiz-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const student = await User.create({
      firstName: "Quiz",
      lastName: "Student",
      email: "quiz-student@test.com",
      password: hashedPassword,
      userType: "student",
    });
    const loginTeacher = await request(app)
      .post("/api/auth/login")
      .send({ email: "quiz-teacher@test.com", password: "password123" });
    teacherToken = loginTeacher.body?.token;
    const loginStudent = await request(app)
      .post("/api/auth/login")
      .send({ email: "quiz-student@test.com", password: "password123" });
    studentToken = loginStudent.body?.token;
    if (!teacherToken || !studentToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    await TopicQuizQuestion.deleteMany({ ownerId: teacherId });
  });

  test("GET without topicKey returns 400", async () => {
    const res = await request(app)
      .get("/api/topic-quiz-questions")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/topicKey/);
  });

  test("student 403 on GET and POST bulk", async () => {
    const getRes = await request(app)
      .get("/api/topic-quiz-questions")
      .set("Authorization", `Bearer ${studentToken}`)
      .query({ topicKey });
    expect(getRes.status).toBe(403);

    const postRes = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ topicKey, items: [{ questionText: "Q?", choices: ["A", "B"], correctIndex: 0 }] });
    expect(postRes.status).toBe(403);
  });

  test("Preview JSON parses, flags invalid, flags duplicate in payload", async () => {
    const json = JSON.stringify([
      { questionText: "What is diffusion?", choices: ["A", "B", "C"], correctIndex: 0 },
      { questionText: "What is osmosis?", choices: ["A", "B"], correctIndex: 1 },
      { questionText: "", choices: ["A", "B"], correctIndex: 0 },
      { questionText: "What is diffusion?", choices: ["A", "B", "C"], correctIndex: 0 },
    ]);

    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, format: "json", text: json });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.summary.totalParsed).toBe(4);
    expect(res.body.summary.validCount).toBe(2);
    expect(res.body.summary.invalidCount).toBe(1);
    expect(res.body.summary.duplicatesInPayload).toBe(1);
  });

  test("Commit with dedupeMode=skip: skips DB duplicates, inserts new as draft", async () => {
    await TopicQuizQuestion.create({
      ownerId: teacherId,
      topicKey,
      questionText: "What is diffusion?",
      choices: ["A", "B", "C"],
      correctIndex: 0,
      status: "published",
      kind: "quiz",
      fingerprint: "quiz||what is diffusion?||a||b||c||0",
    });

    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        items: [
          { questionText: "What is diffusion?", choices: ["A", "B", "C"], correctIndex: 0 },
          { questionText: "What is osmosis?", choices: ["X", "Y"], correctIndex: 1 },
        ],
        dedupeMode: "skip",
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.createdCount).toBe(1);
    expect(res.body.skipped.duplicatesInDb).toBe(1);
  });

  test("Commit with dedupeMode=error returns 400 when duplicates exist", async () => {
    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        specKey,
        items: [{ questionText: "What is osmosis?", choices: ["X", "Y"], correctIndex: 1 }],
        dedupeMode: "error",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/duplicates|dedupeMode/i);
  });

  test("CSV parsing: questionText + choiceA..D + correct=B + tags", async () => {
    const csv = `questionText,choiceA,choiceB,choiceC,choiceD,correct,tags
What is mitosis?,Option A,Option B,Option C,Option D,B,cell-cycle
What is meiosis?,X,Y,Z,W,1,genetics|inheritance`;

    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey: "cell-division", format: "csv", text: csv });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.summary.validCount).toBe(2);
    expect(res.body.previewItems[0].correctIndex).toBe(1);
    expect(res.body.previewItems[0].choices).toEqual(["Option A", "Option B", "Option C", "Option D"]);
  });

  test("Fingerprint uniqueness: normalized variant skipped", async () => {
    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        specKey,
        items: [
          {
            questionText: "  What is diffusion?  ",
            choices: ["  A  ", "  B  ", "  C  "],
            correctIndex: 0,
          },
        ],
        dedupeMode: "skip",
        kind: "quiz",
      });

    expect(res.status).toBe(200);
    expect(res.body.createdCount).toBe(0);
    expect(res.body.skipped.duplicatesInDb).toBe(1);
  });
});
