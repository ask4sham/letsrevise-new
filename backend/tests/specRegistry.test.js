/**
 * Spec identity registry — Phase 1 routing for board / level / examCode.
 */
const { resolveSpecIdentity, boardSubjectToSpecKey, getSpecMetadata } = require("../config/specRegistry");

describe("specRegistry", () => {
  const EDEXCEL_TOPIC = "edexcel-igcse-biology:human-male-and-female-reproductive-systems";

  test("resolveSpecIdentity prefers namespaced topicKey over wrong request body", () => {
    const identity = resolveSpecIdentity({
      topicKey: EDEXCEL_TOPIC,
      board: "AQA",
      subject: "Biology",
      level: "GCSE",
    });
    expect(identity).toEqual({
      specKey: "edexcel-igcse-biology",
      board: "Edexcel",
      level: "IGCSE",
      examCode: "4BI1",
      subject: "Biology",
    });
  });

  test("boardSubjectToSpecKey maps Edexcel Biology IGCSE", () => {
    expect(boardSubjectToSpecKey("Edexcel", "Biology", "IGCSE")).toBe("edexcel-igcse-biology");
  });

  test("boardSubjectToSpecKey keeps AQA GCSE Biology unchanged", () => {
    expect(boardSubjectToSpecKey("AQA", "Biology", "GCSE")).toBe("aqa-gcse-biology");
  });

  test("getSpecMetadata returns 4BI1 for Edexcel IGCSE Biology", () => {
    const meta = getSpecMetadata("edexcel-igcse-biology");
    expect(meta).toMatchObject({
      specKey: "edexcel-igcse-biology",
      board: "Edexcel",
      level: "IGCSE",
      examCode: "4BI1",
      subject: "Biology",
    });
  });
});
