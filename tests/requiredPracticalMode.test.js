/**
 * Required Practical Mode — detection and lesson structure tests.
 */

const {
  isRequiredPracticalMode,
  isReactionTimePractical,
  isForbiddenTeacherFirstBlock,
  stripForbiddenTeacherFirstBlocks,
  isSpecialistBlockContentValid,
  enforceMandatorySpecialistBlocks,
  resolveRequiredPracticalProfile,
  buildRequiredPracticalOpeningPlan,
  buildRequiredPracticalSs1BlockOrderSection,
  buildRequiredPracticalFirstBlocksTemplateSection,
  buildRequiredPracticalDashboardPromptSection,
  buildRequiredPracticalReplacementDirective,
  buildRequiredPracticalSpecialistBlocksSection,
  formatRequiredPracticalAppendix,
  REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS,
  REQUIRED_PRACTICAL_MANDATORY_SPECIALIST_BLOCK_KEYS,
  REACTION_TIME_RP_PROFILE,
} = require("../lib/teacherBrain/requiredPracticalMode");
const { resolveTeacherFirstKnowledgeProfile } = require("../lib/teacherBrain/teacherFirstKnowledgeProfiles");
const {
  buildTeacherFirstOpeningPlan,
  formatTeacherFirstOpeningAppendix,
} = require("../lib/teacherBrain/teacherFirstKnowledgeEngine");
const {
  getSs1CanonicalSlots,
  buildSs1BlockOrderPromptSection,
  buildSs1FirstBlocksTemplateSection,
} = require("../lib/teacherBrain/teacherFirstSs1Architecture");
const {
  buildDashboardTeacherFirstPromptSection,
  enforceDashboardTeacherFirstOpening,
  enforceRequiredPracticalLessonStructure,
  REQUIRED_PRACTICAL_DASHBOARD_SLOTS,
} = require("../lib/teacherBrain/dashboardTeacherFirstOpening");

describe("requiredPracticalMode", () => {
  const prevFlag = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevFlag;
  });

  test("detects Required Practical from title and topicKey", () => {
    expect(
      isRequiredPracticalMode({
        topic: "Required Practical: Reaction time",
        topicKey: "aqa-gcse-biology:rp-reaction-time",
      })
    ).toBe(true);
    expect(isRequiredPracticalMode({ topic: "RP: Osmosis investigation" })).toBe(true);
    expect(isRequiredPracticalMode({ topic: "Food test experiment" })).toBe(true);
    expect(isRequiredPracticalMode({ topicKey: "aqa-gcse-biology:rp-osmosis" })).toBe(true);
  });

  test("does not trigger on normal theory topics", () => {
    expect(
      isRequiredPracticalMode({
        topic: "Homeostasis",
        topicKey: "aqa-gcse-biology:homeostasis",
        subTopic: "Homeostasis",
      })
    ).toBe(false);
    expect(
      isRequiredPracticalMode({
        topic: "The eye",
        topicKey: "aqa-gcse-biology:the-eye",
      })
    ).toBe(false);
  });

  test("normalizeReactionTimeRulerOrientation replaces forbidden top orientation", () => {
    const { normalizeReactionTimeRulerOrientation, REACTION_TIME_RULER_DROP_ORIENTATION } =
      require("../lib/teacherBrain/requiredPracticalMode");
    expect(
      normalizeReactionTimeRulerOrientation("Hold ruler with 0 cm at the top above the hand.")
    ).toBe(`Hold ruler with ${REACTION_TIME_RULER_DROP_ORIENTATION} above the hand.`);
  });

  test("reaction time profile includes ruler-drop method and variables", () => {
    const profile = resolveRequiredPracticalProfile({
      topic: "Required Practical: Reaction time",
      topicKey: "aqa-gcse-biology:rp-reaction-time",
    });
    expect(isReactionTimePractical({ topicKey: "aqa-gcse-biology:rp-reaction-time" })).toBe(true);
    expect(profile.equipment).toContain("30 cm ruler");
    expect(profile.methodSteps[0]).toMatch(/forearm resting on the table/i);
    expect(profile.methodSteps[1]).toMatch(/0 cm at the bottom aligned with the thumb/i);
    expect(profile.methodSteps[1]).not.toMatch(/0 cm at the top/i);
    expect(profile.variables.control).toContain("same ruler");
    expect(profile.variables.control.some((c) => /same ruler orientation/i.test(c))).toBe(true);
    expect(profile.analysis.join(" ")).toMatch(/smaller distance/i);
    expect(profile.evaluationGrid.some((r) => /light gate|electronic timer/i.test(r.improvement))).toBe(
      true
    );
    expect(REACTION_TIME_RP_PROFILE.taxonomyKey).toBe("rp-reaction-time");
  });

  test("skips homeostasis knowledge profile when RP mode active", () => {
    const profile = resolveTeacherFirstKnowledgeProfile({
      topic: "Required Practical: Reaction time",
      topicKey: "aqa-gcse-biology:rp-reaction-time",
      subTopic: "Homeostasis and Response",
      subject: "Biology",
    });
    expect(profile).toBeNull();
  });

  test("19-block SS1 structure when RP mode and teacher-first flag on", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const ctx = {
      topic: "Required Practical: Reaction time",
      subTopic: "Required Practical: Reaction time",
      topicKey: "aqa-gcse-biology:rp-reaction-time",
    };
    const slots = getSs1CanonicalSlots(ctx);
    expect(slots).toHaveLength(19);
    expect(slots.map((s) => s.title)).toEqual(REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS.map((s) => s.title));
    expect(slots[6].title).toBe("VARIABLES MATCHING ACTIVITY");
    expect(slots[8].title).toBe("METHOD");
    expect(slots[13].title).toBe("EVALUATION GRID");

    const section = buildSs1BlockOrderPromptSection(ctx);
    expect(section).toMatch(/REQUIRED PRACTICAL MODE/);
    expect(section).toMatch(/METHOD/);
    expect(section).toMatch(/NOT generate a general theory-only/);
    expect(section).not.toMatch(/DEFINITION/);
  });

  test("normal homeostasis SS1 unchanged when not RP", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const slots = getSs1CanonicalSlots({
      topic: "Homeostasis",
      topicKey: "aqa-gcse-biology:homeostasis",
    });
    expect(slots).toHaveLength(24);
    const section = buildSs1BlockOrderPromptSection({
      topic: "Homeostasis",
      topicKey: "aqa-gcse-biology:homeostasis",
    });
    expect(section).toMatch(/DEFINITION/);
    expect(section).not.toMatch(/REQUIRED PRACTICAL MODE/);
  });

  test("teacher-first opening plan uses RP appendix for reaction time", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const plan = buildTeacherFirstOpeningPlan({
      topic: "Required Practical: Reaction time",
      subTopic: "Required Practical: Reaction time",
      topicKey: "aqa-gcse-biology:rp-reaction-time",
      subject: "Biology",
    });
    expect(plan.mode).toBe("requiredPractical");
    expect(plan.openingOrder).toHaveLength(19);

    const appendix = formatTeacherFirstOpeningAppendix(plan);
    expect(appendix).toMatch(/REQUIRED PRACTICAL MODE/);
    expect(appendix).toMatch(/30 cm ruler/);
    expect(appendix).toMatch(/VARIABLES:/);
    expect(appendix).toMatch(/Independent variable/);
    expect(formatRequiredPracticalAppendix({ topic: "Homeostasis" })).toBe("");
  });

  test("dashboard prompt and enforcement use RP block order", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const ctx = {
      topic: "Required Practical: Reaction time",
      subTopic: "Required Practical: Reaction time",
      topicKey: "aqa-gcse-biology:rp-reaction-time",
      subject: "Biology",
    };

    const section = buildDashboardTeacherFirstPromptSection(ctx);
    expect(section).toMatch(/REQUIRED PRACTICAL MODE/);
    expect(section).toMatch(/Practical Purpose/);
    expect(section).toMatch(/30 cm ruler/);
    expect(section).not.toMatch(/title "Definition"/);

    const draft = {
      pages: [
        {
          blocks: [
            { type: "text", title: "Hook", role: "hook", content: "Imagine homeostasis..." },
            { type: "text", title: "Definition", role: "definition", content: "Homeostasis is..." },
          ],
        },
      ],
    };
    enforceDashboardTeacherFirstOpening(draft, ctx);
    const titles = draft.pages[0].blocks.slice(0, 19).map((b) => b.title);
    expect(titles).toEqual(REQUIRED_PRACTICAL_DASHBOARD_SLOTS.map((s) => s.title));
    expect(draft.pages[0].blocks[6].title).toBe("Variables Matching Activity");
    expect(draft.pages[0].blocks[8].title).toBe("Method");
    expect(draft.pages[0].blocks[8].content).toMatch(/releases ruler/i);
    expect(draft.pages[0].blocks[5].title).toBe("Variables");
    expect(draft.pages[0].blocks[13].title).toBe("Evaluation Grid");
    expect(draft.pages[0].blocks[7].content).toMatch(/30 cm ruler/);
    expect(draft.pages[0].blocks[10].content).toMatch(/\| Trial \|/);
    expect(draft.pages[0].blocks[13].content).toMatch(/Limitation/i);
    expect(draft.pages[0].blocks[10].content).toMatch(/Mean/i);
  });

  test("dashboard homeostasis prompt unchanged for non-RP topic", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const section = buildDashboardTeacherFirstPromptSection({
      topic: "Homeostasis",
      topicKey: "aqa-gcse-biology:homeostasis",
    });
    expect(section).toMatch(/DASHBOARD TEACHER-FIRST OPENING/);
    expect(section).toMatch(/title "Definition"/);
    expect(section).not.toMatch(/REQUIRED PRACTICAL MODE/);
  });

  test("buildRequiredPracticalSs1BlockOrderSection lists all 19 blocks", () => {
    const section = buildRequiredPracticalSs1BlockOrderSection({
      subTopic: "Required Practical: Reaction time",
    });
    expect(section).toMatch(/19 blocks/);
    expect(section).toMatch(/REQUIRED PRACTICAL EXAM PRACTICE/);
    expect(buildRequiredPracticalDashboardPromptSection({ subTopic: "RP test" })).toMatch(
      /investigation lesson/
    );
  });

  test("V2 replacement directive forbids teacher-first knowledge blocks", () => {
    const directive = buildRequiredPracticalReplacementDirective();
    expect(directive).toMatch(/FORBIDDEN/);
    expect(directive).toMatch(/Definition/);
    expect(directive).toMatch(/Practical Purpose/);
    expect(directive).toMatch(/FULL REPLACEMENT/);
  });

  test("SS1 first-blocks template uses practical blocks not Definition/Scenario", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const ctx = {
      topic: "Required Practical: Reaction time",
      subTopic: "Required Practical: Reaction time",
      topicKey: "aqa-gcse-biology:rp-reaction-time",
    };
    const template = buildSs1FirstBlocksTemplateSection(ctx);
    expect(template).toMatch(/PRACTICAL PURPOSE/);
    expect(template).toMatch(/SCIENTIFIC BACKGROUND/);
    expect(template).toMatch(/30 cm ruler/);
    expect(template).not.toMatch(/3 — DEFINITION/);
    expect(template).not.toMatch(/8 — SCENARIO/);
    expect(template).not.toMatch(/CORE MODEL/);
  });

  test("stripForbiddenTeacherFirstBlocks removes theory opening blocks", () => {
    expect(isForbiddenTeacherFirstBlock({ title: "Definition", role: "definition" })).toBe(true);
    expect(isForbiddenTeacherFirstBlock({ title: "Scenario", role: "hook" })).toBe(true);
    expect(isForbiddenTeacherFirstBlock({ title: "Method", role: "method" })).toBe(false);
    const kept = stripForbiddenTeacherFirstBlocks([
      { title: "Definition", role: "definition", content: "Homeostasis is..." },
      { title: "Method", role: "method", content: "Drop the ruler" },
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0].title).toBe("Method");
  });

  test("RP SS1 slot keys replace teacher-first knowledge slots entirely", () => {
    const keys = REQUIRED_PRACTICAL_SS1_CANONICAL_SLOTS.map((s) => s.key);
    expect(keys).not.toContain("definition");
    expect(keys).not.toContain("whyItMatters");
    expect(keys).not.toContain("coreModel");
    expect(keys).not.toContain("keyExamples");
    expect(keys).not.toContain("examVocabulary");
    expect(keys).not.toContain("scenario");
    expect(keys).not.toContain("coreTeaching");
    expect(keys).toContain("practicalPurpose");
    expect(keys).toContain("scientificBackground");
    expect(keys).toContain("hypothesis");
    expect(keys).toContain("variables");
    expect(keys).toContain("variablesMatch");
    expect(keys).toContain("equipment");
    expect(keys).toContain("method");
    expect(keys).toContain("resultsTable");
    expect(keys).toContain("analysis");
    expect(keys).toContain("evaluationGrid");
    expect(REQUIRED_PRACTICAL_MANDATORY_SPECIALIST_BLOCK_KEYS).toEqual([
      "equipment",
      "method",
      "resultsTable",
      "evaluationGrid",
    ]);
  });

  test("V2.1 specialist blocks section mandates four structured blocks", () => {
    const section = buildRequiredPracticalSpecialistBlocksSection();
    expect(section).toMatch(/MANDATORY SPECIALIST BLOCKS/);
    expect(section).toMatch(/EQUIPMENT/);
    expect(section).toMatch(/METHOD/);
    expect(section).toMatch(/RESULTS TABLE/);
    expect(section).toMatch(/EVALUATION GRID/);
  });

  test("isSpecialistBlockContentValid rejects thin equipment and method blocks", () => {
    expect(isSpecialistBlockContentValid("- ruler", "equipment")).toBe(false);
    expect(isSpecialistBlockContentValid("- ruler\n- partner\n- table", "equipment")).toBe(true);
    expect(isSpecialistBlockContentValid("Drop the ruler once.", "method")).toBe(false);
    expect(
      isSpecialistBlockContentValid("1. Sit\n2. Hold\n3. Drop\n4. Catch\n5. Record", "method")
    ).toBe(true);
    expect(isSpecialistBlockContentValid("Results were good.", "resultsTable")).toBe(false);
    expect(
      isSpecialistBlockContentValid(
        "| Trial | Reading |\n| --- | --- |\n| 1 | |\n| 2 | |\n| Mean | |",
        "resultsTable"
      )
    ).toBe(true);
    expect(isSpecialistBlockContentValid("It was unreliable.", "evaluationGrid")).toBe(false);
    expect(
      isSpecialistBlockContentValid(
        "| Limitation | Effect on Results | Improvement |\n| --- | --- | --- |\n| Anticipation | x | y |",
        "evaluationGrid"
      )
    ).toBe(true);
  });

  test("reaction time interactive diagram preset has setup hotspots", () => {
    const { buildReactionTimeInteractiveDiagramBlock, enforceReactionTimeInteractiveDiagram } =
      require("../lib/teacherBrain/requiredPracticalMode");
    const preset = buildReactionTimeInteractiveDiagramBlock();
    expect(preset.type).toBe("interactiveDiagram");
    expect(preset.hotspots.map((h) => h.label)).toEqual(
      expect.arrayContaining(["Ruler", "Release point", "Measurement scale"])
    );
    const blocks = enforceReactionTimeInteractiveDiagram(
      [{ type: "diagram", title: "Practical Setup Diagram", role: "diagram", content: "image" }],
      { topicKey: "aqa-gcse-biology:rp-reaction-time" }
    );
    expect(blocks[0].type).toBe("interactiveDiagram");
    expect(blocks[0].hotspots.length).toBeGreaterThanOrEqual(5);
  });

  test("enforceMandatorySpecialistBlocks inserts missing specialist blocks before exam technique", () => {
    const plan = buildRequiredPracticalOpeningPlan({
      topic: "Required Practical: Reaction time",
      topicKey: "aqa-gcse-biology:rp-reaction-time",
    });
    const blocks = enforceMandatorySpecialistBlocks(
      [
        { title: "Variables", role: "variables", content: "IV: caffeine" },
        { title: "Exam Technique", role: "examTechnique", content: "Use precise terms." },
        { title: "Summary", role: "synthesis", content: "Key points." },
      ],
      plan
    );
    const titles = blocks.map((b) => b.title);
    expect(titles).toContain("Equipment");
    expect(titles).toContain("Method");
    expect(titles).toContain("Results Table");
    expect(titles).toContain("Evaluation Grid");
    const examIdx = titles.indexOf("Exam Technique");
    expect(titles.indexOf("Equipment")).toBeLessThan(examIdx);
    expect(titles.indexOf("Method")).toBeLessThan(examIdx);
    expect(titles.indexOf("Results Table")).toBeLessThan(examIdx);
    expect(titles.indexOf("Evaluation Grid")).toBeLessThan(examIdx);
  });

  test("enforceMandatorySpecialistBlocks upgrades thin specialist content", () => {
    const plan = buildRequiredPracticalOpeningPlan({
      topic: "Required Practical: Reaction time",
      topicKey: "aqa-gcse-biology:rp-reaction-time",
    });
    const blocks = enforceMandatorySpecialistBlocks(
      [
        { title: "Equipment", role: "equipment", content: "ruler" },
        { title: "Method", role: "method", content: "do the test" },
        { title: "Results Table", role: "resultsTable", content: "see results" },
        { title: "Evaluation Grid", role: "evaluationGrid", content: "ok" },
      ],
      plan
    );
    expect(blocks[0].content).toMatch(/30 cm ruler/);
    expect(blocks[1].content).toMatch(/releases ruler/i);
    expect(blocks[2].content).toMatch(/\| Trial \|/);
    expect(blocks[3].content).toMatch(/Limitation/i);
  });

  test("dashboard enforcement strips forbidden blocks from remainder", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const ctx = {
      topic: "Required Practical: Reaction time",
      subTopic: "Required Practical: Reaction time",
      topicKey: "aqa-gcse-biology:rp-reaction-time",
      subject: "Biology",
    };
    const draft = {
      pages: [
        {
          blocks: [
            { type: "text", title: "Definition", role: "definition", content: "Homeostasis..." },
            { type: "text", title: "Scenario", role: "hook", content: "Imagine..." },
            { type: "text", title: "Core model", role: "coreRule", content: "Stimulus pathway" },
          ],
        },
      ],
    };
    enforceDashboardTeacherFirstOpening(draft, ctx);
    const remainderTitles = draft.pages[0].blocks.slice(19).map((b) => b.title);
    expect(remainderTitles).not.toContain("Definition");
    expect(remainderTitles).not.toContain("Scenario");
    expect(remainderTitles).not.toContain("Core model");
  });

  test("RP enforcement runs when teacher-first flag is off", () => {
    delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    const ctx = {
      topic: "Required Practical: Reaction time",
      subTopic: "Required Practical: Reaction time",
      topicKey: "aqa-gcse-biology:rp-reaction-time",
      subject: "Biology",
    };
    const draft = {
      pages: [
        {
          blocks: [
            { type: "text", title: "Definition", role: "definition", content: "Homeostasis..." },
            { type: "text", title: "Exam Technique", role: "examTechnique", content: "Be precise." },
          ],
        },
      ],
    };
    enforceRequiredPracticalLessonStructure(draft, ctx);
    const titles = draft.pages[0].blocks.map((b) => b.title);
    expect(titles).toContain("Equipment");
    expect(titles).toContain("Method");
    expect(titles).toContain("Results Table");
    expect(titles).toContain("Evaluation Grid");
    expect(titles.indexOf("Equipment")).toBeLessThan(titles.indexOf("Exam Technique"));
    expect(titles.indexOf("Method")).toBeLessThan(titles.indexOf("Exam Technique"));
    expect(titles.indexOf("Results Table")).toBeLessThan(titles.indexOf("Exam Technique"));
    expect(titles.indexOf("Evaluation Grid")).toBeLessThan(titles.indexOf("Exam Technique"));
  });
});
