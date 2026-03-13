/**
 * PR-PP1: Topic Past Paper Bank — URL bulk import integration tests.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const path = require("path");
const app = require("../app");
const User = require("../models/User");
const TopicPastPaper = require("../models/TopicPastPaper");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Topic Past Paper Bank - URL Import (PR-PP1)", () => {
  let teacherToken;
  let teacherId;
  let studentToken;
  const topicKey = "diffusion";

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "PastPaper",
      lastName: "Teacher",
      email: "pastpaper-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const student = await User.create({
      firstName: "PastPaper",
      lastName: "Student",
      email: "pastpaper-student@test.com",
      password: hashedPassword,
      userType: "student",
    });
    const loginTeacher = await request(app).post("/api/auth/login").send({ email: "pastpaper-teacher@test.com", password: "password123" });
    teacherToken = loginTeacher.body?.token;
    const loginStudent = await request(app).post("/api/auth/login").send({ email: "pastpaper-student@test.com", password: "password123" });
    studentToken = loginStudent.body?.token;
    if (!teacherToken || !studentToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    await TopicPastPaper.deleteMany({ ownerId: teacherId });
  });

  test("GET without topicKey returns 400", async () => {
    const res = await request(app).get("/api/topic-past-papers").set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/topicKey/);
  });

  test("student 403 on GET and POST bulk", async () => {
    const getRes = await request(app).get("/api/topic-past-papers").set("Authorization", `Bearer ${studentToken}`).query({ topicKey });
    expect(getRes.status).toBe(403);

    const postRes = await request(app)
      .post("/api/topic-past-papers/bulk")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ topicKey, items: [{ title: "Test", url: "https://example.com/paper.pdf" }] });
    expect(postRes.status).toBe(403);
  });

  test("preview JSON with invalid + duplicate in payload", async () => {
    const json = JSON.stringify([
      { title: "Paper 1", url: "https://example.com/p1.pdf", year: 2019 },
      { title: "Paper 2", url: "invalid", year: 2020 },
      { title: "Paper 1", url: "https://example.com/p1.pdf", year: 2019 },
    ]);

    const res = await request(app)
      .post("/api/topic-past-papers/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, format: "json", text: json });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.summary.totalParsed).toBe(3);
    expect(res.body.summary.validCount).toBe(1);
    expect(res.body.summary.invalidCount).toBe(1);
    expect(res.body.summary.duplicatesInPayload).toBe(1);
  });

  test("commit skip duplicates vs DB", async () => {
    const bulkRes = await request(app)
      .post("/api/topic-past-papers/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, items: [{ title: "Skip Test", url: "https://example.com/skip.pdf", year: 2019 }], dedupeMode: "skip" });
    expect(bulkRes.status).toBe(200);
    expect(bulkRes.body.createdCount).toBe(1);

    const bulk2 = await request(app)
      .post("/api/topic-past-papers/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, items: [{ title: "Skip Test", url: "https://example.com/skip.pdf", year: 2019 }], dedupeMode: "skip" });
    expect(bulk2.status).toBe(200);
    expect(bulk2.body.createdCount).toBe(0);
    expect(bulk2.body.skipped.duplicatesInDb).toBe(1);
  });

  test("commit error mode returns 400", async () => {
    const res = await request(app)
      .post("/api/topic-past-papers/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey, items: [{ title: "Skip Test", url: "https://example.com/skip.pdf", year: 2019 }], dedupeMode: "error" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/duplicates|dedupeMode/);
  });

  test("AQA URL import sets officialSource and officialHost", async () => {
    const bulkRes = await request(app)
      .post("/api/topic-past-papers/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        items: [{ title: "AQA Bio Paper", url: "https://www.aqa.org.uk/resources/science/gcse/biology/teach/example-paper.pdf" }],
      });
    expect(bulkRes.status).toBe(200);
    expect(bulkRes.body.createdCount).toBe(1);
    const created = await TopicPastPaper.findById(bulkRes.body.createdIds[0]).lean();
    expect(created).toBeDefined();
    expect(created.officialSource).toBe(true);
    expect(created.officialHost).toBe("aqa.org.uk");
  });

  test("CSV parsing with tags", async () => {
    const csv = `title,url,year,paper,tags
AQA Bio Paper 1,https://example.com/a.pdf,2019,Paper 1,tag1|tag2
Another Paper,https://example.com/b.pdf,2020,Paper 2,biology`;

    const res = await request(app)
      .post("/api/topic-past-papers/bulk/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topicKey: "cell-structure", format: "csv", text: csv });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.summary.validCount).toBe(2);
    expect(res.body.previewItems[0].title).toBe("AQA Bio Paper 1");
  });
});
