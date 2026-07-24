/**
 * Staging-only seed: TopicQuizQuestion MCQ bank (Fresh Practice V1) for
 * sexual/asexual reproduction differences.
 *
 * Safety:
 * - Refuses unless connected database name is exactly `letsrevise_staging`
 * - Resolves ownerId from Lesson.teacherId (never hardcodes a teacher id)
 * - Idempotent on ownerId + topicKey + fingerprint
 * - Validates the full insert batch before any write
 * - Ordered insertMany only (no unordered partial inserts)
 * - Supports --dry-run (connects for counts; never writes)
 *
 * Usage (Render staging shell / operator only — do not run from agent sessions):
 *   node scripts/migrations/seed_sexual_asexual_fresh_practice.js --dry-run
 *   node scripts/migrations/seed_sexual_asexual_fresh_practice.js
 */
"use strict";

require("dotenv").config();
const mongoose = require("mongoose");
const Lesson = require("../../models/Lesson");
const TopicQuizQuestion = require("../../models/TopicQuizQuestion");
const {
  LESSON_ID,
  TOPIC_KEY,
  ALLOWED_DB_NAME,
  planSeed,
  prepareValidatedInsertDocs,
} = require("./lib/sexualAsexualFreshPracticeBank");

const dryRun = process.argv.includes("--dry-run");

function mongoUri() {
  const u = String(process.env.MONGODB_URI || process.env.MONGO_URI || "").trim();
  if (!u) {
    throw new Error("Missing MONGODB_URI / MONGO_URI");
  }
  return u;
}

function publicReport(plan, extras = {}) {
  return {
    dryRun,
    dbName: plan.dbName || extras.dbName || null,
    lessonFound: Boolean(extras.lessonFound),
    ownerResolved: plan.ownerId || null,
    topicKey: TOPIC_KEY,
    lessonId: LESSON_ID,
    proposedMcqCount: plan.proposedMcq ?? null,
    proposedShortAnswerCount: plan.proposedShortAnswer ?? 0,
    proposedTotal: plan.proposedTotal ?? null,
    uniqueFingerprints: plan.uniqueFingerprints ?? null,
    internalDuplicates: plan.internalDuplicates ?? 0,
    existingMatchingFingerprints: plan.existingMatchingFingerprints ?? 0,
    wouldInsert: plan.wouldInsert ?? 0,
    wouldSkip: plan.wouldSkip ?? 0,
    maxFreshSessionsBeforeExhaustion: plan.maxFreshSessionsBeforeExhaustion ?? null,
    validationFailures: plan.validation?.failures || plan.validationFailures || [],
    code: plan.code,
    error: plan.error || null,
    insertedCount: extras.insertedCount ?? null,
    duplicateRace: extras.duplicateRace === true,
  };
}

async function run() {
  await mongoose.connect(mongoUri(), { serverSelectionTimeoutMS: 20000 });
  const dbName = mongoose.connection.name;

  try {
    if (dbName !== ALLOWED_DB_NAME) {
      const plan = planSeed({ dbName, lesson: null });
      console.log(JSON.stringify(publicReport(plan, { dbName, lessonFound: false }), null, 2));
      process.exitCode = 2;
      return;
    }

    const lesson = await Lesson.findById(LESSON_ID).select("teacherId topicKey specKey").lean();
    const ownerId = lesson && lesson.teacherId ? lesson.teacherId : null;

    let existingFingerprints = [];
    if (ownerId) {
      existingFingerprints = await TopicQuizQuestion.distinct("fingerprint", {
        ownerId,
        topicKey: TOPIC_KEY,
      });
    }

    const plan = planSeed({
      dbName,
      lesson,
      existingFingerprints,
    });

    if (!plan.ok) {
      console.log(JSON.stringify(publicReport(plan, { dbName, lessonFound: !!lesson }), null, 2));
      process.exitCode = 2;
      return;
    }

    if (dryRun) {
      console.log(
        JSON.stringify(
          publicReport(plan, { dbName, lessonFound: true, insertedCount: 0 }),
          null,
          2
        )
      );
      process.exitCode = 0;
      return;
    }

    // Real mode: validate complete insert batch, then ordered insert (all-or-nothing on validation).
    const prep = prepareValidatedInsertDocs(plan.recordsToInsert || [], {
      publishedAt: new Date(),
    });
    if (!prep.ok) {
      console.log(
        JSON.stringify(
          publicReport(
            {
              ...plan,
              ok: false,
              code: "BATCH_VALIDATION_FAILED",
              error: "Insert batch failed validation; zero records inserted",
              validationFailures: prep.failures,
              wouldInsert: 0,
            },
            { dbName, lessonFound: true, insertedCount: 0 }
          ),
          null,
          2
        )
      );
      process.exitCode = 2;
      return;
    }

    let insertedCount = 0;
    let duplicateRace = false;
    if (prep.docs.length > 0) {
      try {
        const result = await TopicQuizQuestion.insertMany(prep.docs, { ordered: true });
        insertedCount = result.length;
      } catch (e) {
        if (e && (e.code === 11000 || (e.writeErrors && e.writeErrors.some((w) => w.code === 11000)))) {
          // Duplicate race: do not delete existing records; rerun remains safe (skip fingerprints).
          duplicateRace = true;
          insertedCount = 0;
          console.log(
            JSON.stringify(
              publicReport(plan, {
                dbName,
                lessonFound: true,
                insertedCount: 0,
                duplicateRace: true,
              }),
              null,
              2
            )
          );
          console.error(
            JSON.stringify({
              error: "Duplicate key race during ordered insert; no further inserts attempted. Rerun dry-run then seed.",
              code: 11000,
            })
          );
          process.exitCode = 3;
          return;
        }
        throw e;
      }
    }

    console.log(
      JSON.stringify(
        publicReport(plan, { dbName, lessonFound: true, insertedCount, duplicateRace }),
        null,
        2
      )
    );
    process.exitCode = 0;
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(async (e) => {
  console.error(JSON.stringify({ error: String(e && e.message ? e.message : e), dryRun }));
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
