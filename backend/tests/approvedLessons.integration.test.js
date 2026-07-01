/**
 * approved-lessons-v1 — catalogue approval workflow, list API, APPROVED_* access.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const LessonApproval = require("../models/LessonApproval");
const LessonShare = require("../models/LessonShare");

describe("Approved Lessons V1", () => {
  let ownerId;
  let otherTeacherId;
  let studentId;
  let adminId;
  let publishedUnapprovedId;
  let catalogueLessonId;
  let tokenOwner;
  let tokenOther;
  let tokenStudent;
  let tokenAdmin;
  const hashedPassword = bcrypt.hashSync("password123", 10);
  const ts = Date.now();

  beforeAll(async () => {
    const owner = await User.create({
      firstName: "Sham",
      lastName: "Owner",
      email: `approved-owner-${ts}@test.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    ownerId = owner._id;

    const other = await User.create({
      firstName: "Other",
      lastName: "Teacher",
      email: `approved-other-${ts}@test.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    otherTeacherId = other._id;

    const student = await User.create({
      firstName: "Approved",
      lastName: "Student",
      email: `approved-student-${ts}@test.com`,
      password: hashedPassword,
      userType: "student",
      subscriptionV2: null,
      purchasedLessons: [],
    });
    studentId = student._id;

    const admin = await User.create({
      firstName: "Approved",
      lastName: "Admin",
      email: `approved-admin-${ts}@test.com`,
      password: hashedPassword,
      userType: "admin",
    });
    adminId = admin._id;

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    tokenOwner = await login(`approved-owner-${ts}@test.com`);
    tokenOther = await login(`approved-other-${ts}@test.com`);
    tokenStudent = await login(`approved-student-${ts}@test.com`);
    tokenAdmin = await login(`approved-admin-${ts}@test.com`);

    const publishedUnapproved = await Lesson.create({
      title: "Published Not Approved",
      description: "Should not appear in approved catalogue",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Sham Owner",
      subject: "Biology",
      level: "IGCSE",
      topic: "Cells",
      board: "Edexcel",
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "Cells" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });
    publishedUnapprovedId = publishedUnapproved._id;

    const catalogueLesson = await Lesson.create({
      title: "Photosynthesis Approved",
      description: "Catalogue candidate",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Sham Owner",
      subject: "Biology",
      level: "IGCSE",
      topic: "Photosynthesis",
      board: "Edexcel",
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "Light reaction" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });
    catalogueLessonId = catalogueLesson._id;
  });

  test("owner submits published lesson for catalogue approval", async () => {
    const res = await request(app)
      .post(`/api/lessons/${catalogueLessonId}/submit-for-approval`)
      .set("Authorization", `Bearer ${tokenOwner}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.lesson.teacherLibraryStatus).toBe("pending_review");

    const lesson = await Lesson.findById(catalogueLessonId).lean();
    expect(lesson.teacherLibrary.status).toBe("pending_review");

    const audit = await LessonApproval.findOne({ lessonId: catalogueLessonId, action: "submitted" });
    expect(audit).toBeTruthy();
  });

  test("pending lesson is not in approved catalogue list", async () => {
    const res = await request(app)
      .get("/api/lessons/approved-lessons")
      .set("Authorization", `Bearer ${tokenOther}`);
    expect(res.status).toBe(200);
    const ids = (res.body.lessons || []).map((l) => String(l._id));
    expect(ids).not.toContain(String(catalogueLessonId));
    expect(ids).not.toContain(String(publishedUnapprovedId));
  });

  test("admin sees pending submission in catalogue-approvals queue", async () => {
    const res = await request(app)
      .get("/api/lessons/catalogue-approvals?status=pending")
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.lessons.some((l) => String(l._id) === String(catalogueLessonId))).toBe(true);
  });

  test("admin approves lesson for catalogue", async () => {
    const res = await request(app)
      .post(`/api/lessons/${catalogueLessonId}/approve-for-catalogue`)
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(res.status).toBe(200);
    expect(res.body.lesson.teacherLibraryStatus).toBe("approved");

    const audit = await LessonApproval.findOne({ lessonId: catalogueLessonId, action: "approved" });
    expect(audit).toBeTruthy();
  });

  test("approved published lesson appears in approved-lessons list", async () => {
    const res = await request(app)
      .get("/api/lessons/approved-lessons")
      .set("Authorization", `Bearer ${tokenOther}`);
    expect(res.status).toBe(200);
    const match = (res.body.lessons || []).find((l) => String(l._id) === String(catalogueLessonId));
    expect(match).toBeTruthy();
    expect(match.letsReviseApproved).toBe(true);
    expect(match.topic).toMatch(/Photosynthesis/i);
  });

  test("published but unapproved lesson never appears in approved-lessons list", async () => {
    const res = await request(app)
      .get("/api/lessons/approved-lessons")
      .set("Authorization", `Bearer ${tokenOther}`);
    const ids = (res.body.lessons || []).map((l) => String(l._id));
    expect(ids).not.toContain(String(publishedUnapprovedId));
  });

  test("other teacher gets APPROVED_PREVIEW on lesson view", async () => {
    const res = await request(app)
      .get(`/api/lessons/${catalogueLessonId}`)
      .set("Authorization", `Bearer ${tokenOther}`);
    expect(res.status).toBe(200);
    expect(res.body.accessDecision?.reason).toBe("APPROVED_PREVIEW");
  });

  test("other teacher gets APPROVED_TEACH in classroom mode", async () => {
    const res = await request(app)
      .get(`/api/lessons/${catalogueLessonId}`)
      .query({ present: "classroom" })
      .set("Authorization", `Bearer ${tokenOther}`);
    expect(res.status).toBe(200);
    expect(res.body.accessDecision?.reason).toBe("APPROVED_TEACH");
  });

  test("student access to published lesson is unchanged", async () => {
    const res = await request(app)
      .get(`/api/lessons/${catalogueLessonId}`)
      .set("Authorization", `Bearer ${tokenStudent}`);
    expect([200, 402, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(["NOT_ENTITLED", "FREE_PREVIEW", "SUB_ACTIVE", "PURCHASED", "LESSON_UNLOCK"]).toContain(
        res.body.accessDecision?.reason
      );
    }
  });

  test("admin retires approved lesson and it disappears from catalogue", async () => {
    const retireRes = await request(app)
      .post(`/api/lessons/${catalogueLessonId}/retire-from-catalogue`)
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(retireRes.status).toBe(200);
    expect(retireRes.body.lesson.teacherLibraryStatus).toBe("retired");

    const listRes = await request(app)
      .get("/api/lessons/approved-lessons")
      .set("Authorization", `Bearer ${tokenOther}`);
    const ids = (listRes.body.lessons || []).map((l) => String(l._id));
    expect(ids).not.toContain(String(catalogueLessonId));
  });

  test("reject flow returns lesson to rejected state", async () => {
    const draftLesson = await Lesson.create({
      title: "Reject Me",
      description: "Reject test",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Sham Owner",
      subject: "Biology",
      level: "IGCSE",
      topic: "Enzymes",
      board: "Edexcel",
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "Enzyme" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });

    await request(app)
      .post(`/api/lessons/${draftLesson._id}/submit-for-approval`)
      .set("Authorization", `Bearer ${tokenOwner}`);

    const rejectRes = await request(app)
      .post(`/api/lessons/${draftLesson._id}/reject-for-catalogue`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ notes: "Needs more diagrams" });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.lesson.teacherLibraryStatus).toBe("rejected");
    expect(rejectRes.body.lesson.rejectionNotes).toMatch(/diagrams/i);

    const updated = await Lesson.findById(draftLesson._id).lean();
    expect(updated.teacherLibrary.status).toBe("rejected");
  });

  test("SHARED_TEACH still takes precedence over approved catalogue access", async () => {
    const sharedLesson = await Lesson.create({
      title: "Shared Draft For Teach",
      description: "Share precedence",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Sham Owner",
      subject: "Biology",
      level: "IGCSE",
      topic: "Diffusion",
      board: "Edexcel",
      status: "draft",
      isPublished: false,
      teacherLibrary: { status: "approved" },
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "Diffusion" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });

    await LessonShare.create({
      lessonId: sharedLesson._id,
      teacherId: otherTeacherId,
      sharedBy: ownerId,
      permission: "TEACH",
      status: "active",
      sharedAt: new Date(),
    });

    const res = await request(app)
      .get(`/api/lessons/${sharedLesson._id}`)
      .query({ present: "classroom" })
      .set("Authorization", `Bearer ${tokenOther}`);
    expect(res.status).toBe(200);
    expect(res.body.accessDecision?.reason).toBe("SHARED_TEACH");
  });

  test("non-owner cannot submit for approval", async () => {
    const res = await request(app)
      .post(`/api/lessons/${publishedUnapprovedId}/submit-for-approval`)
      .set("Authorization", `Bearer ${tokenOther}`);
    expect(res.status).toBe(403);
  });

  test("editing an approved lesson returns it to pending_review (Option A)", async () => {
    const editLesson = await Lesson.create({
      title: "Edit After Approve",
      description: "Re-review on edit",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Sham Owner",
      subject: "Biology",
      level: "IGCSE",
      topic: "Enzymes",
      board: "Edexcel",
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "Enzyme v1" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });

    await request(app)
      .post(`/api/lessons/${editLesson._id}/submit-for-approval`)
      .set("Authorization", `Bearer ${tokenOwner}`);
    await request(app)
      .post(`/api/lessons/${editLesson._id}/approve-for-catalogue`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    let listRes = await request(app)
      .get("/api/lessons/approved-lessons")
      .set("Authorization", `Bearer ${tokenOther}`);
    expect(listRes.body.lessons.some((l) => String(l._id) === String(editLesson._id))).toBe(true);

    await request(app)
      .post(`/api/lessons/${editLesson._id}/unpublish`)
      .set("Authorization", `Bearer ${tokenOwner}`);

    const updated = await Lesson.findById(editLesson._id).lean();
    expect(updated.teacherLibrary.status).toBe("pending_review");

    listRes = await request(app)
      .get("/api/lessons/approved-lessons")
      .set("Authorization", `Bearer ${tokenOther}`);
    expect(listRes.body.lessons.some((l) => String(l._id) === String(editLesson._id))).toBe(false);

    const audit = await LessonApproval.findOne({
      lessonId: editLesson._id,
      action: "resubmitted",
    });
    expect(audit).toBeTruthy();
  });

  test("catalogue version increments on approval", async () => {
    const versionLesson = await Lesson.create({
      title: "Version Test",
      description: "Version",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Sham Owner",
      subject: "Biology",
      level: "IGCSE",
      topic: "Cells",
      board: "Edexcel",
      status: "published",
      isPublished: true,
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "Cell" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });

    await request(app)
      .post(`/api/lessons/${versionLesson._id}/submit-for-approval`)
      .set("Authorization", `Bearer ${tokenOwner}`);
    await request(app)
      .post(`/api/lessons/${versionLesson._id}/approve-for-catalogue`)
      .set("Authorization", `Bearer ${tokenAdmin}`);

    const after = await Lesson.findById(versionLesson._id).lean();
    expect(after.teacherLibrary.version).toBe(1);
    expect(after.teacherLibrary.approvedBy).toBeTruthy();
    expect(after.teacherLibrary.approvedAt).toBeTruthy();
  });
});
