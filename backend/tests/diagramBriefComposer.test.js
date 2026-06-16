/**
 * P3.0B — Diagram Brief Composer tests.
 */
const {
  composeDiagramBrief,
  validateDiagramSpecification,
  REFLEX_ARC_SPEC,
  REACTION_TIME_PRACTICAL_SPEC,
  PHOTOSYNTHESIS_SPEC,
  DIFFUSION_SPEC,
} = require("../services/diagramSpecificationEngine");

const STYLE_MARKERS = [
  "white background",
  "thick black outlines",
  "minimal colour",
  "no gradients",
  "no shadows",
  "flat vector",
  "exam ready",
  "copyright safe",
];

describe("diagramBriefComposer", () => {
  test("reflex arc brief contains required labels, answer key, and hotspots", () => {
    const result = composeDiagramBrief(REFLEX_ARC_SPEC);
    expect(result.ok).toBe(true);
    expect(result.brief.length).toBeGreaterThan(500);
    expect(result.brief).toMatch(/GCSE AQA/i);
    for (const label of [
      "STIMULUS",
      "RECEPTOR",
      "SENSORY NEURONE",
      "RELAY NEURONE",
      "MOTOR NEURONE",
      "EFFECTOR",
      "RESPONSE",
    ]) {
      expect(result.brief).toContain(label);
    }
    expect(result.brief).toMatch(/Answer key/i);
    expect(result.brief).toMatch(/Hotspots \/ parts/i);
    expect(result.metadata?.specId).toBe("reflex-arc");
    expect(result.metadata?.hotspotCount).toBe(8);
  });

  test("reaction time brief contains required practical labels", () => {
    const result = composeDiagramBrief(REACTION_TIME_PRACTICAL_SPEC);
    expect(result.ok).toBe(true);
    for (const label of [
      "RULER",
      "ZERO MARK",
      "CATCHER'S HAND",
      "DROP DISTANCE",
      "REACTION TIME",
    ]) {
      expect(result.brief).toContain(label);
    }
    expect(result.brief).toMatch(/required practical|Ruler Drop|reaction time/i);
    expect(result.brief).toMatch(/Drag-and-drop targets/i);
  });

  test("photosynthesis brief contains all reactant and product labels", () => {
    const result = composeDiagramBrief(PHOTOSYNTHESIS_SPEC);
    expect(result.ok).toBe(true);
    for (const label of [
      "SUNLIGHT",
      "CHLOROPHYLL",
      "CHLOROPLAST",
      "CARBON DIOXIDE",
      "WATER",
      "GLUCOSE",
      "OXYGEN",
    ]) {
      expect(result.brief).toContain(label);
    }
  });

  test("diffusion brief contains concentration and membrane labels", () => {
    const result = composeDiagramBrief(DIFFUSION_SPEC);
    expect(result.ok).toBe(true);
    for (const label of [
      "HIGH CONCENTRATION",
      "LOW CONCENTRATION",
      "PARTIALLY PERMEABLE MEMBRANE",
      "NET MOVEMENT",
    ]) {
      expect(result.brief).toContain(label);
    }
    expect(result.brief).toMatch(/PARTICLES/i);
  });

  test("invalid spec returns ok:false", () => {
    const result = composeDiagramBrief({ schemaVersion: "3.0a" });
    expect(result.ok).toBe(false);
    expect(result.brief).toBe("");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("options can disable frame, answer key, and hotspots", () => {
    const full = composeDiagramBrief(REFLEX_ARC_SPEC);
    const trimmed = composeDiagramBrief(REFLEX_ARC_SPEC, {
      includeFrame: false,
      includeAnswerKey: false,
      includeHotspots: false,
    });
    expect(trimmed.ok).toBe(true);
    expect(trimmed.brief).not.toMatch(/THEN:/i);
    expect(trimmed.brief).not.toMatch(/Answer key/i);
    expect(trimmed.brief).not.toMatch(/Hotspots \/ parts/i);
    expect(trimmed.brief.length).toBeLessThan(full.brief.length);
  });

  test("brief contains style rules", () => {
    const result = composeDiagramBrief(REFLEX_ARC_SPEC);
    expect(result.ok).toBe(true);
    for (const marker of STYLE_MARKERS) {
      expect(result.brief.toLowerCase()).toContain(marker);
    }
  });

  test("brief does not include internal implementation fields", () => {
    const result = composeDiagramBrief(REFLEX_ARC_SPEC);
    expect(result.brief).not.toContain("schemaVersion");
    expect(result.brief).not.toContain("teacherNotes");
    expect(result.brief).not.toMatch(/"id":/);
    expect(result.brief).not.toContain("status");
  });

  test("validated spec round-trips through composer metadata", () => {
    const validation = validateDiagramSpecification(PHOTOSYNTHESIS_SPEC);
    const result = composeDiagramBrief(validation.normalized);
    expect(result.ok).toBe(true);
    expect(result.metadata?.diagramType).toBe("labelled");
    expect(result.metadata?.labelCount).toBe(7);
    expect(result.metadata?.interactionTypes).toContain("hotspot");
  });
});
