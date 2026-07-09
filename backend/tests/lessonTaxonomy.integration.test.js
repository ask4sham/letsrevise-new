/**
 * PR-TAXONOMY: Lesson creation and update persist full taxonomy mapping.
 * - Manual creation (POST /api/lessons) with topicKey → specKey, mainTopic, subTopic saved
 * - Clone-gold template → topicKey, specKey, mainTopic, subTopic on template
 * - PUT update with topicKey → specKey derived and persisted
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("Lesson taxonomy (PR-TAXONOMY)", () => {
  let teacherToken;
  let teacherId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Taxonomy",
      lastName: "Teacher",
      email: "taxonomy-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "taxonomy-teacher@test.com", password: "password123" });
    teacherToken = loginRes.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  });

  afterAll(async () => {
    await Lesson.deleteMany({ teacherName: /Taxonomy/ });
  });

  test("POST /api/lessons with topicKey, specKey, mainTopic, subTopic → all persisted", async () => {
    const res = await request(app)
      .post("/api/lessons")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "Cell structure lesson",
        description: "Test",
        content: "Content",
        subject: "Biology",
        level: "GCSE",
        topic: "Cell structure",
        topicKey: "aqa-gcse-biology:cell-structure",
        specKey: "aqa-gcse-biology",
        mainTopic: "Cell Biology",
        subTopic: "Cell structure",
        estimatedDuration: 30,
        pages: [
          {
            pageId: "p1",
            title: "Page 1",
            order: 1,
            blocks: [{ type: "text", content: "Content" }],
          },
        ],
      });

    expect(res.status).toBe(200);
    const lesson = await Lesson.findById(res.body.lesson._id).lean();
    expect(lesson.topicKey).toBe("aqa-gcse-biology:cell-structure");
    expect(lesson.specKey).toBe("aqa-gcse-biology");
    expect(lesson.canonicalTopicKey).toBe("cell-structure");
    expect(lesson.mainTopic).toBe("Cell Biology");
    expect(lesson.subTopic).toBe("Cell structure");
  });

  test("POST /api/lessons Edexcel IGCSE Biology persists taxonomy contract", async () => {
    const res = await request(app)
      .post("/api/lessons")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "Roles of FSH & LH (Edexcel IGCSE)",
        description: "Test",
        content: "Content",
        subject: "Biology",
        level: "GCSE",
        board: "Edexcel",
        topic: "Roles of FSH & LH in the Menstrual Cycle",
        topicKey: "edexcel-igcse-biology:roles-of-fsh-and-lh-in-the-menstrual-cycle",
        specKey: "edexcel-igcse-biology",
        mainTopic: "Human Reproduction",
        subTopic: "Roles of FSH & LH in the Menstrual Cycle",
        estimatedDuration: 30,
        pages: [
          {
            pageId: "p1",
            title: "Page 1",
            order: 1,
            blocks: [{ type: "text", content: "Content" }],
          },
        ],
      });

    expect(res.status).toBe(200);
    const lesson = await Lesson.findById(res.body.lesson._id).lean();
    expect(lesson.topicKey).toBe(
      "edexcel-igcse-biology:roles-of-fsh-and-lh-in-the-menstrual-cycle"
    );
    expect(lesson.specKey).toBe("edexcel-igcse-biology");
    expect(lesson.canonicalTopicKey).toBe("roles-of-fsh-and-lh-in-the-menstrual-cycle");
    expect(lesson.board).toBe("Edexcel");
    expect(lesson.level).toBe("IGCSE");
  });

  test("PUT /api/lessons with topicKey → specKey derived and persisted", async () => {
    const lesson = await Lesson.create({
      title: "Unmapped lesson",
      description: "Test",
      content: "Content",
      teacherId,
      teacherName: "Taxonomy Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Animal and plant cells",
      status: "draft",
      isPublished: false,
      pages: [{ pageId: "p1", title: "Page 1", order: 1, blocks: [] }],
    });

    const res = await request(app)
      .put(`/api/lessons/${lesson._id}`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: lesson.title,
        description: lesson.description,
        subject: lesson.subject,
        level: lesson.level,
        topic: lesson.topic,
        topicKey: "aqa-gcse-biology:animal-plant-cells",
        board: "AQA",
        pages: lesson.pages,
      });

    expect(res.status).toBe(200);
    const updated = await Lesson.findById(lesson._id).lean();
    expect(updated.topicKey).toBe("aqa-gcse-biology:animal-plant-cells");
    expect(updated.specKey).toBe("aqa-gcse-biology");
  });

  test("clone-gold template has topicKey, specKey, mainTopic, subTopic", async () => {
    const res = await request(app)
      .post("/api/lessons/clone-gold")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({});

    expect(res.status).toBe(200);
    const lessonId = res.body.lessonId;
    expect(lessonId).toBeDefined();

    const lesson = await Lesson.findById(lessonId).lean();
    expect(lesson.topicKey).toBe("aqa-gcse-biology:photosynthesis");
    expect(lesson.specKey).toBe("aqa-gcse-biology");
    expect(lesson.mainTopic).toBe("Bioenergetics");
    expect(lesson.subTopic).toBe("Photosynthesis");
  });
});
