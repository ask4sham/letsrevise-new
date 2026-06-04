/**
 * Phase 3H.0 — Concept Compression Engine unit tests.
 */

const {
  isConceptCompressionEnabled,
  buildConceptCompression,
  formatConceptCompressionAppendix,
  scoreConceptCompressionCoverage,
  resolveCompressionProfile,
  COMPRESSION_MARKER,
} = require("../lib/teacherBrain/conceptCompressionEngine");
const {
  resolveConceptCompressionProfile,
  HOMEOSTASIS_COMPRESSION,
  NERVOUS_SYSTEM_STRUCTURE_COMPRESSION,
  THE_EYE_COMPRESSION,
} = require("../lib/teacherBrain/conceptCompressionProfiles");

describe("conceptCompressionEngine (Phase 3H.0)", () => {
  const prevFlag = process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION;

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION;
    else process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION = prevFlag;
  });

  test("flag off — engine disabled", () => {
    delete process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION;
    expect(isConceptCompressionEnabled()).toBe(false);
    expect(resolveCompressionProfile({ subTopic: "Homeostasis" })).toBeNull();
    expect(formatConceptCompressionAppendix(HOMEOSTASIS_COMPRESSION)).toBe("");
  });

  test("flag on — resolves homeostasis profile", () => {
    process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION = "1";
    const profile = resolveConceptCompressionProfile({ subTopic: "Homeostasis" });
    expect(profile?.taxonomyKey).toBe("homeostasis");
    expect(buildConceptCompression(profile).coreModel).toMatch(/Receptors/);
  });

  test("flag on — resolves nervous-system-structure profile", () => {
    process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION = "1";
    const profile = resolveConceptCompressionProfile({
      topicKey: "aqa-gcse-biology:nervous-system-structure",
      subTopic: "Structure and function of the nervous system",
    });
    expect(profile?.taxonomyKey).toBe("nervous-system-structure");
    const compression = buildConceptCompression(profile);
    expect(compression.definition).toMatch(/rapid communication/i);
    expect(compression.examAnchors).toContain("Myelin");
  });

  test("flag on — resolves the eye profile", () => {
    process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION = "1";
    const profile = resolveConceptCompressionProfile({ subTopic: "The Eye" });
    expect(profile?.taxonomyKey).toBe("the-eye");
    expect(buildConceptCompression(profile).coreModel).toMatch(/Cornea/);
  });

  test("appendix includes CONCEPT COMPRESSION section", () => {
    process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION = "1";
    const appendix = formatConceptCompressionAppendix(NERVOUS_SYSTEM_STRUCTURE_COMPRESSION);
    expect(appendix).toMatch(COMPRESSION_MARKER);
    expect(appendix).toMatch(/Definition:/);
    expect(appendix).toMatch(/Why It Matters:/);
    expect(appendix).toMatch(/Core Model:/);
    expect(appendix).toMatch(/Exam Anchors/);
    expect(appendix).toMatch(/near the START/i);
  });

  test("scores high when early blocks contain compression elements", () => {
    process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION = "1";
    const pages = [
      {
        blocks: [
          {
            type: "objectives",
            content:
              "The nervous system is the body's rapid communication system. It allows organisms to detect and respond quickly.",
          },
          {
            type: "text",
            content:
              "Core model: Stimulus → Receptor → Neurone → CNS → Effector → Response. Key terms: axon, dendrite, myelin, PNS.",
          },
        ],
      },
    ];
    const score = scoreConceptCompressionCoverage({
      profile: NERVOUS_SYSTEM_STRUCTURE_COMPRESSION,
      pages,
    });
    expect(score.definitionPresent).toBe(true);
    expect(score.whyItMattersPresent).toBe(true);
    expect(score.coreModelPresent).toBe(true);
    expect(score.examAnchorsCovered).toBeGreaterThanOrEqual(3);
    expect(score.compressionScorePct).toBeGreaterThanOrEqual(75);
  });

  test("flags gaps when compression missing from early blocks", () => {
    process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION = "1";
    const score = scoreConceptCompressionCoverage({
      profile: NERVOUS_SYSTEM_STRUCTURE_COMPRESSION,
      pages: [{ blocks: [{ type: "text", content: "General biology notes only." }] }],
    });
    expect(score.compressionScorePct).toBeLessThan(100);
    expect(score.gaps.length).toBeGreaterThan(0);
  });

  test("photosynthesis — no profile", () => {
    process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION = "1";
    expect(
      resolveConceptCompressionProfile({ topic: "Photosynthesis", subTopic: "Photosynthesis" })
    ).toBeNull();
  });
});
