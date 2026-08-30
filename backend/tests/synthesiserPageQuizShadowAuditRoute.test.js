/**
 * Phase 3 — Synthesiser draft route shadow audit fail-open seam.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");

jest.mock("../utils/synthesiserPageQuizAlignmentAudit", () => ({
  auditAndLogSynthesiserPageQuizShadow: jest.fn(() => {
    throw new Error("shadow audit forced failure");
  }),
}));

process.env.LETSREVISE_LESSON_SYNTHESISER_TOKEN =
  process.env.LETSREVISE_LESSON_SYNTHESISER_TOKEN || "test-synthesiser-token-pr72";

const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const {
  getLessonSynthesiserPr10DraftFixture,
} = require("./fixtures/lessonSynthesiserPr10Draft.fixture");
const {
  auditAndLogSynthesiserPageQuizShadow,
} = require("../utils/synthesiserPageQuizAlignmentAudit");

const TOKEN = process.env.LETSREVISE_LESSON_SYNTHESISER_TOKEN;
const hashedPassword = bcrypt.hashSync("password123", 10);

function authHeader(token = TOKEN) {
  return { Authorization: `Bearer ${token}` };
}

describe("Synthesiser Page Quiz shadow audit route seam", () => {
  let ownerTeacher;

  beforeAll(async () => {
    ownerTeacher = await User.create({
      firstName: "Shadow",
      lastName: "Audit",
      email: `shadow-audit-${Date.now()}@test.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    process.env.LETSREVISE_SYNTHESISER_OWNER_TEACHER_ID = String(ownerTeacher._id);
  });

  afterAll(async () => {
    if (ownerTeacher?._id) {
      await Lesson.deleteMany({ teacherId: ownerTeacher._id });
      await User.deleteOne({ _id: ownerTeacher._id });
    }
  });

  test("audit exception cannot block synthesiser draft save (fail-open)", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const payload = getLessonSynthesiserPr10DraftFixture();

    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);

    expect(auditAndLogSynthesiserPageQuizShadow).toHaveBeenCalled();
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.lessonId).toBeTruthy();
    expect(warnSpy).toHaveBeenCalledWith(
      "[TeacherBrain][PageQuizShadow] audit failed (fail-open)",
      expect.objectContaining({ message: "shadow audit forced failure" })
    );

    const lesson = await Lesson.findById(res.body.lessonId).lean();
    expect(lesson).toBeTruthy();
    expect(lesson.status).toBe("draft");
    expect(lesson.isPublished).toBe(false);

    warnSpy.mockRestore();
  });
});
