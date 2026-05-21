import {
  buildHotspotsFromGeneratorScript,
  buildSequenceStepsFromGeneratorScript,
  hydrateInteractiveSequenceStepsForEditor,
  nextHotspotFromGeneratorScript,
  nextSequenceStepFromGeneratorScript,
} from "./parseGeneratorVisualScript";

describe("parseGeneratorVisualScript", () => {
  it("parses labels and answer key into hotspots", () => {
    const intro = `
Instruction:
Label the diagram.

Labels to use:
- Starch grain (chloroplast)
- Cellulose cell wall

Answer key:
- A → Starch grain (chloroplast)
- B → Cellulose cell wall
`;
    const hotspots = buildHotspotsFromGeneratorScript(intro, "");
    expect(hotspots).toHaveLength(2);
    expect(hotspots[0].label).toBe("Starch grain (chloroplast)");
    expect(hotspots[1].label).toBe("Cellulose cell wall");
  });

  it("returns next unused hotspot for add-hotspot flow", () => {
    const intro = `
Labels to use:
- Alpha
- Beta
`;
    const first = nextHotspotFromGeneratorScript(intro, "", []);
    expect(first?.label).toBe("Alpha");
    const second = nextHotspotFromGeneratorScript(intro, "", [{ label: "Alpha" }]);
    expect(second?.label).toBe("Beta");
    const none = nextHotspotFromGeneratorScript(intro, "", [
      { label: "Alpha" },
      { label: "Beta" },
    ]);
    expect(none).toBeNull();
  });

  it("parses HTML step list from generator export", () => {
    const content = `<ul>
<li><strong>Step 1</strong> — Light hits chloroplast</li>
<li><strong>Step 2</strong> — Water splits</li>
</ul>`;
    const steps = buildSequenceStepsFromGeneratorScript("", content);
    expect(steps).toHaveLength(2);
    expect(steps[0].description).toContain("Light hits chloroplast");
    expect(steps[1].title).toBe("Step 2");
  });

  it("hydrates empty sequenceSteps from intro HTML", () => {
    const intro = `<ul>
<li><strong>Step 1</strong> — First action</li>
<li><strong>Step 2</strong> — Second action</li>
</ul>`;
    const steps = hydrateInteractiveSequenceStepsForEditor(intro, "", []);
    expect(steps).toHaveLength(2);
    expect(steps[0].description).toContain("First action");
  });

  it("parses plain Step N — lines (starch test style)", () => {
    const intro = `Step 1 — Boil leaf in hot water to soften tissues
Step 2 — Heat leaf in ethanol to remove chlorophyll
Step 3 — Rinse leaf in water
Step 4 — Add iodine solution to test for starch`;
    const steps = buildSequenceStepsFromGeneratorScript(intro, "");
    expect(steps).toHaveLength(4);
    expect(steps[0].description).toContain("Boil leaf");
    expect(steps[3].description).toContain("iodine");
  });

  it("returns next sequence step for add-step flow", () => {
    const content = `Step 1: First
Step 2: Second`;
    const first = nextSequenceStepFromGeneratorScript("", content, []);
    expect(first?.description).toBe("First");
    const second = nextSequenceStepFromGeneratorScript("", content, [
      { title: "Step 1", description: "First" },
    ]);
    expect(second?.description).toBe("Second");
  });
});
