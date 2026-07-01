/**
 * Lesson sharing is independent of publishing — VIEW/TEACH work on draft/in_review;
 * students never see drafts; archived lessons cannot be shared or accessed via share.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const LessonShare = require("../models/LessonShare");

describe("Lesson share publishing rules", () => {
  let ownerId;
  let rachelId;
  let studentId;
  let draftLessonId;
  let inReviewLessonId;
  let publishedLessonId;
  let archivedLessonId;
  let tokenOwner;
  let tokenRachel;
  let tokenStudent;
  const hashedPassword = bcrypt.hashSync("password123", 10);
  const ts = Date.now();

  beforeAll(async () => {
    const owner = await User.create({
      firstName: "Sham",
      lastName: "Owner",
      email: `pub-rules-owner-${ts}@test.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    ownerId = owner._id;

    const rachel = await User.create({
      firstName: "Rachel",
      lastName: "Young",
      email: `pub-rules-rachel-${ts}@test.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    rachelId = rachel._id;

    const student = await User.create({
      firstName: "Pub",
      lastName: "Student",
      email: `pub-rules-student-${ts}@test.com`,
      password: hashedPassword,
      userType: "student",
      subscriptionV2: null,
      purchasedLessons: [],
    });
    studentId = student._id;

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    tokenOwner = await login(`pub-rules-owner-${ts}@test.com`);
    tokenRachel = await login(`pub-rules-rachel-${ts}@test.com`);
    tokenStudent = await login(`pub-rules-student-${ts}@test.com`);

    const draftLesson = await Lesson.create({
      title: "Draft Shared Lesson",
      description: "Draft",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Sham Owner",
      subject: "Biology",
      level: "IGCSE",
      topic: "Draft Topic",
      board: "Edexcel",
      status: "draft",
      isPublished: false,
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "Draft body" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });
    draftLessonId = draftLesson._id;

    const inReviewLesson = await Lesson.create({
      title: "In Review Shared Lesson",
      description: "In review",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Sham Owner",
      subject: "Biology",
      level: "IGCSE",
      topic: "In Review Topic",
      board: "Edexcel",
      status: "in_review",
      isPublished: false,
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "Review body" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });
    inReviewLessonId = inReviewLesson._id;

    const publishedLesson = await Lesson.create({
      title: "Published Shared Lesson",
      description: "Published",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Sham Owner",
      subject: "Biology",
      level: "IGCSE",
      topic: "Published Topic",
      board: "Edexcel",
      status: "published",
      isPublished: true,
      isFreePreview: false,
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "Published body" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });
    publishedLessonId = publishedLesson._id;

    const archivedLesson = await Lesson.create({
      title: "Archived Lesson",
      description: "Archived",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Sham Owner",
      subject: "Biology",
      level: "IGCSE",
      topic: "Archived Topic",
      board: "Edexcel",
      status: "archived",
      isPublished: false,
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "Archived body" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });
    archivedLessonId = archivedLesson._id;
  });

  test("owner shares draft lesson with Rachel as VIEW and Rachel can review it", async () => {
    const shareRes = await request(app)
      .post(`/api/lessons/${draftLessonId}/shares`)
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ email: `pub-rules-rachel-${ts}@test.com`, permission: "VIEW" });
    expect(shareRes.status).toBe(201);
    expect(shareRes.body.share.permission).toBe("VIEW");

    const lessonRes = await request(app)
      .get(`/api/lessons/${draftLessonId}`)
      .set("Authorization", `Bearer ${tokenRachel}`);
    expect(lessonRes.status).toBe(200);
    expect(lessonRes.body.accessDecision?.reason).toBe("SHARED_REVIEW");

    const reviewList = await request(app)
      .get("/api/lessons/review-requests")
      .set("Authorization", `Bearer ${tokenRachel}`);
    expect(reviewList.body.some((l) => String(l._id) === String(draftLessonId))).toBe(true);
  });

  test("owner shares draft lesson with Rachel as TEACH and Rachel can start classroom mode", async () => {
    const shareRes = await request(app)
      .post(`/api/lessons/${draftLessonId}/shares`)
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ teacherId: String(rachelId), permission: "TEACH" });
    expect(shareRes.status).toBe(201);
    expect(shareRes.body.share.permission).toBe("TEACH");

    const classroomRes = await request(app)
      .get(`/api/lessons/${draftLessonId}`)
      .query({ present: "classroom" })
      .set("Authorization", `Bearer ${tokenRachel}`);
    expect(classroomRes.status).toBe(200);
    expect(classroomRes.body.accessDecision?.reason).toBe("SHARED_TEACH");

    const libraryRes = await request(app)
      .get("/api/lessons/teaching-library")
      .set("Authorization", `Bearer ${tokenRachel}`);
    expect(libraryRes.body.some((l) => String(l._id) === String(draftLessonId))).toBe(true);
  });

  test("in_review lesson can be shared for VIEW and TEACH", async () => {
    const viewRes = await request(app)
      .post(`/api/lessons/${inReviewLessonId}/shares`)
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ teacherId: String(rachelId), permission: "VIEW" });
    expect(viewRes.status).toBe(201);

    await LessonShare.deleteOne({ lessonId: inReviewLessonId, teacherId: rachelId });

    const teachRes = await request(app)
      .post(`/api/lessons/${inReviewLessonId}/shares`)
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ teacherId: String(rachelId), permission: "TEACH" });
    expect(teachRes.status).toBe(201);

    const openRes = await request(app)
      .get(`/api/lessons/${inReviewLessonId}`)
      .set("Authorization", `Bearer ${tokenRachel}`);
    expect(openRes.status).toBe(200);
    expect(openRes.body.accessDecision?.reason).toBe("SHARED_TEACH");
  });

  test("draft shared lesson does not appear in student catalogue", async () => {
    const listRes = await request(app)
      .get("/api/lessons/")
      .set("Authorization", `Bearer ${tokenStudent}`);
    expect(listRes.status).toBe(200);
    const lessons = Array.isArray(listRes.body) ? listRes.body : listRes.body.lessons || [];
    expect(lessons.some((l) => String(l._id) === String(draftLessonId))).toBe(false);
    expect(lessons.some((l) => String(l._id) === String(inReviewLessonId))).toBe(false);
  });

  test("student cannot open draft lesson by id even when shared with a teacher", async () => {
    const res = await request(app)
      .get(`/api/lessons/${draftLessonId}`)
      .set("Authorization", `Bearer ${tokenStudent}`);
    expect(res.status).toBe(403);
    expect(res.body.reason).toBe("NOT_PUBLISHED");
  });

  test("published shared lesson still follows normal student access rules", async () => {
    await request(app)
      .post(`/api/lessons/${publishedLessonId}/shares`)
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ teacherId: String(rachelId), permission: "TEACH" });

    const teacherRes = await request(app)
      .get(`/api/lessons/${publishedLessonId}`)
      .set("Authorization", `Bearer ${tokenRachel}`);
    expect(teacherRes.status).toBe(200);
    expect(teacherRes.body.accessDecision?.reason).toBe("SHARED_TEACH");

    const studentRes = await request(app)
      .get(`/api/lessons/${publishedLessonId}`)
      .set("Authorization", `Bearer ${tokenStudent}`);
    expect(studentRes.status).toBe(402);
    expect(studentRes.body.reason).toBe("NOT_ENTITLED");
  });

  test("archived lesson cannot be shared", async () => {
    const res = await request(app)
      .post(`/api/lessons/${archivedLessonId}/shares`)
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ teacherId: String(rachelId), permission: "VIEW" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot be shared/i);
  });

  test("archived lesson cannot be opened through existing share access", async () => {
    const shareableLesson = await Lesson.create({
      title: "Will Archive Lesson",
      description: "Temp",
      content: "Content",
      teacherId: ownerId,
      teacherName: "Sham Owner",
      subject: "Biology",
      level: "IGCSE",
      topic: "Archive Flow",
      board: "Edexcel",
      status: "draft",
      isPublished: false,
      pages: [{ pageId: "p1", order: 0, blocks: [{ type: "text", content: "Body" }] }],
      quiz: { questions: [] },
      flashcards: [],
    });

    await request(app)
      .post(`/api/lessons/${shareableLesson._id}/shares`)
      .set("Authorization", `Bearer ${tokenOwner}`)
      .send({ teacherId: String(rachelId), permission: "TEACH" });

    await Lesson.updateOne({ _id: shareableLesson._id }, { $set: { status: "archived", isPublished: false } });

    const openRes = await request(app)
      .get(`/api/lessons/${shareableLesson._id}`)
      .set("Authorization", `Bearer ${tokenRachel}`);
    expect(openRes.status).toBe(404);

    const classroomRes = await request(app)
      .get(`/api/lessons/${shareableLesson._id}`)
      .query({ present: "classroom" })
      .set("Authorization", `Bearer ${tokenRachel}`);
    expect(classroomRes.status).toBe(404);

    const libraryRes = await request(app)
      .get("/api/lessons/teaching-library")
      .set("Authorization", `Bearer ${tokenRachel}`);
    expect(libraryRes.body.some((l) => String(l._id) === String(shareableLesson._id))).toBe(false);
  });

  test("VIEW and TEACH do not grant edit publish delete or share management", async () => {
    const putRes = await request(app)
      .put(`/api/lessons/${draftLessonId}`)
      .set("Authorization", `Bearer ${tokenRachel}`)
      .send({ title: "Hijacked" });
    expect(putRes.status).toBe(401);

    const pubRes = await request(app)
      .put(`/api/lessons/${draftLessonId}/publish`)
      .set("Authorization", `Bearer ${tokenRachel}`);
    expect([401, 404]).toContain(pubRes.status);

    const delRes = await request(app)
      .delete(`/api/lessons/${draftLessonId}`)
      .set("Authorization", `Bearer ${tokenRachel}`);
    expect([401, 404]).toContain(delRes.status);

    const sharesRes = await request(app)
      .get(`/api/lessons/${draftLessonId}/shares`)
      .set("Authorization", `Bearer ${tokenRachel}`);
    expect(sharesRes.status).toBe(403);
  });
});
