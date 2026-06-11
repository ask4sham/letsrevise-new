/**
 * Phase 5B — Framework routing layer (definitions + prompt appendix).
 */

const fs = require("fs");
const path = require("path");
const {
  FRAMEWORK_ROUTING_VERSION,
  FRAMEWORK_ROUTING_TABLE,
  FRAMEWORK_ROUTING_KEYS,
  FRAMEWORK_ROUTING_APPENDIX_MARKER,
  FRAMEWORK_TEACHING_MOVES,
  isFrameworkRoutingEnabled,
  buildFrameworkRoutingPlan,
  resolveFrameworkRouting,
  resolveFrameworkRoutingFromClassification,
  listFrameworkRoutingDefinitions,
  formatFrameworkRoutingAppendix,
  formatTeachingMovesSection,
  buildFrameworkRoutingPromptSection,
} = require("../lib/teacherBrain/frameworkRoutingLayer");

describe("Phase 5B — frameworkRoutingLayer", () => {
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
    expect(buildFrameworkRoutingPromptSection({ framework: "signal_pathway" })).toBe("");
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
    expect(buildFrameworkRoutingPromptSection({ framework: "molecular_process" })).toBe("");
  });

  test("resolveFrameworkRoutingFromClassification accepts string or object", () => {
    process.env.TEACHER_BRAIN_FRAMEWORK_ROUTING = "1";

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

  test("routing version is locked for Phase 5B.3c", () => {
    expect(FRAMEWORK_ROUTING_VERSION).toBe("5B.3c");
  });

  test("every routed framework has mandatory teaching moves", () => {
    for (const key of FRAMEWORK_ROUTING_KEYS) {
      expect(FRAMEWORK_TEACHING_MOVES[key]?.length).toBeGreaterThanOrEqual(5);
    }
  });

  test("formatFrameworkRoutingAppendix — signal_pathway sample", () => {
    const plan = buildFrameworkRoutingPlan("signal_pathway");
    const appendix = formatFrameworkRoutingAppendix(plan);

    expect(appendix).toContain(FRAMEWORK_ROUTING_APPENDIX_MARKER);
    expect(appendix).toContain("Framework: signal_pathway");
    expect(appendix).toContain("OPENING PATTERN:");
    expect(appendix).toContain("PATHWAY_FIRST");
    expect(appendix).toContain("TEACHING PATTERN:");
    expect(appendix).toContain("FOLLOW_THE_SIGNAL");
    expect(appendix).toContain("MANDATORY TEACHING MOVES");
    expect(appendix).toContain("1. Identify stimulus and receptor location.");
    expect(appendix).toContain("VISUAL PATTERN:");
    expect(appendix).toContain("SIGNAL_FLOW_MAP");
    expect(appendix).toContain("REASONING PATTERN:");
    expect(appendix).toContain("STEP_BY_STEP_CAUSAL");
    expect(appendix).toMatch(/Do NOT change the mandated Teacher-First block order/i);
  });

  test("formatFrameworkRoutingAppendix — cellular_sequence includes stage moves", () => {
    const appendix = formatFrameworkRoutingAppendix(buildFrameworkRoutingPlan("cellular_sequence"));
    expect(appendix).toContain("STAGE_BY_STAGE");
    expect(appendix).toContain("interphase → PMAT → cytokinesis");
    expect(appendix).toContain("mitosis vs meiosis");
  });

  test("formatFrameworkRoutingAppendix — feedback_loop includes set-point moves", () => {
    const appendix = formatFrameworkRoutingAppendix(buildFrameworkRoutingPlan("feedback_loop"));
    expect(appendix).toContain("set point");
    expect(appendix).toContain("negative-feedback");
  });

  test("formatFrameworkRoutingAppendix — practical_method defers to RP shell", () => {
    const appendix = formatFrameworkRoutingAppendix(buildFrameworkRoutingPlan("practical_method"));
    expect(appendix).toMatch(/RP V2\.2 specialist shell/i);
  });

  test("formatTeachingMovesSection returns empty for unknown framework", () => {
    expect(formatTeachingMovesSection("molecular_process")).toBe("");
  });

  test("buildFrameworkRoutingPromptSection returns empty when flag OFF", () => {
    delete process.env.TEACHER_BRAIN_FRAMEWORK_ROUTING;
    expect(buildFrameworkRoutingPromptSection({ framework: "feedback_loop" })).toBe("");
  });

  test("buildFrameworkRoutingPromptSection returns appendix when flag ON", () => {
    process.env.TEACHER_BRAIN_FRAMEWORK_ROUTING = "1";
    const appendix = buildFrameworkRoutingPromptSection({ framework: "signal_pathway" });
    expect(appendix).toContain("PATHWAY_FIRST");
    expect(appendix).toContain("FOLLOW_THE_SIGNAL");
  });

  test("flag OFF vs ON — buildPrompt appendix gating (ESM subprocess)", () => {
    const { execFileSync } = require("child_process");
    const payload = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { buildPrompt } from './lib/buildPrompt.js';
const args = {
  subject: 'Biology',
  keyStage: 'KS4 - GCSE',
  examBoard: 'AQA',
  topic: 'The reflex arc',
  topicKey: 'aqa-gcse-biology:the-reflex-arc',
  subTopic: 'The reflex arc',
};
delete process.env.TEACHER_BRAIN_FRAMEWORK_ROUTING;
process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = '1';
const off = buildPrompt(args);
process.env.TEACHER_BRAIN_FRAMEWORK_ROUTING = '1';
const on = buildPrompt(args);
console.log(JSON.stringify({
  identical: off === on,
  offHasMarker: off.includes('FRAMEWORK ROUTING'),
  onHasMarker: on.includes('FRAMEWORK ROUTING'),
  onHasPathway: on.includes('PATHWAY_FIRST'),
  onLonger: on.length > off.length,
}));`,
      ],
      { cwd: path.join(__dirname, ".."), encoding: "utf8" }
    );
    const result = JSON.parse(payload.trim());
    expect(result.identical).toBe(false);
    expect(result.offHasMarker).toBe(false);
    expect(result.onHasMarker).toBe(true);
    expect(result.onHasPathway).toBe(true);
    expect(result.onLonger).toBe(true);
  });

  test("ai.js wires metadata + prompt appendix helpers only", () => {
    const aiRoutesSrc = fs.readFileSync(path.join(__dirname, "../backend/routes/ai.js"), "utf8");

    expect(aiRoutesSrc).toMatch(/resolveFrameworkRoutingFromClassification/);
    expect(aiRoutesSrc).toMatch(/buildFrameworkRoutingPromptSection/);
    expect(aiRoutesSrc).toMatch(/frameworkRouting/);
    expect(aiRoutesSrc).not.toMatch(/formatFrameworkRoutingAppendix/);
  });
});
