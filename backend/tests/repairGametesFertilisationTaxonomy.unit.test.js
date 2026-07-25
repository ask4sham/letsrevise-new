/**
 * Focused unit tests for the Gametes & Fertilisation taxonomy repair.
 * No real database writes.
 */
"use strict";

const {
  TARGET_LESSON_ID,
  FORBIDDEN_LESSON_ID,
  EXPECTED_TITLE,
  REQUIRED_CONFIRM_DATABASE,
  CURRENT_TAXONOMY,
  CORRECTED_TAXONOMY,
  TAXONOMY_FIELDS,
  parseArgs,
  contentHash,
  contentCounts,
  buildCurrentStateFilter,
  buildTaxonomySet,
  executeRepair,
} = require("../scripts/migrations/repair_gametes_fertilisation_taxonomy");

function makeBlocks(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `b${i + 1}`,
    type: "text",
    content: `block-${i + 1}`,
  }));
}

function makeFlashcards(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `f${i + 1}`,
    front: `q${i + 1}`,
    back: `a${i + 1}`,
  }));
}

function makeQuizQuestions(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `q${i + 1}`,
    type: "mcq",
    question: `Quiz ${i + 1}?`,
  }));
}

function makeTargetLesson(overrides = {}) {
  return {
    _id: TARGET_LESSON_ID,
    title: EXPECTED_TITLE,
    description: "Gametes lesson description",
    content: "",
    subject: "Biology",
    topic: "Gametes & Fertilisation",
    teacherId: "teacher-1",
    isPublished: false,
    status: "draft",
    board: CURRENT_TAXONOMY.board,
    level: CURRENT_TAXONOMY.level,
    tier: CURRENT_TAXONOMY.tier,
    specKey: CURRENT_TAXONOMY.specKey,
    topicKey: CURRENT_TAXONOMY.topicKey,
    canonicalTopicKey: CURRENT_TAXONOMY.canonicalTopicKey,
    pages: [
      {
        id: "p1",
        title: "Page 1",
        blocks: makeBlocks(22),
      },
    ],
    flashcards: makeFlashcards(8),
    quiz: { timeSeconds: 600, questions: makeQuizQuestions(6) },
    assessment: { questions: [{ id: "as1", type: "mcq", question: "Assess?" }] },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    __v: 3,
    ...overrides,
  };
}

function makeStore(initialDocs) {
  const byId = new Map(initialDocs.map((d) => [String(d._id), structuredClone(d)]));
  let writeCount = 0;
  let lastFilter = null;
  let lastUpdate = null;

  return {
    writeCount: () => writeCount,
    lastFilter: () => lastFilter,
    lastUpdate: () => lastUpdate,
    findLessonById: async (id) => {
      const doc = byId.get(String(id));
      return doc ? structuredClone(doc) : null;
    },
    updateOne: async (filter, update) => {
      lastFilter = filter;
      lastUpdate = update;
      writeCount += 1;
      const id = String(filter._id);
      const doc = byId.get(id);
      if (!doc) return { matchedCount: 0, modifiedCount: 0 };

      const matches =
        doc.title === filter.title &&
        doc.board === filter.board &&
        doc.level === filter.level &&
        doc.tier === filter.tier &&
        doc.specKey === filter.specKey &&
        doc.topicKey === filter.topicKey &&
        doc.canonicalTopicKey === filter.canonicalTopicKey;
      if (!matches) return { matchedCount: 0, modifiedCount: 0 };

      const set = (update && update.$set) || {};
      Object.assign(doc, set);
      doc.updatedAt = "2026-07-25T00:00:00.000Z";
      byId.set(id, doc);
      return { matchedCount: 1, modifiedCount: 1 };
    },
  };
}

describe("repair_gametes_fertilisation_taxonomy", () => {
  test("dry-run performs no write", async () => {
    const store = makeStore([makeTargetLesson()]);
    const result = await executeRepair({
      apply: false,
      lessonId: TARGET_LESSON_ID,
      confirmDatabase: REQUIRED_CONFIRM_DATABASE,
      dbName: REQUIRED_CONFIRM_DATABASE,
      findLessonById: store.findLessonById,
      updateOne: store.updateOne,
    });
    expect(result.ok).toBe(true);
    expect(result.code).toBe("DRY_RUN");
    expect(result.wrote).toBe(false);
    expect(store.writeCount()).toBe(0);
    expect(result.beforeCounts).toEqual({
      pageCount: 1,
      blockCount: 22,
      flashcardCount: 8,
      quizCount: 6,
      assessmentCount: 1,
    });
  });

  test("--apply is required for mutation", async () => {
    expect(parseArgs([]).apply).toBe(false);
    expect(parseArgs([`--lesson-id=${TARGET_LESSON_ID}`]).apply).toBe(false);

    const store = makeStore([makeTargetLesson()]);
    const dry = await executeRepair({
      apply: false,
      lessonId: TARGET_LESSON_ID,
      confirmDatabase: REQUIRED_CONFIRM_DATABASE,
      dbName: REQUIRED_CONFIRM_DATABASE,
      findLessonById: store.findLessonById,
      updateOne: store.updateOne,
    });
    expect(dry.wrote).toBe(false);
    expect(store.writeCount()).toBe(0);

    const applied = await executeRepair({
      apply: true,
      lessonId: TARGET_LESSON_ID,
      confirmDatabase: REQUIRED_CONFIRM_DATABASE,
      dbName: REQUIRED_CONFIRM_DATABASE,
      findLessonById: store.findLessonById,
      updateOne: store.updateOne,
    });
    expect(applied.ok).toBe(true);
    expect(applied.wrote).toBe(true);
    expect(store.writeCount()).toBe(1);
  });

  test("wrong lesson ID aborts", async () => {
    const store = makeStore([makeTargetLesson()]);
    const result = await executeRepair({
      apply: true,
      lessonId: "000000000000000000000001",
      confirmDatabase: REQUIRED_CONFIRM_DATABASE,
      dbName: REQUIRED_CONFIRM_DATABASE,
      findLessonById: store.findLessonById,
      updateOne: store.updateOne,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("WRONG_LESSON_ID");
    expect(store.writeCount()).toBe(0);
  });

  test("wrong database confirmation aborts", async () => {
    const store = makeStore([makeTargetLesson()]);
    const wrongName = await executeRepair({
      apply: true,
      lessonId: TARGET_LESSON_ID,
      confirmDatabase: "letsrevise_staging",
      dbName: "letsrevise_staging",
      findLessonById: store.findLessonById,
      updateOne: store.updateOne,
    });
    expect(wrongName.ok).toBe(false);
    expect(wrongName.code).toBe("DB_CONFIRMATION_MISMATCH");
    expect(store.writeCount()).toBe(0);

    const mismatch = await executeRepair({
      apply: true,
      lessonId: TARGET_LESSON_ID,
      confirmDatabase: REQUIRED_CONFIRM_DATABASE,
      dbName: "letsrevise_staging",
      findLessonById: store.findLessonById,
      updateOne: store.updateOne,
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.code).toBe("DB_CONFIRMATION_MISMATCH");
    expect(store.writeCount()).toBe(0);
  });

  test("wrong title aborts", async () => {
    const store = makeStore([makeTargetLesson({ title: "Wrong title" })]);
    const result = await executeRepair({
      apply: true,
      lessonId: TARGET_LESSON_ID,
      confirmDatabase: REQUIRED_CONFIRM_DATABASE,
      dbName: REQUIRED_CONFIRM_DATABASE,
      findLessonById: store.findLessonById,
      updateOne: store.updateOne,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("TITLE_MISMATCH");
    expect(store.writeCount()).toBe(0);
  });

  test("unexpected current board aborts", async () => {
    const store = makeStore([makeTargetLesson({ board: "OCR" })]);
    const result = await executeRepair({
      apply: true,
      lessonId: TARGET_LESSON_ID,
      confirmDatabase: REQUIRED_CONFIRM_DATABASE,
      dbName: REQUIRED_CONFIRM_DATABASE,
      findLessonById: store.findLessonById,
      updateOne: store.updateOne,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("BOARD_MISMATCH");
    expect(store.writeCount()).toBe(0);
  });

  test("unexpected current topicKey aborts", async () => {
    const store = makeStore([
      makeTargetLesson({
        topicKey: "aqa-gcse-biology:cell-structure",
        canonicalTopicKey: "cell-structure",
      }),
    ]);
    const result = await executeRepair({
      apply: true,
      lessonId: TARGET_LESSON_ID,
      confirmDatabase: REQUIRED_CONFIRM_DATABASE,
      dbName: REQUIRED_CONFIRM_DATABASE,
      findLessonById: store.findLessonById,
      updateOne: store.updateOne,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("TOPIC_KEY_MISMATCH");
    expect(store.writeCount()).toBe(0);
  });

  test("only six taxonomy fields change; content and publication preserved", async () => {
    const before = makeTargetLesson();
    const beforeHash = contentHash(before);
    const beforeCounts = contentCounts(before);
    const pagesBefore = structuredClone(before.pages);
    const blocksBefore = structuredClone(before.pages[0].blocks);
    const flashcardsBefore = structuredClone(before.flashcards);
    const quizBefore = structuredClone(before.quiz);
    const assessmentBefore = structuredClone(before.assessment);
    const publishedBefore = before.isPublished;
    const statusBefore = before.status;

    const store = makeStore([before]);
    const result = await executeRepair({
      apply: true,
      lessonId: TARGET_LESSON_ID,
      confirmDatabase: REQUIRED_CONFIRM_DATABASE,
      dbName: REQUIRED_CONFIRM_DATABASE,
      findLessonById: store.findLessonById,
      updateOne: store.updateOne,
    });

    expect(result.ok).toBe(true);
    expect(result.code).toBe("APPLIED");
    expect(result.changedFields).toEqual([...TAXONOMY_FIELDS]);
    expect(result.changedFields).toHaveLength(6);
    expect(Object.keys(store.lastUpdate().$set).sort()).toEqual([...TAXONOMY_FIELDS].sort());
    expect(store.lastFilter()).toEqual(buildCurrentStateFilter(TARGET_LESSON_ID));
    expect(store.lastUpdate().$set).toEqual(buildTaxonomySet());

    const after = await store.findLessonById(TARGET_LESSON_ID);
    expect(after.board).toBe(CORRECTED_TAXONOMY.board);
    expect(after.level).toBe(CORRECTED_TAXONOMY.level);
    expect(after.tier).toBe(CORRECTED_TAXONOMY.tier);
    expect(after.specKey).toBe(CORRECTED_TAXONOMY.specKey);
    expect(after.topicKey).toBe(CORRECTED_TAXONOMY.topicKey);
    expect(after.canonicalTopicKey).toBe(CORRECTED_TAXONOMY.canonicalTopicKey);

    expect(after.pages).toEqual(pagesBefore);
    expect(after.pages[0].blocks).toEqual(blocksBefore);
    expect(after.flashcards).toEqual(flashcardsBefore);
    expect(after.quiz).toEqual(quizBefore);
    expect(after.assessment).toEqual(assessmentBefore);
    expect(after.isPublished).toBe(publishedBefore);
    expect(after.status).toBe(statusBefore);
    expect(contentCounts(after)).toEqual(beforeCounts);
    expect(contentHash(after)).toBe(beforeHash);
    expect(result.hashOk).toBe(true);
    expect(result.countsOk).toBe(true);
    expect(result.taxonomyOk).toBe(true);
    expect(result.publicationOk).toBe(true);
  });

  test("correct target taxonomy is produced", async () => {
    const store = makeStore([makeTargetLesson()]);
    const result = await executeRepair({
      apply: true,
      lessonId: TARGET_LESSON_ID,
      confirmDatabase: REQUIRED_CONFIRM_DATABASE,
      dbName: REQUIRED_CONFIRM_DATABASE,
      findLessonById: store.findLessonById,
      updateOne: store.updateOne,
    });
    expect(result.ok).toBe(true);
    expect(result.afterTaxonomy).toEqual({ ...CORRECTED_TAXONOMY });
    expect(result.proposedTaxonomy).toEqual({ ...CORRECTED_TAXONOMY });
  });

  test("the previous pollination lesson is never selected", async () => {
    const pollination = makeTargetLesson({
      _id: FORBIDDEN_LESSON_ID,
      title: "Adaptations for Pollination",
      board: "AQA",
      level: "IGCSE",
      tier: undefined,
      specKey: "aqa-gcse-biology",
      topicKey: "aqa-gcse-biology:adaptations",
      canonicalTopicKey: "adaptations",
    });
    const store = makeStore([makeTargetLesson(), pollination]);
    const result = await executeRepair({
      apply: true,
      lessonId: FORBIDDEN_LESSON_ID,
      confirmDatabase: REQUIRED_CONFIRM_DATABASE,
      dbName: REQUIRED_CONFIRM_DATABASE,
      findLessonById: store.findLessonById,
      updateOne: store.updateOne,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("FORBIDDEN_LESSON");
    expect(store.writeCount()).toBe(0);

    const afterForbidden = await store.findLessonById(FORBIDDEN_LESSON_ID);
    expect(afterForbidden.topicKey).toBe("aqa-gcse-biology:adaptations");
  });
});
