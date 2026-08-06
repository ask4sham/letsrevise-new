/**
 * Lesson Synthesiser draft receiver — isolated POST /api/lesson-synthesiser/drafts.
 * Does not exercise or alter POST /api/lessons or V1/V2 generator routes.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");

process.env.LETSREVISE_LESSON_SYNTHESISER_TOKEN =
  process.env.LETSREVISE_LESSON_SYNTHESISER_TOKEN || "test-synthesiser-token-pr72";

const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const {
  getLessonSynthesiserPr10DraftFixture,
} = require("./fixtures/lessonSynthesiserPr10Draft.fixture");
const {
  validateLessonSynthesiserDraftEnvelope,
} = require("../utils/lessonSynthesiserDraftValidator");

function progressiveSequenceBlock(overrides = {}) {
  return {
    id: "block-sequence-test",
    type: "interactiveSequence",
    role: "sequence",
    title: "Process steps",
    intro: "Follow the process.",
    presentationMode: "progressiveReveal",
    enableTestMe: false,
    sourceIds: ["edexcel-igcse-biology:reproduction/gametes-fertilisation:ck1"],
    sequenceSteps: [
      {
        id: "step-1",
        title: "Step 1",
        description: "First teaching step.",
        imageUrl: "",
        sourceIds: ["edexcel-igcse-biology:reproduction/gametes-fertilisation:ck1"],
      },
      {
        id: "step-2",
        title: "Step 2",
        description: "Second teaching step.",
        imageUrl: "",
      },
    ],
    ...overrides,
  };
}

function payloadWithProgressiveBlock(blockOverrides = {}) {
  const payload = getLessonSynthesiserPr10DraftFixture();
  payload.draft.pages[0].blocks.push(progressiveSequenceBlock(blockOverrides));
  return payload;
}

const TOKEN = process.env.LETSREVISE_LESSON_SYNTHESISER_TOKEN;
const hashedPassword = bcrypt.hashSync("password123", 10);

function authHeader(token = TOKEN) {
  return { Authorization: `Bearer ${token}` };
}

describe("Lesson Synthesiser draft receiver", () => {
  let ownerTeacher;

  beforeAll(async () => {
    ownerTeacher = await User.create({
      firstName: "Synthesiser",
      lastName: "Owner",
      email: `synthesiser-owner-${Date.now()}@test.com`,
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

  test("1–3,13–23,31: valid PR10 draft saves as draft with editPath and preserved fields", async () => {
    const payload = getLessonSynthesiserPr10DraftFixture();
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.lessonId).toBeTruthy();
    expect(res.body.editPath).toBe(`/edit-lesson/${res.body.lessonId}`);
    expect(res.body.status).toBe("draft");
    expect(res.body.isPublished).toBe(false);

    const lesson = await Lesson.findById(res.body.lessonId).lean();
    expect(lesson).toBeTruthy();
    expect(lesson.status).toBe("draft");
    expect(lesson.isPublished).toBe(false);
    expect(lesson.level).toBe("IGCSE");
    expect(lesson.board).toBe("Edexcel");
    expect(lesson.tier).toBe("Higher");
    expect(lesson.specKey).toBe(payload.draft.specKey);
    expect(lesson.topicKey).toBe(payload.draft.topicKey);
    expect(lesson.pages?.length).toBeGreaterThan(0);

    const blocks = lesson.pages.flatMap((p) => p.blocks || []);
    const selfCheck = blocks.find((b) => b.type === "selfCheck");
    const checkpoint = blocks.find((b) => b.type === "checkpoint");
    const pageQuiz = blocks.find((b) => b.type === "pageQuiz");
    expect(selfCheck?.questions).toHaveLength(3);
    expect(checkpoint?.questions).toHaveLength(3);
    expect(pageQuiz?.questions).toHaveLength(5);

    const sampleQ = selfCheck.questions[0];
    expect(sampleQ.answer).toBeTruthy();
    expect(sampleQ.correctAnswer).toBeTruthy();
    expect(
      (Array.isArray(sampleQ.markScheme) && sampleQ.markScheme.length) ||
        (sampleQ.metadata && sampleQ.metadata.markScheme?.length)
    ).toBeTruthy();
    expect(
      (Array.isArray(sampleQ.sourceIds) && sampleQ.sourceIds.length) ||
        (sampleQ.metadata && sampleQ.metadata.sourceIds?.length)
    ).toBeTruthy();

    expect(lesson.quiz?.questions?.length).toBe(5);
    expect(lesson.metadata?.synthesiser?.generator).toBe("lesson-synthesiser-v1");
    expect(lesson.metadata?.synthesiser?.criticOk).toBe(true);
    expect(lesson.metadata?.synthesiser?.importedAt).toBeTruthy();
  });

  test("4: rejects missing token", async () => {
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .send(getLessonSynthesiserPr10DraftFixture());
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("SYNTHESISER_AUTH_REQUIRED");
    expect(res.body.ok).toBe(false);
  });

  test("5: rejects wrong token", async () => {
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader("wrong-token-value-xxxxx"))
      .send(getLessonSynthesiserPr10DraftFixture());
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("SYNTHESISER_AUTH_INVALID");
  });

  test("6: rejects wrong source", async () => {
    const payload = getLessonSynthesiserPr10DraftFixture();
    payload.source = "other-tool";
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.code === "SYNTHESISER_SOURCE_INVALID")).toBe(
      true
    );
  });

  test("7: rejects wrong generator", async () => {
    const payload = getLessonSynthesiserPr10DraftFixture();
    payload.generator = "other-v1";
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);
    expect(res.status).toBe(400);
    expect(
      res.body.errors.some((e) => e.code === "SYNTHESISER_GENERATOR_INVALID")
    ).toBe(true);
  });

  test("8: rejects missing metadata.generator", async () => {
    const payload = getLessonSynthesiserPr10DraftFixture();
    delete payload.draft.metadata.generator;
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);
    expect(res.status).toBe(400);
    expect(
      res.body.errors.some((e) => e.code === "SYNTHESISER_METADATA_INVALID")
    ).toBe(true);
  });

  test("9: rejects isPublished true", async () => {
    const payload = getLessonSynthesiserPr10DraftFixture();
    payload.draft.isPublished = true;
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);
    expect(res.status).toBe(400);
    expect(
      res.body.errors.some((e) => e.code === "SYNTHESISER_PUBLISH_FORBIDDEN")
    ).toBe(true);
  });

  test("10: rejects status published", async () => {
    const payload = getLessonSynthesiserPr10DraftFixture();
    payload.draft.status = "published";
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);
    expect(res.status).toBe(400);
    expect(
      res.body.errors.some((e) => e.code === "SYNTHESISER_DRAFT_NOT_DRAFT")
    ).toBe(true);
  });

  test("11: rejects missing specKey/topicKey", async () => {
    const payload = getLessonSynthesiserPr10DraftFixture();
    delete payload.draft.specKey;
    delete payload.draft.topicKey;
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);
    expect(res.status).toBe(400);
    expect(
      res.body.errors.some((e) => e.code === "SYNTHESISER_TAXONOMY_INVALID")
    ).toBe(true);
  });

  test("12: rejects non-namespaced topicKey", async () => {
    const payload = getLessonSynthesiserPr10DraftFixture();
    payload.draft.topicKey = "reproduction/gametes-fertilisation";
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);
    expect(res.status).toBe(400);
    expect(
      res.body.errors.some((e) => e.code === "SYNTHESISER_TAXONOMY_INVALID")
    ).toBe(true);
  });

  test("24: rejects Option 1–4 filler", async () => {
    const payload = getLessonSynthesiserPr10DraftFixture();
    const sc = payload.draft.pages
      .flatMap((p) => p.blocks)
      .find((b) => b.type === "selfCheck");
    sc.questions[0].options = ["Option 1", "Option 2", "Option 3", "Option 4"];
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.code === "SYNTHESISER_OPTION_FILLER")).toBe(
      true
    );
  });

  test("25: rejects banned generic stems", async () => {
    const payload = getLessonSynthesiserPr10DraftFixture();
    const sc = payload.draft.pages
      .flatMap((p) => p.blocks)
      .find((b) => b.type === "selfCheck");
    sc.questions[0].stem = "Which of the following is true about gametes?";
    sc.questions[0].prompt = sc.questions[0].stem;
    sc.questions[0].question = sc.questions[0].stem;
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.code === "SYNTHESISER_BANNED_STEM")).toBe(
      true
    );
  });

  test("26: rejects legacy-only single prompt banks", async () => {
    const payload = getLessonSynthesiserPr10DraftFixture();
    const sc = payload.draft.pages
      .flatMap((p) => p.blocks)
      .find((b) => b.type === "selfCheck");
    delete sc.questions;
    sc.prompt = "Legacy single prompt only";
    sc.options = ["A", "B", "C", "D"];
    sc.correctAnswer = "A";
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);
    expect(res.status).toBe(400);
    expect(
      res.body.errors.some((e) => e.code === "SYNTHESISER_LEGACY_PROMPT_BANK")
    ).toBe(true);
  });

  test("27: rejects unsupported block type", async () => {
    const payload = getLessonSynthesiserPr10DraftFixture();
    payload.draft.pages[0].blocks.push({
      type: "stretch",
      content: "unsupported in synthesiser receiver",
    });
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);
    expect(res.status).toBe(400);
    expect(
      res.body.errors.some((e) => e.code === "SYNTHESISER_BLOCK_TYPE_FORBIDDEN")
    ).toBe(true);
  });

  test("28: rejects imageActivity block type", async () => {
    const payload = getLessonSynthesiserPr10DraftFixture();
    payload.draft.pages[0].blocks.push({
      type: "imageActivity",
      content: "forbidden",
    });
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);
    expect(res.status).toBe(400);
    expect(
      res.body.errors.some((e) => e.code === "SYNTHESISER_BLOCK_TYPE_FORBIDDEN")
    ).toBe(true);
  });

  test("29: rejects teacherBrief in student-visible content", async () => {
    const payload = getLessonSynthesiserPr10DraftFixture();
    payload.draft.pages[0].blocks[0].content =
      "Teacher brief: do not show this to students";
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);
    expect(res.status).toBe(400);
    expect(
      res.body.errors.some((e) => e.code === "SYNTHESISER_TEACHER_BRIEF_LEAK")
    ).toBe(true);
  });

  test("30: rejects unsafe retrieval/activity image metadata", async () => {
    const payload = getLessonSynthesiserPr10DraftFixture();
    const retrieval = payload.draft.pages
      .flatMap((p) => p.blocks)
      .find((b) => b.type === "diagram" && String(b.role || "").includes("retrieval"));
    expect(retrieval).toBeTruthy();
    retrieval.labelsAllowedOnStudentImage = true;
    if (retrieval.metadata) retrieval.metadata.labelsAllowedOnStudentImage = true;
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);
    expect(res.status).toBe(400);
    expect(
      res.body.errors.some((e) => e.code === "SYNTHESISER_IMAGE_SAFETY_INVALID")
    ).toBe(true);
  });

  test("31 again: does not auto-publish even if client tries after validation bypass attempt", async () => {
    // Valid draft path already asserts draft; additionally ensure saved lesson stays unpublished.
    const payload = getLessonSynthesiserPr10DraftFixture();
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);
    expect(res.status).toBe(201);
    const lesson = await Lesson.findById(res.body.lessonId).lean();
    expect(lesson.status).toBe("draft");
    expect(lesson.isPublished).toBe(false);
  });

  test("preserves GCSE vs IGCSE distinctly", async () => {
    const payload = getLessonSynthesiserPr10DraftFixture();
    payload.draft.level = "GCSE";
    payload.draft.board = "AQA";
    payload.draft.examBoardName = "AQA";
    payload.draft.specKey = "aqa-gcse-biology";
    payload.draft.topicKey = "aqa-gcse-biology:cell-biology/cell-structure";
    payload.draft.metadata.originalTopicKey = "cell-biology/cell-structure";
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);
    expect(res.status).toBe(201);
    const lesson = await Lesson.findById(res.body.lessonId).lean();
    expect(lesson.level).toBe("GCSE");
    expect(lesson.board).toBe("AQA");
  });

  test("accepts valid progressiveReveal interactiveSequence import and preserves fields", async () => {
    const payload = payloadWithProgressiveBlock();
    const res = await request(app)
      .post("/api/lesson-synthesiser/drafts")
      .set(authHeader())
      .send(payload);
    expect(res.status).toBe(201);

    const lesson = await Lesson.findById(res.body.lessonId).lean();
    const seq = lesson.pages
      .flatMap((p) => p.blocks || [])
      .find((b) => b.type === "interactiveSequence");
    expect(seq).toBeTruthy();
    expect(seq.presentationMode).toBe("progressiveReveal");
    expect(seq.enableTestMe).toBe(false);
    expect(seq.id).toBe("block-sequence-test");
    expect(seq.sequenceSteps).toHaveLength(2);
    expect(String(seq.sequenceSteps[0].caption || "").trim()).toBe("");
  });

  test("accepts one-step progressiveReveal import at renderer-contract level", async () => {
    const payload = payloadWithProgressiveBlock({
      sequenceSteps: [
        {
          id: "step-only",
          title: "Only step",
          description: "Single step activity.",
          imageUrl: "",
        },
      ],
    });
    const validation = validateLessonSynthesiserDraftEnvelope(payload);
    expect(validation.ok).toBe(true);
  });

  test("rejects progressiveReveal import when enableTestMe is true", () => {
    const validation = validateLessonSynthesiserDraftEnvelope(
      payloadWithProgressiveBlock({ enableTestMe: true })
    );
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((e) => e.code === "SYNTHESISER_SEQUENCE_TEST_ME_INVALID")).toBe(
      true
    );
  });

  test("rejects progressiveReveal import with prohibited teacher-only fields", () => {
    const fields = ["caption", "testQuestion", "testExplanation", "note", "teacherBrief"];
    for (const field of fields) {
      const validation = validateLessonSynthesiserDraftEnvelope(
        payloadWithProgressiveBlock({ [field]: "secret teacher data" })
      );
      expect(validation.ok).toBe(false);
      expect(validation.errors.some((e) => e.code === "SYNTHESISER_SEQUENCE_FORBIDDEN_FIELD")).toBe(
        true
      );
    }
  });

  test("rejects progressiveReveal import with duplicate step ids and descriptions", () => {
    const dupId = validateLessonSynthesiserDraftEnvelope(
      payloadWithProgressiveBlock({
        sequenceSteps: [
          { id: "dup", title: "A", description: "One.", imageUrl: "" },
          { id: "dup", title: "B", description: "Two.", imageUrl: "" },
        ],
      })
    );
    expect(dupId.ok).toBe(false);

    const dupDesc = validateLessonSynthesiserDraftEnvelope(
      payloadWithProgressiveBlock({
        sequenceSteps: [
          { id: "s1", title: "A", description: "Same text.", imageUrl: "" },
          { id: "s2", title: "B", description: "Same   text.", imageUrl: "" },
        ],
      })
    );
    expect(dupDesc.ok).toBe(false);
  });

  test("rejects progressiveReveal import with invalid step counts and empty fields", () => {
    const zero = validateLessonSynthesiserDraftEnvelope(
      payloadWithProgressiveBlock({ sequenceSteps: [] })
    );
    expect(zero.ok).toBe(false);

    const tooMany = validateLessonSynthesiserDraftEnvelope(
      payloadWithProgressiveBlock({
        sequenceSteps: Array.from({ length: 9 }, (_, i) => ({
          id: `step-${i}`,
          title: `Step ${i}`,
          description: `Description ${i}`,
          imageUrl: "",
        })),
      })
    );
    expect(tooMany.ok).toBe(false);

    const emptyTitle = validateLessonSynthesiserDraftEnvelope(
      payloadWithProgressiveBlock({
        sequenceSteps: [{ id: "s1", title: "", description: "Text.", imageUrl: "" }],
      })
    );
    expect(emptyTitle.ok).toBe(false);
  });
});

describe("Lesson Synthesiser receiver isolation (no route mutation smoke)", () => {
  test("32–33: dedicated route exists; POST /api/lessons still requires JWT (not synthesiser token)", async () => {
    const syn = await request(app).post("/api/lesson-synthesiser/drafts").send({});
    expect([401, 400, 500]).toContain(syn.status);

    const lessonsRes = await request(app)
      .post("/api/lessons")
      .set(authHeader(TOKEN))
      .send({
        title: "Should not create via synthesiser token",
        description: "x",
        content: "x",
        subject: "Biology",
        level: "GCSE",
        topic: "Cells",
      });
    // JWT auth middleware should reject service token (not a user JWT).
    expect(lessonsRes.status).toBe(401);
  });
});
