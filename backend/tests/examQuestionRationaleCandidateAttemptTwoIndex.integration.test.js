/**
 * Attempt-2 partial unique index ensure/verify (fail-closed bootstrap helper).
 * Non-destructive createIndex only — never syncIndexes / dropIndexes.
 */
const mongoose = require("mongoose");
const ExamQuestionRationaleCandidate = require("../models/ExamQuestionRationaleCandidate");
const {
  ATTEMPT_TWO_GENERATION_GROUP_INDEX,
  verifyAttemptTwoGenerationGroupIndex,
  ensureAttemptTwoGenerationGroupIndex,
  ensureExamQuestionRationaleCandidateIndexes,
  isMatchingAttemptTwoIndex,
  isMongoAttemptTwoIndexCollision,
} = require("../services/examQuestionRationaleCandidateAttemptTwoIndex");

jest.setTimeout(30000);

describe("V2.3B2b2a Attempt-2 unique index ensure/verify", () => {
  const actorId = new mongoose.Types.ObjectId();
  const questionId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    await ensureExamQuestionRationaleCandidateIndexes();
  });

  afterEach(async () => {
    await ExamQuestionRationaleCandidate.deleteMany({ questionId });
  });

  test("schema declares exact Attempt-2 partial unique index", () => {
    const indexes = ExamQuestionRationaleCandidate.schema.indexes();
    const match = indexes.find(
      ([keys, opts]) =>
        keys.generationGroupKey === 1 &&
        opts &&
        opts.unique === true &&
        opts.name === "uq_attempt2_generation_group" &&
        opts.partialFilterExpression &&
        opts.partialFilterExpression.attemptNumber === 2
    );
    expect(match).toBeTruthy();
    expect(ATTEMPT_TWO_GENERATION_GROUP_INDEX.keys).toEqual({ generationGroupKey: 1 });
    expect(ATTEMPT_TWO_GENERATION_GROUP_INDEX.options).toEqual({
      unique: true,
      name: "uq_attempt2_generation_group",
      partialFilterExpression: { attemptNumber: 2 },
    });
  });

  test("ensure creates or confirms exact index; repeated ensure is idempotent", async () => {
    const first = await ensureAttemptTwoGenerationGroupIndex();
    expect(first.verified).toBe(true);
    expect(first.indexName).toBe("uq_attempt2_generation_group");

    const second = await ensureAttemptTwoGenerationGroupIndex();
    expect(second.verified).toBe(true);
    expect(second.created).toBe(false);
    expect(second.indexName).toBe("uq_attempt2_generation_group");

    const verify = await verifyAttemptTwoGenerationGroupIndex();
    expect(verify.ok).toBe(true);

    const indexes = await ExamQuestionRationaleCandidate.collection.indexes();
    const exact = indexes.find(isMatchingAttemptTwoIndex);
    expect(exact).toBeTruthy();
    expect(exact.unique).toBe(true);
    expect(exact.partialFilterExpression).toEqual({ attemptNumber: 2 });
  });

  test("verification fails closed when same name has wrong specification", async () => {
    // Driver API: listIndexes() returns a cursor synchronously; callers use .toArray().
    const fakeModel = {
      createCollection: async () => {},
      collection: {
        listIndexes: () => ({
          toArray: async () => [
            {
              name: "uq_attempt2_generation_group",
              key: { generationGroupKey: 1 },
              unique: false,
              partialFilterExpression: { attemptNumber: 2 },
            },
          ],
        }),
        createIndex: async () => {
          throw new Error("createIndex must not run for incompatible same-name index");
        },
      },
    };

    const verify = await verifyAttemptTwoGenerationGroupIndex(fakeModel);
    expect(verify.ok).toBe(false);
    expect(verify.reason).toBe("incompatible_index_same_name");

    await expect(ensureAttemptTwoGenerationGroupIndex(fakeModel)).rejects.toMatchObject({
      code: "ATTEMPT_TWO_INDEX_CONFLICT",
    });
  });

  test("createIndex failure fails closed and bootstrap helper rejects", async () => {
    const fakeModel = {
      createCollection: async () => {},
      collection: {
        listIndexes: () => ({
          toArray: async () => [],
        }),
        createIndex: async () => {
          const err = new Error("not authorized to create indexes");
          err.code = 13;
          throw err;
        },
      },
    };

    await expect(ensureExamQuestionRationaleCandidateIndexes(fakeModel)).rejects.toMatchObject({
      code: "ATTEMPT_TWO_INDEX_CREATE_FAILED",
    });
  });

  test("multiple Attempt 1 for one group allowed; second Attempt 2 rejected; other group allowed", async () => {
    await ensureAttemptTwoGenerationGroupIndex();
    const groupA = `${questionId.toString()}:a:${"a".repeat(64)}`;
    const groupB = `${questionId.toString()}:a:${"b".repeat(64)}`;
    const base = {
      questionId,
      partLabel: "a",
      sourceUpdatedAt: new Date(),
      sourceSnapshot: {},
      priorExplanation: "",
      explanation: "",
      promptVersion: "v1",
      model: "mock",
      generatedBy: actorId,
      generatedAt: new Date(),
    };

    await ExamQuestionRationaleCandidate.create({
      ...base,
      sourceFingerprint: "a".repeat(64),
      status: "failed",
      active: false,
      attemptNumber: 1,
      generationGroupKey: groupA,
      idempotencyKey: "idx-a1-one-xxxxxxxx",
    });
    await ExamQuestionRationaleCandidate.create({
      ...base,
      sourceFingerprint: "a".repeat(64),
      status: "failed",
      active: false,
      attemptNumber: 1,
      generationGroupKey: groupA,
      idempotencyKey: "idx-a1-two-xxxxxxxx",
    });
    expect(
      await ExamQuestionRationaleCandidate.countDocuments({ generationGroupKey: groupA, attemptNumber: 1 })
    ).toBe(2);

    await ExamQuestionRationaleCandidate.create({
      ...base,
      sourceFingerprint: "a".repeat(64),
      status: "pending",
      active: true,
      attemptNumber: 2,
      generationGroupKey: groupA,
      idempotencyKey: "idx-a2-one-xxxxxxxx",
    });

    await expect(
      ExamQuestionRationaleCandidate.create({
        ...base,
        sourceFingerprint: "a".repeat(64),
        status: "generating",
        active: true,
        attemptNumber: 2,
        generationGroupKey: groupA,
        idempotencyKey: "idx-a2-two-xxxxxxxx",
      })
    ).rejects.toMatchObject({ code: 11000 });

    await ExamQuestionRationaleCandidate.create({
      ...base,
      sourceFingerprint: "b".repeat(64),
      status: "pending",
      active: true,
      attemptNumber: 2,
      generationGroupKey: groupB,
      idempotencyKey: "idx-a2-other-xxxxxxx",
    });
    expect(
      await ExamQuestionRationaleCandidate.countDocuments({ generationGroupKey: groupB, attemptNumber: 2 })
    ).toBe(1);
  });

  test("isMongoAttemptTwoIndexCollision discriminates Attempt-2 index metadata", () => {
    expect(
      isMongoAttemptTwoIndexCollision({
        code: 11000,
        message: 'E11000 duplicate key error index: uq_attempt2_generation_group dup key: { generationGroupKey: "x" }',
      })
    ).toBe(true);
    expect(
      isMongoAttemptTwoIndexCollision({
        code: 11000,
        keyPattern: { generationGroupKey: 1 },
      })
    ).toBe(true);
    expect(
      isMongoAttemptTwoIndexCollision({
        code: 11000,
        keyPattern: { generatedBy: 1, idempotencyKey: 1 },
        message: "E11000 duplicate key error index: uq_actor_idempotency",
      })
    ).toBe(false);
    expect(isMongoAttemptTwoIndexCollision({ code: 11000, message: "other" })).toBe(false);
  });
});
