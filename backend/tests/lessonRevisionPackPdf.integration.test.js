/**
 * Integration: POST /api/lessons/:lessonId/export/revision-pack
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const {
  renderLessonRevisionPackPdf,
  buildRevisionPackSections,
} = require("../services/pdf/lessonRevisionPackPdf");

describe("POST /api/lessons/:lessonId/export/revision-pack", () => {
  jest.setTimeout(20000);

  let teacherId;
  let lockedLessonId;
  let previewLessonId;
  let tokenEntitled;
  let tokenPreviewOnly;
  let tokenTeacher;
  const hashedPassword = bcrypt.hashSync("password123", 10);

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Pack",
      lastName: "Teacher",
      email: `revpack-teacher-${Date.now()}@test.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const locked = await Lesson.create({
      title: "Revision Pack Locked Lesson",
      description: "Locked",
      content: "Content",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      isFreePreview: false,
      pages: [
        {
          pageId: "p1",
          title: "Page 1",
          order: 0,
          blocks: [
            { type: "keyIdea", content: "Cells are the basic unit of life." },
            {
              type: "checkpoint",
              prompt: "What is a cell?",
              correctAnswer: "Basic unit of life",
              markScheme: "1 mark for basic unit",
            },
          ],
        },
      ],
      flashcards: [{ id: "f1", front: "Cell?", back: "Basic unit of life" }],
      quiz: {
        questions: [
          {
            id: "q1",
            type: "mcq",
            question: "Which organelle contains DNA?",
            options: ["Nucleus", "Ribosome"],
            correctAnswer: "Nucleus",
            markScheme: "Nucleus",
          },
        ],
      },
    });
    lockedLessonId = locked._id;

    const preview = await Lesson.create({
      title: "Revision Pack Preview Lesson",
      description: "Preview",
      content: "Content",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      isFreePreview: true,
      pages: [
        {
          pageId: "p1",
          title: "Preview",
          order: 0,
          blocks: [{ type: "keyIdea", content: "Preview only idea." }],
        },
      ],
    });
    previewLessonId = preview._id;

    const future = new Date(Date.now() + 7 * 86400000);
    const entitled = await User.create({
      firstName: "Entitled",
      lastName: "Student",
      email: `revpack-entitled-${Date.now()}@test.com`,
      password: hashedPassword,
      userType: "student",
      subscriptionV2: { status: "trialing", expiresAt: future, provider: "admin", planId: "admin-pass-7d" },
    });
    const previewOnly = await User.create({
      firstName: "Preview",
      lastName: "Student",
      email: `revpack-preview-${Date.now()}@test.com`,
      password: hashedPassword,
      userType: "student",
      subscriptionV2: null,
      purchasedLessons: [],
    });

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    tokenEntitled = await login(entitled.email);
    tokenPreviewOnly = await login(previewOnly.email);
    tokenTeacher = await login(teacher.email);
  });

  test("unauthenticated user gets 401", async () => {
    const res = await request(app).post(`/api/lessons/${lockedLessonId}/export/revision-pack`);
    expect(res.status).toBe(401);
  });

  test("entitled student downloads PDF (200, application/pdf, %PDF magic)", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lockedLessonId}/export/revision-pack`)
      .set("Authorization", `Bearer ${tokenEntitled}`)
      .send({});
    expect(res.status).toBe(200);
    expect(String(res.headers["content-type"] || "")).toMatch(/application\/pdf/);
    expect(Buffer.isBuffer(res.body) || res.body instanceof Buffer || typeof res.body === "object").toBe(true);
    const buf = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.body);
    expect(buf.slice(0, 4).toString("utf8")).toBe("%PDF");
    expect(String(res.headers["content-disposition"] || "")).toMatch(/revision-pack-/);
    expect(res.headers["x-revision-pack-answers"]).toBe("0");
  });

  test("preview-only student cannot download full pack", async () => {
    const res = await request(app)
      .post(`/api/lessons/${previewLessonId}/export/revision-pack`)
      .set("Authorization", `Bearer ${tokenPreviewOnly}`)
      .send({});
    expect([402, 403]).toContain(res.status);
    expect(res.body.reason === "FREE_PREVIEW" || res.body.reason === "NOT_ENTITLED" || res.body.error).toBeTruthy();
  });

  test("not entitled student cannot download locked lesson pack", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lockedLessonId}/export/revision-pack`)
      .set("Authorization", `Bearer ${tokenPreviewOnly}`)
      .send({});
    expect([402, 403]).toContain(res.status);
  });

  test("entitled student includeAnswers:true still omits mark scheme appendix", async () => {
    const zlib = require("zlib");
    const extractPdfPlainText = (buf) => {
      const raw = buf.toString("latin1");
      const pieces = [];
      const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
      let m;
      while ((m = re.exec(raw))) {
        const chunk = Buffer.from(m[1], "binary");
        let streamText;
        try {
          streamText = zlib.inflateSync(chunk).toString("latin1");
        } catch {
          streamText = chunk.toString("latin1");
        }
        // PDFKit TJ arrays: keep only hex string payloads (ignore kerning numbers).
        streamText.replace(/<([0-9A-Fa-f]+)>/g, (_, hex) => {
          try {
            pieces.push(Buffer.from(hex, "hex").toString("latin1"));
          } catch {
            /* ignore */
          }
          return "";
        });
      }
      return pieces.join("");
    };

    const studentRes = await request(app)
      .post(`/api/lessons/${lockedLessonId}/export/revision-pack`)
      .set("Authorization", `Bearer ${tokenEntitled}`)
      .send({ includeAnswers: true });
    expect(studentRes.status).toBe(200);
    expect(String(studentRes.headers["content-type"] || "")).toMatch(/application\/pdf/);
    expect(studentRes.headers["x-revision-pack-answers"]).toBe("0");
    const studentBuf = Buffer.isBuffer(studentRes.body) ? studentRes.body : Buffer.from(studentRes.body);
    expect(studentBuf.slice(0, 4).toString("utf8")).toBe("%PDF");
    const studentText = extractPdfPlainText(studentBuf);
    expect(studentText).not.toMatch(/Model answers \/ mark scheme/);
    expect(studentText).not.toMatch(/1 mark for basic unit/);
    expect(studentText).not.toMatch(/Mark scheme:/);

    // Control: teacher with includeAnswers still gets the appendix (unchanged behaviour).
    const teacherRes = await request(app)
      .post(`/api/lessons/${lockedLessonId}/export/revision-pack`)
      .set("Authorization", `Bearer ${tokenTeacher}`)
      .send({ includeAnswers: true });
    expect(teacherRes.status).toBe(200);
    expect(teacherRes.headers["x-revision-pack-answers"]).toBe("1");
    const teacherBuf = Buffer.isBuffer(teacherRes.body) ? teacherRes.body : Buffer.from(teacherRes.body);
    const teacherText = extractPdfPlainText(teacherBuf);
    expect(teacherText).toMatch(/Model answers \/ mark scheme/);
    expect(teacherText).toMatch(/1 mark for basic unit/);
  });

  test("teacher can include answers appendix", async () => {
    const res = await request(app)
      .post(`/api/lessons/${lockedLessonId}/export/revision-pack`)
      .set("Authorization", `Bearer ${tokenTeacher}`)
      .send({ includeAnswers: true });
    expect(res.status).toBe(200);
    expect(res.headers["x-revision-pack-answers"]).toBe("1");
    const buf = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.body);
    expect(buf.slice(0, 4).toString("utf8")).toBe("%PDF");
  });

  test("renderLessonRevisionPackPdf produces PDF magic bytes", async () => {
    const lesson = await Lesson.findById(lockedLessonId).lean();
    const buf = await renderLessonRevisionPackPdf(lesson, { includeAnswers: false });
    expect(buf.slice(0, 4).toString("utf8")).toBe("%PDF");
    const studentSections = buildRevisionPackSections(lesson, { includeAnswers: false });
    expect(studentSections.answerAppendix).toEqual([]);
  });
});
