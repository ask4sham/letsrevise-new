import {
  buildSourceLinkageKey,
  findRevisionPracticeOverride,
  isRevisionPracticeOverride,
  removeRevisionPracticeOverride,
  upsertRevisionPracticeOverride,
  REVISION_PRACTICE_OVERRIDE_SOURCE_TYPE,
} from "./revisionPracticeOverrides";
import { buildRevisionPracticePool } from "./lessonQuestionPools";
import {
  collectCheckpointMcqsFromPages,
  sourceLinkageKeyFromCheckpoint,
} from "./revisionPracticeVariants";

const mutationBlockId = "blk_mutation_selfcheck";

const pagesWithMutation = [
  {
    pageId: "p1",
    blocks: [
      {
        id: mutationBlockId,
        type: "selfCheck",
        prompt: "What is a mutation in terms of genetic material?",
        options: ["A change in DNA sequence", "A type of cell division", "A protein fold", "A lipid layer"],
        correctAnswer: "A change in DNA sequence",
      },
    ],
  },
];

describe("revisionPracticeOverrides", () => {
  it("identifies revision practice overrides by sourceType and tags", () => {
    expect(
      isRevisionPracticeOverride({
        sourceType: REVISION_PRACTICE_OVERRIDE_SOURCE_TYPE,
        tags: ["revision-practice", "teacher-override"],
      })
    ).toBe(true);
    expect(isRevisionPracticeOverride({ sourceType: "topicQuizQuestion" })).toBe(false);
  });

  it("upserts without duplicating on same linkage key", () => {
    const first = upsertRevisionPracticeOverride([], {
      linkageKey: mutationBlockId,
      question: "Teacher Q1?",
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
    });
    expect(first).toHaveLength(1);
    const second = upsertRevisionPracticeOverride(first, {
      linkageKey: mutationBlockId,
      question: "Teacher Q1 edited?",
      options: ["A", "B", "C", "D"],
      correctAnswer: "B",
      existingOverrideId: first[0].id,
    });
    expect(second).toHaveLength(1);
    expect(second[0].question).toBe("Teacher Q1 edited?");
    expect(second[0].correctAnswer).toBe("B");
  });

  it("builds blockId:questionId linkage keys", () => {
    expect(buildSourceLinkageKey("blk1", "q1")).toBe("blk1:q1");
    expect(buildSourceLinkageKey("blk1")).toBe("blk1");
  });
});

describe("buildRevisionPracticePool with overrides", () => {
  it("matches legacy output when no overrides exist", () => {
    const legacy = buildRevisionPracticePool(pagesWithMutation, [], 5);
    const withEmpty = buildRevisionPracticePool(pagesWithMutation, [], 5);
    expect(withEmpty.map((q) => q.question)).toEqual(legacy.map((q) => q.question));
  });

  it("shows override and suppresses generated variant for same source", () => {
    const sources = collectCheckpointMcqsFromPages(pagesWithMutation);
    expect(sources).toHaveLength(1);
    expect(sourceLinkageKeyFromCheckpoint(sources[0])).toBe(mutationBlockId);

    const override = upsertRevisionPracticeOverride([], {
      linkageKey: mutationBlockId,
      question: "Which option best describes a DNA mutation?",
      options: ["A change in DNA sequence", "A type of cell division", "A protein fold", "A lipid layer"],
      correctAnswer: "A change in DNA sequence",
    })[0];

    const stored: Array<Record<string, unknown>> = [{ ...override }];
    const pool = buildRevisionPracticePool(pagesWithMutation, stored, 5);
    expect(pool).toHaveLength(1);
    expect(pool[0].question).toBe(override.question);
    expect(pool[0].sourceQuestionId).toBe(mutationBlockId);
  });

  it("keeps override after source prompt edit without duplicate generated question", () => {
    const override = upsertRevisionPracticeOverride([], {
      linkageKey: mutationBlockId,
      question: "Teacher mutation revision?",
      options: ["A change in DNA sequence", "B", "C", "D"],
      correctAnswer: "A change in DNA sequence",
    })[0];

    const editedPages = [
      {
        pageId: "p1",
        blocks: [
          {
            id: mutationBlockId,
            type: "selfCheck",
            prompt: "What is meant by a mutation in DNA?",
            options: ["A change in DNA sequence", "A type of cell division", "A protein fold", "A lipid layer"],
            correctAnswer: "A change in DNA sequence",
          },
        ],
      },
    ];

    const stored: Array<Record<string, unknown>> = [{ ...override }];
    const pool = buildRevisionPracticePool(editedPages, stored, 5);
    expect(pool).toHaveLength(1);
    expect(pool[0].question).toBe("Teacher mutation revision?");
  });

  it("keeps standalone override when source block deleted", () => {
    const override = upsertRevisionPracticeOverride([], {
      linkageKey: mutationBlockId,
      question: "Standalone teacher mutation Q?",
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
    })[0];

    const stored: Array<Record<string, unknown>> = [{ ...override }];
    const pool = buildRevisionPracticePool([], stored, 5);
    expect(pool).toHaveLength(1);
    expect(pool[0].question).toBe("Standalone teacher mutation Q?");
  });

  it("keeps orphan override visible when five other checkpoint sources remain", () => {
    const makeBlock = (id: string, prompt: string, correctAnswer: string) => ({
      id,
      type: "selfCheck",
      prompt,
      options: ["Alpha", "Beta", "Gamma", "Delta"],
      correctAnswer,
    });

    const fullPages = [
      {
        pageId: "p1",
        blocks: [
          makeBlock("blk_a", "Why can some mutations be inherited by offspring?", "Alpha"),
          makeBlock("blk_b", "Which statement correctly describes a mutation?", "Beta"),
          makeBlock("blk_c", "What is a gene mutation?", "Gamma"),
          makeBlock("blk_d", "How can a mutation affect a protein?", "Delta"),
          makeBlock("blk_e", "Why might a mutation have no effect?", "Alpha"),
          makeBlock("blk_f", "Which change counts as a mutation?", "Beta"),
        ],
      },
    ];

    const pagesWithoutDeletedSource = [
      {
        pageId: "p1",
        blocks: fullPages[0].blocks.filter((b) => b.id !== "blk_b"),
      },
    ];

    const override = upsertRevisionPracticeOverride([], {
      linkageKey: "blk_b",
      question: "Which statement best explains what a mutation is?",
      options: ["Alpha", "Beta", "Gamma", "Delta"],
      correctAnswer: "Beta",
    })[0];

    const stored: Array<Record<string, unknown>> = [{ ...override }];
    const poolWithSource = buildRevisionPracticePool(fullPages, stored, 5);
    expect(poolWithSource.some((q) => q.sourceQuestionId === "blk_b")).toBe(true);

    const pool = buildRevisionPracticePool(pagesWithoutDeletedSource, stored, 5);
    expect(pool.length).toBeLessThanOrEqual(5);
    expect(pool.length).toBeGreaterThanOrEqual(4);
    expect(pool.filter((q) => q.sourceType === "revisionPracticeOverride")).toHaveLength(1);
    const orphan = pool.find((q) => q.sourceQuestionId === "blk_b");
    expect(orphan).toBeTruthy();
    expect(orphan!.question).toBe("Which statement best explains what a mutation is?");
    expect(
      pool.filter((q) => q.sourceType === "revisionPracticeOverride" && q.sourceQuestionId === "blk_b")
    ).toHaveLength(1);
  });

  it("excludes page-quiz tagged questions", () => {
    const pageQuiz = {
      id: "pq1",
      type: "mcq",
      question: "Page quiz Q?",
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
      pageId: "practise",
      tags: ["page-quiz"],
    };
    const pool = buildRevisionPracticePool(pagesWithMutation, [pageQuiz], 5);
    expect(pool.every((q) => q.question !== "Page quiz Q?")).toBe(true);
  });

  it("carries block id through checkpoint collection", () => {
    const sources = collectCheckpointMcqsFromPages(pagesWithMutation);
    expect(sources[0].sourceBlockId).toBe(mutationBlockId);
    expect(sourceLinkageKeyFromCheckpoint(sources[0])).toBe(mutationBlockId);
  });

  it("remove override allows generated variant to return", () => {
    const override = upsertRevisionPracticeOverride([], {
      linkageKey: mutationBlockId,
      question: "Temporary override?",
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
    });
    const without = removeRevisionPracticeOverride(override, { linkageKey: mutationBlockId });
    const pool = buildRevisionPracticePool(
      pagesWithMutation,
      without as Array<Record<string, unknown>>,
      5
    );
    expect(pool).toHaveLength(1);
    expect(pool[0].question).not.toBe("Temporary override?");
    expect(pool[0].questionSource).toBe("variant-generated");
  });
});
