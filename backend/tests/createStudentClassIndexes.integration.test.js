/**
 * Integration: Student Class index tooling against isolated Mongo memory DB.
 */
"use strict";

const mongoose = require("mongoose");
const {
  executeStudentClassIndexes,
  wrapNativeCollection,
  REQUIRED_INDEXES,
  STL_UNIQUE_INDEX,
} = require("../scripts/migrations/create_student_class_indexes");

jest.setTimeout(60000);

describe("create_student_class_indexes integration", () => {
  function getCollection(name) {
    return wrapNativeCollection(mongoose.connection.db.collection(name));
  }

  beforeEach(async () => {
    const db = mongoose.connection.db;
    for (const name of [
      "studentclasses",
      "studentclassinvitations",
      "studentclassmemberships",
      "studentteacherlinks",
    ]) {
      try {
        await db.collection(name).drop();
      } catch {
        /* missing collection is fine */
      }
    }
  });

  test("dry-run on empty DB reports plan and creates nothing", async () => {
    const dbName = mongoose.connection.name;
    const before = await mongoose.connection.db.collection("studentclasses").indexes().catch(() => []);
    const result = await executeStudentClassIndexes({
      apply: false,
      confirmDatabase: dbName,
      dbName,
      getCollection,
    });
    expect(result.ok).toBe(true);
    expect(result.code).toBe("DRY_RUN");
    expect(result.wrote).toBe(false);
    expect(result.wouldCreate.length).toBeGreaterThanOrEqual(REQUIRED_INDEXES.length);
    const after = await mongoose.connection.db.collection("studentclasses").indexes().catch(() => []);
    expect(after.length).toBe(before.length);
  });

  test("apply creates missing indexes and verifies; second apply ALREADY_COMPLETE", async () => {
    const dbName = mongoose.connection.name;
    const first = await executeStudentClassIndexes({
      apply: true,
      confirmDatabase: dbName,
      dbName,
      getCollection,
    });
    expect(first.ok).toBe(true);
    expect(first.code).toBe("APPLIED");
    expect(first.verified).toBe(true);
    expect(first.created.length).toBeGreaterThanOrEqual(REQUIRED_INDEXES.length);

    const classIndexes = await mongoose.connection.db.collection("studentclasses").indexes();
    expect(classIndexes.some((i) => i.key && i.key.publicId === 1 && i.unique)).toBe(true);

    const invIndexes = await mongoose.connection.db.collection("studentclassinvitations").indexes();
    expect(
      invIndexes.some(
        (i) => i.unique && i.key && i.key.classId === 1 && i.key.targetEmail === 1
      )
    ).toBe(true);

    const memIndexes = await mongoose.connection.db.collection("studentclassmemberships").indexes();
    expect(
      memIndexes.some((i) => i.unique && i.key && i.key.classId === 1 && i.key.studentId === 1)
    ).toBe(true);

    const stlIndexes = await mongoose.connection.db.collection("studentteacherlinks").indexes();
    expect(
      stlIndexes.some(
        (i) =>
          i.unique &&
          i.key &&
          i.key.studentId === 1 &&
          i.key.teacherId === 1
      )
    ).toBe(true);
    expect(STL_UNIQUE_INDEX.keys).toEqual({ studentId: 1, teacherId: 1 });

    const second = await executeStudentClassIndexes({
      apply: true,
      confirmDatabase: dbName,
      dbName,
      getCollection,
    });
    expect(second.ok).toBe(true);
    expect(second.code).toBe("ALREADY_COMPLETE");
    expect(second.wrote).toBe(false);
    expect(second.verified).toBe(true);
  });

  test("duplicate invitation emails block apply (masked)", async () => {
    const dbName = mongoose.connection.name;
    const coll = mongoose.connection.db.collection("studentclassinvitations");
    const classId = new mongoose.Types.ObjectId();
    await coll.insertMany([
      {
        publicId: "inv-a",
        classId,
        teacherId: new mongoose.Types.ObjectId(),
        targetEmail: "dup.student@example.test",
        status: "pending",
        expiresAt: new Date(),
      },
      {
        publicId: "inv-b",
        classId,
        teacherId: new mongoose.Types.ObjectId(),
        targetEmail: "dup.student@example.test",
        status: "pending",
        expiresAt: new Date(),
      },
    ]);

    const result = await executeStudentClassIndexes({
      apply: true,
      confirmDatabase: dbName,
      dbName,
      getCollection,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("DUPLICATE_DATA");
    expect(result.wrote).toBe(false);
    expect(JSON.stringify(result)).not.toContain("dup.student@example.test");
  });

  test("never drops unrelated indexes", async () => {
    const dbName = mongoose.connection.name;
    const coll = mongoose.connection.db.collection("studentclasses");
    await coll.createIndex({ name: 1 }, { name: "unrelated_name_1" });

    const result = await executeStudentClassIndexes({
      apply: true,
      confirmDatabase: dbName,
      dbName,
      getCollection,
    });
    expect(result.ok).toBe(true);
    const indexes = await coll.indexes();
    expect(indexes.some((i) => i.name === "unrelated_name_1")).toBe(true);
  });
});
