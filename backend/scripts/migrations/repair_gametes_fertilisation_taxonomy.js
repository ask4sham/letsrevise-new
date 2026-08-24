/**
 * One-record operator repair: fix incorrect AQA taxonomy on the
 * "Gametes & Fertilisation" lesson only.
 *
 * Target lesson:
 *   6a53d85e8410d0409ffd5d58
 *
 * Never touches the previous pollination repair target:
 *   6a5f91f0095f6f13d3e93142
 *
 * Authoritative registry:
 *   backend/config/edexcel_igcse_biology_topics.json
 *   → Gametes & Fertilisation → gametes-and-fertilisation
 *
 * Safety:
 * - Dry-run by default (no writes)
 * - Writes only with explicit --apply
 * - Requires --lesson-id matching the exact target
 * - Requires --confirm-database=letsrevise (and connected db must match)
 * - Requires title + current incorrect taxonomy to match exactly
 * - Atomic updateOne with a strict current-state filter
 * - Updates only board, level, tier, specKey, topicKey, canonicalTopicKey
 * - Not wired into startup, deploy, or package.json migrate:all
 *
 * Usage (operator only — do not run from agent sessions without approval):
 *   node scripts/migrations/repair_gametes_fertilisation_taxonomy.js \
 *     --lesson-id=6a53d85e8410d0409ffd5d58 \
 *     --confirm-database=letsrevise
 *
 *   node scripts/migrations/repair_gametes_fertilisation_taxonomy.js \
 *     --lesson-id=6a53d85e8410d0409ffd5d58 \
 *     --confirm-database=letsrevise \
 *     --apply
 */
"use strict";

const crypto = require("crypto");
const path = require("path");

const TARGET_LESSON_ID = "6a53d85e8410d0409ffd5d58";
const FORBIDDEN_LESSON_ID = "6a5f91f0095f6f13d3e93142";
const EXPECTED_TITLE =
  "Biology — Gametes & Fertilisation (Edexcel IGCSE Biology) (Higher Tier)";
const REQUIRED_CONFIRM_DATABASE = "letsrevise";

const CURRENT_TAXONOMY = Object.freeze({
  board: "AQA",
  level: "GCSE",
  tier: "higher",
  specKey: "aqa-gcse-biology",
  topicKey: "aqa-gcse-biology:rp-microbiology",
  canonicalTopicKey: "rp-microbiology",
});

const CORRECTED_TAXONOMY = Object.freeze({
  board: "Edexcel",
  level: "IGCSE",
  tier: "higher",
  specKey: "edexcel-igcse-biology",
  topicKey: "edexcel-igcse-biology:gametes-and-fertilisation",
  canonicalTopicKey: "gametes-and-fertilisation",
});

const TAXONOMY_FIELDS = Object.freeze([
  "board",
  "level",
  "tier",
  "specKey",
  "topicKey",
  "canonicalTopicKey",
]);

const HASH_EXCLUDE_FIELDS = Object.freeze([
  ...TAXONOMY_FIELDS,
  "createdAt",
  "updatedAt",
  "__v",
]);

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    apply: false,
    lessonId: null,
    confirmDatabase: null,
  };
  for (const raw of argv) {
    const arg = String(raw || "");
    if (arg === "--apply") {
      out.apply = true;
      continue;
    }
    if (arg.startsWith("--lesson-id=")) {
      out.lessonId = arg.slice("--lesson-id=".length).trim();
      continue;
    }
    if (arg.startsWith("--confirm-database=")) {
      out.confirmDatabase = arg.slice("--confirm-database=".length).trim();
      continue;
    }
  }
  if (!out.confirmDatabase && process.env.REPAIR_GAMETES_CONFIRM_DB) {
    out.confirmDatabase = String(process.env.REPAIR_GAMETES_CONFIRM_DB).trim();
  }
  return out;
}

function normalizeTierForCompare(value) {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function taxonomySnapshot(doc) {
  if (!doc || typeof doc !== "object") return null;
  return {
    board: doc.board === undefined || doc.board === null ? doc.board : String(doc.board),
    level: doc.level === undefined || doc.level === null ? doc.level : String(doc.level),
    tier: normalizeTierForCompare(doc.tier),
    specKey: doc.specKey === undefined || doc.specKey === null ? doc.specKey : String(doc.specKey),
    topicKey: doc.topicKey === undefined || doc.topicKey === null ? doc.topicKey : String(doc.topicKey),
    canonicalTopicKey:
      doc.canonicalTopicKey === undefined || doc.canonicalTopicKey === null
        ? doc.canonicalTopicKey
        : String(doc.canonicalTopicKey),
  };
}

function matchesExpectedTaxonomy(actual, expected) {
  if (!actual) return false;
  return (
    actual.board === expected.board &&
    actual.level === expected.level &&
    normalizeTierForCompare(actual.tier) === normalizeTierForCompare(expected.tier) &&
    actual.specKey === expected.specKey &&
    actual.topicKey === expected.topicKey &&
    actual.canonicalTopicKey === expected.canonicalTopicKey
  );
}

function taxonomyMismatchCode(actual, expected) {
  if (!actual) return "TAXONOMY_MISMATCH";
  if (actual.board !== expected.board) return "BOARD_MISMATCH";
  if (actual.topicKey !== expected.topicKey) return "TOPIC_KEY_MISMATCH";
  return "TAXONOMY_MISMATCH";
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function stripForContentHash(doc) {
  if (!doc || typeof doc !== "object") return null;
  const clone = JSON.parse(JSON.stringify(doc));
  delete clone._id;
  delete clone.id;
  for (const field of HASH_EXCLUDE_FIELDS) delete clone[field];
  return clone;
}

function contentHash(doc) {
  const stripped = stripForContentHash(doc);
  return crypto.createHash("sha256").update(stableStringify(stripped)).digest("hex");
}

function contentCounts(doc) {
  const pages = Array.isArray(doc && doc.pages) ? doc.pages : [];
  let blockCount = 0;
  for (const page of pages) {
    if (page && Array.isArray(page.blocks)) blockCount += page.blocks.length;
  }
  const flashcards = Array.isArray(doc && doc.flashcards) ? doc.flashcards : [];
  const quizQuestions =
    doc && doc.quiz && Array.isArray(doc.quiz.questions) ? doc.quiz.questions : [];
  const assessmentQuestions =
    doc && doc.assessment && Array.isArray(doc.assessment.questions)
      ? doc.assessment.questions
      : [];
  return {
    pageCount: pages.length,
    blockCount,
    flashcardCount: flashcards.length,
    quizCount: quizQuestions.length,
    assessmentCount: assessmentQuestions.length,
  };
}

function buildCurrentStateFilter(lessonId = TARGET_LESSON_ID) {
  return {
    _id: lessonId,
    title: EXPECTED_TITLE,
    board: CURRENT_TAXONOMY.board,
    level: CURRENT_TAXONOMY.level,
    tier: CURRENT_TAXONOMY.tier,
    specKey: CURRENT_TAXONOMY.specKey,
    topicKey: CURRENT_TAXONOMY.topicKey,
    canonicalTopicKey: CURRENT_TAXONOMY.canonicalTopicKey,
  };
}

function buildTaxonomySet() {
  return {
    board: CORRECTED_TAXONOMY.board,
    level: CORRECTED_TAXONOMY.level,
    tier: CORRECTED_TAXONOMY.tier,
    specKey: CORRECTED_TAXONOMY.specKey,
    topicKey: CORRECTED_TAXONOMY.topicKey,
    canonicalTopicKey: CORRECTED_TAXONOMY.canonicalTopicKey,
  };
}

function assertLessonIdAllowed(lessonId) {
  if (!lessonId) {
    return { ok: false, code: "MISSING_LESSON_ID", error: "Require --lesson-id=<exact target id>" };
  }
  if (String(lessonId) === FORBIDDEN_LESSON_ID) {
    return {
      ok: false,
      code: "FORBIDDEN_LESSON",
      error: `Refusing to operate on the pollination lesson ${FORBIDDEN_LESSON_ID}`,
    };
  }
  if (String(lessonId) !== TARGET_LESSON_ID) {
    return {
      ok: false,
      code: "WRONG_LESSON_ID",
      error: `lesson-id must be exactly ${TARGET_LESSON_ID}`,
    };
  }
  return { ok: true };
}

function assertDatabaseConfirmation(dbName, confirmDatabase) {
  if (!confirmDatabase) {
    return {
      ok: false,
      code: "MISSING_DB_CONFIRMATION",
      error: `Require --confirm-database=${REQUIRED_CONFIRM_DATABASE} (or REPAIR_GAMETES_CONFIRM_DB)`,
    };
  }
  if (String(confirmDatabase) !== REQUIRED_CONFIRM_DATABASE) {
    return {
      ok: false,
      code: "DB_CONFIRMATION_MISMATCH",
      error: `confirm-database must be exactly "${REQUIRED_CONFIRM_DATABASE}"`,
    };
  }
  if (!dbName) {
    return { ok: false, code: "MISSING_DB_NAME", error: "Connected database name is unavailable" };
  }
  if (String(dbName) !== String(confirmDatabase)) {
    return {
      ok: false,
      code: "DB_CONFIRMATION_MISMATCH",
      error: `confirm-database "${confirmDatabase}" does not match connected database "${dbName}"`,
    };
  }
  return { ok: true };
}

/**
 * Pure/guarded repair orchestration. Inject find/update deps for tests.
 */
async function executeRepair(opts) {
  const apply = Boolean(opts && opts.apply);
  const lessonId = opts && opts.lessonId != null ? String(opts.lessonId) : "";
  const confirmDatabase = opts && opts.confirmDatabase != null ? String(opts.confirmDatabase) : "";
  const dbName = opts && opts.dbName != null ? String(opts.dbName) : "";
  const findLessonById = opts && opts.findLessonById;
  const updateOne = opts && opts.updateOne;

  const idGuard = assertLessonIdAllowed(lessonId);
  if (!idGuard.ok) {
    return {
      ok: false,
      apply,
      wrote: false,
      code: idGuard.code,
      error: idGuard.error,
      lessonId,
      dbName,
      changedFields: [],
    };
  }

  const dbGuard = assertDatabaseConfirmation(dbName, confirmDatabase);
  if (!dbGuard.ok) {
    return {
      ok: false,
      apply,
      wrote: false,
      code: dbGuard.code,
      error: dbGuard.error,
      lessonId,
      dbName,
      changedFields: [],
    };
  }

  if (typeof findLessonById !== "function") {
    return {
      ok: false,
      apply,
      wrote: false,
      code: "MISSING_FIND",
      error: "findLessonById is required",
      lessonId,
      dbName,
      changedFields: [],
    };
  }

  const before = await findLessonById(lessonId);
  if (!before) {
    return {
      ok: false,
      apply,
      wrote: false,
      code: "LESSON_NOT_FOUND",
      error: `Lesson ${lessonId} not found`,
      lessonId,
      dbName,
      changedFields: [],
    };
  }

  if (String(before._id) === FORBIDDEN_LESSON_ID || String(before.id || "") === FORBIDDEN_LESSON_ID) {
    return {
      ok: false,
      apply,
      wrote: false,
      code: "FORBIDDEN_LESSON",
      error: `Refusing to operate on the pollination lesson ${FORBIDDEN_LESSON_ID}`,
      lessonId,
      dbName,
      changedFields: [],
    };
  }

  if (String(before.title || "") !== EXPECTED_TITLE) {
    return {
      ok: false,
      apply,
      wrote: false,
      code: "TITLE_MISMATCH",
      error: `Expected title "${EXPECTED_TITLE}", found "${before.title}"`,
      lessonId,
      dbName,
      changedFields: [],
      beforeTaxonomy: taxonomySnapshot(before),
    };
  }

  const beforeTaxonomy = taxonomySnapshot(before);
  if (!matchesExpectedTaxonomy(beforeTaxonomy, CURRENT_TAXONOMY)) {
    return {
      ok: false,
      apply,
      wrote: false,
      code: taxonomyMismatchCode(beforeTaxonomy, CURRENT_TAXONOMY),
      error: "Current taxonomy does not match the expected incorrect AQA state",
      lessonId,
      dbName,
      changedFields: [],
      beforeTaxonomy,
      expectedCurrentTaxonomy: { ...CURRENT_TAXONOMY },
    };
  }

  const beforeCounts = contentCounts(before);
  const beforeHash = contentHash(before);
  const filter = buildCurrentStateFilter(lessonId);
  const set = buildTaxonomySet();

  const reportBase = {
    ok: true,
    apply,
    wrote: false,
    code: apply ? "WOULD_APPLY" : "DRY_RUN",
    error: null,
    lessonId,
    dbName,
    title: before.title,
    beforeTaxonomy,
    proposedTaxonomy: { ...CORRECTED_TAXONOMY },
    beforeCounts,
    beforeHash,
    publication: {
      isPublished: before.isPublished,
      status: before.status,
    },
    changedFields: [...TAXONOMY_FIELDS],
    filter,
    set,
  };

  if (!apply) {
    return {
      ...reportBase,
      message: "Dry-run only. No write performed. Re-run with --apply to update.",
    };
  }

  if (typeof updateOne !== "function") {
    return {
      ...reportBase,
      ok: false,
      code: "MISSING_UPDATE",
      error: "updateOne is required for --apply",
    };
  }

  const updateResult = await updateOne(filter, { $set: set });
  const matchedCount = Number(updateResult && updateResult.matchedCount) || 0;
  const modifiedCount = Number(updateResult && updateResult.modifiedCount) || 0;

  if (matchedCount !== 1) {
    return {
      ...reportBase,
      ok: false,
      wrote: false,
      code: "ATOMIC_FILTER_MISMATCH",
      error: `Atomic update matched ${matchedCount} document(s); expected 1`,
      matchedCount,
      modifiedCount,
    };
  }

  const after = await findLessonById(lessonId);
  if (!after) {
    return {
      ...reportBase,
      ok: false,
      wrote: true,
      code: "POST_READ_MISSING",
      error: "Lesson missing after update",
      matchedCount,
      modifiedCount,
    };
  }

  const afterTaxonomy = taxonomySnapshot(after);
  const afterCounts = contentCounts(after);
  const afterHash = contentHash(after);
  const taxonomyOk = matchesExpectedTaxonomy(afterTaxonomy, CORRECTED_TAXONOMY);
  const countsOk =
    afterCounts.pageCount === beforeCounts.pageCount &&
    afterCounts.blockCount === beforeCounts.blockCount &&
    afterCounts.flashcardCount === beforeCounts.flashcardCount &&
    afterCounts.quizCount === beforeCounts.quizCount &&
    afterCounts.assessmentCount === beforeCounts.assessmentCount;
  const publicationOk =
    after.isPublished === before.isPublished && after.status === before.status;
  const hashOk = afterHash === beforeHash;

  if (!taxonomyOk || !countsOk || !hashOk || !publicationOk) {
    return {
      ...reportBase,
      ok: false,
      wrote: true,
      code: "POST_VERIFY_FAILED",
      error: "Post-apply verification failed",
      matchedCount,
      modifiedCount,
      afterTaxonomy,
      afterCounts,
      afterHash,
      taxonomyOk,
      countsOk,
      hashOk,
      publicationOk,
    };
  }

  return {
    ...reportBase,
    ok: true,
    wrote: true,
    code: "APPLIED",
    message: "Taxonomy fields updated; content hash and counts unchanged",
    matchedCount,
    modifiedCount,
    afterTaxonomy,
    afterCounts,
    afterHash,
    taxonomyOk,
    countsOk,
    hashOk,
    publicationOk,
  };
}

function mongoUri() {
  const u = String(process.env.MONGODB_URI || process.env.MONGO_URI || "").trim();
  if (!u) throw new Error("Missing MONGODB_URI / MONGO_URI");
  return u;
}

async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
  const mongoose = require("mongoose");
  const Lesson = require("../../models/Lesson");

  await mongoose.connect(mongoUri(), { serverSelectionTimeoutMS: 20000 });
  const dbName = mongoose.connection.name;

  try {
    const result = await executeRepair({
      apply: args.apply,
      lessonId: args.lessonId,
      confirmDatabase: args.confirmDatabase,
      dbName,
      findLessonById: async (id) => Lesson.findById(id).lean(),
      updateOne: async (filter, update) => {
        const res = await Lesson.updateOne(filter, update);
        return {
          matchedCount: res.matchedCount,
          modifiedCount: res.modifiedCount,
        };
      },
    });

    console.log(
      JSON.stringify(
        {
          mode: args.apply ? "apply" : "dry-run",
          ...result,
        },
        null,
        2
      )
    );

    if (!result.ok) process.exitCode = 2;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

if (require.main === module) {
  runCli().catch((err) => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          code: "FATAL",
          error: String(err && err.message ? err.message : err),
        },
        null,
        2
      )
    );
    process.exit(1);
  });
}

module.exports = {
  TARGET_LESSON_ID,
  FORBIDDEN_LESSON_ID,
  EXPECTED_TITLE,
  REQUIRED_CONFIRM_DATABASE,
  CURRENT_TAXONOMY,
  CORRECTED_TAXONOMY,
  TAXONOMY_FIELDS,
  parseArgs,
  taxonomySnapshot,
  matchesExpectedTaxonomy,
  contentHash,
  contentCounts,
  stripForContentHash,
  buildCurrentStateFilter,
  buildTaxonomySet,
  assertLessonIdAllowed,
  assertDatabaseConfirmation,
  executeRepair,
  runCli,
};
