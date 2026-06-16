/**
 * P3.0B/D — Diagram Brief Composer tests.
 */
const {
  composeDiagramBrief,
  validateDiagramSpecification,
  REFLEX_ARC_SPEC,
  REACTION_TIME_PRACTICAL_SPEC,
  PHOTOSYNTHESIS_SPEC,
  DIFFUSION_SPEC,
  BRAIN_REGIONS_STRUCTURE_FUNCTION_SPEC,
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
  test("reflex arc labelled brief contains required labels", () => {
    const result = composeDiagramBrief(REFLEX_ARC_SPEC);
    expect(result.ok).toBe(true);
    expect(result.metadata?.pedagogyDriven).toBe(false);
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
    expect(result.brief).toMatch(/Labels to use/i);
  });

  test("brain regions structure-to-function brief uses Image Elements not Labels to use", () => {
    const result = composeDiagramBrief(BRAIN_REGIONS_STRUCTURE_FUNCTION_SPEC);
    expect(result.ok).toBe(true);
    expect(result.metadata?.pedagogyDriven).toBe(true);
    expect(result.metadata?.regionIdAbstracted).toBe(true);
    expect(result.metadata?.activityPedagogyType).toBe("structure-to-function");
    expect(result.brief).toMatch(/Image Elements/i);
    expect(result.brief).not.toMatch(/Labels to use/i);
    expect(result.brief).not.toMatch(/Concept Cards/i);
    expect(result.brief).not.toMatch(/Exam focus/i);
    expect(result.brief).toMatch(/Region 1 highlighted/i);
    expect(result.brief).toMatch(/Numbered hotspot 1 on Region 1/i);
    for (const name of ["hypothalamus", "pituitary", "medulla", "cerebellum", "HYPOTHALAMUS"]) {
      expect(result.brief.toLowerCase()).not.toContain(name.toLowerCase());
    }
    expect(result.brief).toMatch(/HOTSPOT MAPPING RULE/i);
    expect(result.brief).toMatch(/Function → Recall Structure/i);
    expect(result.brief).toMatch(/MUST NOT appear on the image/i);
  });

  test("brain regions teacher metadata holds biological mappings outside image brief", () => {
    const result = composeDiagramBrief(BRAIN_REGIONS_STRUCTURE_FUNCTION_SPEC);
    expect(result.teacherMetadata).toBeTruthy();
    expect(result.teacherMetadata).toMatch(/TEACHER METADATA \(NOT FOR IMAGE\)/i);
    expect(result.teacherMetadata).toMatch(/Region 1 = Hypothalamus/i);
    expect(result.teacherMetadata).toMatch(/Region 2 = Pituitary Gland/i);
    expect(result.teacherMetadata).toContain("Thermoregulation control centre");
    expect(result.teacherMetadata).toContain("Coordinates balance and movement");
    expect(result.brief).not.toContain("Thermoregulation control centre");
  });

  test("brain regions concept cards appear only in teacher metadata", () => {
    const result = composeDiagramBrief(BRAIN_REGIONS_STRUCTURE_FUNCTION_SPEC);
    const cardsSection =
      result.teacherMetadata?.split("Concept Cards")[1]?.split("Answer key")[0] || "";
    expect(cardsSection).toContain("Thermoregulation control centre");
    expect(cardsSection).toContain("Coordinates balance and movement");
  });

  test("reaction time pedagogy brief uses label-to-structure pattern", () => {
    const result = composeDiagramBrief(REACTION_TIME_PRACTICAL_SPEC);
    expect(result.ok).toBe(true);
    expect(result.metadata?.activityPedagogyType).toBe("label-to-structure");
    expect(result.brief).toMatch(/Image Elements/i);
    expect(result.brief).toMatch(/Concept Cards/i);
    expect(result.brief).toMatch(/Label → Structure/i);
    expect(result.brief).toMatch(/required practical|Ruler Drop|reaction time/i);
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

  test("options can disable frame and answer key on pedagogy brief", () => {
    const full = composeDiagramBrief(BRAIN_REGIONS_STRUCTURE_FUNCTION_SPEC);
    const trimmed = composeDiagramBrief(BRAIN_REGIONS_STRUCTURE_FUNCTION_SPEC, {
      includeFrame: false,
      includeAnswerKey: false,
    });
    expect(trimmed.ok).toBe(true);
    expect(trimmed.brief).not.toMatch(/THEN:/i);
    expect(trimmed.brief).not.toMatch(/TEACHER ANSWER KEY/i);
    expect(trimmed.teacherMetadata).toMatch(/TEACHER METADATA/i);
    expect(trimmed.brief.length).toBeLessThan(full.brief.length);
  });

  test("brief contains style rules", () => {
    const result = composeDiagramBrief(BRAIN_REGIONS_STRUCTURE_FUNCTION_SPEC);
    expect(result.ok).toBe(true);
    for (const marker of STYLE_MARKERS) {
      expect(result.brief.toLowerCase()).toContain(marker);
    }
  });

  test("brief does not include internal implementation fields", () => {
    const result = composeDiagramBrief(BRAIN_REGIONS_STRUCTURE_FUNCTION_SPEC);
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
  });
});
