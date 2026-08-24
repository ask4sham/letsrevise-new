/**
 * Pure unit tests for Student Class index operator tooling (no DB).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const {
  parseArgs,
  assertDatabaseConfirmation,
  keysEqual,
  classifyExistingIndex,
  findEquivalentIndex,
  findConflictingIndex,
  maskEmail,
  executeStudentClassIndexes,
  REQUIRED_INDEXES,
} = require("../scripts/migrations/create_student_class_indexes");

function makeCollectionStore(initialDocs = {}, initialIndexes = {}) {
  const docs = { ...initialDocs };
  const indexes = {};
  for (const [name, list] of Object.entries(initialIndexes)) {
    indexes[name] = list.map((i) => ({ ...i }));
  }
  const createCalls = [];

  return {
    createCalls: () => createCalls.slice(),
    getCollection: async (collectionName) => {
      if (!docs[collectionName]) docs[collectionName] = [];
      if (!indexes[collectionName]) {
        indexes[collectionName] = [{ name: "_id_", key: { _id: 1 } }];
      }
      return {
        listIndexes: async () => indexes[collectionName].map((i) => ({ ...i })),
        createIndex: async (keys, options = {}) => {
          createCalls.push({ collection: collectionName, keys, options });
          const name = options.name || Object.keys(keys).map((k) => `${k}_${keys[k]}`).join("_");
          indexes[collectionName].push({
            name,
            key: keys,
            unique: Boolean(options.unique),
            sparse: Boolean(options.sparse),
            partialFilterExpression: options.partialFilterExpression || undefined,
            collation: options.collation || undefined,
          });
          return name;
        },
        aggregate: async (pipeline) => {
          // Minimal aggregate for $match/$group/$match/$limit duplicate detection
          let rows = docs[collectionName].slice();
          for (const stage of pipeline) {
            if (stage.$match) {
              rows = rows.filter((doc) => matchDoc(doc, stage.$match));
            } else if (stage.$group) {
              const map = new Map();
              for (const doc of rows) {
                const idObj = {};
                for (const [k, pathExpr] of Object.entries(stage.$group._id)) {
                  const field = String(pathExpr).replace(/^\$/, "");
                  idObj[k] = doc[field];
                }
                const key = JSON.stringify(idObj);
                const prev = map.get(key) || { _id: idObj, count: 0 };
                prev.count += 1;
                map.set(key, prev);
              }
              rows = [...map.values()];
            } else if (stage.$limit) {
              rows = rows.slice(0, stage.$limit);
            }
          }
          return rows;
        },
        countDocuments: async (filter) =>
          docs[collectionName].filter((doc) => matchDoc(doc, filter)).length,
      };
    },
  };
}

function matchDoc(doc, filter) {
  if (!filter || typeof filter !== "object") return true;
  if (filter.$or) return filter.$or.some((f) => matchDoc(doc, f));
  for (const [key, cond] of Object.entries(filter)) {
    if (key === "$or") continue;
    const value = doc[key];
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      if (Object.prototype.hasOwnProperty.call(cond, "$exists")) {
        const exists = value !== undefined;
        if (Boolean(cond.$exists) !== exists) return false;
      }
      if (Object.prototype.hasOwnProperty.call(cond, "$ne") && value === cond.$ne) return false;
      if (Object.prototype.hasOwnProperty.call(cond, "$type")) {
        const t = cond.$type;
        if (t === "string" && typeof value !== "string") return false;
      }
      if (Object.prototype.hasOwnProperty.call(cond, "$in")) {
        if (!cond.$in.includes(value)) return false;
      }
    } else if (value !== cond) {
      return false;
    }
  }
  return true;
}

describe("create_student_class_indexes CLI helpers", () => {
  test("missing --confirm-database fails confirmation", () => {
    const args = parseArgs([]);
    expect(args.apply).toBe(false);
    expect(args.confirmDatabase).toBeNull();
    const guard = assertDatabaseConfirmation("testdb", args.confirmDatabase);
    expect(guard.ok).toBe(false);
    expect(guard.code).toBe("MISSING_DB_CONFIRMATION");
  });

  test("database mismatch fails", () => {
    const guard = assertDatabaseConfirmation("letsrevise_local_smoke", "letsrevise");
    expect(guard.ok).toBe(false);
    expect(guard.code).toBe("DATABASE_CONFIRMATION_MISMATCH");
  });

  test("parseArgs reads --apply and --confirm-database", () => {
    const args = parseArgs(["--apply", "--confirm-database=demo"]);
    expect(args.apply).toBe(true);
    expect(args.confirmDatabase).toBe("demo");
  });
});

describe("index comparison", () => {
  test("exact equivalent index treated as present", () => {
    const required = { keys: { publicId: 1 }, options: { unique: true } };
    const existing = [{ name: "publicId_1", key: { publicId: 1 }, unique: true }];
    expect(classifyExistingIndex(existing[0], required)).toBe("match");
    expect(findEquivalentIndex(existing, required)).toBeTruthy();
  });

  test("equivalent index with different name treated as present", () => {
    const required = { keys: { classId: 1, studentId: 1 }, options: { unique: true } };
    const existing = [
      { name: "custom_membership_uniq", key: { classId: 1, studentId: 1 }, unique: true },
    ];
    expect(findEquivalentIndex(existing, required).name).toBe("custom_membership_uniq");
  });

  test("same keys with incompatible unique option is conflict", () => {
    const required = { keys: { publicId: 1 }, options: { unique: true } };
    const existing = [{ name: "publicId_1", key: { publicId: 1 }, unique: false }];
    expect(classifyExistingIndex(existing[0], required)).toBe("conflict");
    expect(findConflictingIndex(existing, required)).toBeTruthy();
  });

  test("key order mismatch is not equivalent", () => {
    expect(keysEqual({ teacherId: 1, status: 1 }, { status: 1, teacherId: 1 })).toBe(false);
    const required = { keys: { teacherId: 1, status: 1 }, options: {} };
    const existing = [{ name: "x", key: { status: 1, teacherId: 1 } }];
    expect(findEquivalentIndex(existing, required)).toBeNull();
  });

  test("unrelated indexes ignored", () => {
    const required = { keys: { publicId: 1 }, options: { unique: true } };
    const existing = [{ name: "_id_", key: { _id: 1 } }, { name: "other_1", key: { other: 1 } }];
    expect(findEquivalentIndex(existing, required)).toBeNull();
    expect(findConflictingIndex(existing, required)).toBeNull();
  });
});

describe("masking", () => {
  test("maskEmail does not print full address", () => {
    const masked = maskEmail("student.a.class.smoke@example.test");
    expect(masked).not.toContain("student.a.class.smoke@example.test");
    expect(masked).toContain("@example.test");
    expect(masked).toMatch(/^s\*\*\*@/);
  });
});

describe("executeStudentClassIndexes dry-run / safety", () => {
  test("missing confirm-database fails with no createIndex", async () => {
    const store = makeCollectionStore();
    const result = await executeStudentClassIndexes({
      apply: true,
      confirmDatabase: "",
      dbName: "demo",
      getCollection: store.getCollection,
      includeStlCreateIfMissing: false,
    });
    expect(result.ok).toBe(false);
    expect(result.wrote).toBe(false);
    expect(result.code).toBe("MISSING_DB_CONFIRMATION");
    expect(store.createCalls()).toHaveLength(0);
  });

  test("database mismatch fails with no createIndex", async () => {
    const store = makeCollectionStore();
    const result = await executeStudentClassIndexes({
      apply: true,
      confirmDatabase: "other",
      dbName: "demo",
      getCollection: store.getCollection,
      includeStlCreateIfMissing: false,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("DATABASE_CONFIRMATION_MISMATCH");
    expect(store.createCalls()).toHaveLength(0);
  });

  test("dry-run performs no createIndex", async () => {
    const store = makeCollectionStore();
    const result = await executeStudentClassIndexes({
      apply: false,
      confirmDatabase: "demo",
      dbName: "demo",
      getCollection: store.getCollection,
      includeStlCreateIfMissing: false,
    });
    expect(result.ok).toBe(true);
    expect(result.code).toBe("DRY_RUN");
    expect(result.wrote).toBe(false);
    expect(result.wouldCreate.length).toBeGreaterThan(0);
    expect(store.createCalls()).toHaveLength(0);
  });

  test("empty collections pass preflight", async () => {
    const store = makeCollectionStore({
      studentclasses: [],
      studentclassinvitations: [],
      studentclassmemberships: [],
    });
    const result = await executeStudentClassIndexes({
      apply: false,
      confirmDatabase: "demo",
      dbName: "demo",
      getCollection: store.getCollection,
      includeStlCreateIfMissing: false,
    });
    expect(result.ok).toBe(true);
    for (const c of result.collections) {
      expect(c.preflight.ok).toBe(true);
      expect(c.preflight.duplicateGroups).toBe(0);
    }
  });

  test("unique publicId duplicates fail and prevent creation", async () => {
    const store = makeCollectionStore({
      studentclasses: [
        { publicId: "dup", name: "A" },
        { publicId: "dup", name: "B" },
      ],
      studentclassinvitations: [],
      studentclassmemberships: [],
    });
    const result = await executeStudentClassIndexes({
      apply: true,
      confirmDatabase: "demo",
      dbName: "demo",
      getCollection: store.getCollection,
      includeStlCreateIfMissing: false,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("DUPLICATE_DATA");
    expect(result.wrote).toBe(false);
    expect(store.createCalls()).toHaveLength(0);
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}"/i);
  });

  test("invitation class/email duplicates fail", async () => {
    const classId = "507f1f77bcf86cd799439011";
    const store = makeCollectionStore({
      studentclasses: [],
      studentclassinvitations: [
        { publicId: "a", classId, targetEmail: "one@example.test" },
        { publicId: "b", classId, targetEmail: "one@example.test" },
      ],
      studentclassmemberships: [],
    });
    const result = await executeStudentClassIndexes({
      apply: true,
      confirmDatabase: "demo",
      dbName: "demo",
      getCollection: store.getCollection,
      includeStlCreateIfMissing: false,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("DUPLICATE_DATA");
    expect(JSON.stringify(result)).not.toContain("one@example.test");
    expect(store.createCalls()).toHaveLength(0);
  });

  test("membership class/student duplicates fail", async () => {
    const classId = "507f1f77bcf86cd799439011";
    const studentId = "507f1f77bcf86cd799439012";
    const store = makeCollectionStore({
      studentclasses: [],
      studentclassinvitations: [],
      studentclassmemberships: [
        { publicId: "m1", classId, studentId },
        { publicId: "m2", classId, studentId },
      ],
    });
    const result = await executeStudentClassIndexes({
      apply: true,
      confirmDatabase: "demo",
      dbName: "demo",
      getCollection: store.getCollection,
      includeStlCreateIfMissing: false,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("DUPLICATE_DATA");
    expect(store.createCalls()).toHaveLength(0);
  });

  test("missing required publicId is reported", async () => {
    const store = makeCollectionStore({
      studentclasses: [{ name: "No publicId" }],
      studentclassinvitations: [],
      studentclassmemberships: [],
    });
    const result = await executeStudentClassIndexes({
      apply: true,
      confirmDatabase: "demo",
      dbName: "demo",
      getCollection: store.getCollection,
      includeStlCreateIfMissing: false,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("MISSING_REQUIRED_VALUES");
    expect(store.createCalls()).toHaveLength(0);
  });

  test("index conflict prevents all creation", async () => {
    const store = makeCollectionStore(
      {
        studentclasses: [],
        studentclassinvitations: [],
        studentclassmemberships: [],
      },
      {
        studentclasses: [
          { name: "_id_", key: { _id: 1 } },
          { name: "publicId_1", key: { publicId: 1 }, unique: false },
        ],
      }
    );
    const result = await executeStudentClassIndexes({
      apply: true,
      confirmDatabase: "demo",
      dbName: "demo",
      getCollection: store.getCollection,
      includeStlCreateIfMissing: false,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("INDEX_CONFLICT");
    expect(store.createCalls()).toHaveLength(0);
  });

  test("apply creates missing indexes and second apply is ALREADY_COMPLETE", async () => {
    const store = makeCollectionStore({
      studentclasses: [],
      studentclassinvitations: [],
      studentclassmemberships: [],
    });
    const first = await executeStudentClassIndexes({
      apply: true,
      confirmDatabase: "demo",
      dbName: "demo",
      getCollection: store.getCollection,
      includeStlCreateIfMissing: false,
    });
    expect(first.ok).toBe(true);
    expect(first.code).toBe("APPLIED");
    expect(first.wrote).toBe(true);
    expect(first.verified).toBe(true);
    expect(first.created.length).toBe(REQUIRED_INDEXES.length);
    expect(store.createCalls().length).toBe(REQUIRED_INDEXES.length);

    const second = await executeStudentClassIndexes({
      apply: true,
      confirmDatabase: "demo",
      dbName: "demo",
      getCollection: store.getCollection,
      includeStlCreateIfMissing: false,
    });
    expect(second.ok).toBe(true);
    expect(second.code).toBe("ALREADY_COMPLETE");
    expect(second.wrote).toBe(false);
    expect(second.verified).toBe(true);
    expect(store.createCalls().length).toBe(REQUIRED_INDEXES.length);
  });

  test("does not recreate existing equivalent indexes", async () => {
    const byColl = {
      studentclasses: [{ name: "_id_", key: { _id: 1 } }],
      studentclassinvitations: [{ name: "_id_", key: { _id: 1 } }],
      studentclassmemberships: [{ name: "_id_", key: { _id: 1 } }],
    };
    for (const r of REQUIRED_INDEXES) {
      byColl[r.collection].push({
        name: `alt_${r.nameHint}`,
        key: r.keys,
        unique: Boolean(r.options && r.options.unique),
      });
    }
    const store = makeCollectionStore(
      {
        studentclasses: [],
        studentclassinvitations: [],
        studentclassmemberships: [],
      },
      byColl
    );
    const result = await executeStudentClassIndexes({
      apply: true,
      confirmDatabase: "demo",
      dbName: "demo",
      getCollection: store.getCollection,
      includeStlCreateIfMissing: false,
    });
    expect(result.code).toBe("ALREADY_COMPLETE");
    expect(store.createCalls()).toHaveLength(0);
  });
});

describe("operator wiring safety", () => {
  test("script is not referenced by migrate:all or startup", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../package.json"), "utf8")
    );
    expect(pkg.scripts["migrate:all"]).not.toMatch(/create_student_class_indexes/);
    const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
    const app = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
    const database = fs.readFileSync(path.join(__dirname, "../config/database.js"), "utf8");
    expect(server).not.toMatch(/create_student_class_indexes/);
    expect(app).not.toMatch(/create_student_class_indexes/);
    expect(database).not.toMatch(/create_student_class_indexes/);
  });
});
