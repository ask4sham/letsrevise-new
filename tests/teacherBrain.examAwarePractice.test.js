const {
  collectEmbeddedExamQuestionIds,
  buildExamQuestionFingerprint,
  buildExamQuestionFingerprints,
  overlapsExamFingerprint,
  filterDistinctPracticeExamQuestions,
  rejectDuplicatePracticeItems,
  formatExamExclusionDirectiveForPrompt,
  jaccardSimilarity,
} = require("../lib/teacherBrain/examAwarePractice");

describe("examAwarePractice", () => {
  const reproductiveExam = {
    _id: "eq1",
    question: "Label which letter shows where fertilisation occurs?",
    imageUrl: "/visuals/repro.png",
    topic: "Human reproductive systems",
    markScheme: ["Fertilisation occurs in the oviduct (B)."],
  };

  const oestrogenComposite = {
    _id: "eq2",
    type: "composite",
    sharedStem: "The diagram shows hormone levels during the menstrual cycle.",
    imageUrl: "/visuals/cycle.png",
    parts: [
      {
        type: "mcq",
        questionText: "Which hormone repairs the uterus lining?",
        markScheme: ["Oestrogen"],
      },
      {
        type: "short",
        questionText: "Give the function of progesterone.",
        markScheme: ["Maintains the uterus lining"],
      },
    ],
  };

  it("collects embedded exam question ids from lesson pages", () => {
    const ids = collectEmbeddedExamQuestionIds([
      {
        blocks: [
          { type: "text", content: "Intro" },
          { type: "examQuestion", examQuestionId: "abc123" },
        ],
      },
    ]);
    expect([...ids]).toEqual(["abc123"]);
  });

  it("builds fingerprints for single and composite exam questions", () => {
    const fp1 = buildExamQuestionFingerprint(reproductiveExam);
    expect(fp1.hasDiagram).toBe(true);
    expect(fp1.commandWords).toContain("label");

    const fps = buildExamQuestionFingerprints([oestrogenComposite]);
    expect(fps[0].normalizedTexts.some((t) => t.includes("progesterone"))).toBe(true);
    expect(fps[0].commandWords).toEqual(expect.arrayContaining(["give"]));
  });

  it("detects overlap between exam question and near-duplicate practice text", () => {
    const fps = buildExamQuestionFingerprints([reproductiveExam]);
    expect(
      overlapsExamFingerprint("Label which letter shows where fertilisation occurs?", fps)
    ).toBe(true);
    expect(
      overlapsExamFingerprint(
        "Explain why fertilisation normally occurs in the oviduct rather than the uterus.",
        fps
      )
    ).toBe(false);
  });

  it("filters attached/bank candidates that duplicate embedded exam questions", () => {
    const embeddedIds = new Set(["eq1"]);
    const fps = buildExamQuestionFingerprints([reproductiveExam]);
    const candidates = [
      { _id: "eq1", question: reproductiveExam.question },
      { _id: "eq3", question: reproductiveExam.question },
      {
        _id: "eq4",
        question: "Predict what would happen if fertilisation occurred in the uterus instead.",
      },
    ];
    const filtered = filterDistinctPracticeExamQuestions(candidates, {
      embeddedIds,
      fingerprints: fps,
    });
    expect(filtered.map((q) => String(q._id))).toEqual(["eq4"]);
  });

  it("attached mode: keeps semantically similar question when ID differs from embedded", () => {
    const embeddedComposite = {
      _id: "6a932e2683dae0a7b4ea0bb5",
      type: "composite",
      question: "Mutations can have various effects on organisms.",
      parts: [
        {
          type: "short",
          questionText:
            "Explain how a mutation in DNA can lead to a change in an organism's phenotype.",
          markScheme: ["Mutation can change the base sequence of DNA."],
        },
      ],
    };
    const embeddedIds = new Set([embeddedComposite._id]);
    const fps = buildExamQuestionFingerprints([embeddedComposite]);
    const attachedPhenotype = {
      _id: "6a93f9bd83dae0a7b4eace99",
      question: "Explain how a mutation in DNA can result in a change in phenotype.",
    };
    const filtered = filterDistinctPracticeExamQuestions([attachedPhenotype], {
      embeddedIds,
      fingerprints: fps,
      semanticFingerprintDedup: false,
    });
    expect(filtered.map((q) => String(q._id))).toEqual(["6a93f9bd83dae0a7b4eace99"]);
  });

  it("attached mode: still excludes exact embedded question ID duplicate", () => {
    const embeddedIds = new Set(["eq1"]);
    const fps = buildExamQuestionFingerprints([reproductiveExam]);
    const filtered = filterDistinctPracticeExamQuestions(
      [{ _id: "eq1", question: reproductiveExam.question }],
      { embeddedIds, fingerprints: fps, semanticFingerprintDedup: false }
    );
    expect(filtered).toHaveLength(0);
  });

  it("fallback mode: still excludes semantically similar non-attached candidates", () => {
    const embeddedIds = new Set();
    const fps = buildExamQuestionFingerprints([reproductiveExam]);
    const filtered = filterDistinctPracticeExamQuestions(
      [{ _id: "bank1", question: reproductiveExam.question }],
      { embeddedIds, fingerprints: fps, semanticFingerprintDedup: true }
    );
    expect(filtered).toHaveLength(0);
  });

  it("attached mode: preserves order and respects limit for 10 valid questions", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `q${i + 1}`);
    const candidates = ids.map((id, i) => ({ _id: id, question: `Attached practice question ${i + 1}` }));
    const filtered = filterDistinctPracticeExamQuestions(candidates, {
      embeddedIds: new Set(),
      fingerprints: [],
      limit: 10,
      semanticFingerprintDedup: false,
    });
    expect(filtered.map((q) => String(q._id))).toEqual(ids);
  });

  it("rejects generated practice items that overlap exam fingerprints", () => {
    const fps = buildExamQuestionFingerprints([
      { _id: "x", question: "Give the function of oestrogen." },
    ]);
    const { accepted, rejected } = rejectDuplicatePracticeItems(
      [
        { question: "What is the function of oestrogen?" },
        {
          question:
            "Predict what would happen to the uterus lining if oestrogen levels remained low throughout the cycle.",
        },
      ],
      fps
    );
    expect(rejected).toHaveLength(1);
    expect(accepted).toHaveLength(1);
  });

  it("returns empty directive when lesson has no embedded exam questions", () => {
    expect(formatExamExclusionDirectiveForPrompt([])).toBe("");
  });

  it("includes alternate cognitive skills in prompt directive", () => {
    const fps = buildExamQuestionFingerprints([reproductiveExam]);
    const directive = formatExamExclusionDirectiveForPrompt(fps);
    expect(directive).toContain("EXAM QUESTION EXCLUSION");
    expect(directive).toMatch(/explain|describe|why/i);
  });

  it("lesson with no exam embeds — filter passes all unrelated candidates", () => {
    const candidates = [{ _id: "a", question: "Describe mitosis." }];
    const filtered = filterDistinctPracticeExamQuestions(candidates, {
      embeddedIds: new Set(),
      fingerprints: [],
    });
    expect(filtered).toHaveLength(1);
  });

  it("jaccardSimilarity flags near-identical stems", () => {
    const a = "which letter shows where fertilisation occurs";
    const b = "which letter shows where fertilisation occurs in the diagram";
    expect(jaccardSimilarity(a, b)).toBeGreaterThan(0.7);
  });
});
