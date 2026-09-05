/**
 * Block 28 Phase 2 dry-run tooling — unit tests (no live AI, no DB writes).
 */
const {
  buildP1Manifest,
  isBadMasterMaskedByAlignedLessonEdit,
} = require("../services/block28Phase2/p1Manifest");
const { classifyP1Master } = require("../services/block28Phase2/classifyRepair");
const { REPAIR_CLASS: RC } = require("../services/block28Phase2/constants");
const { runMarkSchemeProposal } = require("../services/block28Phase2/proposalRunner");
const { evaluateQualityGates } = require("../services/block28Phase2/qualityGates");
const {
  simulateLessonPractice,
  simulateRepairImpact,
} = require("../services/block28Phase2/practiceSimulator");
const { buildSharedMasterImpactReport } = require("../services/block28Phase2/sharedMasterReport");
const { captureMutationGoldenState } = require("../services/block28Phase2/mutationGoldenCapture");
const {
  BLOCKED_COLLECTION_OPERATIONS,
  BLOCKED_DB_OPERATIONS,
  createReadOnlyDbFacade,
  createReadOnlyAdapters,
} = require("../services/block28Phase2/readOnlyDb");
const { mergeExamQuestionForPractice } = require("../utils/mergeExamQuestionLessonEdit");
const { lessonEditFingerprint } = require("../services/block28Phase2/fingerprints");

function oid(n) {
  const hex = String(n).padStart(24, "0");
  return hex.slice(0, 24);
}

function makeMaster(id, overrides = {}) {
  return {
    _id: oid(id),
    type: "short",
    subject: "Biology",
    examBoard: "AQA",
    level: "GCSE",
    topicKey: "aqa-gcse-biology:cell-structure",
    question: overrides.question || "Explain how osmosis affects plant cells.",
    marks: overrides.marks ?? 4,
    markScheme: overrides.markScheme ?? ["Point one.", "Point two."],
    status: "published",
    metadata: { source: "ai_lesson_assets" },
    ...overrides,
  };
}

function makeLesson(id, refs, status = "published") {
  return {
    _id: oid(id),
    title: `Lesson ${id}`,
    status,
    examQuestions: refs.map((r, i) => ({
      questionId: oid(r.q),
      lessonEdit: r.lessonEdit,
      addedAt: new Date(`2026-01-0${i + 1}`),
    })),
  };
}

describe("Block 28 Phase 2 dry-run tooling", () => {
  test("1. manifest selects only P1 effective mismatches", async () => {
    const masterBad = makeMaster(1);
    const masterGood = makeMaster(2, {
      marks: 2,
      markScheme: ["A", "B"],
      question: "State two features of a plant cell.",
    });
    const lessons = [
      makeLesson(10, [{ q: 1 }]),
      makeLesson(11, [{ q: 2 }]),
    ];
    const manifest = await buildP1Manifest({
      fetchLessons: async () => lessons,
      fetchMastersByIds: async (ids) => {
        const map = new Map();
        if (ids.includes(oid(1))) map.set(oid(1), masterBad);
        if (ids.includes(oid(2))) map.set(oid(2), masterGood);
        return map;
      },
      enforceExpectedCensus: false,
    });
    expect(manifest.masters).toHaveLength(1);
    expect(manifest.masters[0].questionId).toBe(oid(1));
    expect(manifest.census.effectiveMismatchedAttachments).toBe(1);
  });

  test("2. draft lessons excluded from P1", async () => {
    const master = makeMaster(1);
    const lessons = [makeLesson(10, [{ q: 1 }], "draft")];
    const manifest = await buildP1Manifest({
      fetchLessons: async () => lessons,
      fetchMastersByIds: async () => new Map([[oid(1), master]]),
      enforceExpectedCensus: false,
    });
    expect(manifest.masters).toHaveLength(0);
    expect(manifest.census.effectiveMismatchedAttachments).toBe(0);
  });

  test("3. aligned effective questions excluded from P1", async () => {
    const master = makeMaster(1, {
      marks: 4,
      markScheme: ["Only one broad point about osmosis."],
    });
    const lesson = makeLesson(10, [
      {
        q: 1,
        lessonEdit: {
          type: "short",
          marks: 2,
          markScheme: ["Water enters by osmosis.", "Cell becomes turgid."],
        },
      },
    ]);
    const manifest = await buildP1Manifest({
      fetchLessons: async () => [lesson],
      fetchMastersByIds: async () => new Map([[oid(1), master]]),
      enforceExpectedCensus: false,
    });
    expect(manifest.masters).toHaveLength(0);
  });

  test("4. masked aligned P2 questions excluded from P1", () => {
    const master = makeMaster(1, { marks: 4, markScheme: ["A", "B"] });
    const ref = { questionId: oid(1), lessonEdit: { type: "short", marks: 4, markScheme: ["1", "2", "3", "4"] } };
    expect(isBadMasterMaskedByAlignedLessonEdit(master, ref)).toBe(true);
  });

  test("5. dedup 590 attachment instances to 552 masters shape supported", async () => {
    const master = makeMaster(1);
    const lessons = [makeLesson(10, [{ q: 1 }]), makeLesson(11, [{ q: 1 }])];
    const manifest = await buildP1Manifest({
      fetchLessons: async () => lessons,
      fetchMastersByIds: async () => new Map([[oid(1), master]]),
      enforceExpectedCensus: false,
    });
    expect(manifest.census.effectiveMismatchedAttachments).toBe(2);
    expect(manifest.census.uniqueMasters).toBe(1);
    expect(manifest.masters[0].lessonReferenceCount).toBe(2);
    expect(manifest.masters[0].sharedMasterWarning).toBe(true);
  });

  test("6. classification rules work conservatively", () => {
    const regen = classifyP1Master(
      makeMaster(1, {
        question: "Explain how diffusion occurs across a membrane.",
        marks: 4,
        markSchemeRaw: ["A", "B"],
        markSchemePointCount: 2,
      })
    );
    expect(regen.classification).toBe(RC.REGENERATE_MARK_SCHEME);

    const noSafe = classifyP1Master(
      makeMaster(2, { question: "", marks: 4, markSchemeRaw: [], markSchemePointCount: 0 })
    );
    expect(noSafe.classification).toBe(RC.NO_SAFE_PROPOSAL);
  });

  test("7. 4-mark/2-point Explain routes to REGENERATE_MARK_SCHEME", () => {
    const out = classifyP1Master({
      question: "Explain how mitosis produces genetically identical cells.",
      marks: 4,
      markSchemeRaw: ["Describe mitosis.", "Mention daughter cells."],
      markSchemePointCount: 2,
      type: "short",
    });
    expect(out.classification).toBe(RC.REGENERATE_MARK_SCHEME);
  });

  test("8. recall-style inflated marks routes to REVIEW_MARK_VALUE", () => {
    const out = classifyP1Master({
      question: "State two products of photosynthesis.",
      marks: 4,
      markSchemeRaw: ["Glucose and oxygen."],
      markSchemePointCount: 1,
      type: "short",
    });
    expect(out.classification).toBe(RC.REVIEW_MARK_VALUE);
  });

  test("9. AI proposal cannot change question", async () => {
    const master = {
      questionId: oid(1),
      question: "Explain osmosis in plant roots.",
      marks: 4,
      markSchemeRaw: ["A", "B"],
      repairClassification: RC.REGENERATE_MARK_SCHEME,
      subject: "Biology",
      board: "AQA",
      level: "GCSE",
      topicKey: "aqa-gcse-biology:osmosis",
    };
    const generate = async () => ({
      proposedMarkScheme: ["p1", "p2", "p3", "p4"],
      question: "CHANGED QUESTION",
      marks: 4,
    });
    const result = await runMarkSchemeProposal(master, { generate, allowRetry: false });
    expect(result.proposal.question).toBe(master.question);
    expect(result.qualityGates.deterministic.questionUnchanged).toBe(false);
    expect(result.proposalStatus).toBe("no_safe_proposal");
  });

  test("10. AI proposal cannot change marks", async () => {
    const master = {
      questionId: oid(1),
      question: "Explain osmosis.",
      marks: 4,
      markSchemeRaw: ["A", "B"],
      repairClassification: RC.REGENERATE_MARK_SCHEME,
      subject: "Biology",
    };
    const generate = async () => ({
      proposedMarkScheme: ["p1", "p2"],
      marks: 2,
    });
    const result = await runMarkSchemeProposal(master, { generate, allowRetry: false });
    expect(result.qualityGates.deterministic.marksUnchanged).toBe(false);
    expect(result.proposalStatus).toBe("no_safe_proposal");
  });

  test("11. proposed scheme must equal marks count", async () => {
    const master = {
      questionId: oid(1),
      question: "Explain osmosis.",
      marks: 4,
      markSchemeRaw: ["A", "B"],
      repairClassification: RC.REGENERATE_MARK_SCHEME,
      subject: "Biology",
    };
    const generate = async () => ({
      proposedMarkScheme: ["only", "two"],
      marks: 4,
    });
    const result = await runMarkSchemeProposal(master, { generate, allowRetry: false });
    expect(result.qualityGates.deterministic.schemeLengthMatchesMarks).toBe(false);
  });

  test("12. one retry max on structural gate failure", async () => {
    const master = {
      questionId: oid(1),
      question: "Explain osmosis.",
      marks: 4,
      markSchemeRaw: ["A", "B"],
      repairClassification: RC.REGENERATE_MARK_SCHEME,
      subject: "Biology",
    };
    let calls = 0;
    const generate = async () => {
      calls += 1;
      if (calls === 1) return { proposedMarkScheme: ["a", "b"], marks: 4 };
      return { proposedMarkScheme: ["a", "b", "c", "d"], marks: 4 };
    };
    const result = await runMarkSchemeProposal(master, { generate, allowRetry: true });
    expect(calls).toBe(2);
    expect(result.retried).toBe(true);
    expect(["structurally_valid", "needs_review"]).toContain(result.proposalStatus);
  });

  test("13. double-failure remains unapproved", async () => {
    const master = {
      questionId: oid(1),
      question: "Explain osmosis.",
      marks: 4,
      markSchemeRaw: ["A", "B"],
      repairClassification: RC.REGENERATE_MARK_SCHEME,
      subject: "Biology",
    };
    const generate = async () => ({ proposedMarkScheme: ["a", "b"], marks: 4 });
    const result = await runMarkSchemeProposal(master, { generate, allowRetry: true });
    expect(result.proposalStatus).toBe("no_safe_proposal");
    expect(result.approvalStatus).toBe("pending");
  });

  test("14. shared-master report includes all lessons", () => {
    const masters = [
      {
        questionId: oid(1),
        lessonReferenceCount: 2,
        sharedMasterWarning: true,
        publishedLessonRefs: [
          { lessonId: oid(10), lessonTitle: "L10", effectiveAligned: false },
          { lessonId: oid(11), lessonTitle: "L11", effectiveAligned: false },
        ],
      },
    ];
    const report = buildSharedMasterImpactReport(masters, {});
    expect(report).toHaveLength(1);
    expect(report[0].beforeAfterByLesson).toHaveLength(2);
    expect(report[0].multiLessonApprovalRequired).toBe(true);
  });

  test("15. simulator preserves attachment order", () => {
    const m1 = makeMaster(1, { marks: 2, markScheme: ["a"] });
    const m2 = makeMaster(2, { marks: 2, markScheme: ["x", "y"] });
    const lesson = {
      _id: oid(99),
      examQuestions: [{ questionId: oid(1) }, { questionId: oid(2) }],
    };
    const masters = new Map([
      [oid(1), m1],
      [oid(2), m2],
    ]);
    const sim = simulateLessonPractice(lesson, masters, 10);
    expect(sim.attachmentOrder).toEqual([oid(1), oid(2)]);
  });

  test("16. simulator uses Phase 1 supported-type filter", () => {
    const composite = makeMaster(3, { type: "composite", question: "Composite stem" });
    const short = makeMaster(2, { marks: 2, markScheme: ["a"] });
    const lesson = {
      _id: oid(99),
      examQuestions: [{ questionId: oid(3) }, { questionId: oid(2) }],
    };
    const masters = new Map([
      [oid(3), composite],
      [oid(2), short],
    ]);
    const sim = simulateLessonPractice(lesson, masters, 10);
    expect(sim.practiceIds).toEqual([oid(2)]);
    expect(sim.practiceCount).toBe(1);
  });

  test("17. unsupported composite cannot consume practice limit", () => {
    const shorts = [];
    const masters = new Map();
    for (let i = 1; i <= 10; i++) {
      const m = makeMaster(i, {
        marks: 2,
        markScheme: ["a", "b"],
        question: `Short question ${i}?`,
      });
      shorts.push({ questionId: oid(i) });
      masters.set(oid(i), m);
    }
    const composite = makeMaster(99, { type: "composite", question: "Composite" });
    masters.set(oid(99), composite);
    const lesson = {
      _id: oid(50),
      examQuestions: [...shorts, { questionId: oid(99) }],
    };
    const sim = simulateLessonPractice(lesson, masters, 10);
    expect(sim.practiceCount).toBe(10);
    expect(sim.practiceIds).not.toContain(oid(99));
  });

  test("18. lessonEdit fingerprints unchanged in simulation", () => {
    const master = makeMaster(1, { marks: 4, markScheme: ["a", "b"] });
    const lessonEdit = {
      type: "short",
      marks: 4,
      markScheme: ["e1", "e2", "e3", "e4"],
    };
    const lesson = {
      _id: oid(10),
      examQuestions: [{ questionId: oid(1), lessonEdit }],
    };
    const masters = new Map([[oid(1), master]]);
    const before = simulateLessonPractice(lesson, masters, 10);
    const after = simulateRepairImpact({
      master,
      proposedMarkScheme: ["m1", "m2", "m3", "m4"],
      lessonsById: new Map([[oid(10), lesson]]),
      mastersById: masters,
    });
    expect(before.rows[0].lessonEditFingerprint).toBe(lessonEditFingerprint(lessonEdit));
    expect(after.lessonImpacts[0].lessonEditFingerprintsUnchanged).toBe(true);
    expect(after.lessonImpacts[0].effectiveContentChanged).toBe(false);
  });

  test("19. Mutation golden capture returns 10 supported positions", () => {
    const refs = [];
    const masters = new Map();
    for (let i = 1; i <= 10; i++) {
      const m = makeMaster(i, {
        marks: 2,
        markScheme: ["a", "b"],
        question: `Mutation short ${i}?`,
        topicKey: "edexcel-igcse-biology:mutation",
      });
      refs.push({ questionId: oid(i) });
      masters.set(oid(i), m);
    }
    const composite = makeMaster(99, {
      type: "composite",
      question: "Mutation composite stem",
      topicKey: "edexcel-igcse-biology:mutation",
    });
    masters.set(oid(99), composite);
    refs.push({ questionId: oid(99) });

    const lesson = { _id: oid(77), examQuestions: refs };
    const golden = captureMutationGoldenState(lesson, masters, 10);
    expect(golden.practiceCount).toBe(10);
    expect(golden.positions).toHaveLength(10);
    expect(golden.positions.every((p) => p.effectiveAligned)).toBe(true);
  });

  describe("read-only Mongo facade", () => {
    function makeMockRawDb() {
      const rawCollection = {
        find: () => ({
          toArray: async () => [],
          limit: function () {
            return this;
          },
          sort: function () {
            return this;
          },
          project: function () {
            return this;
          },
          aggregate: async () => [],
        }),
        findOne: async () => null,
        updateOne: async () => ({ acknowledged: true }),
        aggregate: async () => [],
        drop: async () => true,
        db: { databaseName: "test-db" },
      };
      return {
        databaseName: "test-db",
        collection: () => rawCollection,
        admin: () => ({}),
        dropDatabase: async () => true,
        client: { topology: {} },
      };
    }

    test("20. blocked collection operations are inaccessible", () => {
      const facade = createReadOnlyDbFacade(makeMockRawDb());
      const coll = facade.collection("lessons");
      for (const op of BLOCKED_COLLECTION_OPERATIONS) {
        expect(() => coll[op]).toThrow(/forbidden/i);
      }
    });

    test("21. blocked db operations are inaccessible", () => {
      const facade = createReadOnlyDbFacade(makeMockRawDb());
      for (const op of BLOCKED_DB_OPERATIONS) {
        if (op === "collection") continue;
        expect(() => facade[op]).toThrow(/forbidden/i);
      }
    });

    test("22. unknown collection property fails closed", () => {
      const facade = createReadOnlyDbFacade(makeMockRawDb());
      expect(() => facade.collection("lessons").db).toThrow(/forbidden/i);
      expect(() => facade.collection("lessons").s).toThrow(/forbidden/i);
      expect(() => facade.collection("lessons").namespace).toThrow(/forbidden/i);
    });

    test("23. unknown db property fails closed", () => {
      const facade = createReadOnlyDbFacade(makeMockRawDb());
      expect(() => facade.client).toThrow(/forbidden/i);
      expect(() => facade.s).toThrow(/forbidden/i);
    });

    test("24. unknown cursor property fails closed", () => {
      const facade = createReadOnlyDbFacade(makeMockRawDb());
      const cursor = facade.collection("lessons").find({});
      expect(() => cursor.forEach).toThrow(/forbidden/i);
      expect(() => cursor.map).toThrow(/forbidden/i);
    });

    test("25. aggregate is not exposed on collection facade", () => {
      const facade = createReadOnlyDbFacade(makeMockRawDb());
      expect(() => facade.collection("lessons").aggregate).toThrow(/forbidden/i);
    });

    test("26. adapters use only allowed read operations", async () => {
      const calls = [];
      const mockFacade = {
        get databaseName() {
          return "test-db";
        },
        collection(name) {
          return {
            find: (filter) => {
              calls.push({ op: "find", name, filter });
              return {
                toArray: async () => [],
                project: () => ({
                  toArray: async () => [],
                }),
              };
            },
            findOne: async (filter) => {
              calls.push({ op: "findOne", name, filter });
              return null;
            },
          };
        },
      };
      const adapters = createReadOnlyAdapters(mockFacade);
      await adapters.fetchLessons();
      await adapters.fetchMastersByIds(["507f1f77bcf86cd799439011"]);
      await adapters.fetchLessonById("507f1f77bcf86cd799439011");
      expect(calls.every((c) => c.op === "find" || c.op === "findOne")).toBe(true);
      expect(calls.some((c) => c.name === "lessons")).toBe(true);
      expect(calls.some((c) => c.name === "examquestions")).toBe(true);
    });
  });

  test("merge path sanity: effective aligned lessonEdit masks bad master", () => {
    const master = makeMaster(1, { marks: 4, markScheme: ["bad", "bad"] });
    const ref = {
      questionId: oid(1),
      lessonEdit: {
        type: "short",
        marks: 4,
        markScheme: ["good1", "good2", "good3", "good4"],
      },
    };
    const effective = mergeExamQuestionForPractice(master, ref);
    expect(effective.markScheme).toHaveLength(4);
    const gates = evaluateQualityGates(
      { question: master.question, marks: 4, type: "short" },
      { proposedMarkScheme: ["n1", "n2", "n3", "n4"], marks: 4, question: master.question }
    );
    expect(gates.deterministicPass).toBe(true);
  });
});
