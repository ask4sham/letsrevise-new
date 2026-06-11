/**
 * Phase 3b.3f.6B — diagram count + What-to-Notice structure-gate helpers.
 * @jest-environment node
 */

const {
  ensureMinimumDiagramBlocks,
  ensureTopicSpecificWhatToNoticeBlocks,
  buildTopicAwareWhatToNotice,
  resolveTopicDiagramLabel,
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
