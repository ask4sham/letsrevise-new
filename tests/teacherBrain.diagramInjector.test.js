/**
 * Teacher Brain Phase 3 — diagram & activity brief injection (Metabolism).
 */

const { runTeacherBrain } = require("../lib/teacherBrain");
const {
  injectDiagramAndActivityBriefs,
  BRIEF_MARKER,
  formatDiagramBrief,
  formatDragDropBrief,
  formatTextMatchBrief,
  formatTextToImageBrief,
  formatImageDropZonesBrief,
  formatStepByStepBrief,
  resolveDragDropActivityLayout,
} = require("../lib/teacherBrain/diagramBriefInjector");

function sampleMetabolismPages() {
  return [
    {
      title: "Page 1",
      blocks: [
        { type: "text", role: "concept", content: "<p>Metabolism teaching</p>" },
        {
          type: "interactiveDiagram",
          title: "Interactive Diagram",
          intro: "Label the diagram.",
          hotspots: [],
        },
        {
          type: "dragDropMatch",
          title: "Drag and Drop Match",
          instructions: "Match each label.",
          pairs: [],
        },
        {
          type: "interactiveSequence",
          title: "Step-by-Step Process",
          intro: "Follow the process.",
          sequenceSteps: [],
        },
      ],
    },
  ];
}

describe("Teacher Brain diagram brief injector (Phase 3)", () => {
  const brain = runTeacherBrain({
    topic: "Metabolism",
    subject: "Biology",
    examBoard: "AQA",
    tier: "Higher",
  });

  test("Metabolism brain supplies diagrams and activities", () => {
    expect(brain.requiredDiagrams.length).toBeGreaterThanOrEqual(3);
    expect(brain.activityRecommendations.length).toBeGreaterThanOrEqual(5);
  });

  test("injects briefs into diagram-related blocks without changing block types", () => {
    const before = sampleMetabolismPages();
    const { pages, injections } = injectDiagramAndActivityBriefs(before, brain);

    expect(injections.length).toBe(3);
    const types = pages[0].blocks.map((b) => b.type);
    expect(types).toEqual(["text", "interactiveDiagram", "dragDropMatch", "interactiveSequence"]);

    const interactive = pages[0].blocks[1];
    expect(interactive.note).toMatch(BRIEF_MARKER);
    expect(interactive.note).toMatch(/DIAGRAM BRIEF/i);
    expect(interactive.note).toMatch(/Cell's Economy|Glucose/i);
    expect(interactive.note).toMatch(/Must Show:/i);
    expect(interactive.note).toMatch(/Hotspots:/i);
    expect(interactive.note).toMatch(/Do NOT use a placeholder/i);

    const dragDrop = pages[0].blocks[2];
    expect(dragDrop.note).toMatch(/DRAG & DROP BRIEF/i);
    expect(dragDrop.note).toMatch(/Cards:/i);
    expect(dragDrop.note).toMatch(/Correct matches:/i);
    expect(dragDrop.note).not.toMatch(/Activity Type:/i);

    const sequence = pages[0].blocks[3];
    expect(sequence.note).toMatch(/STEP-BY-STEP BRIEF/i);
    expect(sequence.note).toMatch(/Sequence:/i);
    expect(sequence.note).toMatch(/Student Questions:/i);
    expect(sequence.note).toMatch(/ATP/i);
  });

  test("regenerate does not duplicate brief marker on second pass", () => {
    const once = injectDiagramAndActivityBriefs(sampleMetabolismPages(), brain);
    const twice = injectDiagramAndActivityBriefs(once.pages, brain);
    const note = twice.pages[0].blocks[1].note || "";
    expect(note.split(BRIEF_MARKER).length - 1).toBe(1);
    expect(twice.injections.length).toBeGreaterThan(0);
    expect(twice.injections.some((row) => row.regenerated)).toBe(true);
  });

  test("empty brain leaves pages unchanged", () => {
    const pages = sampleMetabolismPages();
    const result = injectDiagramAndActivityBriefs(pages, {
      requiredDiagrams: [],
      activityRecommendations: [],
    });
    expect(result.pages).toEqual(pages);
    expect(result.injections).toEqual([]);
  });

  test("sample before/after — Interactive Diagram", () => {
    const before = {
      type: "interactiveDiagram",
      title: "Interactive Diagram",
      intro: "Label the diagram.",
    };
    const diagram = brain.requiredDiagrams.find((d) => /economy/i.test(d.title));
    const after = injectDiagramAndActivityBriefs(
      [{ blocks: [before] }],
      brain
    ).pages[0].blocks[0];

    // eslint-disable-next-line no-console
    console.log("\n--- BEFORE: Interactive Diagram ---\n", JSON.stringify(before, null, 2));
    // eslint-disable-next-line no-console
    console.log("\n--- AFTER: Interactive Diagram (note field) ---\n", after.note);
    expect(after.note).toContain(diagram?.title || "Economy");
  });

  test("sample before/after — Drag & Drop Match", () => {
    const before = {
      type: "dragDropMatch",
      title: "Drag and Drop Match",
      instructions: "Match each label.",
    };
    const after = injectDiagramAndActivityBriefs(
      [{ blocks: [before] }],
      brain
    ).pages[0].blocks[0];

    // eslint-disable-next-line no-console
    console.log("\n--- BEFORE: Drag & Drop ---\n", JSON.stringify(before, null, 2));
    // eslint-disable-next-line no-console
    console.log("\n--- AFTER: Drag & Drop (note field) ---\n", after.note);
    expect(after.note).toMatch(/DRAG & DROP BRIEF/);
  });

  test("sample before/after — Step-by-Step Process", () => {
    const before = {
      type: "interactiveSequence",
      title: "Step-by-Step Process",
      intro: "Follow the process.",
    };
    const after = injectDiagramAndActivityBriefs(
      [{ blocks: [before] }],
      brain
    ).pages[0].blocks[0];

    // eslint-disable-next-line no-console
    console.log("\n--- BEFORE: Step-by-Step ---\n", JSON.stringify(before, null, 2));
    // eslint-disable-next-line no-console
    console.log("\n--- AFTER: Step-by-Step (note field) ---\n", after.note);
    expect(after.note).toMatch(/STEP-BY-STEP BRIEF/);
    expect(after.note).toMatch(/glucose|respiration|atp/i);
  });

  test("format helpers produce teacher-facing text only", () => {
    const d = brain.requiredDiagrams[0];
    expect(formatDiagramBrief(d)).not.toMatch(/\.svg|image unavailable/i);
    expect(formatDiagramBrief(d)).toMatch(/Do NOT use a placeholder image/i);
    expect(formatDragDropBrief(brain.activityRecommendations[3], d)).toMatch(/DRAG & DROP/);
    expect(formatStepByStepBrief(brain.requiredDiagrams[1])).toMatch(/STEP-BY-STEP/);
  });

  test("layout resolver — text match, text-to-image, image drop zones", () => {
    expect(resolveDragDropActivityLayout({ matchMode: "text" })).toBe("textMatch");
    expect(resolveDragDropActivityLayout({ dragDropLayout: "standard" })).toBe("textMatch");
    expect(resolveDragDropActivityLayout({ matchMode: "textToImage" })).toBe("textToImage");
    expect(resolveDragDropActivityLayout({ dragDropLayout: "text-to-image" })).toBe("textToImage");
    expect(
      resolveDragDropActivityLayout({
        pairs: [{ prompt: "A", answer: "1", imageUrl: "https://cdn.example/a.png" }],
      })
    ).toBe("textToImage");
    expect(
      resolveDragDropActivityLayout({
        matchMode: "diagram",
        imageUrl: "https://cdn.example/diagram.png",
        dropZones: [{ id: "z1", correctPairId: "p1" }],
      })
    ).toBe("imageDropZones");
  });

  test("dragDrop text-match block receives DRAG & DROP brief with cards and matches", () => {
    const block = {
      type: "dragDropMatch",
      matchMode: "text",
      pairs: [
        { id: "p1", prompt: "Catabolism", answer: "Breaks down molecules" },
        { id: "p2", prompt: "Anabolism", answer: "Builds larger molecules" },
      ],
    };
    const { pages, injections } = injectDiagramAndActivityBriefs([{ blocks: [block] }], brain);
    expect(injections[0].briefKind).toBe("dragDrop");
    expect(injections[0].activityLayout).toBe("textMatch");
    expect(pages[0].blocks[0].note).toMatch(/DRAG & DROP BRIEF/);
    expect(pages[0].blocks[0].note).toMatch(/Catabolism/);
    expect(pages[0].blocks[0].note).toMatch(/Correct matches:/);
    expect(pages[0].blocks[0].pairs).toEqual(block.pairs);
  });

  test("dragDrop text-to-image block receives TEXT → IMAGE brief", () => {
    const block = {
      type: "dragDropMatch",
      matchMode: "textToImage",
      title: "Catabolism vs Anabolism Compare",
      pairs: [
        { id: "p1", prompt: "Catabolism", answer: "Breaks down" },
        { id: "p2", prompt: "Anabolism", answer: "Builds up" },
      ],
    };
    const { pages, injections } = injectDiagramAndActivityBriefs([{ blocks: [block] }], brain);
    expect(injections[0].briefKind).toBe("textToImage");
    expect(pages[0].blocks[0].note).toMatch(/TEXT → IMAGE DESIGN BRIEF/);
    expect(pages[0].blocks[0].note).toMatch(/Image Title:/);
    expect(pages[0].blocks[0].note).toMatch(/Required Labels:/);
    expect(pages[0].blocks[0].note).toMatch(/Hotspots:/);
    expect(pages[0].blocks[0].note).not.toMatch(/DRAG & DROP BRIEF/);
  });

  test("dragDrop diagram layout receives IMAGE + DROP ZONES brief", () => {
    const block = {
      type: "dragDropMatch",
      matchMode: "diagram",
      imageUrl: "https://cdn.example/metabolism.png",
      dropZones: [
        { id: "z1", x: 10, y: 20, correctPairId: "p1" },
        { id: "z2", x: 50, y: 60, correctPairId: "p2" },
      ],
      pairs: [
        { id: "p1", prompt: "ATP", answer: "Energy currency" },
        { id: "p2", prompt: "Catabolism", answer: "Breaks down" },
      ],
    };
    const { pages, injections } = injectDiagramAndActivityBriefs([{ blocks: [block] }], brain);
    expect(injections[0].briefKind).toBe("imageDropZones");
    expect(pages[0].blocks[0].note).toMatch(/IMAGE \+ DROP ZONES DESIGN BRIEF/);
    expect(pages[0].blocks[0].note).toMatch(/Drop Zone Locations:/);
    expect(pages[0].blocks[0].note).toMatch(/Distractors:/);
    expect(pages[0].blocks[0].imageUrl).toBe(block.imageUrl);
    expect(pages[0].blocks[0].dropZones).toEqual(block.dropZones);
  });

  test("injection only adds note — block payload unchanged for student render", () => {
    const block = {
      type: "dragDropMatch",
      instructions: "Place labels.",
      pairs: [{ id: "p1", prompt: "Glucose", answer: "Fuel" }],
      imageUrl: "",
    };
    const before = JSON.parse(JSON.stringify(block));
    const { pages } = injectDiagramAndActivityBriefs([{ blocks: [block] }], brain);
    const after = pages[0].blocks[0];
    expect(after.instructions).toBe(before.instructions);
    expect(after.pairs).toEqual(before.pairs);
    expect(after.imageUrl).toBe(before.imageUrl);
    expect(after.note).toMatch(BRIEF_MARKER);
  });

  test("re-inject replaces existing Teacher Brain brief when layout changes", () => {
    const block = {
      type: "dragDropMatch",
      matchMode: "textToImage",
      dragDropLayout: "textToImage",
      note: `${BRIEF_MARKER}\n\nDRAG & DROP BRIEF\n\nPurpose:\nOld`,
    };
    const once = injectDiagramAndActivityBriefs([{ blocks: [block] }], brain);
    expect(once.pages[0].blocks[0].note).toMatch(/TEXT → IMAGE DESIGN BRIEF/);
    expect(once.pages[0].blocks[0].note).not.toMatch(/DRAG & DROP BRIEF/);
  });

  test("formatTextToImageBrief and formatImageDropZonesBrief are layout-specific", () => {
    const compare = brain.requiredDiagrams.find((d) => /compare/i.test(d.title));
    const economy = brain.requiredDiagrams.find((d) => /economy/i.test(d.title));
    expect(formatTextToImageBrief(null, compare, { title: "Compare panel" })).toMatch(
      /TEXT → IMAGE/
    );
    expect(formatImageDropZonesBrief(null, economy, {})).toMatch(/IMAGE \+ DROP ZONES/);
    expect(formatTextMatchBrief(null, economy, {})).toMatch(/DRAG & DROP BRIEF/);
  });
});
