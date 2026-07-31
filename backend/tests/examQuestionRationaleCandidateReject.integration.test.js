/**
 * Integration: V2.3B2b1 reject pending rationale Candidate (no LLM, no ExamQuestion writes).
 */
process.env.NODE_ENV = process.env.NODE_ENV || "test";

jest.mock("../utils/lessonAssetLlm", () => ({
  callOpenAiJson: jest.fn(async () => ({
    explanation:
      "Light is required for photosynthesis because chlorophyll absorbs light energy to make glucose.",
  })),
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
  findExactMcqPart,
} = require("../services/examQuestionRationaleCandidateService");
const { classifyCompositeMcqPart } = require("../utils/classifyMcqRationaleInventory");

const hashedPassword = bcrypt.hashSync("password123", 10);
jest.setTimeout(60000);

const GOOD_EXPLANATION =
  "Light is required for photosynthesis because chlorophyll absorbs light energy to make glucose.";

async function loginAs(email, userType = "admin", staffRole) {
  await User.deleteMany({ email });
  const doc = {
    email,
    password: hashedPassword,
    firstName: "V23B2b1",
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

async function seedPendingCandidate(actorId, question, overrides = {}) {
  const fp = overrides.sourceFingerprint || fingerprintForQuestion(question);
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
  return ExamQuestionRationaleCandidate.create({
    questionId: question._id,
    partLabel: "a",
    sourceFingerprint: fp,
    sourceUpdatedAt: question.updatedAt || null,
    sourceSnapshot,
    priorExplanation: "",
    explanation: GOOD_EXPLANATION,
    status: "pending",
    active: true,
    attemptNumber: 1,
    generationGroupKey: `${question._id}:a:${fp}`,
    idempotencyKey: overrides.idempotencyKey || `reject-seed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    promptVersion: "v23a.1",
    model: "gpt-4o-mini",
    generatedBy: actorId,
    generatedAt: new Date(),
    completedAt: new Date(),
    ...overrides,
    sourceFingerprint: fp,
    status: overrides.status != null ? overrides.status : "pending",
    active: overrides.active != null ? overrides.active : true,
  });
}

function rejectCandidate(token, candidateId, body) {
  return request(app)
    .post(`/api/admin/exam-question-rationale-candidates/${candidateId}/reject`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

beforeAll(async () => {
  await ExamQuestionRationaleCandidate.syncIndexes();
});

beforeEach(async () => {
  delete process.env.FEATURE_MCQ_RATIONALE_BACKFILL_V23A;
  delete process.env.MCQ_RATIONALE_BACKFILL_ALLOW_PUBLISHED;
  process.env.FEATURE_MCQ_RATIONALE_CANDIDATE_REJECT_V23B2B = "true";
  await ExamQuestionRationaleCandidate.deleteMany({});
  await ExamQuestion.deleteMany({});
  await Lesson.deleteMany({});
  callOpenAiJson.mockClear();
});

describe("V2.3B2b1 reject auth and flags", () => {
  test("A: feature disabled — no mutation, no LLM", async () => {
    process.env.FEATURE_MCQ_RATIONALE_CANDIDATE_REJECT_V23B2B = "false";
    const { token, user } = await loginAs("rej-flag-off@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const cand = await seedPendingCandidate(user._id, q);
    const before = await ExamQuestionRationaleCandidate.findById(cand._id).lean();
    const res = await rejectCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      reasonCode: "unclear",
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("FEATURE_DISABLED");
    const after = await ExamQuestionRationaleCandidate.findById(cand._id).lean();
    expect(after.status).toBe(before.status);
    expect(after.active).toBe(before.active);
    expect(callOpenAiJson).not.toHaveBeenCalled();
  });

  test("B: roles — admin and content_manager allowed; others blocked", async () => {
    const { token: adminToken, user: admin } = await loginAs("rej-admin@test.com", "admin");
    const q = await createEligibleDraft(admin._id);
    const cand = await seedPendingCandidate(admin._id, q);
    const ok = await rejectCandidate(adminToken, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      reasonCode: "inaccurate",
    });
    expect(ok.status).toBe(200);

    const { token: cmToken } = await loginAs("rej-cm@test.com", "teacher", "content_manager");
    const q2 = await createEligibleDraft(admin._id);
    const cand2 = await seedPendingCandidate(admin._id, q2);
    const cmOk = await rejectCandidate(cmToken, cand2._id.toString(), {
      questionId: q2._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand2.sourceFingerprint,
      reasonCode: "too_generic",
    });
    expect(cmOk.status).toBe(200);

    for (const [email, role] of [
      ["rej-student@test.com", "student"],
      ["rej-teacher@test.com", "teacher"],
      ["rej-parent@test.com", "parent"],
    ]) {
      const { token } = await loginAs(email, role);
      const qn = await createEligibleDraft(admin._id);
      const c = await seedPendingCandidate(admin._id, qn);
      const res = await rejectCandidate(token, c._id.toString(), {
        questionId: qn._id.toString(),
        partLabel: "a",
        expectedSourceFingerprint: c.sourceFingerprint,
        reasonCode: "unclear",
      });
      expect(res.status).toBe(403);
    }

    const anon = await request(app)
      .post(`/api/admin/exam-question-rationale-candidates/${new mongoose.Types.ObjectId()}/reject`)
      .send({});
    expect([401, 403]).toContain(anon.status);
    expect(callOpenAiJson).not.toHaveBeenCalled();
  });
});

describe("V2.3B2b1 reject happy path and preservation", () => {
  test("C/D/E: valid rejection preserves educational fields; no EQ/Lesson/LLM", async () => {
    const { token, user } = await loginAs("rej-happy@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const lesson = await Lesson.create({
      title: "Reject regression lesson",
      description: "Reject regression lesson description",
      content: "Reject regression lesson content",
      teacherId: user._id,
      status: "draft",
      subject: "Biology",
      level: "IGCSE",
      topic: "Mitosis",
    });
    const eqBefore = JSON.parse(JSON.stringify(await ExamQuestion.findById(q._id).lean()));
    const lessonBefore = JSON.parse(JSON.stringify(await Lesson.findById(lesson._id).lean()));
    const cand = await seedPendingCandidate(user._id, q);
    const snapBefore = JSON.parse(JSON.stringify(cand.sourceSnapshot));

    const res = await rejectCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      reasonCode: "unsupported_detail",
      note: " Mentions unstated diagram. ",
    });

    expect(res.status).toBe(200);
    expect(res.body.replayed).toBe(false);
    expect(res.body.candidate.status).toBe("rejected");
    expect(res.body.candidate.explanation).toBe(GOOD_EXPLANATION);
    expect(res.body.candidate.rejectionReasonCode).toBe("unsupported_detail");
    expect(res.body.candidate.rejectedAt).toBeTruthy();
    expect(res.body.candidate.rejectedBy).toBeUndefined();
    expect(res.body.candidate.rejectionNote).toBeUndefined();

    const stored = await ExamQuestionRationaleCandidate.findById(cand._id).lean();
    expect(stored.status).toBe("rejected");
    expect(stored.active).toBe(false);
    expect(String(stored.rejectedBy)).toBe(String(user._id));
    expect(stored.rejectionReasonCode).toBe("unsupported_detail");
    expect(stored.rejectionNote).toBe("Mentions unstated diagram.");
    expect(stored.explanation).toBe(GOOD_EXPLANATION);
    expect(stored.sourceFingerprint).toBe(cand.sourceFingerprint);
    expect(stored.attemptNumber).toBe(1);
    expect(stored.generationGroupKey).toBe(cand.generationGroupKey);
    expect(stored.sourceSnapshot).toEqual(snapBefore);

    const eqAfter = await ExamQuestion.findById(q._id).lean();
    const lessonAfter = await Lesson.findById(lesson._id).lean();
    expect(JSON.parse(JSON.stringify(eqAfter))).toEqual(eqBefore);
    expect(JSON.parse(JSON.stringify(lessonAfter))).toEqual(lessonBefore);
    expect(callOpenAiJson).not.toHaveBeenCalled();

    const blocking = await ExamQuestionRationaleCandidate.findOne({
      questionId: q._id,
      partLabel: "a",
      active: true,
      status: { $in: ["generating", "pending"] },
    });
    expect(blocking).toBeNull();
  });
});

describe("V2.3B2b1 reject validation and conflicts", () => {
  test("F: validation errors", async () => {
    const { token, user } = await loginAs("rej-val@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const cand = await seedPendingCandidate(user._id, q);

    const badId = await rejectCandidate(token, "not-an-id", {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      reasonCode: "unclear",
    });
    expect(badId.status).toBe(400);
    expect(badId.body.code).toBe("INVALID_CANDIDATE_ID");

    const badReason = await rejectCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      reasonCode: "not_a_real_reason",
    });
    expect(badReason.status).toBe(400);
    expect(badReason.body.code).toBe("INVALID_REJECTION_REASON");

    const longNote = await rejectCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      reasonCode: "other",
      note: "x".repeat(301),
    });
    expect(longNote.status).toBe(400);
    expect(longNote.body.code).toBe("REJECTION_NOTE_TOO_LONG");
  });

  test("G: association and fingerprint mismatches", async () => {
    const { token, user } = await loginAs("rej-assoc@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const cand = await seedPendingCandidate(user._id, q);

    const wrongQ = await rejectCandidate(token, cand._id.toString(), {
      questionId: new mongoose.Types.ObjectId().toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      reasonCode: "unclear",
    });
    expect(wrongQ.status).toBe(409);
    expect(["CANDIDATE_ASSOCIATION_MISMATCH", "CANDIDATE_NOT_PENDING", "CANDIDATE_NOT_FOUND"]).toContain(
      wrongQ.body.code
    );

    const wrongPart = await rejectCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "b",
      expectedSourceFingerprint: cand.sourceFingerprint,
      reasonCode: "unclear",
    });
    expect(wrongPart.status).toBe(409);

    const wrongFp = await rejectCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: "c".repeat(64),
      reasonCode: "unclear",
    });
    expect(wrongFp.status).toBe(409);
    expect(wrongFp.body.code).toBe("SOURCE_FINGERPRINT_MISMATCH");
  });

  test("H/I: concurrent reject — one wins; replay is idempotent", async () => {
    const { token, user } = await loginAs("rej-race@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const cand = await seedPendingCandidate(user._id, q);
    const body = {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      reasonCode: "unclear",
      note: "same",
    };

    const [a, b] = await Promise.all([
      rejectCandidate(token, cand._id.toString(), body),
      rejectCandidate(token, cand._id.toString(), body),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 200]);
    const replayedCount = [a.body.replayed, b.body.replayed].filter(Boolean).length;
    expect(replayedCount).toBe(1);
    const freshCount = [a.body.replayed, b.body.replayed].filter((v) => v === false).length;
    expect(freshCount).toBe(1);

    const stored = await ExamQuestionRationaleCandidate.findById(cand._id).lean();
    expect(stored.status).toBe("rejected");
    expect(stored.active).toBe(false);
    const firstRejectedAt = stored.rejectedAt;

    const replay = await rejectCandidate(token, cand._id.toString(), body);
    expect(replay.status).toBe(200);
    expect(replay.body.replayed).toBe(true);
    const after = await ExamQuestionRationaleCandidate.findById(cand._id).lean();
    expect(new Date(after.rejectedAt).getTime()).toBe(new Date(firstRejectedAt).getTime());
    expect(after.rejectionReasonCode).toBe("unclear");
  });

  test("J: conflicting replay does not overwrite", async () => {
    const { token, user } = await loginAs("rej-conflict@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const cand = await seedPendingCandidate(user._id, q);
    const first = await rejectCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      reasonCode: "inaccurate",
    });
    expect(first.status).toBe(200);

    const second = await rejectCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      reasonCode: "unclear",
    });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("CANDIDATE_ALREADY_REJECTED");
    const stored = await ExamQuestionRationaleCandidate.findById(cand._id).lean();
    expect(stored.rejectionReasonCode).toBe("inaccurate");
  });

  test("K: state constraints", async () => {
    const { token, user } = await loginAs("rej-state@test.com", "admin");
    const q = await createEligibleDraft(user._id);

    for (const status of ["failed", "generating", "approved", "superseded", "stale"]) {
      const c = await seedPendingCandidate(user._id, q, {
        status,
        active: status === "generating",
        idempotencyKey: `state-${status}-${Date.now()}`,
      });
      const res = await rejectCandidate(token, c._id.toString(), {
        questionId: q._id.toString(),
        partLabel: "a",
        expectedSourceFingerprint: c.sourceFingerprint,
        reasonCode: "unclear",
      });
      expect(res.status).toBe(409);
    }

    const inactivePending = await seedPendingCandidate(user._id, q, {
      status: "pending",
      active: false,
      idempotencyKey: `inactive-pending-${Date.now()}`,
    });
    const inactiveRes = await rejectCandidate(token, inactivePending._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: inactivePending.sourceFingerprint,
      reasonCode: "unclear",
    });
    expect(inactiveRes.status).toBe(409);
    expect(inactiveRes.body.code).toBe("CANDIDATE_NOT_ACTIVE");
  });

  test("L: published source Candidate may be rejected", async () => {
    const { token, user } = await loginAs("rej-pub@test.com", "admin");
    const q = await createEligibleDraft(user._id, { status: "published" });
    const cand = await seedPendingCandidate(user._id, q);
    const eqBefore = JSON.parse(JSON.stringify(await ExamQuestion.findById(q._id).lean()));
    const res = await rejectCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      reasonCode: "unsuitable_exam_language",
    });
    expect(res.status).toBe(200);
    expect(res.body.candidate.status).toBe("rejected");
    const eqAfter = await ExamQuestion.findById(q._id).lean();
    expect(JSON.parse(JSON.stringify(eqAfter))).toEqual(eqBefore);
    expect(callOpenAiJson).not.toHaveBeenCalled();
  });
});

describe("V2.3B2b1 review-context canReject", () => {
  test("canReject true only when feature on and pending active matching fingerprint", async () => {
    const { token, user } = await loginAs("rej-ctx@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const cand = await seedPendingCandidate(user._id, q);

    const on = await request(app)
      .get("/api/admin/exam-question-rationale-review-context")
      .set("Authorization", `Bearer ${token}`)
      .query({ questionId: q._id.toString(), partLabel: "a" });
    expect(on.status).toBe(200);
    expect(on.body.rejectionFeatureEnabled).toBe(true);
    expect(on.body.canReject).toBe(true);
    expect(on.body.rejectDisabledReason).toBeNull();

    process.env.FEATURE_MCQ_RATIONALE_CANDIDATE_REJECT_V23B2B = "false";
    const off = await request(app)
      .get("/api/admin/exam-question-rationale-review-context")
      .set("Authorization", `Bearer ${token}`)
      .query({ questionId: q._id.toString(), partLabel: "a" });
    expect(off.body.rejectionFeatureEnabled).toBe(false);
    expect(off.body.canReject).toBe(false);
    expect(off.body.rejectDisabledReason).toBe("FEATURE_DISABLED");

    process.env.FEATURE_MCQ_RATIONALE_CANDIDATE_REJECT_V23B2B = "true";
    await ExamQuestionRationaleCandidate.findByIdAndUpdate(cand._id, {
      status: "rejected",
      active: false,
      rejectionReasonCode: "unclear",
      rejectedAt: new Date(),
      rejectedBy: user._id,
    });
    const rejected = await request(app)
      .get("/api/admin/exam-question-rationale-review-context")
      .set("Authorization", `Bearer ${token}`)
      .query({ questionId: q._id.toString(), partLabel: "a" });
    expect(rejected.body.canReject).toBe(false);
    expect(rejected.body.rejectDisabledReason).toBe("ALREADY_REJECTED");
    expect(rejected.body.latestCandidate.rejectionReasonCode).toBe("unclear");
    expect(rejected.body.latestCandidate.rejectedAt).toBeTruthy();
  });
});
