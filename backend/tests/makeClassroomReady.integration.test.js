/**
 * PR20: POST /api/reports/lessons/:lessonId/make-classroom-ready
 * One-click: attach practice, ensure diagram, regenerate plan, mark reviewed.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");
const VisualModel = require("../models/VisualModel");

const hashedPassword = bcrypt.hashSync("password123", 10);

jest.setTimeout(20000);

describe("POST /api/reports/lessons/:lessonId/make-classroom-ready", () => {
  let ownerId;
  let otherTeacherId;
  let ownerToken;
  let otherToken;
  let lessonId;
  let lessonUnmappedId;
  let lessonNoDiagramId;
  let visualId;
  let prevDisable;

  beforeAll(async () => {
    prevDisable = process.env.DISABLE_OPENAI;
    process.env.DISABLE_OPENAI = "1";

    const owner = await User.create({
      firstName: "MCR",
      lastName: "Owner",
      email: "mcr-owner@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    ownerId = owner._id;

    const other = await User.create({
      firstName: "Other",
      lastName: "Teacher",
      email: "mcr-other@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    otherTeacherId = other._id;

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    ownerToken = await login("mcr-owner@test.com");
    otherToken = await login("mcr-other@test.com");

    const lesson = await Lesson.create({
      title: "MCR Lesson",
      description: "D",
      content: "C",
      teacherId: ownerId,
      teacherName: "MCR Owner",
      subject: "Biology",
      level: "GCSE",
      topic: "Photosynthesis",
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", title: "P1", order: 0, blocks: [] }],
      examQuestions: [],
    });
    lessonId = lesson._id;

    const lessonUnmapped = await Lesson.create({
      title: "Unmapped",
      description: "D",
      content: "C",
      teacherId: ownerId,
      teacherName: "Owner",
      subject: "Biology",
      level: "GCSE",
      topic: "Some Random Topic Not In Taxonomy",
      status: "draft",
      pages: [],
      examQuestions: [],
    });
    lessonUnmappedId = lessonUnmapped._id;

    const lessonNoDiagram = await Lesson.create({
      title: "No Diagram Yet",
      description: "D",
      content: "C",
      teacherId: ownerId,
      teacherName: "Owner",
      subject: "Biology",
      level: "GCSE",
      topic: "Photosynthesis",
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", title: "P1", order: 0, blocks: [{ type: "text", content: "Intro" }] }],
      examQuestions: [],
    });
    lessonNoDiagramId = lessonNoDiagram._id;

    const visual = await VisualModel.create({
      conceptKey: "photosynthesis",
      subject: "Biology",
      topic: "Photosynthesis",
      isPublished: true,
      variants: [{ level: "GCSE", type: "staticDiagram", src: "/visuals/photosynthesis.svg" }],
    });
    visualId = visual._id;

    for (let i = 0; i < 5; i++) {
      await ExamQuestion.create({
        teacherId: ownerId,
        subject: "Biology",
        type: "mcq",
        question: `MCR Q ${i}?`,
        topicKey: "photosynthesis",
        marks: 2,
        status: "published",
      });
    }
  });

  afterAll(() => {
    if (prevDisable === undefined) delete process.env.DISABLE_OPENAI;
    else process.env.DISABLE_OPENAI = prevDisable;
  });

  test("401 without auth", async () => {
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonId}/make-classroom-ready`)
      .send({});
    expect(res.status).toBe(401);
  });

  test("403 non-owner teacher", async () => {
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonId}/make-classroom-ready`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ attachPractice: true, ensureDiagram: false, regeneratePlan: true, markReviewed: false });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/owner|forbidden/i);
  });

  test("400 invalid topicKey", async () => {
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonId}/make-classroom-ready`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ topicKey: "not-a-valid-key-xyz", attachPractice: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("400 unmapped topic when attachPractice true and no topicKey", async () => {
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonUnmappedId}/make-classroom-ready`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ attachPractice: true, ensureDiagram: false, regeneratePlan: false, markReviewed: false });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/topic|taxonomy/i);
  });

  test("owner success: attachPractice true + ensureDiagram false + regeneratePlan true => 200, attach exists, plan NOT_CONFIGURED, no content", async () => {
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonId}/make-classroom-ready`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        days: 7,
        attachPractice: true,
        attachLimit: 10,
        ensureDiagram: false,
        regeneratePlan: true,
        planLimit: 10,
        markReviewed: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.lessonId).toBeDefined();
    expect(res.body.attach).toBeDefined();
    expect(typeof res.body.attach.requested).toBe("number");
    expect(typeof res.body.attach.added).toBe("number");
    expect(Array.isArray(res.body.attach.addedIds)).toBe(true);
    expect(res.body.plan).toBeDefined();
    expect(res.body.plan.status).toBe("NOT_CONFIGURED");
    expect(res.body.plan.content).toBeUndefined();
    expect(res.body.classroomNotes).toBeUndefined();
    expect(res.body.readiness).toBeDefined();
    expect(res.body.readiness.status).toBeDefined();
  });

  test("idempotency: second call attach.added === 0", async () => {
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonId}/make-classroom-ready`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        attachPractice: true,
        ensureDiagram: false,
        regeneratePlan: true,
        markReviewed: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.attach.added).toBe(0);
  });

  test("ensureDiagram: when lesson has no diagram and VisualModel exists => ATTACHED and lesson has diagram block", async () => {
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonNoDiagramId}/make-classroom-ready`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        attachPractice: false,
        ensureDiagram: true,
        regeneratePlan: false,
        markReviewed: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.diagram).toBeDefined();
    expect(res.body.diagram.status).toBe("ATTACHED");
    expect(res.body.diagram.visualId).toBeDefined();

    const updated = await Lesson.findById(lessonNoDiagramId).select("pages").lean();
    const hasDiagram = (updated.pages || []).some(
      (p) => Array.isArray(p.blocks) && p.blocks.some((b) => b && b.type === "diagram")
    );
    expect(hasDiagram).toBe(true);
  });

  test("ensureDiagram: second call with diagram already present => ALREADY_PRESENT", async () => {
    const res = await request(app)
      .post(`/api/reports/lessons/${lessonNoDiagramId}/make-classroom-ready`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        attachPractice: false,
        ensureDiagram: true,
        regeneratePlan: false,
        markReviewed: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.diagram.status).toBe("ALREADY_PRESENT");
  });
});
