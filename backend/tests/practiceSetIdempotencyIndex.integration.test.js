/**
 * PracticeSet idempotency index: definition, blank keys, preflight, verify, ensure (non-destructive).
 */
const mongoose = require("mongoose");
const PracticeSet = require("../models/PracticeSet");
const {
  PRACTICE_SET_IDEMPOTENCY_INDEX,
  preflightIdempotencyKeyDuplicates,
  verifyPracticeSetIdempotencyIndex,
  ensurePracticeSetIdempotencyIndex,
  isMatchingIdempotencyIndex,
} = require("../services/practiceSetIdempotencyIndex");

jest.setTimeout(20000);

describe("PracticeSet idempotency index", () => {
  const studentA = new mongoose.Types.ObjectId();
  const studentB = new mongoose.Types.ObjectId();
  const teacherId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    await ensurePracticeSetIdempotencyIndex(PracticeSet);
  });

  afterEach(async () => {
    await PracticeSet.deleteMany({
      studentId: { $in: [studentA, studentB] },
    });
  });

  test("schema declares exact partial unique index definition", () => {
    const indexes = PracticeSet.schema.indexes();
    const match = indexes.find(
      ([keys, opts]) =>
        keys.studentId === 1 &&
        keys.idempotencyKey === 1 &&
        opts &&
        opts.unique === true &&
        opts.partialFilterExpression &&
        opts.partialFilterExpression.idempotencyKey &&
        opts.partialFilterExpression.idempotencyKey.$type === "string"
    );
    expect(match).toBeTruthy();
    expect(PRACTICE_SET_IDEMPOTENCY_INDEX.keys).toEqual({ studentId: 1, idempotencyKey: 1 });
    expect(PRACTICE_SET_IDEMPOTENCY_INDEX.options.unique).toBe(true);
    expect(PRACTICE_SET_IDEMPOTENCY_INDEX.options.partialFilterExpression).toEqual({
      idempotencyKey: { $type: "string" },
    });
  });

  test("normalizeIdempotencyKey / setter: blank and whitespace become null", () => {
    expect(PracticeSet.normalizeIdempotencyKey("")).toBeNull();
    expect(PracticeSet.normalizeIdempotencyKey("   ")).toBeNull();
    expect(PracticeSet.normalizeIdempotencyKey(" key-1 ")).toBe("key-1");

    const doc = new PracticeSet({
      studentId: studentA,
      teacherId,
      specKey: "aqa-gcse-biology",
      topicKeys: ["aqa-gcse-biology:cell-structure"],
      items: [],
      idempotencyKey: "   ",
    });
    expect(doc.idempotencyKey).toBeNull();
  });

  test("two PracticeSets without idempotencyKey for same student are allowed", async () => {
    await PracticeSet.create([
      {
        studentId: studentA,
        teacherId,
        specKey: "aqa-gcse-biology",
        topicKeys: ["aqa-gcse-biology:cell-structure"],
        items: [],
      },
      {
        studentId: studentA,
        teacherId,
        specKey: "aqa-gcse-biology",
        topicKeys: ["aqa-gcse-biology:cell-structure"],
        items: [],
      },
    ]);
    const n = await PracticeSet.countDocuments({ studentId: studentA, idempotencyKey: null });
    expect(n).toBeGreaterThanOrEqual(2);
  });

  test("two PracticeSets with null idempotencyKey for same student are allowed", async () => {
    await PracticeSet.create([
      {
        studentId: studentA,
        teacherId,
        specKey: "aqa-gcse-biology",
        topicKeys: ["aqa-gcse-biology:cell-structure"],
        items: [],
        idempotencyKey: null,
      },
      {
        studentId: studentA,
        teacherId,
        specKey: "aqa-gcse-biology",
        topicKeys: ["aqa-gcse-biology:cell-structure"],
        items: [],
        idempotencyKey: null,
      },
    ]);
    expect(await PracticeSet.countDocuments({ studentId: studentA })).toBeGreaterThanOrEqual(2);
  });

  test("blank idempotencyKey is not stored as indexed string", async () => {
    const doc = await PracticeSet.create({
      studentId: studentA,
      teacherId,
      specKey: "aqa-gcse-biology",
      topicKeys: ["aqa-gcse-biology:cell-structure"],
      items: [],
      idempotencyKey: "   ",
    });
    const lean = await PracticeSet.findById(doc._id).lean();
    expect(lean.idempotencyKey == null || lean.idempotencyKey === null).toBe(true);
    expect(lean.idempotencyKey).not.toBe("");
  });

  test("same student + same valid key cannot create two documents", async () => {
    await PracticeSet.create({
      studentId: studentA,
      teacherId,
      specKey: "aqa-gcse-biology",
      topicKeys: ["aqa-gcse-biology:cell-structure"],
      items: [],
      idempotencyKey: "fresh-key-shared",
    });
    await expect(
      PracticeSet.create({
        studentId: studentA,
        teacherId,
        specKey: "aqa-gcse-biology",
        topicKeys: ["aqa-gcse-biology:cell-structure"],
        items: [],
        idempotencyKey: "fresh-key-shared",
      })
    ).rejects.toMatchObject({ code: 11000 });
  });

  test("same student + two different valid keys creates two sets", async () => {
    await PracticeSet.create({
      studentId: studentA,
      teacherId,
      specKey: "aqa-gcse-biology",
      topicKeys: ["aqa-gcse-biology:cell-structure"],
      items: [],
      idempotencyKey: "fresh-key-a",
    });
    await PracticeSet.create({
      studentId: studentA,
      teacherId,
      specKey: "aqa-gcse-biology",
      topicKeys: ["aqa-gcse-biology:cell-structure"],
      items: [],
      idempotencyKey: "fresh-key-b",
    });
    expect(await PracticeSet.countDocuments({ studentId: studentA })).toBe(2);
  });

  test("two students may use the same valid key independently", async () => {
    await PracticeSet.create({
      studentId: studentA,
      teacherId,
      specKey: "aqa-gcse-biology",
      topicKeys: ["aqa-gcse-biology:cell-structure"],
      items: [],
      idempotencyKey: "shared-across-students",
    });
    await PracticeSet.create({
      studentId: studentB,
      teacherId,
      specKey: "aqa-gcse-biology",
      topicKeys: ["aqa-gcse-biology:cell-structure"],
      items: [],
      idempotencyKey: "shared-across-students",
    });
    expect(await PracticeSet.countDocuments({ idempotencyKey: "shared-across-students" })).toBe(2);
  });

  test("legacy PracticeSet without idempotencyKey field remains valid", async () => {
    const doc = await PracticeSet.create({
      studentId: studentA,
      teacherId,
      specKey: "aqa-gcse-biology",
      topicKeys: ["aqa-gcse-biology:cell-structure"],
      items: [],
    });
    expect(doc._id).toBeTruthy();
    const lean = await PracticeSet.findById(doc._id).lean();
    expect(lean.specKey).toBe("aqa-gcse-biology");
  });

  test("verification recognises the correct index", async () => {
    const result = await verifyPracticeSetIdempotencyIndex(PracticeSet);
    expect(result.ok).toBe(true);
    expect(result.indexName).toBeTruthy();
  });

  test("verification rejects incompatible same-key index definition", () => {
    const bad = {
      key: { studentId: 1, idempotencyKey: 1 },
      unique: false,
      name: "bad",
    };
    expect(isMatchingIdempotencyIndex(bad)).toBe(false);
    const badPartial = {
      key: { studentId: 1, idempotencyKey: 1 },
      unique: true,
      partialFilterExpression: { idempotencyKey: { $exists: true } },
      name: "bad-partial",
    };
    expect(isMatchingIdempotencyIndex(badPartial)).toBe(false);
    const good = {
      key: { studentId: 1, idempotencyKey: 1 },
      unique: true,
      partialFilterExpression: { idempotencyKey: { $type: "string" } },
      name: "good",
    };
    expect(isMatchingIdempotencyIndex(good)).toBe(true);
  });

  test("preflight reports duplicate non-empty keys without modifying data", async () => {
    // Insert two docs with same key by temporarily dropping uniqueness is hard;
    // simulate preflight aggregation against crafted docs using raw collection insert
    // only if we can bypass index — skip if unique already blocks.
    // Instead: insert one, confirm preflight ok, count unchanged after preflight.
    await PracticeSet.create({
      studentId: studentA,
      teacherId,
      specKey: "aqa-gcse-biology",
      topicKeys: ["aqa-gcse-biology:cell-structure"],
      items: [],
      idempotencyKey: "preflight-only-once",
    });
    const before = await PracticeSet.countDocuments({ studentId: studentA });
    const preflight = await preflightIdempotencyKeyDuplicates(PracticeSet);
    expect(preflight.ok).toBe(true);
    expect(preflight.duplicateGroupCount).toBe(0);
    const after = await PracticeSet.countDocuments({ studentId: studentA });
    expect(after).toBe(before);
  });

  test("preflight detects duplicate non-empty keys without modifying documents", async () => {
    // Temporarily remove unique index so duplicates can be inserted for preflight coverage.
    try {
      await PracticeSet.collection.dropIndex("studentId_1_idempotencyKey_1_partial_string");
    } catch {
      /* index may not exist under that name yet */
    }
    await PracticeSet.collection.insertMany([
      {
        studentId: studentA,
        teacherId,
        specKey: "aqa-gcse-biology",
        topicKeys: ["aqa-gcse-biology:cell-structure"],
        items: [],
        idempotencyKey: "dup-key-raw",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        studentId: studentA,
        teacherId,
        specKey: "aqa-gcse-biology",
        topicKeys: ["aqa-gcse-biology:cell-structure"],
        items: [],
        idempotencyKey: "dup-key-raw",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const before = await PracticeSet.countDocuments({
      studentId: studentA,
      idempotencyKey: "dup-key-raw",
    });
    expect(before).toBe(2);
    const preflight = await preflightIdempotencyKeyDuplicates(PracticeSet);
    expect(preflight.ok).toBe(false);
    expect(preflight.duplicateGroupCount).toBeGreaterThanOrEqual(1);
    const after = await PracticeSet.countDocuments({
      studentId: studentA,
      idempotencyKey: "dup-key-raw",
    });
    expect(after).toBe(before);
    await PracticeSet.deleteMany({ studentId: studentA, idempotencyKey: "dup-key-raw" });
    await ensurePracticeSetIdempotencyIndex(PracticeSet);
  });
});
