/**
 * Block 28 Phase 2 batch review pack — unit tests (no DB writes).
 */
const { buildEdexcelBioReviewQueue, VARIATION_PILOT_LESSON_ID, MUTATION_LESSON_ID } = require("../services/block28Phase2/lessonQueue");
const { deriveLessonContentBoundary } = require("../services/block28Phase2/lessonContentBoundary");
const { auditLessonAttachments } = require("../services/block28Phase2/lessonAttachmentAudit");
const { classifyAttachments, proposeFinalSet, SELECTION } = require("../services/block28Phase2/selectionEngine");
const { proposeRetainedRepair, MARK_DEMAND } = require("../services/block28Phase2/repairProposals");
const { buildLessonReviewPack, PACK_STATUS } = require("../services/block28Phase2/batchReviewPack");
const { simulateLessonPractice } = require("../services/block28Phase2/practiceSimulator");
const { createReadOnlyDbFacade, BLOCKED_COLLECTION_OPERATIONS } = require("../services/block28Phase2/readOnlyDb");

function oid(n) {
  return String(n).padStart(24, "0").slice(0, 24);
}

function makeMaster(id, overrides = {}) {
  return {
    _id: oid(id),
    type: "short",
    subject: "Biology",
    examBoard: "Edexcel",
    level: "IGCSE",
    topicKey: "edexcel-igcse-biology:alleles",
    question: overrides.question || "Explain what an allele is.",
    marks: overrides.marks ?? 4,
    markScheme: overrides.markScheme ?? ["Point one.", "Point two."],
    status: "published",
    ...overrides,
  };
}

function makeLesson(id, refs, pages = []) {
  return {
    _id: oid(id),
    title: "Alleles",
    topicKey: "edexcel-igcse-biology:alleles",
    status: "published",
    pages,
    examQuestions: refs.map((r, i) => ({
      questionId: oid(r.q),
      addedAt: new Date(`2026-01-0${i + 1}`),
    })),
  };
}

const mockCensus = {
  edexcelIgcseBiology: {
    priorityQueue: [
      { lessonId: VARIATION_PILOT_LESSON_ID, title: "Variation", topicKey: "edexcel-igcse-biology:variation", currentServedInvalid: 0 },
      { lessonId: MUTATION_LESSON_ID, title: "Mutation", topicKey: "edexcel-igcse-biology:mutation", currentServedInvalid: 0 },
      { lessonId: oid(1), title: "Alleles", topicKey: "edexcel-igcse-biology:alleles", currentServedInvalid: 10 },
      { lessonId: oid(2), title: "DNA Structure", topicKey: "edexcel-igcse-biology:dna-structure", currentServedInvalid: 10 },
      { lessonId: oid(3), title: "Meiosis", topicKey: "edexcel-igcse-biology:meiosis", currentServedInvalid: 8 },
      { lessonId: oid(4), title: "Zygote", topicKey: "edexcel-igcse-biology:zygote", currentServedInvalid: 5 },
      { lessonId: oid(5), title: "RNA Structure", topicKey: "edexcel-igcse-biology:rna-structure", currentServedInvalid: 10 },
      { lessonId: oid(6), title: "ATP", topicKey: "edexcel-igcse-biology:atp", currentServedInvalid: 3 },
    ],
  },
};

describe("Block 28 Phase 2 batch review pack tooling", () => {
  test("queue excludes Variation and Mutation and sorts deterministically", () => {
    const q = buildEdexcelBioReviewQueue(mockCensus, { batchIndex: 1, batchSize: 5 });
    expect(q.excludedLessonIds).toContain(VARIATION_PILOT_LESSON_ID);
    expect(q.excludedLessonIds).toContain(MUTATION_LESSON_ID);
    expect(q.batch).toHaveLength(5);
    expect(q.batch[0].title).toBe("Alleles");
    expect(q.batch[1].title).toBe("DNA Structure");
    expect(q.batch.map((r) => r.lessonId)).not.toContain(VARIATION_PILOT_LESSON_ID);
    const q2 = buildEdexcelBioReviewQueue(mockCensus, { batchIndex: 1, batchSize: 5 });
    expect(q2.batch.map((r) => r.lessonId)).toEqual(q.batch.map((r) => r.lessonId));
  });

  test("lesson content boundary extracts page text", () => {
    const lesson = makeLesson(1, [], [
      { title: "Intro", blocks: [{ text: "<p>An allele is a version of a gene.</p>" }] },
    ]);
    const boundary = deriveLessonContentBoundary(lesson);
    expect(boundary.coreConcepts.length).toBeGreaterThan(0);
    expect(boundary.hasStructuredPages).toBe(true);
    expect(boundary.keyTerms.length).toBeGreaterThan(0);
  });

  test("unsupported composite does not consume practice limit", () => {
    const shorts = [];
    const masters = new Map();
    const refs = [];
    for (let i = 1; i <= 10; i++) {
      const m = makeMaster(i, {
        marks: 4,
        markScheme: ["a", "b"],
        question: `Explain allele concept number ${i} in detail.`,
      });
      masters.set(oid(i), m);
      refs.push({ q: i });
    }
    const composite = makeMaster(99, { type: "composite", question: "Composite stem about alleles" });
    masters.set(oid(99), composite);
    refs.unshift({ q: 99 });
    const lesson = makeLesson(10, refs);
    const usage = new Map(refs.map((r) => [oid(r.q), 1]));
    const audit = auditLessonAttachments(lesson, masters, usage);
    expect(audit.practiceSim.practiceCount).toBe(10);
    expect(audit.unsupportedCount).toBe(1);
  });

  test("selection detaches exact duplicates", () => {
    const m1 = makeMaster(1, { question: "Explain what an allele is.", marks: 4, markScheme: ["a", "b"] });
    const m2 = makeMaster(2, { question: "Explain what an allele is.", marks: 4, markScheme: ["c", "d"] });
    const masters = new Map([[oid(1), m1], [oid(2), m2]]);
    const lesson = makeLesson(5, [{ q: 1 }, { q: 2 }]);
    const usage = new Map([[oid(1), 1], [oid(2), 1]]);
    const audit = auditLessonAttachments(lesson, masters, usage);
    const boundary = deriveLessonContentBoundary(lesson);
    const { classified } = classifyAttachments(audit, boundary);
    const dupes = classified.filter((c) => c.selection === SELECTION.DETACH_DUPLICATE);
    expect(dupes.length).toBe(1);
  });

  test("repair proposal flags artificially padded recall questions", () => {
    const repair = proposeRetainedRepair({
      questionId: oid(1),
      question: "State two definitions of an allele.",
      marks: 4,
      markScheme: ["Definition one.", "Definition two."],
      markSchemeCount: 2,
    });
    expect(repair.markDemand.verdict).toBe(MARK_DEMAND.ARTIFICIALLY_PADDED);
    expect(repair.semanticReadiness).not.toBe("PASS");
    expect(repair.proposedScheme.some((p) => /Describes the process/i.test(p))).toBe(false);
  });

  test("full lesson pack builds without writes", () => {
    const masters = new Map();
    const refs = [];
    for (let i = 1; i <= 12; i++) {
      const m = makeMaster(i, {
        marks: 4,
        markScheme: ["Broad point A.", "Broad point B."],
        question: `Explain aspect ${i} of alleles and inheritance in species.`,
      });
      masters.set(oid(i), m);
      refs.push({ q: i });
    }
    const composite = makeMaster(99, { type: "composite", question: "Composite" });
    masters.set(oid(99), composite);
    refs.push({ q: 99 });
    const lesson = makeLesson(7, refs, [{ blocks: [{ text: "Alleles are different forms of a gene." }] }]);
    const usage = new Map(refs.map((r) => [oid(r.q), 1]));
    const pack = buildLessonReviewPack(lesson, masters, usage);
    expect(pack.proposedFinalSet.length).toBeLessThanOrEqual(10);
    expect(pack.audit.unsupportedCount).toBe(1);
    expect(pack.futureWritePlan.lessonAttachmentRebuild).toBe(true);
  });

  test("read-only facade blocks writes", () => {
    const raw = {
      databaseName: "test",
      collection: () => ({
        find: () => ({ toArray: async () => [] }),
        findOne: async () => null,
        updateOne: async () => ({}),
        insertOne: async () => ({}),
      }),
    };
    const facade = createReadOnlyDbFacade(raw);
    expect(() => facade.collection("lessons").updateOne).toThrow(/forbidden/i);
    for (const op of BLOCKED_COLLECTION_OPERATIONS) {
      expect(() => facade.collection("lessons")[op]).toThrow(/forbidden/i);
    }
  });

  test("practice simulator filters unsupported before limit", () => {
    const masters = new Map();
    const refs = [];
    for (let i = 1; i <= 3; i++) {
      const m = makeMaster(i, { marks: 2, markScheme: ["a", "b"] });
      masters.set(oid(i), m);
      refs.push({ questionId: oid(i) });
    }
    const composite = makeMaster(9, { type: "composite", question: "Comp" });
    masters.set(oid(9), composite);
    refs.unshift({ questionId: oid(9) });
    const sim = simulateLessonPractice({ examQuestions: refs }, masters, 10);
    expect(sim.practiceIds).toEqual([oid(1), oid(2), oid(3)]);
  });
});
