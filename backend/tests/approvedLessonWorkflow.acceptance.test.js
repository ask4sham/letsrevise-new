/**
 * End-to-end acceptance — approved lesson publishing workflow v1.
 * Maps to manual Tests 1–5 (Sham → Admin → Sham → Rachel → Student).
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");

describe("Approved lesson workflow acceptance (manual Tests 1–5)", () => {
  let shamId;
  let rachelId;
  let adminId;
  let studentId;
  let lessonId;
  let tokenSham;
  let tokenRachel;
  let tokenAdmin;
  let tokenStudent;
  const ts = Date.now();
  const hash = bcrypt.hashSync("password123", 10);

  const login = (email) =>
    request(app).post("/api/auth/login").send({ email, password: "password123" }).then((r) => r.body.token);

  beforeAll(async () => {
    const sham = await User.create({
      firstName: "Sham",
      lastName: "Creator",
      email: `wf-sham-${ts}@test.com`,
      password: hash,
      userType: "teacher",
    });
    shamId = sham._id;

    const rachel = await User.create({
      firstName: "Rachel",
      lastName: "Teacher",
      email: `wf-rachel-${ts}@test.com`,
      password: hash,
      userType: "teacher",
    });
    rachelId = rachel._id;

    const admin = await User.create({
      firstName: "Workflow",
      lastName: "Admin",
      email: `wf-admin-${ts}@test.com`,
      password: hash,
      userType: "admin",
    });
    adminId = admin._id;

    const student = await User.create({
      firstName: "Test",
      lastName: "Student",
      email: `wf-student-${ts}@test.com`,
      password: hash,
      userType: "student",
      subscriptionV2: null,
      purchasedLessons: [],
    });
    studentId = student._id;

    tokenSham = await login(`wf-sham-${ts}@test.com`);
    tokenRachel = await login(`wf-rachel-${ts}@test.com`);
    tokenAdmin = await login(`wf-admin-${ts}@test.com`);
    tokenStudent = await login(`wf-student-${ts}@test.com`);

    const lesson = await Lesson.create({
      title: `Workflow Lesson ${ts}`,
      description: "Acceptance",
      content: "Content",
      teacherId: shamId,
      teacherName: "Sham Creator",
      subject: "Biology",
      level: "IGCSE",
      topic: "Photosynthesis",
      board: "Edexcel",
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "## Photosynthesis" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });
    lessonId = lesson._id;
  });

  test("Test 1 — Sham publishes and submits; My Lessons shows pending_review", async () => {
    const submit = await request(app)
      .post(`/api/lessons/${lessonId}/submit-for-approval`)
      .set("Authorization", `Bearer ${tokenSham}`);
    expect(submit.status).toBe(200);
    expect(submit.body.lesson.teacherLibraryStatus).toBe("pending_review");

    const list = await request(app).get("/api/lessons/teacher").set("Authorization", `Bearer ${tokenSham}`);
    const row = (list.body || []).find((l) => String(l._id) === String(lessonId));
    expect(row?.teacherLibrary?.status).toBe("pending_review");
  });

  test("Test 2 — Admin sees pending, previews structured lesson, approves", async () => {
    const pending = await request(app)
      .get("/api/lessons/catalogue-approvals?status=pending")
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(pending.body.lessons.some((l) => String(l._id) === String(lessonId))).toBe(true);

    const preview = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(preview.status).toBe(200);
    expect(Array.isArray(preview.body.pages)).toBe(true);

    const approve = await request(app)
      .post(`/api/lessons/${lessonId}/approve-for-catalogue`)
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(approve.status).toBe(200);
    expect(approve.body.lesson.teacherLibraryStatus).toBe("approved");
  });

  test("Test 3 — Sham My Lessons shows approved + Version 1", async () => {
    const list = await request(app).get("/api/lessons/teacher").set("Authorization", `Bearer ${tokenSham}`);
    const row = (list.body || []).find((l) => String(l._id) === String(lessonId));
    expect(row?.teacherLibrary?.status).toBe("approved");
    expect(row?.teacherLibrary?.version).toBe(1);
  });

  test("Test 4 — Rachel: catalogue, preview, classroom; cannot edit/publish", async () => {
    const catalogue = await request(app)
      .get("/api/lessons/approved-lessons")
      .set("Authorization", `Bearer ${tokenRachel}`);
    expect(catalogue.body.lessons.some((l) => String(l._id) === String(lessonId))).toBe(true);

    const preview = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${tokenRachel}`);
    expect(preview.body.accessDecision?.reason).toBe("APPROVED_PREVIEW");

    const classroom = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .query({ present: "classroom" })
      .set("Authorization", `Bearer ${tokenRachel}`);
    expect(classroom.body.accessDecision?.reason).toBe("APPROVED_TEACH");

    const edit = await request(app)
      .put(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${tokenRachel}`)
      .send({ title: "Hijack" });
    expect([401, 403]).toContain(edit.status);

    const unpublish = await request(app)
      .patch(`/api/lessons/${lessonId}/publish`)
      .set("Authorization", `Bearer ${tokenRachel}`)
      .send({ isPublished: false });
    expect([401, 403]).toContain(unpublish.status);
  });

  test("Test 5 — Student access unchanged", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}`)
      .set("Authorization", `Bearer ${tokenStudent}`);
    expect([200, 402, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(["APPROVED_PREVIEW", "APPROVED_TEACH"]).not.toContain(res.body.accessDecision?.reason);
    }
  });
});
