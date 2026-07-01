/**
 * teacher-library-admin-v1 — admin catalogue tabs, summary counts, sort.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");

describe("Teacher Library Admin V1", () => {
  let ownerId;
  let adminId;
  let teacherId;
  let tokenAdmin;
  let tokenTeacher;
  let tokenOwner;
  const ts = Date.now();
  const hashedPassword = bcrypt.hashSync("password123", 10);

  beforeAll(async () => {
    const owner = await User.create({
      firstName: "Lib",
      lastName: "Owner",
      email: `tl-admin-owner-${ts}@test.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    ownerId = owner._id;

    const admin = await User.create({
      firstName: "Lib",
      lastName: "Admin",
      email: `tl-admin-admin-${ts}@test.com`,
      password: hashedPassword,
      userType: "admin",
    });
    adminId = admin._id;

    const teacher = await User.create({
      firstName: "Lib",
      lastName: "Teacher",
      email: `tl-admin-teacher-${ts}@test.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    tokenOwner = await login(`tl-admin-owner-${ts}@test.com`);
    tokenAdmin = await login(`tl-admin-admin-${ts}@test.com`);
    tokenTeacher = await login(`tl-admin-teacher-${ts}@test.com`);
  });

  async function seedLesson(title, libraryStatus, extra = {}) {
    return Lesson.create({
      title,
      description: "Admin library test",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Lib Owner",
      subject: "Biology",
      level: "IGCSE",
      topic: "Cells",
      board: "Edexcel",
      status: "published",
      isPublished: true,
      teacherLibrary: {
        status: libraryStatus,
        submittedAt: libraryStatus === "pending_review" ? new Date() : null,
        approvedAt: libraryStatus === "approved" ? new Date() : null,
        approvedBy: libraryStatus === "approved" ? adminId : null,
        version: libraryStatus === "approved" ? 1 : null,
        rejectedAt: libraryStatus === "rejected" ? new Date() : null,
        rejectionNotes: libraryStatus === "rejected" ? "Needs work" : "",
        retiredAt: libraryStatus === "retired" ? new Date() : null,
      },
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "x" }] }],
      quiz: { questions: [] },
      flashcards: [],
      ...extra,
    });
  }

  test("admin gets summary counts by catalogue status", async () => {
    await seedLesson(`Pending ${ts}`, "pending_review");
    await seedLesson(`Approved ${ts}`, "approved");
    await seedLesson(`Rejected ${ts}`, "rejected");
    await seedLesson(`Retired ${ts}`, "retired");

    const res = await request(app)
      .get("/api/lessons/catalogue-approvals/summary")
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.counts.pending).toBeGreaterThanOrEqual(1);
    expect(res.body.counts.approved).toBeGreaterThanOrEqual(1);
    expect(res.body.counts.rejected).toBeGreaterThanOrEqual(1);
    expect(res.body.counts.retired).toBeGreaterThanOrEqual(1);
  });

  test("admin lists lessons by tab status", async () => {
    const pending = await seedLesson(`Tab Pending ${ts}`, "pending_review");
    const res = await request(app)
      .get("/api/lessons/catalogue-approvals?status=pending")
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pending_review");
    expect(res.body.lessons.some((l) => String(l._id) === String(pending._id))).toBe(true);
    expect(res.body.lessons[0].submittedAt).toBeTruthy();
  });

  test("pending list supports oldest-first sort", async () => {
    const res = await request(app)
      .get("/api/lessons/catalogue-approvals?status=pending&sort=oldest")
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.lessons.length).toBeGreaterThan(0);
  });

  test("non-admin cannot access admin teacher library endpoints", async () => {
    const summary = await request(app)
      .get("/api/lessons/catalogue-approvals/summary")
      .set("Authorization", `Bearer ${tokenTeacher}`);
    expect(summary.status).toBe(403);

    const list = await request(app)
      .get("/api/lessons/catalogue-approvals?status=approved")
      .set("Authorization", `Bearer ${tokenTeacher}`);
    expect(list.status).toBe(403);
  });

  test("admin approve and reject from API update tabs", async () => {
    const lesson = await seedLesson(`Workflow ${ts}`, "pending_review");

    const approveRes = await request(app)
      .post(`/api/lessons/${lesson._id}/approve-for-catalogue`)
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(approveRes.status).toBe(200);

    const approvedList = await request(app)
      .get("/api/lessons/catalogue-approvals?status=approved")
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(approvedList.body.lessons.some((l) => String(l._id) === String(lesson._id))).toBe(true);

    const retireRes = await request(app)
      .post(`/api/lessons/${lesson._id}/retire-from-catalogue`)
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(retireRes.status).toBe(200);

    const rejectLesson = await seedLesson(`Reject Me ${ts}`, "pending_review");
    const rejectRes = await request(app)
      .post(`/api/lessons/${rejectLesson._id}/reject-for-catalogue`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ notes: "Missing diagrams" });
    expect(rejectRes.status).toBe(200);

    const rejectedList = await request(app)
      .get("/api/lessons/catalogue-approvals?status=rejected")
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(rejectedList.body.lessons.some((l) => String(l._id) === String(rejectLesson._id))).toBe(true);
  });
});
