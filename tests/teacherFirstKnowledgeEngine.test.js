/**
 * Phase 3H.1 — Teacher-First Knowledge Delivery Engine unit tests.
 */

const {
  buildTeacherFirstOpeningPlan,
  buildUniversalFrameworkPlan,
  formatTeacherFirstOpeningAppendix,
  scoreTeacherFirstOpeningCoverage,
  isTeacherFirstOpeningEnabled,
  blockHasScenarioOpening,
  UNIVERSAL_TEACHER_FIRST_FRAMEWORK,
} = require("../lib/teacherBrain/teacherFirstKnowledgeEngine");
const {
  HOMEOSTASIS_OPENING,
  NERVOUS_SYSTEM_STRUCTURE_OPENING,
  THE_EYE_OPENING,
  REFLEX_ARC_OPENING,
  CELL_STRUCTURE_OPENING,
  CONTROL_BLOOD_GLUCOSE_OPENING,
  MITOSIS_CELL_CYCLE_OPENING,
  HOW_MATERIALS_CYCLED_OPENING,
  SUBJECT_TEACHING_PROFILES,
  resolveSubjectTeachingProfile,
  resolveTeacherFirstKnowledgeProfile,
} = require("../lib/teacherBrain/teacherFirstKnowledgeProfiles");

describe("teacherFirstKnowledgeEngine (Phase 3H.1)", () => {
  const prevFlag = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevFlag;
  });

  test("default flag off = no behavioural change", () => {
    delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    const plan = buildTeacherFirstOpeningPlan({
      topicKey: "aqa-gcse-biology:homeostasis",
      subTopic: "Homeostasis",
    });
    expect(plan.enabled).toBe(false);
    expect(formatTeacherFirstOpeningAppendix(plan)).toBe("");
    expect(isTeacherFirstOpeningEnabled()).toBe(false);
  });

  test("layer 1 universal framework defines opening order and sections", () => {
    const framework = buildUniversalFrameworkPlan();
    expect(framework.layer).toBe(1);
    expect(framework.openingOrder).toEqual(UNIVERSAL_TEACHER_FIRST_FRAMEWORK.openingOrder);
    expect(framework.sections.map((s) => s.label)).toEqual([
      "Definition",
      "Why it matters",
      "Core model",
      "Key examples",
      "Exam vocabulary",
      "Short scenario or activity",
    ]);
  });

  test("layer 2 biology is first implemented subject profile", () => {
    expect(SUBJECT_TEACHING_PROFILES.biology.implemented).toBe(true);
    expect(SUBJECT_TEACHING_PROFILES.chemistry.implemented).toBe(false);
    expect(SUBJECT_TEACHING_PROFILES.physics.implemented).toBe(false);
    expect(resolveSubjectTeachingProfile({ topicKey: "aqa-gcse-biology:homeostasis" })?.subjectKey).toBe(
      "biology"
    );
  });

  test("homeostasis opening plan contains definition, examples, and core model", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const plan = buildTeacherFirstOpeningPlan({
      profile: HOMEOSTASIS_OPENING,
      topicKey: "aqa-gcse-biology:homeostasis",
      subTopic: "Homeostasis",
      subject: "Biology",
    });
    expect(plan.enabled).toBe(true);
    expect(plan.framework.layer).toBe(1);
    expect(plan.subjectKey).toBe("biology");
    expect(plan.topicProfile?.taxonomyKey).toBe("homeostasis");
    expect(plan.usesUniversalFrameworkOnly).toBe(false);
    expect(plan.definition).toMatch(/Homeostasis is the regulation/);
    expect(plan.whyItMatters).toMatch(/Enzymes only work/);
    expect(plan.coreModel).toMatch(/Receptors/);
    expect(plan.keyExamples).toEqual(
      expect.arrayContaining(["Body temperature", "Blood glucose"])
    );
    expect(plan.examVocabulary).toEqual(
      expect.arrayContaining(["receptor", "coordination centre", "effector"])
    );
  });

  test("nervous-system opening plan contains rapid communication and stimulus pathway", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const plan = buildTeacherFirstOpeningPlan({
      profile: NERVOUS_SYSTEM_STRUCTURE_OPENING,
      topicKey: "aqa-gcse-biology:nervous-system-structure",
      subTopic: "Structure and function of the nervous system",
    });
    expect(plan.definition).toMatch(/rapid communication system/);
    expect(plan.coreModel).toMatch(/Stimulus/);
    expect(plan.coreModel).toMatch(/CNS/);
    expect(plan.coreModel).toMatch(/Effector/);
  });

  test("eye opening plan contains cornea lens retina model", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const plan = buildTeacherFirstOpeningPlan({
      profile: THE_EYE_OPENING,
      topicKey: "aqa-gcse-biology:the-eye",
      subTopic: "The eye",
    });
    expect(plan.definition).toMatch(/detects light/);
    expect(plan.coreModel).toBe("Cornea → Lens → Retina");
    expect(plan.examVocabulary).toEqual(
      expect.arrayContaining(["cornea", "lens", "retina", "accommodation"])
    );
  });

  test("prompt appendix tells generator not to begin with long scenario", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const appendix = formatTeacherFirstOpeningAppendix(
      buildTeacherFirstOpeningPlan({ profile: HOMEOSTASIS_OPENING })
    );
    expect(appendix).toMatch(/TEACHER-FIRST KNOWLEDGE DELIVERY/);
    expect(appendix).toMatch(/Do not begin with a long scenario/);
    expect(appendix).toMatch(/Do not use "Imagine\.\.\."/);
    expect(appendix).toMatch(/Scenario allowed only after definition/);
  });

  test("coverage scoring flags scenario-before-definition", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const plan = buildTeacherFirstOpeningPlan({ profile: HOMEOSTASIS_OPENING });
    const score = scoreTeacherFirstOpeningCoverage({
      plan,
      pages: [
        {
          blocks: [
            {
              type: "text",
              content:
                "Imagine you are walking on a hot day. Question to carry: what happens next?",
            },
            {
              type: "text",
              content:
                "Homeostasis regulates internal conditions. Receptors coordination centre effectors enzyme optimum.",
            },
          ],
        },
      ],
    });
    expect(score.scenarioBeforeDefinition).toBe(true);
    expect(score.openingTooScenarioHeavy).toBe(true);
    expect(score.flags).toEqual(
      expect.arrayContaining(["Scenario before definition", "Opening too scenario-heavy"])
    );
  });

  test("no profile falls back to universal framework only", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const plan = buildTeacherFirstOpeningPlan({
      topic: "Photosynthesis",
      subTopic: "Photosynthesis",
      topicKey: "aqa-gcse-biology:photosynthesis",
      subject: "Biology",
    });
    expect(plan.enabled).toBe(true);
    expect(plan.usesUniversalFrameworkOnly).toBe(true);
    expect(plan.topicProfile).toBeNull();
    expect(plan.subjectKey).toBe("biology");
    expect(plan.definition).toBe("");
    expect(plan.promptInstructions).toMatch(/Start with the definition/);
    const appendix = formatTeacherFirstOpeningAppendix(plan);
    expect(appendix).toMatch(/TEACHER-FIRST KNOWLEDGE DELIVERY/);
    expect(appendix).toMatch(/LAYER 1 — UNIVERSAL TEACHER-FIRST FRAMEWORK/);
    expect(appendix).toMatch(/Use Layer 1 universal framework only/);
  });

  test("unimplemented subject uses universal framework only", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const plan = buildTeacherFirstOpeningPlan({
      topic: "Atomic structure",
      subTopic: "Atomic structure",
      topicKey: "aqa-gcse-chemistry:atomic-structure",
      subject: "Chemistry",
    });
    expect(plan.usesUniversalFrameworkOnly).toBe(true);
    expect(plan.subjectProfile?.implemented).toBe(false);
    expect(plan.definition).toBe("");
  });

  test.each([
    {
      topicKey: "aqa-gcse-biology:reflex-arc",
      subTopic: "The reflex arc",
      profile: REFLEX_ARC_OPENING,
      definitionMatch: /automatic response/i,
    },
    {
      topicKey: "aqa-gcse-biology:cell-structure",
      subTopic: "Cell structure",
      profile: CELL_STRUCTURE_OPENING,
      definitionMatch: /parts of cells/i,
    },
    {
      topicKey: "aqa-gcse-biology:control-blood-glucose",
      subTopic: "Control of blood glucose concentration",
      profile: CONTROL_BLOOD_GLUCOSE_OPENING,
      definitionMatch: /glucose concentration/i,
    },
    {
      topicKey: "aqa-gcse-biology:mitosis-cell-cycle",
      subTopic: "Mitosis and the cell cycle",
      profile: MITOSIS_CELL_CYCLE_OPENING,
      definitionMatch: /genetically identical/i,
    },
    {
      topicKey: "aqa-gcse-biology:how-materials-cycled",
      subTopic: "How materials are cycled",
      profile: HOW_MATERIALS_CYCLED_OPENING,
      definitionMatch: /carbon cycle/i,
    },
  ])(
    "layer 2 profile resolves for $topicKey",
    ({ topicKey, subTopic, profile, definitionMatch }) => {
      expect(
        resolveTeacherFirstKnowledgeProfile({ topicKey, subTopic, subject: "Biology" })
      ).toBe(profile);

      process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
      const plan = buildTeacherFirstOpeningPlan({
        topicKey,
        subTopic,
        topic: subTopic,
        subject: "Biology",
      });
      expect(plan.enabled).toBe(true);
      expect(plan.usesUniversalFrameworkOnly).toBe(false);
      expect(plan.topicProfile?.taxonomyKey).toBe(profile.taxonomyKey);
      expect(plan.definition).toMatch(definitionMatch);
      expect(plan.coreModel.length).toBeGreaterThan(10);
    }
  );

  test("blood glucose resolves to dedicated profile not homeostasis", () => {
    const profile = resolveTeacherFirstKnowledgeProfile({
      topicKey: "aqa-gcse-biology:control-blood-glucose",
      subTopic: "Control of blood glucose concentration",
      subject: "Biology",
    });
    expect(profile?.taxonomyKey).toBe("control-blood-glucose");
    expect(profile?.taxonomyKey).not.toBe("homeostasis");
  });

  test("blockHasScenarioOpening detects imagine openings", () => {
    expect(
      blockHasScenarioOpening({ type: "text", content: "Imagine you are in a lab." })
    ).toBe(true);
    expect(
      blockHasScenarioOpening({ type: "text", content: "Homeostasis keeps conditions stable." })
    ).toBe(false);
  });
});
