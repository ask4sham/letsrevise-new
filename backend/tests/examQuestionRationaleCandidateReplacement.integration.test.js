/**
 * Integration: V2.3B2b2a Attempt-2 replacement Candidate (backend only).
 * Generic create remains blocked for rejected lineages even when replacement is enabled.
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
const {
  createReplacementRationaleCandidate,
} = require("../services/examQuestionRationaleCandidateReplacementService");
const { rejectRationaleCandidate } = require("../services/examQuestionRationaleCandidateRejectService");
const {
  ensureExamQuestionRationaleCandidateIndexes,
} = require("../services/examQuestionRationaleCandidateAttemptTwoIndex");
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
    firstName: "V23B2b2a",
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

async function seedCandidate(actorId, question, overrides = {}) {
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
    idempotencyKey: overrides.idempotencyKey || `rep-seed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    promptVersion: "v23a.1",
    model: "gpt-4o-mini",
    generatedBy: actorId,
    generatedAt: new Date(),
    completedAt: new Date(),
    ...overrides,
    sourceFingerprint: fp,
    status: overrides.status != null ? overrides.status : "pending",
    active: overrides.active != null ? overrides.active : true,
    attemptNumber: overrides.attemptNumber != null ? overrides.attemptNumber : 1,
  });
}

async function seedRejectedAttemptOne(actorId, question, overrides = {}) {
  return seedCandidate(actorId, question, {
    status: "rejected",
    active: false,
    attemptNumber: 1,
    rejectionReasonCode: "too_generic",
    rejectionNote: "needs clearer link",
    rejectedAt: new Date(),
    rejectedBy: actorId,
    ...overrides,
    status: "rejected",
    active: false,
    attemptNumber: 1,
  });
}

function enableReplacementFlags() {
  process.env.FEATURE_MCQ_RATIONALE_BACKFILL_V23A = "true";
  process.env.FEATURE_MCQ_RATIONALE_REPLACEMENT_V23B2B2 = "true";
}

/** Event-driven barrier — prefer over arbitrary sleeps for concurrency cases. */
async function waitUntil(predicate, { timeoutMs = 5000, intervalMs = 5, label = "condition" } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`waitUntil timed out after ${timeoutMs}ms waiting for ${label}`);
}

function replaceCandidate(token, candidateId, body) {
  return request(app)
    .post(`/api/admin/exam-question-rationale-candidates/${candidateId}/replacement`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

function createAttempt1(token, body) {
  return request(app).post("/api/admin/exam-question-rationale-candidates").set("Authorization", `Bearer ${token}`).send(body);
}

beforeAll(async () => {
  // Other Candidate unique indexes for test fixtures; Attempt-2 uses the production ensure helper.
  await ExamQuestionRationaleCandidate.syncIndexes();
  await ensureExamQuestionRationaleCandidateIndexes();
});

beforeEach(async () => {
  delete process.env.FEATURE_MCQ_RATIONALE_BACKFILL_V23A;
  delete process.env.FEATURE_MCQ_RATIONALE_REPLACEMENT_V23B2B2;
  delete process.env.MCQ_RATIONALE_BACKFILL_ALLOW_PUBLISHED;
  delete process.env.FEATURE_MCQ_RATIONALE_CANDIDATE_REJECT_V23B2B;
  await ExamQuestionRationaleCandidate.deleteMany({});
  await ExamQuestion.deleteMany({});
  await Lesson.deleteMany({});
  callOpenAiJson.mockClear();
  callOpenAiJson.mockImplementation(async () => ({
    explanation: GOOD_EXPLANATION,
  }));
});

describe("V2.3B2b2a replacement flags and auth", () => {
  test("flag matrix — no provider when blocked", async () => {
    const { token, user } = await loginAs("rep-flags@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const cand = await seedRejectedAttemptOne(user._id, q);
    const body = {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      idempotencyKey: "rep-flag-key-aaaaaaaa",
    };

    let res = await replaceCandidate(token, cand._id.toString(), body);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("FEATURE_DISABLED");

    process.env.FEATURE_MCQ_RATIONALE_BACKFILL_V23A = "true";
    res = await replaceCandidate(token, cand._id.toString(), { ...body, idempotencyKey: "rep-flag-key-bbbbbbbb" });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("REPLACEMENT_FEATURE_DISABLED");

    delete process.env.FEATURE_MCQ_RATIONALE_BACKFILL_V23A;
    process.env.FEATURE_MCQ_RATIONALE_REPLACEMENT_V23B2B2 = "true";
    res = await replaceCandidate(token, cand._id.toString(), { ...body, idempotencyKey: "rep-flag-key-cccccccc" });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("FEATURE_DISABLED");

    expect(callOpenAiJson).not.toHaveBeenCalled();
    expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id })).toBe(1);
  });

  test("roles — admin and content_manager allowed; others blocked", async () => {
    enableReplacementFlags();
    const { token: adminToken, user: admin } = await loginAs("rep-admin@test.com", "admin");
    const q = await createEligibleDraft(admin._id);
    const cand = await seedRejectedAttemptOne(admin._id, q);

    const ok = await replaceCandidate(adminToken, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      idempotencyKey: "rep-role-admin-aaaaaaaa",
    });
    expect(ok.status).toBe(201);
    expect(ok.body.candidate.attemptNumber).toBe(2);

    const { token: cmToken, user: cm } = await loginAs("rep-cm@test.com", "teacher", "content_manager");
    const q2 = await createEligibleDraft(cm._id, { question: "Composite 2" });
    const cand2 = await seedRejectedAttemptOne(cm._id, q2);
    const cmOk = await replaceCandidate(cmToken, cand2._id.toString(), {
      questionId: q2._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand2.sourceFingerprint,
      idempotencyKey: "rep-role-cm-bbbbbbbbbb",
    });
    expect(cmOk.status).toBe(201);

    for (const [email, type] of [
      ["rep-teacher@test.com", "teacher"],
      ["rep-student@test.com", "student"],
      ["rep-parent@test.com", "parent"],
    ]) {
      const { token } = await loginAs(email, type);
      const denied = await replaceCandidate(token, cand._id.toString(), {
        questionId: q._id.toString(),
        partLabel: "a",
        expectedSourceFingerprint: cand.sourceFingerprint,
        idempotencyKey: `rep-role-${type}-xxxxxxxx`,
      });
      expect([401, 403]).toContain(denied.status);
    }

    const anon = await request(app)
      .post(`/api/admin/exam-question-rationale-candidates/${cand._id.toString()}/replacement`)
      .send({
        questionId: q._id.toString(),
        partLabel: "a",
        expectedSourceFingerprint: cand.sourceFingerprint,
        idempotencyKey: "rep-role-anon-xxxxxxxx",
      });
    expect([401, 403]).toContain(anon.status);
  });
});

describe("V2.3B2b2a replacement eligibility and creation", () => {
  test("valid rejected Attempt 1 → Attempt 2; Attempt 1 preserved; no EQ write", async () => {
    enableReplacementFlags();
    const { token, user } = await loginAs("rep-happy@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const eqBefore = JSON.parse(JSON.stringify(await ExamQuestion.findById(q._id).lean()));
    const cand = await seedRejectedAttemptOne(user._id, q, {
      rejectionReasonCode: "unclear",
      rejectionNote: "keep me",
    });
    const attempt1Before = JSON.parse(JSON.stringify(await ExamQuestionRationaleCandidate.findById(cand._id).lean()));

    const res = await replaceCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      idempotencyKey: "rep-happy-key-aaaaaaaa",
    });
    expect(res.status).toBe(201);
    expect(res.body.replayed).toBe(false);
    expect(res.body.candidate.attemptNumber).toBe(2);
    expect(res.body.candidate.status).toBe("pending");
    expect(res.body.candidate.questionId).toBe(q._id.toString());
    expect(res.body.candidate.partLabel).toBe("a");
    expect(res.body.candidate.sourceFingerprint).toBe(cand.sourceFingerprint);
    expect(callOpenAiJson).toHaveBeenCalled();
    expect(callOpenAiJson.mock.calls[0][0].user).not.toMatch(/keep me|unclear|rejected/i);

    expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id })).toBe(2);
    const a2 = await ExamQuestionRationaleCandidate.findById(res.body.candidate.candidateId).lean();
    expect(a2.attemptNumber).toBe(2);
    expect(a2.generationGroupKey).toBe(cand.generationGroupKey);
    expect(a2.active).toBe(true);
    expect(a2.status).toBe("pending");

    const a1 = await ExamQuestionRationaleCandidate.findById(cand._id).lean();
    expect(a1.status).toBe("rejected");
    expect(a1.active).toBe(false);
    expect(a1.attemptNumber).toBe(1);
    expect(a1.explanation).toBe(GOOD_EXPLANATION);
    expect(a1.rejectionReasonCode).toBe("unclear");
    expect(a1.rejectionNote).toBe("keep me");
    expect(JSON.parse(JSON.stringify(a1.sourceSnapshot))).toEqual(attempt1Before.sourceSnapshot);

    const eqAfter = await ExamQuestion.findById(q._id).lean();
    expect(JSON.parse(JSON.stringify(eqAfter))).toEqual(eqBefore);
  });

  test("state eligibility — pending/failed/generating/wrong association blocked", async () => {
    enableReplacementFlags();
    const { token, user } = await loginAs("rep-elig@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const fp = fingerprintForQuestion(q);

    for (const [status, active, code] of [
      ["pending", true, "CANDIDATE_NOT_REJECTED"],
      ["generating", true, "CANDIDATE_NOT_REJECTED"],
      ["failed", false, "CANDIDATE_NOT_REJECTED"],
      ["approved", false, "CANDIDATE_NOT_REJECTED"],
      ["superseded", false, "CANDIDATE_NOT_REJECTED"],
      ["stale", false, "CANDIDATE_NOT_REJECTED"],
    ]) {
      const c = await seedCandidate(user._id, q, {
        status,
        active,
        idempotencyKey: `rep-elig-${status}-${Math.random().toString(36).slice(2, 8)}`,
      });
      const res = await replaceCandidate(token, c._id.toString(), {
        questionId: q._id.toString(),
        partLabel: "a",
        expectedSourceFingerprint: fp,
        idempotencyKey: `rep-elig-req-${status}-xxxxxxxx`,
      });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe(code);
      // Clear active row so the next active status seed does not hit uq_active_source_candidate.
      if (active) {
        await ExamQuestionRationaleCandidate.updateOne({ _id: c._id }, { $set: { active: false } });
      }
    }

    const rejectedActive = await seedRejectedAttemptOne(user._id, q, {
      active: true,
      idempotencyKey: "rep-elig-active-true-xx",
    });
    // force active true after helper
    await ExamQuestionRationaleCandidate.findByIdAndUpdate(rejectedActive._id, { active: true });
    const activeRes = await replaceCandidate(token, rejectedActive._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: fp,
      idempotencyKey: "rep-elig-active-req-xxxxxxxx",
    });
    expect(activeRes.body.code).toBe("CANDIDATE_STILL_ACTIVE");

    const wrongQ = await createEligibleDraft(user._id, { question: "Other" });
    const rejected = await seedRejectedAttemptOne(user._id, q, { idempotencyKey: "rep-elig-wrongq-xxxx" });
    const mismatch = await replaceCandidate(token, rejected._id.toString(), {
      questionId: wrongQ._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: fp,
      idempotencyKey: "rep-elig-mismatch-xxxxxxxx",
    });
    expect(mismatch.body.code).toBe("CANDIDATE_ASSOCIATION_MISMATCH");

    expect(callOpenAiJson).not.toHaveBeenCalled();
  });

  test("SOURCE_CHANGED — F rejected does not allow replacement; F2 Attempt 1 ok", async () => {
    enableReplacementFlags();
    const { token, user } = await loginAs("rep-source@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const cand = await seedRejectedAttemptOne(user._id, q);
    const fpF = cand.sourceFingerprint;

    q.parts[0].questionText = "Which factor is essential after edit? (a)";
    await q.save();
    const q2 = await ExamQuestion.findById(q._id);
    const fpF2 = fingerprintForQuestion(q2);
    expect(fpF2).not.toBe(fpF);

    const blocked = await replaceCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: fpF,
      idempotencyKey: "rep-source-old-aaaaaaaa",
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe("SOURCE_CHANGED");
    expect(callOpenAiJson).not.toHaveBeenCalled();

    const createF2 = await createAttempt1(token, {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: fpF2,
      idempotencyKey: "rep-source-f2-bbbbbbbb",
    });
    expect(createF2.status).toBe(201);
    expect(createF2.body.candidate.attemptNumber).toBe(1);
    expect(createF2.body.candidate.sourceFingerprint).toBe(fpF2);
  });

  test("published source blocked", async () => {
    enableReplacementFlags();
    delete process.env.MCQ_RATIONALE_BACKFILL_ALLOW_PUBLISHED;
    const { token, user } = await loginAs("rep-pub@test.com", "admin");
    const q = await createEligibleDraft(user._id, { status: "published" });
    const cand = await seedRejectedAttemptOne(user._id, q);
    const res = await replaceCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      idempotencyKey: "rep-pub-key-aaaaaaaaaa",
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("PUBLISHED_NOT_ENABLED");
    expect(callOpenAiJson).not.toHaveBeenCalled();
  });
});

describe("V2.3B2b2a replacement idempotency, failure, races, index", () => {
  test("idempotent replay; different key after Attempt 2 exists", async () => {
    enableReplacementFlags();
    const { token, user } = await loginAs("rep-idem@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const cand = await seedRejectedAttemptOne(user._id, q);
    const key = "rep-idem-same-aaaaaaaaaa";

    const first = await replaceCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      idempotencyKey: key,
    });
    expect(first.status).toBe(201);
    const callsAfterFirst = callOpenAiJson.mock.calls.length;

    const replay = await replaceCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      idempotencyKey: key,
    });
    expect(replay.status).toBe(200);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.candidate.candidateId).toBe(first.body.candidate.candidateId);
    expect(callOpenAiJson.mock.calls.length).toBe(callsAfterFirst);

    const secondKey = await replaceCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      idempotencyKey: "rep-idem-other-bbbbbbbb",
    });
    expect(secondKey.status).toBe(409);
    expect(["ATTEMPT_2_ALREADY_EXISTS", "ATTEMPT_LIMIT_REACHED"]).toContain(secondKey.body.code);
    expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id })).toBe(2);
  });

  test("terminal failed Attempt 2 consumes allowance; no Attempt 3", async () => {
    enableReplacementFlags();
    callOpenAiJson.mockRejectedValueOnce(Object.assign(new Error("timeout"), { code: "LLM_TIMEOUT" }));
    const { token, user } = await loginAs("rep-fail@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const cand = await seedRejectedAttemptOne(user._id, q);

    const failed = await replaceCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      idempotencyKey: "rep-fail-key-aaaaaaaaaa",
    });
    expect(failed.status).toBe(503);
    expect(failed.body.code).toBe("LLM_TIMEOUT");
    const a2 = await ExamQuestionRationaleCandidate.findOne({ questionId: q._id, attemptNumber: 2 }).lean();
    expect(a2).toBeTruthy();
    expect(a2.status).toBe("failed");
    expect(a2.active).toBe(false);

    callOpenAiJson.mockClear();
    const again = await replaceCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      idempotencyKey: "rep-fail-again-bbbbbbbb",
    });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("ATTEMPT_LIMIT_REACHED");
    expect(callOpenAiJson).not.toHaveBeenCalled();
    expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id, attemptNumber: 2 })).toBe(1);
    expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id, attemptNumber: 3 })).toBe(0);
  });

  test("concurrent replacements — one Attempt 2; provider once at most for winner path", async () => {
    enableReplacementFlags();
    const { token, user } = await loginAs("rep-race@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const cand = await seedRejectedAttemptOne(user._id, q);

    const [r1, r2] = await Promise.all([
      replaceCandidate(token, cand._id.toString(), {
        questionId: q._id.toString(),
        partLabel: "a",
        expectedSourceFingerprint: cand.sourceFingerprint,
        idempotencyKey: "rep-race-one-aaaaaaaaaa",
      }),
      replaceCandidate(token, cand._id.toString(), {
        questionId: q._id.toString(),
        partLabel: "a",
        expectedSourceFingerprint: cand.sourceFingerprint,
        idempotencyKey: "rep-race-two-bbbbbbbbbb",
      }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toContain(201);
    expect([200, 201, 409]).toEqual(expect.arrayContaining(statuses.length === 2 ? statuses : statuses));
    const ok = [r1, r2].filter((r) => r.status === 201 || (r.status === 200 && r.body.replayed));
    const conflicts = [r1, r2].filter((r) => r.status === 409);
    expect(ok.length + conflicts.length).toBe(2);
    expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id })).toBe(2);
    expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id, attemptNumber: 2 })).toBe(1);
    const a1 = await ExamQuestionRationaleCandidate.findById(cand._id).lean();
    expect(a1.status).toBe("rejected");
  });

  test("index — multiple Attempt 1 allowed; second Attempt 2 rejected", async () => {
    enableReplacementFlags();
    const { token, user } = await loginAs("rep-idx@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const fp = fingerprintForQuestion(q);
    const group = `${q._id}:a:${fp}`;

    await seedCandidate(user._id, q, {
      status: "failed",
      active: false,
      attemptNumber: 1,
      generationGroupKey: group,
      idempotencyKey: "rep-idx-fail1-aaaaaaaa",
    });
    await seedCandidate(user._id, q, {
      status: "failed",
      active: false,
      attemptNumber: 1,
      generationGroupKey: group,
      idempotencyKey: "rep-idx-fail2-bbbbbbbb",
    });
    expect(await ExamQuestionRationaleCandidate.countDocuments({ generationGroupKey: group, attemptNumber: 1 })).toBe(
      2
    );

    const rejected = await seedRejectedAttemptOne(user._id, q, {
      generationGroupKey: group,
      sourceFingerprint: fp,
      idempotencyKey: "rep-idx-rej-cccccccc",
    });

    const first = await replaceCandidate(token, rejected._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: fp,
      idempotencyKey: "rep-idx-a2-dddddddddd",
    });
    expect(first.status).toBe(201);

    await expect(
      ExamQuestionRationaleCandidate.create({
        questionId: q._id,
        partLabel: "a",
        sourceFingerprint: fp,
        sourceSnapshot: rejected.sourceSnapshot,
        explanation: "",
        status: "generating",
        active: true,
        attemptNumber: 2,
        generationGroupKey: group,
        idempotencyKey: "rep-idx-a2-dupe-eeeeee",
        generatedBy: user._id,
        generatedAt: new Date(),
        promptVersion: "v",
        model: "m",
      })
    ).rejects.toMatchObject({ code: 11000 });
  });
});

describe("V2.3B2b2a generic create remains blocked", () => {
  test("A/B: rejected lineage blocks generic create with replacement flag off and on", async () => {
    const { token, user } = await loginAs("rep-generic@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const cand = await seedRejectedAttemptOne(user._id, q);

    process.env.FEATURE_MCQ_RATIONALE_BACKFILL_V23A = "true";
    delete process.env.FEATURE_MCQ_RATIONALE_REPLACEMENT_V23B2B2;
    callOpenAiJson.mockClear();
    const off = await createAttempt1(token, {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      idempotencyKey: "rep-gen-off-aaaaaaaaaa",
    });
    expect(off.status).toBe(409);
    expect(off.body.code).toBe("REPLACEMENT_GENERATION_NOT_ENABLED");
    expect(callOpenAiJson).not.toHaveBeenCalled();

    process.env.FEATURE_MCQ_RATIONALE_REPLACEMENT_V23B2B2 = "true";
    const on = await createAttempt1(token, {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      idempotencyKey: "rep-gen-on-bbbbbbbbbb",
    });
    expect(on.status).toBe(409);
    expect(on.body.code).toBe("REPLACEMENT_GENERATION_NOT_ENABLED");
    expect(callOpenAiJson).not.toHaveBeenCalled();
    expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id })).toBe(1);

    const ctx = await request(app)
      .get("/api/admin/exam-question-rationale-review-context")
      .set("Authorization", `Bearer ${token}`)
      .query({ questionId: q._id.toString(), partLabel: "a" });
    expect(ctx.body.canGenerate).toBe(false);
    expect(ctx.body.canGenerateReason).toBe("REPLACEMENT_GENERATION_NOT_ENABLED");
  });

  test("C: failed Attempt 1 retry unchanged", async () => {
    process.env.FEATURE_MCQ_RATIONALE_BACKFILL_V23A = "true";
    process.env.FEATURE_MCQ_RATIONALE_REPLACEMENT_V23B2B2 = "true";
    const { token, user } = await loginAs("rep-failed-retry@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const fp = fingerprintForQuestion(q);
    await seedCandidate(user._id, q, {
      status: "failed",
      active: false,
      failureCode: "LLM_ERROR",
      explanation: "",
      idempotencyKey: "rep-failed-seed-aaaaaaaa",
    });

    const res = await createAttempt1(token, {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: fp,
      idempotencyKey: "rep-failed-retry-bbbbbbbb",
    });
    expect(res.status).toBe(201);
    expect(res.body.candidate.attemptNumber).toBe(1);
    expect(callOpenAiJson).toHaveBeenCalled();
  });
});

describe("V2.3B2b2a reject/replacement race", () => {
  test("replacement before reject → CANDIDATE_NOT_REJECTED; reject then replace ok", async () => {
    process.env.FEATURE_MCQ_RATIONALE_CANDIDATE_REJECT_V23B2B = "true";
    enableReplacementFlags();
    const { token, user } = await loginAs("rep-rej-race@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const pending = await seedCandidate(user._id, q, { status: "pending", active: true });

    const tooEarly = await replaceCandidate(token, pending._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: pending.sourceFingerprint,
      idempotencyKey: "rep-before-reject-aaaaaaaa",
    });
    expect(tooEarly.status).toBe(409);
    expect(tooEarly.body.code).toBe("CANDIDATE_NOT_REJECTED");
    expect(callOpenAiJson).not.toHaveBeenCalled();

    const rejected = await request(app)
      .post(`/api/admin/exam-question-rationale-candidates/${pending._id.toString()}/reject`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        questionId: q._id.toString(),
        partLabel: "a",
        expectedSourceFingerprint: pending.sourceFingerprint,
        reasonCode: "unclear",
      });
    expect(rejected.status).toBe(200);

    callOpenAiJson.mockClear();
    const after = await replaceCandidate(token, pending._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: pending.sourceFingerprint,
      idempotencyKey: "rep-after-reject-bbbbbbbb",
    });
    expect(after.status).toBe(201);
    expect(after.body.candidate.attemptNumber).toBe(2);
    expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id })).toBe(2);
  });
});

describe("V2.3B2b2a substantive rationale, failed replay, true concurrency", () => {
  test("substantive rationale after reject → SOURCE_CHANGED; no Attempt 2; provider zero", async () => {
    enableReplacementFlags();
    const { token, user } = await loginAs("rep-substantive@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const cand = await seedRejectedAttemptOne(user._id, q);
    const oldFp = cand.sourceFingerprint;
    const eqBefore = JSON.parse(JSON.stringify(await ExamQuestion.findById(q._id).lean()));

    q.parts[0].partData = {
      explanation:
        "Chlorophyll absorbs light energy so plants can make glucose during photosynthesis under suitable conditions.",
    };
    q.markModified("parts");
    await q.save();
    const qAfter = await ExamQuestion.findById(q._id).lean();
    const classif = classifyCompositeMcqPart(qAfter.parts[0], {
      isArchived: qAfter.isArchived,
      subject: qAfter.subject,
      topic: qAfter.topic,
      topicKey: qAfter.topicKey,
    });
    expect(classif.bucket).toBe("substantive");
    expect(classif.potentiallyEligibleForBackfill).toBe(false);

    callOpenAiJson.mockClear();
    const res = await replaceCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: oldFp,
      idempotencyKey: "rep-sub-oldfp-aaaaaaaa",
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SOURCE_CHANGED");
    expect(callOpenAiJson).not.toHaveBeenCalled();
    expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id })).toBe(1);
    expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id, attemptNumber: 2 })).toBe(0);

    const eqFinal = await ExamQuestion.findById(q._id).lean();
    expect(eqFinal.parts[0].partData.explanation).toBe(qAfter.parts[0].partData.explanation);
    expect(eqFinal.parts[0].partData.explanation).not.toBe(eqBefore.parts[0]?.partData?.explanation);
  });

  test("failed Attempt 2 same-key replay — no second provider call; no Attempt 3", async () => {
    enableReplacementFlags();
    callOpenAiJson.mockRejectedValueOnce(Object.assign(new Error("timeout"), { code: "LLM_TIMEOUT" }));
    const { token, user } = await loginAs("rep-fail-replay@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const cand = await seedRejectedAttemptOne(user._id, q);
    const key = "rep-fail-replay-aaaaaaaa";

    const failed = await replaceCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      idempotencyKey: key,
    });
    expect(failed.status).toBe(503);
    expect(failed.body.code).toBe("LLM_TIMEOUT");

    callOpenAiJson.mockClear();
    const replay = await replaceCandidate(token, cand._id.toString(), {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      idempotencyKey: key,
    });
    expect(replay.status).toBe(200);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.candidate.status).toBe("failed");
    expect(replay.body.candidate.attemptNumber).toBe(2);
    expect(callOpenAiJson).not.toHaveBeenCalled();
    expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id, attemptNumber: 2 })).toBe(1);
    expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id, attemptNumber: 3 })).toBe(0);
  });

  test("true concurrent same-key — one Attempt 2; one provider workflow; one replay", async () => {
    enableReplacementFlags();
    const { user } = await loginAs("rep-conc-same@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const cand = await seedRejectedAttemptOne(user._id, q);
    let providerStarts = 0;
    let releaseProvider;
    const providerGate = new Promise((resolve) => {
      releaseProvider = resolve;
    });
    const slowLlm = async () => {
      providerStarts += 1;
      await providerGate;
      return { explanation: GOOD_EXPLANATION };
    };

    const body = {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      idempotencyKey: "rep-conc-same-aaaaaaaa",
    };
    const p1 = createReplacementRationaleCandidate({
      actorId: user._id,
      rejectedCandidateId: String(cand._id),
      body,
      llmCall: slowLlm,
    }).then((r) => ({ ok: true, replayed: r.replayed })).catch((e) => ({ ok: false, code: e.code }));
    // Yield so first reservation can start before second join — still overlapping.
    await new Promise((r) => setImmediate(r));
    const p2 = createReplacementRationaleCandidate({
      actorId: user._id,
      rejectedCandidateId: String(cand._id),
      body,
      llmCall: slowLlm,
    }).then((r) => ({ ok: true, replayed: r.replayed })).catch((e) => ({ ok: false, code: e.code }));
    // Event-driven: hold the gate until the first workflow has entered the provider,
    // proving both calls overlapped while Attempt 2 was still generating.
    await waitUntil(() => providerStarts >= 1, { label: "first provider workflow start" });
    releaseProvider();
    const settled = await Promise.all([p1, p2]);

    expect(settled.every((s) => s.ok)).toBe(true);
    expect(settled.filter((s) => s.replayed).length).toBe(1);
    expect(settled.filter((s) => !s.replayed).length).toBe(1);
    expect(providerStarts).toBe(1);
    expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id })).toBe(2);
    expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id, attemptNumber: 2 })).toBe(1);
  });

  test("actor-generation TOCTOU catch — same-key recovers to replay; provider once", async () => {
    enableReplacementFlags();
    const { user } = await loginAs("rep-actor-toctou@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const eqBefore = JSON.parse(JSON.stringify(await ExamQuestion.findById(q._id).lean()));
    const cand = await seedRejectedAttemptOne(user._id, q);
    const key = "rep-actor-toctou-aaaaaaaa";
    let providerStarts = 0;
    let releaseProvider;
    const providerGate = new Promise((resolve) => {
      releaseProvider = resolve;
    });
    const slowLlm = async () => {
      providerStarts += 1;
      await providerGate;
      return { explanation: GOOD_EXPLANATION };
    };
    const body = {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
      idempotencyKey: key,
    };

    const p1 = createReplacementRationaleCandidate({
      actorId: user._id,
      rejectedCandidateId: String(cand._id),
      body,
      llmCall: slowLlm,
    });
    await waitUntil(() => providerStarts >= 1, { label: "p1 provider start before TOCTOU probe" });

    // Force the second request past early/pre-assert same-key lookups and Attempt-2/active
    // blockers so it hits assertNoActiveGeneratingForActor, then the new catch recovers.
    const originalFindOne = ExamQuestionRationaleCandidate.findOne.bind(ExamQuestionRationaleCandidate);
    let idemMisses = 0;
    const findNone = () =>
      originalFindOne({ _id: new mongoose.Types.ObjectId("000000000000000000000000") });
    const spy = jest.spyOn(ExamQuestionRationaleCandidate, "findOne").mockImplementation(function (filter, ...rest) {
      const f = filter || {};
      const isIdemLookup =
        f.idempotencyKey === key && f.generatedBy != null && f.status == null && f.attemptNumber == null;
      const isAttemptTwo = f.attemptNumber === 2 && f.generationGroupKey != null;
      const isActiveSource =
        f.active === true && f.sourceFingerprint != null && f.status == null && f.generatedBy == null;
      const isActorGenerating = f.status === "generating" && f.active === true && f.generatedBy != null;

      if (isIdemLookup) {
        idemMisses += 1;
        if (idemMisses <= 2) return findNone();
        return originalFindOne(filter, ...rest);
      }
      if ((isAttemptTwo || isActiveSource) && idemMisses < 2) {
        return findNone();
      }
      if (isActorGenerating || isAttemptTwo || isActiveSource || isIdemLookup) {
        return originalFindOne(filter, ...rest);
      }
      return originalFindOne(filter, ...rest);
    });

    try {
      const result = await createReplacementRationaleCandidate({
        actorId: user._id,
        rejectedCandidateId: String(cand._id),
        body,
        llmCall: slowLlm,
      });
      expect(result.replayed).toBe(true);
      expect(result.dto.attemptNumber).toBe(2);
      expect(result.dto.candidateId).toBeTruthy();
      expect(idemMisses).toBeGreaterThanOrEqual(3);
      expect(providerStarts).toBe(1);
      expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id, attemptNumber: 2 })).toBe(1);
      const a2 = await ExamQuestionRationaleCandidate.findById(result.dto.candidateId).lean();
      expect(a2.idempotencyKey).toBe(key);
      expect(String(a2.generatedBy)).toBe(String(user._id));
      const eqAfter = await ExamQuestion.findById(q._id).lean();
      expect(JSON.parse(JSON.stringify(eqAfter))).toEqual(eqBefore);
    } finally {
      spy.mockRestore();
      releaseProvider();
      await p1;
    }
  });

  test("actor-generation TOCTOU catch — different key rethrows original conflict", async () => {
    enableReplacementFlags();
    const { user } = await loginAs("rep-actor-toctou-diff@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const cand = await seedRejectedAttemptOne(user._id, q);
    const keyA = "rep-actor-toctou-key-aaaa";
    const keyB = "rep-actor-toctou-key-bbbb";
    let providerStarts = 0;
    let releaseProvider;
    const providerGate = new Promise((resolve) => {
      releaseProvider = resolve;
    });
    const slowLlm = async () => {
      providerStarts += 1;
      await providerGate;
      return { explanation: GOOD_EXPLANATION };
    };

    const p1 = createReplacementRationaleCandidate({
      actorId: user._id,
      rejectedCandidateId: String(cand._id),
      body: {
        questionId: q._id.toString(),
        partLabel: "a",
        expectedSourceFingerprint: cand.sourceFingerprint,
        idempotencyKey: keyA,
      },
      llmCall: slowLlm,
    });
    await waitUntil(() => providerStarts >= 1, { label: "p1 provider start before different-key probe" });

    const originalFindOne = ExamQuestionRationaleCandidate.findOne.bind(ExamQuestionRationaleCandidate);
    let idemMisses = 0;
    const findNone = () =>
      originalFindOne({ _id: new mongoose.Types.ObjectId("000000000000000000000000") });
    const spy = jest.spyOn(ExamQuestionRationaleCandidate, "findOne").mockImplementation(function (filter, ...rest) {
      const f = filter || {};
      const isIdemLookup =
        f.idempotencyKey === keyB && f.generatedBy != null && f.status == null && f.attemptNumber == null;
      const isAttemptTwo = f.attemptNumber === 2 && f.generationGroupKey != null;
      const isActiveSource =
        f.active === true && f.sourceFingerprint != null && f.status == null && f.generatedBy == null;
      const isActorGenerating = f.status === "generating" && f.active === true && f.generatedBy != null;

      if (isIdemLookup) {
        idemMisses += 1;
        if (idemMisses <= 2) return findNone();
        return originalFindOne(filter, ...rest);
      }
      if ((isAttemptTwo || isActiveSource) && idemMisses < 2) {
        return findNone();
      }
      if (isActorGenerating) return originalFindOne(filter, ...rest);
      return originalFindOne(filter, ...rest);
    });

    try {
      let caught;
      try {
        await createReplacementRationaleCandidate({
          actorId: user._id,
          rejectedCandidateId: String(cand._id),
          body: {
            questionId: q._id.toString(),
            partLabel: "a",
            expectedSourceFingerprint: cand.sourceFingerprint,
            idempotencyKey: keyB,
          },
          llmCall: slowLlm,
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeTruthy();
      expect(caught.code).toBe("ACTOR_GENERATION_IN_PROGRESS");
      expect(caught.status).toBe(409);
      expect(caught.message).toBe("Another candidate generation is already in progress for this user");
      expect(providerStarts).toBe(1);
      expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id, attemptNumber: 2 })).toBe(1);
    } finally {
      spy.mockRestore();
      releaseProvider();
      await p1;
    }
  });

  test("actor-generation assert — unrelated errors are not converted to replay", async () => {
    enableReplacementFlags();
    const { user } = await loginAs("rep-actor-toctou-err@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const cand = await seedRejectedAttemptOne(user._id, q);
    const originalFindOne = ExamQuestionRationaleCandidate.findOne.bind(ExamQuestionRationaleCandidate);
    const spy = jest.spyOn(ExamQuestionRationaleCandidate, "findOne").mockImplementation(function (filter, ...rest) {
      const f = filter || {};
      if (f.status === "generating" && f.active === true && f.generatedBy != null) {
        throw Object.assign(new Error("SYNTHETIC_DB_FAILURE"), { code: "SYNTHETIC_DB_FAILURE" });
      }
      return originalFindOne(filter, ...rest);
    });
    try {
      let caught;
      try {
        await createReplacementRationaleCandidate({
          actorId: user._id,
          rejectedCandidateId: String(cand._id),
          body: {
            questionId: q._id.toString(),
            partLabel: "a",
            expectedSourceFingerprint: cand.sourceFingerprint,
            idempotencyKey: "rep-actor-toctou-err-aaaa",
          },
          llmCall: async () => ({ explanation: GOOD_EXPLANATION }),
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeTruthy();
      expect(caught.code).toBe("SYNTHETIC_DB_FAILURE");
      expect(caught.message).toBe("SYNTHETIC_DB_FAILURE");
      expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id, attemptNumber: 2 })).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  test("true concurrent different keys / different actors — one Attempt 2; one provider", async () => {
    enableReplacementFlags();
    const { user } = await loginAs("rep-conc-diff@test.com", "admin");
    const { user: user2 } = await loginAs("rep-conc-diff2@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const cand = await seedRejectedAttemptOne(user._id, q);
    let providerStarts = 0;
    let releaseProvider;
    const providerGate = new Promise((resolve) => {
      releaseProvider = resolve;
    });
    const slowLlm = async () => {
      providerStarts += 1;
      await providerGate;
      return { explanation: GOOD_EXPLANATION };
    };
    const base = {
      questionId: q._id.toString(),
      partLabel: "a",
      expectedSourceFingerprint: cand.sourceFingerprint,
    };

    const p1 = createReplacementRationaleCandidate({
      actorId: user._id,
      rejectedCandidateId: String(cand._id),
      body: { ...base, idempotencyKey: "rep-conc-diff-aaaaaaaa" },
      llmCall: slowLlm,
    })
      .then((r) => ({ ok: true, replayed: r.replayed }))
      .catch((e) => ({ ok: false, code: e.code }));
    const p2 = createReplacementRationaleCandidate({
      actorId: user._id,
      rejectedCandidateId: String(cand._id),
      body: { ...base, idempotencyKey: "rep-conc-diff-bbbbbbbb" },
      llmCall: slowLlm,
    })
      .then((r) => ({ ok: true, replayed: r.replayed }))
      .catch((e) => ({ ok: false, code: e.code }));
    const p3 = createReplacementRationaleCandidate({
      actorId: user2._id,
      rejectedCandidateId: String(cand._id),
      body: { ...base, idempotencyKey: "rep-conc-diff-cccccccc" },
      llmCall: slowLlm,
    })
      .then((r) => ({ ok: true, replayed: r.replayed }))
      .catch((e) => ({ ok: false, code: e.code }));
    await new Promise((r) => setTimeout(r, 40));
    releaseProvider();
    const settled = await Promise.all([p1, p2, p3]);

    const winners = settled.filter((s) => s.ok && !s.replayed);
    const losers = settled.filter((s) => !s.ok);
    expect(winners.length).toBe(1);
    expect(losers.length).toBe(2);
    expect(losers.every((s) => ["ATTEMPT_2_ALREADY_EXISTS", "ATTEMPT_LIMIT_REACHED", "ACTIVE_CANDIDATE_EXISTS"].includes(s.code))).toBe(
      true
    );
    expect(providerStarts).toBe(1);
    expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id })).toBe(2);
    expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id, attemptNumber: 2 })).toBe(1);
    expect(await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id, attemptNumber: 3 })).toBe(0);
  });

  test("true concurrent reject∥replacement — safe outcomes; max two Candidates", async () => {
    process.env.FEATURE_MCQ_RATIONALE_CANDIDATE_REJECT_V23B2B = "true";
    enableReplacementFlags();
    const { user } = await loginAs("rep-conc-rejr@test.com", "admin");
    const q = await createEligibleDraft(user._id);
    const pending = await seedCandidate(user._id, q, {
      status: "pending",
      active: true,
      explanation: GOOD_EXPLANATION,
      idempotencyKey: "rep-conc-pending-aaaaaa",
    });
    let providerStarts = 0;
    const slowLlm = async () => {
      providerStarts += 1;
      await new Promise((r) => setTimeout(r, 40));
      return { explanation: GOOD_EXPLANATION };
    };

    const settled = await Promise.all([
      rejectRationaleCandidate({
        actorId: user._id,
        candidateId: String(pending._id),
        body: {
          questionId: q._id.toString(),
          partLabel: "a",
          expectedSourceFingerprint: pending.sourceFingerprint,
          reasonCode: "unclear",
        },
      })
        .then(() => ({ ok: true, type: "reject" }))
        .catch((e) => ({ ok: false, type: "reject", code: e.code })),
      createReplacementRationaleCandidate({
        actorId: user._id,
        rejectedCandidateId: String(pending._id),
        body: {
          questionId: q._id.toString(),
          partLabel: "a",
          expectedSourceFingerprint: pending.sourceFingerprint,
          idempotencyKey: "rep-conc-rejr-bbbbbbbb",
        },
        llmCall: slowLlm,
      })
        .then((r) => ({ ok: true, type: "replace", replayed: r.replayed }))
        .catch((e) => ({ ok: false, type: "replace", code: e.code, status: e.status })),
    ]);

    const a1 = await ExamQuestionRationaleCandidate.findById(pending._id).lean();
    const total = await ExamQuestionRationaleCandidate.countDocuments({ questionId: q._id });
    const attempt2 = await ExamQuestionRationaleCandidate.countDocuments({
      questionId: q._id,
      attemptNumber: 2,
    });
    expect(a1.status).toBe("rejected");
    expect(a1.active).toBe(false);
    expect(total).toBeLessThanOrEqual(2);
    expect(attempt2).toBeLessThanOrEqual(1);
    expect(providerStarts).toBeLessThanOrEqual(1);
    expect(settled.every((s) => s.ok || s.code)).toBe(true);
    const replaceResult = settled.find((s) => s.type === "replace");
    if (!replaceResult.ok) {
      expect(replaceResult.code).toBe("CANDIDATE_NOT_REJECTED");
      expect(attempt2).toBe(0);
      expect(providerStarts).toBe(0);
    } else {
      expect(attempt2).toBe(1);
      expect(total).toBe(2);
    }
  });
});
