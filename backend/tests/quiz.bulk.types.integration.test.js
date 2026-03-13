/**
 * PR-QUIZ-BANK-TYPES-1 / PR-QUIZ-TYPES-1: MCQ + short-answer bulk preview/import; CSV + JSON; type in body.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const { buildTopicKey } = require("../utils/topicKey");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Quiz bulk types (MCQ + short-answer)", () => {
  let teacherToken;
  let teacherId;
  const specKey = "aqa-gcse-biology";
  const topicSlug = "cell-structure";
  const topicKey = buildTopicKey(specKey, topicSlug);

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Quiz",
      lastName: "Types",
      email: "quiz-types@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "quiz-types@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    await TopicQuizQuestion.deleteMany({ ownerId: teacherId });
  });

  test("MCQ preview accepts existing format (no type field) → valid", async () => {
    const json = JSON.stringify([
      { questionText: "What is the nucleus?", choices: ["A", "B", "C"], correctIndex: 0 },
    ]);
    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, format: "json", text: json });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.summary.validCount).toBe(1);
    expect(res.body.previewItems).toHaveLength(1);
    expect(res.body.previewItems[0].type).toBe("mcq");
    expect(res.body.previewItems[0].choices).toEqual(["A", "B", "C"]);
    expect(res.body.previewItems[0].correctIndex).toBe(0);
  });

  test("Short-answer preview accepts type=short-answer + acceptableAnswers → valid", async () => {
    const json = JSON.stringify([
      {
        type: "short-answer",
        questionText: "Name the organelle that contains genetic material.",
        acceptableAnswers: ["nucleus", "the nucleus"],
        matchMode: "contains",
      },
    ]);
    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, format: "json", text: json });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.summary.validCount).toBe(1);
    expect(res.body.previewItems[0].type).toBe("short-answer");
    expect(res.body.previewItems[0].acceptableAnswers).toEqual(["nucleus", "the nucleus"]);
    expect(res.body.previewItems[0].matchMode).toBe("contains");
  });

  test("Short-answer missing acceptableAnswers → invalid with clear error", async () => {
    const json = JSON.stringify([
      { type: "short-answer", questionText: "What is it?", acceptableAnswers: [] },
    ]);
    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, format: "json", text: json });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.summary.invalidCount).toBe(1);
    expect(res.body.invalid[0].reason).toMatch(/acceptable|1-10/i);
  });

  test("MCQ missing choices or <2 choices → invalid", async () => {
    const json = JSON.stringify([
      { questionText: "Only one?", choices: ["A"], correctIndex: 0 },
    ]);
    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, format: "json", text: json });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.summary.invalidCount).toBe(1);
    expect(res.body.invalid[0].reason).toMatch(/choices|2-6/i);
  });

  test("MCQ CSV preview passes without type (legacy) → valid > 0", async () => {
    const csv = "topicKey,question,choiceA,choiceB,choiceC,choiceD,correctChoice,explanation\ndiffusion,What is diffusion?,A,B,C,D,B,Net movement";
    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, format: "csv", text: csv });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.summary.validCount).toBeGreaterThan(0);
    expect(res.body.previewItems[0].type).toBe("mcq");
  });

  test("Short Answer CSV preview passes with type=short-answer → valid > 0, no choices errors", async () => {
    const csv = "topicKey,question,acceptableAnswers,explanation\ncell-structure,Name the organelle.,nucleus|the nucleus,";
    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, type: "short-answer", format: "csv", text: csv });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.summary.validCount).toBeGreaterThan(0);
    expect(res.body.previewItems[0].type).toBe("short-answer");
    const choiceErrors = (res.body.invalid || []).filter((i) => /choices must be 2-6/i.test(i.reason));
    expect(choiceErrors.length).toBe(0);
  });

  test("Short Answer CSV missing acceptableAnswers fails row with clear error", async () => {
    const csv = "topicKey,question,acceptableAnswers,explanation\ncell-structure,Name it.,,";
    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, type: "short-answer", format: "csv", text: csv });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.summary.invalidCount).toBeGreaterThanOrEqual(1);
    expect(res.body.invalid[0].reason).toMatch(/acceptable|1-10|1\s*-\s*10/i);
  });

  test("MCQ CSV missing choices fails", async () => {
    const csv = "topicKey,question,choiceA,choiceB,correctChoice,explanation\ndiffusion,What is it?,A,,,";
    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, format: "csv", text: csv });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.summary.invalidCount).toBeGreaterThan(0);
    expect(res.body.invalid.some((i) => /choices|2-6/i.test(i.reason))).toBe(true);
  });

  test("Import stores topicKey namespaced and correct fields per type", async () => {
    const items = [
      { questionText: "MCQ bulk type " + Date.now(), choices: ["X", "Y"], correctIndex: 1 },
      {
        type: "short-answer",
        questionText: "Short bulk type " + Date.now(),
        acceptableAnswers: ["ans1", "ans2"],
        matchMode: "exact",
      },
    ];
    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, items, kind: "quiz" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.createdCount).toBe(2);
    expect(res.body.createdIds).toHaveLength(2);

    const docs = await TopicQuizQuestion.find({ _id: { $in: res.body.createdIds } }).lean();
    expect(docs.length).toBe(2);
    docs.forEach((d) => {
      expect(d.topicKey).toBe(topicKey);
    });
    const mcqDoc = docs.find((d) => d.type === "mcq");
    const shortDoc = docs.find((d) => d.type === "short-answer");
    expect(mcqDoc).toBeDefined();
    expect(mcqDoc.choices).toHaveLength(2);
    expect(mcqDoc.correctIndex).toBe(1);
    expect(shortDoc).toBeDefined();
    expect(shortDoc.acceptableAnswers).toHaveLength(2);
    expect(shortDoc.matchMode).toBe("exact");
  });

  test("Fingerprint dedupe works per type (same question text, different type)", async () => {
    const questionText = "Same question text " + Date.now();
    await TopicQuizQuestion.create({
      ownerId: teacherId,
      topicKey,
      type: "mcq",
      questionText,
      choices: ["A", "B"],
      correctIndex: 0,
      status: "draft",
      kind: "quiz",
      fingerprint: require("../utils/quizDedupe").fingerprint(questionText, ["A", "B"], 0, "quiz"),
    });

    const res = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        specKey,
        items: [
          { type: "short-answer", questionText, acceptableAnswers: ["answer"], matchMode: "contains" },
        ],
        kind: "quiz",
      });
    expect(res.status).toBe(200);
    expect(res.body.createdCount).toBe(1);
    const doc = await TopicQuizQuestion.findOne({ ownerId: teacherId, questionText, type: "short-answer" }).lean();
    expect(doc).toBeDefined();
    expect(doc.acceptableAnswers).toContain("answer");
  });
});
