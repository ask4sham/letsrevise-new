/**
 * Phase 3b.3f.6B — diagram count + What-to-Notice structure-gate helpers.
 * @jest-environment node
 */

const {
  ensureMinimumDiagramBlocks,
  ensureDiagramCountBeforeStructureValidation,
  ensureTopicSpecificWhatToNoticeBlocks,
  buildTopicAwareWhatToNotice,
  resolveTopicDiagramLabel,
  sanitizeDraftForTest,
} = require("../routes/ai");
const {
  validateLessonStructure,
  whatToNoticeLooksSpecific,
  mergeStructureValidationForScoring,
  validateBlockTypeRequirements,
} = require("../services/lessonDraftValidation");

const BENCHMARK_TOPICS = [
  {
    label: "Reflex Arc",
    topic: "The reflex arc",
    topicKey: "aqa-gcse-biology:reflex-arc",
    diagramTitle: "Reflex Arc Pathway",
    wtnMatch: /nerve impulse|sensory neurone|effector/i,
  },
  {
    label: "Cell Structure",
    topic: "Cell structure",
    topicKey: "aqa-gcse-biology:cell-structure",
    diagramTitle: "Cell Structure Overview",
    wtnMatch: /nucleus|cell membrane|chloroplast/i,
  },
  {
    label: "Blood Glucose",
    topic: "Control of blood glucose concentration",
    topicKey: "aqa-gcse-biology:control-blood-glucose",
    diagramTitle: "Blood Glucose Control Loop",
    wtnMatch: /insulin|glucagon|negative feedback/i,
  },
  {
    label: "Mitosis",
    topic: "Mitosis and the cell cycle",
    topicKey: "aqa-gcse-biology:mitosis-cell-cycle",
    diagramTitle: "Stages of Mitosis",
    wtnMatch: /chromosome|interphase|mitosis/i,
  },
  {
    label: "Materials Cycled",
    topic: "How materials are cycled",
    topicKey: "aqa-gcse-biology:how-materials-cycled",
    diagramTitle: "Carbon Cycle Overview",
    wtnMatch: /carbon|photosynthesis|decomposition/i,
  },
];

const GENERIC_WTN = [
  "- Focus on the labelled parts or key features",
  "- Notice how each feature links to its job or meaning",
  "- In exams, use these visible features as evidence in your answer",
].join("\n");

function draftWithOneDiagram(topic) {
  return {
    title: topic,
    topic,
    pages: [
      {
        title: "Page 1",
        order: 1,
        blocks: [
          { type: "text", role: "hook", content: "Hook content for the lesson opening block." },
          { type: "keyIdea", role: "coreRule", content: "Core rule about the topic for GCSE exams." },
          { type: "diagram", role: "concept", title: "Original Diagram", content: "original image", caption: "Original caption" },
          {
            type: "keyIdea",
            role: "whatToNotice",
            title: "What to Notice",
            content: GENERIC_WTN,
          },
          { type: "keyIdea", role: "synthesis", content: "Synthesis line pulling ideas together for exams." },
          { type: "keyIdea", role: "finalMemoryRule", content: "Remember the key rule for this topic in exams." },
        ],
      },
    ],
  };
}

function diagramCount(draft) {
  return (draft.pages[0].blocks || []).filter((b) => b.type === "diagram").length;
}

describe("ensureMinimumDiagramBlocks (Phase 3b.3f.6B)", () => {
  test.each(BENCHMARK_TOPICS)("$label — inserts second topic-specific diagram", ({ topic, topicKey, diagramTitle }) => {
    const draft = draftWithOneDiagram(topic);
    const meta = { topicKey, subTopic: topic };

    ensureMinimumDiagramBlocks(draft, topic, meta);

    expect(diagramCount(draft)).toBe(2);
    const diagrams = draft.pages[0].blocks.filter((b) => b.type === "diagram");
    expect(diagrams[0].title).toBe("Original Diagram");
    expect(diagrams.some((d) => d.title === diagramTitle)).toBe(true);
    expect(diagrams.some((d) => d.caption && d.caption !== "image here")).toBe(true);
  });

  test("preserves two existing diagrams without adding a third", () => {
    const draft = draftWithOneDiagram("Cell structure");
    draft.pages[0].blocks.push({
      type: "diagram",
      role: "concept",
      title: "Second existing",
      content: "img2",
      caption: "Second caption",
    });

    ensureMinimumDiagramBlocks(draft, "Cell structure", {
      topicKey: "aqa-gcse-biology:cell-structure",
    });

    expect(diagramCount(draft)).toBe(2);
  });

  test("Required Practical mode — no diagram inserted", () => {
    const draft = draftWithOneDiagram("Required practical: reaction time");
    ensureMinimumDiagramBlocks(draft, "Required practical: reaction time", {
      topicKey: "aqa-gcse-biology:rp-reaction-time",
    });
    expect(diagramCount(draft)).toBe(1);
  });
});

describe("ensureTopicSpecificWhatToNoticeBlocks (Phase 3b.3f.6B)", () => {
  test.each(BENCHMARK_TOPICS)("$label — replaces generic What-to-Notice", ({ topic, topicKey, wtnMatch }) => {
    const draft = draftWithOneDiagram(topic);
    const meta = { topicKey, subTopic: topic };

    ensureTopicSpecificWhatToNoticeBlocks(draft, topic, meta);

    const wtn = draft.pages[0].blocks.find((b) => /what to notice/i.test(String(b.title || "")));
    expect(wtn).toBeTruthy();
    expect(wtn.content).toMatch(wtnMatch);
    expect(wtn.content).not.toMatch(/focus on the labelled parts or key features/i);
    expect(whatToNoticeLooksSpecific(wtn, draft)).toBe(true);
  });

  test("preserves strong topic-specific What-to-Notice block", () => {
    const draft = draftWithOneDiagram("The reflex arc");
    const strongContent = [
      "- Follow the direction of the nerve impulse",
      "- Identify receptor, sensory neurone, relay neurone, motor neurone, effector",
      "- In exams, trace the reflex arc in order",
    ].join("\n");
    draft.pages[0].blocks.find((b) => /what to notice/i.test(b.title)).content = strongContent;

    ensureTopicSpecificWhatToNoticeBlocks(draft, "The reflex arc", {
      topicKey: "aqa-gcse-biology:reflex-arc",
    });

    const wtn = draft.pages[0].blocks.find((b) => /what to notice/i.test(String(b.title || "")));
    expect(wtn.content).toBe(strongContent);
  });

  test("Required Practical mode — generic What-to-Notice left unchanged", () => {
    const draft = draftWithOneDiagram("Required practical: reaction time");
    ensureTopicSpecificWhatToNoticeBlocks(draft, "Required practical: reaction time", {
      topicKey: "aqa-gcse-biology:rp-reaction-time",
    });
    const wtn = draft.pages[0].blocks.find((b) => /what to notice/i.test(String(b.title || "")));
    expect(wtn.content).toMatch(/focus on the labelled parts/i);
  });

  test("buildTopicAwareWhatToNotice returns benchmark-specific bullets", () => {
    const bullets = buildTopicAwareWhatToNotice("How materials are cycled", {
      topicKey: "aqa-gcse-biology:how-materials-cycled",
    });
    expect(bullets.join(" ")).toMatch(/carbon|photosynthesis|decomposition/i);
  });

  test("combined fixes clear diagram and WTN structure failures on sparse draft", () => {
    const draft = draftWithOneDiagram("Cell structure");
    draft.topic = "Cell structure";
    draft.pages[0].blocks.push({
      type: "text",
      role: "concept",
      title: "Real-World Application",
      content:
        "**Real-world application:** Specialised cells are used in medicine — for example, doctors use microscopy to diagnose disease.",
    });

    ensureMinimumDiagramBlocks(draft, "Cell structure", {
      topicKey: "aqa-gcse-biology:cell-structure",
    });
    ensureTopicSpecificWhatToNoticeBlocks(draft, "Cell structure", {
      topicKey: "aqa-gcse-biology:cell-structure",
    });

    const issues = [
      ...mergeStructureValidationForScoring(validateLessonStructure(draft, { isManual: false })),
      ...validateBlockTypeRequirements(draft),
    ];
    expect(issues).not.toContain("Not enough diagrams");
    expect(issues).not.toContain(
      "What to Notice blocks are too generic and not tied to the actual topic."
    );
  });
});

describe("resolveTopicDiagramLabel", () => {
  test("returns benchmark diagram title", () => {
    expect(
      resolveTopicDiagramLabel("Mitosis and the cell cycle", {
        topicKey: "aqa-gcse-biology:mitosis-cell-cycle",
      }).title
    ).toBe("Stages of Mitosis");
  });
});

describe("diagram ensure after Teacher-First (Phase 3b.3f.8D)", () => {
  const { enforceDashboardTeacherFirstOpening } = require("../../lib/teacherBrain/dashboardTeacherFirstOpening");
  const prevFlag = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;

  beforeAll(() => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
  });

  afterAll(() => {
    if (prevFlag === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevFlag;
  });

  function sparseLessonDraft(topic, topicKey) {
    return {
      title: topic,
      topic,
      pages: [
        {
          title: "Page 1",
          order: 1,
          blocks: [
            { type: "text", role: "hook", content: `Hook about ${topic}.` },
            { type: "text", role: "lessonObjectives", content: "Objectives list." },
            { type: "text", role: "priorKnowledge", content: "Prior knowledge recap." },
            { type: "text", role: "definition", content: `${topic} GCSE definition.` },
            { type: "text", role: "whyItMatters", content: `Why ${topic} matters.` },
            { type: "keyIdea", role: "coreRule", content: "Core model content." },
            { type: "text", role: "keyExamples", content: "Example one." },
            { type: "text", role: "examVocabulary", content: "Key terms." },
            { type: "text", role: "hook", content: "Scenario block." },
            { type: "text", role: "concept", content: "Core teaching." },
            { type: "commonMistake", role: "commonMistake", content: "Wrong: x\nCorrect: y" },
            { type: "keyIdea", role: "patternRecognition", content: "Pattern recognition." },
            { type: "diagram", role: "concept", title: "Only diagram", content: "d1", caption: "d1" },
            {
              type: "keyIdea",
              role: "whatToNotice",
              title: "What to Notice",
              content: "- Focus on the labelled parts or key features",
            },
            { type: "keyIdea", role: "synthesis", content: "Synthesis line." },
            { type: "keyIdea", role: "finalMemoryRule", content: `Remember ${topic}.` },
            {
              type: "checkpoint",
              role: "workedExample",
              prompt: "Explain. (4 marks)",
              questionType: "short",
              options: [],
              correctAnswer: "Point one.",
              explanation: "- Point one.\n- Point two.\n- Point three.",
            },
          ],
        },
      ],
    };
  }

  test.each(BENCHMARK_TOPICS)(
    "$label — post-Teacher-First ensure restores diagram count to ≥2",
    ({ topic, topicKey }) => {
      const draft = sparseLessonDraft(topic, topicKey);
      const ctx = { topic, topicKey, subTopic: topic, subject: "Biology" };

      enforceDashboardTeacherFirstOpening(draft, ctx);
      expect(diagramCount(draft)).toBeLessThan(2);

      ensureMinimumDiagramBlocks(draft, topic, ctx);
      ensureTopicSpecificWhatToNoticeBlocks(draft, topic, ctx);

      expect(diagramCount(draft)).toBeGreaterThanOrEqual(2);
      const issues = mergeStructureValidationForScoring(validateLessonStructure(draft, { isManual: false }));
      expect(issues).not.toContain("Not enough diagrams");

      const wtn = draft.pages[0].blocks.find((b) => /what to notice/i.test(String(b.title || "")));
      expect(wtn).toBeTruthy();
      expect(whatToNoticeLooksSpecific(wtn, draft)).toBe(true);
    }
  );

  test("pre-Teacher-First diagram ensure is not sufficient when reshuffle leaves <2", () => {
    const topic = "Cell structure";
    const ctx = {
      topic,
      topicKey: "aqa-gcse-biology:cell-structure",
      subTopic: topic,
      subject: "Biology",
    };
    const draft = sparseLessonDraft(topic, ctx.topicKey);

    ensureMinimumDiagramBlocks(draft, topic, ctx);
    expect(diagramCount(draft)).toBe(2);

    enforceDashboardTeacherFirstOpening(draft, ctx);
    const afterOpeningOnly = diagramCount(draft);

    ensureMinimumDiagramBlocks(draft, topic, ctx);
    expect(diagramCount(draft)).toBeGreaterThanOrEqual(2);
    if (afterOpeningOnly < 2) {
      expect(diagramCount(draft)).toBeGreaterThan(afterOpeningOnly);
    }
  });

  test("ensureDiagramCountBeforeStructureValidation clears diagram failure on pre-validation draft", () => {
    const topic = "Mitosis and the cell cycle";
    const ctx = {
      topic,
      topicKey: "aqa-gcse-biology:mitosis-cell-cycle",
      subTopic: topic,
    };
    const draft = sparseLessonDraft(topic, ctx.topicKey);

    enforceDashboardTeacherFirstOpening(draft, { ...ctx, subject: "Biology" });
    expect(diagramCount(draft)).toBeLessThan(2);

    ensureDiagramCountBeforeStructureValidation(draft, topic, ctx);

    const issues = mergeStructureValidationForScoring(validateLessonStructure(draft, { isManual: false }));
    expect(issues).not.toContain("Not enough diagrams");
    expect(diagramCount(draft)).toBeGreaterThanOrEqual(2);
  });

  test("preserves two existing diagrams without adding a third after Teacher-First", () => {
    const topic = "The reflex arc";
    const ctx = {
      topic,
      topicKey: "aqa-gcse-biology:reflex-arc",
      subTopic: topic,
      subject: "Biology",
    };
    const draft = sparseLessonDraft(topic, ctx.topicKey);
    draft.pages[0].blocks.splice(14, 0, {
      type: "diagram",
      role: "concept",
      title: "Second existing",
      content: "d2",
      caption: "Second caption",
    });

    enforceDashboardTeacherFirstOpening(draft, ctx);
    const originals = draft.pages[0].blocks.filter(
      (b) => b.type === "diagram" && (b.title === "Only diagram" || b.title === "Second existing")
    );

    ensureMinimumDiagramBlocks(draft, topic, ctx);

    expect(diagramCount(draft)).toBe(2);
    expect(draft.pages[0].blocks.filter((b) => b === originals[0]).length).toBe(1);
    expect(draft.pages[0].blocks.filter((b) => b === originals[1]).length).toBe(1);
  });

  test("Required Practical — post-Teacher-First diagram ensure skipped", () => {
    const topic = "Required practical: reaction time";
    const ctx = {
      topic,
      topicKey: "aqa-gcse-biology:rp-reaction-time",
      subTopic: topic,
      subject: "Biology",
    };
    const draft = sparseLessonDraft(topic, ctx.topicKey);

    enforceDashboardTeacherFirstOpening(draft, ctx);
    const before = diagramCount(draft);

    ensureMinimumDiagramBlocks(draft, topic, ctx);
    ensureDiagramCountBeforeStructureValidation(draft, topic, ctx);

    expect(diagramCount(draft)).toBe(before);
  });
});
