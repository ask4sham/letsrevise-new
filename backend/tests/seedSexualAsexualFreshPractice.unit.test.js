/**
 * Unit tests for staging fresh-practice MCQ-only bank seed planner (no DB writes).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const {
  LESSON_ID,
  TOPIC_KEY,
  ALLOWED_DB_NAME,
  EXPECTED_MCQ_COUNT,
  FRESH_SESSION_LIMIT,
  getQuestionBlueprints,
  buildProposedRecords,
  validateProposedRecords,
  prepareValidatedInsertDocs,
  planSeed,
  assertSourceHasNoHardcodedTeacherId,
  freshSelectorCanRequestFiveFromBank,
} = require("../scripts/migrations/lib/sexualAsexualFreshPracticeBank");

describe("seed sexual/asexual fresh-practice bank (MCQ-only V1)", () => {
  const ownerId = new mongoose.Types.ObjectId();

  test("exactly 10 MCQ blueprints and zero short-answer", () => {
    const bps = getQuestionBlueprints();
    expect(bps).toHaveLength(EXPECTED_MCQ_COUNT);
    expect(bps.every((b) => b.type === "mcq")).toBe(true);
    expect(bps.filter((b) => b.type === "short-answer")).toHaveLength(0);
  });

  test("built records: 10 MCQ, 4 choices, valid correctIndex, unique fingerprints", () => {
    const records = buildProposedRecords(ownerId);
    expect(records).toHaveLength(10);
    const v = validateProposedRecords(records);
    expect(v.ok).toBe(true);
    expect(v.uniqueFingerprintCount).toBe(10);
    expect(v.internalDuplicateFingerprints).toEqual([]);
    expect(v.mcqCount).toBe(10);
    expect(v.shortAnswerCount).toBe(0);
    for (const r of records) {
      expect(r.type).toBe("mcq");
      expect(r.topicKey).toBe(TOPIC_KEY);
      expect(String(r.ownerId)).toBe(String(ownerId));
      expect(r.status).toBe("published");
      expect(r.kind).toBe("quiz");
      expect(r.choices).toHaveLength(4);
      expect(r.correctIndex).toBeGreaterThanOrEqual(0);
      expect(r.correctIndex).toBeLessThan(4);
      expect(String(r.choices[r.correctIndex]).trim().length).toBeGreaterThan(0);
      expect(r.fingerprint).toBeTruthy();
    }
  });

  test("invalid database name refuses to run", () => {
    const plan = planSeed({
      dbName: "letsrevise",
      lesson: { teacherId: ownerId },
    });
    expect(plan.ok).toBe(false);
    expect(plan.code).toBe("INVALID_DATABASE");
    expect(plan.wouldInsert).toBe(0);
  });

  test("missing lesson refuses to run", () => {
    const plan = planSeed({ dbName: ALLOWED_DB_NAME, lesson: null });
    expect(plan.ok).toBe(false);
    expect(plan.code).toBe("MISSING_LESSON");
  });

  test("missing lesson owner refuses to run", () => {
    const plan = planSeed({
      dbName: ALLOWED_DB_NAME,
      lesson: { _id: LESSON_ID, teacherId: null },
    });
    expect(plan.ok).toBe(false);
    expect(plan.code).toBe("MISSING_OWNER");
  });

  test("dry-run planning creates no writes and would insert 10", () => {
    const plan = planSeed({
      dbName: ALLOWED_DB_NAME,
      lesson: { teacherId: ownerId },
      existingFingerprints: [],
    });
    expect(plan.ok).toBe(true);
    expect(plan.wouldInsert).toBe(10);
    expect(plan.proposedShortAnswer).toBe(0);
    expect(plan.recordsToInsert).toHaveLength(10);
    expect(plan.maxFreshSessionsBeforeExhaustion).toBe(2);
    expect(plan.dbName).toBe(ALLOWED_DB_NAME);
  });

  test("existing fingerprint is skipped", () => {
    const records = buildProposedRecords(ownerId);
    const oneFp = records[0].fingerprint;
    const plan = planSeed({
      dbName: ALLOWED_DB_NAME,
      lesson: { teacherId: ownerId },
      existingFingerprints: [oneFp],
    });
    expect(plan.ok).toBe(true);
    expect(plan.wouldSkip).toBe(1);
    expect(plan.wouldInsert).toBe(9);
    expect(plan.recordsToInsert.every((r) => r.fingerprint !== oneFp)).toBe(true);
  });

  test("second run would insert zero duplicates when all fingerprints exist", () => {
    const records = buildProposedRecords(ownerId);
    const plan = planSeed({
      dbName: ALLOWED_DB_NAME,
      lesson: { teacherId: ownerId },
      existingFingerprints: records.map((r) => r.fingerprint),
    });
    expect(plan.ok).toBe(true);
    expect(plan.wouldInsert).toBe(0);
    expect(plan.wouldSkip).toBe(10);
  });

  test("all records validate before insertion; partial invalid batch inserts zero", () => {
    const records = buildProposedRecords(ownerId);
    const prepOk = prepareValidatedInsertDocs(records);
    expect(prepOk.ok).toBe(true);
    expect(prepOk.docs).toHaveLength(10);

    const bad = records.map((r, i) =>
      i === 3 ? { ...r, choices: ["only-one"], correctIndex: 0 } : r
    );
    const prepBad = prepareValidatedInsertDocs(bad);
    expect(prepBad.ok).toBe(false);
    expect(prepBad.docs).toHaveLength(0);
    expect(prepBad.failures.length).toBeGreaterThan(0);
  });

  test("topic key namespaced; no hardcoded teacher id; ordered insertMany in seed script", () => {
    expect(TOPIC_KEY).toBe(
      "edexcel-igcse-biology:sexual-and-asexual-reproduction-differences"
    );
    expect(TOPIC_KEY.includes(":")).toBe(true);

    const libPath = path.join(
      __dirname,
      "../scripts/migrations/lib/sexualAsexualFreshPracticeBank.js"
    );
    const seedPath = path.join(
      __dirname,
      "../scripts/migrations/seed_sexual_asexual_fresh_practice.js"
    );
    const libSrc = fs.readFileSync(libPath, "utf8");
    const seedSrc = fs.readFileSync(seedPath, "utf8");
    expect(assertSourceHasNoHardcodedTeacherId(libSrc)).toBe(true);
    expect(assertSourceHasNoHardcodedTeacherId(seedSrc)).toBe(true);
    expect(seedSrc).toMatch(/Lesson\.teacherId|lesson\.teacherId/);
    expect(seedSrc).toMatch(/--dry-run/);
    expect(seedSrc).toMatch(/ordered:\s*true/);
    expect(seedSrc).not.toMatch(/ordered:\s*false/);
    expect(libSrc).not.toMatch(/type:\s*"short-answer"/);
  });

  test("existing Fresh Practice selector can request five from this bank", () => {
    expect(FRESH_SESSION_LIMIT).toBe(5);
    expect(freshSelectorCanRequestFiveFromBank(EXPECTED_MCQ_COUNT)).toBe(true);
    expect(freshSelectorCanRequestFiveFromBank(4)).toBe(false);
  });
});
