import { cleanDiagramInstructionsForDisplay } from "./cleanDiagramInstructionsForDisplay";
import { diagramInstructionsForDisplayFromBlock } from "./diagramPedagogyDisplay";
import { diagramInstructionsRawFromBlock } from "./cleanDiagramInstructionsForDisplay";

describe("cleanDiagramInstructionsForDisplay", () => {
  it("returns plain text unchanged", () => {
    expect(cleanDiagramInstructionsForDisplay("Label the parts you can see.")).toBe(
      "Label the parts you can see."
    );
  });

  it("strips p, ul, and li tags without showing them", () => {
    const html = "<p>Read the diagram.</p><ul><li>First point</li><li>Second point</li></ul>";
    const out = cleanDiagramInstructionsForDisplay(html);
    expect(out).not.toMatch(/<p>|<ul>|<li>/i);
    expect(out).toContain("Read the diagram.");
    expect(out).toContain("- First point");
    expect(out).toContain("- Second point");
  });

  it("handles tag-only lines without leaving literal tag names", () => {
    const html = "<p>\n<ul>\n<li>";
    const out = cleanDiagramInstructionsForDisplay(html);
    expect(out).not.toMatch(/<p>|<ul>|<li>/i);
    expect(out).toBe("");
  });

  it("strips details blocks without leaving reveal label as plain text", () => {
    const html =
      "<details><summary>Reveal Answer</summary><p>Look at the mitochondria.</p></details>";
    const out = cleanDiagramInstructionsForDisplay(html);
    expect(out).not.toMatch(/<details>|<summary>|Reveal Answer/i);
    expect(out).not.toContain("Look at the mitochondria");
  });

  it("preserves markdown-style bullet lines", () => {
    const md = "Steps:\n- Identify the nucleus\n- Name the membrane";
    const out = cleanDiagramInstructionsForDisplay(md);
    expect(out).toContain("- Identify the nucleus");
    expect(out).toContain("- Name the membrane");
  });

  it("decodes entity-encoded HTML before cleaning", () => {
    const encoded = "&lt;p&gt;Study the cell.&lt;/p&gt;";
    const out = cleanDiagramInstructionsForDisplay(encoded);
    expect(out).not.toMatch(/&lt;|&gt;|<p>/i);
    expect(out).toBe("Study the cell.");
  });

  it("preserves intentional line breaks between paragraphs", () => {
    const html = "<p>Line one</p><p>Line two</p>";
    const out = cleanDiagramInstructionsForDisplay(html);
    expect(out).toContain("Line one");
    expect(out).toContain("Line two");
    expect(out).not.toMatch(/<p>/i);
  });
});

describe("diagramInstructionsForDisplayFromBlock", () => {
  it("reads subtitle then intro then note", () => {
    expect(
      diagramInstructionsForDisplayFromBlock({
        type: "diagram",
        intro: "<p>From intro</p>",
        note: "<p>From note</p>",
      })
    ).toBe("From intro");
  });

  it("falls back to legacy content when long enough", () => {
    const content = `<p>${"x".repeat(40)}</p>`;
    const out = diagramInstructionsForDisplayFromBlock({
      type: "diagram",
      content,
    });
    expect(out).not.toMatch(/<p>/i);
    expect(out?.length).toBeGreaterThan(10);
  });

  it("returns undefined when block has no instructions", () => {
    expect(
      diagramInstructionsForDisplayFromBlock({
        type: "diagram",
        imageUrl: "https://cdn.example/leaf.png",
        caption: "Leaf",
      })
    ).toBeUndefined();
  });

  it("uses the same cleaned output for editor-style and student-style blocks", () => {
    const block = {
      type: "diagram",
      subtitle: "<ul><li>Point A</li><li>Point B</li></ul>",
    };
    const fromDisplay = diagramInstructionsForDisplayFromBlock(block);
    const fromRaw = cleanDiagramInstructionsForDisplay(
      diagramInstructionsRawFromBlock(block) ?? ""
    );
    expect(fromDisplay).toBe(fromRaw);
    expect(fromDisplay).not.toMatch(/<li>/i);
    expect(fromDisplay).toContain("- Point A");
  });
});
