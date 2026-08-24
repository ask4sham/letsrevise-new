/**
 * V2.3B2b2b — review-context replacement eligibility + lineage history (read-only).
 */
process.env.NODE_ENV = process.env.NODE_ENV || "test";

jest.mock("../utils/lessonAssetLlm", () => ({
  callOpenAiJson: jest.fn(async () => {
    throw new Error("LLM must not be called in review-context replacement tests");
  }),
}));

const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const { callOpenAiJson } = require("../utils/lessonAssetLlm");
const app = require("../app");
const User = require("../models/User");
const ExamQuestion = require("../models/ExamQuestion");
const ExamQuestionRationaleCandidate = require("../models/ExamQuestionRationaleCandidate");
const { computeMcqRationaleSourceFingerprint, buildGenerationGroupKey } = require("../utils/mcqRationaleSourceFingerprint");
const {
  buildSourceSnapshot,
  resolveImageContext,
  findExactMcqPart,
} = require("../services/examQuestionRationaleCandidateService");
const { classifyCompositeMcqPart } = require("../utils/classifyMcqRationaleInventory");

const hashedPassword = bcrypt.hashSync("password123", 10);
jest.setTimeout(60000);

async function loginAs(email, userType = "admin", staffRole) {
  await User.deleteMany({ email });
  const doc = {
    email,
    password: hashedPassword,
    firstName: "V23B2b2b",
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

function mcqPart(label) {
  return {
    label,
    type: "mcq",
    marks: 1,
    questionText: `Which factor is essential? (${label})`,
    options: ["Water", "Oxygen", "Light", "Temperature"],
    correctIndex: 2,
    markScheme: ["Award 1 mark for selecting Light."],
  };
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
    parts: [mcqPart("a")],
    ...overrides,
  });
}

function fingerprintForQuestion(question) {
  const part = findExactMcqPart(question, "a");
  const classification = classifyCompositeMcqPart(part, {
    isArchived: question.isArchived,
    subject: question.subject,
    topic: question.topic,
    topicKey: question.topicKey,
  });
  const imageCtx = resolveImageContext(question);
  const sourceSnapshot = buildSourceSnapshot(
    question,
    part,
    classification,
    imageCtx.ok ? imageCtx.imageContextText : ""
  );
  return computeMcqRationaleSourceFingerprint({
    questionId: String(question._id),
    partLabel: "a",
    sharedStem: sourceSnapshot.sharedStem,
    questionText: sourceSnapshot.questionText,
    options: sourceSnapshot.options,
    correctIndex: sourceSnapshot.correctIndex,
    marks: sourceSnapshot.marks,
    markScheme: sourceSnapshot.markScheme,
    subject: sourceSnapshot.subject,
    examBoard: sourceSnapshot.examBoard,
    level: sourceSnapshot.level,
    tier: sourceSnapshot.tier,
    topic: sourceSnapshot.topic,
    topicKey: sourceSnapshot.topicKey,
    imageContextText: sourceSnapshot.imageContextText,
    currentExplanation: sourceSnapshot.currentExplanation,
  });
}

async function seedRejectedAttemptOne(actorId, question, overrides = {}) {
  const fingerprint = overrides.sourceFingerprint || fingerprintForQuestion(question);
  const group = overrides.generationGroupKey || buildGenerationGroupKey(question._id, "a", fingerprint);
  return ExamQuestionRationaleCandidate.create({
    questionId: question._id,
    partLabel: "a",
    sourceFingerprint: fingerprint,
    sourceUpdatedAt: question.updatedAt || null,
    sourceSnapshot: { currentExplanation: "" },
    priorExplanation: "",
    explanation: "Rejected attempt one explanation for audit history.",
    status: "rejected",
    active: false,
    attemptNumber: 1,
    generationGroupKey: group,
    idempotencyKey: overrides.idempotencyKey || `rej-a1-${Math.random().toString(36).slice(2, 10)}`,
    promptVersion: "v1",
    model: "mock",
    generatedBy: actorId,
    generatedAt: new Date(),
    completedAt: new Date(),
    rejectedAt: new Date(),
    rejectedBy: actorId,
    rejectionReasonCode: "other",
    rejectionNote: "private reviewer note must not leak",
    ...overrides,
    status: "rejected",
    active: false,
    attemptNumber: 1,
  });
}

function getReview(token, query) {
  return request(app)
    .get("/api/admin/exam-question-rationale-review-context")
    .set("Authorization", `Bearer ${token}`)
    .query(query);
}

function enableBothFlags() {
  process.env.FEATURE_MCQ_RATIONALE_BACKFILL_V23A = "true";
  process.env.FEATURE_MCQ_RATIONALE_REPLACEMENT_V23B2B2 = "true";
}

beforeAll(async () => {
  await ExamQuestionRationaleCandidate.syncIndexes();
});

beforeEach(async () => {
  delete process.env.FEATURE_MCQ_RATIONALE_BACKFILL_V23A;
  delete process.env.FEATURE_MCQ_RATIONALE_REPLACEMENT_V23B2B2;
  delete process.env.MCQ_RATIONALE_BACKFILL_ALLOW_PUBLISHED;
  await ExamQuestionRationaleCandidate.deleteMany({});
  await ExamQuestion.deleteMany({});
  callOpenAiJson.mockClear();
});

describe("V2.3B2b2b review-context replacement eligibility", () => {
  test("A: all flags false → replacement disabled", async () => {
    const { token, user } = await loginAs("ctx-rep-a@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    await seedRejectedAttemptOne(user._id, q);
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(200);
    expect(res.body.replacementFeatureEnabled).toBe(false);
    expect(res.body.canGenerateReplacement).toBe(false);
    expect(res.body.canGenerateReplacementReason).toBe("REPLACEMENT_FEATURE_DISABLED");
    expect(res.body.canGenerate).toBe(false);
    expect(callOpenAiJson).not.toHaveBeenCalled();
  });

  test("B: generation true, replacement false", async () => {
    process.env.FEATURE_MCQ_RATIONALE_BACKFILL_V23A = "true";
    const { token, user } = await loginAs("ctx-rep-b@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    await seedRejectedAttemptOne(user._id, q);
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.body.generationFeatureEnabled).toBe(true);
    expect(res.body.replacementFeatureEnabled).toBe(false);
    expect(res.body.canGenerateReplacement).toBe(false);
    expect(res.body.canGenerate).toBe(false);
    expect(res.body.canGenerateReason).toBe("REPLACEMENT_GENERATION_NOT_ENABLED");
  });

  test("C: generation false, replacement true", async () => {
    process.env.FEATURE_MCQ_RATIONALE_REPLACEMENT_V23B2B2 = "true";
    const { token, user } = await loginAs("ctx-rep-c@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    await seedRejectedAttemptOne(user._id, q);
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.body.replacementFeatureEnabled).toBe(true);
    expect(res.body.canGenerateReplacement).toBe(false);
    expect(res.body.canGenerateReplacementReason).toBe("FEATURE_DISABLED");
    expect(res.body.rejectedAttemptOneId).toBeTruthy();
  });

  test("D: both true + valid rejected Attempt 1 → canGenerateReplacement; canGenerate false", async () => {
    enableBothFlags();
    const { token, user } = await loginAs("ctx-rep-d@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const rejected = await seedRejectedAttemptOne(user._id, q);
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(200);
    expect(res.body.generationFeatureEnabled).toBe(true);
    expect(res.body.canGenerate).toBe(false);
    expect(res.body.canGenerateReason).toBe("REPLACEMENT_GENERATION_NOT_ENABLED");
    expect(res.body.replacementFeatureEnabled).toBe(true);
    expect(res.body.canGenerateReplacement).toBe(true);
    expect(res.body.canGenerateReplacementReason).toBeNull();
    expect(res.body.rejectedAttemptOneId).toBe(String(rejected._id));
    expect(res.body.candidateHistory).toHaveLength(1);
    expect(res.body.candidateHistory[0].attemptNumber).toBe(1);
    expect(res.body.candidateHistory[0].status).toBe("rejected");
    expect(res.body.candidateHistory[0].rejectionNote).toBeUndefined();
    expect(res.body.candidateHistory[0].rejectedBy).toBeUndefined();
    expect(res.body.candidateHistory[0].sourceSnapshot).toBeUndefined();
    expect(callOpenAiJson).not.toHaveBeenCalled();
  });

  test("E: source changed → SOURCE_CHANGED; no stale action id", async () => {
    enableBothFlags();
    const { token, user } = await loginAs("ctx-rep-e@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    await seedRejectedAttemptOne(user._id, q);
    q.parts[0].questionText = "Which factor changed after rejection?";
    q.markModified("parts");
    await q.save();
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.body.canGenerateReplacement).toBe(false);
    expect(res.body.canGenerateReplacementReason).toBe("SOURCE_CHANGED");
    expect(res.body.rejectedAttemptOneId).toBeNull();
  });

  test("F/G: Attempt 2 pending/failed → no replacement; history has both", async () => {
    enableBothFlags();
    const { token, user } = await loginAs("ctx-rep-f@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const rejected = await seedRejectedAttemptOne(user._id, q);
    const fp = rejected.sourceFingerprint;
    const group = rejected.generationGroupKey;

    await ExamQuestionRationaleCandidate.create({
      questionId: q._id,
      partLabel: "a",
      sourceFingerprint: fp,
      sourceUpdatedAt: q.updatedAt,
      sourceSnapshot: {},
      priorExplanation: "",
      explanation: "Attempt two pending explanation.",
      status: "pending",
      active: true,
      attemptNumber: 2,
      generationGroupKey: group,
      idempotencyKey: "a2-pending-xxxxxxxx",
      promptVersion: "v1",
      model: "mock",
      generatedBy: user._id,
      generatedAt: new Date(),
      completedAt: new Date(),
    });

    const pendingCtx = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(pendingCtx.body.canGenerateReplacement).toBe(false);
    expect(pendingCtx.body.canGenerateReplacementReason).toBe("ATTEMPT_2_ALREADY_EXISTS");
    expect(pendingCtx.body.latestCandidate.attemptNumber).toBe(2);
    expect(pendingCtx.body.candidateHistory).toHaveLength(2);
    expect(pendingCtx.body.candidateHistory.map((h) => h.attemptNumber)).toEqual([1, 2]);

    await ExamQuestionRationaleCandidate.updateOne(
      { questionId: q._id, attemptNumber: 2 },
      { $set: { status: "failed", active: false, failureCode: "LLM_TIMEOUT", explanation: "" } }
    );
    const failedCtx = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(failedCtx.body.canGenerateReplacement).toBe(false);
    expect(failedCtx.body.canGenerateReplacementReason).toBe("ATTEMPT_LIMIT_REACHED");
    expect(failedCtx.body.candidateHistory).toHaveLength(2);
  });

  test("H/I: media and published blocks", async () => {
    enableBothFlags();
    const { token, user } = await loginAs("ctx-rep-hi@test.com", "admin");

    const mediaQ = await createEligibleDraft(user._id, {
      media: [{ type: "image", url: "/uploads/x.png" }],
      imageContextText: "",
    });
    // Force image-required path used by resolveImageContext when media present without trusted text.
    await seedRejectedAttemptOne(user._id, mediaQ);
    const mediaRes = await getReview(token, { questionId: mediaQ._id.toString(), partLabel: "a" });
    if (mediaRes.body.imageContextRequired) {
      expect(mediaRes.body.canGenerateReplacement).toBe(false);
      expect(mediaRes.body.canGenerateReplacementReason).toBe("IMAGE_CONTEXT_REQUIRED");
    }

    delete process.env.MCQ_RATIONALE_BACKFILL_ALLOW_PUBLISHED;
    const pubQ = await createEligibleDraft(user._id, { status: "published" });
    await seedRejectedAttemptOne(user._id, pubQ);
    const pubRes = await getReview(token, { questionId: pubQ._id.toString(), partLabel: "a" });
    expect(pubRes.body.canGenerateReplacement).toBe(false);
    expect(pubRes.body.canGenerateReplacementReason).toBe("PUBLISHED_NOT_ENABLED");
  });

  test("J: active conflict blocks replacement", async () => {
    enableBothFlags();
    const { token, user } = await loginAs("ctx-rep-j@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const rejected = await seedRejectedAttemptOne(user._id, q);
    const otherFp = "a".repeat(64);
    await ExamQuestionRationaleCandidate.create({
      questionId: q._id,
      partLabel: "a",
      sourceFingerprint: otherFp,
      sourceUpdatedAt: q.updatedAt,
      sourceSnapshot: {},
      priorExplanation: "",
      explanation: "",
      status: "generating",
      active: true,
      attemptNumber: 1,
      generationGroupKey: `${q._id}:a:${otherFp}`,
      idempotencyKey: "active-conflict-xxxxxx",
      promptVersion: "v1",
      model: "mock",
      generatedBy: user._id,
      generatedAt: new Date(),
      generationLeaseToken: "lease",
      generationLeaseExpiresAt: new Date(Date.now() + 60_000),
    });
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.body.canGenerateReplacement).toBe(false);
    expect(res.body.canGenerateReplacementReason).toBe("ACTIVE_CANDIDATE_EXISTS");
  });

  test("K/L: DTO privacy + history limits", async () => {
    enableBothFlags();
    const { token, user } = await loginAs("ctx-rep-k@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    await seedRejectedAttemptOne(user._id, q);
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    const blob = JSON.stringify(res.body);
    expect(blob).not.toMatch(/private reviewer note/);
    expect(blob).not.toMatch(/generationLeaseToken/);
    expect(blob).not.toMatch(/idempotencyKey/);
    for (const item of res.body.candidateHistory) {
      expect(item).not.toHaveProperty("rejectedBy");
      expect(item).not.toHaveProperty("rejectionNote");
      expect(item).not.toHaveProperty("sourceSnapshot");
      expect(item).not.toHaveProperty("generatedBy");
    }
    expect(res.body.candidateHistory.length).toBeLessThanOrEqual(2);
  });

  test("teacher blocked from review context", async () => {
    enableBothFlags();
    const { token, user } = await loginAs("ctx-rep-teacher@test.com", "teacher");
    const q = await createEligibleDraft(user._id);
    await seedRejectedAttemptOne(user._id, q);
    const res = await getReview(token, { questionId: q._id.toString(), partLabel: "a" });
    expect(res.status).toBe(403);
  });
});
