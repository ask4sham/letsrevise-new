/**
 * Deterministic Teacher Brain Brief generator — Human Reproductive Systems pilot.
 */

const { generateTeacherBrainBrief } = require("../lib/teacherBrain/briefs");
const { injectDiagramAndActivityBriefs, BRIEF_MARKER } = require("../lib/teacherBrain/diagramBriefInjector");

function sampleReproductivePages() {
  return [
    {
      title: "Human Reproductive Systems",
      blocks: [
        {
          type: "text",
          role: "hook",
          content:
            "<p>The male and female reproductive systems produce gametes for sexual reproduction.</p>",
        },
        {
          type: "keyIdea",
          content:
            "Ovary — releases ova and produces female hormones\nOviduct — carries the egg; site of fertilisation\nUterus — muscular organ where implantation occurs",
        },
        {
          type: "text",
          content:
            "<p>The <strong>cervix</strong> is a ring of muscle at the lower end of the uterus. The <strong>vagina</strong> receives the penis and semen during intercourse.</p>",
        },
        {
          type: "text",
          content:
            "<p>The <strong>testis</strong> produces sperm and testosterone. Sperm travel: testis → epididymis → sperm duct → urethra → penis.</p>",
        },
        {
          type: "commonMistake",
          content:
            "Fertilisation happens in the uterus — actually it usually occurs in the oviduct.",
        },
        {
          type: "dragDropMatch",
          title: "Match structures to functions",
          instructions: "Match each structure to its function.",
          pairs: [
            {
              id: "p1",
              prompt: "Key process or mechanism described in words (not just a label)",
              answer: "Cause linked to a clear effect in this topic",
            },
            {
              id: "p2",
              prompt: "Structure or feature with its function explained",
              answer: "Common misconception corrected in one line",
            },
          ],
        },
      ],
    },
  ];
}

describe("Teacher Brain brief generator (topic-specific V1)", () => {
  test("extracts reproductive structure/function pairs from lesson content", () => {
    const pages = sampleReproductivePages();
    const block = pages[0].blocks[5];
    const brief = generateTeacherBrainBrief({
      lesson: {
        topic: "Human Male & Female Reproductive Systems",
        topicKey: "human-male-and-female-reproductive-systems",
      },
      pages,
      pageIndex: 0,
      blockIndex: 5,
      block,
      activityType: "dragDropMatch",
    });

    expect(brief.suggestedCards.length).toBeGreaterThanOrEqual(4);
    const joined = brief.suggestedCards.map((c) => `${c.prompt} ${c.answer}`).join(" ").toLowerCase();
    expect(joined).toMatch(/ovary/);
    expect(joined).toMatch(/oviduct/);
    expect(joined).toMatch(/uterus/);
    expect(joined).toMatch(/testis/);
    expect(joined).not.toMatch(/key process or mechanism described in words/);
    expect(joined).not.toMatch(/structure or feature with its function explained/);
  });

  test("includes topic-specific misconceptions and student task", () => {
    const pages = sampleReproductivePages();
    const block = pages[0].blocks[5];
    const brief = generateTeacherBrainBrief({
      lesson: { topic: "Human Reproductive Systems" },
      pages,
      pageIndex: 0,
      blockIndex: 5,
      block,
      activityType: "dragDropMatch",
    });

    expect(brief.commonMisconceptions.join(" ").toLowerCase()).toMatch(/fertilisation|uterus|oviduct/);
    expect(brief.studentTask.toLowerCase()).toMatch(/drag/);
    expect(brief.assessmentFocus.join(" ").toLowerCase()).toMatch(/ovary|oviduct|uterus|structure/);
  });

  test("inject replaces generic drag-drop brief with lesson-derived cards", () => {
    const pages = sampleReproductivePages();
    const brain = {
      requiredDiagrams: [],
      activityRecommendations: [{ activityType: "dragDropMatch", rationale: "Match structures" }],
      misconceptions: [],
    };
    const { pages: injected } = injectDiagramAndActivityBriefs(pages, brain, {
      topic: "Human Reproductive Systems",
      topicKey: "human-male-and-female-reproductive-systems",
    });
    const note = injected[0].blocks[5].note || "";
    expect(note).toContain(BRIEF_MARKER);
    expect(note).toMatch(/Suggested cards:/);
    expect(note).toMatch(/Ovary/i);
    expect(note).toMatch(/Oviduct/i);
    expect(note).not.toMatch(/Key process or mechanism described in words/);
    expect(note).not.toMatch(/Metabolism is the same as digestion/);
  });

  test("metabolism drag-drop without lesson pairs still uses brain diagram hotspots", () => {
    const { runTeacherBrain, injectDiagramAndActivityBriefs: inject } = require("../lib/teacherBrain");
    const brain = runTeacherBrain({
      topic: "Metabolism",
      subject: "Biology",
      examBoard: "AQA",
      tier: "Higher",
    });
    const pages = [
      {
        blocks: [
          { type: "text", content: "<p>Metabolism teaching</p>" },
          { type: "dragDropMatch", title: "Drag and Drop Match", pairs: [] },
        ],
      },
    ];
    const { pages: injected } = inject(pages, brain);
    const note = injected[0].blocks[1].note || "";
    expect(note).toMatch(/DRAG & DROP BRIEF/);
    expect(note).toMatch(/Suggested cards:/);
  });
});
