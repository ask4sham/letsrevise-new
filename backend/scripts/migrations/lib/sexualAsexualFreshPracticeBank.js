/**
 * Staging fresh-practice bank blueprints (MCQ-only V1) for:
 * edexcel-igcse-biology:sexual-and-asexual-reproduction-differences
 *
 * Short-answer items are deferred until PracticeRunner supports honest marks out of N.
 * Pure helpers (no DB I/O). Used by seed_sexual_asexual_fresh_practice.js.
 */
"use strict";

const mongoose = require("mongoose");
const { fingerprintItem } = require("../../../utils/quizDedupe");
const { validateQuestionForPublish } = require("../../../utils/quizValidation");

const LESSON_ID = "6a5ff907bd802b4e9d85f8a9";
const TOPIC_KEY = "edexcel-igcse-biology:sexual-and-asexual-reproduction-differences";
const SPEC_KEY = "edexcel-igcse-biology";
const ALLOWED_DB_NAME = "letsrevise_staging";
const SEED_TAG = "sexual-asexual-fresh-practice-v1-mcq";
const EXPECTED_MCQ_COUNT = 10;
const FRESH_SESSION_LIMIT = 5;

/**
 * 10 original Higher-tier MCQ blueprints for Fresh Practice V1.
 * Two five-question sessions before the bank is exhausted (no padding).
 */
function getQuestionBlueprints() {
  return [
    {
      type: "mcq",
      skill: "recall",
      difficulty: 2,
      estimatedTimeSec: 45,
      questionText:
        "Which statement correctly describes the number of parents involved in sexual and asexual reproduction?",
      choices: [
        "Sexual reproduction involves two parents; asexual reproduction involves one parent",
        "Both sexual and asexual reproduction always require two parents",
        "Sexual reproduction involves one parent; asexual reproduction involves two parents",
        "Neither process involves parents because offspring form spontaneously",
      ],
      correctIndex: 0,
      explanation:
        "Sexual reproduction combines genetic material from two parents (or gametes of two mating types). Asexual reproduction produces offspring from a single parent.",
      tags: ["parents", "definition", SEED_TAG],
    },
    {
      type: "mcq",
      skill: "recall",
      difficulty: 2,
      estimatedTimeSec: 50,
      questionText:
        "Which process is required for sexual reproduction but not for asexual reproduction?",
      choices: [
        "Fusion of gametes during fertilisation",
        "Mitosis producing genetically identical cells",
        "Production of clones from one parent",
        "Growth of offspring by cell division alone",
      ],
      correctIndex: 0,
      explanation:
        "Sexual reproduction depends on gametes and fertilisation. Asexual reproduction does not use gametes or fertilisation.",
      tags: ["gametes", "fertilisation", SEED_TAG],
    },
    {
      type: "mcq",
      skill: "application",
      difficulty: 3,
      estimatedTimeSec: 55,
      questionText:
        "A species reproduces using meiosis to form haploid gametes that later fuse. Which type of reproduction is this, and why?",
      choices: [
        "Sexual reproduction, because meiosis and fertilisation produce genetic variation",
        "Asexual reproduction, because meiosis always makes identical clones",
        "Asexual reproduction, because gametes are not involved in meiosis",
        "Sexual reproduction, because meiosis prevents any genetic change",
      ],
      correctIndex: 0,
      explanation:
        "Meiosis produces haploid gametes; fertilisation restores the diploid number and creates new allele combinations, which is sexual reproduction.",
      tags: ["meiosis", "gametes", SEED_TAG],
    },
    {
      type: "mcq",
      skill: "recall",
      difficulty: 2,
      estimatedTimeSec: 45,
      questionText:
        "What is the usual genetic relationship between a parent and its asexually produced offspring?",
      choices: [
        "They are genetically identical clones (ignoring mutation)",
        "They share exactly half of their alleles, like siblings from sexual reproduction",
        "They are always more genetically diverse than sexually produced offspring",
        "They have unrelated DNA because asexual reproduction reshuffles chromosomes",
      ],
      correctIndex: 0,
      explanation:
        "Asexual reproduction is based on mitosis, so offspring are genetic copies of the parent unless mutation occurs.",
      tags: ["clones", "genetic-similarity", SEED_TAG],
    },
    {
      type: "mcq",
      skill: "application",
      difficulty: 3,
      estimatedTimeSec: 55,
      questionText:
        "In a stable environment with little change, why can asexual reproduction be advantageous?",
      choices: [
        "Successful genotypes can be copied quickly without needing a mate",
        "It maximises genetic variation so every offspring is unique",
        "It always requires fertilisation, which improves survival",
        "It prevents any offspring from inheriting useful alleles",
      ],
      correctIndex: 0,
      explanation:
        "If conditions suit the parent genotype, rapid cloning preserves that successful genotype without the cost of finding a mate.",
      tags: ["stable-environment", "advantage", SEED_TAG],
    },
    {
      type: "mcq",
      skill: "application",
      difficulty: 3,
      estimatedTimeSec: 60,
      questionText:
        "A population of genetically identical plants is wiped out after a new fungal disease spreads. Which explanation best fits this outcome?",
      choices: [
        "Low genetic variation meant few individuals had resistance alleles",
        "Sexual reproduction must have occurred, increasing disease risk",
        "Mitosis created many different genotypes that all failed equally",
        "Fertilisation removed all resistance alleles from the population",
      ],
      correctIndex: 0,
      explanation:
        "Clonal populations share susceptibility. Without variation, a pathogen that infects one genotype can infect nearly all.",
      tags: ["disease", "variation", "disadvantage", SEED_TAG],
    },
    {
      type: "mcq",
      skill: "analysis",
      difficulty: 3,
      estimatedTimeSec: 55,
      questionText:
        "Compared with sexual reproduction, asexual reproduction is often described as faster. What is the main reason?",
      choices: [
        "No mate is needed and offspring can be produced by mitosis alone",
        "Meiosis always finishes more quickly than mitosis",
        "Fertilisation happens automatically in asexual reproduction",
        "Asexual offspring always grow larger, so populations expand sooner",
      ],
      correctIndex: 0,
      explanation:
        "Asexual reproduction avoids mate-finding and gamete fusion; mitotic production of offspring can therefore be rapid.",
      tags: ["speed", "mitosis", SEED_TAG],
    },
    {
      type: "mcq",
      skill: "application",
      difficulty: 3,
      estimatedTimeSec: 60,
      questionText:
        "A potato plant grows new plants from underground tubers, while a nearby flowering plant produces seeds after pollination. Which comparison is correct?",
      choices: [
        "Tuber growth is asexual; seed production after pollination is sexual",
        "Both processes are sexual because new plants appear in both cases",
        "Both processes are asexual because plants do not produce gametes",
        "Tuber growth is sexual because tubers contain two parents’ DNA",
      ],
      correctIndex: 0,
      explanation:
        "Tubers produce clones by vegetative (asexual) means. Seeds formed after pollination and fertilisation are a product of sexual reproduction.",
      tags: ["application", "scenario", "organisms", SEED_TAG],
    },
    {
      type: "mcq",
      skill: "analysis",
      difficulty: 4,
      estimatedTimeSec: 65,
      questionText:
        "Scientists compare two groups of the same insect species. Group A offspring show many different allele combinations; Group B offspring are nearly identical to one parent. Which conclusion is best supported?",
      choices: [
        "Group A is mainly sexual; Group B is mainly asexual",
        "Group A is mainly asexual; Group B is mainly sexual",
        "Both groups must reproduce only by mitosis",
        "Neither group can survive environmental change",
      ],
      correctIndex: 0,
      explanation:
        "High allelic diversity among offspring indicates sexual reproduction; near-identity to one parent indicates asexual cloning.",
      tags: ["evidence", "variation", "exam-technique", SEED_TAG],
    },
    {
      type: "mcq",
      skill: "application",
      difficulty: 3,
      estimatedTimeSec: 55,
      questionText:
        "Why can sexual reproduction be more energetically costly than asexual reproduction?",
      choices: [
        "Producing gametes and finding a mate uses resources that asexual organisms can avoid spending",
        "Mitosis requires fertilisation, which always doubles energy use",
        "Sexual offspring never grow, so energy is wasted",
        "Asexual reproduction must produce two gametes for every offspring",
      ],
      correctIndex: 0,
      explanation:
        "Sexual reproduction often involves gamete production and mating behaviours, which cost energy; asexual reproduction can bypass those costs.",
      tags: ["energy-cost", "comparison", SEED_TAG],
    },
  ];
}

function blueprintToRecord(blueprint, ownerId) {
  const kind = "quiz";
  if (blueprint.type !== "mcq") {
    throw Object.assign(new Error("V1 seed accepts MCQ blueprints only"), {
      code: "SHORT_ANSWER_NOT_ALLOWED",
    });
  }

  const record = {
    ownerId,
    topicKey: TOPIC_KEY,
    specKey: SPEC_KEY,
    type: "mcq",
    questionText: blueprint.questionText,
    explanation: blueprint.explanation || "",
    tags: Array.isArray(blueprint.tags) ? blueprint.tags : [],
    difficulty: blueprint.difficulty ?? null,
    skill: blueprint.skill ?? null,
    estimatedTimeSec: blueprint.estimatedTimeSec ?? null,
    status: "published",
    kind,
    isArchived: false,
    choices: blueprint.choices || [],
    correctIndex: Number(blueprint.correctIndex) || 0,
    acceptableAnswers: [],
    matchMode: "contains",
    metadata: {
      source: SEED_TAG,
      lessonId: LESSON_ID,
      marks: 1,
      freshPracticeV1: "mcq-only",
    },
  };
  record.fingerprint = fingerprintItem(record, kind);
  return record;
}

function buildProposedRecords(ownerId) {
  if (!ownerId) {
    throw Object.assign(new Error("ownerId is required"), { code: "MISSING_OWNER" });
  }
  const oid =
    ownerId instanceof mongoose.Types.ObjectId
      ? ownerId
      : new mongoose.Types.ObjectId(String(ownerId));
  return getQuestionBlueprints().map((bp) => blueprintToRecord(bp, oid));
}

function validateProposedRecords(records) {
  const failures = [];
  const fps = new Set();
  const internalDupes = [];

  if (!Array.isArray(records) || records.length !== EXPECTED_MCQ_COUNT) {
    failures.push(
      `Expected exactly ${EXPECTED_MCQ_COUNT} records, got ${records ? records.length : 0}`
    );
  }

  const mcq = (records || []).filter((r) => r.type === "mcq");
  const short = (records || []).filter((r) => r.type === "short-answer");
  if (mcq.length !== EXPECTED_MCQ_COUNT) {
    failures.push(`Expected ${EXPECTED_MCQ_COUNT} MCQ, got ${mcq.length}`);
  }
  if (short.length !== 0) {
    failures.push(`Expected 0 short-answer in V1 seed, got ${short.length}`);
  }

  for (let i = 0; i < (records || []).length; i++) {
    const r = records[i];
    if (r.type !== "mcq") {
      failures.push(`Record ${i}: V1 allows mcq only`);
      continue;
    }
    if (r.topicKey !== TOPIC_KEY) {
      failures.push(`Record ${i}: topicKey must be ${TOPIC_KEY}`);
    }
    const pub = validateQuestionForPublish(r);
    if (!pub.valid) {
      failures.push(`Record ${i}: ${pub.errors.join("; ")}`);
    }
    if (!Array.isArray(r.choices) || r.choices.length !== 4) {
      failures.push(`Record ${i}: MCQ must have exactly 4 choices`);
    }
    if (r.correctIndex < 0 || r.correctIndex >= (r.choices || []).length) {
      failures.push(`Record ${i}: invalid correctIndex`);
    }
    const intended = (r.choices || [])[r.correctIndex];
    if (!intended || !String(intended).trim()) {
      failures.push(`Record ${i}: missing intended correct answer`);
    }
    const fp = r.fingerprint;
    if (!fp || String(fp).length < 12) {
      failures.push(`Record ${i}: missing fingerprint`);
    } else if (fps.has(fp)) {
      internalDupes.push(fp);
      failures.push(`Record ${i}: duplicate fingerprint in batch`);
    } else {
      fps.add(fp);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    uniqueFingerprintCount: fps.size,
    internalDuplicateFingerprints: internalDupes,
    mcqCount: mcq.length,
    shortAnswerCount: short.length,
  };
}

/**
 * Validate the complete insert batch before any write.
 * Returns docs ready for ordered insertMany, or ok:false with zero docs.
 */
function prepareValidatedInsertDocs(recordsToInsert, { publishedAt = new Date() } = {}) {
  const list = Array.isArray(recordsToInsert) ? recordsToInsert : [];
  if (list.length === 0) {
    return { ok: true, docs: [], failures: [] };
  }

  // For a partial insert slice (idempotent skip), count may be < 10 — validate item shape only.
  const failures = [];
  const fps = new Set();
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (r.type !== "mcq") failures.push(`Insert ${i}: not mcq`);
    if (r.topicKey !== TOPIC_KEY) failures.push(`Insert ${i}: bad topicKey`);
    if (!Array.isArray(r.choices) || r.choices.length !== 4) {
      failures.push(`Insert ${i}: need 4 choices`);
    }
    if (r.correctIndex < 0 || r.correctIndex >= (r.choices || []).length) {
      failures.push(`Insert ${i}: bad correctIndex`);
    }
    const pub = validateQuestionForPublish(r);
    if (!pub.valid) failures.push(`Insert ${i}: ${pub.errors.join("; ")}`);
    if (!r.fingerprint) failures.push(`Insert ${i}: missing fingerprint`);
    else if (fps.has(r.fingerprint)) failures.push(`Insert ${i}: duplicate fingerprint in insert batch`);
    else fps.add(r.fingerprint);
    if (!r.ownerId) failures.push(`Insert ${i}: missing ownerId`);
  }

  if (failures.length > 0) {
    return { ok: false, docs: [], failures, code: "BATCH_VALIDATION_FAILED" };
  }

  const docs = list.map((r) => ({
    ...r,
    publishedAt,
  }));
  return { ok: true, docs, failures: [] };
}

/**
 * Pure planning step (no writes).
 */
function planSeed(input) {
  const dbName = String(input.dbName || "").trim();
  if (dbName !== ALLOWED_DB_NAME) {
    return {
      ok: false,
      code: "INVALID_DATABASE",
      error: `Refusing to run: database name must be exactly "${ALLOWED_DB_NAME}" (got "${dbName || "(empty)"}")`,
      wouldInsert: 0,
      wouldSkip: 0,
    };
  }

  const lesson = input.lesson;
  if (!lesson) {
    return {
      ok: false,
      code: "MISSING_LESSON",
      error: `Lesson ${LESSON_ID} not found`,
      wouldInsert: 0,
      wouldSkip: 0,
    };
  }
  if (!lesson.teacherId) {
    return {
      ok: false,
      code: "MISSING_OWNER",
      error: `Lesson ${LESSON_ID} has no teacherId`,
      wouldInsert: 0,
      wouldSkip: 0,
    };
  }

  const ownerId = lesson.teacherId;
  const proposed = buildProposedRecords(ownerId);
  const validation = validateProposedRecords(proposed);
  if (!validation.ok) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      error: "Proposed batch failed validation",
      validation,
      wouldInsert: 0,
      wouldSkip: 0,
      ownerId: String(ownerId),
      proposedCount: proposed.length,
    };
  }

  const existing = new Set(
    [...(input.existingFingerprints || [])].map((f) => String(f).trim()).filter(Boolean)
  );
  const toInsert = proposed.filter((r) => !existing.has(r.fingerprint));
  const toSkip = proposed.filter((r) => existing.has(r.fingerprint));

  // Entire proposed bank must validate; insert slice must also pass pre-insert checks.
  const insertPrep = prepareValidatedInsertDocs(toInsert, { publishedAt: new Date(0) });
  if (!insertPrep.ok) {
    return {
      ok: false,
      code: "BATCH_VALIDATION_FAILED",
      error: "Insert batch failed validation; refusing to insert any records",
      validationFailures: insertPrep.failures,
      wouldInsert: 0,
      wouldSkip: toSkip.length,
      ownerId: String(ownerId),
    };
  }

  return {
    ok: true,
    code: "READY",
    dbName,
    lessonId: LESSON_ID,
    ownerId: String(ownerId),
    topicKey: TOPIC_KEY,
    proposedMcq: validation.mcqCount,
    proposedShortAnswer: 0,
    proposedTotal: proposed.length,
    uniqueFingerprints: validation.uniqueFingerprintCount,
    internalDuplicates: validation.internalDuplicateFingerprints.length,
    existingMatchingFingerprints: toSkip.length,
    wouldInsert: toInsert.length,
    wouldSkip: toSkip.length,
    freshSessionLimit: FRESH_SESSION_LIMIT,
    maxFreshSessionsBeforeExhaustion: Math.floor(EXPECTED_MCQ_COUNT / FRESH_SESSION_LIMIT),
    validationFailures: [],
    recordsToInsert: toInsert,
    recordsToSkip: toSkip.map((r) => ({ fingerprint: r.fingerprint, type: r.type })),
  };
}

function assertSourceHasNoHardcodedTeacherId(sourceText) {
  const text = String(sourceText || "");
  const banned = /(?:teacherId|ownerId)\s*[:=]\s*['"`][a-fA-F0-9]{24}['"`]/;
  return !banned.test(text);
}

/** Selector compatibility: standard fresh set requests 5 MCQs from this bank. */
function freshSelectorCanRequestFiveFromBank(bankSize = EXPECTED_MCQ_COUNT) {
  return Number(bankSize) >= FRESH_SESSION_LIMIT;
}

module.exports = {
  LESSON_ID,
  TOPIC_KEY,
  SPEC_KEY,
  ALLOWED_DB_NAME,
  SEED_TAG,
  EXPECTED_MCQ_COUNT,
  FRESH_SESSION_LIMIT,
  getQuestionBlueprints,
  buildProposedRecords,
  validateProposedRecords,
  prepareValidatedInsertDocs,
  planSeed,
  assertSourceHasNoHardcodedTeacherId,
  blueprintToRecord,
  freshSelectorCanRequestFiveFromBank,
};
