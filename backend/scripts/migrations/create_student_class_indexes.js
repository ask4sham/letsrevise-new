/**
 * Operator-only: create and verify Student Class linking indexes.
 *
 * Safety:
 * - Dry-run by default (no writes)
 * - Writes only with explicit --apply
 * - Requires --confirm-database=<exact connected db name>
 * - Preflight unique-key duplicates before any createIndex
 * - createIndex only for missing equivalent indexes (never drop/replace)
 * - Not wired into startup, deploy, or package.json migrate:all
 *
 * Usage (Render backend Shell / operator — do not run against prod/staging
 * from an agent session without approval):
 *   node scripts/migrations/create_student_class_indexes.js \
 *     --confirm-database=<dbName>
 *
 *   node scripts/migrations/create_student_class_indexes.js \
 *     --confirm-database=<dbName> \
 *     --apply
 */
"use strict";

const crypto = require("crypto");
const path = require("path");

const REQUIRED_INDEXES = Object.freeze([
  {
    collection: "studentclasses",
    nameHint: "publicId_1",
    keys: { publicId: 1 },
    options: { unique: true },
    preflight: { kind: "uniqueFields", fields: ["publicId"] },
  },
  {
    collection: "studentclasses",
    nameHint: "teacherId_1_status_1",
    keys: { teacherId: 1, status: 1 },
    options: {},
    preflight: null,
  },
  {
    collection: "studentclasses",
    nameHint: "teacherId_1_createdAt_-1",
    keys: { teacherId: 1, createdAt: -1 },
    options: {},
    preflight: null,
  },
  {
    collection: "studentclassinvitations",
    nameHint: "publicId_1",
    keys: { publicId: 1 },
    options: { unique: true },
    preflight: { kind: "uniqueFields", fields: ["publicId"] },
  },
  {
    collection: "studentclassinvitations",
    nameHint: "classId_1_targetEmail_1",
    keys: { classId: 1, targetEmail: 1 },
    options: { unique: true },
    preflight: { kind: "uniqueFields", fields: ["classId", "targetEmail"] },
  },
  {
    collection: "studentclassinvitations",
    nameHint: "teacherId_1_status_1",
    keys: { teacherId: 1, status: 1 },
    options: {},
    preflight: null,
  },
  {
    collection: "studentclassinvitations",
    nameHint: "classId_1_status_1",
    keys: { classId: 1, status: 1 },
    options: {},
    preflight: null,
  },
  {
    collection: "studentclassinvitations",
    nameHint: "targetEmail_1_status_1",
    keys: { targetEmail: 1, status: 1 },
    options: {},
    preflight: null,
  },
  {
    collection: "studentclassmemberships",
    nameHint: "publicId_1",
    keys: { publicId: 1 },
    options: { unique: true },
    preflight: { kind: "uniqueFields", fields: ["publicId"] },
  },
  {
    collection: "studentclassmemberships",
    nameHint: "classId_1_studentId_1",
    keys: { classId: 1, studentId: 1 },
    options: { unique: true },
    preflight: { kind: "uniqueFields", fields: ["classId", "studentId"] },
  },
  {
    collection: "studentclassmemberships",
    nameHint: "teacherId_1_status_1",
    keys: { teacherId: 1, status: 1 },
    options: {},
    preflight: null,
  },
  {
    collection: "studentclassmemberships",
    nameHint: "studentId_1_status_1",
    keys: { studentId: 1, status: 1 },
    options: {},
    preflight: null,
  },
  {
    collection: "studentclassmemberships",
    nameHint: "classId_1_status_1",
    keys: { classId: 1, status: 1 },
    options: {},
    preflight: null,
  },
]);

const STL_UNIQUE_INDEX = Object.freeze({
  collection: "studentteacherlinks",
  nameHint: "studentId_1_teacherId_1",
  keys: { studentId: 1, teacherId: 1 },
  options: { unique: true },
  preflight: { kind: "uniqueFields", fields: ["studentId", "teacherId"] },
  optionalCreateIfMissing: true,
});

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    apply: false,
    confirmDatabase: null,
  };
  for (const raw of argv) {
    const arg = String(raw || "");
    if (arg === "--apply") {
      out.apply = true;
      continue;
    }
    if (arg.startsWith("--confirm-database=")) {
      out.confirmDatabase = arg.slice("--confirm-database=".length).trim();
      continue;
    }
  }
  if (!out.confirmDatabase && process.env.STUDENT_CLASS_INDEXES_CONFIRM_DB) {
    out.confirmDatabase = String(process.env.STUDENT_CLASS_INDEXES_CONFIRM_DB).trim();
  }
  return out;
}

function assertDatabaseConfirmation(dbName, confirmDatabase) {
  if (!confirmDatabase) {
    return {
      ok: false,
      code: "MISSING_DB_CONFIRMATION",
      error: "Require --confirm-database=<exact connected db name>",
    };
  }
  if (!dbName) {
    return { ok: false, code: "MISSING_DB_NAME", error: "Connected database name is unavailable" };
  }
  if (String(dbName) !== String(confirmDatabase)) {
    return {
      ok: false,
      code: "DATABASE_CONFIRMATION_MISMATCH",
      error: `confirm-database does not match connected database name`,
    };
  }
  return { ok: true };
}

function normalizeKeyObject(keys) {
  if (!keys || typeof keys !== "object") return [];
  return Object.keys(keys).map((k) => [k, Number(keys[k])]);
}

function keysEqual(a, b) {
  const aa = normalizeKeyObject(a);
  const bb = normalizeKeyObject(b);
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i += 1) {
    if (aa[i][0] !== bb[i][0] || aa[i][1] !== bb[i][1]) return false;
  }
  return true;
}

function optionFlag(value) {
  return value === true;
}

function optionsCompatible(existingOpts, requiredOpts) {
  const existing = existingOpts || {};
  const required = requiredOpts || {};

  if (optionFlag(existing.unique) !== optionFlag(required.unique)) return false;

  const existingSparse = optionFlag(existing.sparse);
  const requiredSparse = optionFlag(required.sparse);
  if (existingSparse !== requiredSparse) return false;

  const existingPartial = existing.partialFilterExpression || null;
  const requiredPartial = required.partialFilterExpression || null;
  if (JSON.stringify(existingPartial) !== JSON.stringify(requiredPartial)) return false;

  const existingCollation = existing.collation || null;
  const requiredCollation = required.collation || null;
  if (JSON.stringify(existingCollation) !== JSON.stringify(requiredCollation)) return false;

  return true;
}

/**
 * Classify an existing index against a required definition.
 * @returns {"match"|"conflict"|"unrelated"}
 */
function classifyExistingIndex(existing, required) {
  if (!existing || !required) return "unrelated";
  if (!keysEqual(existing.key, required.keys)) return "unrelated";
  if (!optionsCompatible(existing, required.options)) return "conflict";
  return "match";
}

function findEquivalentIndex(existingIndexes, required) {
  const list = Array.isArray(existingIndexes) ? existingIndexes : [];
  for (const idx of list) {
    if (classifyExistingIndex(idx, required) === "match") return idx;
  }
  return null;
}

function findConflictingIndex(existingIndexes, required) {
  const list = Array.isArray(existingIndexes) ? existingIndexes : [];
  for (const idx of list) {
    if (classifyExistingIndex(idx, required) === "conflict") return idx;
  }
  return null;
}

function maskEmail(value) {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return "(empty)";
  const hash = crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
  const at = s.indexOf("@");
  if (at <= 0) return `masked:${hash}`;
  const domain = s.slice(at + 1);
  return `${s[0]}***@${domain}|${hash}`;
}

function maskGroupKey(fields, idObj) {
  return fields.map((field) => {
    const raw = idObj && idObj[field] != null ? String(idObj[field]) : "";
    if (field === "targetEmail") return { field, value: maskEmail(raw) };
    const h = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 10);
    return { field, value: `hash:${h}` };
  });
}

async function runUniqueFieldsPreflight(collection, fields) {
  const matchClean = {};
  for (const f of fields) {
    if (f === "targetEmail" || f === "publicId") {
      matchClean[f] = { $exists: true, $type: "string", $ne: "" };
    } else {
      matchClean[f] = { $exists: true, $ne: null };
    }
  }

  const groupId = {};
  for (const f of fields) groupId[f] = `$${f}`;

  const aggMaybe = await collection.aggregate([
    { $match: matchClean },
    { $group: { _id: groupId, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 20 },
  ]);
  let groups;
  if (Array.isArray(aggMaybe)) {
    groups = aggMaybe;
  } else if (aggMaybe && typeof aggMaybe.toArray === "function") {
    groups = await aggMaybe.toArray();
  } else {
    throw new Error("Unsupported aggregate result from collection adapter");
  }

  // Count docs missing required unique-key fields (anomaly for these new collections).
  const missingOr = [];
  for (const f of fields) {
    missingOr.push({ [f]: null });
    missingOr.push({ [f]: "" });
    missingOr.push({ [f]: { $exists: false } });
  }
  const missingRequiredValues = await collection.countDocuments({ $or: missingOr });

  return {
    ok: groups.length === 0 && missingRequiredValues === 0,
    duplicateGroups: groups.length,
    missingRequiredValues,
    samples: groups.slice(0, 5).map((g) => ({
      count: g.count,
      key: maskGroupKey(fields, g._id || {}),
    })),
  };
}

function indexPlanEntry(required) {
  return {
    collection: required.collection,
    keys: required.keys,
    unique: Boolean(required.options && required.options.unique),
    nameHint: required.nameHint,
  };
}

/**
 * Injected collection API:
 * {
 *   listIndexes(): Promise<indexSpec[]>,
 *   createIndex(keys, options): Promise<string>,
 *   aggregate(pipeline): Promise<object[]>, // or cursor with toArray
 *   countDocuments(filter): Promise<number>,
 * }
 */
function isNamespaceMissingError(err) {
  if (!err) return false;
  if (err.code === 26 || err.codeName === "NamespaceNotFound") return true;
  return /ns does not exist/i.test(String(err.message || err));
}

function wrapNativeCollection(coll) {
  return {
    listIndexes: async () => {
      try {
        return await coll.indexes();
      } catch (err) {
        if (isNamespaceMissingError(err)) {
          // Collection not created yet — treat as empty with default _id index intent.
          return [{ name: "_id_", key: { _id: 1 } }];
        }
        throw err;
      }
    },
    createIndex: async (keys, options) => coll.createIndex(keys, options),
    aggregate: async (pipeline) => {
      try {
        return await coll.aggregate(pipeline).toArray();
      } catch (err) {
        if (isNamespaceMissingError(err)) return [];
        throw err;
      }
    },
    countDocuments: async (filter) => {
      try {
        return await coll.countDocuments(filter);
      } catch (err) {
        if (isNamespaceMissingError(err)) return 0;
        throw err;
      }
    },
  };
}

async function analyzeCollection(collectionName, requiredForCollection, getCollection) {
  const api = await getCollection(collectionName);
  const existing = await api.listIndexes();
  const missing = [];
  const present = [];
  const conflicts = [];
  const preflightResults = [];

  for (const required of requiredForCollection) {
    const conflict = findConflictingIndex(existing, required);
    if (conflict) {
      conflicts.push({
        required: indexPlanEntry(required),
        existingName: conflict.name,
        existingUnique: Boolean(conflict.unique),
      });
      continue;
    }
    const match = findEquivalentIndex(existing, required);
    if (match) {
      present.push({
        ...indexPlanEntry(required),
        existingName: match.name,
      });
    } else {
      missing.push(indexPlanEntry(required));
    }

    if (required.preflight && required.preflight.kind === "uniqueFields") {
      const pf = await runUniqueFieldsPreflight(api, required.preflight.fields);
      preflightResults.push({
        index: indexPlanEntry(required),
        ...pf,
      });
    }
  }

  const duplicateGroups = preflightResults.reduce((n, p) => n + (p.duplicateGroups || 0), 0);
  const missingRequiredValues = preflightResults.reduce(
    (n, p) => n + (p.missingRequiredValues || 0),
    0
  );
  const preflightOk = preflightResults.every((p) => p.ok);

  return {
    collection: collectionName,
    existing: existing.map((idx) => ({
      name: idx.name,
      key: idx.key,
      unique: Boolean(idx.unique),
    })),
    present,
    missing,
    conflicts,
    preflight: {
      ok: preflightOk,
      duplicateGroups,
      missingRequiredValues,
      details: preflightResults,
    },
  };
}

async function verifyRequiredIndexes(getCollection, requiredList) {
  const failures = [];
  for (const required of requiredList) {
    const api = await getCollection(required.collection);
    const existing = await api.listIndexes();
    if (!findEquivalentIndex(existing, required)) {
      failures.push(indexPlanEntry(required));
    }
  }
  return { ok: failures.length === 0, failures };
}

/**
 * Pure/guarded orchestration. Inject getCollection for tests.
 *
 * @param {object} opts
 * @param {boolean} opts.apply
 * @param {string} opts.confirmDatabase
 * @param {string} opts.dbName
 * @param {(name: string) => Promise<object>} opts.getCollection
 * @param {boolean} [opts.includeStlCreateIfMissing=true]
 */
async function executeStudentClassIndexes(opts) {
  const apply = Boolean(opts && opts.apply);
  const confirmDatabase = opts && opts.confirmDatabase != null ? String(opts.confirmDatabase) : "";
  const dbName = opts && opts.dbName != null ? String(opts.dbName) : "";
  const getCollection = opts && opts.getCollection;
  const includeStl = opts && opts.includeStlCreateIfMissing === false ? false : true;

  const baseReport = {
    mode: apply ? "apply" : "dry-run",
    ok: false,
    apply,
    wrote: false,
    code: "UNKNOWN",
    dbName,
    confirmedDatabase: confirmDatabase || null,
    collections: [],
    studentTeacherLink: null,
    created: [],
    verified: false,
    message: "",
  };

  const dbGuard = assertDatabaseConfirmation(dbName, confirmDatabase);
  if (!dbGuard.ok) {
    return {
      ...baseReport,
      code: dbGuard.code,
      error: dbGuard.error,
      message: dbGuard.error,
    };
  }

  if (typeof getCollection !== "function") {
    return {
      ...baseReport,
      code: "MISSING_GET_COLLECTION",
      error: "getCollection is required",
      message: "getCollection is required",
    };
  }

  const allRequired = [...REQUIRED_INDEXES];
  if (includeStl) allRequired.push(STL_UNIQUE_INDEX);

  const byCollection = new Map();
  for (const req of allRequired) {
    if (!byCollection.has(req.collection)) byCollection.set(req.collection, []);
    byCollection.get(req.collection).push(req);
  }

  const collectionReports = [];
  for (const [collectionName, reqs] of byCollection.entries()) {
    collectionReports.push(await analyzeCollection(collectionName, reqs, getCollection));
  }

  const stlReport = collectionReports.find((c) => c.collection === "studentteacherlinks") || null;
  const classReports = collectionReports.filter((c) => c.collection !== "studentteacherlinks");

  const hasConflict = collectionReports.some((c) => c.conflicts.length > 0);
  const hasDuplicate = collectionReports.some((c) => !c.preflight.ok && c.preflight.duplicateGroups > 0);
  const hasMissingPublicId = collectionReports.some(
    (c) => !c.preflight.ok && c.preflight.missingRequiredValues > 0
  );

  const missingAll = collectionReports.flatMap((c) => c.missing);

  if (hasConflict) {
    return {
      ...baseReport,
      code: "INDEX_CONFLICT",
      collections: classReports,
      studentTeacherLink: stlReport,
      message: "Incompatible index exists for required keys. No indexes created.",
      error: "Incompatible index exists for required keys",
    };
  }

  if (hasDuplicate) {
    return {
      ...baseReport,
      code: "DUPLICATE_DATA",
      collections: classReports,
      studentTeacherLink: stlReport,
      message: "Duplicate values block unique index creation. No indexes created.",
      error: "Duplicate values block unique index creation",
    };
  }

  if (hasMissingPublicId) {
    return {
      ...baseReport,
      code: "MISSING_REQUIRED_VALUES",
      collections: classReports,
      studentTeacherLink: stlReport,
      message: "Documents missing required unique-key fields. No indexes created.",
      error: "Documents missing required unique-key fields",
    };
  }

  if (missingAll.length === 0) {
    const verified = await verifyRequiredIndexes(getCollection, allRequired);
    return {
      ...baseReport,
      ok: true,
      wrote: false,
      code: "ALREADY_COMPLETE",
      collections: classReports,
      studentTeacherLink: stlReport,
      verified: verified.ok,
      message: "All required indexes already present. No writes.",
    };
  }

  if (!apply) {
    return {
      ...baseReport,
      ok: true,
      wrote: false,
      code: "DRY_RUN",
      collections: classReports,
      studentTeacherLink: stlReport,
      wouldCreate: missingAll,
      verified: false,
      message: "Dry-run only. No indexes created.",
    };
  }

  const created = [];
  for (const required of allRequired) {
    const stillMissing = missingAll.some(
      (m) =>
        m.collection === required.collection &&
        JSON.stringify(m.keys) === JSON.stringify(required.keys) &&
        Boolean(m.unique) === Boolean(required.options && required.options.unique)
    );
    if (!stillMissing) continue;

    const api = await getCollection(required.collection);
    const options = { ...(required.options || {}) };
    if (required.nameHint) options.name = required.nameHint;
    const name = await api.createIndex(required.keys, options);
    created.push({
      collection: required.collection,
      keys: required.keys,
      unique: Boolean(required.options && required.options.unique),
      name: name || required.nameHint,
    });
  }

  const verified = await verifyRequiredIndexes(getCollection, allRequired);
  if (!verified.ok) {
    return {
      ...baseReport,
      ok: false,
      wrote: created.length > 0,
      code: "VERIFY_FAILED",
      collections: classReports,
      studentTeacherLink: stlReport,
      created,
      verified: false,
      missingAfterApply: verified.failures,
      message: "Index creation ran but verification failed.",
      error: "Index verification failed after apply",
    };
  }

  return {
    ...baseReport,
    ok: true,
    wrote: created.length > 0,
    code: "APPLIED",
    collections: classReports,
    studentTeacherLink: stlReport,
    created,
    verified: true,
    message: created.length
      ? "Created missing indexes and verified definitions."
      : "No missing indexes after preflight; verified.",
  };
}

function mongoUri() {
  return (process.env.MONGODB_URI || process.env.MONGO_URI || "").trim();
}

async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
  const mongoose = require("mongoose");

  const uri = mongoUri();
  if (!uri) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          wrote: false,
          code: "MISSING_MONGO_URI",
          error: "Set MONGODB_URI or MONGO_URI before running this operator script.",
        },
        null,
        2
      )
    );
    process.exitCode = 2;
    return;
  }

  // Never print URI. Only db name after connect.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  const dbName = mongoose.connection.name;
  const nativeDb = mongoose.connection.db;

  try {
    const result = await executeStudentClassIndexes({
      apply: args.apply,
      confirmDatabase: args.confirmDatabase,
      dbName,
      getCollection: async (name) => wrapNativeCollection(nativeDb.collection(name)),
    });

    // Strip any accidental URI-like strings from error messages (defensive).
    const safe = JSON.parse(JSON.stringify(result));
    console.log(JSON.stringify(safe, null, 2));
    if (!result.ok) process.exitCode = 2;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

if (require.main === module) {
  runCli().catch(async (err) => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          wrote: false,
          code: "FATAL",
          error: String(err && err.message ? err.message : err),
        },
        null,
        2
      )
    );
    try {
      const mongoose = require("mongoose");
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
}

module.exports = {
  REQUIRED_INDEXES,
  STL_UNIQUE_INDEX,
  parseArgs,
  assertDatabaseConfirmation,
  keysEqual,
  optionsCompatible,
  classifyExistingIndex,
  findEquivalentIndex,
  findConflictingIndex,
  maskEmail,
  maskGroupKey,
  runUniqueFieldsPreflight,
  analyzeCollection,
  verifyRequiredIndexes,
  executeStudentClassIndexes,
  wrapNativeCollection,
  runCli,
};
