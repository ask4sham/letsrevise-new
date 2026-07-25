/**
 * Focused unit tests for the older Adaptations for Pollination taxonomy repair.
 * No real database writes.
 */
"use strict";

const {
  TARGET_LESSON_ID,
  FORBIDDEN_LESSON_ID,
  EXPECTED_TITLE,
  CURRENT_TAXONOMY,
  CORRECTED_TAXONOMY,
  TAXONOMY_FIELDS,
  parseArgs,
  contentHash,
  contentCounts,
  buildCurrentStateFilter,
  buildTaxonomySet,
  executeRepair,
} = require("../scripts/migrations/repair_pollination_lesson_taxonomy");

function makeOldLesson(overrides = {}) {
  return {
    _id: TARGET_LESSON_ID,
    title: EXPECTED_TITLE,
    description: "Older curated version",
    content: "",
    subject: "Biology",
    topic: "Adaptations for Pollination",
    teacherId: "teacher-1",
    isPublished: false,
    status: "draft",
    board: CURRENT_TAXONOMY.board,
    level: CURRENT_TAXONOMY.level,
    // tier intentionally omitted (= undefined)
    specKey: CURRENT_TAXONOMY.specKey,
    topicKey: CURRENT_TAXONOMY.topicKey,
    canonicalTopicKey: CURRENT_TAXONOMY.canonicalTopicKey,
    pages: [
      {
        id: "p1",
        title: "Page 1",
        blocks: [
          { id: "b1", type: "text", content: "A" },
          { id: "b2", type: "text", content: "B" },
        ],
      },
      {
        id: "p2",
        title: "Page 2",
        blocks: [{ id: "b3", type: "text", content: "C" }],
      },
    ],
    flashcards: [
      { id: "f1", front: "q1", back: "a1" },
      { id: "f2", front: "q2", back: "a2" },
      { id: "f3", front: "q3", back: "a3" },
      { id: "f4", front: "q4", back: "a4" },
      { id: "f5", front: "q5", back: "a5" },
      { id: "f6", front: "q6", back: "a6" },
    ],
    quiz: { timeSeconds: 600, questions: [] },
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

      const titleOk = doc.title === filter.title;
      const boardOk = doc.board === filter.board;
      const levelOk = doc.level === filter.level;
      const specOk = doc.specKey === filter.specKey;
      const topicOk = doc.topicKey === filter.topicKey;
      const canonOk = doc.canonicalTopicKey === filter.canonicalTopicKey;
      const tierMissing =
        doc.tier === undefined || doc.tier === null || doc.tier === "";
      if (!(titleOk && boardOk && levelOk && specOk && topicOk && canonOk && tierMissing)) {
        return { matchedCount: 0, modifiedCount: 0 };
      }

      const set = (update && update.$set) || {};
      Object.assign(doc, set);
      doc.updatedAt = "2026-07-25T00:00:00.000Z";
      byId.set(id, doc);
      return { matchedCount: 1, modifiedCount: 1 };
    },
  };
}

describe("repair_pollination_lesson_taxonomy", () => {
  test("parseArgs: dry-run default; --apply and required flags", () => {
    expect(parseArgs([])).toEqual({
      apply: false,
      lessonId: null,
      confirmDatabase: null,
    });
    expect(
      parseArgs([
        "--apply",
        `--lesson-id=${TARGET_LESSON_ID}`,
        "--confirm-database=letsrevise",
      ])
    ).toEqual({
      apply: true,
      lessonId: TARGET_LESSON_ID,
      confirmDatabase: "letsrevise",
    });
  });

  test("dry-run performs no write", async () => {
    const store = makeStore([makeOldLesson()]);
    const result = await executeRepair({
      apply: false,
      lessonId: TARGET_LESSON_ID,
      confirmDatabase: "letsrevise",
      dbName: "letsrevise",
      findLessonById: store.findLessonById,
      updateOne: store.updateOne,
    });
    expect(result.ok).toBe(true);
    expect(result.code).toBe("DRY_RUN");
    expect(result.wrote).toBe(false);
    expect(store.writeCount()).toBe(0);
    expect(result.beforeCounts).toEqual({
      pageCount: 2,
      blockCount: 3,
      flashcardCount: 6,
      quizCount: 0,
    });
    expect(result.beforeHash).toMatch(/^[a-f0-9]{64}$/);
  });

  test("unexpected current taxonomy aborts", async () => {
    const store = makeStore([
      makeOldLesson({
        board: "Edexcel",
        specKey: "edexcel-igcse-biology",
        topicKey: "edexcel-igcse-biology:adaptations-for-pollination",
        canonicalTopicKey: "adaptations-for-pollination",
        tier: "higher",
      }),
    ]);
    const result = await executeRepair({
      apply: true,
      lessonId: TARGET_LESSON_ID,
      confirmDatabase: "letsrevise",
      dbName: "letsrevise",
      findLessonById: store.findLessonById,
      updateOne: store.updateOne,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("TAXONOMY_MISMATCH");
    expect(result.wrote).toBe(false);
    expect(store.writeCount()).toBe(0);
  });

  test("wrong lesson ID aborts", async () => {
    const store = makeStore([makeOldLesson()]);
    const result = await executeRepair({
      apply: true,
      lessonId: "000000000000000000000001",
      confirmDatabase: "letsrevise",
      dbName: "letsrevise",
      findLessonById: store.findLessonById,
      updateOne: store.updateOne,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("WRONG_LESSON_ID");
    expect(store.writeCount()).toBe(0);
  });

  test("new correct lesson is never selected", async () => {
    const newLesson = makeOldLesson({
      _id: FORBIDDEN_LESSON_ID,
      board: "Edexcel",
      level: "IGCSE",
      tier: "higher",
      specKey: "edexcel-igcse-biology",
      topicKey: "edexcel-igcse-biology:adaptations-for-pollination",
      canonicalTopicKey: "adaptations-for-pollination",
      flashcards: [],
      quiz: {
        questions: [
          { id: "q1", type: "mcq", question: "1" },
          { id: "q2", type: "mcq", question: "2" },
          { id: "q3", type: "mcq", question: "3" },
          { id: "q4", type: "mcq", question: "4" },
          { id: "q5", type: "mcq", question: "5" },
        ],
      },
    });
    const store = makeStore([makeOldLesson(), newLesson]);
    const result = await executeRepair({
      apply: true,
      lessonId: FORBIDDEN_LESSON_ID,
      confirmDatabase: "letsrevise",
      dbName: "letsrevise",
      findLessonById: store.findLessonById,
      updateOne: store.updateOne,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("FORBIDDEN_LESSON");
    expect(store.writeCount()).toBe(0);

    const afterNew = await store.findLessonById(FORBIDDEN_LESSON_ID);
    expect(afterNew.board).toBe("Edexcel");
    expect(afterNew.quiz.questions).toHaveLength(5);
  });

  test("only six taxonomy fields are changed; content preserved", async () => {
    const before = makeOldLesson();
    const beforeHash = contentHash(before);
    const beforeCounts = contentCounts(before);
    const pagesBefore = structuredClone(before.pages);
    const flashcardsBefore = structuredClone(before.flashcards);
    const quizBefore = structuredClone(before.quiz);
    const assessmentBefore = structuredClone(before.assessment);

    const store = makeStore([before]);
    const result = await executeRepair({
      apply: true,
      lessonId: TARGET_LESSON_ID,
      confirmDatabase: "letsrevise",
      dbName: "letsrevise",
      findLessonById: store.findLessonById,
      updateOne: store.updateOne,
    });

    expect(result.ok).toBe(true);
    expect(result.code).toBe("APPLIED");
    expect(result.wrote).toBe(true);
    expect(result.changedFields).toEqual([...TAXONOMY_FIELDS]);
    expect(result.changedFields).toHaveLength(6);
    expect(store.writeCount()).toBe(1);

    const setKeys = Object.keys(store.lastUpdate().$set).sort();
    expect(setKeys).toEqual([...TAXONOMY_FIELDS].sort());
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
    expect(after.flashcards).toEqual(flashcardsBefore);
    expect(after.quiz).toEqual(quizBefore);
    expect(after.assessment).toEqual(assessmentBefore);
    expect(contentCounts(after)).toEqual(beforeCounts);
    expect(contentHash(after)).toBe(beforeHash);
    expect(result.afterHash).toBe(beforeHash);
    expect(result.hashOk).toBe(true);
    expect(result.countsOk).toBe(true);
    expect(result.taxonomyOk).toBe(true);
  });

  test("database confirmation mismatch aborts (including staging without confirm)", async () => {
    const store = makeStore([makeOldLesson()]);
    const result = await executeRepair({
      apply: true,
      lessonId: TARGET_LESSON_ID,
      confirmDatabase: "letsrevise",
      dbName: "letsrevise_staging",
      findLessonById: store.findLessonById,
      updateOne: store.updateOne,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("DB_CONFIRMATION_MISMATCH");
    expect(store.writeCount()).toBe(0);
  });

  test("content hash ignores taxonomy and timestamps", () => {
    const a = makeOldLesson();
    const b = makeOldLesson({
      board: "Edexcel",
      level: "IGCSE",
      tier: "higher",
      specKey: "edexcel-igcse-biology",
      topicKey: "edexcel-igcse-biology:adaptations-for-pollination",
      canonicalTopicKey: "adaptations-for-pollination",
      updatedAt: "2099-01-01T00:00:00.000Z",
      createdAt: "2099-01-01T00:00:00.000Z",
      __v: 99,
    });
    expect(contentHash(a)).toBe(contentHash(b));

    const c = makeOldLesson({
      pages: [
        {
          id: "p1",
          title: "Page 1",
          blocks: [{ id: "b1", type: "text", content: "CHANGED" }],
        },
      ],
    });
    expect(contentHash(a)).not.toBe(contentHash(c));
  });
});
