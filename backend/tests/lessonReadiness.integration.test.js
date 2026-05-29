/**
 * PR7: Lesson readiness (computed) + POST /api/lessons/:id/review.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const {
  computeLessonReadiness,
  countCheckpointBlocks,
  pageHasValidCheckpoint,
} = require("../utils/lessonReadiness");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("computeLessonReadiness", () => {
  test("published + checkpoints + diagrams + reviewed => READY", () => {
    const lesson = {
      status: "published",
      isPublished: true,
      reviewedAt: new Date(),
      examQuestions: [{ questionId: "x" }],
      pages: [
        {
          blocks: [
            { type: "checkpoint", prompt: "Q?" },
            { type: "diagram", visualId: "y" },
          ],
        },
      ],
    };
    const r = computeLessonReadiness(lesson);
    expect(r.status).toBe("READY");
    expect(r.signals.hasCheckpoints).toBe(true);
    expect(r.signals.hasDiagrams).toBe(true);
    expect(r.signals.isReviewed).toBe(true);
    expect(r.signals.missing).toEqual([]);
  });

  test("published + checkpoints only + not reviewed => NEEDS_REVIEW with NO_DIAGRAMS, NOT_REVIEWED", () => {
    const lesson = {
      status: "published",
      isPublished: true,
      reviewedAt: null,
      examQuestions: [],
      pages: [{ blocks: [{ type: "checkpoint", prompt: "Q?" }] }],
    };
    const r = computeLessonReadiness(lesson);
    expect(r.status).toBe("NEEDS_REVIEW");
    expect(r.signals.missing).toContain("NO_DIAGRAMS");
    expect(r.signals.missing).toContain("NOT_REVIEWED");
  });

  test("counts valid page.checkpoint when no block checkpoint", () => {
    const lesson = {
      pages: [
        {
          blocks: [{ type: "text", content: "Intro" }],
          checkpoint: {
            question: "How is respiration defined?",
            options: ["A", "B", "C", "D"],
            answer: "B",
          },
        },
      ],
    };
    expect(countCheckpointBlocks(lesson)).toBe(1);
    expect(pageHasValidCheckpoint(lesson.pages[0])).toBe(true);
  });

  test("does not count selfCheck as checkpoint", () => {
    const lesson = {
      pages: [
        {
          blocks: [
            {
              type: "selfCheck",
              prompt: "Which is correct?",
              options: ["A", "B"],
              correctAnswer: "A",
            },
          ],
        },
      ],
    };
    expect(countCheckpointBlocks(lesson)).toBe(0);
  });

  test("counts at most one checkpoint per page when block and page.checkpoint both exist", () => {
    const page = {
      blocks: [{ type: "checkpoint", prompt: "Block Q?" }],
      checkpoint: {
        question: "Page Q?",
        options: ["1", "2"],
        answer: "2",
      },
    };
    expect(countCheckpointBlocks({ pages: [page] })).toBe(1);
  });

  test("draft => DRAFT", () => {
    const lesson = {
      status: "draft",
      isPublished: false,
      reviewedAt: null,
      examQuestions: [],
      pages: [],
    };
    const r = computeLessonReadiness(lesson);
    expect(r.status).toBe("DRAFT");
  });
});

describe("POST /api/lessons/:id/review", () => {
  let teacherId;
  let otherTeacherId;
  let lessonId;
  let teacherToken;
  let otherTeacherToken;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "R",
      lastName: "Teacher",
      email: "readiness-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const other = await User.create({
      firstName: "O",
      lastName: "Teacher",
      email: "readiness-other@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    otherTeacherId = other._id;

    const lesson = await Lesson.create({
      title: "Readiness Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "R Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "draft",
      isPublished: false,
      reviewedAt: null,
      reviewedBy: null,
      pages: [{ pageId: "p1", title: "P1", order: 0, blocks: [] }],
      examQuestions: [],
    });
    lessonId = lesson._id;

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    teacherToken = await login("readiness-teacher@test.com");
    otherTeacherToken = await login("readiness-other@test.com");
  });

  test("unauthenticated => 401", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/review`)
      .send({ reviewed: true });
    expect(res.status).toBe(401);
  });

  test("non-owner teacher => 404 (no existence leak)", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/review`)
      .set("Authorization", `Bearer ${otherTeacherToken}`)
      .send({ reviewed: true });
    expect(res.status).toBe(404);
  });

  test("owner POST review true sets reviewedAt and returns readiness with isReviewed true", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/review`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ reviewed: true });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.reviewedAt).toBeDefined();
    expect(res.body.reviewedBy).toBeDefined();
    expect(res.body.readiness).toBeDefined();
    expect(res.body.readiness.signals.isReviewed).toBe(true);

    const lesson = await Lesson.findById(lessonId).lean();
    expect(lesson.reviewedAt).toBeDefined();
    expect(String(lesson.reviewedBy)).toBe(String(teacherId));
  });

  test("owner POST review false clears reviewedAt", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lessonId}/review`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ reviewed: false });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.reviewedAt).toBeNull();
    expect(res.body.reviewedBy).toBeNull();
    expect(res.body.readiness.signals.isReviewed).toBe(false);
  });
});
