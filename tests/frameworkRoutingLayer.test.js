/**
 * Phase 5B.1 — Framework routing layer (read-only definitions).
 */

const fs = require("fs");
const path = require("path");
const {
  FRAMEWORK_ROUTING_VERSION,
  FRAMEWORK_ROUTING_TABLE,
  FRAMEWORK_ROUTING_KEYS,
  isFrameworkRoutingEnabled,
  buildFrameworkRoutingPlan,
  resolveFrameworkRouting,
  resolveFrameworkRoutingFromClassification,
  listFrameworkRoutingDefinitions,
} = require("../lib/teacherBrain/frameworkRoutingLayer");

describe("Phase 5B.1 — frameworkRoutingLayer", () => {
  const prevFlag = process.env.TEACHER_BRAIN_FRAMEWORK_ROUTING;

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.TEACHER_BRAIN_FRAMEWORK_ROUTING;
    else process.env.TEACHER_BRAIN_FRAMEWORK_ROUTING = prevFlag;
  });

  test("routing disabled by default", () => {
    delete process.env.TEACHER_BRAIN_FRAMEWORK_ROUTING;
    expect(isFrameworkRoutingEnabled()).toBe(false);
    expect(resolveFrameworkRouting("signal_pathway")).toBeNull();
    expect(resolveFrameworkRoutingFromClassification({ framework: "signal_pathway" })).toBeNull();
  });

  test("flag OFF — buildFrameworkRoutingPlan still available for audit", () => {
    delete process.env.TEACHER_BRAIN_FRAMEWORK_ROUTING;
    const plan = buildFrameworkRoutingPlan("feedback_loop");
    expect(plan).toEqual({
      framework: "feedback_loop",
      openingPattern: "CONTROL_SYSTEM_FIRST",
      teachingPattern: "DETECT_CORRECT_RETURN",
      visualPattern: "FEEDBACK_LOOP",
      reasoningPattern: "CONTROL_REASONING",
    });
  });

  test("flag ON — resolves all 13 framework keys", () => {
    process.env.TEACHER_BRAIN_FRAMEWORK_ROUTING = "1";
    expect(FRAMEWORK_ROUTING_KEYS).toHaveLength(13);

    for (const key of FRAMEWORK_ROUTING_KEYS) {
      const plan = resolveFrameworkRouting(key);
      expect(plan).not.toBeNull();
      expect(plan.framework).toBe(key);
      expect(plan.openingPattern).toBe(FRAMEWORK_ROUTING_TABLE[key].openingPattern);
      expect(plan.teachingPattern).toBe(FRAMEWORK_ROUTING_TABLE[key].teachingPattern);
      expect(plan.visualPattern).toBe(FRAMEWORK_ROUTING_TABLE[key].visualPattern);
      expect(plan.reasoningPattern).toBe(FRAMEWORK_ROUTING_TABLE[key].reasoningPattern);
    }
  });

  test("flag ON — unknown classifier frameworks return null", () => {
    process.env.TEACHER_BRAIN_FRAMEWORK_ROUTING = "1";
    expect(resolveFrameworkRouting("molecular_process")).toBeNull();
    expect(resolveFrameworkRouting("process_sequence")).toBeNull();
    expect(resolveFrameworkRouting("")).toBeNull();
  });

  test("resolveFrameworkRoutingFromClassification accepts string or object", () => {
    process.env.TEACHER_BRAIN_FRAMEWORK_ROUTING = "1";
    const expected = buildFrameworkRoutingPlan("mitosis_wrong");
    expect(expected).toBeNull();

    const viaObject = resolveFrameworkRoutingFromClassification({ framework: "cellular_sequence" });
    expect(viaObject?.openingPattern).toBe("SEQUENCE_FIRST");

    const viaString = resolveFrameworkRoutingFromClassification("comparison");
    expect(viaString?.teachingPattern).toBe("SIMILARITIES_AND_DIFFERENCES");
  });

  test("listFrameworkRoutingDefinitions returns 13 audit rows", () => {
    const rows = listFrameworkRoutingDefinitions();
    expect(rows).toHaveLength(13);
    expect(rows.map((r) => r.framework).sort()).toEqual([...FRAMEWORK_ROUTING_KEYS].sort());
  });

  test("routing version is locked for Phase 5B.1", () => {
    expect(FRAMEWORK_ROUTING_VERSION).toBe("5B.1");
  });

  test("generation pipeline not wired — buildPrompt and ai routes omit routing layer", () => {
    const buildPromptSrc = fs.readFileSync(
      path.join(__dirname, "../lib/buildPrompt.js"),
      "utf8"
    );
    const aiRoutesSrc = fs.readFileSync(path.join(__dirname, "../backend/routes/ai.js"), "utf8");

    expect(buildPromptSrc).not.toMatch(/frameworkRoutingLayer/);
    expect(aiRoutesSrc).not.toMatch(/frameworkRoutingLayer/);
    expect(buildPromptSrc).not.toMatch(/FRAMEWORK ROUTING/i);
  });
});
