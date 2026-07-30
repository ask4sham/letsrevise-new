/**
 * Integration: V2.3B1 read-only rationale review context (no writes, no LLM).
 */
process.env.NODE_ENV = process.env.NODE_ENV || "test";

jest.mock("../utils/lessonAssetLlm", () => ({
  callOpenAiJson: jest.fn(async () => {
    throw new Error("LLM must not be called in V2.3B1 review-context tests");
  }),
}));

const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const { callOpenAiJson } = require("../utils/lessonAssetLlm");
const app = require("../app");
const User = require("../models/User");
const ExamQuestion = require("../models/ExamQuestion");
const Lesson = require("../models/Lesson");
const ExamQuestionRationaleCandidate = require("../models/ExamQuestionRationaleCandidate");
const { computeMcqRationaleSourceFingerprint } = require("../utils/mcqRationaleSourceFingerprint");
const {
  buildSourceSnapshot,
  resolveImageContext,
} = require("../services/examQuestionRationaleCandidateService");
const { classifyCompositeMcqPart } = require("../utils/classifyMcqRationaleInventory");

const hashedPassword = bcrypt.hashSync("password123", 10);
jest.setTimeout(60000);

async function loginAs(email, userType = "admin", staffRole) {
  await User.deleteMany({ email });
  const doc = {
    email,
    password: hashedPassword,
    firstName: "V23B1",
    lastName: "Tester",
    userType,
    isEmailVerified: true,
  };
  if (staffRole) doc.staffRole = staffRole;
  const user = await User.create(doc);
  const res = await request(app).post("/api/auth/login").send({ email, password: "password123" });
  expect(res.status).toBe(200);
  return { token: res.body.token || res.body.accessToken || res.body.jwt, user };
}

function mcqPart(label, explanation, overrides = {}) {
  const part = {
    label,
    type: "mcq",
    marks: 1,
    questionText: overrides.questionText || `Which factor is essential? (${label})`,
    options: overrides.options || ["Water", "Oxygen", "Light", "Temperature"],
    correctIndex: overrides.correctIndex != null ? overrides.correctIndex : 2,
    markScheme: overrides.markScheme || ["Award 1 mark for selecting Light."],
  };
  if (explanation === undefined) {
    // omit
  } else if (explanation === null) {
    part.partData = { explanation: null };
  } else {
    part.partData = { explanation };
  }
  return part;
}

async function createEligibleDraft(teacherId, overrides = {}) {
  return ExamQuestion.create({
    teacherId,
    subject: "Biology",
    examBoard: "AQA",
    level: "GCSE",
    topic: "Photosynthesis",
    topicKey: "photosynthesis",
    type: "composite",
    questionMode: "composite",
    question: "Composite photosynthesis",
    sharedStem: "A plant is placed in different conditions.",
    status: "draft",
    isArchived: false,
    parts: [mcqPart("a", undefined)],
    ...overrides,
  });
}

function getReview(token, query) {
  return request(app)
    .get("/api/admin/exam-question-rationale-review-context")
    .set("Authorization", `Bearer ${token}`)
    .query(query);
}

function expectedFingerprint(question, partLabel) {
  const part = (question.parts || []).find((p) => String(p.label).trim() === partLabel);
  const classification = classifyCompositeMcqPart(part, {
    isArchived: question.isArchived,
    subject: question.subject,
    topic: question.topic,
    topicKey: question.topicKey,
  });
  const imageCtx = resolveImageContext(question);
  const snapshot = buildSourceSnapshot(
    question,
    part,
    classification,
    imageCtx.ok ? imageCtx.imageContextText : ""
  );
  return computeMcqRationaleSourceFingerprint({
    questionId: String(question._id),
    partLabel,
    sharedStem: snapshot.sharedStem,
    questionText: snapshot.questionText,
    options: snapshot.options,
    correctIndex: snapshot.correctIndex,
    marks: snapshot.marks,
    markScheme: snapshot.markScheme,
    subject: snapshot.subject,
    examBoard: snapshot.examBoard,
    level: snapshot.level,
    tier: snapshot.tier,
    topic: snapshot.topic,
    topicKey: snapshot.topicKey,
    imageContextText: snapshot.imageContextText,
    currentExplanation: snapshot.currentExplanation,
  });
}

beforeAll(async () => {
  await ExamQuestionRationaleCandidate.syncIndexes();
});

beforeEach(async () => {
  delete process.env.FEATURE_MCQ_RATIONALE_BACKFILL_V23A;
  delete process.env.MCQ_RATIONALE_BACKFILL_ALLOW_PUBLISHED;
  await ExamQuestionRationaleCandidate.deleteMany({});
  await ExamQuestion.deleteMany({});
  callOpenAiJson.mockClear();
});

describe("V2.3B1 review-context auth", () => {
  test("anonymous rejected", async () => {
    const res = await request(app).get("/api/admin/exam-question-rationale-review-context").query({
      questionId: new mongoose.Types.ObjectId().toString(),
      partLabel: "a",
    });
    expect([401, 403]).toContain(res.status);
  });

  test("student rejected", async () => {
    const { token } = await loginAs("v23b1-student@test.com", "student");
    const res = await getReview(token, {
      questionId: new mongoose.Types.ObjectId().toString(),
      partLabel: "a",
    });
    expect(res.status).toBe(403);
  });

  test("teacher rejected", async () => {
    const { token } = await loginAs("v23b1-teacher@test.com", "teacher");
    const res = await getReview(token, {
      questionId: new mongoose.Types.ObjectId().toString(),
      partLabel: "a",
    });
    expect(res.status).toBe(403);
  });

  test("parent rejected", async () => {
    const { token } = await loginAs("v23b1-parent@test.com", "parent");
    const res = await getReview(token, {
      questionId: new mongoose.Types.ObjectId().toString(),
      partLabel: "a",
    });
    expect(res.status).toBe(403);
  });

  test("admin accepted", async () => {
    const { token, user } = await loginAs("v23b1-admin@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(200);
    expect(res.body.questionId).toBe(q._id.toString());
    expect(res.body.readOnly).toBe(true);
  });

  test("content_manager accepted", async () => {
    const { token } = await loginAs("v23b1-cm@test.com", "teacher", "content_manager");
    const owner = await User.create({
      email: "v23b1-owner@test.com",
      password: hashedPassword,
      firstName: "O",
      lastName: "W",
      userType: "teacher",
      isEmailVerified: true,
    });
    const q = await createEligibleDraft(owner._id);
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(200);
  });
});

describe("V2.3B1 review-context validation and source", () => {
  test("malformed questionId", async () => {
    const { token } = await loginAs("v23b1-badqid@test.com", "admin");
    const res = await getReview(token, { questionId: "not-an-id", partLabel: "a" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_QUESTION_ID");
  });

  test("malformed partLabel", async () => {
    const { token } = await loginAs("v23b1-badpart@test.com", "admin");
    const res = await getReview(token, {
      questionId: new mongoose.Types.ObjectId().toString(),
      partLabel: "",
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_PART_LABEL");
  });

  test("unexpected query param rejected", async () => {
    const { token, user } = await loginAs("v23b1-extraq@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const res = await getReview(token, {
      questionId: q._id.toString(),
      partLabel: "a",
      explanation: "inject",
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("UNEXPECTED_QUERY_PARAM");
  });

  test("question not found", async () => {
    const { token } = await loginAs("v23b1-nf@test.com", "admin");
    const res = await getReview(token, {
      questionId: new mongoose.Types.ObjectId().toString(),
      partLabel: "a",
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("QUESTION_NOT_FOUND");
  });

  test("duplicate part labels rejected", async () => {
    const { token, user } = await loginAs("v23b1-dup@test.com", "admin");
    const q = await createEligibleDraft(user._id, {
      parts: [mcqPart("a", undefined), mcqPart("a", undefined)],
    });
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DUPLICATE_PART_LABEL");
  });

  test("wrong part type rejected", async () => {
    const { token, user } = await loginAs("v23b1-wpt@test.com", "admin");
    const q = await createEligibleDraft(user._id, {
      parts: [
        {
          label: "a",
          type: "short",
          marks: 2,
          questionText: "Explain photosynthesis.",
          markScheme: [],
        },
      ],
    });
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("WRONG_PART_TYPE");
  });

  test("invalid correctIndex rejected", async () => {
    const { token, user } = await loginAs("v23b1-ici@test.com", "admin");
    const q = await createEligibleDraft(user._id, {
      parts: [mcqPart("a", undefined, { correctIndex: 99 })],
    });
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INVALID_CORRECT_INDEX");
  });

  test("missing topic context rejected", async () => {
    const { token, user } = await loginAs("v23b1-tax@test.com", "admin");
    const q = await createEligibleDraft(user._id, { topic: "", topicKey: "" });
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("MISSING_TAXONOMY_CONTEXT");
  });

  test("classification, correct option, fingerprint parity, sourceUpdatedAt", async () => {
    const { token, user } = await loginAs("v23b1-fp@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(200);
    expect(res.body.rationaleBucket).toBe("missing");
    expect(res.body.correctOption).toBe("Light");
    expect(res.body.correctIndex).toBe(2);
    expect(res.body.options[2].isCorrect).toBe(true);
    expect(res.body.currentSourceFingerprint).toBe(expectedFingerprint(q.toObject(), "a"));
    expect(res.body.sourceUpdatedAt).toBeTruthy();
    expect(res.body.generationFeatureEnabled).toBe(false);
    expect(res.body.publishedGenerationEnabled).toBe(false);
    expect(res.body.canGenerate).toBe(true);
    expect(callOpenAiJson).not.toHaveBeenCalled();
  });
});

describe("V2.3B1 latest candidate and stale", () => {
  test("no candidate returns null", async () => {
    const { token, user } = await loginAs("v23b1-nocand@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(200);
    expect(res.body.latestCandidate).toBeNull();
    expect(res.body.candidateIsStale).toBe(false);
  });

  test("latest candidate returned; lease token and generatedBy omitted; stale false", async () => {
    const { token, user } = await loginAs("v23b1-cand@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const fp = expectedFingerprint(q.toObject(), "a");
    await ExamQuestionRationaleCandidate.create({
      questionId: q._id,
      partLabel: "a",
      sourceFingerprint: fp,
      sourceUpdatedAt: q.updatedAt,
      sourceSnapshot: {
        subject: "Biology",
        examBoard: "AQA",
        level: "GCSE",
        tier: "",
        topic: "Photosynthesis",
        topicKey: "photosynthesis",
        questionStatus: "draft",
        sharedStem: q.sharedStem,
        questionText: "Which factor is essential? (a)",
        options: ["Water", "Oxygen", "Light", "Temperature"],
        correctIndex: 2,
        correctOption: "Light",
        marks: 1,
        markScheme: ["Award 1 mark for selecting Light."],
        imageContextText: "",
        currentExplanation: "",
      },
      explanation: "Candidate explanation about light and chlorophyll.",
      status: "pending",
      active: true,
      attemptNumber: 1,
      generationGroupKey: `${q._id}:a:${fp}`,
      idempotencyKey: "review-cand-key-0001",
      promptVersion: "v1",
      model: "gpt-4o-mini",
      generatedBy: user._id,
      generatedAt: new Date(),
      completedAt: new Date(),
      generationLeaseToken: "secret-lease-token-must-not-leak",
      generationLeaseExpiresAt: new Date(Date.now() + 600000),
      failureCode: "",
      validationIssueCodes: [],
    });

    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(200);
    expect(res.body.latestCandidate).toBeTruthy();
    expect(res.body.latestCandidate.explanation).toMatch(/chlorophyll/i);
    expect(res.body.latestCandidate.status).toBe("pending");
    expect(res.body.candidateIsStale).toBe(false);
    expect(res.body.latestCandidate.generationLeaseToken).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/secret-lease-token/);
    expect(res.body.latestCandidate.generatedBy).toBeUndefined();
    expect(res.body.canGenerate).toBe(false);
    expect(res.body.canGenerateReason).toBe("ACTIVE_CANDIDATE_EXISTS");
  });

  test("stale candidate true when fingerprint differs", async () => {
    const { token, user } = await loginAs("v23b1-stale@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    await ExamQuestionRationaleCandidate.create({
      questionId: q._id,
      partLabel: "a",
      sourceFingerprint: "a".repeat(64),
      sourceUpdatedAt: q.updatedAt,
      sourceSnapshot: {
        subject: "Biology",
        examBoard: "AQA",
        level: "GCSE",
        tier: "",
        topic: "Photosynthesis",
        topicKey: "photosynthesis",
        questionStatus: "draft",
        sharedStem: "",
        questionText: "old",
        options: ["A", "B"],
        correctIndex: 0,
        correctOption: "A",
        marks: 1,
        markScheme: [],
        imageContextText: "",
        currentExplanation: "",
      },
      explanation: "Old candidate text",
      status: "failed",
      active: false,
      attemptNumber: 1,
      generationGroupKey: `${q._id}:a:${"a".repeat(64)}`,
      idempotencyKey: "review-stale-key-0001",
      promptVersion: "v1",
      model: "gpt-4o-mini",
      generatedBy: user._id,
      generatedAt: new Date(),
      completedAt: new Date(),
      failureCode: "LLM_ERROR",
      validationIssueCodes: ["TOO_SHORT"],
    });

    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(200);
    expect(res.body.candidateIsStale).toBe(true);
    expect(res.body.latestCandidate.failureCode).toBe("LLM_ERROR");
    expect(res.body.latestCandidate.validationIssueCodes).toContain("TOO_SHORT");
  });
});

describe("V2.3B1 flags and published / image", () => {
  test("published canGenerate false", async () => {
    const { token, user } = await loginAs("v23b1-pub@test.com", "admin");
    const q = await createEligibleDraft(user._id, { status: "published" });
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(200);
    expect(res.body.canGenerate).toBe(false);
    expect(res.body.canGenerateReason).toBe("PUBLISHED_NOT_ENABLED");
    expect(res.body.generationFeatureEnabled).toBe(false);
  });

  test("feature disabled reflected safely", async () => {
    const { token, user } = await loginAs("v23b1-flag@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(200);
    expect(res.body.generationFeatureEnabled).toBe(false);
    expect(res.body.publishedGenerationEnabled).toBe(false);
  });

  test("image context requirement reflected", async () => {
    const { token, user } = await loginAs("v23b1-img@test.com", "admin");
    const q = await createEligibleDraft(user._id, {
      imageUrl: "https://example.com/diagram.png",
      assets: [{ type: "image", url: "https://example.com/diagram.png", alt: "" }],
    });
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(200);
    expect(res.body.imageContextRequired).toBe(true);
    expect(res.body.canGenerate).toBe(false);
    expect(res.body.canGenerateReason).toBe("IMAGE_CONTEXT_REQUIRED");
    expect(JSON.stringify(res.body)).not.toMatch(/diagram\.png/);
  });

  test("K: text-only and stub assets do not require image context", async () => {
    const { token, user } = await loginAs("v23b1-stub@test.com", "admin");
    const q = await createEligibleDraft(user._id, {
      imageUrl: "",
      assets: [{ type: "image", url: null, alt: null }, {}],
    });
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(200);
    expect(res.body.imageContextRequired).toBe(false);
    expect(res.body.canGenerateReason).not.toBe("IMAGE_CONTEXT_REQUIRED");
    expect(res.body.canGenerate).toBe(true);
  });

  test("L: real visual without trusted context still sets IMAGE_CONTEXT_REQUIRED", async () => {
    const { token, user } = await loginAs("v23b1-img2@test.com", "admin");
    const q = await createEligibleDraft(user._id, {
      imageUrl: "https://example.com/real.png",
      assets: [{ type: "image", url: "https://example.com/real.png", alt: "" }],
    });
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(200);
    expect(res.body.imageContextRequired).toBe(true);
    expect(res.body.canGenerateReason).toBe("IMAGE_CONTEXT_REQUIRED");
  });
});

describe("V2.3B1 no mutation", () => {
  test("GET does not mutate ExamQuestion, Candidate, or Lesson", async () => {
    const { token, user } = await loginAs("v23b1-nomut@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const lesson = await Lesson.create({
      title: "V23B1 mutation guard",
      description: "Mutation guard",
      content: "Content",
      teacherId: user._id,
      subject: "Biology",
      level: "GCSE",
      topic: "Photosynthesis",
      status: "draft",
      pages: [],
    });
    const fp = expectedFingerprint(q.toObject(), "a");
    const cand = await ExamQuestionRationaleCandidate.create({
      questionId: q._id,
      partLabel: "a",
      sourceFingerprint: fp,
      sourceUpdatedAt: q.updatedAt,
      sourceSnapshot: {
        subject: "Biology",
        examBoard: "AQA",
        level: "GCSE",
        tier: "",
        topic: "Photosynthesis",
        topicKey: "photosynthesis",
        questionStatus: "draft",
        sharedStem: q.sharedStem,
        questionText: "Which factor is essential? (a)",
        options: ["Water", "Oxygen", "Light", "Temperature"],
        correctIndex: 2,
        correctOption: "Light",
        marks: 1,
        markScheme: ["Award 1 mark for selecting Light."],
        imageContextText: "",
        currentExplanation: "",
      },
      explanation: "Stable candidate",
      status: "pending",
      active: true,
      attemptNumber: 1,
      generationGroupKey: `${q._id}:a:${fp}`,
      idempotencyKey: "review-nomut-key-0001",
      promptVersion: "v1",
      model: "gpt-4o-mini",
      generatedBy: user._id,
      generatedAt: new Date("2026-01-01T00:00:00.000Z"),
      completedAt: new Date("2026-01-01T00:01:00.000Z"),
      failureCode: "",
      validationIssueCodes: [],
    });

    const beforeQ = (await ExamQuestion.findById(q._id).lean());
    const beforeC = (await ExamQuestionRationaleCandidate.findById(cand._id).lean());
    const beforeL = (await Lesson.findById(lesson._id).lean());
    const beforeCandCount = await ExamQuestionRationaleCandidate.countDocuments();

    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(200);

    const afterQ = await ExamQuestion.findById(q._id).lean();
    const afterC = await ExamQuestionRationaleCandidate.findById(cand._id).lean();
    const afterL = await Lesson.findById(lesson._id).lean();
    const afterCandCount = await ExamQuestionRationaleCandidate.countDocuments();

    expect(afterQ).toEqual(beforeQ);
    expect(afterC).toEqual(beforeC);
    expect(afterL).toEqual(beforeL);
    expect(afterCandCount).toBe(beforeCandCount);
    expect(String(afterQ.updatedAt)).toBe(String(beforeQ.updatedAt));
    expect(afterQ.__v).toBe(beforeQ.__v);
    expect(callOpenAiJson).not.toHaveBeenCalled();
  });
});
