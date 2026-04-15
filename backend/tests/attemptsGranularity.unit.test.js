/**
 * @jest-environment node
 */
const { _parseCheckpointRevision } = require("../routes/attempts");

describe("parseCheckpointRevision", () => {
  test("null/empty → null", () => {
    expect(_parseCheckpointRevision(undefined)).toEqual({ ok: true, value: null });
    expect(_parseCheckpointRevision(null)).toEqual({ ok: true, value: null });
    expect(_parseCheckpointRevision("")).toEqual({ ok: true, value: null });
  });
  test("finite number", () => {
    expect(_parseCheckpointRevision(2)).toEqual({ ok: true, value: 2 });
  });
  test("non-finite number fails", () => {
    expect(_parseCheckpointRevision(NaN).ok).toBe(false);
  });
  test("string trimmed", () => {
    expect(_parseCheckpointRevision("  v1  ")).toEqual({ ok: true, value: "v1" });
  });
  test("object fails", () => {
    expect(_parseCheckpointRevision({}).ok).toBe(false);
  });
});

describe("PracticeAttempt schema optional fields", () => {
  const mongoose = require("mongoose");
  const uid = () => new mongoose.Types.ObjectId();
  test("legacy document shape validates", () => {
    const PracticeAttempt = require("../models/PracticeAttempt");
    const doc = new PracticeAttempt({
      userId: uid(),
      lessonId: uid(),
      source: "checkpoint",
      questionType: "mcq",
      isCorrect: true,
    });
    const err = doc.validateSync();
    expect(err).toBeUndefined();
  });
  test("with pageId and checkpointRevision", () => {
    const PracticeAttempt = require("../models/PracticeAttempt");
    const doc = new PracticeAttempt({
      userId: uid(),
      lessonId: uid(),
      source: "checkpoint",
      questionType: "mcq",
      isCorrect: true,
      pageId: "p_abc",
      checkpointRevision: 3,
    });
    const err = doc.validateSync();
    expect(err).toBeUndefined();
  });
});
