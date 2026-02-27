/**
 * PR-ROBUSTNESS-E2E-1: Import → browse → edit smoke.
 * Proves full pipeline: CSV preview → bulk import (drafts) → list → PATCH edit (question + answer) → verify saved.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);
jest.setTimeout(20000);

describe("Topic Quiz Questions — import then browse/edit smoke", () => {
  let teacherToken;
  let teacherId;
  const specKey = "aqa-gcse-biology";
  const topicKey = "cell-structure";

  const csv = [
    "question,choiceA,choiceB,choiceC,choiceD,correct",
    '"Import smoke question?",Yes,No,Maybe,N/A,A',
  ].join("\n");

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "ImportSmoke",
      lastName: "Teacher",
      email: "import-smoke-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "import-smoke-teacher@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  });

  afterAll(async () => {
    await TopicQuizQuestion.deleteMany({ ownerId: teacherId });
    await User.deleteOne({ _id: teacherId });
  });

  test("CSV preview → import drafts → list → edit → verify saved", async () => {
    // 1) CSV preview
    const previewRes = await request(app)
      .post("/api/topic-quiz-questions/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, format: "csv", text: csv });

    expect(previewRes.status).toBe(200);
    expect(previewRes.body.ok).toBe(true);
    expect(previewRes.body.summary.validCount).toBeGreaterThanOrEqual(1);
    expect(previewRes.body.previewItems).toBeDefined();
    expect(previewRes.body.previewItems.length).toBeGreaterThanOrEqual(1);
    const first = previewRes.body.previewItems[0];
    expect(first.questionText).toBeDefined();
    expect(Array.isArray(first.choices)).toBe(true);
    expect(typeof first.correctIndex).toBe("number");

    // 2) Import drafts (use preview items; bulk accepts same shape)
    const itemsToImport = previewRes.body.previewItems.map((p) => ({
      type: p.type || "mcq",
      questionText: p.questionText,
      choices: p.choices || [],
      correctIndex: p.correctIndex ?? 0,
      explanation: p.explanation || "",
      tags: p.tags || [],
    }));

    const bulkRes = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, items: itemsToImport, dedupeMode: "skip" });

    expect(bulkRes.status).toBe(200);
    expect(bulkRes.body.ok).toBe(true);
    expect(Array.isArray(bulkRes.body.createdIds)).toBe(true);
    expect(bulkRes.body.createdIds.length).toBeGreaterThanOrEqual(1);
    const createdId = bulkRes.body.createdIds[0];

    // 3) Browse (list drafts)
    const listRes = await request(app)
      .get("/api/topic-quiz-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({ topicKey, status: "draft" });

    expect(listRes.status).toBe(200);
    expect(listRes.body.items).toBeDefined();
    const found = listRes.body.items.find((i) => String(i._id) === String(createdId));
    expect(found).toBeDefined();
    expect(found.questionText).toContain("Import smoke question");

    // 4) Edit
    const editRes = await request(app)
      .patch(`/api/topic-quiz-questions/${createdId}`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ questionText: "Edited after import" });

    expect(editRes.status).toBe(200);
    expect(editRes.body.item).toBeDefined();
    expect(editRes.body.item.questionText).toBe("Edited after import");

    // 5) Verify saved (PATCH already returned item; optionally re-GET)
    const getAgain = await request(app)
      .get("/api/topic-quiz-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({ topicKey, status: "draft" });
    expect(getAgain.status).toBe(200);
    const afterEdit = getAgain.body.items.find((i) => String(i._id) === String(createdId));
    expect(afterEdit).toBeDefined();
    expect(afterEdit.questionText).toBe("Edited after import");

    // 6) Edit answer (MCQ: correctChoice + choices)
    const answerRes = await request(app)
      .patch(`/api/topic-quiz-questions/${createdId}`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        choices: ["Yes", "No", "Maybe", "N/A"],
        correctChoice: "B",
      });
    expect(answerRes.status).toBe(200);
    expect(answerRes.body.item).toBeDefined();
    expect(answerRes.body.item.correctIndex).toBe(1);
    expect(answerRes.body.item.choices).toEqual(["Yes", "No", "Maybe", "N/A"]);

    // 7) Verify answer persisted
    const getAfterAnswer = await request(app)
      .get("/api/topic-quiz-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({ topicKey, status: "draft" });
    expect(getAfterAnswer.status).toBe(200);
    const afterAnswer = getAfterAnswer.body.items.find((i) => String(i._id) === String(createdId));
    expect(afterAnswer).toBeDefined();
    expect(afterAnswer.correctIndex).toBe(1);
    expect(afterAnswer.choices).toEqual(["Yes", "No", "Maybe", "N/A"]);
  });

  test("short-answer: import → edit acceptableAnswers → verify saved", async () => {
    const csvShort = [
      "question,acceptable",
      "Name the organelle that contains DNA.,nucleus|the nucleus",
    ].join("\n");

    const previewRes = await request(app)
      .post("/api/topic-quiz-questions/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, format: "csv", type: "short-answer", text: csvShort });

    expect(previewRes.status).toBe(200);
    expect(previewRes.body.ok).toBe(true);
    expect(previewRes.body.summary.validCount).toBeGreaterThanOrEqual(1);
    expect(previewRes.body.previewItems.length).toBeGreaterThanOrEqual(1);
    const first = previewRes.body.previewItems[0];
    expect(first.type).toBe("short-answer");
    expect(Array.isArray(first.acceptableAnswers)).toBe(true);
    expect(first.acceptableAnswers.length).toBeGreaterThanOrEqual(1);

    const itemsToImport = previewRes.body.previewItems.map((p) => ({
      type: "short-answer",
      questionText: p.questionText,
      acceptableAnswers: p.acceptableAnswers || [],
      matchMode: p.matchMode || "contains",
      explanation: p.explanation || "",
      tags: p.tags || [],
    }));

    const bulkRes = await request(app)
      .post("/api/topic-quiz-questions/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, specKey, items: itemsToImport, dedupeMode: "skip" });

    expect(bulkRes.status).toBe(200);
    expect(bulkRes.body.createdIds.length).toBeGreaterThanOrEqual(1);
    const createdId = bulkRes.body.createdIds[0];

    const editRes = await request(app)
      .patch(`/api/topic-quiz-questions/${createdId}`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        acceptableAnswers: ["nucleus", "nuclei", "the nucleus"],
        matchMode: "contains",
      });

    expect(editRes.status).toBe(200);
    expect(editRes.body.item.type).toBe("short-answer");
    expect(editRes.body.item.acceptableAnswers).toEqual(["nucleus", "nuclei", "the nucleus"]);
    expect(editRes.body.item.matchMode).toBe("contains");

    const getAgain = await request(app)
      .get("/api/topic-quiz-questions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .query({ topicKey, status: "draft" });
    const afterEdit = getAgain.body.items.find((i) => String(i._id) === String(createdId));
    expect(afterEdit).toBeDefined();
    expect(afterEdit.acceptableAnswers).toEqual(["nucleus", "nuclei", "the nucleus"]);
  });
});
