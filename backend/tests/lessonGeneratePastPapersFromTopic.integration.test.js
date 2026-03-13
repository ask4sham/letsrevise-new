/**
 * PR-PP2: Generate past papers from topic bank into lesson — integration tests.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const TopicPastPaper = require("../models/TopicPastPaper");
const FileAsset = require("../models/FileAsset");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Generate Past Papers from Topic Bank (PR-PP2)", () => {
  let teacherToken;
  let teacherId;
  let otherTeacherToken;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "PPGen",
      lastName: "Teacher",
      email: "ppgen-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const otherTeacher = await User.create({
      firstName: "Other",
      lastName: "Teacher",
      email: "ppgen-other@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const loginTeacher = await request(app)
      .post("/api/auth/login")
      .send({ email: "ppgen-teacher@test.com", password: "password123" });
    teacherToken = loginTeacher.body?.token;
    const loginOther = await request(app)
      .post("/api/auth/login")
      .send({ email: "ppgen-other@test.com", password: "password123" });
    otherTeacherToken = loginOther.body?.token;
    if (!teacherToken || !otherTeacherToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    await TopicPastPaper.deleteMany({ ownerId: teacherId });
  });

  test("published-only: only published items copied", async () => {
    const topicKey = "diffusion";
    const bulkRes = await request(app)
      .post("/api/topic-past-papers/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        items: [
          { title: "Draft Paper", url: "https://example.com/draft.pdf" },
          { title: "Published Paper", url: "https://example.com/pub.pdf" },
        ],
      });
    expect(bulkRes.status).toBe(200);
    const ids = bulkRes.body.createdIds;
    expect(ids.length).toBe(2);
    await request(app)
      .post(`/api/topic-past-papers/${ids[1]}/publish`)
      .set("Authorization", `Bearer ${teacherToken}`);

    const lesson = await Lesson.create({
      title: "PP gen lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "PPGen Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Diffusion",
      topicKey,
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      pastPapers: [],
    });

    const genRes = await request(app)
      .post(`/api/lessons/${lesson._id}/generate/past-papers-from-topic`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(genRes.status).toBe(200);
    expect(genRes.body.ok).toBe(true);
    expect(genRes.body.addedCount).toBe(1);
    expect(genRes.body.pastPapersCount).toBe(1);

    const getRes = await request(app)
      .get(`/api/lessons/${lesson._id}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body.pastPapers)).toBe(true);
    expect(getRes.body.pastPapers.length).toBe(1);
    expect(getRes.body.pastPapers[0].title).toBe("Published Paper");
    expect(getRes.body.pastPapers[0].sourceType).toBe("url");
    expect(getRes.body.pastPapers[0].url).toBe("https://example.com/pub.pdf");
  });

  test("AQA URL in bank -> lesson gets officialSource and officialHost", async () => {
    const topicKey = "respiration";
    const bulkRes = await request(app)
      .post("/api/topic-past-papers/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        items: [{ title: "AQA Official", url: "https://www.aqa.org.uk/resources/science/gcse/biology/assess/paper1.pdf" }],
      });
    expect(bulkRes.status).toBe(200);
    await request(app)
      .post(`/api/topic-past-papers/${bulkRes.body.createdIds[0]}/publish`)
      .set("Authorization", `Bearer ${teacherToken}`);

    const lesson = await Lesson.create({
      title: "AQA PP lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "PPGen Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Respiration",
      topicKey,
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      pastPapers: [],
    });

    const genRes = await request(app)
      .post(`/api/lessons/${lesson._id}/generate/past-papers-from-topic`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(genRes.status).toBe(200);
    expect(genRes.body.pastPapersCount).toBe(1);

    const getRes = await request(app)
      .get(`/api/lessons/${lesson._id}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(getRes.body.pastPapers[0].officialSource).toBe(true);
    expect(getRes.body.pastPapers[0].officialHost).toBe("aqa.org.uk");
  });

  test("draft-only bank -> 0 added", async () => {
    const topicKey = "osmosis";
    const bulkRes = await request(app)
      .post("/api/topic-past-papers/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        items: [{ title: "Draft Only", url: "https://example.com/draft.pdf" }],
      });
    expect(bulkRes.status).toBe(200);

    const lesson = await Lesson.create({
      title: "Draft only PP lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "PPGen Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Osmosis",
      topicKey,
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      pastPapers: [],
    });

    const genRes = await request(app)
      .post(`/api/lessons/${lesson._id}/generate/past-papers-from-topic`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(genRes.status).toBe(200);
    expect(genRes.body.addedCount).toBe(0);
    expect(genRes.body.pastPapersCount).toBe(0);

    const getRes = await request(app)
      .get(`/api/lessons/${lesson._id}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(Array.isArray(getRes.body.pastPapers)).toBe(true);
    expect(getRes.body.pastPapers.length).toBe(0);
  });

  test("replace semantics: overwrites existing", async () => {
    const topicKey = "cell-structure";
    const bulkRes = await request(app)
      .post("/api/topic-past-papers/bulk")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topicKey,
        items: [
          { title: "Bank A", url: "https://example.com/a.pdf" },
          { title: "Bank B", url: "https://example.com/b.pdf" },
        ],
      });
    expect(bulkRes.status).toBe(200);
    for (const id of bulkRes.body.createdIds) {
      await request(app)
        .post(`/api/topic-past-papers/${id}/publish`)
        .set("Authorization", `Bearer ${teacherToken}`);
    }

    const lesson = await Lesson.create({
      title: "Replace PP lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "PPGen Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Cell structure",
      topicKey,
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      pastPapers: [{ title: "Manual entry", sourceType: "url", url: "https://manual.com/x.pdf" }],
    });

    const genRes = await request(app)
      .post(`/api/lessons/${lesson._id}/generate/past-papers-from-topic`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(genRes.status).toBe(200);
    expect(genRes.body.addedCount).toBe(2);
    expect(genRes.body.pastPapersCount).toBe(2);

    const getRes = await request(app)
      .get(`/api/lessons/${lesson._id}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(getRes.body.pastPapers.length).toBe(2);
    expect(getRes.body.pastPapers.some((p) => p.title === "Manual entry")).toBe(false);
    expect(getRes.body.pastPapers.some((p) => p.title === "Bank A")).toBe(true);
    expect(getRes.body.pastPapers.some((p) => p.title === "Bank B")).toBe(true);
  });

  test("no topicKey -> 400", async () => {
    const lesson = await Lesson.create({
      title: "No topic lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "PPGen Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: ".",
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      pastPapers: [],
    });
    await Lesson.updateOne({ _id: lesson._id }, { $unset: { topicKey: 1 } });

    const genRes = await request(app)
      .post(`/api/lessons/${lesson._id}/generate/past-papers-from-topic`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(genRes.status).toBe(400);
    expect(genRes.body.msg).toMatch(/topicKey|topic/);
  });

  test("teacher B (not owner) -> 404", async () => {
    const topicKey = "microscopy";
    const lesson = await Lesson.create({
      title: "Owner PP lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "PPGen Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Microscopy",
      topicKey,
      status: "draft",
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [] }],
      pastPapers: [],
    });

    const genRes = await request(app)
      .post(`/api/lessons/${lesson._id}/generate/past-papers-from-topic`)
      .set("Authorization", `Bearer ${otherTeacherToken}`);
    expect(genRes.status).toBe(404);
  });
});
