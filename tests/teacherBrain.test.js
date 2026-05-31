/**
 * Teacher Brain Phase 1 — Metabolism analysis smoke test.
 */

const { runTeacherBrain } = require("../lib/teacherBrain");

describe("Teacher Brain (Phase 1)", () => {
  const input = {
    topic: "Metabolism",
    subject: "Biology",
    examBoard: "AQA",
    tier: "Higher",
  };

  let output;

  beforeAll(() => {
    output = runTeacherBrain(input);
    // eslint-disable-next-line no-console
    console.log("\n--- Teacher Brain output: Metabolism ---\n");
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(output, null, 2));
  });

  test("returns all required top-level keys", () => {
    expect(output).toEqual(
      expect.objectContaining({
        coreConcepts: expect.any(Array),
        misconceptions: expect.any(Array),
        requiredDiagrams: expect.any(Array),
        activityRecommendations: expect.any(Array),
        examTargets: expect.any(Array),
        retrievalPlan: expect.any(Array),
      })
    );
  });

  test("Metabolism core concepts reflect GCSE teaching order", () => {
    expect(output.coreConcepts.length).toBeGreaterThanOrEqual(5);
    const names = output.coreConcepts.map((c) => c.name);
    expect(names).toContain("Metabolism");
    expect(names).toContain("ATP");
    expect(names).toContain("Catabolism");
    expect(names).toContain("Anabolism");
    expect(output.coreConcepts[0].teachingOrder).toBe(1);
  });

  test("misconceptions include ATP energy transfer trap", () => {
    const atp = output.misconceptions.find((m) => m.conceptId === "atp");
    expect(atp).toBeDefined();
    expect(atp.correction).toMatch(/transfer/i);
  });

  test("diagram planner returns briefs not generated assets", () => {
    expect(output.requiredDiagrams.length).toBeGreaterThanOrEqual(3);
    const economy = output.requiredDiagrams.find((d) => /economy/i.test(d.title));
    expect(economy).toMatchObject({
      type: expect.any(String),
      purpose: expect.any(String),
      mustShow: expect.arrayContaining([expect.any(String)]),
      hotspots: expect.any(Array),
      assessmentFocus: expect.any(Array),
    });
    expect(economy).not.toHaveProperty("visualId");
    expect(economy).not.toHaveProperty("imageUrl");
  });

  test("activity recommendations are types only", () => {
    expect(output.activityRecommendations.length).toBeGreaterThanOrEqual(5);
    const types = output.activityRecommendations.map((a) => a.activityType);
    expect(types).toContain("Worked Example");
    expect(types).toContain("Exam Practice");
    output.activityRecommendations.forEach((a) => {
      expect(a).toHaveProperty("rationale");
      expect(a).not.toHaveProperty("blocks");
    });
  });

  test("exam targets cover 1, 2, 4, 6 marks and Grade 9", () => {
    const marks = output.examTargets.map((e) => e.markFocus);
    expect(marks).toEqual(
      expect.arrayContaining(["1 mark", "2 mark", "4 mark", "6 mark", "Grade 9 challenge"])
    );
  });

  test("retrieval plan includes immediate, mid, and end phases", () => {
    const phases = [...new Set(output.retrievalPlan.map((r) => r.phase))];
    expect(phases).toContain("immediate");
    expect(phases).toContain("mid lesson");
    expect(phases).toContain("end lesson");
    expect(output.retrievalPlan.length).toBeGreaterThanOrEqual(5);
  });
});
